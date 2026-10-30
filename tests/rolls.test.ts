// Rolling and seeds (GRAMMAR.md §4.3, §6).

import { expect, test } from "bun:test";
import { Rng } from "../src/rng.ts";
import { run } from "../src/run.ts";

const program = "print(d20.roll()); print(3d6.roll()); (2d8 + 1).roll_values()";

test("the same seed gives the same output", () => {
  expect(run(program, { seed: 42n }).stdout).toBe(run(program, { seed: 42n }).stdout);
});

test("different seeds give different output", () => {
  const outputs = new Set([0n, 1n, 2n, 3n, 4n].map((seed) => run(program, { seed }).stdout));
  expect(outputs.size).toBeGreaterThan(1);
});

test("huge seeds work", () => {
  expect(run(program, { seed: 123456789012345678901234567890n }).exitCode).toBe(0);
});

test(".roll_values().sum() is the same as .roll() for the same seed", () => {
  for (const dice of ["2d4", "d20 + 5", "2d4 + 2d8 - 2", "5d12 - 2d4", "10 - d6"]) {
    for (let seed = 0n; seed < 20n; seed++) {
      const viaRoll = run(`(${dice}).roll()`, { seed }).stdout;
      const viaSum = run(`(${dice}).roll_values().sum()`, { seed }).stdout;
      expect(viaSum).toBe(viaRoll);
    }
  }
});

test("rolls stay between .min and .max", () => {
  const rng = new Rng(7n);
  for (let i = 0; i < 10000; i++) {
    const v = rng.die(6n);
    expect(v >= 1n && v <= 6n).toBe(true);
  }
});

test("a d6 is fair", () => {
  // Fixed seed, so this never fails by chance.
  const rng = new Rng(0n);
  const counts = [0, 0, 0, 0, 0, 0];
  const n = 60000;
  for (let i = 0; i < n; i++) counts[Number(rng.die(6n)) - 1]!++;
  for (const c of counts) expect(Math.abs(c - n / 6)).toBeLessThan(n / 6 * 0.05);
});

test("dice bigger than 32 bits", () => {
  const rng = new Rng(1n);
  const sides = 10n ** 20n;
  for (let i = 0; i < 100; i++) {
    const v = rng.die(sides);
    expect(v >= 1n && v <= sides).toBe(true);
  }
});
