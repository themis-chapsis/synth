/**
 * 7-segment glyph definitions.
 *
 * Bit order: a b c d e f g (bit 6 = segment a ... bit 0 = segment g).
 *
 *     aaa
 *    f   b
 *     ggg
 *    e   c
 *     ddd
 */

export const SEG = Object.freeze({
  ' ': 0b0000000,
  '0': 0b1111110,
  '1': 0b0110000,
  '2': 0b1101101,
  '3': 0b1111001,
  '4': 0b0110011,
  '5': 0b1011011,
  '6': 0b1011111,
  '7': 0b1110000,
  '8': 0b1111111,
  '9': 0b1111011,
  '-': 0b0000001,
  // Letters used by the original firmware's LED: E(dit) and C(ompare).
  'E': 0b1001111,
  'C': 0b1001110
});

/** @param {string} ch @returns {number} segment bitmask (blank if unknown) */
export function glyphFor(ch) {
  return SEG[ch] ?? 0;
}
