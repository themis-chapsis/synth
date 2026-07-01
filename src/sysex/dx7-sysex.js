/**
 * Voice bulk-dump SysEx codec (spec section 11).
 *
 * Format (per the published MIDI data format):
 *   F0 43 0n 09 20 00            header (n = device/channel)
 *   4096 bytes                   32 voices x 128 packed bytes
 *   checksum                     two's complement of the data sum, 7-bit
 *   F7
 *
 * A packed voice is 17 bytes per operator (OP6 first) with the bit-packed
 * fields below, then 26 common bytes. Unpacking expands to the 155-value
 * buffer in the exact order of src/state/voiceParams.js.
 *
 * Packed per-op layout:        Packed common layout:
 *   0-3  EG rates                102-105 pitch EG rates
 *   4-7  EG levels               106-109 pitch EG levels
 *   8    break point             110     algorithm (5 bits)
 *   9    left depth              111     feedback | oscSync<<3
 *   10   right depth             112-115 LFO speed/delay/PMD/AMD
 *   11   leftCurve | rightCurve<<2
 *   12   rateScaling | detune<<3 116     lfoSync | wave<<1 | pms<<4
 *   13   ampModSens | kvs<<2     117     transpose
 *   14   output level            118-127 voice name (ASCII)
 *   15   oscMode | coarse<<1
 *   16   frequency fine
 */

const VOICE_PACKED = 128;
const VOICE_UNPACKED = 155;
const BANK_VOICES = 32;
const DATA_BYTES = VOICE_PACKED * BANK_VOICES; // 4096
const DUMP_BYTES = 6 + DATA_BYTES + 2; // header + data + checksum + F7

/** @param {Uint8Array|number[]} packed 128 bytes @returns {number[]} 155 values */
export function unpackVoice(packed) {
  const out = [];
  for (let op = 0; op < 6; op++) {
    const b = op * 17;
    for (let i = 0; i < 8; i++) out.push(packed[b + i] & 0x7f); // EG R1-4 L1-4
    out.push(packed[b + 8] & 0x7f); // BP
    out.push(packed[b + 9] & 0x7f); // LD
    out.push(packed[b + 10] & 0x7f); // RD
    out.push(packed[b + 11] & 0x03); // LC
    out.push((packed[b + 11] >> 2) & 0x03); // RC
    out.push(packed[b + 12] & 0x07); // RS
    out.push(packed[b + 13] & 0x03); // AMS
    out.push((packed[b + 13] >> 2) & 0x07); // KVS
    out.push(packed[b + 14] & 0x7f); // OL
    out.push(packed[b + 15] & 0x01); // MODE
    out.push((packed[b + 15] >> 1) & 0x1f); // FC
    out.push(packed[b + 16] & 0x7f); // FF
    out.push((packed[b + 12] >> 3) & 0x0f); // DET
  }
  for (let i = 102; i < 110; i++) out.push(packed[i] & 0x7f); // pitch EG
  out.push(packed[110] & 0x1f); // ALG
  out.push(packed[111] & 0x07); // FB
  out.push((packed[111] >> 3) & 0x01); // OKS
  out.push(packed[112] & 0x7f); // LFO SPD
  out.push(packed[113] & 0x7f); // LFO DEL
  out.push(packed[114] & 0x7f); // LFO PMD
  out.push(packed[115] & 0x7f); // LFO AMD
  out.push(packed[116] & 0x01); // LFO SYNC
  out.push((packed[116] >> 1) & 0x07); // WAVE
  out.push((packed[116] >> 4) & 0x07); // PMS
  out.push(packed[117] & 0x7f); // TRANSPOSE
  for (let i = 118; i < 128; i++) out.push(packed[i] & 0x7f); // NAME
  return out;
}

/** @param {number[]} v 155 values @returns {Uint8Array} 128 packed bytes */
export function packVoice(v) {
  const out = new Uint8Array(VOICE_PACKED);
  for (let op = 0; op < 6; op++) {
    const b = op * 17;
    const u = op * 21;
    for (let i = 0; i < 8; i++) out[b + i] = v[u + i] & 0x7f;
    out[b + 8] = v[u + 8] & 0x7f;
    out[b + 9] = v[u + 9] & 0x7f;
    out[b + 10] = v[u + 10] & 0x7f;
    out[b + 11] = (v[u + 11] & 0x03) | ((v[u + 12] & 0x03) << 2);
    out[b + 12] = (v[u + 13] & 0x07) | ((v[u + 20] & 0x0f) << 3);
    out[b + 13] = (v[u + 14] & 0x03) | ((v[u + 15] & 0x07) << 2);
    out[b + 14] = v[u + 16] & 0x7f;
    out[b + 15] = (v[u + 17] & 0x01) | ((v[u + 18] & 0x1f) << 1);
    out[b + 16] = v[u + 19] & 0x7f;
  }
  const c = 126; // start of common block in the unpacked buffer
  for (let i = 0; i < 8; i++) out[102 + i] = v[c + i] & 0x7f;
  out[110] = v[c + 8] & 0x1f;
  out[111] = (v[c + 9] & 0x07) | ((v[c + 10] & 0x01) << 3);
  out[112] = v[c + 11] & 0x7f;
  out[113] = v[c + 12] & 0x7f;
  out[114] = v[c + 13] & 0x7f;
  out[115] = v[c + 14] & 0x7f;
  out[116] = (v[c + 15] & 0x01) | ((v[c + 16] & 0x07) << 1) | ((v[c + 17] & 0x07) << 4);
  out[117] = v[c + 18] & 0x7f;
  for (let i = 0; i < 10; i++) out[118 + i] = v[c + 19 + i] & 0x7f;
  return out;
}

/** Two's-complement 7-bit checksum over the 4096 data bytes. */
function checksum(data) {
  let sum = 0;
  for (const b of data) sum += b;
  return (128 - (sum & 0x7f)) & 0x7f;
}

/**
 * Parse a 32-voice bulk dump.
 * @param {Uint8Array} bytes
 * @returns {{voices: number[][], channel: number}}
 */
export function parseBulkDump(bytes) {
  if (bytes.length !== DUMP_BYTES) {
    throw new Error(`bulk dump must be ${DUMP_BYTES} bytes, got ${bytes.length}`);
  }
  if (bytes[0] !== 0xf0 || bytes[1] !== 0x43 || (bytes[2] & 0xf0) !== 0x00 ||
      bytes[3] !== 0x09 || bytes[4] !== 0x20 || bytes[5] !== 0x00) {
    throw new Error('not a 32-voice bulk dump (bad header)');
  }
  if (bytes[DUMP_BYTES - 1] !== 0xf7) throw new Error('missing F7 terminator');

  const data = bytes.subarray(6, 6 + DATA_BYTES);
  const expect = checksum(data);
  const got = bytes[6 + DATA_BYTES];
  if (expect !== got) {
    throw new Error(`checksum mismatch: expected 0x${expect.toString(16)}, got 0x${got.toString(16)}`);
  }

  const voices = [];
  for (let i = 0; i < BANK_VOICES; i++) {
    voices.push(unpackVoice(data.subarray(i * VOICE_PACKED, (i + 1) * VOICE_PACKED)));
  }
  return { voices, channel: bytes[2] & 0x0f };
}

/**
 * Emit a 32-voice bulk dump.
 * @param {number[][]} voices 32 unpacked voices
 * @param {number} channel 0-15
 * @returns {Uint8Array}
 */
export function emitBulkDump(voices, channel = 0) {
  if (voices.length !== BANK_VOICES) throw new Error('bulk dump needs exactly 32 voices');
  const out = new Uint8Array(DUMP_BYTES);
  out.set([0xf0, 0x43, channel & 0x0f, 0x09, 0x20, 0x00]);
  for (let i = 0; i < BANK_VOICES; i++) {
    out.set(packVoice(voices[i]), 6 + i * VOICE_PACKED);
  }
  out[6 + DATA_BYTES] = checksum(out.subarray(6, 6 + DATA_BYTES));
  out[DUMP_BYTES - 1] = 0xf7;
  return out;
}
