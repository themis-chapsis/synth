/**
 * The 155-parameter voice model (spec section 7), in the unpacked bulk-dump
 * byte order of the published SysEx spec: operators OP6 down to OP1
 * (21 bytes each), pitch EG, algorithm/feedback/osc sync, LFO block, pitch
 * mod sensitivity, transpose, then the 10 voice-name characters.
 *
 * Per-operator defs are generated from a 21-entry template rather than
 * written out 126 times; the resulting array is exactly the 155 byte slots
 * in dump order, so the milestone 9 SysEx codec can index it directly.
 *
 * Display strings follow the original firmware's value readouts
 * (note names, curve names, signed detune, ...). INIT VOICE defaults are
 * best-effort pending the blocked reference docs (see /reference).
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Break point display: 0 = A-1 ... 99 = C8. */
function breakPointName(v) {
  const idx = v + 9;
  return `${NOTE_NAMES[idx % 12]}${Math.floor(idx / 12) - 1}`;
}

/** Transpose display: 0 = C1 ... 24 = C3 (middle) ... 48 = C5. */
function transposeName(v) {
  return `${NOTE_NAMES[v % 12]}${Math.floor(v / 12) + 1}`;
}

const CURVES = ['-LIN', '-EXP', '+EXP', '+LIN'];
const WAVES = ['TRIANGLE', 'SAW DWN', 'SAW UP', 'SQUARE', 'SINE', 'S/HOLD'];

const num = (v) => String(v);
const onOff = (v) => (v ? 'ON' : 'OFF');
const signed = (offset) => (v) => {
  const s = v - offset;
  return s > 0 ? `+${s}` : String(s);
};

/**
 * The 21 per-operator parameters, in dump order. `key` is the id suffix;
 * ids are `op{n}_{key}` with n = 1..6 (human numbering).
 */
const OP_TEMPLATE = [
  { key: 'egr1', name: 'EG RATE 1', range: [0, 99], default: 99, display: num },
  { key: 'egr2', name: 'EG RATE 2', range: [0, 99], default: 99, display: num },
  { key: 'egr3', name: 'EG RATE 3', range: [0, 99], default: 99, display: num },
  { key: 'egr4', name: 'EG RATE 4', range: [0, 99], default: 99, display: num },
  { key: 'egl1', name: 'EG LEVEL 1', range: [0, 99], default: 99, display: num },
  { key: 'egl2', name: 'EG LEVEL 2', range: [0, 99], default: 99, display: num },
  { key: 'egl3', name: 'EG LEVEL 3', range: [0, 99], default: 99, display: num },
  { key: 'egl4', name: 'EG LEVEL 4', range: [0, 99], default: 0, display: num },
  { key: 'bp', name: 'BREAK POINT', range: [0, 99], default: 39, display: breakPointName },
  { key: 'ld', name: 'L SCALE DEPTH', range: [0, 99], default: 0, display: num },
  { key: 'rd', name: 'R SCALE DEPTH', range: [0, 99], default: 0, display: num },
  { key: 'lc', name: 'L KEY SCALE', range: [0, 3], default: 0, display: (v) => CURVES[v] },
  { key: 'rc', name: 'R KEY SCALE', range: [0, 3], default: 0, display: (v) => CURVES[v] },
  { key: 'rs', name: 'RATE SCALING', range: [0, 7], default: 0, display: num },
  { key: 'ams', name: 'A MOD SENS.', range: [0, 3], default: 0, display: num },
  { key: 'kvs', name: 'KEY VELOCITY', range: [0, 7], default: 0, display: num },
  { key: 'ol', name: 'OUTPUT LEVEL', range: [0, 99], default: 0, display: num },
  { key: 'mode', name: 'OSC MODE', range: [0, 1], default: 0, display: (v) => (v ? 'FIXED' : 'RATIO') },
  { key: 'fc', name: 'F COARSE', range: [0, 31], default: 1, display: num },
  { key: 'ff', name: 'F FINE', range: [0, 99], default: 0, display: num },
  { key: 'det', name: 'OSC DETUNE', range: [0, 14], default: 7, display: signed(7) }
];

const COMMON = [
  { id: 'peg_r1', name: 'P EG RATE 1', range: [0, 99], default: 99, display: num },
  { id: 'peg_r2', name: 'P EG RATE 2', range: [0, 99], default: 99, display: num },
  { id: 'peg_r3', name: 'P EG RATE 3', range: [0, 99], default: 99, display: num },
  { id: 'peg_r4', name: 'P EG RATE 4', range: [0, 99], default: 99, display: num },
  { id: 'peg_l1', name: 'P EG LEVEL 1', range: [0, 99], default: 50, display: num },
  { id: 'peg_l2', name: 'P EG LEVEL 2', range: [0, 99], default: 50, display: num },
  { id: 'peg_l3', name: 'P EG LEVEL 3', range: [0, 99], default: 50, display: num },
  { id: 'peg_l4', name: 'P EG LEVEL 4', range: [0, 99], default: 50, display: num },
  { id: 'algorithm', name: 'ALGORITHM SELECT', range: [0, 31], default: 0, display: (v) => String(v + 1) },
  { id: 'feedback', name: 'FEEDBACK', range: [0, 7], default: 0, display: num },
  { id: 'osc_sync', name: 'OSC KEY SYNC', range: [0, 1], default: 1, display: onOff },
  { id: 'lfo_speed', name: 'LFO SPEED', range: [0, 99], default: 35, display: num },
  { id: 'lfo_delay', name: 'LFO DELAY', range: [0, 99], default: 0, display: num },
  { id: 'lfo_pmd', name: 'LFO PM DEPTH', range: [0, 99], default: 0, display: num },
  { id: 'lfo_amd', name: 'LFO AM DEPTH', range: [0, 99], default: 0, display: num },
  { id: 'lfo_sync', name: 'LFO KEY SYNC', range: [0, 1], default: 1, display: onOff },
  { id: 'lfo_wave', name: 'LFO WAVE', range: [0, 5], default: 0, display: (v) => WAVES[v] },
  { id: 'pms', name: 'P MOD SENS.', range: [0, 7], default: 3, display: num },
  { id: 'transpose', name: 'KEY TRANSPOSE', range: [0, 48], default: 24, display: transposeName }
];

const DEFAULT_NAME = 'INIT VOICE';

function buildDefs() {
  const defs = [];
  // Dump order runs OP6 first.
  for (let op = 6; op >= 1; op--) {
    for (const t of OP_TEMPLATE) {
      defs.push({
        id: `op${op}_${t.key}`,
        op,
        name: `OP${op} ${t.name}`,
        range: t.range,
        // INIT VOICE is audible through OP1 only: its output level is 99
        // while OP2-6 start at 0.
        default: t.key === 'ol' && op === 1 ? 99 : t.default,
        display: t.display
      });
    }
  }
  for (const c of COMMON) defs.push({ ...c });
  for (let i = 0; i < 10; i++) {
    defs.push({
      id: `name${i}`,
      name: 'VOICE NAME',
      range: [32, 127],
      default: DEFAULT_NAME.padEnd(10).charCodeAt(i),
      display: (v) => String.fromCharCode(v)
    });
  }
  return defs;
}

export const voiceParamDefs = buildDefs();

if (voiceParamDefs.length !== 155) {
  throw new Error(`voice model must have 155 parameters, got ${voiceParamDefs.length}`);
}

/** id -> index into the 155-slot voice buffer. */
export const paramIndex = new Map(voiceParamDefs.map((d, i) => [d.id, i]));

/** @returns {number[]} a fresh INIT VOICE buffer (155 values, dump order) */
export function initVoice() {
  return voiceParamDefs.map((d) => d.default);
}

/** @param {number[]} voice @returns {string} the 10-char voice name */
export function voiceName(voice) {
  let s = '';
  for (let i = 0; i < 10; i++) s += String.fromCharCode(voice[paramIndex.get(`name${i}`)]);
  return s;
}

/**
 * Resolve the EDIT-mode selection (button, sub-cycle, selected operator)
 * to a voice parameter id, or null when the selection is not a directly
 * adjustable value (voice name entry arrives in a later milestone).
 *
 * @param {{action:string, param:string}|null} entry buttonMap editMap entry
 * @param {number} sub cycle index
 * @param {number} op selected operator 1-6
 * @returns {string|null}
 */
export function editTargetId(entry, sub, op) {
  if (!entry || entry.action === 'opOnOff') return null;
  switch (entry.param) {
    case 'algorithm': return 'algorithm';
    case 'feedback': return 'feedback';
    case 'lfoWave': return 'lfo_wave';
    case 'lfoSpeed': return 'lfo_speed';
    case 'lfoDelay': return 'lfo_delay';
    case 'lfoPmd': return 'lfo_pmd';
    case 'lfoAmd': return 'lfo_amd';
    case 'lfoSync': return 'lfo_sync';
    case 'pitchModSens': return 'pms';
    case 'ampModSens': return `op${op}_ams`;
    // Button 17 cycles between the per-op oscillator mode and the common
    // oscillator key sync.
    case 'oscModeSync': return sub === 0 ? `op${op}_mode` : 'osc_sync';
    case 'freqCoarse': return `op${op}_fc`;
    case 'freqFine': return `op${op}_ff`;
    case 'detune': return `op${op}_det`;
    case 'egRate': return `op${op}_egr${sub + 1}`;
    case 'egLevel': return `op${op}_egl${sub + 1}`;
    case 'kbdBreakPoint': return `op${op}_bp`;
    case 'kbdCurve': return sub === 0 ? `op${op}_lc` : `op${op}_rc`;
    case 'kbdDepth': return sub === 0 ? `op${op}_ld` : `op${op}_rd`;
    case 'kbdRateScaling': return `op${op}_rs`;
    case 'outputLevel': return `op${op}_ol`;
    case 'keyVelSens': return `op${op}_kvs`;
    case 'pitchEgRate': return `peg_r${sub + 1}`;
    case 'pitchEgLevel': return `peg_l${sub + 1}`;
    case 'transpose': return 'transpose';
    default: return null;
  }
}
