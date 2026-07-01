/**
 * Algorithm table tests (spec 10.4 / 15.1): structural invariants that
 * must hold for every one of the 32 topologies, plus exact spot checks of
 * well-known algorithms against the Operation Manual chart.
 */

import { describe, it, expect } from 'vitest';
import { algorithms } from '../src/engine/Algorithm.js';

describe('algorithm table invariants', () => {
  it('has 32 algorithms with sequential ids', () => {
    expect(algorithms).toHaveLength(32);
    algorithms.forEach((a, i) => expect(a.id).toBe(i + 1));
  });

  it.each(algorithms.map((a) => [a.id, a]))('algorithm %i is well-formed', (_id, a) => {
    // Carriers: non-empty, unique, valid op indices.
    expect(a.carriers.length).toBeGreaterThan(0);
    expect(new Set(a.carriers).size).toBe(a.carriers.length);
    for (const c of a.carriers) expect(c).toBeGreaterThanOrEqual(0);
    for (const c of a.carriers) expect(c).toBeLessThan(6);

    // Every modulation edge runs from a higher-numbered op to a lower one
    // (the DX7 chart has no upward edges outside the feedback path).
    for (const [target, mods] of Object.entries(a.modulation)) {
      const t = Number(target);
      expect(a.carriers.includes(t) || Object.values(a.modulation).some((m) => m.includes(t))).toBe(true);
      for (const m of mods) {
        expect(m).toBeGreaterThan(t);
        expect(m).toBeLessThan(6);
      }
    }

    // Exactly one feedback path; source defaults to the loop op itself.
    expect(a.feedback).toBeGreaterThanOrEqual(0);
    expect(a.feedback).toBeLessThan(6);
    if (a.feedbackSource !== undefined) {
      expect([4, 6]).toContain(a.id); // only algorithms 4 and 6 cross-loop
      expect(a.feedbackSource).not.toBe(a.feedback);
    }

    // Every operator must reach the output: it is a carrier or transitively
    // modulates one.
    const reachesOutput = new Set(a.carriers);
    let grew = true;
    while (grew) {
      grew = false;
      for (const [target, mods] of Object.entries(a.modulation)) {
        if (!reachesOutput.has(Number(target))) continue;
        for (const m of mods) {
          if (!reachesOutput.has(m)) {
            reachesOutput.add(m);
            grew = true;
          }
        }
      }
    }
    expect([...reachesOutput].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('total modulation edges match the chart (guards single-edge typos)', () => {
    const edgeCount = algorithms.reduce(
      (n, a) => n + Object.values(a.modulation).reduce((m, arr) => m + arr.length, 0),
      0
    );
    expect(edgeCount).toBe(111);
  });

  it('matches the manual chart exactly for the spec example (algorithm 1)', () => {
    expect(algorithms[0]).toEqual({
      id: 1,
      carriers: [0, 2],
      modulation: { 0: [1], 2: [3], 3: [4], 4: [5] },
      feedback: 5
    });
  });

  it('matches known landmark algorithms', () => {
    // 32: six parallel carriers, feedback on op 6.
    expect(algorithms[31].carriers).toEqual([0, 1, 2, 3, 4, 5]);
    expect(algorithms[31].modulation).toEqual({});
    // Op 6 is a carrier only in algorithms 28, 30, and 32.
    const withOp6Carrier = algorithms.filter((a) => a.carriers.includes(5)).map((a) => a.id);
    expect(withOp6Carrier).toEqual([28, 30, 32]);
    // 5: three modulator/carrier pairs.
    expect(algorithms[4].carriers).toEqual([0, 2, 4]);
    // 16/17: single-carrier towers.
    expect(algorithms[15].carriers).toEqual([0]);
    expect(algorithms[16].carriers).toEqual([0]);
    // 4 and 6 cross-op feedback loops.
    expect(algorithms[3].feedbackSource).toBe(3);
    expect(algorithms[5].feedbackSource).toBe(4);
  });
});
