/**
 * 6-waveform LFO with delay/fade-in and the pitch envelope (spec
 * 10.6/10.8). Implementations live in dx7-processor.js (self-contained
 * worklet module); re-exported here to keep the spec's file layout.
 */
export { LFO, PitchEG } from './dx7-processor.js';
