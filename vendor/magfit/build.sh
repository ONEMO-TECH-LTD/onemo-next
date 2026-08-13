#!/usr/bin/env bash
# Build AND GATE the native engine: acceptance suite must compile and pass, CLI must build.
# No suppressed stderr, no `|| true` — a failure here is a failure (auditor R12).
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
out="${1:-$here/bin}"; mkdir -p "$out"
flags=(-std=c++20 -O2 -Iinclude)
if [[ "$(uname)" == "Darwin" ]]; then
  sdk="$(xcrun --show-sdk-path)"
  flags+=(-nostdinc++ -isystem "$sdk/usr/include/c++/v1" -isysroot "$sdk")
fi
cd "$here"
c++ "${flags[@]}" src/magfit.cpp tests/test_magfit.cpp -o "$out/test_magfit"
"$out/test_magfit"
c++ "${flags[@]}" src/magfit.cpp cli/measure_cli.cpp -o "$out/measure_cli"
echo "built and gated: $out/measure_cli"
