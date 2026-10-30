// Golden tests: every tests/cases/<name>.dice runs and its output is compared with
//   <name>.out   expected stdout (exit code 0)
//   <name>.err   expected stderr (exit code 1, stdout empty)
//   <name>.args  optional `--seed=N`; without it the seed is 0
//
// `UPDATE=1 bun test` rewrites the expected files from the current output. Review them with `git diff`.

import { expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { run } from "../src/run.ts";

const dir = join(import.meta.dir, "cases");
const update = process.env.UPDATE === "1";

for (const name of readdirSync(dir).filter((f) => f.endsWith(".dice")).sort()) {
  const stem = basename(name, ".dice");

  test(stem, async () => {
    const source = await Bun.file(join(dir, name)).text();
    const argsFile = Bun.file(join(dir, `${stem}.args`));
    const args = (await argsFile.exists()) ? (await argsFile.text()).trim() : "";
    const seed = /^--seed=(\d+)$/.exec(args)?.[1] ?? "0";

    const result = run(source, { file: name, seed: BigInt(seed) });
    const outFile = Bun.file(join(dir, `${stem}.out`));
    const errFile = Bun.file(join(dir, `${stem}.err`));

    if (update) {
      if (result.exitCode === 0) {
        await Bun.write(outFile, result.stdout);
        if (await errFile.exists()) await errFile.delete();
      } else {
        await Bun.write(errFile, result.stderr);
        if (await outFile.exists()) await outFile.delete();
      }
      return;
    }

    if (await errFile.exists()) {
      expect(result.stderr).toBe(await errFile.text());
      expect(result.stdout).toBe("");
      expect(result.exitCode).toBe(1);
    } else {
      expect(result.stdout).toBe(await outFile.text());
      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
    }
  });
}
