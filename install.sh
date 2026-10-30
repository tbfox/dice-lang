#!/bin/sh
# Installs the `dice` interpreter from GitHub releases.
#
#   curl -fsSL https://raw.githubusercontent.com/tbfox/dice-lang/main/install.sh | sh
#
# Settings (environment variables):
#   DICE_VERSION       a release tag such as v0.1.0 (default: the latest release)
#   DICE_INSTALL_DIR   where to put `dice` (default: ~/.local/bin)

set -eu

repo="tbfox/dice-lang"
install_dir="${DICE_INSTALL_DIR:-$HOME/.local/bin}"

fail() {
  echo "error: $1" >&2
  exit 1
}

case "$(uname -s)" in
  Darwin) os=darwin ;;
  Linux) os=linux ;;
  *) fail "unsupported system $(uname -s); download a binary from https://github.com/$repo/releases" ;;
esac

case "$(uname -m)" in
  arm64 | aarch64) arch=arm64 ;;
  x86_64 | amd64) arch=x64 ;;
  *) fail "unsupported processor $(uname -m)" ;;
esac

# An Intel shell on an Apple Silicon Mac (Rosetta) still gets the native binary.
if [ "$os" = darwin ] && [ "$arch" = x64 ] && [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || echo 0)" = 1 ]; then
  arch=arm64
fi

binary="dice-$os-$arch"
if [ -n "${DICE_VERSION:-}" ]; then
  base="https://github.com/$repo/releases/download/$DICE_VERSION"
else
  base="https://github.com/$repo/releases/latest/download"
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "Downloading $binary${DICE_VERSION:+ $DICE_VERSION}..."
curl -fsSL "$base/$binary" -o "$tmp/$binary" || fail "couldn't download $base/$binary"
curl -fsSL "$base/SHA256SUMS" -o "$tmp/SHA256SUMS" || fail "couldn't download $base/SHA256SUMS"

# Check the download against the published checksum.
expected="$(grep " $binary\$" "$tmp/SHA256SUMS" | cut -d ' ' -f 1)"
if command -v sha256sum >/dev/null 2>&1; then
  actual="$(sha256sum "$tmp/$binary" | cut -d ' ' -f 1)"
else
  actual="$(shasum -a 256 "$tmp/$binary" | cut -d ' ' -f 1)"
fi
[ -n "$expected" ] && [ "$expected" = "$actual" ] || fail "checksum mismatch for $binary"

mkdir -p "$install_dir"
chmod +x "$tmp/$binary"
mv "$tmp/$binary" "$install_dir/dice"

echo "Installed $("$install_dir/dice" --version) to $install_dir/dice"

case ":$PATH:" in
  *":$install_dir:"*) ;;
  *)
    echo
    echo "$install_dir is not on your PATH. Add this to your shell profile:"
    echo "  export PATH=\"$install_dir:\$PATH\""
    ;;
esac
