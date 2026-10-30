// Exact distributions, plus properties that must hold for any dice expression.

import { expect, test } from "bun:test";
import { distribution, max, mean, min } from "../src/dist.ts";
import type { Notation } from "../src/notation.ts";
import { Rational } from "../src/rational.ts";
import { Rng } from "../src/rng.ts";

const die = (count: number, sides: number): Notation => ({ t: "die", count: BigInt(count), sides: BigInt(sides) });
const c = (value: number): Notation => ({ t: "const", value: BigInt(value) });
const add = (left: Notation, right: Notation): Notation => ({ t: "+", left, right });
const sub = (left: Notation, right: Notation): Notation => ({ t: "-", left, right });

const outcomes = (n: Notation) => {
  const d = distribution(n);
  return [d.min, d.min + d.counts.length - 1];
};

test("2d4 counts exactly", () => {
  const d = distribution(die(2, 4));
  expect(d.min).toBe(2);
  expect(d.counts).toEqual([1n, 2n, 3n, 4n, 3n, 2n, 1n]);
  expect(d.total).toBe(16n);
});

test.each([
  ["5d12 - 2d4", sub(die(5, 12), die(2, 4)), [-3, 58]],
  ["d20 + 5 - 1d4", sub(add(die(1, 20), c(5)), die(1, 4)), [2, 24]],
  ["10 - d6", sub(c(10), die(1, 6)), [4, 9]],
  ["1d4 - 2d4", sub(die(1, 4), die(2, 4)), [-7, 2]],
])("outcome range of %s (GRAMMAR.md §4.1.1)", (_, n, range) => {
  expect(outcomes(n)).toEqual(range);
});

test("mean, min and max", () => {
  const n = add(die(1, 20), c(5));
  expect(mean(n).format()).toBe("15.5");
  expect(min(n)).toBe(6n);
  expect(max(n)).toBe(25n);
});

test("100d100 is fast enough", () => {
  const start = performance.now();
  distribution(die(100, 100));
  expect(performance.now() - start).toBeLessThan(2000);
});

// Property tests over random dice expressions, generated from a fixed seed.

function randomNotation(rng: Rng, depth = 0): Notation {
  const pick = rng.next() % 4;
  if (depth > 2 || pick === 0) return die(1 + (rng.next() % 4), 2 + (rng.next() % 11));
  if (pick === 1) return add(randomNotation(rng, depth + 1), c(rng.next() % 10));
  return (pick === 2 ? add : sub)(randomNotation(rng, depth + 1), randomNotation(rng, depth + 1));
}

test("properties hold for random dice expressions", () => {
  const rng = new Rng(12345n);
  for (let i = 0; i < 300; i++) {
    const n = randomNotation(rng);
    const d = distribution(n);

    // Every way to roll is counted exactly once.
    expect(d.counts.reduce((a, b) => a + b, 0n)).toBe(d.total);
    expect(d.counts.every((x) => x > 0n)).toBe(true);

    // min and max are the ends of the table.
    expect(BigInt(d.min)).toBe(min(n));
    expect(BigInt(d.min + d.counts.length - 1)).toBe(max(n));

    // The mean from the table equals the mean worked out per die.
    const fromTable = d.counts.reduce((s, x, k) => s + x * BigInt(d.min + k), 0n);
    expect(new Rational(fromTable, d.total).equals(mean(n))).toBe(true);
  }
});
