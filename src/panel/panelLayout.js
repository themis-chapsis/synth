/**
 * Panel geometry and silkscreen data — the single source of truth for the
 * visual layout. All coordinates are in the fixed 1920x200 viewBox space
 * (spec section 4.2); nothing here is a CSS pixel.
 *
 * Legend text was cross-checked against the original Operation Manual's
 * EDIT/FUNCTION mode chapters (via secondary sources; see /reference).
 * Items still awaiting verification against a reference photograph are
 * marked PROVISIONAL.
 */

export const VIEW = { w: 1920, h: 200 };

/* ------------------------------------------------------------------ *
 * Sliders                                                             *
 * ------------------------------------------------------------------ */

export const sliders = [
  // Spec 5.2/5.3: VOLUME is audio-only, DATA ENTRY drives the selected
  // parameter. Identical visual style.
  { id: 'volume', label: 'VOLUME', x: 46, trackTop: 68, trackBottom: 158, initial: 0.8 },
  { id: 'data-entry', label: 'DATA ENTRY', x: 116, trackTop: 68, trackBottom: 158, initial: 0.5 }
];

/* ------------------------------------------------------------------ *
 * Mode / utility membrane buttons                                     *
 * ------------------------------------------------------------------ */

const MODE_BTN = { w: 46, h: 24 };
const ROW_TOP = 66;
const ROW_BOT = 126;
const COL = [252, 320, 388, 456, 524];

export const modeButtons = [
  // PROVISIONAL: NO/YES placement (right of DATA ENTRY, side by side).
  // The `char` field is the voice-name character printed in the button
  // corner (manual: "reversed dark brown type"); NO/YES double as the
  // name cursor keys < and >.
  { id: 'no', x: 158, y: ROW_BOT, w: 38, h: MODE_BTN.h, color: 'cream', label: 'NO (-1)', char: '<', autoRepeat: true },
  { id: 'yes', x: 202, y: ROW_BOT, w: 38, h: MODE_BTN.h, color: 'cream', label: 'YES (+1)', char: '>', autoRepeat: true },

  { id: 'store', x: COL[0], y: ROW_TOP, ...MODE_BTN, color: 'orange', label: 'STORE', char: 'W' },
  { id: 'mem-protect-int', x: COL[1], y: ROW_TOP, ...MODE_BTN, color: 'cream', label: 'INTERNAL', char: 'X' },
  { id: 'mem-protect-crt', x: COL[2], y: ROW_TOP, ...MODE_BTN, color: 'cream', label: 'CARTRIDGE', char: 'Y' },

  { id: 'operator-select', x: COL[0], y: ROW_BOT, ...MODE_BTN, color: 'blueLight', label: 'OPERATOR\nSELECT', char: 'Z' },
  { id: 'edit-compare', x: COL[1], y: ROW_BOT, ...MODE_BTN, color: 'blueLight', label: 'EDIT/\nCOMPARE\nCHARACTER' },
  { id: 'mem-select-int', x: COL[2], y: ROW_BOT, ...MODE_BTN, color: 'cyan', label: 'INTERNAL', char: '-' },
  { id: 'mem-select-crt', x: COL[3], y: ROW_BOT, ...MODE_BTN, color: 'cyan', label: 'CARTRIDGE', char: '.' },
  { id: 'function', x: COL[4], y: ROW_BOT, ...MODE_BTN, color: 'yellow', label: 'FUNCTION', char: 'SP' }
];

/** Voice-name character for a numbered button (1-10 digits, 11-32 A-V). */
export function buttonChar(n) {
  if (n <= 9) return String(n);
  if (n === 10) return '0';
  return String.fromCharCode(65 + n - 11);
}

/** Green bracket groupings over the mode cluster. */
export const modeBrackets = [
  { label: 'MEMORY PROTECT', x1: COL[1], x2: COL[2] + MODE_BTN.w, y: 48 },
  { label: 'MEMORY SELECT', x1: COL[2], x2: COL[3] + MODE_BTN.w, y: 108 }
];

/* ------------------------------------------------------------------ *
 * Display block (LCD + 7-segment LED)                                 *
 * ------------------------------------------------------------------ */

export const display = {
  bezel: { x: 590, y: 52, w: 412, h: 116 },
  // LCD canvas natural size is computed by the LCD component; this is the
  // mount rectangle in viewBox units.
  lcd: { x: 606, y: 78, w: 297, h: 63 },
  led: { x: 916, y: 80, w: 74, h: 58 }
};

/* ------------------------------------------------------------------ *
 * The 32 numbered membrane buttons                                    *
 * ------------------------------------------------------------------ */

const MATRIX = {
  x0: 1022, // left edge of button 1 / 17
  pitch: 55,
  btnW: 42,
  btnH: 26,
  rowY: [36, 122] // top edge of button rows 1-16 and 17-32
};

export const matrix = MATRIX;

/** Positions for buttons 1..32 (1-based externally, arrays 0-based). */
export const numberedButtons = Array.from({ length: 32 }, (_, i) => {
  const row = i < 16 ? 0 : 1;
  const col = i % 16;
  return {
    id: `btn-${String(i + 1).padStart(2, '0')}`,
    number: i + 1,
    char: buttonChar(i + 1),
    x: MATRIX.x0 + col * MATRIX.pitch,
    y: MATRIX.rowY[row],
    w: MATRIX.btnW,
    h: MATRIX.btnH,
    color: 'cyan'
  };
});

/**
 * Green (EDIT mode) legends printed above each button. '\n' = line break.
 * Buttons 1-6 carry no individual legend — the OPERATOR ON-OFF / EG COPY
 * bracket spans them.
 */
export const editLegends = [
  '', '', '', '', '', '',
  'ALGORITHM', 'FEEDBACK',
  'WAVE', 'SPEED', 'DELAY', 'PMD', 'AMD', 'SYNC',
  'PITCH', 'AMPLITUDE',
  'MODE/\nSYNC', 'FREQUENCY\nCOARSE', 'FREQUENCY\nFINE', 'DETUNE',
  'RATE', 'LEVEL',
  'BREAK\nPOINT', 'CURVE', 'DEPTH',
  'KEYBOARD\nRATE SCALING', 'OPERATOR\nOUTPUT LEVEL', 'KEY VELOCITY\nSENSITIVITY',
  'RATE', 'LEVEL',
  'KEY\nTRANSPOSE', 'VOICE\nNAME'
];

/** Green bracket groups above the buttons (1-based, inclusive). */
export const editBrackets = [
  { from: 1, to: 6, label: 'OPERATOR ON-OFF · EG COPY' },
  { from: 9, to: 14, label: 'LFO' },
  { from: 15, to: 16, label: 'MOD SENSITIVITY' },
  { from: 17, to: 20, label: 'OSCILLATOR' },
  { from: 21, to: 22, label: 'EG' },
  { from: 23, to: 25, label: 'KEYBOARD LEVEL SCALING' },
  { from: 29, to: 30, label: 'PITCH EG' }
];

/**
 * Orange (FUNCTION mode) legends printed below each button.
 * PROVISIONAL: functions 12 and 13 appear to be unassigned on the original
 * panel; silkscreen left blank pending manual verification.
 */
export const functionLegends = [
  'MASTER\nTUNE ADJ', 'POLY/MONO',
  'RANGE', 'STEP',
  'MODE', 'GLISSANDO', 'TIME',
  'MIDI',
  'EDIT\nRECALL', 'VOICE\nINIT', 'CART\nFORM', '', '', 'BATTERY\nCHECK', 'SAVE', 'LOAD',
  'RANGE', 'PITCH', 'AMPLITUDE', 'EG BIAS',
  'RANGE', 'PITCH', 'AMPLITUDE', 'EG BIAS',
  'RANGE', 'PITCH', 'AMPLITUDE', 'EG BIAS',
  'RANGE', 'PITCH', 'AMPLITUDE', 'EG BIAS'
];

/** Orange bracket groups below the buttons (1-based, inclusive). */
export const functionBrackets = [
  { from: 3, to: 4, label: 'PITCH BEND' },
  { from: 5, to: 7, label: 'PORTAMENTO' },
  { from: 15, to: 16, label: 'CARTRIDGE' },
  { from: 17, to: 20, label: 'MODULATION WHEEL' },
  { from: 21, to: 24, label: 'FOOT CONTROL' },
  { from: 25, to: 28, label: 'BREATH CONTROL' },
  { from: 29, to: 32, label: 'AFTER TOUCH' }
];

/** Center x of a numbered button (1-based). */
export function buttonCenterX(n) {
  return MATRIX.x0 + ((n - 1) % 16) * MATRIX.pitch + MATRIX.btnW / 2;
}
