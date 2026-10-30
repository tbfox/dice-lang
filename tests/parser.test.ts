// GRAMMAR.md §3. Trees are printed with full parentheses to show how they grouped.

import { expect, test } from "bun:test";
import type { Expr } from "../src/ast.ts";
import { lex } from "../src/lexer.ts";
import { parse } from "../src/parser.ts";

function show(e: Expr): string {
  switch (e.kind) {
    case "number":
    case "value":
    case "bool":
      return e.kind === "value" ? `v${e.value}` : String(e.value);
    case "dice":
      return e.text;
    case "ident":
      return e.name;
    case "let":
      return `(let ${e.name} = ${show(e.value)})`;
    case "binary":
      return `(${show(e.left)} ${e.op} ${show(e.right)})`;
    case "member":
      return `(${show(e.object)}.${e.name})`;
    case "call":
      return `(${show(e.callee)} ${e.args.map((a) => (a.name ? `${a.name}=${show(a.value)}` : show(a.value))).join(", ")})`;
  }
}

function parsed(source: string) {
  const { program, diagnostics } = parse(lex(source).tokens);
  return { trees: program.exprs.map(show), hasResult: program.hasResult, codes: diagnostics.map((d) => d.code) };
}

test.each([
  ["let x = d20 + 5", "(let x = (d20 + 5))"],
  ["5d12 - 2d4 + 3", "((5d12 - 2d4) + 3)"],
  ["dmg.roll(3)", "((dmg.roll) 3)"],
  ["d20 + 5.min", "(d20 + (5.min))"],
  ["(d20 + 5).min", "((d20 + 5).min)"],
  ["1 + (let x = 2)", "(1 + (let x = 2))"],
  ["dc.roll_against(save, must_exceed = true)", "((dc.roll_against) save, must_exceed=true)"],
  ["print(let outcome = dmg.roll_values())", "(print (let outcome = ((dmg.roll_values) )))"],
])("precedence: %s", (source, expected) => {
  expect(parsed(source).trees).toEqual([expected]);
});

test("semicolons and the program result", () => {
  expect(parsed("1; 2").hasResult).toBe(true);
  expect(parsed("1; 2;").hasResult).toBe(false);
  expect(parsed("").trees).toEqual([]);
});

test("syntax errors", () => {
  expect(parsed("-2d4").codes).toEqual(["E0001"]);
  expect(parsed("1 + let x = 2").codes).toEqual(["E0001"]);
  expect(parsed("let = 5").codes).toEqual(["E0001"]);
  expect(parsed("print(1) print(2)").codes).toEqual(["E0001"]);
});

test("recovers at `;` to report more than one syntax error", () => {
  const { trees, codes } = parsed("let = 5; -1; d6");
  expect(codes).toEqual(["E0001", "E0001"]);
  expect(trees).toEqual(["d6"]);
});
