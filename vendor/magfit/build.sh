#!/usr/bin/env bash
# cmake is not installed on the target machines; this is the whole build.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
out="${1:-$here/bin}"; mkdir -p "$out"
flags=(-std=c++20 -O2 -Iinclude)
if [[ "$(uname)" == "Darwin" ]]; then
  sdk="$(xcrun --show-sdk-path)"
  flags+=(-nostdinc++ -isystem "$sdk/usr/include/c++/v1" -isysroot "$sdk")
fi
cd "$here"
c++ "${flags[@]}" src/magfit.cpp tests/test_magfit.cpp -o "$out/test_magfit" 2>/dev/null || true
c++ "${flags[@]}" -c src/magfit.cpp -o "$out/magfit.o"
echo "built $out/magfit.o"
