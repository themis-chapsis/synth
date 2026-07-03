/**
 * Pitch-bend / modulation wheel (performance row), styled after the
 * original: a slim ribbed cylinder recessed in a panel slot, seen edge-on.
 *
 * Behaviour:
 * - kind 'bend': bipolar -1..1 with a centre detent; spring-returns to 0
 *   on release (the pitch-bend wheel is sprung).
 * - kind 'mod': unipolar 0..1 and stays where it is left.
 *
 * Look: a horizontal cylinder-shading gradient (dark edges, lit centre),
 * many fine horizontal ridges that scroll vertically as the wheel turns
 * (so it reads as rotation, not a slider), a soft vertical specular, and
 * dark caps where the wheel enters the slot.
 */

import { colors } from './colors.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const RIDGE_GAP = 6; // ridge spacing in viewBox units
const SCROLL = 46; // px the ridges travel across the value range

export class Wheel {
  /**
   * @param {SVGGElement} slot
   * @param {{id:string,kind:'bend'|'mod',x:number,y:number,w:number,h:number}} def
   * @param {(value:number)=>void} onChange
   */
  constructor(slot, def, onChange) {
    this.def = def;
    this.onChange = onChange;
    this.value = 0;
    this.dragging = false;
    this.raf = null;

    const mk = (tag, attrs, parent = slot) => {
      const n = document.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      parent.appendChild(n);
      return n;
    };

    const { x, y, w, h, id } = def;
    const defs = mk('defs', {});
    // Cylinder shading across the width (dark edges -> lit centre).
    const cyl = mk('linearGradient', { id: `cyl-${id}`, x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
    for (const [o, c] of [[0, '#050606'], [0.14, '#2a2d2d'], [0.5, '#5c6060'], [0.86, '#2a2d2d'], [1, '#050606']]) {
      mk('stop', { offset: o, 'stop-color': c }, cyl);
    }
    // Clip so the scrolling ridges stay inside the wheel body.
    const clip = mk('clipPath', { id: `clip-${id}` }, defs);
    mk('rect', { x, y, width: w, height: h, rx: 6 }, clip);

    // Panel slot / recess around the wheel.
    mk('rect', { x: x - 5, y: y - 8, width: w + 10, height: h + 16, rx: 7, fill: '#0a0b0b', stroke: '#000', 'stroke-width': 1 });

    // Wheel body.
    mk('rect', { x, y, width: w, height: h, rx: 6, fill: `url(#cyl-${id})`, stroke: '#000', 'stroke-width': 1 });

    // Scrolling ridge group (clipped to the body).
    const ridged = mk('g', { 'clip-path': `url(#clip-${id})` });
    this.ridges = mk('g', {}, ridged);
    // Draw ridges over a range taller than the body so scrolling never
    // reveals an edge.
    for (let ry = y - h; ry < y + 2 * h; ry += RIDGE_GAP) {
      mk('rect', { x: x + 1.5, y: ry, width: w - 3, height: 1, fill: '#000', opacity: 0.5 }, this.ridges);
      mk('rect', { x: x + 1.5, y: ry + 2, width: w - 3, height: 1, fill: '#ffffff', opacity: 0.07 }, this.ridges);
    }
    // Soft vertical specular down the lit centre.
    mk('rect', { x: x + w * 0.42, y, width: w * 0.16, height: h, fill: '#ffffff', opacity: 0.10 }, ridged);

    // Dark caps where the wheel curves into the slot.
    mk('rect', { x, y: y - 1, width: w, height: 12, rx: 5, fill: '#000', opacity: 0.55 });
    mk('rect', { x, y: y + h - 11, width: w, height: 12, rx: 5, fill: '#000', opacity: 0.55 });

    this.svg = slot.ownerSVGElement ?? slot.closest('svg');
    slot.style.cursor = 'ns-resize';
    slot.style.touchAction = 'none';

    const toValue = (clientY) => {
      const t = Math.min(1, Math.max(0, (this.clientToPanelY(clientY) - y) / h)); // 0 top..1 bottom
      return def.kind === 'bend' ? (0.5 - t) * 2 : (1 - t);
    };
    slot.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      slot.setPointerCapture(e.pointerId);
      this.dragging = true;
      cancelAnimationFrame(this.raf);
      this.setValue(toValue(e.clientY));
    });
    slot.addEventListener('pointermove', (e) => { if (this.dragging) this.setValue(toValue(e.clientY)); });
    const end = () => {
      if (!this.dragging) return;
      this.dragging = false;
      if (def.kind === 'bend') this.springToCenter();
    };
    slot.addEventListener('pointerup', end);
    slot.addEventListener('pointercancel', end);

    this.setValue(0, false);
  }

  clientToPanelY(clientY) {
    const inv = this.svg.getScreenCTM().inverse();
    return new DOMPoint(0, clientY).matrixTransform(inv).y;
  }

  setValue(v, notify = true) {
    this.value = v;
    // Scroll the ridges: turning the wheel up (+) rolls the surface down.
    const norm = this.def.kind === 'bend' ? v : v * 2 - 1; // -1..1
    const off = (-norm * SCROLL) % RIDGE_GAP;
    this.ridges.setAttribute('transform', `translate(0 ${off})`);
    if (notify && this.onChange) this.onChange(v);
  }

  /** Ease the bend wheel back to centre over ~130 ms. */
  springToCenter() {
    const start = this.value;
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 130);
      const eased = 1 - (1 - k) * (1 - k);
      this.setValue(start * (1 - eased));
      if (k < 1) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }
}
