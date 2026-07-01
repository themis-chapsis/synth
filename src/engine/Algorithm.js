/**
 * The 32 fixed operator topologies (spec 10.4): carriers, modulation
 * edges, feedback operator (+ source for the cross-op loops of
 * algorithms 4 and 6), encoded from the Operation Manual algorithm chart.
 *
 * The table lives in dx7-processor.js, which must stay self-contained
 * because it is also loaded as an AudioWorklet module; this re-export
 * keeps the spec's file layout for main-thread consumers and tests.
 */
export { algorithms } from './dx7-processor.js';
