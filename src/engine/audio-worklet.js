/**
 * Engine front-end (spec 10.1, 14): owns the AudioContext, registers the
 * dx7-processor worklet, and builds the audio graph
 *
 *   dx7-processor -> masterGain (VOLUME) -> destination
 *
 * No effects, no reverb (spec 14). Creation must happen from a user
 * gesture so the context starts unmuted.
 */

/**
 * @param {number} initialVolume 0-1 master gain (VOLUME slider position)
 * @returns {Promise<{
 *   ctx: AudioContext,
 *   node: AudioWorkletNode,
 *   masterGain: GainNode,
 *   noteOn: (note: number, velocity?: number) => void,
 *   noteOff: (note: number) => void,
 *   allOff: () => void,
 *   setVolume: (v: number) => void
 * }>}
 */
export async function createEngine(initialVolume = 0.8) {
  const ctx = new AudioContext();
  // Standalone single-file build inlines the worklet source and exposes it
  // as a string so it can be loaded from a blob URL (no separate fetchable
  // file, which lets the app run straight from a double-clicked file://
  // page). Normal builds load the emitted worklet asset.
  // A data: URL (not blob:) is used for the inline source so the worklet
  // still loads when the page is opened from an opaque origin — i.e. a
  // double-clicked file:// page, where blob-URL worklets are blocked.
  const inlineSrc = globalThis.__DX7_WORKLET_SRC__;
  const workletUrl = inlineSrc
    ? 'data:text/javascript;base64,' + btoa(unescape(encodeURIComponent(inlineSrc)))
    : new URL('./dx7-processor.js', import.meta.url);
  await ctx.audioWorklet.addModule(workletUrl);

  const node = new AudioWorkletNode(ctx, 'dx7-processor', {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [1]
  });
  const masterGain = ctx.createGain();
  masterGain.gain.value = initialVolume;
  node.connect(masterGain).connect(ctx.destination);
  // NOTE: do not `await ctx.resume()` here. resume() only settles inside a
  // user-gesture task; called after the awaits above it stays pending
  // forever and the whole engine promise hangs (no sound). The context is
  // resumed from a persistent gesture listener in main.js instead.
  ctx.resume().catch(() => {});

  return {
    ctx,
    node,
    masterGain,
    noteOn: (note, velocity = 100) => node.port.postMessage({ type: 'noteOn', note, velocity }),
    noteOff: (note) => node.port.postMessage({ type: 'noteOff', note }),
    allOff: () => node.port.postMessage({ type: 'allOff' }),
    setVolume: (v) => masterGain.gain.setTargetAtTime(v, ctx.currentTime, 0.01),
    /** @param {number} norm -1..1 @param {number} rangeSemis pitch bend range */
    setPitchBend: (norm, rangeSemis) => node.port.postMessage({ type: 'pitchBend', semis: norm * rangeSemis }),
    /** @param {number} value 0..1 modulation wheel position */
    setModWheel: (value) => node.port.postMessage({ type: 'controllers', wheel: value }),
    /** @param {{range:number,pitch:number,amp:number}} r mod-wheel routing */
    setModRouting: (r) => node.port.postMessage({ type: 'controllers', range: r.range, pitch: r.pitch, amp: r.amp })
  };
}
