// The real command line (GRAMMAR.md §6): flags, files and exit codes.

import { expect, test } from "bun:test";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const example = join(import.meta.dir, "cases", "example.dice");
const failing = join(import.meta.dir, "cases", "err_undefined.dice");

async function cli(...args: string[]) {
  const proc = Bun.spawn(["bun", join(root, "index.ts"), ...args], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, NO_COLOR: "1" },
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

test("--seed uses seed 0", async () => {
  const a = await cli(example, "--seed");
  const b = await cli(example, "--seed=0");
  expect(a.exitCode).toBe(0);
  expect(a.stdout).toBe(b.stdout);
});

test("--seed=N is repeatable", async () => {
  const a = await cli(example, "--seed=42");
  const b = await cli(example, "--seed=42");
  expect(a.stdout).toBe(b.stdout);
});

test("a bad seed is an error", async () => {
  const r = await cli(example, "--seed=-1");
  expect(r.exitCode).toBe(1);
  expect(r.stderr).toContain("non-negative whole number");
});

test("program errors go to stderr with exit code 1", async () => {
  const r = await cli(failing);
  expect(r.exitCode).toBe(1);
  expect(r.stdout).toBe("");
  expect(r.stderr).toContain("error[E0005]");
});

test("a missing file is an error", async () => {
  const r = await cli("nope.dice");
  expect(r.exitCode).toBe(1);
  expect(r.stderr).toContain("couldn't read");
});

test("no file prints usage", async () => {
  const r = await cli();
  expect(r.exitCode).toBe(1);
  expect(r.stderr).toContain("usage:");
});
