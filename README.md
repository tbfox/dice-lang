# dice-lang

A small language for rolling dice and computing their probabilities. The language is defined in
[GRAMMAR.md](GRAMMAR.md).

```dice
let dmg = 2d6 + 3;
print(dmg);         // probability of each outcome
print(dmg.mean);    // 10
dmg.roll()          // a random total
```

## Install

On macOS or Linux:

```sh
curl -fsSL https://raw.githubusercontent.com/tbfox/dice-lang/main/install.sh | sh
```

This puts `dice` in `~/.local/bin`. Set `DICE_INSTALL_DIR` to install somewhere else, or `DICE_VERSION`
(e.g. `v0.1.0`) for a specific release. On Windows, download `dice-windows-x64.exe` from the
[releases page](https://github.com/tbfox/dice-lang/releases).

## Usage

```sh
dice program.dice                  # random rolls
dice program.dice --seed           # rolls from the default seed (0)
dice program.dice --seed=42        # rolls from seed 42
dice program.dice --watch          # run again every time the file is saved
dice --help
```

## Development

Needs [Bun](https://bun.com).

```sh
bun install
bun link                # puts `dice` on your PATH, running this checkout
bun index.ts program.dice
```

### Tests

```sh
bun test                # everything
UPDATE=1 bun test       # rewrite tests/cases/*.out and *.err from the current output
```

Each `tests/cases/<name>.dice` is run and compared with `<name>.out` (stdout) or `<name>.err` (stderr).
An optional `<name>.args` holds `--seed=N`; otherwise the seed is 0.

### Releasing

1. Update `version` in `package.json` and commit.
2. `git tag v<version> && git push origin v<version>`

The [release workflow](.github/workflows/release.yml) tests, builds binaries for macOS, Linux and Windows,
and publishes them as a GitHub release.

If pushing the tag doesn't start the workflow, `bun run release:trigger` starts it on the tag for the
current `package.json` version.

## License

[MIT](LICENSE)
