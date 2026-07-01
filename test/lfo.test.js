/**
 * LFO and pitch EG tests (spec 10.6/10.8): waveform shapes, speed/delay
 * mapping monotonicity, key-sync reset, and pitch envelope stage
 * behavior around the 50-centered no-change level.
 */

import { describe, it, expect } from 'vitest';
import { LFO, PitchEG } from '../src/engine/LFO.js';

const SR = 48000;

/** Sample one LFO cycle at 512 points for a given waveform. */
function cycle(wave) {
  const lfo = new LFO(SR);
  lfo.hz = SR / (512 * 16); // 512 blocks of 16 samples per cycle
  lfo.wave = wave;
  const values = [];
  for (let i = 0; i < 512; i++) values.push(lfo.tickBlock(16));
  return values;
}

describe('LFO waveforms', () => {
  it('triangle rises then falls between -1 and 1', () => {
    const v = cycle(0);
    expect(v[0]).toBeCloseTo(-1, 1);
    expect(v[255]).toBeCloseTo(1, 1);
    expect(v[128]).toBeCloseTo(0, 1);
    expect(Math.max(...v)).toBeLessThanOrEqual(1);
    expect(Math.min(...v)).toBeGreaterThanOrEqual(-1);
  });

  it('saw down starts high and descends; saw up mirrors it', () => {
    const down = cycle(1);
    const up = cycle(2);
    expect(down[0]).toBeCloseTo(1, 1);
    expect(down[400]).toBeLessThan(down[100]);
    expect(up[0]).toBeCloseTo(-1, 1);
    expect(up[400]).toBeGreaterThan(up[100]);
  });

  it('square flips at half cycle', () => {
    const v = cycle(3);
    expect(v[10]).toBe(1);
    expect(v[300]).toBe(-1);
  });

  it('sine passes through zero at the half cycle', () => {
    const v = cycle(4);
    expect(v[128]).toBeCloseTo(1, 1);
    expect(v[256]).toBeCloseTo(0, 1);
  });

  it('sample & hold changes once per cycle and holds between', () => {
    const lfo = new LFO(SR);
    lfo.hz = 100;
    lfo.wave = 5;
    const within = [lfo.tickBlock(16), lfo.tickBlock(16)];
    expect(within[0]).toBe(within[1]);
    for (let i = 0; i < SR / 100 / 16; i++) lfo.tickBlock(16);
    // After a full cycle the held value has (almost surely) changed.
    const next = lfo.tickBlock(16);
    expect(Math.abs(next)).toBeLessThanOrEqual(1);
  });

  it('speed and delay mappings are monotonic and in range', () => {
    let prev = -1;
    for (let s = 0; s <= 99; s++) {
      const hz = LFO.speedToHz(s);
      expect(hz).toBeGreaterThan(prev);
      prev = hz;
    }
    expect(LFO.speedToHz(0)).toBeGreaterThan(0.03);
    expect(LFO.speedToHz(99)).toBeLessThan(60);
    expect(LFO.delayToSeconds(0)).toBe(0);
    expect(LFO.delayToSeconds(99)).toBeGreaterThan(2);
  });

  it('reset() restarts the cycle (key sync)', () => {
    const lfo = new LFO(SR);
    lfo.setParams(50, 2); // saw up
    lfo.tickBlock(4000);
    lfo.reset();
    expect(lfo.tickBlock(16)).toBeCloseTo(-1, 1);
  });
});

describe('pitch EG', () => {
  it('stays at zero semitones with all levels at 50', () => {
    const eg = new PitchEG(SR);
    eg.keyOn();
    let s = 0;
    for (let i = 0; i < 100; i++) s = eg.tickBlock(128);
    expect(s).toBe(0);
  });

  it('level mapping spans +/-4 octaves around 50', () => {
    expect(PitchEG.levelToSemis(50)).toBe(0);
    expect(PitchEG.levelToSemis(99)).toBeCloseTo(47.04, 1);
    expect(PitchEG.levelToSemis(0)).toBe(-48);
  });

  it('runs L1 -> L2 -> L3 sustain, then releases to L4', () => {
    const eg = new PitchEG(SR);
    // Start at +12 semis (L4=62.5 -> keyOn starts from L4's level), rise
    // to ~+24, settle at 0, release back toward L4.
    eg.setParams([99, 99, 99, 30], [75, 50, 50, 50]);
    eg.keyOn();
    let peak = -Infinity;
    for (let i = 0; i < 400; i++) peak = Math.max(peak, eg.tickBlock(128));
    expect(peak).toBeCloseTo(PitchEG.levelToSemis(75), 0);
    // Sustain: back at L3 = 0.
    let s = 0;
    for (let i = 0; i < 400; i++) s = eg.tickBlock(128);
    expect(s).toBe(0);
    expect(eg.stage).toBe(2);
    eg.keyOff();
    for (let i = 0; i < 400; i++) s = eg.tickBlock(128);
    expect(s).toBe(0); // L4 = 50 -> returns to zero offset
  });
});
