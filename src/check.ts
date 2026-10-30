// Checks the whole program before it runs (GRAMMAR.md §7): names, types, constant vs live numbers,
// fields vs methods, and arguments. Every error is collected; nothing runs if there are any.

import type { Arg, Expr, Program } from "./ast.ts";
import { FUNCTIONS, MEMBERS, type Param, type TypeName } from "./builtins.ts";
import { closest, type Diagnostic, type Span } from "./diagnostics.ts";

/** A checked type. Numbers also track whether they are a constant (GRAMMAR.md §4.1). */
type Ty = { name: TypeName; constant?: boolean } | { name: "error" };

const ERROR: Ty = { name: "error" };

export function check(program: Program): Diagnostic[] {
  const checker = new Checker();
  for (const e of program.exprs) checker.expr(e);
  return checker.diagnostics;
}

class Checker {
  diagnostics: Diagnostic[] = [];
  private env = new Map<string, Ty>();

  expr(e: Expr): Ty {
    switch (e.kind) {
      case "number":
        return { name: "number", constant: true };
      case "dice":
        return { name: "dice" };
      case "value":
        return { name: "value" };
      case "bool":
        return { name: "bool" };
      case "ident":
        return this.ident(e);
      case "let":
        return this.let(e);
      case "binary":
        return this.binary(e);
      case "member":
        return this.member(e);
      case "call":
        return this.call(e);
    }
  }

  private ident(e: Extract<Expr, { kind: "ident" }>): Ty {
    if (e.name in FUNCTIONS) {
      this.error("E0008", `\`${e.name}\` is a function, so it needs \`()\``, e.span, "not called", [
        { kind: "help", text: `use \`${e.name}(...)\`` },
      ]);
      return ERROR;
    }
    const ty = this.env.get(e.name);
    if (!ty) {
      const suggestion = closest(e.name, [...this.env.keys(), ...Object.keys(FUNCTIONS)]);
      this.error(
        "E0005",
        `undefined variable \`${e.name}\``,
        e.span,
        "not defined",
        suggestion ? [{ kind: "help", text: `did you mean \`${suggestion}\`?` }] : undefined,
      );
      return ERROR;
    }
    // A number read from a variable is always live.
    return ty.name === "number" ? { name: "number", constant: false } : ty;
  }

  private let(e: Extract<Expr, { kind: "let" }>): Ty {
    if (e.name in FUNCTIONS) {
      this.error("E0006", `the identifier \`${e.name}\` is already defined`, e.nameSpan, `\`${e.name}\` is a built-in`);
    }
    const ty = this.expr(e.value);
    this.env.set(e.name, ty);
    return ty;
  }

  private binary(e: Extract<Expr, { kind: "binary" }>): Ty {
    const left = this.expr(e.left);
    const right = this.expr(e.right);
    if (left.name === "error" || right.name === "error") return ERROR;

    const isNumber = (t: Ty) => t.name === "number";
    const isDice = (t: Ty) => t.name === "dice";

    if (isNumber(left) && isNumber(right)) {
      return { name: "number", constant: "constant" in left && left.constant && "constant" in right && right.constant };
    }
    if ((isDice(left) || isNumber(left)) && (isDice(right) || isNumber(right))) {
      // One side is dice, the other is dice or a number. Numbers must be constants.
      for (const [side, ty] of [[e.left, left], [e.right, right]] as const) {
        if (isNumber(ty) && "constant" in ty && !ty.constant) {
          const notes: Diagnostic["notes"] = [
            { kind: "note", text: "only constants (number literals) can be added to or subtracted from dice" },
          ];
          if (side.kind === "ident") notes.unshift({ kind: "note", text: `\`${side.name}\` is a variable, so it's live` });
          this.error("E0007", "can't combine dice with a live number", side.span, "this is a live number", notes);
          return ERROR;
        }
      }
      return { name: "dice" };
    }

    // Point at the operand that can't take part in `+` / `-`.
    const [bad, badTy] = isDice(left) || isNumber(left) ? [e.right, right] : [e.left, left];
    const notes: Diagnostic["notes"] =
      badTy.name === "value" ? [{ kind: "note", text: "`value` can't be used with `+` / `-` yet" }] : undefined;
    this.error(
      "E0007",
      `can't use \`${e.op}\` with \`${left.name}\` and \`${right.name}\``,
      bad.span,
      `this is a \`${badTy.name}\``,
      notes,
    );
    return ERROR;
  }

  /** A member used without a call: must be a field. */
  private member(e: Extract<Expr, { kind: "member" }>): Ty {
    const object = this.expr(e.object);
    const spec = this.lookupMember(object, e.name, e.nameSpan);
    if (!spec) return ERROR;
    if (spec.kind === "method") {
      this.error("E0008", `\`${e.name}\` is a method, so it needs \`()\``, e.nameSpan, "not called", [
        { kind: "help", text: `use \`.${e.name}()\`` },
      ]);
      return ERROR;
    }
    return { name: spec.returns(0), constant: false };
  }

  private call(e: Extract<Expr, { kind: "call" }>): Ty {
    const callee = e.callee;

    if (callee.kind === "ident" && callee.name in FUNCTIONS) {
      const spec = FUNCTIONS[callee.name]!;
      this.args(spec.params, e.args, `\`${callee.name}\``, e.span);
      return { name: spec.returns };
    }

    if (callee.kind === "member") {
      const object = this.expr(callee.object);
      const spec = this.lookupMember(object, callee.name, callee.nameSpan);
      if (!spec) {
        this.args(null, e.args, "", e.span);
        return ERROR;
      }
      if (spec.kind === "field") {
        this.error("E0008", `\`${callee.name}\` is a field, not a method`, callee.nameSpan, "can't be called", [
          { kind: "help", text: `remove the \`()\`: \`.${callee.name}\`` },
        ]);
        this.args(null, e.args, "", e.span);
        return ERROR;
      }
      this.args(spec.params, e.args, `\`.${callee.name}()\``, e.span);
      return { name: spec.returns(e.args.length), constant: false };
    }

    const ty = this.expr(callee);
    if (ty.name !== "error") {
      const what = callee.kind === "ident" ? `\`${callee.name}\`` : "this";
      this.error("E0007", `${what} is not a function`, callee.span, `this is a \`${ty.name}\``);
    }
    this.args(null, e.args, "", e.span);
    return ERROR;
  }

  private lookupMember(object: Ty, name: string, nameSpan: Span) {
    if (object.name === "error") return undefined;
    const members = MEMBERS[object.name] ?? {};
    const spec = members[name];
    if (!spec) {
      const suggestion = closest(name, Object.keys(members));
      this.error(
        "E0009",
        `no member \`${name}\` on \`${object.name}\``,
        nameSpan,
        "unknown member",
        suggestion ? [{ kind: "help", text: `did you mean \`${suggestion}\`?` }] : undefined,
      );
    }
    return spec;
  }

  /** Checks arguments against params. With `params` null, only checks the argument expressions. */
  private args(params: Param[] | null, args: Arg[], calleeName: string, callSpan: Span) {
    const types = args.map((a) => this.expr(a.value));
    if (!params) return;

    const bound = new Map<string, number>(); // param name → arg index
    let seenNamed = false;
    let positional = 0;

    args.forEach((arg, i) => {
      if (arg.name === undefined) {
        if (seenNamed) {
          this.error("E0010", "positional argument after a named one", arg.span, "positional argument", [
            { kind: "help", text: "put positional arguments before named ones" },
          ]);
          // Still bind it below, so it isn't also reported as a missing argument.
        }
        const param = params[positional++];
        if (!param) {
          const n = params.length;
          const given = args.filter((a) => a.name === undefined).length;
          this.error(
            "E0010",
            `${calleeName} takes ${n} ${n === 1 ? "argument" : "arguments"} but ${given} were given`,
            arg.span,
            "unexpected argument",
          );
          return;
        }
        bound.set(param.name, i);
        return;
      }

      seenNamed = true;
      const param = params.find((p) => p.name === arg.name);
      if (!param) {
        const suggestion = closest(arg.name, params.map((p) => p.name));
        this.error(
          "E0010",
          `unknown argument \`${arg.name}\``,
          arg.nameSpan!,
          `${calleeName} has no argument with this name`,
          suggestion ? [{ kind: "help", text: `did you mean \`${suggestion}\`?` }] : undefined,
        );
        return;
      }
      if (bound.has(param.name)) {
        this.error("E0010", `argument \`${param.name}\` is given twice`, arg.span, "already given");
        return;
      }
      bound.set(param.name, i);
    });

    for (const param of params) {
      const i = bound.get(param.name);
      if (i === undefined) {
        if (!param.optional) {
          this.error("E0010", `missing argument \`${param.name}\``, callSpan, `${calleeName} needs \`${param.name}\``);
        }
        continue;
      }
      const ty = types[i]!;
      if (ty.name === "error") continue;
      if (param.type !== "any" && ty.name !== param.type) {
        this.error(
          "E0007",
          `expected \`${param.type}\` for \`${param.name}\`, found \`${ty.name}\``,
          args[i]!.value.span,
          `this is a \`${ty.name}\``,
        );
      }
    }
  }

  private error(code: Diagnostic["code"], message: string, span: Span, label: string, notes?: Diagnostic["notes"]) {
    this.diagnostics.push({ code, message, span, label, notes });
  }
}
