// Source text → tokens (GRAMMAR.md §2).

import { span, type Diagnostic, type Span } from "./diagnostics.ts";

export type Token =
  | { kind: "DICE"; count: bigint; sides: bigint; text: string; span: Span }
  | { kind: "VALUE"; value: bigint; span: Span }
  | { kind: "NUMBER"; value: bigint; span: Span }
  | { kind: "IDENT"; name: string; span: Span }
  | { kind: "let" | "true" | "false"; span: Span }
  | { kind: "=" | ";" | "+" | "-" | "." | "(" | ")" | ","; span: Span }
  | { kind: "EOF"; span: Span };

export type TokenKind = Token["kind"];

const KEYWORDS = new Set(["let", "true", "false"]);
const PUNCTUATION = new Set(["=", ";", "+", "-", ".", "(", ")", ","]);

const isWordChar = (c: string) => /[A-Za-z0-9_]/.test(c);

export function lex(source: string): { tokens: Token[]; diagnostics: Diagnostic[] } {
  const tokens: Token[] = [];
  const diagnostics: Diagnostic[] = [];
  let i = 0;

  while (i < source.length) {
    const c = source[i]!;

    if (/\s/.test(c)) {
      i++;
      continue;
    }

    if (c === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }

    if (PUNCTUATION.has(c)) {
      tokens.push({ kind: c as "=", span: span(i, i + 1) });
      i++;
      continue;
    }

    if (isWordChar(c)) {
      const start = i;
      while (i < source.length && isWordChar(source[i]!)) i++;
      const word = source.slice(start, i);
      tokens.push(lexWord(word, span(start, i), diagnostics));
      continue;
    }

    diagnostics.push({
      code: "E0001",
      message: `unexpected character \`${c}\``,
      span: span(i, i + 1),
      label: "not part of the language",
    });
    i++;
  }

  tokens.push({ kind: "EOF", span: span(source.length, source.length) });
  return { tokens, diagnostics };
}

function lexWord(word: string, sp: Span, diagnostics: Diagnostic[]): Token {
  const dice = /^(\d*)d(\d+)$/.exec(word);
  if (dice) {
    const count = dice[1] === "" ? 1n : BigInt(dice[1]!);
    const sides = BigInt(dice[2]!);
    if (count < 1n) {
      diagnostics.push({
        code: "E0003",
        message: "dice need a count of at least 1",
        span: sp,
        label: `this rolls ${count} dice`,
      });
    } else if (sides < 2n) {
      diagnostics.push({
        code: "E0003",
        message: "a die needs at least 2 sides",
        span: sp,
        label: `this die has ${sides} ${sides === 1n ? "side" : "sides"}`,
      });
    }
    return { kind: "DICE", count, sides, text: word, span: sp };
  }

  if (/^\d+$/.test(word)) return { kind: "NUMBER", value: BigInt(word), span: sp };

  if (/^\d/.test(word)) {
    diagnostics.push({
      code: "E0002",
      message: `invalid word \`${word}\``,
      span: sp,
      label: "a word starting with a digit must be a number or dice",
    });
    // Stand in a number so the parser doesn't report a second error for the same word.
    return { kind: "NUMBER", value: 0n, span: sp };
  }

  const value = /^v(\d+)$/.exec(word);
  if (value) return { kind: "VALUE", value: BigInt(value[1]!), span: sp };

  if (KEYWORDS.has(word)) return { kind: word as "let", span: sp };

  if (word.startsWith("__")) {
    diagnostics.push({
      code: "E0004",
      message: `\`${word}\` is a reserved name`,
      span: sp,
      label: "names starting with `__` belong to the language",
    });
  }
  return { kind: "IDENT", name: word, span: sp };
}

/** How a token appears in "expected X, found Y" messages. */
export function describe(token: Token): string {
  switch (token.kind) {
    case "EOF":
      return "end of file";
    case "DICE":
      return `\`${token.text}\``;
    case "VALUE":
      return `\`v${token.value}\``;
    case "NUMBER":
      return `\`${token.value}\``;
    case "IDENT":
      return `\`${token.name}\``;
    default:
      return `\`${token.kind}\``;
  }
}
