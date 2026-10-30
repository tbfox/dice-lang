// Keeps GRAMMAR.md honest: runs the §5 example program and compares it with the output block
// printed under it. Lines 2 to 6 from the end are random, so those are skipped.

import { expect, test } from "bun:test";
import { join } from "node:path";
import { run } from "../src/run.ts";

test("GRAMMAR.md §5 example matches its documented output", async () => {
  const spec = await Bun.file(join(import.meta.dir, "..", "GRAMMAR.md")).text();
  const section = spec.slice(spec.indexOf("## 5. Example program"), spec.indexOf("## 6."));
  const blocks = [...section.matchAll(/```(\w*)\n([\s\S]*?)```/g)];
  const program = blocks.find((b) => b[1] === "dice")![2]!;
  const documented = blocks.find((b) => b[1] === "")![2]!.trimEnd().split("\n");

  const actual = run(program, { seed: 0n }).stdout.trimEnd().split("\n");
  expect(actual.length).toBe(documented.length);

  const isRandom = (i: number) => {
    const fromEnd = documented.length - i;
    return fromEnd >= 2 && fromEnd <= 6;
  };
  documented.forEach((line, i) => {
    if (!isRandom(i)) expect(actual[i]).toBe(line);
  });
});
