# FM6 Panel

A study project: a pixel-accurate, browser-based replica of the control
panel of a classic 1983 6-operator FM synthesizer, wired to a custom FM
sound engine built on the Web Audio API (AudioWorklet). No frameworks, no
prebuilt synth libraries.

Status: **milestones 6-7** — full mode state machine with mode-accurate
LCD/LED, the complete 155-parameter voice model with live editing, and
4-stage rate/level envelope, with the QWERTY keybed (A-; from C3, shift
for velocity), VOLUME gain, and <20 ms parameter-to-engine latency.
Full 6-operator FM (algorithms, LFO, pitch EG) lands in milestones 6-8.
See `reference/README.md` for reference-material status and items
pending verification. `npm test` runs the unit suite;
`node scripts/audiocheck.mjs` runs the headless audio checks.

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
