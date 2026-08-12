#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "$0")" && pwd)
build_dir=${1:-"$root/build-local"}
cxx=${CXX:-c++}
cc=${CC:-cc}
sdk_args=()

if [[ $(uname -s) == Darwin ]]; then
  sdk=$(xcrun --show-sdk-path)
  sdk_args=(-nostdinc++ -isystem "$sdk/usr/include/c++/v1" -isysroot "$sdk")
fi

mkdir -p "$build_dir"
common=(-std=c++20 -O2 -Wall -Wextra -Wpedantic -Werror "${sdk_args[@]}" -I"$root/include")

"$cxx" "${common[@]}" "$root/src/magfit.cpp" "$root/tests/test_magfit.cpp" \
  -o "$build_dir/test_magfit"
"$cxx" "${common[@]}" -c "$root/src/magfit.cpp" -o "$build_dir/magfit.o"
"$cxx" "${common[@]}" -c "$root/src/magfit_c.cpp" -o "$build_dir/magfit_c.o"
"$cc" -std=c11 -O2 -Wall -Wextra -Wpedantic -Werror -I"$root/include" \
  -c "$root/tests/test_magfit_c.c" -o "$build_dir/test_magfit_c.o"
"$cxx" "${sdk_args[@]}" "$build_dir/magfit.o" "$build_dir/magfit_c.o" \
  "$build_dir/test_magfit_c.o" -o "$build_dir/test_magfit_c"
"$cxx" "${common[@]}" "$root/src/magfit.cpp" "$root/bench/bench_magfit.cpp" \
  -o "$build_dir/bench_magfit"

"$build_dir/test_magfit"
"$build_dir/test_magfit_c"
"$build_dir/bench_magfit"
