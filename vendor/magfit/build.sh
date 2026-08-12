#!/usr/bin/env bash
# Build the magfit CLI. The C++ core itself is unmodified vendor source; only cli/ is ours.
# Apple's clang needs libc++ named explicitly when the Command Line Tools SDK is not the default.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
out="$here/bin"
mkdir -p "$out"

flags=(-std=c++20 -O2 -Iinclude)
if [[ "$(uname)" == "Darwin" ]]; then
  sdk="$(xcrun --show-sdk-path)"
  flags+=(-nostdinc++ -isystem "$sdk/usr/include/c++/v1" -isysroot "$sdk")
fi

cd "$here"
c++ "${flags[@]}" src/magfit.cpp cli/magfit_cli.cpp -o "$out/magfit_cli"
echo "built $out/magfit_cli"
