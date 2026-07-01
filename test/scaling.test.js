/**
 * Keyboard level scaling and rate scaling tests (milestone 10): curve
 * directions, break point behavior, depth 0 neutrality, clamping, and
 * rate scaling slope.
 */

import { describe, it, expect } from 'vitest';
import { scaledOutputLevel, scaledRates } from '../src/engine/dx7-processor.js';
import { initVoice, paramIndex } from '../src/state/voiceParams.js';

const set = (v, id, val) => { v[paramIndex.get(id)] = val; };

describe('keyboard level scaling', () => {
  const voice = () => {
    const v = initVoice();
    set(v, 'op1_ol', 80);
    set(v, 'op1_bp', 39); // C3 = MIDI 60
    return v;
  };

  it('is neutral at the break point and with depth 0', () => {
    const v = voice();
    expect(scaledOutputLevel(v, 1, 60)).toBe(80);
    expect(scaledOutputLevel(v, 1, 36)).toBe(80); // depths default 0
    expect(scaledOutputLevel(v, 1, 96)).toBe(80);
  });

  it('-LIN attenuates away from the break point, more with distance', () => {
    const v = voice();
    set(v, 'op1_ld', 50); // left curve default 0 = -LIN
    const near = scaledOutputLevel(v, 1, 58);
    const far = scaledOutputLevel(v, 1, 36);
    expect(near).toBeLessThan(80);
    expect(far).toBeLessThan(near);
    expect(scaledOutputLevel(v, 1, 72)).toBe(80); // right side untouched
  });

  it('+LIN boosts, clamped to 99', () => {
    const v = voice();
    set(v, 'op1_rd', 99);
    set(v, 'op1_rc', 3); // +LIN
    const up = scaledOutputLevel(v, 1, 84);
    expect(up).toBeGreaterThan(80);
    expect(scaledOutputLevel(v, 1, 120)).toBe(99); // clamped
  });

  it('EXP grows slower than LIN near, faster far', () => {
    const v = voice();
    set(v, 'op1_ld', 99);
    const lin = scaledOutputLevel(v, 1, 48); // -LIN, 12 below
    set(v, 'op1_lc', 1); // -EXP
    const exp = scaledOutputLevel(v, 1, 48);
    expect(exp).toBeGreaterThan(lin); // EXP attenuates less at 1 octave
  });

  it('attenuation floors at level 0 across the full span', () => {
    const v = voice();
    set(v, 'op1_bp', 99); // break point C8
    set(v, 'op1_ld', 99);
    expect(scaledOutputLevel(v, 1, 21)).toBe(0); // 99 semitones below
  });
});

describe('keyboard rate scaling', () => {
  it('is neutral at RS 0 and raises rates with note position', () => {
    const v = initVoice();
    set(v, 'op1_egr3', 40);
    expect(scaledRates(v, 1, 96)[2]).toBe(40);
    set(v, 'op1_rs', 7);
    const low = scaledRates(v, 1, 36)[2];
    const high = scaledRates(v, 1, 96)[2];
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(99);
    // ~+7 per octave at RS 7 (provisional slope).
    expect(high - low).toBeCloseTo(7 * 5, 0);
  });
});
