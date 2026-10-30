# dice-lang

A small language for rolling dice and computing their probabilities. The language is defined in
[GRAMMAR.md](GRAMMAR.md).

```sh
bun link                           # once: puts `dice` on your PATH

dice program.dice                  # random rolls
dice program.dice --seed           # rolls from the default seed (0)
dice program.dice --seed=42        # rolls from seed 42
dice program.dice --watch          # run again every time the file is saved
```

`bun index.ts ...` works the same as `dice ...`.

## Tests

```sh
bun test                # everything
UPDATE=1 bun test       # rewrite tests/cases/*.out and *.err from the current output
```

Each `tests/cases/<name>.dice` is run and compared with `<name>.out` (stdout) or `<name>.err` (stderr).
An optional `<name>.args` holds `--seed=N`; otherwise the seed is 0.
