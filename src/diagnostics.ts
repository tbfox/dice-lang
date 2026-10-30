// Errors and their Rust-style rendering (GRAMMAR.md §7).

export interface Span {
  start: number; // offset of the first character
  end: number; // offset just past the last character
}

export type Code =
  | "E0001" // syntax error
  | "E0002" // invalid word
  | "E0003" // invalid die
  | "E0004" // reserved name
  | "E0005" // undefined variable
  | "E0006" // built-in name can't be bound
  | "E0007" // type error
  | "E0008" // field called, or method not called
  | "E0009" // unknown member
  | "E0010"; // bad arguments

export interface Diagnostic {
  code: Code;
  message: string;
  span: Span;
  label: string;
  notes?: { kind: "note" | "help"; text: string }[];
}

export function span(start: number, end: number): Span {
  return { start, end };
}

export function join(a: Span, b: Span): Span {
  return { start: Math.min(a.start, b.start), end: Math.max(a.end, b.end) };
}

const ansi = {
  boldRed: "\x1b[1;31m",
  boldBlue: "\x1b[1;34m",
  bold: "\x1b[1m",
  reset: "\x1b[0m",
};

/** Renders every diagnostic, in source order, followed by the "aborting" line. */
export function renderDiagnostics(
  diagnostics: Diagnostic[],
  source: string,
  file: string,
  color: boolean,
): string {
  const paint = (style: string, text: string) => (color ? style + text + ansi.reset : text);
  const sorted = [...diagnostics].sort((a, b) => a.span.start - b.span.start);
  const blocks = sorted.map((d) => renderOne(d, source, file, paint));

  const n = sorted.length;
  const summary =
    paint(ansi.boldRed, "error") +
    paint(ansi.bold, `: aborting due to ${n === 1 ? "1 previous error" : `${n} previous errors`}`);
  return [...blocks, summary].join("\n\n") + "\n";
}

function renderOne(
  d: Diagnostic,
  source: string,
  file: string,
  paint: (style: string, text: string) => string,
): string {
  const { line, col, lineStart, lineEnd } = locate(source, d.span.start);
  const text = source.slice(lineStart, lineEnd);
  // Carets stop at the end of the first line of the span.
  const caretLen = Math.max(1, Math.min(d.span.end, lineEnd) - d.span.start);
  const gutter = " ".repeat(String(line).length);
  const bar = paint(ansi.boldBlue, "|");

  const out = [
    paint(ansi.boldRed, `error[${d.code}]`) + paint(ansi.bold, `: ${d.message}`),
    `${gutter}${paint(ansi.boldBlue, "-->")} ${file}:${line}:${col}`,
    `${gutter} ${bar}`,
    `${paint(ansi.boldBlue, String(line))} ${bar} ${text}`,
    `${gutter} ${bar} ${" ".repeat(col - 1)}${paint(ansi.boldRed, "^".repeat(caretLen) + " " + d.label)}`,
  ];
  if (d.notes?.length) {
    out.push(`${gutter} ${bar}`);
    for (const note of d.notes) {
      out.push(`${gutter} ${paint(ansi.boldBlue, "=")} ${paint(ansi.bold, note.kind)}: ${note.text}`);
    }
  }
  return out.join("\n");
}

function locate(source: string, offset: number) {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === "\n") {
      line++;
      lineStart = i + 1;
    }
  }
  let lineEnd = source.indexOf("\n", lineStart);
  if (lineEnd === -1) lineEnd = source.length;
  return { line, col: offset - lineStart + 1, lineStart, lineEnd };
}

/** Closest name within a small edit distance, for "did you mean" hints. */
export function closest(name: string, candidates: Iterable<string>): string | undefined {
  let best: string | undefined;
  let bestDist = Math.max(1, Math.floor(name.length / 3)) + 1;
  for (const c of candidates) {
    const dist = editDistance(name, c);
    if (dist < bestDist) {
      best = c;
      bestDist = dist;
    }
  }
  return best;
}

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur.push(Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost));
    }
    prev = cur;
  }
  return prev[b.length]!;
}
