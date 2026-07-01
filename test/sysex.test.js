/**
 * SysEx codec tests (spec 11 / 15.1): pack/unpack round trips, bulk dump
 * round trips with checksum, bit-field packing spot checks, and header
 * validation.
 */

import { describe, it, expect } from 'vitest';
import { packVoice, unpackVoice, parseBulkDump, emitBulkDump } from '../src/sysex/dx7-sysex.js';
import { voiceParamDefs, initVoice, voiceName } from '../src/state/voiceParams.js';

/** A deterministic pseudo-random in-range voice. */
function randomVoice(seed) {
  let s = seed;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  return voiceParamDefs.map((d) => {
    const [min, max] = d.range;
    return min + Math.floor(rnd() * (max - min + 1));
  });
}

describe('voice pack/unpack', () => {
  it('spec 15.1 round trip: unpack(pack(v)) === v for random voices', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const v = randomVoice(seed);
      expect(unpackVoice(packVoice(v))).toEqual(v);
    }
  });

  it('round-trips INIT VOICE including the name characters', () => {
    const v = initVoice();
    const back = unpackVoice(packVoice(v));
    expect(back).toEqual(v);
    expect(voiceName(back)).toBe('INIT VOICE');
  });

  it('packs the documented bit fields', () => {
    const v = initVoice();
    // OP6 is the first packed operator block (bytes 0-16).
    const b6 = 0; // op6 unpacked block also starts at 0
    v[b6 + 13] = 7; // rate scaling
    v[b6 + 20] = 14; // detune
    v[b6 + 17] = 1; // fixed mode
    v[b6 + 18] = 31; // coarse
    v[b6 + 11] = 3; // left curve
    v[b6 + 12] = 2; // right curve
    const p = packVoice(v);
    expect(p[12]).toBe(7 | (14 << 3)); // 0x77
    expect(p[15]).toBe(1 | (31 << 1)); // 0x3f
    expect(p[11]).toBe(3 | (2 << 2));

    // Common byte 116: lfoSync | wave<<1 | pms<<4.
    v[126 + 15] = 1;
    v[126 + 16] = 5;
    v[126 + 17] = 7;
    expect(packVoice(v)[116]).toBe(1 | (5 << 1) | (7 << 4));
  });
});

describe('bulk dump', () => {
  const bank = () => Array.from({ length: 32 }, (_, i) => randomVoice(i + 100));

  it('emit/parse round trip preserves all 32 voices and the channel', () => {
    const voices = bank();
    const dump = emitBulkDump(voices, 3);
    expect(dump.length).toBe(4104);
    expect(dump[0]).toBe(0xf0);
    expect(dump[dump.length - 1]).toBe(0xf7);
    const parsed = parseBulkDump(dump);
    expect(parsed.channel).toBe(3);
    expect(parsed.voices).toEqual(voices);
  });

  it('rejects bad length, bad header, and bad checksum', () => {
    const dump = emitBulkDump(bank());
    expect(() => parseBulkDump(dump.subarray(1))).toThrow(/bytes/);

    const badHeader = dump.slice();
    badHeader[3] = 0x0a;
    expect(() => parseBulkDump(badHeader)).toThrow(/header/);

    const badSum = dump.slice();
    badSum[100] = (badSum[100] + 1) & 0x7f;
    expect(() => parseBulkDump(badSum)).toThrow(/checksum/);
  });
});
