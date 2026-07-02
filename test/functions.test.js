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

describe('voice name editing (manual CHARACTER-key scheme)', () => {
  const hold = (id) => store.dispatch({ type: 'panelButtonPressed', id });
  const release = (id) => store.dispatch({ type: 'panelButtonReleased', id });

  beforeEach(() => {
    press('edit-compare');
    press('btn-32');
  });

  it('YES/NO move the cursor (the < and > keys), wrapping', () => {
    expect(state().nameCursor).toBe(0);
    press('yes');
    press('yes');
    expect(state().nameCursor).toBe(2);
    press('no');
    expect(state().nameCursor).toBe(1);
    press('no');
    press('no');
    expect(state().nameCursor).toBe(9); // wrapped backwards
    expect(voiceName(state().voice)).toBe('INIT VOICE'); // unchanged
  });

  it('CHARACTER (held EDIT/COMPARE) + button types the corner char', () => {
    hold('edit-compare'); // becomes the CHARACTER key, no COMPARE toggle
    expect(state().mode).toBe(PanelMode.EDIT);
    press('btn-12'); // 'B'
    press('btn-11'); // 'A'
    press('btn-29'); // 'S'
    press('btn-29'); // 'S'
    press('function'); // space
    press('btn-01'); // '1'
    release('edit-compare');
    expect(voiceName(state().voice)).toBe('BASS 1OICE');
    expect(state().nameCursor).toBe(6); // advanced per character
    // Released: the buttons act normally again.
    press('btn-07');
    expect(state().editParam).toBe(7);
  });

  it('utility buttons type W X Y Z - . while CHARACTER is held', () => {
    hold('edit-compare');
    press('store'); // W
    press('mem-protect-int'); // X
    press('mem-select-crt'); // .
    release('edit-compare');
    expect(voiceName(state().voice)).toBe('WX.T VOICE');
    expect(state().mode).toBe(PanelMode.EDIT); // store/protect suppressed
    expect(state().memoryProtect.internal).toBe(true);
  });

  it('DATA ENTRY sweeps the character at the cursor', () => {
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
    press('yes'); // arms the confirmation
    expect(state().lcd[0]).toBe('ARE YOU SURE ?  ');
    expect(state().mode).toBe(PanelMode.FUNCTION);
    press('yes'); // second YES executes (manual: double prompt)
    expect(state().mode).toBe(PanelMode.EDIT);
    expect(state().voice[paramIndex.get('algorithm')]).toBe(1);
  });

  it('NO cancels an armed confirmation', () => {
    press('function');
    press('btn-10');
    press('yes');
    expect(state().lcd[0]).toBe('ARE YOU SURE ?  ');
    press('no');
    expect(state().lcd[0]).toBe('VOICE INIT ?    ');
    expect(state().mode).toBe(PanelMode.FUNCTION);
  });

  it('voice init loads INIT VOICE and enters EDIT after double YES', () => {
    press('edit-compare');
    press('yes');
    press('function');
    press('btn-10'); // VOICE INIT ?
    press('yes');
    press('yes');
    expect(state().mode).toBe(PanelMode.EDIT);
    expect(state().voice).toEqual(initVoice());
  });
});

describe('cartridge functions', () => {
  const algAt = (bank, slot) => state().banks[bank][slot]?.[paramIndex.get('algorithm')];

  const confirm = () => { press('yes'); press('yes'); }; // double prompt

  it('format initializes 32 cartridge voices, respecting protect', () => {
    press('function');
    press('btn-11'); // CART FORM ?
    confirm();
    expect(state().lcd[0]).toBe('MEMORY PROTECTED');
    expect(state().banks.cartridge[0]).toBeNull();

    press('mem-protect-crt'); // protect off
    press('btn-11');
    confirm();
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
    confirm();
    expect(algAt('cartridge', 2)).toBe(21);
    expect(state().lcd[0]).toBe(' SAVE COMPLETED ');

    // Mutate cartridge, then load it back into internal.
    state().banks.cartridge[2][paramIndex.get('algorithm')] = 9;
    press('btn-16'); // LOAD MEMORY ?
    confirm();
    expect(state().lcd[0]).toBe('MEMORY PROTECTED'); // internal still protected
    press('mem-protect-int');
    press('btn-16');
    confirm();
    expect(algAt('internal', 2)).toBe(9);
  });
});
