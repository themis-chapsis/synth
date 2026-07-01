/**
 * Central state store and event bus (spec section 13).
 *
 * Milestone 1 scope: holds the display state (LCD buffer, LED value, mode)
 * and receives panelButtonPressed dispatches, which are logged but not yet
 * routed — mode transition handling arrives with milestone 2, parameter
 * routing with milestone 3, engine batching (<=60 Hz port.postMessage)
 * with milestone 4+.
 */

import { PanelMode } from './PanelMode.js';

const state = {
  mode: PanelMode.PLAY,
  lcd: ['     READY      ', '                '],
  led: ' 1',
  ledBlinking: false,
  selectedParam: null,
  memoryProtect: { internal: true, cartridge: true },
  memorySelect: 'internal'
};

const listeners = new Set();

export const store = {
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
      case 'panelButtonPressed':
        // Milestone 2 wires this into the (mode, button) lookup table.
        console.debug('[panel]', action.id, 'pressed in mode', state.mode);
        break;
      case 'panelButtonReleased':
        break;
      case 'lcdText':
        state.lcd = [action.row0, action.row1 ?? ''];
        break;
      case 'ledText':
        state.led = action.text;
        break;
      default:
        console.warn('[store] unknown action', action);
        return;
    }
    for (const fn of listeners) fn(state, action);
  }
};
