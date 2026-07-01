/**
 * 155-parameter voice model (spec section 7). Milestone 3 deliverable.
 *
 * Will hold `voiceParamDefs`: 21 params x 6 operators (EG rates/levels 1-4,
 * keyboard level scaling break point/depths/curves, rate scaling, amp mod
 * sensitivity, key velocity sensitivity, output level, oscillator mode,
 * frequency coarse/fine, detune) followed by the 28 common parameters
 * (pitch EG, algorithm, feedback, osc key sync, LFO block, pitch mod
 * sensitivity, transpose, 10-char voice name).
 */
export const voiceParamDefs = [];
