/**
 * Audio integration check (spec 15.3 groundwork): boots the app in
 * headless Chromium with autoplay allowed, starts the engine, plays
 * middle C, and verifies from captured samples that
 *   1. the engine produces signal at the expected frequency,
 *   2. the VOLUME slider value scales the output level,
 *   3. noteOff silences the voice.
 *
 * Usage: node scripts/audiocheck.mjs [url]   (default vite preview URL)
 */
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:4173';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required']
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('pageerror:', e.message));
await page.goto(url, { waitUntil: 'networkidle' });

const result = await page.evaluate(async () => {
  const { ensureEngine } = window.__fm6;
  await ensureEngine();
  const engine = window.__fm6.engine;
  const { ctx, masterGain } = engine;

  // Tap the post-VOLUME signal.
  const tap = ctx.createAnalyser();
  tap.fftSize = 8192;
  masterGain.connect(tap);
  const buf = new Float32Array(tap.fftSize);

  const capture = () => {
    tap.getFloatTimeDomainData(buf);
    let sum = 0;
    let crossings = 0;
    for (let i = 0; i < buf.length; i++) {
      sum += buf[i] * buf[i];
      if (i > 0 && buf[i - 1] < 0 && buf[i] >= 0) crossings++;
    }
    return {
      rms: Math.sqrt(sum / buf.length),
      freq: (crossings * ctx.sampleRate) / buf.length
    };
  };
  const settle = (ms) => new Promise((r) => setTimeout(r, ms));

  engine.noteOn(60, 100); // middle C ~261.63 Hz
  await settle(300);
  const loud = capture();

  engine.setVolume(0.2);
  await settle(300);
  const quiet = capture();

  engine.setVolume(0.8);
  engine.noteOff(60);
  await settle(300);
  const silent = capture();

  // Spec 13: parameter changes must reach the engine fast. Select OP1
  // OUTPUT LEVEL in EDIT mode, hold a note, slam the value to 0 via DATA
  // ENTRY, and time how long the output takes to start collapsing.
  const { store } = window.__fm6;
  store.dispatch({ type: 'panelButtonPressed', id: 'edit-compare' });
  store.dispatch({ type: 'panelButtonPressed', id: 'btn-27' });
  engine.noteOn(60, 100);
  await settle(300);

  // Short analysis window (512 samples ~ 11 ms) so the RMS tracks the
  // output without dragging 200 ms of history behind it.
  tap.fftSize = 512;
  const fastBuf = new Float32Array(512);
  const fastRms = () => {
    tap.getFloatTimeDomainData(fastBuf);
    let sum = 0;
    for (const x of fastBuf) sum += x * x;
    return Math.sqrt(sum / fastBuf.length);
  };

  const before = fastRms();
  const t0 = performance.now();
  store.dispatch({ type: 'dataEntry', value: 0 });
  let paramLatencyMs = -1;
  for (let t = 0; t < 400; t += 5) {
    await settle(5);
    if (fastRms() < before * 0.5) {
      paramLatencyMs = performance.now() - t0;
      break;
    }
  }
  engine.noteOff(60);

  // FM structure check (spec 10.4/10.5): in algorithm 1, OP2 modulates
  // OP1 — raising its level must create harmonics; switching to
  // algorithm 32 turns OP2 into a parallel carrier at the same ratio, so
  // the harmonics must collapse again.
  tap.fftSize = 8192;
  tap.smoothingTimeConstant = 0; // spectrum snapshots, no per-call decay
  const spec = new Float32Array(tap.frequencyBinCount);
  const peakDb = (freq) => {
    tap.getFloatFrequencyData(spec);
    const bin = Math.round(freq / (ctx.sampleRate / tap.fftSize));
    let max = -Infinity;
    for (let b = bin - 2; b <= bin + 2; b++) max = Math.max(max, spec[b]);
    return max;
  };
  const h2Rel = () => peakDb(523.25) - peakDb(261.63);

  store.dispatch({ type: 'dataEntry', value: 1 }); // restore OP1 OL=99
  engine.noteOn(60, 100);
  await settle(500);
  const pureH2 = h2Rel();

  store.dispatch({ type: 'panelButtonPressed', id: 'operator-select' }); // OP2
  store.dispatch({ type: 'dataEntry', value: 0.85 }); // OP2 OL ~84: modulate
  await settle(500);
  const fmH2 = h2Rel();

  store.dispatch({ type: 'panelButtonPressed', id: 'btn-07' }); // algorithm
  store.dispatch({ type: 'dataEntry', value: 1 }); // -> algorithm 32
  await settle(500);
  const algH2 = h2Rel();
  engine.noteOff(60);

  return {
    sampleRate: ctx.sampleRate, loud, quiet, silent, paramLatencyMs,
    fm: { pureH2, fmH2, algH2 }
  };
});

await browser.close();

const problems = [];
const { loud, quiet, silent } = result;
if (!(loud.rms > 0.02)) problems.push(`no signal while gated on (rms=${loud.rms})`);
if (Math.abs(loud.freq - 261.63) > 8) problems.push(`frequency off: ${loud.freq.toFixed(1)} Hz, expected ~261.6`);
const ratio = quiet.rms / loud.rms;
if (!(ratio > 0.15 && ratio < 0.4)) problems.push(`volume scaling off: quiet/loud=${ratio.toFixed(3)}, expected ~0.25`);
if (!(silent.rms < 1e-4)) problems.push(`voice not silent after noteOff (rms=${silent.rms})`);
// Budget: 16 ms batching + one block + output/analyser buffering slack.
if (!(result.paramLatencyMs >= 0 && result.paramLatencyMs < 100)) {
  problems.push(`parameter latency too high: ${result.paramLatencyMs} ms`);
}
const { pureH2, fmH2, algH2 } = result.fm;
if (!(pureH2 < -25)) problems.push(`unmodulated voice not a pure sine (h2 at ${pureH2.toFixed(1)} dB)`);
if (!(fmH2 > pureH2 + 15)) problems.push(`no sidebands from OP2 modulation (h2 ${fmH2.toFixed(1)} vs pure ${pureH2.toFixed(1)} dB)`);
if (!(algH2 < fmH2 - 15)) problems.push(`algorithm 32 did not flatten the spectrum (h2 ${algH2.toFixed(1)} vs fm ${fmH2.toFixed(1)} dB)`);

console.log(JSON.stringify(result, null, 2));
if (problems.length) {
  console.error('FAIL:\n' + problems.join('\n'));
  process.exit(1);
}
console.log('audio check OK');
