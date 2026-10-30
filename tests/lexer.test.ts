// GRAMMAR.md §2.

import { expect, test } from "bun:test";
import { lex, type Token } from "../src/lexer.ts";

function show(t: Token): string {
  switch (t.kind) {
    case "DICE":
      return `DICE(${t.count}, ${t.sides})`;
    case "VALUE":
      return `VALUE(${t.value})`;
    case "NUMBER":
      return `NUMBER(${t.value})`;
    case "IDENT":
      return `IDENT(${t.name})`;
    default:
      return t.kind;
  }
}

const tokens = (source: string) =>
  lex(source)
    .tokens.filter((t) => t.kind !== "EOF")
    .map(show)
    .join(" ");

const codes = (source: string) => lex(source).diagnostics.map((d) => d.code);

test.each([
  ["2d4", "DICE(2, 4)"],
  ["d20+5", "DICE(1, 20) + NUMBER(5)"],
  ["5d12-2d4", "DICE(5, 12) - DICE(2, 4)"],
  ["v17", "VALUE(17)"],
  ["dmg.at_least", "IDENT(dmg) . IDENT(at_least)"],
])("spec table: %s", (source, expected) => {
  expect(tokens(source)).toBe(expected);
});

test("dice and value words vs names", () => {
  expect(tokens("d4x v1a dmg dc save")).toBe("IDENT(d4x) IDENT(v1a) IDENT(dmg) IDENT(dc) IDENT(save)");
  expect(tokens("let true false")).toBe("let true false");
});

test("comments and whitespace are skipped", () => {
  expect(tokens("let x = 1; // a comment\n x")).toBe("let IDENT(x) = NUMBER(1) ; IDENT(x)");
});

test("words starting with a digit must be a number or dice", () => {
  expect(codes("2d4x")).toEqual(["E0002"]);
  expect(codes("5x")).toEqual(["E0002"]);
  expect(codes("2dmg")).toEqual(["E0002"]);
});

test("dice limits", () => {
  expect(codes("d0")).toEqual(["E0003"]);
  expect(codes("0d6")).toEqual(["E0003"]);
  expect(codes("2d1")).toEqual(["E0003"]);
  expect(codes("d2 v0")).toEqual([]);
});

test("reserved names", () => {
  expect(codes("__exp__")).toEqual(["E0004"]);
  expect(codes("_x x__")).toEqual([]);
});

test("unexpected characters", () => {
  expect(codes("1 # 2")).toEqual(["E0001"]);
  expect(codes("1 / 2")).toEqual(["E0001"]);
});
