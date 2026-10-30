// dice-lang interpreter (GRAMMAR.md §6).
//
//   bun index.ts program.dice              random rolls
//   bun index.ts program.dice --seed       rolls from the default seed (0)
//   bun index.ts program.dice --seed=42    rolls from seed 42

import { run } from "./src/run.ts";

const usage = "usage: bun index.ts <program.dice> [--seed | --seed=N]";

function fail(message: string): never {
  process.stderr.write(`error: ${message}\n`);
  process.exit(1);
}

let file: string | undefined;
let seed: bigint | undefined;

for (const arg of process.argv.slice(2)) {
  if (arg === "--seed") {
    seed = 0n;
  } else if (arg.startsWith("--seed=")) {
    const value = arg.slice("--seed=".length);
    if (!/^\d+$/.test(value)) fail(`a seed must be a non-negative whole number, found \`${value}\``);
    seed = BigInt(value);
  } else if (arg.startsWith("-")) {
    fail(`unknown option \`${arg}\`\n${usage}`);
  } else if (file === undefined) {
    file = arg;
  } else {
    fail(`only one program can be run at a time\n${usage}`);
  }
}

if (file === undefined) fail(usage);

const source = Bun.file(file);
if (!(await source.exists())) fail(`couldn't read \`${file}\`: no such file`);

const color = process.stderr.isTTY && !process.env.NO_COLOR;
const result = run(await source.text(), { file, seed, color });
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exit(result.exitCode);
