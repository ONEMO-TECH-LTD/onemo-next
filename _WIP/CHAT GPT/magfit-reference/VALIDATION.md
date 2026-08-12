# Validation Record

Validation date: 2026-08-12

## Release builds

The source was configured, compiled, and tested with both compiler families available in the execution environment:

```text
GNU C/C++ Release build       PASS
Clang C/C++ Release build     PASS
C++ acceptance suite          PASS
C ABI acceptance suite        PASS
```

## Sanitizers

Clang Debug build with:

```text
-fsanitize=address,undefined -fno-omit-frame-pointer
```

Result:

```text
C++ acceptance suite          PASS
C ABI acceptance suite        PASS
AddressSanitizer findings     none reported
UndefinedBehavior findings    none reported
```

## Deterministic corpus

The C++ suite includes a fixed-seed corpus of 100 valid 48-vertex radial polygons. For each polygon it compares the result against a translated, winding-reversed, start-index-rotated representation.

Compared fields include:

```text
fit/no-fit
manufactured size
selected magnets
selected layout
non-negative selected slack
```

Result: PASS.

## Reference performance

Release build, 1,000-vertex polygon, bands 2 and 3, 1,000 hot iterations and 100 cold iterations:

```text
hot solve mean                  approximately 3.3 ms
validation + solve mean         approximately 8.9 ms
```

The figures describe this container only. They are not a substitute for target iOS, Android, Safari WebAssembly, and Chrome WebAssembly benchmarks.

## Covered fixtures

```text
72 mm square -> four magnets, four links
72 x 24 rectangle -> adjacent pair
L shape -> three nodes, two links
72 x 23 aspect -> 84 mm first passing size
120 x 24 band-3 rectangle -> three-node run
sparse ANY and sparse ALL phase behaviour
exact tangency
exact 12 mm flap switch
source scale/translation/winding/start invariance
large absolute source origin
self-intersection rejection
adjacent-edge backtracking rejection
illegal custom size rejection
C ABI error isolation
```
