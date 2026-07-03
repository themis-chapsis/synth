/**
 * 5-octave on-screen keyboard (performance row).
 *
 * Renders 61 keys (white first, black overlaid) and turns pointer input
 * into note on/off. Press-and-drag glides across keys (legato glissando):
 * we do NOT capture the pointer to a single key — capture would starve the
 * other keys of move events — instead each move hit-tests the key under the
 * cursor with elementFromPoint and switches the sounding note.
 *
 * `setActive(midi, on)` tints a key so the QWERTY keybed and engine can
 * light the same keys they play.
 */

import { colors } from './colors.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const WHITE_PC = new Set([0, 2, 4, 5, 7, 9, 11]);

const WHITE_FILL = '#e9e7df';
const WHITE_ACTIVE = '#7fe0cf';
const BLACK_FILL = '#171a1a';
const BLACK_ACTIVE = '#2f9f88';

export class Keyboard {
  /**
   * @param {SVGGElement} slot
   * @param {object} def keyboard geometry from panelLayout
   * @param {{noteOn:(m:number,v:number)=>void, noteOff:(m:number)=>void}} handlers
   */
  constructor(slot, def, handlers) {
    this.def = def;
    this.handlers = handlers;
    /** @type {Map<number, SVGRectElement>} */
    this.keyEls = new Map();
    this.activeCount = new Map(); // midi -> highlight refcount
    this.mouseNote = null; // note currently held by the mouse drag
    this.dragging = false;

    const mk = (tag, attrs) => {
      const n = document.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      return n;
    };

    // Build key descriptors.
    const whites = [];
    const blacks = [];
    let wi = 0;
    for (let k = 0; k < def.keys; k++) {
      const midi = def.startMidi + k;
      if (WHITE_PC.has(midi % 12)) {
        whites.push({ midi, x: def.x + wi * def.whiteW });
        wi++;
      } else {
        blacks.push({ midi, x: def.x + wi * def.whiteW - def.blackW / 2 });
      }
    }

    // Backing recess.
    slot.appendChild(mk('rect', {
      x: def.x - 4, y: def.y - 4, width: def.whiteW * whites.length + 8, height: def.whiteH + 8,
      rx: 4, fill: '#050606', stroke: '#000', 'stroke-width': 1
    }));

    const makeKey = (attrs, midi) => {
      const r = mk('rect', attrs);
      r.dataset.midi = String(midi); // used by elementFromPoint hit-testing
      r.style.cursor = 'pointer';
      r.style.touchAction = 'none';
      r.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.dragging = true;
        this.switchTo(midi);
      });
      r.addEventListener('contextmenu', (e) => e.preventDefault());
      slot.appendChild(r);
      this.keyEls.set(midi, r);
    };

    for (const w of whites) {
      makeKey({
        x: w.x + 0.5, y: def.y, width: def.whiteW - 1, height: def.whiteH,
        rx: 3, fill: WHITE_FILL, stroke: '#000', 'stroke-width': 0.8
      }, w.midi);
    }
    for (const b of blacks) {
      makeKey({
        x: b.x, y: def.y, width: def.blackW, height: def.blackH,
        rx: 2.5, fill: BLACK_FILL, stroke: '#000', 'stroke-width': 1
      }, b.midi);
    }

    // Drag across keys: hit-test the key under the cursor and switch note.
    window.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const midi = el && el.dataset && el.dataset.midi != null ? Number(el.dataset.midi) : null;
      if (midi !== this.mouseNote) this.switchTo(midi);
    });
    const end = () => {
      this.dragging = false;
      if (this.mouseNote != null) {
        this.handlers.noteOff(this.mouseNote);
        this.mouseNote = null;
      }
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  /** Move the mouse-held note to `midi` (or null = off the keys). */
  switchTo(midi) {
    if (midi === this.mouseNote) return;
    if (this.mouseNote != null) this.handlers.noteOff(this.mouseNote);
    this.mouseNote = midi;
    if (midi != null) this.handlers.noteOn(midi, 100);
  }

  /** Tint a key on/off. Refcounted so overlapping sources don't fight. */
  setActive(midi, on) {
    const r = this.keyEls.get(midi);
    if (!r) return;
    const black = !WHITE_PC.has(midi % 12);
    const count = (this.activeCount.get(midi) ?? 0) + (on ? 1 : -1);
    this.activeCount.set(midi, Math.max(0, count));
    const lit = (this.activeCount.get(midi) ?? 0) > 0;
    r.setAttribute('fill', lit ? (black ? BLACK_ACTIVE : WHITE_ACTIVE) : (black ? BLACK_FILL : WHITE_FILL));
  }
}
