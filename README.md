# FM6 Panel

A study project: a pixel-accurate, browser-based replica of the control
panel of a classic 1983 6-operator FM synthesizer, wired to a custom FM
sound engine built on the Web Audio API (AudioWorklet). No frameworks, no
prebuilt synth libraries.

Status: **all 12 build milestones implemented.** The panel (full mode
state machine, mode-accurate LCD/LED, complete 155-parameter voice model
with live editing, store/compare flows, function parameters, voice-name
editing) drives a 6-operator phase-modulation engine with all 32
algorithms, per-operator envelopes with keyboard level/rate scaling,
feedback, LFO (6 waveforms with delay/fade), and pitch EG.
Parameter-to-engine latency measures ~21 ms. 32-voice SysEx banks load
at boot (`public/rom1a.syx`) or by dropping a `.syx` file on the page
("cartridge"). MIDI in/out is stubbed, not implemented, per the spec's
scope.

Open fidelity items (all documented in `reference/README.md`): several
DSP curves (EG timing, LFO speed, mod index, scaling slopes) are
provisional constants pending the network-blocked reference tables, the
factory ROM banks must be supplied as files, and a handful of silkscreen
details await a reference photograph. `npm test` runs the 106-test unit
suite; `node scripts/audiocheck.mjs` (against `npm run preview`) runs
the headless audio verification.

## Controls

Press `?` in the app for the full keyboard reference: A-; play C3-E4
(W E T Y U O P for sharps, Shift for velocity 127), digits press the
numbered buttons (Shift +10, Alt +20, Alt+Shift+1/2 = 31/32),
Enter/Backspace and the up/down arrows are YES/NO, left/right arrows
step parameters, `-`/`=` nudge data entry, Alt+E toggles EDIT/COMPARE,
Alt+F FUNCTION, Space repeats the last button, Escape returns to PLAY.

## Running

```sh
npm install
npm run dev        # dev server
npm run build      # static build into dist/
npm run preview    # serve the build
npm run screenshot # headless render check (needs a running preview)
```

Everything ships as static files; any static host works.

## Layout

- `src/panel/` — SVG panel, sliders, membrane buttons, LCD and LED
  renderers. Geometry and silkscreen text live in `panelLayout.js`;
  palette in `colors.js`.
- `src/display/` — HD44780-A00 character ROM, 7-segment glyphs, LCD text
  formatting (formatting arrives with the state machine).
- `src/state/` — central store/event bus, panel mode state machine, the
  per-mode button routing tables, voice/function parameter models.
- `src/engine/` — AudioWorklet FM engine (later milestones).
- `src/sysex/` — voice bulk-dump codec and factory banks (later
  milestones).

The panel draws in a fixed 1920x200 viewBox and scales uniformly to the
page width. LCD and LED are canvases mounted into SVG slots via
foreignObject, so they scale with the artwork while keeping their own
pixel grids.
