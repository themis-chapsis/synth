/**
 * QWERTY keyboard mapping (spec section 12).
 *
 * Milestone 5 scope: the 2-octave virtual keybed (spec 12.1) plus the
 * '-'/'=' data-entry nudge (spec 5.3). Panel-button shortcuts and the `?`
 * overlay follow in milestone 12 — note the spec assigns 'E'/'F' both to
 * keybed notes (12.1) and to panel shortcuts (12.2); that conflict is
 * flagged for the milestone review before 12.2 is wired.
 *
 * Keybed starts at C3 (Yamaha convention: C3 = middle C = MIDI 60).
 * Shift plays velocity 127, unshifted 64.
 */

const C3 = 60;

/** KeyboardEvent.code -> semitone offset from C3. */
const KEY_TO_OFFSET = new Map(Object.entries({
  KeyA: 0, // C3
  KeyW: 1,
  KeyS: 2,
  KeyE: 3,
  KeyD: 4,
  KeyF: 5,
  KeyT: 6,
  KeyG: 7,
  KeyY: 8,
  KeyH: 9,
  KeyU: 10,
  KeyJ: 11,
  KeyK: 12, // C4
  KeyO: 13,
  KeyL: 14,
  KeyP: 15,
  Semicolon: 16 // E4
}));

/**
 * @param {{
 *   noteOn: (note: number, velocity: number) => void,
 *   noteOff: (note: number) => void,
 *   adjust: (delta: number) => void
 * }} handlers
 * @returns {() => void} uninstall
 */
export function installKeyboardMap(handlers) {
  /** notes held per code, so shift-state changes can't orphan a noteOff */
  const held = new Map();

  const onKeyDown = (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const offset = KEY_TO_OFFSET.get(e.code);
    if (offset !== undefined) {
      e.preventDefault();
      if (held.has(e.code)) return;
      const note = C3 + offset;
      held.set(e.code, note);
      handlers.noteOn(note, e.shiftKey ? 127 : 64);
      return;
    }
    if (e.code === 'Minus') {
      e.preventDefault();
      handlers.adjust(-1);
    } else if (e.code === 'Equal') {
      e.preventDefault();
      handlers.adjust(+1);
    }
  };

  const onKeyUp = (e) => {
    const note = held.get(e.code);
    if (note !== undefined) {
      held.delete(e.code);
      handlers.noteOff(note);
    }
  };

  const onBlur = () => {
    for (const note of held.values()) handlers.noteOff(note);
    held.clear();
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
  };
}
