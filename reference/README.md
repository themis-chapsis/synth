# Reference materials — acquisition status

The build spec (section 17) calls for fetching eight reference documents
into this directory before writing code. This session runs in a sandboxed
remote environment whose egress policy only allows a small set of package
registries and GitHub; every direct download of the reference PDFs/binaries
was refused by the proxy (HTTP 403 policy denial). Status per item:

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | DX7 Owner's/Operation Manual | **Blocked** (archive.org, manualslib, abdn.ac.uk all denied) | Panel legend + mode facts cross-checked via web-search excerpts of the manual and of chipple.net's manual transcription; see below |
| 2 | DX7 Service Manual | **Blocked** | Needed later for mechanical dimensions only |
| 3 | DX7 MIDI Data Format (SysEx spec) | **Blocked** | Required from milestone 3 (155-param model) and 9 (SysEx) |
| 4 | Ken Shirriff OPS/EGS reverse-engineering series | **Blocked** (righto.com denied) | Required for EG/level tables, milestones 5-8 |
| 5 | HD44780U datasheet (Hitachi) | **Blocked** | A00 ROM 0x20-0x7F transcribed from the well-known table in `src/display/lcdCharROM.js`; katakana range 0xA0-0xFF still to transcribe against the datasheet |
| 6 | Dexed source (validation reference only) | **Not fetched** | Session GitHub access is scoped to this repository only |
| 7 | ROM1A.syx / ROM1B.syx factory banks | **Blocked** | Required for milestone 9 |
| 8 | Raph Levien MSFA writeups | **Blocked** | DSP notes, milestones 5-8 |

**Action needed at milestone 1 review:** either relax the environment's
network policy for the sources above, or drop the files into `/reference/`
manually (plus the two `.syx` banks into `src/sysex/`), before milestones
3+ begin.

## Facts verified this session (via manual excerpts in search results)

- EDIT mode: buttons 1–6 = operator on/off (and EG COPY); edit parameters
  start at button 7 (7 = ALGORITHM, 8 = FEEDBACK, 9–14 = LFO block,
  15/16 = mod sensitivity pitch/amplitude).
- FUNCTION mode: 1 master tune, 2 poly/mono, 3/4 pitch bend range/step,
  5/6/7 portamento mode/glissando/time, 8 MIDI, 9 edit recall,
  10 voice init, 11 cartridge format, 14 battery check, 15/16 cartridge
  save/load, 17–32 = mod wheel / foot control / breath control / after
  touch × (range, pitch, amplitude, EG bias). Functions 12/13 appear
  unassigned.
- Pitch bend range 0–12, step 0–12; break point spec A(-1)…C8; EG rate
  scaling 0–7; output level 0–99. Memory protect (internal & cartridge)
  defaults ON at power-up; blocked STORE shows "MEMORY PROTECTED".

## Items marked PROVISIONAL in the panel layout (need a reference photo)

- NO/YES button position and exact silkscreen wording.
- Mode-cluster arrangement (STORE / memory protect top row; operator
  select, edit/compare, memory select, function bottom row) and colors.
- Function legends for buttons 12/13 (left blank).
- "OPERATOR ON-OFF · EG COPY" bracket wording over buttons 1–6.
- Exact silkscreen colors (currently the spec's approximations in
  `src/panel/colors.js`).
