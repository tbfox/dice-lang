// GRAMMAR.md §4.4 number format and §4.1.1 notation.

import { expect, test } from "bun:test";
import { Rational } from "../src/rational.ts";
import { run } from "../src/run.ts";

test.each([
  [5n, 1n, "5"],
  [25n, 2n, "12.5"],
  [102345n, 10000n, "10.2345"],
  [100n, 1n, "100"],
  [1n, 3n, "0.3333"],
  [2n, 3n, "0.6667"],
  [1n, 20000n, "0.0001"], // 0.00005 rounds half away from zero
  [1n, 1000000n, "0"], // too small to show
  [-1n, 1000000n, "0"], // never `-0`
  [-31n, 2n, "-15.5"],
])("%p / %p prints as %s", (n, d, expected) => {
  expect(new Rational(n, d).format()).toBe(expected);
});

const firstLine = (source: string) => run(source, { seed: 0n }).stdout.split("\n")[0];

test.each([
  ["let dmg = 2d4; dmg + 1", "2d4+1"],
  ["let a = d4 + 1; 10 + a", "10+1d4+1"],
  ["let a = d4 + 1; 10 - a", "10-(1d4+1)"],
  ["d6 + (2 + 3)", "1d6+5"],
  ["(d20 + 5) - 2d4", "1d20+5-2d4"],
  ["2d4 - (d6 - 1)", "2d4-(1d6-1)"],
  ["d20 + 5 - 1d4", "1d20+5-1d4"],
])("notation of %s is %s", (source, notation) => {
  expect(firstLine(source)).toBe(`${notation} (normal):`);
});

test("roll lines are padded to the same width", () => {
  const out = run("(2d4 + 2d8 - 2).roll_values()", { seed: 0n }).stdout;
  expect(out).toMatch(/^d4 \[\d, \d\]\nd8 \[\d, \d\]\nc  -2\n$/);
  const wide = run("(d12 + d4 + 1).roll_values()", { seed: 0n }).stdout;
  expect(wide).toMatch(/^d12 \[\d+\]\nd4  \[\d\]\nc   1\n$/);
});

test("no `c` line without a constant", () => {
  expect(run("2d4.roll_values()", { seed: 0n }).stdout).toMatch(/^d4 \[\d, \d\]\n$/);
});
