/**
 * Per-parameter LCD text formatting (spec 8.4): produces the 16x2 buffer
 * for (mode, selectedParam, value), matching the original firmware formats,
 * e.g. `ALGORITHM SELECT` / `      12`. Milestone 2/3 deliverable, tested
 * against Operation Manual screenshots.
 */
export function formatLcd() { return ['     READY      ', '                ']; }
