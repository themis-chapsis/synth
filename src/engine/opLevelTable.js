/**
 * Operator output level (0-99) mapping (spec 10.2), from the measured
 * hardware analysis: levels 0-19 via lookup, 20-99 linear (28 + level),
 * in 0.7526 dB units below full scale.
 *
 * Implementation lives in dx7-processor.js (self-contained worklet
 * module); re-exported here to keep the spec's file layout.
 */
export { opLevelTable, outputLevelToDb } from './dx7-processor.js';
