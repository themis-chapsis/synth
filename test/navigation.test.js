/**
 * Milestone 12 tests: arrow navigation per mode (spec 12.2), Escape to
 * PLAY, and last-button tracking for the Space repeat.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createStore } from '../src/state/store.js';
import { PanelMode } from '../src/state/PanelMode.js';

let store;
const press = (id) => store.dispatch({ type: 'panelButtonPressed', id });
const nav = (delta) => store.dispatch({ type: 'navigateParam', delta });
const state = () => store.getState();

beforeEach(() => {
  store = createStore();
});

describe('arrow navigation', () => {
  it('steps patches in PLAY with wraparound', () => {
    nav(+1);
    expect(state().currentPatch).toBe(2);
    nav(-1);
    nav(-1);
    expect(state().currentPatch).toBe(32);
    expect(state().led).toBe('32');
  });

  it('steps edit parameters 7-32 with wraparound, skipping op toggles', () => {
    press('edit-compare');
    nav(-1); // from 7 wraps to 32
    expect(state().editParam).toBe(32);
    expect(state().lcd[0]).toBe('VOICE NAME      ');
    nav(+1);
    expect(state().editParam).toBe(7);
  });

  it('skips the unassigned 12/13 in FUNCTION', () => {
    press('function');
    press('btn-11');
    nav(+1);
    expect(state().functionParam).toBe(14);
    nav(-1);
    expect(state().functionParam).toBe(11);
  });

  it('moves the store destination', () => {
    press('store');
    nav(+1);
    expect(state().storeTarget).toBe(2);
    expect(state().ledBlinking).toBe(true);
  });
});

describe('escape and repeat', () => {
  it('Escape returns to PLAY from anywhere and clears a pending store', () => {
    press('edit-compare');
    press('store');
    press('btn-05');
    store.dispatch({ type: 'escape' });
    expect(state().mode).toBe(PanelMode.PLAY);
    expect(state().storeTarget).toBeNull();
    expect(state().ledBlinking).toBe(false);
  });

  it('tracks the last pressed button for the Space repeat', () => {
    press('edit-compare');
    press('btn-21');
    expect(state().lastButton).toBe('btn-21');
    press(state().lastButton); // simulated Space
    expect(state().lcd[0]).toBe('OP1 EG RATE 2   '); // cycled, like a re-press
  });
});
