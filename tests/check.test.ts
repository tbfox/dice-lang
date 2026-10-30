// GRAMMAR.md §7 error codes, plus the constant vs live rule in §4.1.

import { expect, test } from "bun:test";
import { run } from "../src/run.ts";

const codes = (source: string) => [...run(source, { seed: 0n }).stderr.matchAll(/error\[(E\d+)\]/g)].map((m) => m[1]);

test.each([
  ["E0001", "let = 5"],
  ["E0002", "2d4x"],
  ["E0003", "2d1"],
  ["E0004", "let __exp__ = 1"],
  ["E0005", "print(dmgg)"],
  ["E0006", "let print = 1"],
  ["E0007", "let dmg = 2d4; d6 + dmg.mean"],
  ["E0008", "let dmg = 2d4; dmg.mean()"],
  ["E0008", "let dmg = 2d4; dmg.roll"],
  ["E0009", "let dmg = 2d4; dmg.avg"],
  ["E0010", "let dc = v17; let save = d20; dc.roll_against(must_exceed = true, save)"],
  ["E0010", "let dc = v17; let save = d20; dc.roll_against(save, exceed = true)"],
])("%s: %s", (code, source) => {
  expect(codes(source)).toEqual([code]);
});

test("constants can be added to dice, live numbers can't", () => {
  expect(codes("d6 + 5")).toEqual([]);
  expect(codes("10 - d6")).toEqual([]);
  expect(codes("d6 + (2 + 3)")).toEqual([]);
  expect(codes("let bonus = 5; d6 + bonus")).toEqual(["E0007"]);
  expect(codes("d6 + d4.roll()")).toEqual(["E0007"]);
  expect(codes("let r = d4.roll_values(); d6 + r.sum()")).toEqual(["E0007"]);
  expect(codes("d6 + (d4.max + 1)")).toEqual(["E0007"]);
});

test("live numbers can still be added to each other", () => {
  expect(codes("let dmg = 2d4; dmg.mean + dmg.max - 1")).toEqual([]);
});

test("re-binding is allowed and changes the type", () => {
  expect(codes("let x = 2d4; let x = 5; x.debug")).toEqual([]);
  expect(codes("let x = 5; let x = 2d4; x.mean")).toEqual([]);
});

test("reports every error, not just the first", () => {
  expect(codes("print(a); print(b); let print = 1")).toEqual(["E0005", "E0005", "E0006"]);
});

test("an undefined variable doesn't cause follow-on errors", () => {
  expect(codes("let x = nope; x.mean; x + 1")).toEqual(["E0005"]);
});
