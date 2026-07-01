/**
 * QWERTY keyboard mapping (spec section 12).
 *
 * 12.1 keybed: 2 octaves from C3 (Yamaha convention, C3 = middle C =
 * MIDI 60) on A..; with W E T Y U O P for sharps; Shift = velocity 127,
 * unshifted 64.
 *
 * 12.2 panel shortcuts. Two documented deviations from the spec text:
 * - The spec assigns bare E/F both to keybed notes (12.1) and to panel
 *   toggles (12.2); the keybed wins, and the toggles live on Alt+E /
 *   Alt+F, consistent with the Alt shortcut family.
 * - The spec's numbered-button table skips button 20; Shift+0 fills the
 *   gap (1-9/0 = 1-10, Shift = +10, Alt = +20, Alt+Shift+1/2 = 31/32).
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

/** All bindings, for the `?` overlay. */
export const bindingHelp = [
  ['A S D F G H J K L ;', 'white keys C3-E4'],
  ['W E T Y U O P', 'black keys'],
  ['Shift + note', 'velocity 127 (else 64)'],
  ['1-9, 0', 'buttons 1-10'],
  ['Shift + 1-9, 0', 'buttons 11-20'],
  ['Alt + 1-9, 0', 'buttons 21-30'],
  ['Alt+Shift + 1, 2', 'buttons 31, 32'],
  ['Enter / Backspace', 'YES / NO'],
  ['Arrow up / down', 'YES / NO'],
  ['Arrow left / right', 'previous / next parameter'],
  ['- / =', 'data entry -1 / +1'],
  ['Alt+E', 'EDIT/COMPARE'],
  ['Alt+F', 'FUNCTION'],
  ['Space', 'repeat last button'],
  ['Escape', 'back to PLAY'],
  ['?', 'toggle this overlay']
];

/** Digit code -> button number under (shift, alt) modifiers. */
function digitToButton(code, shiftKey, altKey) {
  const m = /^Digit(\d)$/.exec(code);
  if (!m) return null;
  const d = Number(m[1]);
  if (altKey && shiftKey) return d === 1 ? 31 : d === 2 ? 32 : null;
  const base = d === 0 ? 10 : d;
  if (altKey) return base + 20;
  if (shiftKey) return base + 10;
  return base;
}

/**
 * @param {{
 *   noteOn: (note: number, velocity: number) => void,
 *   noteOff: (note: number) => void,
 *   adjust: (delta: number) => void,
 *   pressButton: (id: string) => void,
 *   navigate: (delta: number) => void,
 *   escape: () => void,
 *   repeatLast: () => void,
 *   toggleHelp: () => void
 * }} handlers
 * @returns {() => void} uninstall
 */
export function installKeyboardMap(handlers) {
  /** notes held per code, so shift-state changes can't orphan a noteOff */
  const held = new Map();

  const onKeyDown = (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey) return;

    if (e.altKey) {
      const btn = digitToButton(e.code, e.shiftKey, true);
      if (btn) {
        e.preventDefault();
        handlers.pressButton(`btn-${String(btn).padStart(2, '0')}`);
      } else if (e.code === 'KeyE') {
        e.preventDefault();
        handlers.pressButton('edit-compare');
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        handlers.pressButton('function');
      }
      return;
    }

    const offset = KEY_TO_OFFSET.get(e.code);
    if (offset !== undefined) {
      e.preventDefault();
      if (held.has(e.code)) return;
      const note = C3 + offset;
      held.set(e.code, note);
      handlers.noteOn(note, e.shiftKey ? 127 : 64);
      return;
    }

    const btn = digitToButton(e.code, e.shiftKey, false);
    if (btn) {
      e.preventDefault();
      handlers.pressButton(`btn-${String(btn).padStart(2, '0')}`);
      return;
    }

    switch (e.code) {
      case 'Minus': e.preventDefault(); handlers.adjust(-1); break;
      case 'Equal': e.preventDefault(); handlers.adjust(+1); break;
      case 'Enter': e.preventDefault(); handlers.pressButton('yes'); break;
      case 'Backspace': e.preventDefault(); handlers.pressButton('no'); break;
      case 'ArrowUp': e.preventDefault(); handlers.pressButton('yes'); break;
      case 'ArrowDown': e.preventDefault(); handlers.pressButton('no'); break;
      case 'ArrowLeft': e.preventDefault(); handlers.navigate(-1); break;
      case 'ArrowRight': e.preventDefault(); handlers.navigate(+1); break;
      case 'Space': e.preventDefault(); handlers.repeatLast(); break;
      case 'Escape': e.preventDefault(); handlers.escape(); break;
      case 'Slash':
        if (e.shiftKey) {
          e.preventDefault();
          handlers.toggleHelp();
        }
        break;
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
