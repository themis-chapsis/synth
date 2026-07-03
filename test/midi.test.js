/**
 * Web MIDI parsing/routing tests. The transport (navigator.requestMIDIAccess)
 * is browser-only and covered by the headless smoke test; here we verify the
 * pure message handling that turns bytes into note/bend/mod actions.
 */

import { describe, it, expect, vi } from 'vitest';
import { parseMidiMessage, routeMidiMessage } from '../src/engine/midi.js';

describe('parseMidiMessage', () => {
  it('note on with velocity, and velocity-0 as note off', () => {
    expect(parseMidiMessage([0x90, 60, 100])).toEqual({ type: 'noteOn', note: 60, velocity: 100 });
    expect(parseMidiMessage([0x90, 60, 0])).toEqual({ type: 'noteOff', note: 60 });
    expect(parseMidiMessage([0x80, 60, 40])).toEqual({ type: 'noteOff', note: 60 });
  });

  it('ignores channel (low nibble)', () => {
    expect(parseMidiMessage([0x95, 64, 90])).toEqual({ type: 'noteOn', note: 64, velocity: 90 });
    expect(parseMidiMessage([0x8f, 64, 0])).toEqual({ type: 'noteOff', note: 64 });
  });

  it('pitch bend maps 14-bit to -1..1 with centre 0', () => {
    expect(parseMidiMessage([0xe0, 0, 64]).value).toBeCloseTo(0, 5); // 8192 = centre
    expect(parseMidiMessage([0xe0, 0, 0]).value).toBeCloseTo(-1, 5); // min
    expect(parseMidiMessage([0xe0, 127, 127]).value).toBeCloseTo(1, 2); // max
  });

  it('control change is passed through with controller + value', () => {
    expect(parseMidiMessage([0xb0, 1, 100])).toEqual({ type: 'cc', controller: 1, value: 100 });
  });

  it('returns null for unhandled status bytes', () => {
    expect(parseMidiMessage([0xf8])).toBeNull(); // clock
    expect(parseMidiMessage([0xd0, 80])).toBeNull(); // channel aftertouch
  });
});

describe('routeMidiMessage', () => {
  const handlers = () => ({
    noteOn: vi.fn(), noteOff: vi.fn(), pitchBend: vi.fn(), modWheel: vi.fn(), allOff: vi.fn()
  });

  it('routes notes, pitch bend, and the mod wheel (CC1 -> 0..1)', () => {
    const h = handlers();
    routeMidiMessage([0x90, 60, 100], h);
    routeMidiMessage([0x80, 60, 0], h);
    routeMidiMessage([0xe0, 0, 96], h); // +half up
    routeMidiMessage([0xb0, 1, 127], h); // mod wheel full
    expect(h.noteOn).toHaveBeenCalledWith(60, 100);
    expect(h.noteOff).toHaveBeenCalledWith(60);
    expect(h.pitchBend).toHaveBeenCalledWith(expect.closeTo(0.5, 1));
    expect(h.modWheel).toHaveBeenCalledWith(1);
  });

  it('CC 120/123 trigger all-off; other CCs are ignored', () => {
    const h = handlers();
    routeMidiMessage([0xb0, 123, 0], h);
    routeMidiMessage([0xb0, 7, 100], h); // volume CC: ignored
    expect(h.allOff).toHaveBeenCalledTimes(1);
    expect(h.modWheel).not.toHaveBeenCalled();
  });
});
