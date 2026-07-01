/**
 * Voice bulk-dump SysEx codec (spec section 11): parse/emit the 32-voice
 * packed format (F0 43 0n 09 20 00 ... checksum F7), 128 packed bytes per
 * voice <-> 155-byte unpacked voice. Milestone 9 deliverable, unit-tested
 * round-trip. Factory bank .syx files also land here (rom1a/rom1b) once
 * obtainable — downloads blocked by network policy this session.
 */
export function parseBulkDump() { throw new Error('sysex lands in milestone 9'); }
