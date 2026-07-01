/**
 * Internal (32) + cartridge (32) patch banks. ROM1A loads into the internal
 * bank at boot once the SysEx loader lands (milestone 9).
 */
export const banks = { internal: new Array(32).fill(null), cartridge: new Array(32).fill(null) };
