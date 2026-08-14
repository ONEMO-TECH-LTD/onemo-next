#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cmake -S "$ROOT" -B "$ROOT/build" -DCMAKE_BUILD_TYPE=Release
cmake --build "$ROOT/build" -j
ctest --test-dir "$ROOT/build" --output-on-failure

(
  cd "$ROOT/ts"
  npm test
)

node "$ROOT/ts/scripts/generateBenchmark.mjs"
node "$ROOT/scripts/verify_fixture.mjs"
