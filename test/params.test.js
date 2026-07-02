/**
 * Milestone 3 tests: the 155-parameter voice model, live value editing via
 * NO/YES and DATA ENTRY, LCD value rows, compare buffer semantics, and
 * bank write/load (spec sections 5.3, 5.4, 7, 8.4).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createStore } from '../src/state/store.js';
import { voiceParamDefs, paramIndex, initVoice, voiceName } from '../src/state/voiceParams.js';

let store;
const press = (id) => store.dispatch({ type: 'panelButtonPressed', id });
const state = () => store.getState();
const row = (i) => state().lcd[i];

beforeEach(() => {
  store = createStore();
});

describe('voice model shape (spec 7)', () => {
  it('has exactly 155 parameters in dump order, OP6 first', () => {
    expect(voiceParamDefs).toHaveLength(155);
    expect(voiceParamDefs[0].id).toBe('op6_egr1');
    expect(voiceParamDefs[20].id).toBe('op6_det');
    expect(voiceParamDefs[21].id).toBe('op5_egr1');
    expect(voiceParamDefs[125].id).toBe('op1_det');
    expect(voiceParamDefs[126].id).toBe('peg_r1');
    expect(voiceParamDefs[134].id).toBe('algorithm');
    expect(voiceParamDefs[144].id).toBe('transpose');
    expect(voiceParamDefs[145].id).toBe('name0');
    expect(voiceParamDefs[154].id).toBe('name9');
  });

  it('builds an INIT VOICE with the documented defaults', () => {
    const v = initVoice();
    expect(voiceName(v)).toBe('INIT VOICE');
    expect(v[paramIndex.get('algorithm')]).toBe(0); // algorithm 1
    expect(v[paramIndex.get('op1_ol')]).toBe(99); // OP1 carries INIT VOICE
    expect(v[paramIndex.get('op2_ol')]).toBe(0);
    expect(v[paramIndex.get('op1_fc')]).toBe(1);
    expect(v[paramIndex.get('op1_det')]).toBe(7); // center detune
    expect(v[paramIndex.get('peg_l4')]).toBe(50);
  });
});

describe('EDIT value rows and adjustment', () => {
  beforeEach(() => press('edit-compare'));

  it('shows the live algorithm value and steps it with YES/NO', () => {
    expect(row(0)).toBe('ALGORITHM SELECT');
    expect(row(1)).toBe('       1        ');
    press('yes');
    expect(row(1)).toBe('       2        ');
    expect(state().voice[paramIndex.get('algorithm')]).toBe(1);
    press('no');
    press('no'); // clamps at the bottom of the range
    expect(row(1)).toBe('       1        ');
  });

  it('maps DATA ENTRY absolutely onto the selected range (spec 5.3)', () => {
    store.dispatch({ type: 'dataEntry', value: 1 });
    expect(row(1)).toBe('      32        ');
    store.dispatch({ type: 'dataEntry', value: 0 });
    expect(row(1)).toBe('       1        ');
    store.dispatch({ type: 'dataEntry', value: 0.5 });
    expect(row(1)).toBe('      17        '); // round(0 + 0.5*31) = 16 -> alg 17
  });

  it('formats symbolic values: detune, wave, transpose, curves', () => {
    press('btn-20'); // OP detune
    expect(row(1)).toBe('       0        ');
    press('yes');
    expect(row(1)).toBe('      +1        ');

    press('btn-09'); // LFO wave
    expect(row(1)).toBe('      TRIANGLE  ');
    press('yes');
    expect(row(1)).toBe('      SAW DWN   ');

    press('btn-31'); // key transpose, default C3
    expect(row(1)).toBe('      C3        ');

    press('btn-24'); // L key scale curve
    expect(row(0)).toBe('OP1 L KEY SCALE ');
    expect(row(1)).toBe('      -LIN      ');
    press('btn-24'); // cycles to the right curve
    expect(row(0)).toBe('OP1 R KEY SCALE ');
  });

  it('button 17 cycles per-op OSC MODE then common OSC KEY SYNC', () => {
    press('btn-17');
    expect(row(0)).toBe('OP1 OSC MODE    ');
    expect(row(1)).toBe('      RATIO     ');
    press('btn-17');
    expect(row(0)).toBe('OSC KEY SYNC    ');
    expect(row(1)).toBe('      ON        ');
  });

  it('targets the operator chosen by OPERATOR SELECT', () => {
    press('btn-27'); // output level
    press('operator-select'); // now OP2
    press('yes');
    expect(state().voice[paramIndex.get('op2_ol')]).toBe(1);
    expect(state().voice[paramIndex.get('op1_ol')]).toBe(99); // untouched
  });

  it('shows the voice name on button 32', () => {
    press('btn-32');
    expect(row(0)).toBe('VOICE NAME      ');
    expect(row(1)).toBe('      INIT VOICE');
  });
});

describe('COMPARE shows the unedited voice (spec 5.8)', () => {
  it('keeps the pristine value while EDIT shows the change', () => {
    press('edit-compare');
    press('yes');
    press('yes'); // algorithm 1 -> 3
    expect(row(1)).toBe('       3        ');

    press('edit-compare'); // COMPARE
    expect(row(1)).toBe('       1        ');
    expect(state().led).toBe(' C');

    press('edit-compare'); // back to EDIT
    expect(row(1)).toBe('       3        ');
  });
});

describe('FUNCTION values', () => {
  beforeEach(() => press('function'));

  it('master tune is slider-only, displayed signed around center', () => {
    expect(row(1)).toBe('       0        ');
    press('yes'); // manual: -1/+1 buttons are not used for master tune
    expect(row(1)).toBe('       0        ');
    store.dispatch({ type: 'dataEntry', value: 1 });
    expect(row(1)).toBe('     +63        ');
  });

  it('midi channel and sys-info sub-parameters hold separate values', () => {
    press('btn-08');
    expect(row(0)).toBe('MIDI CH         ');
    expect(row(1)).toBe('       1        ');
    press('yes');
    expect(row(1)).toBe('       2        ');
    press('btn-08');
    expect(row(0)).toBe('SYS INFO        ');
    expect(row(1)).toBe('      AVAIL     ');
  });

  it('status-style entries show no value row and ignore YES', () => {
    press('btn-14'); // battery check, display only
    expect(row(0)).toBe('BATTERY VOLT=3.0');
    expect(row(1)).toBe('                ');
    press('yes'); // nothing to adjust or confirm here
    expect(state().mode).toBe('FUNCTION');
    // Confirm-style entries (voice init, recall, cartridge ops) are
    // covered in functions.test.js.
  });
});

describe('banks: store writes, play loads (spec 5.7)', () => {
  it('round-trips an edited voice through a bank slot', () => {
    press('mem-protect-int'); // protect off
    press('edit-compare');
    press('yes'); // algorithm -> 2
    press('store');
    press('btn-09');
    press('yes'); // write to INT 9

    expect(state().mode).toBe('EDIT');
    expect(state().banks.internal[8]).not.toBeNull();

    press('function'); // leave EDIT via FUNCTION toggle... and back
    press('function');
    // Load a fresh slot, then reload slot 9: the edit must persist there.
    store.dispatch({ type: 'panelButtonPressed', id: 'edit-compare' }); // EDIT -> COMPARE
    press('edit-compare'); // back to EDIT (no-op for banks)
    // Go to PLAY: FUNCTION toggle returns to EDIT, so use the store return
    // path instead: load patches directly in PLAY.
    const s2 = createStore();
    s2.getState().banks.internal[8] = state().banks.internal[8].slice();
    s2.dispatch({ type: 'panelButtonPressed', id: 'btn-01' });
    expect(s2.getState().voice[paramIndex.get('algorithm')]).toBe(0);
    s2.dispatch({ type: 'panelButtonPressed', id: 'btn-09' });
    expect(s2.getState().voice[paramIndex.get('algorithm')]).toBe(1);
    // And the compare buffer of a freshly loaded patch matches it.
    expect(s2.getState().compareVoice).toEqual(s2.getState().voice);
  });
});
