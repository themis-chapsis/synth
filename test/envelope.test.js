/**
 * Envelope generator tests (spec 10.3 / 15.1): stage progression through
 * L1 -> L2 -> L3 sustain -> release to L4, monotonicity per segment, and
 * silence detection. Timing tolerances stay loose while the rate/level
 * constants are the documented provisional curves; they tighten to the
 * spec's 0.1% once the EG ROM tables can be transcribed (blocked source,
 * see /reference/README.md).
 */

import { describe, it, expect } from 'vitest';
import { EnvelopeGenerator, levelToDb, dbToAmp, outputLevelToDb, opFrequency } from '../src/engine/dx7-processor.js';

const SR = 48000;

function runFor(eg, seconds) {
  let amp = 0;
  const n = Math.round(seconds * SR);
  for (let i = 0; i < n; i++) amp = eg.tick();
  return amp;
}

describe('level mapping (measured hardware curves)', () => {
  it('EG levels: 0 dB at 99, quantized ~1.5 dB per actual-level unit', () => {
    expect(levelToDb(99)).toBe(0);
    // Level 89 -> actual level 58, 5 units below full = 5 * 64 steps.
    expect(levelToDb(89)).toBeCloseTo(-7.526, 2);
    expect(dbToAmp(levelToDb(0))).toBe(0);
    expect(dbToAmp(0)).toBe(1);
  });

  it('output levels: 0.7526 dB units with the low-end lookup', () => {
    expect(outputLevelToDb(99)).toBe(0);
    expect(outputLevelToDb(89)).toBeCloseTo(-10 * 0.7526, 2);
    // Lookup region: level 10 maps to 31 on the 0-127 scale.
    expect(outputLevelToDb(10)).toBeCloseTo((31 - 127) * 0.7526, 1);
    expect(dbToAmp(outputLevelToDb(0))).toBe(0);
  });
});

describe('stage progression', () => {
  it('attacks to L1, decays through L2 to the L3 sustain, holds', () => {
    const eg = new EnvelopeGenerator(SR);
    eg.setParams([99, 70, 70, 80], [99, 80, 60, 0]);
    eg.keyOn();

    let peak = 0;
    for (let i = 0; i < 0.05 * SR; i++) peak = Math.max(peak, eg.tick());
    expect(peak).toBeGreaterThan(0.9); // reached L1=99 (0 dB) before decaying

    runFor(eg, 8);
    const sustainDb = 20 * Math.log10(runFor(eg, 0.1));
    expect(sustainDb).toBeCloseTo(levelToDb(60), 0); // resting at L3

    const held = runFor(eg, 0.5);
    expect(20 * Math.log10(held)).toBeCloseTo(levelToDb(60), 1); // still there
    expect(eg.stage).toBe(2);
  });

  it('releases toward L4 after key-off and reports silence', () => {
    const eg = new EnvelopeGenerator(SR);
    eg.setParams([99, 99, 99, 80], [99, 99, 99, 0]);
    eg.keyOn();
    runFor(eg, 0.1);
    eg.keyOff();
    expect(eg.isSilent()).toBe(false);
    runFor(eg, 5);
    expect(eg.isSilent()).toBe(true);
    expect(runFor(eg, 0.01)).toBe(0);
  });

  it('decays monotonically during release', () => {
    const eg = new EnvelopeGenerator(SR);
    eg.setParams([99, 50, 50, 60], [99, 90, 80, 0]);
    eg.keyOn();
    runFor(eg, 0.05);
    eg.keyOff();
    let prev = Infinity;
    for (let s = 0; s < 20; s++) {
      const amp = runFor(eg, 0.05);
      expect(amp).toBeLessThanOrEqual(prev + 1e-9);
      prev = amp;
    }
  });

  it('higher rates finish faster', () => {
    const timeToSilence = (rate) => {
      const eg = new EnvelopeGenerator(SR);
      eg.setParams([99, 99, 99, rate], [99, 99, 99, 0]);
      eg.keyOn();
      runFor(eg, 0.05);
      eg.keyOff();
      let t = 0;
      while (!eg.isSilent() && t < 60) {
        runFor(eg, 0.05);
        t += 0.05;
      }
      return t;
    };
    expect(timeToSilence(90)).toBeLessThan(timeToSilence(50));
  });
});

describe('OP1 frequency computation (spec 10.2)', () => {
  const voice = () => {
    const v = new Array(155).fill(0);
    const b = 5 * 21; // op1 block
    v[b + 18] = 1; // coarse 1
    v[b + 20] = 7; // detune center
    v[126 + 18] = 24; // transpose C3
    return { v, b };
  };

  it('ratio mode: coarse 1 at middle C is ~261.6 Hz, coarse 0 halves', () => {
    const { v, b } = voice();
    expect(opFrequency(v, 1, 60)).toBeCloseTo(261.63, 1);
    v[b + 18] = 0;
    expect(opFrequency(v, 1, 60)).toBeCloseTo(130.81, 1);
  });

  it('fine raises the ratio, transpose shifts semitones', () => {
    const { v, b } = voice();
    v[b + 19] = 50; // fine +50%
    expect(opFrequency(v, 1, 60)).toBeCloseTo(261.63 * 1.5, 0);
    v[b + 19] = 0;
    v[126 + 18] = 36; // +1 octave
    expect(opFrequency(v, 1, 60)).toBeCloseTo(523.25, 1);
  });

  it('fixed mode ignores the note: decades from coarse, x10 from fine', () => {
    const { v, b } = voice();
    v[b + 17] = 1; // fixed
    v[b + 18] = 2; // 100 Hz decade
    expect(opFrequency(v, 1, 60)).toBeCloseTo(100, 5);
    expect(opFrequency(v, 1, 72)).toBeCloseTo(100, 5);
    v[b + 19] = 99;
    expect(opFrequency(v, 1, 60)).toBeCloseTo(100 * 10 ** 0.99, 1);
  });
});
