/**
 * Central state store, event bus, and panel mode state machine
 * (spec sections 6 and 13).
 *
 * All panel input lands here as dispatched actions; numbered buttons route
 * through the per-mode lookup tables in buttonMap.js. Every state change
 * refreshes the LCD text (via lcdFormatter) and the LED so displays can
 * never drift from state.
 *
 * Milestone 3: the working voice is a live 155-value buffer; NO/YES and
 * DATA ENTRY adjust the selected edit/function parameter, PLAY loads from
 * the banks, STORE writes to them, COMPARE reads the pristine copy of the
 * loaded patch. Engine updates (port.postMessage batching) start with
 * milestone 4.
 */

import { PanelMode } from './PanelMode.js';
import { editMap, functionMap } from './buttonMap.js';
import { formatLcd } from '../display/lcdFormatter.js';
import {
  voiceParamDefs, paramIndex, initVoice, editTargetId
} from './voiceParams.js';
import { functionParamDefs, initFunctionValues, functionTargetKey } from './functionParams.js';
import { createBanks } from './patchBank.js';

const clamp = (v, [min, max]) => Math.min(max, Math.max(min, v));

export function createStore() {
  const state = {
    mode: PanelMode.PLAY,
    /** mode to return to when STORE resolves or FUNCTION toggles off */
    storeReturnMode: PanelMode.PLAY,
    functionReturnMode: PanelMode.PLAY,

    bank: 'internal', // memory select: 'internal' | 'cartridge'
    currentPatch: 1, // 1-32
    memoryProtect: { internal: true, cartridge: true }, // both ON at power-up
    storeTarget: null, // destination slot while in STORE mode

    banks: createBanks(),
    /** working voice, 155 values in dump order */
    voice: initVoice(),
    /** pristine copy of the loaded patch, shown in COMPARE */
    compareVoice: initVoice(),
    /** global function parameter values */
    funcValues: initFunctionValues(),

    selectedOp: 1, // 1-6, cycled by OPERATOR SELECT
    opOnOff: [true, true, true, true, true, true],
    editParam: 7, // last selected edit button (7 = algorithm)
    editSub: 0, // cycle index for multi-press buttons (EG RATE 1-4 etc.)
    functionParam: 1,
    functionSub: 0,

    /** transient full-screen LCD notice (e.g. MEMORY PROTECTED) */
    notice: null,

    lcd: ['', ''],
    led: ' 1',
    ledBlinking: false
  };

  const listeners = new Set();

  function refreshDisplays() {
    state.lcd = formatLcd(state);

    switch (state.mode) {
      case PanelMode.PLAY:
        state.led = String(state.currentPatch).padStart(2, ' ');
        state.ledBlinking = false;
        break;
      case PanelMode.EDIT:
        state.led = String(state.editParam).padStart(2, ' ');
        state.ledBlinking = false;
        break;
      case PanelMode.COMPARE:
        // Spec 5.8: LED indicates the compare position.
        state.led = ' C';
        state.ledBlinking = false;
        break;
      case PanelMode.FUNCTION:
        state.led = String(state.functionParam).padStart(2, ' ');
        state.ledBlinking = false;
        break;
      case PanelMode.STORE:
        // Spec 9: destination blinks at 2 Hz until confirmed.
        state.led = String(state.storeTarget ?? state.currentPatch).padStart(2, ' ');
        state.ledBlinking = state.storeTarget != null;
        break;
    }
  }

  function emit(action) {
    refreshDisplays();
    for (const fn of listeners) fn(state, action);
  }

  function enterMode(mode) {
    state.notice = null;
    state.mode = mode;
  }

  function loadPatch(n) {
    state.currentPatch = n;
    const stored = state.banks[state.bank][n - 1];
    state.voice = stored ? stored.slice() : initVoice();
    state.compareVoice = state.voice.slice();
  }

  /** The parameter currently addressed by NO/YES/DATA ENTRY, if any. */
  function selectedTarget() {
    if (state.mode === PanelMode.EDIT) {
      const id = editTargetId(editMap[state.editParam - 1], state.editSub, state.selectedOp);
      if (id == null) return null;
      const idx = paramIndex.get(id);
      return { kind: 'voice', idx, def: voiceParamDefs[idx] };
    }
    if (state.mode === PanelMode.FUNCTION) {
      const key = functionTargetKey(functionMap[state.functionParam - 1], state.functionSub);
      if (key == null) return null;
      return { kind: 'func', key, def: functionParamDefs[key] };
    }
    return null; // PLAY and COMPARE take no value input
  }

  function setTargetValue(target, value) {
    const v = clamp(value, target.def.range);
    if (target.kind === 'voice') state.voice[target.idx] = v;
    else state.funcValues[target.key] = v;
  }

  function handleNumbered(n) {
    state.notice = null;
    switch (state.mode) {
      case PanelMode.PLAY:
        loadPatch(n);
        break;

      case PanelMode.COMPARE:
        // Compare is read-only; selection changes wait for EDIT.
        break;

      case PanelMode.EDIT: {
        const entry = editMap[n - 1];
        if (entry.action === 'opOnOff') {
          state.opOnOff[entry.op - 1] = !state.opOnOff[entry.op - 1];
        } else {
          // Re-pressing a multi-function button cycles its sub-parameter.
          if (state.editParam === n && entry.cycles) {
            state.editSub = (state.editSub + 1) % entry.cycles;
          } else {
            state.editSub = 0;
          }
          state.editParam = n;
        }
        break;
      }

      case PanelMode.FUNCTION: {
        const entry = functionMap[n - 1];
        if (!entry) break; // 12/13 unassigned on the original panel
        if (state.functionParam === n && entry.cycles) {
          state.functionSub = (state.functionSub + 1) % entry.cycles;
        } else {
          state.functionSub = 0;
        }
        state.functionParam = n;
        break;
      }

      case PanelMode.STORE:
        state.storeTarget = n;
        break;
    }
  }

  function handleStore() {
    if (state.mode === PanelMode.STORE) return;
    state.storeReturnMode = state.mode;
    state.storeTarget = null;
    enterMode(PanelMode.STORE);
  }

  function resolveStore(confirmed) {
    if (confirmed && state.storeTarget != null) {
      if (state.memoryProtect[state.bank]) {
        state.notice = ['MEMORY PROTECTED', ''];
        return; // stay in STORE; NO backs out
      }
      state.banks[state.bank][state.storeTarget - 1] = state.voice.slice();
      state.currentPatch = state.storeTarget;
      state.compareVoice = state.voice.slice();
    }
    state.storeTarget = null;
    enterMode(state.storeReturnMode);
  }

  function handleEditCompare() {
    switch (state.mode) {
      case PanelMode.EDIT:
        enterMode(PanelMode.COMPARE);
        break;
      case PanelMode.COMPARE:
        enterMode(PanelMode.EDIT);
        break;
      case PanelMode.STORE:
        break; // resolve the store prompt first
      default:
        enterMode(PanelMode.EDIT);
    }
  }

  function handleFunction() {
    if (state.mode === PanelMode.STORE) return;
    if (state.mode === PanelMode.FUNCTION) {
      enterMode(state.functionReturnMode);
    } else {
      state.functionReturnMode = state.mode;
      enterMode(PanelMode.FUNCTION);
    }
  }

  function toggleProtect(bank) {
    state.memoryProtect[bank] = !state.memoryProtect[bank];
    // Status readout, mirroring the original's protect display.
    const name = bank === 'internal' ? 'INTERNAL' : 'CARTRIDGE';
    const flag = state.memoryProtect[bank] ? ' ON' : 'OFF';
    state.notice = ['MEMORY PROTECT', `${name.padEnd(13)}${flag}`];
  }

  function adjustParam(delta) {
    const target = selectedTarget();
    if (!target) return;
    const current = target.kind === 'voice' ? state.voice[target.idx] : state.funcValues[target.key];
    setTargetValue(target, current + delta);
  }

  const buttonHandlers = {
    store: handleStore,
    'edit-compare': handleEditCompare,
    function: handleFunction,
    no: () => {
      if (state.mode === PanelMode.STORE) resolveStore(false);
      else adjustParam(-1);
    },
    yes: () => {
      if (state.mode === PanelMode.STORE) resolveStore(true);
      else adjustParam(+1);
    },
    'mem-select-int': () => { state.notice = null; state.bank = 'internal'; },
    'mem-select-crt': () => { state.notice = null; state.bank = 'cartridge'; },
    'mem-protect-int': () => toggleProtect('internal'),
    'mem-protect-crt': () => toggleProtect('cartridge'),
    'operator-select': () => { state.selectedOp = (state.selectedOp % 6) + 1; }
  };

  const store = {
    getState() {
      return state;
    },

    /** @param {(state: typeof state, action: object) => void} fn */
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /** @param {{type: string, [k: string]: any}} action */
    dispatch(action) {
      switch (action.type) {
        case 'panelButtonPressed': {
          const numbered = /^btn-(\d\d)$/.exec(action.id);
          if (numbered) handleNumbered(Number(numbered[1]));
          else buttonHandlers[action.id]?.();
          break;
        }
        case 'panelButtonReleased':
          return; // no state change, skip the emit
        case 'panelButtonRepeat':
          // Auto-repeat only steps parameters (spec 5.4); it must never
          // re-confirm a store prompt.
          if (state.mode === PanelMode.STORE) return;
          if (action.id === 'no') adjustParam(-1);
          else if (action.id === 'yes') adjustParam(+1);
          else return;
          break;
        case 'adjustParam':
          adjustParam(action.delta);
          break;
        case 'dataEntry': {
          // Absolute-position slider (spec 5.3): normalized 0-1 maps onto
          // the selected parameter's full range.
          const target = selectedTarget();
          if (!target) return;
          const [min, max] = target.def.range;
          setTargetValue(target, Math.round(min + action.value * (max - min)));
          break;
        }
        default:
          console.warn('[store] unknown action', action);
          return;
      }
      emit(action);
    }
  };

  refreshDisplays();
  return store;
}

export const store = createStore();
