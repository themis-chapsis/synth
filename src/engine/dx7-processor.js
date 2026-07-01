/**
 * FM DSP core, running inside the AudioWorklet (spec section 10).
 *
 * Registered as 'dx7-processor'. A single processor instance owns all 16
 * voices; blocks are the worklet-standard 128 samples and the sample rate
 * is taken from the context (never hardcoded).
 *
 * This file must stay self-contained (no imports): it is loaded as a
 * worklet module via `new URL(..., import.meta.url)`, which Vite emits
 * as-is without rewriting import paths. Registration is guarded so node
 * (vitest) can import the DSP classes directly; Operator.js /
 * EnvelopeGenerator.js re-export from here to keep the spec's layout.
 *
 * Milestone 5 scope: one operator (OP1) per voice — sine through the
 * 4-stage rate/level envelope, frequency from OP1 mode/coarse/fine/detune
 * and the common transpose, live parameter updates via the 'voice'
 * message. Algorithms/modulation (M6-7) and LFO/pitch EG (M8) follow.
 *
 * PROVISIONAL DSP MATH (documented deviation, spec 10.3): the EG ROM and
 * output-level tables from the reverse-engineering references are blocked
 * by this environment's network policy (see /reference/README.md). Until
 * they can be transcribed, levels use the widely documented ~0.75 dB per
 * step mapping and rates use exponential slopes calibrated to published
 * timing ballparks. The class API already matches the table-driven form
 * so swapping in the real tables is a constants-only change.
 *
 * Message protocol (main thread -> processor):
 *   {type:'noteOn', note, velocity}   MIDI note, velocity 1-127
 *   {type:'noteOff', note}
 *   {type:'allOff'}
 *   {type:'voice', data:number[155], opOnOff:boolean[6]}
 */

const NUM_VOICES = 16;
const TWO_PI = 2 * Math.PI;
const SILENCE_DB = -96;

/* ---------------------------------------------------------------- *
 * Voice buffer indices (unpacked dump order, OP6 first — must match *
 * src/state/voiceParams.js).                                        *
 * ---------------------------------------------------------------- */
const OP_STRIDE = 21;
/** Start index of an operator's block; op is 1-6 human numbering. */
const opBase = (op) => (6 - op) * OP_STRIDE;
const OP = {
  EGR: 0, // +0..3
  EGL: 4, // +4..7
  BP: 8, LD: 9, RD: 10, LC: 11, RC: 12, RS: 13,
  AMS: 14, KVS: 15, OL: 16, MODE: 17, FC: 18, FF: 19, DET: 20
};
const IDX_ALGORITHM = 126 + 8;
const IDX_TRANSPOSE = 126 + 18;

/** EG/output level parameter (0-99) -> dB (0 dB at 99). ~0.75 dB/step. */
export function levelToDb(l) {
  if (l <= 0) return SILENCE_DB;
  return Math.max(SILENCE_DB, (l - 99) * 0.75);
}

export const dbToAmp = (db) => (db <= SILENCE_DB ? 0 : 10 ** (db / 20));

/**
 * 4-stage rate/level envelope generator (spec 10.3).
 *
 * Stages: key-on runs L1 (attack) -> L2 -> L3; the EG then sustains at L3
 * until key-off, which starts the release toward L4 at R4. (The spec text
 * describes sustain at L2 but asks for verification: the Operation Manual
 * defines EG decay 1 to L2, decay 2 to L3 = sustain, release to L4 —
 * implemented accordingly.)
 *
 * Attack segments rise exponentially toward the target; decays move
 * linearly in dB, both with provisional rate calibration (see header).
 */
export class EnvelopeGenerator {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.rates = [99, 99, 99, 99];
    this.levels = [99, 99, 99, 0];
    this.stage = 3;
    this.db = SILENCE_DB;
    this.gate = false;
  }

  setParams(rates, levels) {
    this.rates = rates;
    this.levels = levels;
  }

  keyOn() {
    this.gate = true;
    this.stage = 0;
  }

  keyOff() {
    this.gate = false;
    this.stage = 3;
  }

  /** dB the current stage is heading to. */
  targetDb() {
    return levelToDb(this.levels[this.stage]);
  }

  /** dB/second decay slope for a rate parameter (provisional curve). */
  decaySlope(rate) {
    return 0.28 * 2 ** (rate / 6.5);
  }

  /** Advance one sample; returns linear amplitude 0..1. */
  tick() {
    const target = this.targetDb();
    const dt = 1 / this.sampleRate;

    if (this.db < target) {
      // Rising segment: exponential approach (attack-shaped).
      const tau = 0.002 * 2 ** ((72 - this.rates[this.stage]) / 8);
      this.db += (target - this.db) * (dt / tau);
      if (target - this.db < 0.5) this.db = target;
    } else if (this.db > target) {
      this.db -= this.decaySlope(this.rates[this.stage]) * dt;
      if (this.db < target) this.db = target;
    }

    if (this.db === target && this.gate && this.stage < 2) {
      this.stage++;
    }
    return dbToAmp(this.db);
  }

  isSilent() {
    return !this.gate && this.db <= SILENCE_DB + 0.5;
  }
}

/** OP1 frequency per spec 10.2 from the voice buffer. */
export function op1Frequency(voice, note) {
  const base = opBase(1);
  const transpose = (voice[IDX_TRANSPOSE] ?? 24) - 24;
  const n = note + transpose;
  const noteFreq = 440 * 2 ** ((n - 69) / 12);

  const mode = voice[base + OP.MODE];
  const coarse = voice[base + OP.FC];
  const fine = voice[base + OP.FF];
  const det = voice[base + OP.DET];

  if (mode === 1) {
    // Fixed: 1/10/100/1000 Hz decades, fine multiplies up to x10.
    return 10 ** ((coarse % 4) + fine / 100);
  }
  const ratio = (coarse === 0 ? 0.5 : coarse) * (1 + fine / 100);
  const detuneCents = (det - 7) * 1.5; // provisional +/- ~10 cent span
  return noteFreq * ratio * 2 ** (detuneCents / 1200);
}

class Voice {
  constructor(sampleRate) {
    this.active = false;
    this.note = -1;
    this.phase = 0;
    this.phaseInc = 0;
    this.velocity = 1;
    this.startTime = 0; // for oldest-first stealing
    this.eg = new EnvelopeGenerator(sampleRate);
  }
}

/** INIT VOICE fallback so the processor is playable before the first sync. */
function defaultVoice() {
  const v = new Array(155).fill(0);
  for (let op = 1; op <= 6; op++) {
    const b = opBase(op);
    for (let i = 0; i < 4; i++) v[b + OP.EGR + i] = 99;
    for (let i = 0; i < 3; i++) v[b + OP.EGL + i] = 99;
    v[b + OP.FC] = 1;
    v[b + OP.DET] = 7;
  }
  v[opBase(1) + OP.OL] = 99;
  v[IDX_TRANSPOSE] = 24;
  return v;
}

class DX7Processor extends (globalThis.AudioWorkletProcessor ?? class {}) {
  constructor() {
    super();
    const sr = sampleRate; // worklet global
    this.voices = Array.from({ length: NUM_VOICES }, () => new Voice(sr));
    this.clock = 0;
    this.voiceData = defaultVoice();
    this.opOnOff = [true, true, true, true, true, true];
    this.port.onmessage = (e) => this.handleMessage(e.data);
  }

  applyVoiceParams() {
    const b = opBase(1);
    const rates = this.voiceData.slice(b + OP.EGR, b + OP.EGR + 4);
    const levels = this.voiceData.slice(b + OP.EGL, b + OP.EGL + 4);
    for (const v of this.voices) {
      v.eg.setParams(rates, levels);
      if (v.active) v.phaseInc = (TWO_PI * op1Frequency(this.voiceData, v.note)) / sampleRate;
    }
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'noteOn': {
        const voice = this.allocate(msg.note);
        voice.active = true;
        voice.note = msg.note;
        voice.phase = 0;
        voice.phaseInc = (TWO_PI * op1Frequency(this.voiceData, msg.note)) / sampleRate;
        voice.velocity = (msg.velocity ?? 100) / 127;
        voice.startTime = this.clock;
        voice.eg.keyOn();
        break;
      }
      case 'noteOff':
        for (const v of this.voices) {
          if (v.active && v.eg.gate && v.note === msg.note) v.eg.keyOff();
        }
        break;
      case 'allOff':
        for (const v of this.voices) v.eg.keyOff();
        break;
      case 'voice':
        this.voiceData = msg.data;
        if (msg.opOnOff) this.opOnOff = msg.opOnOff;
        this.applyVoiceParams();
        break;
    }
  }

  /** Free voice if available, else steal the oldest (spec 10.7). */
  allocate(note) {
    let candidate = this.voices.find((v) => v.active && v.note === note);
    if (candidate) return candidate;
    candidate = this.voices.find((v) => !v.active);
    if (candidate) return candidate;
    return this.voices.reduce((a, b) => (a.startTime <= b.startTime ? a : b));
  }

  process(_inputs, outputs) {
    const out = outputs[0][0];
    out.fill(0);

    const olAmp = dbToAmp(levelToDb(this.voiceData[opBase(1) + OP.OL]));
    const opOn = this.opOnOff[0] ? 1 : 0;

    for (const v of this.voices) {
      if (!v.active) continue;
      for (let i = 0; i < out.length; i++) {
        const env = v.eg.tick();
        out[i] += Math.sin(v.phase) * env * olAmp * opOn * v.velocity * 0.25;
        v.phase += v.phaseInc;
        if (v.phase > TWO_PI) v.phase -= TWO_PI;
      }
      if (v.eg.isSilent()) v.active = false;
    }

    this.clock += out.length;
    return true;
  }
}

if (typeof registerProcessor === 'function') {
  registerProcessor('dx7-processor', DX7Processor);
}
