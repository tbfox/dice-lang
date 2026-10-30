// Syntax tree (GRAMMAR.md §3). Every node keeps its source span for error messages.

import type { Span } from "./diagnostics.ts";

export type Expr =
  | { kind: "number"; value: bigint; span: Span }
  | { kind: "dice"; count: bigint; sides: bigint; text: string; span: Span }
  | { kind: "value"; value: bigint; span: Span }
  | { kind: "bool"; value: boolean; span: Span }
  | { kind: "ident"; name: string; span: Span }
  | { kind: "let"; name: string; nameSpan: Span; value: Expr; span: Span }
  | { kind: "binary"; op: "+" | "-"; left: Expr; right: Expr; span: Span }
  | { kind: "member"; object: Expr; name: string; nameSpan: Span; span: Span }
  | { kind: "call"; callee: Expr; args: Arg[]; span: Span };

export interface Arg {
  name?: string;
  nameSpan?: Span;
  value: Expr;
  span: Span;
}

export interface Program {
  exprs: Expr[];
  /** True when the last expression has no `;` after it, so it is the program result. */
  hasResult: boolean;
}

/** Re-prints an expression with spaces removed, e.g. `dmg . roll( )` → `dmg.roll()`. */
export function reprint(e: Expr): string {
  switch (e.kind) {
    case "number":
      return String(e.value);
    case "dice":
      return e.text;
    case "value":
      return `v${e.value}`;
    case "bool":
      return String(e.value);
    case "ident":
      return e.name;
    case "let":
      return `let ${e.name}=${reprint(e.value)}`;
    case "binary": {
      const right = e.op === "-" && isCompound(e.right) ? `(${reprint(e.right)})` : reprint(e.right);
      return `${reprint(e.left)}${e.op}${right}`;
    }
    case "member":
      return `${reprintReceiver(e.object)}.${e.name}`;
    case "call": {
      const args = e.args.map((a) => (a.name ? `${a.name}=${reprint(a.value)}` : reprint(a.value)));
      return `${reprintReceiver(e.callee)}(${args.join(",")})`;
    }
  }
}

function isCompound(e: Expr): boolean {
  return e.kind === "binary" || e.kind === "let";
}

function reprintReceiver(e: Expr): string {
  return isCompound(e) ? `(${reprint(e)})` : reprint(e);
}
