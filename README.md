# FM6 Panel

A study project: a pixel-accurate, browser-based replica of the control
panel of a classic 1983 6-operator FM synthesizer, wired to a custom FM
sound engine built on the Web Audio API (AudioWorklet). No frameworks, no
prebuilt synth libraries.

Status: **milestone 1** — the visual panel shell renders (sliders, all
membrane buttons with three-color silkscreen, character-ROM-accurate 16x2
LCD showing `READY`, 2-digit 7-segment LED). No sound yet; the state
machine, parameter model, and FM engine land in later milestones. See
`reference/README.md` for reference-material status and items pending
verification.

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
