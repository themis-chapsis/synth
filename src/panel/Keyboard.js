/**
 * 5-octave on-screen keyboard (performance row).
 *
 * Renders 61 keys (white first, black overlaid) and turns pointer input
 * into note on/off. Dragging across keys glides (legato glissando).
 * `setActive(midi, on)` tints a key so the QWERTY keybed and engine can
 * light the same keys they play.
 */

import { colors } from './colors.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const WHITE_PC = new Set([0, 2, 4, 5, 7, 9, 11]);

const WHITE_FILL = '#e9e7df';
const WHITE_ACTIVE = '#8fd2de';
const BLACK_FILL = '#171a1a';
const BLACK_ACTIVE = '#3f8fa0';

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

    const bind = (rect, midi) => {
      rect.style.cursor = 'pointer';
      rect.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        rect.setPointerCapture(e.pointerId);
        this.mouseNote = midi;
        this.handlers.noteOn(midi, 100);
      });
      // Glissando: entering a key while the mouse is held moves the note.
      rect.addEventListener('pointerenter', (e) => {
        if (this.mouseNote == null || !(e.buttons & 1)) return;
        if (this.mouseNote !== midi) {
          this.handlers.noteOff(this.mouseNote);
          this.mouseNote = midi;
          this.handlers.noteOn(midi, 100);
        }
      });
      rect.addEventListener('contextmenu', (e) => e.preventDefault());
    };

    for (const w of whites) {
      const r = mk('rect', {
        x: w.x + 0.5, y: def.y, width: def.whiteW - 1, height: def.whiteH,
        rx: 3, fill: WHITE_FILL, stroke: '#000', 'stroke-width': 0.8
      });
      slot.appendChild(r);
      this.keyEls.set(w.midi, r);
      bind(r, w.midi);
    }
    for (const b of blacks) {
      const r = mk('rect', {
        x: b.x, y: def.y, width: def.blackW, height: def.blackH,
        rx: 2.5, fill: BLACK_FILL, stroke: '#000', 'stroke-width': 1
      });
      slot.appendChild(r);
      this.keyEls.set(b.midi, r);
      bind(r, b.midi);
    }

    // Releasing anywhere ends the mouse-held note.
    const release = () => {
      if (this.mouseNote != null) {
        this.handlers.noteOff(this.mouseNote);
        this.mouseNote = null;
      }
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
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
