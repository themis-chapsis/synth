/**
 * Global function parameters (spec sections 6/7): master tune, poly/mono,
 * pitch bend, portamento, MIDI, and the four controller assignment blocks.
 *
 * Value-less entries (edit recall, voice init, cartridge ops, battery)
 * are confirm/status displays; their behavior lands in milestone 11.
 * Display strings are best-effort pending the blocked manual (flagged in
 * /reference/README.md).
 */

const num = (v) => String(v);
const onOff = (v) => (v ? 'ON' : 'OFF');

/** keyed by the `param` names used in buttonMap.functionMap */
export const functionParamDefs = {
  masterTune: {
    name: 'MASTER TUNE ADJ',
    range: [0, 127],
    default: 64,
    // Manual: adjusted with the DATA ENTRY slider only; the -1/+1
    // buttons are not used for this parameter.
    sliderOnly: true,
    display: (v) => (v - 64 > 0 ? `+${v - 64}` : String(v - 64))
  },
  polyMono: { name: 'POLY/MONO', range: [0, 1], default: 0, display: (v) => (v ? 'MONO' : 'POLY') },
  pitchBendRange: { name: 'P BEND RANGE', range: [0, 12], default: 2, display: num },
  pitchBendStep: { name: 'P BEND STEP', range: [0, 12], default: 0, display: num },
  portamentoMode: { name: 'PORTA MODE', range: [0, 1], default: 0, display: (v) => (v ? 'FOLLOW' : 'RETAIN') },
  portamentoGliss: { name: 'PORTA GLISSANDO', range: [0, 1], default: 0, display: onOff },
  portamentoTime: { name: 'PORTA TIME', range: [0, 99], default: 0, display: num },
  midiCh: { name: 'MIDI CH', range: [0, 15], default: 0, display: (v) => String(v + 1) },
  sysInfo: { name: 'SYS INFO', range: [0, 1], default: 1, display: (v) => (v ? 'AVAIL' : 'UNAVAIL') },

  modWheelRange: { name: 'WHEEL RANGE', range: [0, 99], default: 99, display: num },
  modWheelPitch: { name: 'WHEEL PITCH', range: [0, 1], default: 1, display: onOff },
  modWheelAmp: { name: 'WHEEL AMP', range: [0, 1], default: 0, display: onOff },
  modWheelEgBias: { name: 'WHEEL EG B.', range: [0, 1], default: 0, display: onOff },
  footRange: { name: 'FOOT RANGE', range: [0, 99], default: 0, display: num },
  footPitch: { name: 'FOOT PITCH', range: [0, 1], default: 0, display: onOff },
  footAmp: { name: 'FOOT AMP', range: [0, 1], default: 0, display: onOff },
  footEgBias: { name: 'FOOT EG B.', range: [0, 1], default: 0, display: onOff },
  breathRange: { name: 'BREATH RANGE', range: [0, 99], default: 0, display: num },
  breathPitch: { name: 'BREATH PITCH', range: [0, 1], default: 0, display: onOff },
  breathAmp: { name: 'BREATH AMP', range: [0, 1], default: 0, display: onOff },
  breathEgBias: { name: 'BREATH EG B.', range: [0, 1], default: 0, display: onOff },
  afterTouchRange: { name: 'AFTER RANGE', range: [0, 99], default: 0, display: num },
  afterTouchPitch: { name: 'AFTER PITCH', range: [0, 1], default: 0, display: onOff },
  afterTouchAmp: { name: 'AFTER AMP', range: [0, 1], default: 0, display: onOff },
  afterTouchEgBias: { name: 'AFTER EG B.', range: [0, 1], default: 0, display: onOff }
};

/** @returns {Object<string, number>} fresh power-on function values */
export function initFunctionValues() {
  const values = {};
  for (const [key, def] of Object.entries(functionParamDefs)) values[key] = def.default;
  return values;
}

/**
 * Resolve the FUNCTION-mode selection to a function parameter key, or
 * null for the value-less confirm/status entries.
 * @param {{param:string}|null} entry @param {number} sub
 */
export function functionTargetKey(entry, sub) {
  if (!entry) return null;
  if (entry.param === 'midi') return ['midiCh', 'sysInfo', null][sub] ?? null;
  return functionParamDefs[entry.param] ? entry.param : null;
}
