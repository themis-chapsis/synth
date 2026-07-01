/**
 * FM DSP core, running inside the AudioWorklet (spec section 10).
 *
 * Registered as 'dx7-processor'. A single processor instance owns all 16
 * voices; blocks are the worklet-standard 128 samples and the sample rate
 * is taken from the context (never hardcoded).
 *
 * This file must stay self-contained (no imports): it is loaded as a
 * worklet module via `new URL(..., import.meta.url)` and bundled verbatim.
 *
 * Milestone 4 scope: one sine operator per voice at the note frequency,
 * with a short linear anti-click ramp on gate changes. The ramp is a
 * placeholder the milestone 5 envelope generator replaces; the operator
 * pipeline, algorithms, LFO and pitch EG land in milestones 5-8.
 *
 * Message protocol (main thread -> processor):
 *   {type:'noteOn', note, velocity}   MIDI note number, velocity 1-127
 *   {type:'noteOff', note}
 *   {type:'allOff'}
 */

const NUM_VOICES = 16;
const TWO_PI = 2 * Math.PI;
// Anti-click gate ramp (seconds); envelope generators supersede this.
const RAMP_S = 0.004;
const VOICE_AMP = 0.16;

class Voice {
  constructor() {
    this.active = false;
    this.gate = false;
    this.note = -1;
    this.phase = 0;
    this.phaseInc = 0;
    this.amp = 0; // current anti-click ramp level 0..1
    this.velocity = 1;
    this.startTime = 0; // for oldest-first stealing
  }
}

class DX7Processor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.voices = Array.from({ length: NUM_VOICES }, () => new Voice());
    this.clock = 0; // running sample counter
    this.port.onmessage = (e) => this.handleMessage(e.data);
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'noteOn': {
        const voice = this.allocate(msg.note);
        voice.active = true;
        voice.gate = true;
        voice.note = msg.note;
        voice.phase = 0;
        voice.phaseInc = (TWO_PI * 440 * 2 ** ((msg.note - 69) / 12)) / sampleRate;
        voice.velocity = (msg.velocity ?? 100) / 127;
        voice.startTime = this.clock;
        break;
      }
      case 'noteOff':
        for (const v of this.voices) {
          if (v.active && v.gate && v.note === msg.note) v.gate = false;
        }
        break;
      case 'allOff':
        for (const v of this.voices) v.gate = false;
        break;
    }
  }

  /** Free voice if available, else steal the oldest (spec 10.7). */
  allocate(note) {
    // Retrigger a still-sounding instance of the same note first.
    let candidate = this.voices.find((v) => v.active && v.note === note);
    if (candidate) return candidate;
    candidate = this.voices.find((v) => !v.active);
    if (candidate) return candidate;
    return this.voices.reduce((a, b) => (a.startTime <= b.startTime ? a : b));
  }

  process(_inputs, outputs) {
    const out = outputs[0][0];
    out.fill(0);
    const rampStep = 1 / (RAMP_S * sampleRate);

    for (const v of this.voices) {
      if (!v.active) continue;
      for (let i = 0; i < out.length; i++) {
        v.amp += v.gate ? rampStep : -rampStep;
        if (v.amp > 1) v.amp = 1;
        if (v.amp < 0) v.amp = 0;
        out[i] += Math.sin(v.phase) * v.amp * v.velocity * VOICE_AMP;
        v.phase += v.phaseInc;
        if (v.phase > TWO_PI) v.phase -= TWO_PI;
      }
      if (!v.gate && v.amp === 0) v.active = false;
    }

    this.clock += out.length;
    return true;
  }
}

registerProcessor('dx7-processor', DX7Processor);
