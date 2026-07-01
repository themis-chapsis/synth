/**
 * LCD text formatting (spec 8.4): produces the 16x2 text buffer for the
 * current panel state, following the original firmware's display formats,
 * e.g. `ALGORITHM SELECT` / `      12`.
 *
 * Titles and value strings come from the parameter definitions
 * (voiceParams/functionParams), so a parameter can never change without
 * the LCD reflecting it (spec section 18). Exact strings are best-effort
 * reconstructions pending the blocked manual (see /reference/README.md)
 * and are unit-tested per spec 15.1.
 */

import { PanelMode } from '../state/PanelMode.js';
import { editMap, functionMap } from '../state/buttonMap.js';
import { voiceParamDefs, paramIndex, editTargetId, voiceName } from '../state/voiceParams.js';
import { functionParamDefs, functionTargetKey } from '../state/functionParams.js';

const pad = (s) => s.slice(0, 16).padEnd(16, ' ');

/**
 * Value row layout: numeric values right-aligned to column 8, symbolic
 * values indented to column 6 (per the manual's screen examples).
 */
const valueRow = (text) => (/^[+-]?\d+$/.test(text) ? text.padStart(8) : ' '.repeat(6) + text);

/** EDIT/COMPARE screen: parameter title + value from the given buffer. */
function editScreen(state, buffer) {
  const entry = editMap[state.editParam - 1];
  // Button 32: whole-name display; the blinking cursor marks the
  // character NO/YES/DATA ENTRY edit (position advances on re-press).
  if (entry?.param === 'voiceName') {
    return ['VOICE NAME', ' '.repeat(6) + voiceName(buffer)];
  }
  const id = editTargetId(entry, state.editSub, state.selectedOp, state.nameCursor);
  if (id == null) return ['EDIT', ''];
  const idx = paramIndex.get(id);
  const def = voiceParamDefs[idx];
  return [def.name, valueRow(def.display(buffer[idx]))];
}

/** Titles for the value-less FUNCTION entries (confirm/status displays). */
const FUNCTION_NOTICES = {
  editRecall: 'EDIT RECALL ?',
  voiceInit: 'VOICE INIT ?',
  cartridgeForm: 'CRT FORM ?',
  batteryCheck: 'BATTERY VOLT=3.9',
  cartridgeSave: 'SAVE MEMORY ?',
  cartridgeLoad: 'LOAD MEMORY ?'
};

function functionScreen(state) {
  const entry = functionMap[state.functionParam - 1];
  const key = functionTargetKey(entry, state.functionSub);
  if (key == null) {
    if (entry?.param === 'midi' && state.functionSub === 2) return ['MIDI TRANSMIT ?', ''];
    return [FUNCTION_NOTICES[entry?.param] ?? 'FUNCTION CONTROL', ''];
  }
  const def = functionParamDefs[key];
  return [def.name, valueRow(def.display(state.funcValues[key]))];
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
      return [pad(`${bankName} VOICE`), pad(`${tag}${nn} ${voiceName(state.voice)}`)];
    }

    case PanelMode.EDIT: {
      const [title, value] = editScreen(state, state.voice);
      return [pad(title), pad(value)];
    }

    case PanelMode.COMPARE: {
      // Shows the unedited voice's values for A/B (spec 5.8).
      const [title, value] = editScreen(state, state.compareVoice);
      return [pad(title), pad(value)];
    }

    case PanelMode.FUNCTION: {
      const [title, value] = functionScreen(state);
      return [pad(title), pad(value)];
    }

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
