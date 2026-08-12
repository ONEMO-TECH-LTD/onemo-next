# Validation Record

Validation date: 2026-08-12

This record applies to the Grid Pixel calibration package, not the untouched GPT Pro source.

## Release build

The source was compiled and tested with Apple Clang in the execution environment:

```text
Clang C/C++ Release build     PASS
C++ acceptance suite          PASS
C ABI acceptance suite        PASS
```

Sanitizer, GCC, Wasm, and target-device runs remain release gates; they are not claimed by this local proposal run.

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

Release build, 1,000-vertex polygon, bands 2 and 3, 1,000 hot iterations and 100 cold iterations. Fresh local results are recorded after the acceptance suite is run.

```text
hot solve mean                  6.88 ms
validation + solve mean         7.33 ms
8,100-point preparation         1.21 ms (5,872 canonical vertices)
```

The figures describe this container only. They are not a substitute for target iOS, Android, Safari WebAssembly, and Chrome WebAssembly benchmarks.

## Covered fixtures

```text
72 mm square -> four magnets, four links
72 x 24 rectangle -> adjacent pair
L shape -> three nodes, two links
72 x 23 aspect -> 84 mm first passing size
120 x 24 band-3 rectangle -> three-node run
sparse disabled by engagement band at band 2
sparse connected-pair requirement at band 3
exact tangency
exact 12 mm neutral flap extent
18 mm neutral extent and local-tongue evidence
full layout at 96 wins over earlier pair
thin antenna narrow-limb exception
cove visible to local evidence despite bbox extent
U corridor retains four discs but is not a complete direct-link layout
circle passes a side-midpoint tongue and is not labelled a narrow limb
18 mm overhang fails 12 mm coverage and passes 24 mm coverage
168 mm band-4 square
prepare-once multi-band C ABI
source scale/translation/winding/start invariance
large absolute source origin
self-intersection rejection
adjacent-edge backtracking rejection
illegal custom size rejection
C ABI error isolation
```
