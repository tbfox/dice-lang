// Runtime values and how they print (GRAMMAR.md §4.1, §4.4).

import { distribution } from "./dist.ts";
import { formatNotation, type Notation } from "./notation.ts";
import { Rational } from "./rational.ts";

/** Where a number came from, for `.debug`. */
export type Origin =
  | { kind: "stat"; stat: "mean" | "min" | "max"; name?: string; notation: Notation }
  | { kind: "label"; text: string } // `dmg.roll()`, `__exp__`
  | null; // prints as `nil`

export type NumberValue = { k: "number"; r: Rational; origin: Origin };

export type Value =
  | NumberValue
  | { k: "dice"; notation: Notation; name?: string }
  | { k: "value"; v: bigint }
  | { k: "table"; kind: "at_least" | "at_most"; notation: Notation; name?: string }
  | { k: "roll"; groups: { sides: bigint; values: bigint[] }[]; constant: bigint | null; values: bigint[]; total: bigint }
  | { k: "list"; items: bigint[] }
  | { k: "bool"; v: boolean }
  | { k: "result"; success: boolean }
  | { k: "nil" }
  | { k: "debug"; num: NumberValue };

export const NIL: Value = { k: "nil" };

/** The lines `print(v)` writes. */
export function format(v: Value): string[] {
  switch (v.k) {
    case "number":
      return [v.r.format()];
    case "dice":
      return report(v.notation, v.name, "normal");
    case "table":
      return report(v.notation, v.name, v.kind);
    case "debug":
      return [debugLine(v.num), "---"];
    case "value":
      return [`v${v.v}`];
    case "bool":
      return [String(v.v)];
    case "result":
      return [v.success ? "success" : "fail"];
    case "list":
      return [formatList(v.items)];
    case "roll":
      return formatRoll(v);
    case "nil":
      return ["nil"];
  }
}

function label(notation: Notation, name: string | undefined, kind: string): string {
  return `${name ? `${name} : ` : ""}${formatNotation(notation)} (${kind})`;
}

function report(notation: Notation, name: string | undefined, kind: "normal" | "at_least" | "at_most"): string[] {
  const { min, counts, total } = distribution(notation);
  let shown = counts;
  if (kind === "at_least") {
    // P(outcome >= n): running sums from the top.
    let sum = 0n;
    shown = counts.map((_, i) => counts[counts.length - 1 - i]!).map((c) => (sum += c)).reverse();
  } else if (kind === "at_most") {
    let sum = 0n;
    shown = counts.map((c) => (sum += c));
  }
  const rows = shown.map((c, i) => `${min + i}    ${new Rational(c * 100n, total).format()}`);
  return [`${label(notation, name, kind)}:`, ...rows, "---"];
}

function debugLine(num: NumberValue): string {
  const value = num.r.format();
  const o = num.origin;
  if (!o) return `nil : ${value}`;
  if (o.kind === "label") return `${o.text} : ${value}`;
  return `${label(o.notation, o.name, o.stat)}: ${value}`;
}

function formatList(items: bigint[]): string {
  return `[${items.join(", ")}]`;
}

function formatRoll(v: Extract<Value, { k: "roll" }>): string[] {
  const lines: [string, string][] = v.groups.map((g) => [`d${g.sides}`, formatList(g.values)]);
  if (v.constant !== null) lines.push(["c", String(v.constant)]);
  const width = Math.max(...lines.map(([l]) => l.length));
  return lines.map(([l, text]) => `${l.padEnd(width)} ${text}`);
}
