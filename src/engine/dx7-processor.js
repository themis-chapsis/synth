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
 * (vitest) can import the DSP classes/tables directly; Operator.js,
 * EnvelopeGenerator.js and Algorithm.js re-export from here to keep the
 * spec's file layout.
 *
 * Milestones 6-7 scope: full 6-operator phase-modulation synthesis over
 * all 32 algorithm topologies, per-operator envelopes, operator on/off,
 * feedback (self and cross-op loops in algorithms 4/6), key velocity
 * sensitivity. LFO and pitch EG land in milestone 8; keyboard level/rate
 * scaling in milestone 10.
 *
 * PROVISIONAL DSP MATH (documented deviation, spec 10.3/10.5): the EG ROM
 * and level/index tables from the reverse-engineering references are
 * blocked by this environment's network policy (/reference/README.md).
 * Until transcribed: levels map at the widely documented ~0.75 dB/step;
 * EG rates use exponential slopes calibrated to published ballparks;
 * modulation index peaks at 2*pi*4.6 rad for level 99 (the spec's
 * figure); feedback averages the source's last two samples (standard
 * anti-oscillation) scaled to +/-pi at FB=7. All are constants-only
 * swaps once the tables arrive.
 *
 * Message protocol (main thread -> processor):
 *   {type:'noteOn', note, velocity}   MIDI note, velocity 1-127
 *   {type:'noteOff', note}
 *   {type:'allOff'}
 *   {type:'voice', data:number[155], opOnOff:boolean[6]}
 */

const NUM_VOICES = 16;
const NUM_OPS = 6;
const TWO_PI = 2 * Math.PI;
const SILENCE_DB = -96;
/** Peak phase deviation contributed by a level-99 modulator (spec 10.5). */
const MOD_INDEX_MAX = TWO_PI * 4.6;
/** Peak self/loop feedback deviation at FB=7 (provisional). */
const FEEDBACK_MAX = Math.PI;
const VOICE_AMP = 0.2;

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
const IDX_PEG_R = 126; // +0..3, then levels +4..7
const IDX_PEG_L = 126 + 4;
const IDX_ALGORITHM = 126 + 8;
const IDX_FEEDBACK = 126 + 9;
const IDX_OSC_SYNC = 126 + 10;
const IDX_LFO_SPEED = 126 + 11;
const IDX_LFO_DELAY = 126 + 12;
const IDX_LFO_PMD = 126 + 13;
const IDX_LFO_AMD = 126 + 14;
const IDX_LFO_SYNC = 126 + 15;
const IDX_LFO_WAVE = 126 + 16;
const IDX_PMS = 126 + 17;
const IDX_TRANSPOSE = 126 + 18;

/* ---------------------------------------------------------------- *
 * The 32 algorithm topologies (spec 10.4), transcribed from the     *
 * Operation Manual chart. Operator indices are 0-based (op1 = 0).   *
 * `modulation[target] = [modulators]`; every modulator has a higher *
 * number than its target except feedback, which is listed as        *
 * `feedback` (the op whose input the loop enters) + `feedbackSource`*
 * (whose output it taps — differs only in algorithms 4 and 6).      *
 * ---------------------------------------------------------------- */
export const algorithms = [
  { id: 1, carriers: [0, 2], modulation: { 0: [1], 2: [3], 3: [4], 4: [5] }, feedback: 5 },
  { id: 2, carriers: [0, 2], modulation: { 0: [1], 2: [3], 3: [4], 4: [5] }, feedback: 1 },
  { id: 3, carriers: [0, 3], modulation: { 0: [1], 1: [2], 3: [4], 4: [5] }, feedback: 5 },
  { id: 4, carriers: [0, 3], modulation: { 0: [1], 1: [2], 3: [4], 4: [5] }, feedback: 5, feedbackSource: 3 },
  { id: 5, carriers: [0, 2, 4], modulation: { 0: [1], 2: [3], 4: [5] }, feedback: 5 },
  { id: 6, carriers: [0, 2, 4], modulation: { 0: [1], 2: [3], 4: [5] }, feedback: 5, feedbackSource: 4 },
  { id: 7, carriers: [0, 2], modulation: { 0: [1], 2: [3, 4], 4: [5] }, feedback: 5 },
  { id: 8, carriers: [0, 2], modulation: { 0: [1], 2: [3, 4], 4: [5] }, feedback: 3 },
  { id: 9, carriers: [0, 2], modulation: { 0: [1], 2: [3, 4], 4: [5] }, feedback: 1 },
  { id: 10, carriers: [0, 3], modulation: { 0: [1], 1: [2], 3: [4, 5] }, feedback: 2 },
  { id: 11, carriers: [0, 3], modulation: { 0: [1], 1: [2], 3: [4, 5] }, feedback: 5 },
  { id: 12, carriers: [0, 2], modulation: { 0: [1], 2: [3, 4, 5] }, feedback: 1 },
  { id: 13, carriers: [0, 2], modulation: { 0: [1], 2: [3, 4, 5] }, feedback: 5 },
  { id: 14, carriers: [0, 2], modulation: { 0: [1], 2: [3], 3: [4, 5] }, feedback: 5 },
  { id: 15, carriers: [0, 2], modulation: { 0: [1], 2: [3], 3: [4, 5] }, feedback: 1 },
  { id: 16, carriers: [0], modulation: { 0: [1, 2, 4], 2: [3], 4: [5] }, feedback: 5 },
  { id: 17, carriers: [0], modulation: { 0: [1, 2, 4], 2: [3], 4: [5] }, feedback: 1 },
  { id: 18, carriers: [0], modulation: { 0: [1, 2, 3], 3: [4], 4: [5] }, feedback: 2 },
  { id: 19, carriers: [0, 3, 4], modulation: { 0: [1], 1: [2], 3: [5], 4: [5] }, feedback: 5 },
  { id: 20, carriers: [0, 1, 3], modulation: { 0: [2], 1: [2], 3: [4, 5] }, feedback: 2 },
  { id: 21, carriers: [0, 1, 3, 4], modulation: { 0: [2], 1: [2], 3: [5], 4: [5] }, feedback: 2 },
  { id: 22, carriers: [0, 2, 3, 4], modulation: { 0: [1], 2: [5], 3: [5], 4: [5] }, feedback: 5 },
  { id: 23, carriers: [0, 1, 3, 4], modulation: { 1: [2], 3: [5], 4: [5] }, feedback: 5 },
  { id: 24, carriers: [0, 1, 2, 3, 4], modulation: { 2: [5], 3: [5], 4: [5] }, feedback: 5 },
  { id: 25, carriers: [0, 1, 2, 3, 4], modulation: { 3: [5], 4: [5] }, feedback: 5 },
  { id: 26, carriers: [0, 1, 3], modulation: { 1: [2], 3: [4, 5] }, feedback: 5 },
  { id: 27, carriers: [0, 1, 3], modulation: { 1: [2], 3: [4, 5] }, feedback: 2 },
  { id: 28, carriers: [0, 2, 5], modulation: { 0: [1], 2: [3], 3: [4] }, feedback: 4 },
  { id: 29, carriers: [0, 1, 2, 4], modulation: { 2: [3], 4: [5] }, feedback: 5 },
  { id: 30, carriers: [0, 1, 2, 5], modulation: { 2: [3], 3: [4] }, feedback: 4 },
  { id: 31, carriers: [0, 1, 2, 3, 4], modulation: { 4: [5] }, feedback: 5 },
  { id: 32, carriers: [0, 1, 2, 3, 4, 5], modulation: {}, feedback: 5 }
];

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

/**
 * LFO (spec 10.6): 6 waveforms, one instance shared by all voices like
 * the original. Speed 0-99 maps nonlinearly to Hz and delay to a fade-in
 * time (provisional curves pending the blocked EG ROM tables; see
 * header). Pitch output is bipolar -1..1; amp output is unipolar 0..1
 * (attenuation depth).
 */
export class LFO {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.phase = 0; // 0..1
    this.hz = 0.06;
    this.wave = 0;
    this.shValue = 0;
  }

  /** Speed parameter 0-99 -> Hz (provisional curve, ~0.06 to ~40 Hz). */
  static speedToHz(s) {
    return 0.062 + (s / 12.7) ** 1.75;
  }

  /** Delay parameter 0-99 -> seconds before the fade-in completes. */
  static delayToSeconds(d) {
    return d === 0 ? 0 : (d / 99) ** 2 * 5;
  }

  setParams(speed, wave) {
    this.hz = LFO.speedToHz(speed);
    this.wave = wave;
  }

  reset() {
    this.phase = 0;
  }

  /** Advance by n samples; returns bipolar value for the block. */
  tickBlock(n) {
    const prev = this.phase;
    this.phase += (this.hz * n) / this.sampleRate;
    if (this.phase >= 1) {
      this.phase -= Math.floor(this.phase);
      // New random level each cycle for sample-and-hold.
      this.shValue = Math.random() * 2 - 1;
    }
    const p = prev;
    switch (this.wave) {
      case 0: return p < 0.5 ? 4 * p - 1 : 3 - 4 * p; // triangle
      case 1: return 1 - 2 * p; // saw down
      case 2: return 2 * p - 1; // saw up
      case 3: return p < 0.5 ? 1 : -1; // square
      case 4: return Math.sin(TWO_PI * p); // sine
      case 5: return this.shValue; // sample & hold
      default: return 0;
    }
  }
}

/**
 * Pitch envelope (spec 10.8): global 4-stage rate/level EG applied to all
 * operators' base frequency. Levels are centered at 50 = no change and
 * span +/-4 octaves; movement is linear in semitones at a provisional
 * rate curve.
 */
export class PitchEG {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.rates = [99, 99, 99, 99];
    this.levels = [50, 50, 50, 50];
    this.semis = 0;
    this.stage = 3;
    this.gate = false;
  }

  static levelToSemis(l) {
    return ((l - 50) / 50) * 48;
  }

  setParams(rates, levels) {
    this.rates = rates;
    this.levels = levels;
  }

  keyOn() {
    this.gate = true;
    this.stage = 0;
    this.semis = PitchEG.levelToSemis(this.levels[3]);
  }

  keyOff() {
    this.gate = false;
    this.stage = 3;
  }

  /** Advance by n samples; returns current offset in semitones. */
  tickBlock(n) {
    const target = PitchEG.levelToSemis(this.levels[this.stage]);
    // Provisional: semitones/second doubling every ~7 rate steps.
    const slope = (0.4 * 2 ** (this.rates[this.stage] / 7) * n) / this.sampleRate;
    if (this.semis < target) {
      this.semis = Math.min(target, this.semis + slope);
    } else if (this.semis > target) {
      this.semis = Math.max(target, this.semis - slope);
    }
    if (this.semis === target && this.gate && this.stage < 2) this.stage++;
    return this.semis;
  }
}

/**
 * Keyboard level scaling (spec section 2 / Operation Manual): scales an
 * operator's output level by the note's distance from the break point.
 * Break point 0-99 maps to A-1..C8 (MIDI 21-120); the left curve/depth
 * pair applies below it, right above. '-' curves subtract level units,
 * '+' curves add; LIN reaches full depth 6 octaves out, EXP accelerates
 * (provisional normalization pending references).
 *
 * @returns {number} effective output level 0-99
 */
export function scaledOutputLevel(voice, op, note) {
  const b = opBase(op);
  const ol = voice[b + OP.OL];
  const bpMidi = voice[b + OP.BP] + 21;
  const dist = note - bpMidi;
  if (dist === 0) return ol;

  const below = dist < 0;
  const depth = voice[b + (below ? OP.LD : OP.RD)];
  const curve = voice[b + (below ? OP.LC : OP.RC)];
  if (depth === 0) return ol;

  const span = Math.abs(dist);
  const isExp = curve === 1 || curve === 2; // -EXP / +EXP
  const norm = isExp
    ? (2 ** (span / 16) - 1) / (2 ** (72 / 16) - 1)
    : span / 72;
  const amount = depth * Math.min(1.6, norm);
  const sign = curve >= 2 ? +1 : -1; // 0,1 = -LIN,-EXP; 2,3 = +EXP,+LIN
  return Math.min(99, Math.max(0, ol + sign * amount));
}

/**
 * Keyboard rate scaling (spec section 2): EG rates rise with key
 * position so high notes decay faster, RS 0-7 setting the slope
 * (provisional: up to +7 rate units per octave above C1).
 */
export function scaledRates(voice, op, note) {
  const b = opBase(op);
  const rs = voice[b + OP.RS];
  const boost = rs * ((note - 24) / 12);
  const rates = [];
  for (let i = 0; i < 4; i++) {
    rates.push(Math.min(99, Math.max(0, voice[b + OP.EGR + i] + boost)));
  }
  return rates;
}

/** Operator frequency per spec 10.2; op is 1-6 human numbering. */
export function opFrequency(voice, op, note) {
  const base = opBase(op);
  const transpose = (voice[IDX_TRANSPOSE] ?? 24) - 24;
  const noteFreq = 440 * 2 ** ((note + transpose - 69) / 12);

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

class OperatorState {
  constructor(sampleRate) {
    this.phase = 0;
    this.phaseInc = 0; // base increment before pitch modulation
    this.amp = 0; // OL * velocity factor, linear
    this.ams = 0; // amp mod sensitivity 0-3
    this.out = 0; // last computed sample
    this.prevOut = 0; // sample before that (feedback averaging)
    this.eg = new EnvelopeGenerator(sampleRate);
  }
}

class Voice {
  constructor(sampleRate) {
    this.active = false;
    this.note = -1;
    this.velocity = 1;
    this.startTime = 0; // for oldest-first stealing
    this.age = 0; // seconds since key-on (LFO delay ramp)
    this.ops = Array.from({ length: NUM_OPS }, () => new OperatorState(sampleRate));
    this.pitchEg = new PitchEG(sampleRate);
  }

  gateOn() {
    for (const op of this.ops) op.eg.keyOn();
    this.pitchEg.keyOn();
    this.age = 0;
  }

  gateOff() {
    for (const op of this.ops) op.eg.keyOff();
    this.pitchEg.keyOff();
  }

  get gate() {
    return this.ops[0].eg.gate;
  }

  isSilent() {
    return this.ops.every((op) => op.eg.isSilent());
  }
}

/** INIT VOICE fallback so the processor is playable before the first sync. */
export function defaultVoice() {
  const v = new Array(155).fill(0);
  for (let op = 1; op <= 6; op++) {
    const b = opBase(op);
    for (let i = 0; i < 4; i++) v[b + OP.EGR + i] = 99;
    for (let i = 0; i < 3; i++) v[b + OP.EGL + i] = 99;
    v[b + OP.FC] = 1;
    v[b + OP.DET] = 7;
  }
  v[opBase(1) + OP.OL] = 99;
  for (let i = 0; i < 4; i++) {
    v[IDX_PEG_R + i] = 99;
    v[IDX_PEG_L + i] = 50;
  }
  v[IDX_OSC_SYNC] = 1;
  v[IDX_LFO_SPEED] = 35;
  v[IDX_LFO_SYNC] = 1;
  v[IDX_PMS] = 3;
  v[IDX_TRANSPOSE] = 24;
  return v;
}

class DX7Processor extends (globalThis.AudioWorkletProcessor ?? class {}) {
  constructor() {
    super();
    this.voices = Array.from({ length: NUM_VOICES }, () => new Voice(sampleRate));
    this.clock = 0;
    this.voiceData = defaultVoice();
    this.opOnOff = [true, true, true, true, true, true];
    this.lfo = new LFO(sampleRate);
    this.port.onmessage = (e) => this.handleMessage(e.data);
  }

  /** Refresh a voice's per-op EG params, frequencies, and amps. */
  configureVoice(v) {
    for (let op = 1; op <= NUM_OPS; op++) {
      const b = opBase(op);
      const state = v.ops[op - 1];
      state.eg.setParams(
        scaledRates(this.voiceData, op, v.note), // keyboard rate scaling
        this.voiceData.slice(b + OP.EGL, b + OP.EGL + 4)
      );
      state.phaseInc = (TWO_PI * opFrequency(this.voiceData, op, v.note)) / sampleRate;
      // Key velocity sensitivity 0-7 blends toward full velocity scaling
      // (provisional linear blend; exact curve pending references).
      const kvs = this.voiceData[b + OP.KVS] / 7;
      const velFactor = 1 - kvs + kvs * v.velocity;
      state.amp = dbToAmp(levelToDb(scaledOutputLevel(this.voiceData, op, v.note))) * velFactor;
      state.ams = this.voiceData[b + OP.AMS];
    }
    v.pitchEg.setParams(
      this.voiceData.slice(IDX_PEG_R, IDX_PEG_R + 4),
      this.voiceData.slice(IDX_PEG_L, IDX_PEG_L + 4)
    );
    this.lfo.setParams(this.voiceData[IDX_LFO_SPEED], this.voiceData[IDX_LFO_WAVE]);
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'noteOn': {
        const voice = this.allocate(msg.note);
        voice.active = true;
        voice.note = msg.note;
        voice.velocity = (msg.velocity ?? 100) / 127;
        voice.startTime = this.clock;
        for (const op of voice.ops) {
          // Oscillator key sync: phases reset on key-on unless disabled.
          if (this.voiceData[IDX_OSC_SYNC]) op.phase = 0;
          op.out = 0;
          op.prevOut = 0;
        }
        this.configureVoice(voice);
        if (this.voiceData[IDX_LFO_SYNC]) this.lfo.reset();
        voice.gateOn();
        break;
      }
      case 'noteOff':
        for (const v of this.voices) {
          if (v.active && v.gate && v.note === msg.note) v.gateOff();
        }
        break;
      case 'allOff':
        for (const v of this.voices) v.gateOff();
        break;
      case 'voice':
        this.voiceData = msg.data;
        if (msg.opOnOff) this.opOnOff = msg.opOnOff;
        for (const v of this.voices) if (v.active) this.configureVoice(v);
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
    const n = out.length;
    out.fill(0);

    const alg = algorithms[this.voiceData[IDX_ALGORITHM] ?? 0] ?? algorithms[0];
    const fbParam = this.voiceData[IDX_FEEDBACK] ?? 0;
    const fbScale = fbParam === 0 ? 0 : FEEDBACK_MAX * 2 ** (fbParam - 7);
    const fbTarget = alg.feedback;
    const fbSource = alg.feedbackSource ?? alg.feedback;

    // LFO runs once per block for all voices (single shared LFO, like
    // the original). Pitch/amp modulation is applied at block rate
    // (2.7 ms at 48 kHz) — inaudible as stepping, standard practice.
    const lfoVal = this.lfo.tickBlock(n);
    const pmd = this.voiceData[IDX_LFO_PMD] / 99;
    const amd = this.voiceData[IDX_LFO_AMD] / 99;
    // Pitch mod sensitivity 0-7 -> peak semitones (provisional curve,
    // exponential per step up to ~1 octave at 7).
    const pms = this.voiceData[IDX_PMS];
    const pmsSemis = pms === 0 ? 0 : (2 ** pms / 128) * 12;
    const delaySec = LFO.delayToSeconds(this.voiceData[IDX_LFO_DELAY]);
    const fadeSec = Math.max(0.05, delaySec * 0.5);

    for (const v of this.voices) {
      if (!v.active) continue;

      // LFO delay: silent until delaySec, then fades in (spec 10.6).
      const ramp = delaySec === 0 ? 1 : Math.min(1, Math.max(0, (v.age - delaySec) / fadeSec));
      v.age += n / sampleRate;

      const pitchSemis = v.pitchEg.tickBlock(n) + lfoVal * pmd * pmsSemis * ramp;
      const pitchFactor = 2 ** (pitchSemis / 12);
      // Amp modulation: unipolar attenuation, depth per op from AMS 0-3
      // (provisional: up to -24 dB at full sensitivity and depth).
      const lfoUni = (1 - lfoVal) / 2;
      const amAtten = lfoUni * amd * ramp * 24;

      for (let i = 0; i < n; i++) {
        // Operators run high to low: every modulator except the feedback
        // tap has a higher index than its target (spec 10.5).
        let sample = 0;
        for (let o = NUM_OPS - 1; o >= 0; o--) {
          const st = v.ops[o];
          const env = st.eg.tick();

          let mod = 0;
          const mods = alg.modulation[o];
          if (mods) {
            for (const m of mods) mod += v.ops[m].out;
            mod *= MOD_INDEX_MAX;
          }
          if (o === fbTarget && fbScale !== 0) {
            // Same deviation scale whether the loop is a self-loop or the
            // cross-op loops of algorithms 4/6 — the FB parameter governs
            // the path, not the tap point.
            const src = v.ops[fbSource];
            mod += ((src.out + src.prevOut) / 2) * fbScale;
          }

          st.prevOut = st.out;
          const am = st.ams === 0 ? 1 : dbToAmp(-amAtten * (st.ams / 3));
          st.out = this.opOnOff[o]
            ? Math.sin(st.phase + mod) * env * st.amp * am
            : 0;
          st.phase += st.phaseInc * pitchFactor;
          if (st.phase > TWO_PI) st.phase -= TWO_PI;
        }

        for (const c of alg.carriers) sample += v.ops[c].out;
        out[i] += sample * VOICE_AMP;
      }

      if (v.isSilent()) v.active = false;
    }

    this.clock += n;
    return true;
  }
}

if (typeof registerProcessor === 'function') {
  registerProcessor('dx7-processor', DX7Processor);
}
