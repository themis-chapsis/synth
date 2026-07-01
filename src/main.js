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
import { createEngine } from './engine/audio-worklet.js';
import { installKeyboardMap } from './panel/keyboardMap.js';

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

  // Audio starts lazily on the first user gesture (browser autoplay
  // policy); until then VOLUME just remembers its position.
  let engine = null;
  let enginePromise = null;
  let volume = sliders.find((s) => s.id === 'volume').initial;

  // Voice parameter sync to the worklet, batched to one message per
  // frame (spec 13: <=60 Hz, <20 ms parameter latency).
  let syncQueued = false;
  const syncVoice = () => {
    if (!engine || syncQueued) return;
    syncQueued = true;
    setTimeout(() => {
      syncQueued = false;
      const s = store.getState();
      engine.node.port.postMessage({
        type: 'voice',
        data: s.voice.slice(),
        opOnOff: s.opOnOff.slice()
      });
    }, 16);
  };

  const ensureEngine = () => {
    enginePromise ??= createEngine(volume).then((e) => {
      engine = e;
      syncVoice();
      return e;
    });
    return enginePromise;
  };
  window.addEventListener('pointerdown', ensureEngine, { once: true });
  window.addEventListener('keydown', ensureEngine, { once: true });

  installKeyboardMap({
    noteOn: (note, velocity) => ensureEngine().then((e) => e.noteOn(note, velocity)),
    noteOff: (note) => ensureEngine().then((e) => e.noteOff(note)),
    adjust: (delta) => store.dispatch({ type: 'adjustParam', delta })
  });
  store.subscribe(syncVoice);

  for (const def of sliders) {
    new Slider(slots.get(def.id), def, (v) => {
      if (def.id === 'data-entry') {
        store.dispatch({ type: 'dataEntry', value: v });
      } else {
        volume = v;
        engine?.setVolume(v);
      }
    });
  }

  /** @type {Map<string, MembraneButton>} */
  const buttons = new Map();
  for (const def of modeButtons) buttons.set(def.id, new MembraneButton(slots.get(def.id), def));
  for (const def of numberedButtons) buttons.set(def.id, new MembraneButton(slots.get(def.id), def));

  const lcd = new LCD(htmlHost(slots.get('lcd'), display.lcd));
  const led = new SevenSegment(htmlHost(slots.get('led'), display.led), 2);

  const sync = (state) => {
    lcd.setText(state.lcd[0], state.lcd[1]);
    led.setText(state.led);
    led.setBlinking(state.ledBlinking);
    // Active-bank and protect indicators (spec 5.5/5.6).
    buttons.get('mem-select-int').setLit(state.bank === 'internal');
    buttons.get('mem-select-crt').setLit(state.bank === 'cartridge');
    buttons.get('mem-protect-int').setLit(state.memoryProtect.internal);
    buttons.get('mem-protect-crt').setLit(state.memoryProtect.cartridge);
  };
  store.subscribe(sync);
  sync(store.getState());

  // Debug/testing handle (used by the headless interaction checks).
  window.__fm6 = { store, ensureEngine, get engine() { return engine; } };
}

boot();
