/**
 * Bootstrap: renders the panel SVG, mounts the interactive components into
 * their slots, and connects them to the store. Audio wiring starts in
 * milestone 4 (the VOLUME slider's gain target does not exist yet).
 */

import { applyColors } from './panel/colors.js';
import { renderPanel, finalizeSilkscreen } from './panel/Panel.js';
import { MembraneButton } from './panel/MembraneButton.js';
import { Slider } from './panel/Slider.js';
import { LCD } from './panel/LCD.js';
import { SevenSegment } from './panel/SevenSegment.js';
import { sliders, modeButtons, numberedButtons, display } from './panel/panelLayout.js';
import { store } from './state/store.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XHTML_NS = 'http://www.w3.org/1999/xhtml';

/** Mount an HTML host (for a canvas component) inside an SVG slot. */
function htmlHost(slot, { x, y, w, h }) {
  const fo = document.createElementNS(SVG_NS, 'foreignObject');
  fo.setAttribute('x', x);
  fo.setAttribute('y', y);
  fo.setAttribute('width', w);
  fo.setAttribute('height', h);
  const div = document.createElementNS(XHTML_NS, 'div');
  div.style.width = '100%';
  div.style.height = '100%';
  fo.appendChild(div);
  slot.appendChild(fo);
  return div;
}

function boot() {
  applyColors();

  const app = document.getElementById('app');
  const { svg, slots } = renderPanel();
  app.appendChild(svg);
  finalizeSilkscreen(svg);
  document.fonts.ready.then(() => finalizeSilkscreen(svg));

  for (const def of sliders) {
    new Slider(slots.get(def.id), def, (v) => {
      // VOLUME feeds the master gain node from milestone 4 on;
      // DATA ENTRY feeds the selected parameter from milestone 3 on.
      console.debug(`[slider] ${def.id} = ${v.toFixed(3)}`);
    });
  }
  for (const def of modeButtons) new MembraneButton(slots.get(def.id), def);
  for (const def of numberedButtons) new MembraneButton(slots.get(def.id), def);

  const lcd = new LCD(htmlHost(slots.get('lcd'), display.lcd));
  const led = new SevenSegment(htmlHost(slots.get('led'), display.led), 2);

  const syncDisplays = (state) => {
    lcd.setText(state.lcd[0], state.lcd[1]);
    led.setText(state.led);
    led.setBlinking(state.ledBlinking);
  };
  store.subscribe(syncDisplays);
  syncDisplays(store.getState());
}

boot();
