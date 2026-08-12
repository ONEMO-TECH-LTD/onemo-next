#!/usr/bin/env bash
# Compile the pure engine to WebAssembly — GPT Pro's own build shape, narrowed to the pure
# measurement exports. Run by the NORMAL build (see package.json prebuild): the .wasm is a build
# output, never checked in. A build that cannot compile the engine fails loudly here rather than
# serving a stale artifact.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=bootstrap-emsdk.sh — provisions em++ when the build machine lacks it (Vercel).
source "$here/bootstrap-emsdk.sh"
out="$here/wasm"
mkdir -p "$out"

em++ -O3 -std=c++20 -fwasm-exceptions \
  -I"$here/include" \
  "$here/src/magfit.cpp" "$here/cli/measure_wasm.cpp" \
  -sMODULARIZE=1 -sEXPORT_ES6=0 \
  -sENVIRONMENT=node \
  -sALLOW_MEMORY_GROWTH=1 \
  -sEXPORTED_FUNCTIONS='["_magfit_measure_json","_magfit_free","_malloc","_free"]' \
  -sEXPORTED_RUNTIME_METHODS='["ccall","UTF8ToString","stringToUTF8","lengthBytesUTF8"]' \
  -o "$out/magfit.cjs"

echo "built $out/magfit.cjs + $out/magfit.wasm"
