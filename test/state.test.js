/**
 * State machine tests (spec 6 transitions, 15.4 interaction cases that are
 * testable without a DOM): every documented mode transition, the store
 * flow with memory protect, per-mode numbered-button routing, and the
 * LCD/LED contents that must track mode changes.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createStore } from '../src/state/store.js';
import { PanelMode } from '../src/state/PanelMode.js';

let store;
const press = (id) => store.dispatch({ type: 'panelButtonPressed', id });
const state = () => store.getState();

beforeEach(() => {
  store = createStore();
});

describe('boot state', () => {
  it('starts in PLAY on internal patch 1 with protect on', () => {
    expect(state().mode).toBe(PanelMode.PLAY);
    expect(state().lcd).toEqual(['INTERNAL VOICE  ', 'INT 1 INIT VOICE']);
    expect(state().led).toBe(' 1');
    expect(state().memoryProtect).toEqual({ internal: true, cartridge: true });
  });
});

describe('PLAY mode', () => {
  it('numbered buttons load patches and update LCD/LED', () => {
    press('btn-14');
    expect(state().currentPatch).toBe(14);
    expect(state().led).toBe('14');
    expect(state().lcd[1]).toBe('INT14 INIT VOICE');
  });

  it('memory select switches banks and the LCD bank tag', () => {
    press('mem-select-crt');
    expect(state().bank).toBe('cartridge');
    expect(state().lcd).toEqual(['CARTRIDGE VOICE ', 'CRT 1 INIT VOICE']);
    press('mem-select-int');
    expect(state().bank).toBe('internal');
  });
});

describe('EDIT / COMPARE transitions (spec 6)', () => {
  it('PLAY -> EDIT -> COMPARE -> EDIT via EDIT/COMPARE', () => {
    press('edit-compare');
    expect(state().mode).toBe(PanelMode.EDIT);
    expect(state().lcd[0]).toBe('ALGORITHM SELECT');
    expect(state().led).toBe(' 7');

    press('edit-compare');
    expect(state().mode).toBe(PanelMode.COMPARE);
    expect(state().led).toBe(' C');

    press('edit-compare');
    expect(state().mode).toBe(PanelMode.EDIT);
  });

  it('buttons 1-6 toggle operators instead of selecting a parameter', () => {
    press('edit-compare');
    press('btn-03');
    expect(state().opOnOff[2]).toBe(false);
    expect(state().editParam).toBe(7); // unchanged
    press('btn-03');
    expect(state().opOnOff[2]).toBe(true);
  });

  it('re-pressing a multi-function button cycles sub-parameters', () => {
    press('edit-compare');
    press('btn-21');
    expect(state().lcd[0]).toBe('OP1 EG RATE 1   ');
    press('btn-21');
    expect(state().lcd[0]).toBe('OP1 EG RATE 2   ');
    press('btn-22');
    expect(state().lcd[0]).toBe('OP1 EG LEVEL 1  ');
  });

  it('OPERATOR SELECT cycles the op shown in per-op titles', () => {
    press('edit-compare');
    press('btn-27');
    expect(state().lcd[0]).toBe('OP1 OUTPUT LEVEL');
    press('operator-select');
    expect(state().lcd[0]).toBe('OP2 OUTPUT LEVEL');
    for (let i = 0; i < 5; i++) press('operator-select');
    expect(state().lcd[0]).toBe('OP1 OUTPUT LEVEL'); // wrapped 2..6 -> 1
  });
});

describe('FUNCTION mode (spec 6)', () => {
  it('toggles from any mode and returns to the previous mode', () => {
    press('edit-compare');
    press('function');
    expect(state().mode).toBe(PanelMode.FUNCTION);
    expect(state().lcd[0]).toBe('MASTER TUNE ADJ ');
    expect(state().led).toBe(' 1');
    press('function');
    expect(state().mode).toBe(PanelMode.EDIT);
  });

  it('routes numbered buttons through the function map', () => {
    press('function');
    press('btn-17');
    expect(state().lcd[0]).toBe('WHEEL RANGE     ');
    expect(state().led).toBe('17');
    press('btn-08');
    expect(state().lcd[0]).toBe('MIDI CH         ');
    press('btn-08'); // cycles the MIDI sub-display
    expect(state().lcd[0]).toBe('SYS INFO        ');
  });

  it('ignores the unassigned buttons 12 and 13', () => {
    press('function');
    press('btn-05');
    press('btn-12');
    expect(state().functionParam).toBe(5);
    press('btn-13');
    expect(state().functionParam).toBe(5);
  });
});

describe('STORE flow (spec 5.7, 6, 5.6)', () => {
  it('prompts, blinks the destination, and NO cancels back', () => {
    press('edit-compare'); // enter EDIT so cancel has somewhere to return
    press('store');
    expect(state().mode).toBe(PanelMode.STORE);
    expect(state().lcd[0]).toBe(' MEMORY STORE   ');
    expect(state().ledBlinking).toBe(false);

    press('btn-05');
    expect(state().lcd[0]).toBe('STORE IN INT 05?');
    expect(state().led).toBe(' 5');
    expect(state().ledBlinking).toBe(true);

    press('no');
    expect(state().mode).toBe(PanelMode.EDIT);
    expect(state().ledBlinking).toBe(false);
  });

  it('blocks confirmation while memory protect is on', () => {
    press('store');
    press('btn-05');
    press('yes');
    expect(state().mode).toBe(PanelMode.STORE); // still pending
    expect(state().lcd[0]).toBe('MEMORY PROTECTED');
  });

  it('writes once protect is off and returns to the previous mode', () => {
    press('mem-protect-int'); // toggle protect off
    expect(state().memoryProtect.internal).toBe(false);
    expect(state().lcd).toEqual(['MEMORY PROTECT  ', 'INTERNAL     OFF']);

    press('store');
    press('btn-09');
    press('yes');
    expect(state().mode).toBe(PanelMode.PLAY);
    expect(state().currentPatch).toBe(9);
    expect(state().led).toBe(' 9');
  });

  it('EDIT/COMPARE and FUNCTION are inert while a store is pending', () => {
    press('store');
    press('edit-compare');
    press('function');
    expect(state().mode).toBe(PanelMode.STORE);
  });
});

describe('auto-repeat routing (spec 5.4)', () => {
  it('never re-confirms a store prompt', () => {
    press('mem-protect-int');
    press('store');
    press('btn-03');
    store.dispatch({ type: 'panelButtonRepeat', id: 'yes' });
    expect(state().mode).toBe(PanelMode.STORE); // repeat must not confirm
    press('yes');
    expect(state().mode).toBe(PanelMode.PLAY);
  });
});
