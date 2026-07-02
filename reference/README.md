# Reference materials — status

All eight reference sets from the build spec (section 17) were supplied
by the project owner as uploads (the sandbox network policy blocks the
original hosts) and live in the numbered folders here. The factory banks
`rom1a.syx` / `rom1b.syx` are additionally bundled at `src/sysex/` and
load at boot (internal / cartridge respectively).

## Verified against these references

- **Button map** (`01 .../dx7-controls.pdf` + Operation Manual): the
  EDIT map matched the implementation exactly (1-6 op on/off + EG copy,
  7 algorithm ... 32 voice name). FUNCTION map confirmed: 1 master tune,
  2 poly/mono, 3/4 pitch bend, 5-7 portamento, 8 MIDI (ch/info/xmit),
  9 edit recall, 10 voice init, 11 cartridge format, 12/13 unassigned,
  14 battery, 15/16 cartridge save/load, 17-32 controller blocks.
- **Voice-name entry** (Operation Manual): implemented as documented —
  VOICE NAME turns EDIT/COMPARE into the CHARACTER key; held CHARACTER +
  button types the button's corner character ('1'-'0', 'A'-'V', W X Y Z
  - . space on the utility buttons); NO/YES move the blinking cursor.
- **Double confirmations** (Operation Manual): edit recall, voice init,
  and the cartridge format/save/load functions ask "ARE YOU SURE ?"
  before executing. Master tune is DATA-ENTRY-slider only.
- **SysEx codec** (`03 .../sysex-format.txt`): every packed bit field,
  the 155-slot unpacked order, checksum, and header verified line by
  line; both factory ROMs parse with valid checksums and the canonical
  patch names.
- **LCD character ROM** (`05 .../HD44780.pdf`, Table 4 ROM A00): glyph
  spot checks incl. 0x5C = yen, 0x7E = right arrow, 0x7F = left arrow
  match the implementation. The katakana range 0xA0-0xFF is deliberately
  not implemented: the firmware's character set stops at 127
  (dx7-controls.pdf character list).
- **Envelope math** (`08 .../wiki/Dx7Envelope.wiki`, measured-hardware
  analysis): EG level quantization, the output-level table (0-19 lookup,
  then 28+l, 0.7526 dB units), decay rate 0.2819 * 2^(qrate/4) *
  (1 + 0.25*(qrate mod 4)) dB/s with qrate = rate*41/64, attack shape
  (decay x level-dependent factor, ~40 dB jump start), and the ~-89.9 dB
  floor are all implemented from the documented math.

## Still approximate (documented in dx7-processor.js)

Exact tables for these were not in the supplied excerpts (Shirriff parts
II-V with the EG/log-sine ROM dumps were not included; Dexed source is
present but is a validation reference only — no code or embedded tables
are copied from it, per spec 18):

- LFO speed 0-99 -> Hz and delay -> seconds curves
- pitch EG rate scaling (level mapping +/-4 octaves is manual-verified)
- pitch/amplitude mod sensitivity depth scaling
- velocity sensitivity curve, keyboard rate-scaling slope, detune cents
- peak modulation index (using the spec's 2*pi*4.6 figure)

## Remaining visual provisionals

A straight-on reference photograph of the panel is still the only item
never supplied; colors remain the spec's approximations and the
mode-cluster arrangement / NO-YES placement remain best-effort.
