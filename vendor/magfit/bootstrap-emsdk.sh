#!/usr/bin/env bash
# Provision emscripten for the NORMAL build — no committed artifacts, no hand-built binaries.
# Local machines that already have em++ (brew, emsdk) pass straight through. Build machines
# without it (Vercel) get the pinned SDK, cached under .next/cache so later deploys reuse it.
set -euo pipefail

if command -v em++ >/dev/null 2>&1; then
  echo "emscripten present: $(command -v em++)"
  return 0 2>/dev/null || exit 0
fi

EMSDK_VERSION="4.0.15"
CACHE_DIR="${EMSDK_CACHE_DIR:-$PWD/.next/cache/emsdk}"

if [[ ! -x "$CACHE_DIR/upstream/emscripten/em++" ]]; then
  echo "provisioning emsdk $EMSDK_VERSION into $CACHE_DIR"
  rm -rf "$CACHE_DIR"
  git clone --depth 1 https://github.com/emscripten-core/emsdk.git "$CACHE_DIR"
  "$CACHE_DIR/emsdk" install "$EMSDK_VERSION"
  "$CACHE_DIR/emsdk" activate "$EMSDK_VERSION"
fi

export PATH="$CACHE_DIR/upstream/emscripten:$PATH"
echo "emscripten provisioned: $(command -v em++)"
