/**
 * Milestone 11 tests: voice-name editing with cursor, edit recall, voice
 * init, and the cartridge format/save/load functions with memory protect
 * (spec 5.6/5.9 and the manual's function chapter).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createStore } from '../src/state/store.js';
import { paramIndex, voiceName, initVoice } from '../src/state/voiceParams.js';
import { PanelMode } from '../src/state/PanelMode.js';

let store;
const press = (id) => store.dispatch({ type: 'panelButtonPressed', id });
const state = () => store.getState();

beforeEach(() => {
  store = createStore();
});

describe('voice name editing', () => {
  beforeEach(() => {
    press('edit-compare');
    press('btn-32');
  });

  it('YES/NO change the character under the cursor', () => {
    expect(state().lcd[1]).toBe('      INIT VOICE');
    press('yes'); // 'I' -> 'J'
    expect(voiceName(state().voice)).toBe('JNIT VOICE');
    press('no');
    expect(voiceName(state().voice)).toBe('INIT VOICE');
  });

  it('re-pressing button 32 advances the cursor with wraparound', () => {
    expect(state().nameCursor).toBe(0);
    press('btn-32');
    press('btn-32');
    expect(state().nameCursor).toBe(2);
    press('yes'); // 'I' at pos 2 -> 'J'
    expect(voiceName(state().voice)).toBe('INJT VOICE');
    for (let i = 0; i < 8; i++) press('btn-32');
    expect(state().nameCursor).toBe(0);
  });

  it('DATA ENTRY sweeps the printable character range', () => {
    store.dispatch({ type: 'dataEntry', value: 1 });
    expect(state().voice[paramIndex.get('name0')]).toBe(127);
    store.dispatch({ type: 'dataEntry', value: 0 });
    expect(state().voice[paramIndex.get('name0')]).toBe(32);
  });
});

describe('edit recall and voice init', () => {
  it('recalls unsaved edits lost to a patch load', () => {
    press('edit-compare');
    press('yes'); // algorithm 1 -> 2 (dirty edit buffer)
    press('function');
    press('function'); // back to EDIT
    // Leave via PLAY-load, which overwrites the edit buffer.
    store.getState().mode = PanelMode.PLAY; // direct: simulate ESC/play
    press('btn-05');
    expect(state().voice[paramIndex.get('algorithm')]).toBe(0);

    press('function');
    press('btn-09'); // EDIT RECALL ?
    press('yes');
    expect(state().mode).toBe(PanelMode.EDIT);
    expect(state().voice[paramIndex.get('algorithm')]).toBe(1);
  });

  it('voice init loads INIT VOICE and enters EDIT', () => {
    press('edit-compare');
    press('yes');
    press('function');
    press('btn-10'); // VOICE INIT ?
    press('yes');
    expect(state().mode).toBe(PanelMode.EDIT);
    expect(state().voice).toEqual(initVoice());
  });
});

describe('cartridge functions', () => {
  const algAt = (bank, slot) => state().banks[bank][slot]?.[paramIndex.get('algorithm')];

  it('format initializes 32 cartridge voices, respecting protect', () => {
    press('function');
    press('btn-11'); // CRT FORM ?
    press('yes');
    expect(state().lcd[0]).toBe('MEMORY PROTECTED');
    expect(state().banks.cartridge[0]).toBeNull();

    press('mem-protect-crt'); // protect off
    press('btn-11');
    press('yes');
    expect(state().banks.cartridge).toHaveLength(32);
    expect(state().banks.cartridge[31]).toEqual(initVoice());
  });

  it('save copies internal -> cartridge; load copies cartridge -> internal', () => {
    // Put a distinctive voice into internal slot 3.
    const v = initVoice();
    v[paramIndex.get('algorithm')] = 21;
    state().banks.internal[2] = v;

    press('function');
    press('mem-protect-crt');
    press('btn-15'); // SAVE MEMORY ?
    press('yes');
    expect(algAt('cartridge', 2)).toBe(21);
    expect(state().lcd[0]).toBe(' SAVE COMPLETED ');

    // Mutate cartridge, then load it back into internal.
    state().banks.cartridge[2][paramIndex.get('algorithm')] = 9;
    press('btn-16'); // LOAD MEMORY ?
    press('yes');
    expect(state().lcd[0]).toBe('MEMORY PROTECTED'); // internal still protected
    press('mem-protect-int');
    press('btn-16');
    press('yes');
    expect(algAt('internal', 2)).toBe(9);
  });
});
