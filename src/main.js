/**
 * Bootstrap: renders the panel SVG, mounts the interactive components into
 * their slots, and connects them to the store. Audio wiring starts in
 * milestone 4 (the VOLUME slider's gain target does not exist yet).
 */

import { applyColors } from './panel/colors.js';
import { renderPanel, finalizeSilkscreen } from './panel/Panel.js';
import { MembraneButton } from './panel/MembraneButton.js';
import { Slider } from './panel/Slider.js';
import { Wheel } from './panel/Wheel.js';
import { Keyboard } from './panel/Keyboard.js';
import { LCD } from './panel/LCD.js';
import { SevenSegment } from './panel/SevenSegment.js';
import { sliders, modeButtons, numberedButtons, display, wheels, keyboard } from './panel/panelLayout.js';
import { store } from './state/store.js';
import { createEngine } from './engine/audio-worklet.js';
import { installKeyboardMap, bindingHelp } from './panel/keyboardMap.js';
import { parseBulkDump } from './sysex/dx7-sysex.js';

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

  // Performance controllers: wheel positions pushed to the engine, and
  // re-pushed when the engine boots or the FUNCTION-mode routing changes.
  let onscreenKeyboard = null;
  let bendValue = 0;
  let modValue = 0;
  const pushBend = () => engine?.setPitchBend(bendValue, store.getState().funcValues.pitchBendRange);
  const pushMod = () => engine?.setModWheel(modValue);
  const pushRouting = () => {
    const f = store.getState().funcValues;
    engine?.setModRouting({ range: f.modWheelRange, pitch: f.modWheelPitch, amp: f.modWheelAmp });
  };

  const ensureEngine = () => {
    enginePromise ??= createEngine(volume).then((e) => {
      engine = e;
      syncVoice();
      pushRouting();
      pushBend();
      pushMod();
      return e;
    });
    return enginePromise;
  };
  window.addEventListener('pointerdown', ensureEngine, { once: true });
  window.addEventListener('keydown', ensureEngine, { once: true });

  // Central note gateway: drives the engine and lights the on-screen key,
  // so QWERTY, the mouse keyboard, and the engine all share one path.
  const noteOn = (midi, velocity) => {
    ensureEngine().then((e) => e.noteOn(midi, velocity));
    onscreenKeyboard?.setActive(midi, true);
  };
  const noteOff = (midi) => {
    ensureEngine().then((e) => e.noteOff(midi));
    onscreenKeyboard?.setActive(midi, false);
  };

  // `?` help overlay listing every binding (spec 12.2).
  const help = document.createElement('div');
  help.className = 'help-overlay';
  help.hidden = true;
  help.innerHTML =
    '<h2>Keyboard bindings</h2><table>' +
    bindingHelp.map(([k, d]) => `<tr><td>${k}</td><td>${d}</td></tr>`).join('') +
    '</table>';
  document.body.appendChild(help);

  // Keyboard shortcuts press the same buttons pointers do, with a brief
  // visual flash on the panel.
  const pressButton = (id) => {
    store.dispatch({ type: 'panelButtonPressed', id });
    const btn = buttons.get(id);
    if (btn) {
      btn.setPressed(true);
      setTimeout(() => btn.setPressed(false), 100);
    }
  };

  installKeyboardMap({
    noteOn,
    noteOff,
    adjust: (delta) => store.dispatch({ type: 'adjustParam', delta }),
    pressButton,
    navigate: (delta) => store.dispatch({ type: 'navigateParam', delta }),
    escape: () => store.dispatch({ type: 'escape' }),
    repeatLast: () => {
      const last = store.getState().lastButton;
      if (last) pressButton(last);
    },
    toggleHelp: () => { help.hidden = !help.hidden; }
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

  // Performance row: pitch-bend + modulation wheels, then the keyboard.
  for (const def of wheels) {
    new Wheel(slots.get(def.id), def, (v) => {
      if (def.kind === 'bend') { bendValue = v; ensureEngine().then(pushBend); }
      else { modValue = v; ensureEngine().then(pushMod); }
    });
  }
  onscreenKeyboard = new Keyboard(slots.get('keyboard'), keyboard, { noteOn, noteOff });

  /** @type {Map<string, MembraneButton>} */
  const buttons = new Map();
  for (const def of modeButtons) buttons.set(def.id, new MembraneButton(slots.get(def.id), def));
  for (const def of numberedButtons) buttons.set(def.id, new MembraneButton(slots.get(def.id), def));

  const lcd = new LCD(htmlHost(slots.get('lcd'), display.lcd));
  const led = new SevenSegment(htmlHost(slots.get('led'), display.led), 2);

  let cursorKey = null;
  const sync = (state) => {
    lcd.setText(state.lcd[0], state.lcd[1]);
    led.setText(state.led);
    led.setBlinking(state.ledBlinking);
    // Blinking cursor during voice-name edit (spec 8.3).
    const nameEditing = state.mode === 'EDIT' && state.editParam === 32 && !state.notice;
    const key = nameEditing ? `1:${6 + state.nameCursor}` : null;
    if (key !== cursorKey) {
      cursorKey = key;
      lcd.setCursor(nameEditing ? { row: 1, col: 6 + state.nameCursor } : null);
    }
    // Active-bank and protect indicators (spec 5.5/5.6).
    buttons.get('mem-select-int').setLit(state.bank === 'internal');
    buttons.get('mem-select-crt').setLit(state.bank === 'cartridge');
    buttons.get('mem-protect-int').setLit(state.memoryProtect.internal);
    buttons.get('mem-protect-crt').setLit(state.memoryProtect.cartridge);
    // Keep the engine's controller routing in step with FUNCTION-mode
    // edits (pitch-bend range, mod-wheel range/assign).
    pushRouting();
    pushBend();
  };
  store.subscribe(sync);
  sync(store.getState());

  // SysEx banks (spec 11): the bundled factory ROM1A loads into the
  // internal bank at boot, ROM1B starts in the cartridge slot. At
  // runtime, dropping any 32-voice .syx file on the page replaces the
  // cartridge (spec 2: single loadable SysEx file as "cartridge").
  const loadSysex = (buffer, bank, silent = false) => {
    const { voices } = parseBulkDump(new Uint8Array(buffer));
    store.dispatch({ type: 'loadBank', bank, voices, silent });
  };
  // The standalone single-file build inlines the two factory banks as
  // base64 (window.__DX7_BANKS__) so nothing is fetched; normal builds
  // fetch the emitted .syx assets.
  const inlineBanks = globalThis.__DX7_BANKS__;
  const b64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const bootBank = (source, bank) => {
    if (inlineBanks) {
      loadSysex(b64ToBytes(inlineBanks[bank]).buffer, bank, true);
      return Promise.resolve();
    }
    return fetch(source)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((buf) => buf && loadSysex(buf, bank, true))
      .catch((err) => console.error('[sysex] boot bank failed:', err));
  };
  bootBank(new URL('./sysex/rom1a.syx', import.meta.url), 'internal')
    .then(() => bootBank(new URL('./sysex/rom1b.syx', import.meta.url), 'cartridge'));
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    try {
      loadSysex(await file.arrayBuffer(), 'cartridge');
    } catch (err) {
      store.dispatch({ type: 'lcdNotice', rows: [' BAD SYSEX FILE', ''] });
      console.error('[sysex]', err);
    }
  });

  // Debug/testing handle (used by the headless interaction checks).
  window.__fm6 = { store, ensureEngine, loadSysex, get engine() { return engine; } };
}

boot();
