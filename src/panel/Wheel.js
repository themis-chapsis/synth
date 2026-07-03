/**
 * Pitch-bend / modulation wheel (performance row).
 *
 * A vertical thumb wheel: drag up/down to change value. Two behaviors:
 * - kind 'bend': value is bipolar -1..1 with a centre detent; the wheel
 *   spring-returns to 0 on release (the pitch-bend wheel is sprung).
 * - kind 'mod': value is unipolar 0..1 and stays where it is left.
 *
 * Rendered as a cylinder (vertical gradient + ridges) inside a recessed
 * slot, with a bright indicator that tracks the value.
 */

import { colors } from './colors.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class Wheel {
  /**
   * @param {SVGGElement} slot
   * @param {{id:string,kind:'bend'|'mod',x:number,y:number,w:number,h:number}} def
   * @param {(value:number)=>void} onChange
   */
  constructor(slot, def, onChange) {
    this.def = def;
    this.onChange = onChange;
    this.value = 0; // bend: -1..1, mod: 0..1
    this.dragging = false;
    this.raf = null;

    const mk = (tag, attrs, parent = slot) => {
      const n = document.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      parent.appendChild(n);
      return n;
    };

    const defs = mk('defs', {});
    const gid = `wheel-grad-${def.id}`;
    const grad = mk('linearGradient', { id: gid, x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
    for (const [off, col] of [[0, '#0a0b0b'], [0.16, '#3a3d3d'], [0.5, '#6b6f6f'], [0.84, '#3a3d3d'], [1, '#0a0b0b']]) {
      mk('stop', { offset: off, 'stop-color': col }, grad);
    }

    // Recessed slot.
    mk('rect', {
      x: def.x - 3, y: def.y - 3, width: def.w + 6, height: def.h + 6, rx: 8,
      fill: colors.sliderTrack, stroke: '#000', 'stroke-width': 1
    });
    // Cylinder body.
    mk('rect', {
      x: def.x, y: def.y, width: def.w, height: def.h, rx: 7,
      fill: `url(#${gid})`, stroke: '#000', 'stroke-width': 0.8
    });
    // Horizontal grip ridges.
    for (let i = 1; i < 22; i++) {
      const yy = def.y + (i / 22) * def.h;
      mk('rect', { x: def.x + 2, y: yy, width: def.w - 4, height: 0.8, fill: '#000', opacity: 0.28 });
    }
    // Centre detent marker for the bend wheel.
    if (def.kind === 'bend') {
      mk('rect', { x: def.x - 5, y: def.y + def.h / 2 - 1, width: 4, height: 2, fill: colors.silkscreenWhite, opacity: 0.7 });
    }

    // Moving indicator band.
    this.indicator = mk('rect', {
      x: def.x + 1.5, width: def.w - 3, height: 6, rx: 2,
      fill: def.kind === 'bend' ? '#c66a5a' : '#d4a24a', opacity: 0.95
    });

    this.svg = slot.ownerSVGElement ?? slot.closest('svg');
    slot.style.cursor = 'ns-resize';
    slot.style.touchAction = 'none';

    const toValue = (clientY) => {
      const top = def.y;
      const bot = def.y + def.h;
      const py = this.clientToPanelY(clientY);
      const t = Math.min(1, Math.max(0, (py - top) / (bot - top))); // 0 top .. 1 bottom
      return def.kind === 'bend' ? (0.5 - t) * 2 : (1 - t);
    };

    slot.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      slot.setPointerCapture(e.pointerId);
      this.dragging = true;
      cancelAnimationFrame(this.raf);
      this.setValue(toValue(e.clientY));
    });
    slot.addEventListener('pointermove', (e) => {
      if (this.dragging) this.setValue(toValue(e.clientY));
    });
    const end = () => {
      if (!this.dragging) return;
      this.dragging = false;
      if (def.kind === 'bend') this.springToCenter();
    };
    slot.addEventListener('pointerup', end);
    slot.addEventListener('pointercancel', end);

    this.setValue(0);
  }

  clientToPanelY(clientY) {
    const inv = this.svg.getScreenCTM().inverse();
    return new DOMPoint(0, clientY).matrixTransform(inv).y;
  }

  setValue(v, notify = true) {
    this.value = v;
    const { x, y, w, h, kind } = this.def;
    // Indicator y: value 1 -> top, value -1/0 bottom.
    const t = kind === 'bend' ? (0.5 - v / 2) : (1 - v);
    this.indicator.setAttribute('y', y + t * (h - 6));
    if (notify && this.onChange) this.onChange(v);
  }

  /** Ease the bend wheel back to centre over ~120 ms. */
  springToCenter() {
    const start = this.value;
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 120);
      const eased = 1 - (1 - k) * (1 - k);
      this.setValue(start * (1 - eased));
      if (k < 1) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }
}
