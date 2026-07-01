/**
 * What each of the 32 numbered buttons does per mode (spec section 6):
 * three 32-entry arrays — not switch statements. Entries are routing
 * descriptors consumed by the store's mode handlers (milestone 2+).
 *
 * Sources: Operation Manual EDIT/FUNCTION chapters (cross-checked via
 * secondary sources; see /reference/README.md). In EDIT mode, buttons 1-6
 * toggle operators on/off (and EG COPY with OPERATOR SELECT held); the
 * edit parameters start at button 7.
 */

/** PLAY mode: button N loads patch N of the active bank. */
export const playMap = Array.from({ length: 32 }, (_, i) => ({
  action: 'loadPatch', slot: i + 1
}));

/** STORE mode: button N selects destination slot N. */
export const storeMap = Array.from({ length: 32 }, (_, i) => ({
  action: 'storeTarget', slot: i + 1
}));

/** EDIT mode parameter groups per button (1-based index = button number). */
export const editMap = [
  { action: 'opOnOff', op: 1 }, { action: 'opOnOff', op: 2 }, { action: 'opOnOff', op: 3 },
  { action: 'opOnOff', op: 4 }, { action: 'opOnOff', op: 5 }, { action: 'opOnOff', op: 6 },
  { action: 'param', param: 'algorithm' },
  { action: 'param', param: 'feedback' },
  { action: 'param', param: 'lfoWave' },
  { action: 'param', param: 'lfoSpeed' },
  { action: 'param', param: 'lfoDelay' },
  { action: 'param', param: 'lfoPmd' },
  { action: 'param', param: 'lfoAmd' },
  { action: 'param', param: 'lfoSync' },
  { action: 'param', param: 'pitchModSens' },
  { action: 'opParam', param: 'ampModSens' },
  { action: 'opParam', param: 'oscModeSync' },
  { action: 'opParam', param: 'freqCoarse' },
  { action: 'opParam', param: 'freqFine' },
  { action: 'opParam', param: 'detune' },
  { action: 'opParam', param: 'egRate', cycles: 4 },
  { action: 'opParam', param: 'egLevel', cycles: 4 },
  { action: 'opParam', param: 'kbdBreakPoint' },
  { action: 'opParam', param: 'kbdCurve', cycles: 2 },
  { action: 'opParam', param: 'kbdDepth', cycles: 2 },
  { action: 'opParam', param: 'kbdRateScaling' },
  { action: 'opParam', param: 'outputLevel' },
  { action: 'opParam', param: 'keyVelSens' },
  { action: 'param', param: 'pitchEgRate', cycles: 4 },
  { action: 'param', param: 'pitchEgLevel', cycles: 4 },
  { action: 'param', param: 'transpose' },
  { action: 'param', param: 'voiceName' }
];

/** FUNCTION mode parameters per button. 12/13 unassigned on the original. */
export const functionMap = [
  { action: 'func', param: 'masterTune' },
  { action: 'func', param: 'polyMono' },
  { action: 'func', param: 'pitchBendRange' },
  { action: 'func', param: 'pitchBendStep' },
  { action: 'func', param: 'portamentoMode' },
  { action: 'func', param: 'portamentoGliss' },
  { action: 'func', param: 'portamentoTime' },
  { action: 'func', param: 'midi', cycles: 3 },
  { action: 'func', param: 'editRecall' },
  { action: 'func', param: 'voiceInit' },
  { action: 'func', param: 'cartridgeForm' },
  null,
  null,
  { action: 'func', param: 'batteryCheck' },
  { action: 'func', param: 'cartridgeSave' },
  { action: 'func', param: 'cartridgeLoad' },
  { action: 'func', param: 'modWheelRange' },
  { action: 'func', param: 'modWheelPitch' },
  { action: 'func', param: 'modWheelAmp' },
  { action: 'func', param: 'modWheelEgBias' },
  { action: 'func', param: 'footRange' },
  { action: 'func', param: 'footPitch' },
  { action: 'func', param: 'footAmp' },
  { action: 'func', param: 'footEgBias' },
  { action: 'func', param: 'breathRange' },
  { action: 'func', param: 'breathPitch' },
  { action: 'func', param: 'breathAmp' },
  { action: 'func', param: 'breathEgBias' },
  { action: 'func', param: 'afterTouchRange' },
  { action: 'func', param: 'afterTouchPitch' },
  { action: 'func', param: 'afterTouchAmp' },
  { action: 'func', param: 'afterTouchEgBias' }
];
