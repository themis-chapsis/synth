/**
 * Sine operator building blocks (spec 10.2): frequency computation and
 * the level/dB mappings shared by carriers and modulators.
 *
 * The implementation lives in dx7-processor.js (self-contained worklet
 * module); re-exported here to keep the spec's file layout.
 */
export { opFrequency, levelToDb, dbToAmp, defaultVoice } from './dx7-processor.js';
