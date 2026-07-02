/**
 * Flat membrane button (spec 5.1).
 *
 * Exactly two visual states: idle and pressed (lighter fill + inset shadow).
 * No travel animation. Pressed state lingers 60 ms after pointer release to
 * match the spec's visual latency. Dispatches panelButtonPressed(id) to the
 * store on pointerdown.
 *
 * Extras used by specific buttons:
 * - `def.autoRepeat` (NO/YES, spec 5.4): hold 500 ms, then repeat at 20 Hz.
 *   Repeats dispatch 'panelButtonRepeat' so the store can route them only
 *   where repeating is meaningful (parameter stepping, not store confirm).
 * - `setLit()` (memory select/protect, spec 5.5): persistent active look.
 */

import { colors } from './colors.js';
import { store } from '../state/store.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const FILLS = {
  cyan: [colors.buttonCyan, colors.buttonCyanPressed],
  blueLight: [colors.buttonBlueLight, colors.buttonBlueLightPressed],
  orange: [colors.buttonOrange, colors.buttonOrangePressed],
  cream: [colors.buttonCream, colors.buttonCreamPressed],
  yellow: [colors.buttonYellow, colors.buttonYellowPressed]
};

const RELEASE_LATENCY_MS = 60;
const REPEAT_DELAY_MS = 500;
const REPEAT_INTERVAL_MS = 50; // 20 Hz

export class MembraneButton {
  /**
   * @param {SVGGElement} slot mount point from Panel.renderPanel()
   * @param {{id:string,x:number,y:number,w:number,h:number,color:string,number?:number,autoRepeat?:boolean}} def
   */
  constructor(slot, def) {
    this.def = def;
    this.lit = false;
    const [idle] = FILLS[def.color] ?? FILLS.cyan;

    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', def.x);
    rect.setAttribute('y', def.y);
    rect.setAttribute('width', def.w);
    rect.setAttribute('height', def.h);
    rect.setAttribute('rx', 2.5);
    rect.setAttribute('fill', idle);
    rect.setAttribute('stroke', '#000');
    rect.setAttribute('stroke-width', 0.8);
    slot.appendChild(rect);

    // Membrane sheen: brighter top edge, darker bottom edge.
    const sheen = document.createElementNS(SVG_NS, 'rect');
    sheen.setAttribute('x', def.x + 1.5);
    sheen.setAttribute('y', def.y + 1.5);
    sheen.setAttribute('width', def.w - 3);
    sheen.setAttribute('height', def.h - 3);
    sheen.setAttribute('rx', 1.8);
    sheen.setAttribute('fill', 'none');
    sheen.setAttribute('stroke', '#ffffff');
    sheen.setAttribute('stroke-opacity', 0.28);
    sheen.setAttribute('stroke-width', 0.7);
    slot.appendChild(sheen);

    // Legend type scales with the button so it reads at any panel size.
    const charSize = Math.max(6, Math.round(def.h * 0.18));
    const numSize = Math.round(def.h * 0.38);

    if (def.char) {
      // Voice-name character legend in the button corner (manual:
      // "reversed dark brown type in the right corner of most buttons").
      const ch = document.createElementNS(SVG_NS, 'text');
      ch.setAttribute('x', def.x + def.w - charSize * 0.6);
      ch.setAttribute('y', def.y + charSize + 2);
      ch.setAttribute('text-anchor', 'end');
      ch.setAttribute('font-family', "'Barlow Condensed', 'Arial Narrow', sans-serif");
      ch.setAttribute('font-size', charSize);
      ch.setAttribute('font-weight', 600);
      ch.setAttribute('fill', '#31241a');
      ch.textContent = def.char;
      ch.style.pointerEvents = 'none';
      slot.appendChild(ch);
    }

    if (def.number != null) {
      const num = document.createElementNS(SVG_NS, 'text');
      num.setAttribute('x', def.x + def.w / 2);
      num.setAttribute('y', def.y + def.h / 2 + numSize * 0.36);
      num.setAttribute('text-anchor', 'middle');
      num.setAttribute('font-family', "'Barlow Condensed', 'Arial Narrow', sans-serif");
      num.setAttribute('font-size', numSize);
      num.setAttribute('font-weight', 600);
      // Spec section 2: white middle label (the number) on the cyan button.
      num.setAttribute('fill', '#f4f6f6');
      num.textContent = String(def.number);
      num.style.pointerEvents = 'none';
      slot.appendChild(num);
    }

    this.rect = rect;
    this.releaseTimer = null;
    this.repeatDelayTimer = null;
    this.repeatTimer = null;

    // Pointer events cover mouse and touch (spec 5.1).
    rect.style.cursor = 'pointer';
    rect.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      rect.setPointerCapture(e.pointerId);
      this.setPressed(true);
      store.dispatch({ type: 'panelButtonPressed', id: def.id });
      if (def.autoRepeat) {
        this.repeatDelayTimer = setTimeout(() => {
          this.repeatTimer = setInterval(() => {
            store.dispatch({ type: 'panelButtonRepeat', id: def.id });
          }, REPEAT_INTERVAL_MS);
        }, REPEAT_DELAY_MS);
      }
    });
    const release = () => {
      clearTimeout(this.releaseTimer);
      clearTimeout(this.repeatDelayTimer);
      clearInterval(this.repeatTimer);
      this.releaseTimer = setTimeout(() => this.setPressed(false), RELEASE_LATENCY_MS);
      store.dispatch({ type: 'panelButtonReleased', id: def.id });
    };
    rect.addEventListener('pointerup', release);
    rect.addEventListener('pointercancel', release);
    rect.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setPressed(pressed) {
    const [idle, active] = FILLS[this.def.color] ?? FILLS.cyan;
    this.rect.setAttribute('fill', pressed || this.lit ? active : idle);
    // Inset shadow look: swap the outline weight while pressed.
    this.rect.setAttribute('stroke-width', pressed ? 1.6 : 0.8);
  }

  /** Persistent "active" look for bank/protect selectors (spec 5.5/5.6). */
  setLit(lit) {
    this.lit = lit;
    const [idle, active] = FILLS[this.def.color] ?? FILLS.cyan;
    this.rect.setAttribute('fill', lit ? active : idle);
    this.rect.setAttribute('stroke', lit ? '#f4f6f6' : '#000');
  }
}
