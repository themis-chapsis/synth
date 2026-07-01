/**
 * Vertical linear slider (VOLUME and DATA ENTRY, spec 5.2/5.3).
 *
 * Reads absolute position — never a relative encoder. Value is normalized
 * 0.0 (bottom) to 1.0 (top). The owner decides what the value means:
 * VOLUME applies it as master gain, DATA ENTRY maps it onto the selected
 * parameter's range (wired in later milestones; milestone 1 is visual).
 */

import { colors } from './colors.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const CAP_W = 24;
const CAP_H = 14;

export class Slider {
  /**
   * @param {SVGGElement} slot
   * @param {{id:string,label:string,x:number,trackTop:number,trackBottom:number,initial:number}} def
   * @param {(value:number)=>void} [onChange]
   */
  constructor(slot, def, onChange) {
    this.def = def;
    this.onChange = onChange;
    this.value = def.initial ?? 0;

    const mk = (tag, attrs) => {
      const n = document.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      slot.appendChild(n);
      return n;
    };

    // Recessed track slot.
    mk('rect', {
      x: def.x - 4, y: def.trackTop - CAP_H / 2 - 2,
      width: 8, height: (def.trackBottom - def.trackTop) + CAP_H + 4,
      rx: 2, fill: colors.sliderTrack, stroke: '#000', 'stroke-width': 0.6
    });
    mk('rect', {
      x: def.x - 1, y: def.trackTop,
      width: 2, height: def.trackBottom - def.trackTop,
      fill: '#000'
    });

    // Ridged cap: body + horizontal grip lines + center index line.
    this.cap = document.createElementNS(SVG_NS, 'g');
    slot.appendChild(this.cap);
    const capRect = document.createElementNS(SVG_NS, 'rect');
    capRect.setAttribute('x', def.x - CAP_W / 2);
    capRect.setAttribute('y', -CAP_H / 2);
    capRect.setAttribute('width', CAP_W);
    capRect.setAttribute('height', CAP_H);
    capRect.setAttribute('rx', 2);
    capRect.setAttribute('fill', colors.sliderCap);
    capRect.setAttribute('stroke', '#000');
    capRect.setAttribute('stroke-width', 0.8);
    this.cap.appendChild(capRect);
    for (const dy of [-4.2, 4.2]) {
      const ridge = document.createElementNS(SVG_NS, 'rect');
      ridge.setAttribute('x', def.x - CAP_W / 2 + 2);
      ridge.setAttribute('y', dy - 0.5);
      ridge.setAttribute('width', CAP_W - 4);
      ridge.setAttribute('height', 1);
      ridge.setAttribute('fill', '#000');
      ridge.setAttribute('opacity', 0.35);
      this.cap.appendChild(ridge);
    }
    const index = document.createElementNS(SVG_NS, 'rect');
    index.setAttribute('x', def.x - CAP_W / 2 + 1.5);
    index.setAttribute('y', -0.8);
    index.setAttribute('width', CAP_W - 3);
    index.setAttribute('height', 1.6);
    index.setAttribute('fill', '#f2f0ea');
    this.cap.appendChild(index);

    this.cap.style.cursor = 'ns-resize';
    this.svg = slot.ownerSVGElement ?? slot.closest('svg');

    const drag = (e) => {
      const pt = this.clientToPanelY(e.clientY);
      const { trackTop, trackBottom } = this.def;
      const v = 1 - (pt - trackTop) / (trackBottom - trackTop);
      this.setValue(Math.min(1, Math.max(0, v)), true);
    };
    this.cap.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.cap.setPointerCapture(e.pointerId);
      this.dragging = true;
      drag(e);
    });
    this.cap.addEventListener('pointermove', (e) => { if (this.dragging) drag(e); });
    const end = () => { this.dragging = false; };
    this.cap.addEventListener('pointerup', end);
    this.cap.addEventListener('pointercancel', end);

    this.setValue(this.value, false);
  }

  /** Convert a clientY to panel viewBox Y via the SVG's screen CTM. */
  clientToPanelY(clientY) {
    const svg = this.svg;
    const pt = new DOMPoint(0, clientY);
    const inv = svg.getScreenCTM().inverse();
    return pt.matrixTransform(inv).y;
  }

  setValue(v, notify = true) {
    this.value = v;
    const { trackTop, trackBottom } = this.def;
    const y = trackBottom - v * (trackBottom - trackTop);
    this.cap.setAttribute('transform', `translate(0 ${y})`);
    if (notify && this.onChange) this.onChange(v);
  }
}
