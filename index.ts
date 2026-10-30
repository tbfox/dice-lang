#!/usr/bin/env bun
// dice-lang interpreter (GRAMMAR.md §6).
//
//   dice program.dice              random rolls
//   dice program.dice --seed       rolls from the default seed (0)
//   dice program.dice --seed=42    rolls from seed 42
//   dice program.dice --watch      run again every time the file is saved
//   dice --help                    show help (also shown when run with no arguments)
//
// `dice` is this file, linked by `bun link`. `bun index.ts ...` works the same.

import { watch } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { run } from "./src/run.ts";

function help(): string {
  const tty = process.stdout.isTTY && !process.env.NO_COLOR;
  const style = (code: string) => (text: string) => (tty ? `\x1b[${code}m${text}\x1b[0m` : text);
  const bold = style("1");
  const head = style("1;4");
  const cmd = style("36");
  const dim = style("2");

  return `${bold("dice")} — roll dice and compute their probabilities

${head("Usage")}
  ${cmd("dice <program.dice>")} [options]

${head("Options")}
  ${cmd("--seed")}       roll from the default seed (0), so rolls repeat
  ${cmd("--seed=N")}     roll from seed N
  ${cmd("--watch")}      run again every time the file is saved
  ${cmd("-h, --help")}   show this help

${head("Examples")}
  ${cmd("dice attack.dice")}
  ${cmd("dice attack.dice --watch --seed")}

${head("A small program")}
  let dmg = 2d6 + 3;
  print(dmg);         ${dim("// probability of each outcome")}
  print(dmg.mean);    ${dim("// 10")}
  dmg.roll()          ${dim("// a random total")}

${dim(`Language reference: ${join(import.meta.dir, "GRAMMAR.md")}`)}
`;
}

function fail(message: string): never {
  process.stderr.write(`error: ${message}\nrun \`dice --help\` for usage\n`);
  process.exit(1);
}

let file: string | undefined;
let seed: bigint | undefined;
let watching = false;

for (const arg of process.argv.slice(2)) {
  if (arg === "--seed") {
    seed = 0n;
  } else if (arg.startsWith("--seed=")) {
    const value = arg.slice("--seed=".length);
    if (!/^\d+$/.test(value)) fail(`a seed must be a non-negative whole number, found \`${value}\``);
    seed = BigInt(value);
  } else if (arg === "--watch") {
    watching = true;
  } else if (arg === "--help" || arg === "-h") {
    process.stdout.write(help());
    process.exit(0);
  } else if (arg.startsWith("-")) {
    fail(`unknown option \`${arg}\``);
  } else if (file === undefined) {
    file = arg;
  } else {
    fail("only one program can be run at a time");
  }
}

if (file === undefined) {
  process.stdout.write(help());
  process.exit(0);
}
const path = file;

const color = process.stderr.isTTY && !process.env.NO_COLOR;

/** Runs the program once and returns its exit code. */
async function runOnce(): Promise<number> {
  const source = Bun.file(path);
  if (!(await source.exists())) {
    process.stderr.write(`error: couldn't read \`${path}\`: no such file\n`);
    return 1;
  }
  const result = run(await source.text(), { file: path, seed, color });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  return result.exitCode;
}

if (!watching) process.exit(await runOnce());

// Watch the folder rather than the file: many editors save by replacing the file,
// which would stop a watcher on the file itself.
const clear = process.stdout.isTTY ? "\x1b[2J\x1b[3J\x1b[H" : "";
const dim = (text: string) => (color ? `\x1b[2m${text}\x1b[0m` : text);
let timer: Timer | undefined;

async function rerun() {
  process.stdout.write(clear);
  const code = await runOnce();
  const time = new Date().toLocaleTimeString();
  process.stderr.write(dim(`\n[${code === 0 ? "ran" : "failed"} at ${time} — watching ${path}, Ctrl-C to stop]\n`));
}

await rerun();
watch(dirname(resolve(path)), (_, changed) => {
  if (changed !== basename(path)) return;
  // Editors often write a file in several steps; wait for them to finish.
  clearTimeout(timer);
  timer = setTimeout(rerun, 50);
});
