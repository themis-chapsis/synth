/**
 * LCD text formatting (spec 8.4): produces the 16x2 text buffer for the
 * current panel state, following the original firmware's display formats.
 *
 * Milestone 2 renders titles and mode screens; parameter VALUE rows fill
 * in with the milestone 3 voice model. Exact strings are best-effort
 * reconstructions from Operation Manual excerpts (network policy blocked
 * the manual PDF this session) — to be verified against manual screenshots
 * when available, and unit-tested per spec 15.1.
 */

import { PanelMode } from '../state/PanelMode.js';

const pad = (s) => s.slice(0, 16).padEnd(16, ' ');

/** Row-0 titles for EDIT parameters, per button number (1-based). */
function editTitle(state) {
  const n = state.editParam;
  const op = `OP${state.selectedOp}`;
  const sub = state.editSub;
  switch (n) {
    case 7: return 'ALGORITHM SELECT';
    case 8: return 'FEEDBACK';
    case 9: return 'LFO WAVE';
    case 10: return 'LFO SPEED';
    case 11: return 'LFO DELAY';
    case 12: return 'LFO PM DEPTH';
    case 13: return 'LFO AM DEPTH';
    case 14: return 'LFO KEY SYNC';
    case 15: return 'P MOD SENS.';
    case 16: return 'A MOD SENS.';
    case 17: return `${op} OSC MODE`;
    case 18: return `${op} F COARSE`;
    case 19: return `${op} F FINE`;
    case 20: return `${op} OSC DETUNE`;
    case 21: return `${op} EG RATE ${sub + 1}`;
    case 22: return `${op} EG LEVEL ${sub + 1}`;
    case 23: return `${op} BREAK POINT`;
    case 24: return sub === 0 ? `${op} L KEY SCALE` : `${op} R KEY SCALE`;
    case 25: return sub === 0 ? `${op} L SCALE DEPTH` : `${op} R SCALE DEPTH`;
    case 26: return `${op} RATE SCALING`;
    case 27: return `${op} OUTPUT LEVEL`;
    case 28: return `${op} KEY VELOCITY`;
    case 29: return `P EG RATE ${sub + 1}`;
    case 30: return `P EG LEVEL ${sub + 1}`;
    case 31: return 'KEY TRANSPOSE';
    case 32: return 'VOICE NAME';
    default: return 'EDIT';
  }
}

/** Row-0 titles for FUNCTION parameters, per button number (1-based). */
function functionTitle(state) {
  const n = state.functionParam;
  switch (n) {
    case 1: return 'MASTER TUNE ADJ';
    case 2: return 'POLY/MONO';
    case 3: return 'P BEND RANGE';
    case 4: return 'P BEND STEP';
    case 5: return 'PORTA MODE';
    case 6: return 'PORTA GLISSANDO';
    case 7: return 'PORTA TIME';
    case 8: return ['MIDI CH', 'SYS INFO', 'MIDI TRANSMIT ?'][state.functionSub] ?? 'MIDI CH';
    case 9: return 'EDIT RECALL ?';
    case 10: return 'VOICE INIT ?';
    case 11: return 'CRT FORM ?';
    case 14: return 'BATTERY VOLT=3.9';
    case 15: return 'SAVE MEMORY ?';
    case 16: return 'LOAD MEMORY ?';
    default: {
      if (n >= 17) {
        const ctl = ['WHEEL', 'FOOT', 'BREATH', 'AFTER'][(n - 17) >> 2];
        const par = ['RANGE', 'PITCH', 'AMP', 'EG B.'][(n - 17) % 4];
        return `${ctl} ${par}`;
      }
      return 'FUNCTION CONTROL';
    }
  }
}

/**
 * @param {object} state store state (see createStore)
 * @returns {[string, string]} two 16-char rows
 */
export function formatLcd(state) {
  if (state.notice) {
    return [pad(state.notice[0]), pad(state.notice[1] ?? '')];
  }

  switch (state.mode) {
    case PanelMode.PLAY: {
      const bankName = state.bank === 'internal' ? 'INTERNAL' : 'CARTRIDGE';
      const tag = state.bank === 'internal' ? 'INT' : 'CRT';
      const nn = String(state.currentPatch).padStart(2, ' ');
      // Voice names come from the loaded bank (milestone 9); until then
      // every slot reads as an initialized voice.
      const name = 'INIT VOICE';
      return [pad(`${bankName} VOICE`), pad(`${tag}${nn} ${name}`)];
    }

    case PanelMode.EDIT:
      return [pad(editTitle(state)), pad('')];

    case PanelMode.COMPARE:
      // Shows the unedited voice's values for A/B (values in milestone 3).
      return [pad(editTitle(state)), pad('')];

    case PanelMode.FUNCTION:
      return [pad(functionTitle(state)), pad('')];

    case PanelMode.STORE: {
      if (state.storeTarget == null) return [pad(' MEMORY STORE'), pad('')];
      const tag = state.bank === 'internal' ? 'INT' : 'CRT';
      const nn = String(state.storeTarget).padStart(2, '0');
      return [pad(`STORE IN ${tag} ${nn}?`), pad('')];
    }

    default:
      return [pad(''), pad('')];
  }
}
