/**
 * Internal (32) + cartridge (32) patch banks. Slots hold 155-value voice
 * buffers (voiceParams dump order) or null for an uninitialized slot,
 * which loads as INIT VOICE. ROM1A fills the internal bank at boot once
 * the SysEx loader lands (milestone 9).
 */
export function createBanks() {
  return {
    internal: new Array(32).fill(null),
    cartridge: new Array(32).fill(null)
  };
}
