# dice-lang

A small language for rolling dice and computing their probabilities. The language is defined in
[GRAMMAR.md](GRAMMAR.md).

```sh
bun index.ts program.dice              # random rolls
bun index.ts program.dice --seed       # rolls from the default seed (0)
bun index.ts program.dice --seed=42    # rolls from seed 42
```

## Tests

```sh
bun test                # everything
UPDATE=1 bun test       # rewrite tests/cases/*.out and *.err from the current output
```

Each `tests/cases/<name>.dice` is run and compared with `<name>.out` (stdout) or `<name>.err` (stderr).
An optional `<name>.args` holds `--seed=N`; otherwise the seed is 0.
