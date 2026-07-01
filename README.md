# FM6 Panel

A study project: a pixel-accurate, browser-based replica of the control
panel of a classic 1983 6-operator FM synthesizer, wired to a custom FM
sound engine built on the Web Audio API (AudioWorklet). No frameworks, no
prebuilt synth libraries.

Status: **milestone 3** — the full mode state machine (PLAY / EDIT /
COMPARE / FUNCTION / STORE) drives mode-accurate LCD/LED content, and the
complete 155-parameter voice model is live: NO/YES step and DATA ENTRY
absolutely positions the selected parameter, COMPARE shows the unedited
voice, STORE writes to the banks. No sound yet; audio starts in
milestone 4. See `reference/README.md` for reference-material status and
items pending verification. Run the tests with `npm test`.

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
