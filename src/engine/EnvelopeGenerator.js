/**
 * 4-stage rate/level envelope generator (spec 10.3).
 *
 * The implementation lives in dx7-processor.js, which must stay
 * self-contained because it is also loaded as an AudioWorklet module;
 * this re-export keeps the spec's file layout and gives node-side tests
 * and future main-thread consumers a stable import path.
 */
export { EnvelopeGenerator, levelToDb, dbToAmp } from './dx7-processor.js';
