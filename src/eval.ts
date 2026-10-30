// Runs a checked program. The checker has already rejected anything that could go wrong here,
// so mismatches below are interpreter bugs, not user errors.

import { reprint, type Arg, type Expr, type Program } from "./ast.ts";
import { FUNCTIONS, MEMBERS, type Param } from "./builtins.ts";
import { max, mean, min } from "./dist.ts";
import { flatten, type Notation } from "./notation.ts";
import { Rational } from "./rational.ts";
import type { Rng } from "./rng.ts";
import { format, NIL, type NumberValue, type Value } from "./values.ts";

export function evaluate(program: Program, rng: Rng, out: string[]): void {
  const evaluator = new Evaluator(rng, out);
  let result: Value = NIL;
  for (const e of program.exprs) result = evaluator.expr(e);
  // `expr;` discards the value, so only a final expression without `;` is the result.
  out.push(...format(program.hasResult ? result : NIL));
}

class Evaluator {
  private env = new Map<string, Value>();

  constructor(
    private rng: Rng,
    private out: string[],
  ) {}

  expr(e: Expr): Value {
    switch (e.kind) {
      case "number":
        return { k: "number", r: new Rational(e.value), origin: null };
      case "dice":
        return { k: "dice", notation: { t: "die", count: e.count, sides: e.sides } };
      case "value":
        return { k: "value", v: e.value };
      case "bool":
        return { k: "bool", v: e.value };
      case "ident":
        return this.read(e.name);
      case "let": {
        const v = this.expr(e.value);
        this.env.set(e.name, v);
        return v;
      }
      case "binary":
        return this.binary(e.op, this.expr(e.left), this.expr(e.right));
      case "member":
        return this.field(this.expr(e.object), e.name);
      case "call":
        return this.call(e);
    }
  }

  /** Reading a variable copies its value and gives dice and tables the variable's name. */
  private read(name: string): Value {
    const v = this.env.get(name);
    if (!v) throw new Error(`internal: undefined variable ${name}`);
    switch (v.k) {
      case "dice":
      case "table":
        return { ...v, name };
      case "number":
        return { ...v, origin: null };
      default:
        return v;
    }
  }

  private binary(op: "+" | "-", left: Value, right: Value): Value {
    if (left.k === "number" && right.k === "number") {
      const r = op === "+" ? left.r.add(right.r) : left.r.sub(right.r);
      return { k: "number", r, origin: { kind: "label", text: "__exp__" } };
    }
    return { k: "dice", notation: { t: op, left: toNotation(left), right: toNotation(right) } };
  }

  private field(object: Value, name: string): Value {
    switch (`${object.k}.${name}`) {
      case "dice.at_least":
      case "dice.at_most": {
        const o = object as Extract<Value, { k: "dice" }>;
        return { k: "table", kind: name as "at_least", notation: o.notation, name: o.name };
      }
      case "dice.mean":
      case "dice.min":
      case "dice.max": {
        const o = object as Extract<Value, { k: "dice" }>;
        const r = name === "mean" ? mean(o.notation) : new Rational(name === "min" ? min(o.notation) : max(o.notation));
        return { k: "number", r, origin: { kind: "stat", stat: name as "mean", name: o.name, notation: o.notation } };
      }
      case "roll.values":
        return { k: "list", items: (object as Extract<Value, { k: "roll" }>).values };
      case "number.debug":
        return { k: "debug", num: object as NumberValue };
    }
    throw new Error(`internal: no field ${object.k}.${name}`);
  }

  private call(e: Extract<Expr, { kind: "call" }>): Value {
    const callee = e.callee;

    if (callee.kind === "ident") {
      const [x] = this.args(FUNCTIONS[callee.name]!.params, e.args);
      this.out.push(...format(x!));
      return NIL;
    }

    if (callee.kind !== "member") throw new Error("internal: bad callee");
    const object = this.expr(callee.object);
    const spec = MEMBERS[object.k as "dice"]![callee.name]!;
    const args = this.args(spec.params, e.args);

    switch (`${object.k}.${callee.name}`) {
      case "dice.roll": {
        const total = this.roll((object as Extract<Value, { k: "dice" }>).notation).total;
        const [n] = args;
        if (n) return { k: "result", success: new Rational(total).equals((n as NumberValue).r) };
        return { k: "number", r: new Rational(total), origin: { kind: "label", text: reprint(e) } };
      }
      case "dice.roll_values":
        return this.roll((object as Extract<Value, { k: "dice" }>).notation);
      case "roll.sum":
        return { k: "number", r: new Rational((object as Extract<Value, { k: "roll" }>).total), origin: null };
      case "value.roll_against": {
        const [d, mustExceed] = args;
        const total = this.roll((d as Extract<Value, { k: "dice" }>).notation).total;
        const target = (object as Extract<Value, { k: "value" }>).v;
        const exceed = mustExceed?.k === "bool" && mustExceed.v;
        return { k: "result", success: exceed ? total > target : total >= target };
      }
    }
    throw new Error(`internal: no method ${object.k}.${callee.name}`);
  }

  /** Evaluates arguments left to right and lines them up with params (missing optional ones are undefined). */
  private args(params: Param[], args: Arg[]): (Value | undefined)[] {
    const bound: (Value | undefined)[] = params.map(() => undefined);
    let positional = 0;
    for (const arg of args) {
      const v = this.expr(arg.value);
      const i = arg.name === undefined ? positional++ : params.findIndex((p) => p.name === arg.name);
      bound[i] = v;
    }
    return bound;
  }

  /** Rolls every die in order. `.roll()`, `.roll_values()` and `.roll_against()` all go through here. */
  private roll(notation: Notation): Extract<Value, { k: "roll" }> {
    const flat = flatten(notation);
    const groups: { sides: bigint; values: bigint[] }[] = [];
    const values: bigint[] = [];
    let total = flat.constant;
    for (const term of flat.terms) {
      let group = groups.find((g) => g.sides === term.sides);
      if (!group) groups.push((group = { sides: term.sides, values: [] }));
      for (let i = 0n; i < term.count; i++) {
        const v = term.sign * this.rng.die(term.sides);
        group.values.push(v);
        values.push(v);
        total += v;
      }
    }
    return { k: "roll", groups, constant: flat.hasConstant ? flat.constant : null, values, total };
  }
}

/** A dice operand, or a constant number (always whole) inside a dice expression. */
function toNotation(v: Value): Notation {
  if (v.k === "dice") return v.notation;
  if (v.k === "number") return { t: "const", value: v.r.n };
  throw new Error(`internal: ${v.k} in dice arithmetic`);
}
