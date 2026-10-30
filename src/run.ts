// Source text → stdout, stderr and exit code. The CLI and the tests both go through here.

import { check } from "./check.ts";
import { renderDiagnostics } from "./diagnostics.ts";
import { evaluate } from "./eval.ts";
import { lex } from "./lexer.ts";
import { parse } from "./parser.ts";
import { randomSeed, Rng } from "./rng.ts";

export interface RunOptions {
  /** File name shown in errors. */
  file?: string;
  /** Without a seed, rolls are random. */
  seed?: bigint;
  /** Color errors with ANSI codes. */
  color?: boolean;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function run(source: string, options: RunOptions = {}): RunResult {
  const { file = "program.dice", seed = randomSeed(), color = false } = options;

  const lexed = lex(source);
  const parsed = parse(lexed.tokens);
  const diagnostics = [...lexed.diagnostics, ...parsed.diagnostics];
  // After a syntax error parts of the program are missing, so checking it would report errors
  // that aren't really there (e.g. a variable whose `let` didn't parse).
  if (!diagnostics.some((d) => d.code === "E0001")) diagnostics.push(...check(parsed.program));

  if (diagnostics.length > 0) {
    return { stdout: "", stderr: renderDiagnostics(diagnostics, source, file, color), exitCode: 1 };
  }

  const out: string[] = [];
  evaluate(parsed.program, new Rng(seed), out);
  return { stdout: out.join("\n") + "\n", stderr: "", exitCode: 0 };
}
