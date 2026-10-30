// Tokens → syntax tree (GRAMMAR.md §3). Hand-written recursive descent.
// On a syntax error the parser skips to the next `;` and keeps going, so one run can report many errors.

import type { Arg, Expr, Program } from "./ast.ts";
import { join, type Diagnostic } from "./diagnostics.ts";
import { describe, type Token, type TokenKind } from "./lexer.ts";

class SyntaxError {
  constructor(readonly diagnostic: Diagnostic) {}
}

export function parse(tokens: Token[]): { program: Program; diagnostics: Diagnostic[] } {
  return new Parser(tokens).parseProgram();
}

class Parser {
  private pos = 0;
  private diagnostics: Diagnostic[] = [];

  constructor(private tokens: Token[]) {}

  parseProgram() {
    const exprs: Expr[] = [];
    let hasResult = false;

    while (this.peek().kind !== "EOF") {
      try {
        exprs.push(this.parseExpr());
        if (this.peek().kind === ";") {
          this.advance();
          continue;
        }
        if (this.peek().kind === "EOF") {
          hasResult = true;
          break;
        }
        throw this.error(this.peek(), `expected \`;\`, found ${describe(this.peek())}`, "expected `;` here");
      } catch (e) {
        if (!(e instanceof SyntaxError)) throw e;
        this.diagnostics.push(e.diagnostic);
        this.recover();
      }
    }
    return { program: { exprs, hasResult }, diagnostics: this.diagnostics };
  }

  private recover() {
    while (this.peek().kind !== ";" && this.peek().kind !== "EOF") this.advance();
    if (this.peek().kind === ";") this.advance();
  }

  // expr = let_expr | sum
  private parseExpr(): Expr {
    if (this.peek().kind !== "let") return this.parseSum();

    const letToken = this.advance();
    const name = this.peek();
    if (name.kind !== "IDENT") {
      throw this.error(name, `expected a name after \`let\`, found ${describe(name)}`, "expected a name");
    }
    this.advance();
    this.expect("=", "expected `=` after the name");
    const value = this.parseExpr();
    return { kind: "let", name: name.name, nameSpan: name.span, value, span: join(letToken.span, value.span) };
  }

  // sum = postfix { ("+" | "-") postfix }
  private parseSum(): Expr {
    let left = this.parsePostfix();
    for (let t = this.peek(); t.kind === "+" || t.kind === "-"; t = this.peek()) {
      this.advance();
      const right = this.parsePostfix();
      left = { kind: "binary", op: t.kind, left, right, span: join(left.span, right.span) };
    }
    return left;
  }

  // postfix = primary { "." IDENT | "(" [args] ")" }
  private parsePostfix(): Expr {
    let e = this.parsePrimary();
    for (;;) {
      const t = this.peek();
      if (t.kind === ".") {
        this.advance();
        const name = this.peek();
        if (name.kind !== "IDENT") {
          throw this.error(name, `expected a member name after \`.\`, found ${describe(name)}`, "expected a name");
        }
        this.advance();
        e = { kind: "member", object: e, name: name.name, nameSpan: name.span, span: join(e.span, name.span) };
      } else if (t.kind === "(") {
        this.advance();
        const args = this.parseArgs();
        const close = this.expect(")", "expected `)` to close the call");
        e = { kind: "call", callee: e, args, span: join(e.span, close.span) };
      } else {
        return e;
      }
    }
  }

  // args = arg { "," arg } ; arg = [IDENT "="] expr
  private parseArgs(): Arg[] {
    const args: Arg[] = [];
    if (this.peek().kind === ")") return args;
    for (;;) {
      const t = this.peek();
      if (t.kind === "IDENT" && this.peek(1).kind === "=") {
        this.advance();
        this.advance();
        const value = this.parseExpr();
        args.push({ name: t.name, nameSpan: t.span, value, span: join(t.span, value.span) });
      } else {
        const value = this.parseExpr();
        args.push({ value, span: value.span });
      }
      if (this.peek().kind !== ",") return args;
      this.advance();
    }
  }

  private parsePrimary(): Expr {
    const t = this.peek();
    switch (t.kind) {
      case "DICE":
        this.advance();
        return { kind: "dice", count: t.count, sides: t.sides, text: t.text, span: t.span };
      case "VALUE":
        this.advance();
        return { kind: "value", value: t.value, span: t.span };
      case "NUMBER":
        this.advance();
        return { kind: "number", value: t.value, span: t.span };
      case "true":
      case "false":
        this.advance();
        return { kind: "bool", value: t.kind === "true", span: t.span };
      case "IDENT":
        this.advance();
        return { kind: "ident", name: t.name, span: t.span };
      case "(": {
        this.advance();
        const inner = this.parseExpr();
        const close = this.expect(")", "expected `)`");
        return { ...inner, span: join(t.span, close.span) };
      }
      case "let":
        throw this.error(t, "`let` needs parentheses here", "`let` takes everything to its right", [
          { kind: "help", text: "wrap it in parentheses: `(let x = ...)`" },
        ]);
      case "-":
        throw this.error(t, "expected an expression, found `-`", "expected an expression", [
          { kind: "note", text: "`-` is only infix; there is no negation yet" },
        ]);
      default:
        throw this.error(t, `expected an expression, found ${describe(t)}`, "expected an expression");
    }
  }

  private peek(ahead = 0): Token {
    return this.tokens[Math.min(this.pos + ahead, this.tokens.length - 1)]!;
  }

  private advance(): Token {
    const t = this.peek();
    if (t.kind !== "EOF") this.pos++;
    return t;
  }

  private expect(kind: TokenKind, label: string): Token {
    const t = this.peek();
    if (t.kind !== kind) throw this.error(t, `expected \`${kind}\`, found ${describe(t)}`, label);
    return this.advance();
  }

  private error(at: Token, message: string, label: string, notes?: Diagnostic["notes"]) {
    return new SyntaxError({ code: "E0001", message, span: at.span, label, notes });
  }
}
