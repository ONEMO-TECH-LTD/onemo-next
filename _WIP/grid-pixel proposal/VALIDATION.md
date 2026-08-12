# Validation Record

Validation date: 2026-08-12

This record applies to the Grid Pixel review-mode proposal, not the untouched GPT Pro source.

## Release build

```text
Apple Clang C/C++ Release build    PASS
C++ review acceptance suite       PASS
C ABI review acceptance suite     PASS
```

Sanitizer, GCC, Wasm, and target-device runs remain release gates and are not claimed by this local run.

## Deterministic corpus

The C++ suite uses 30 fixed-seed valid 48-vertex radial polygons. Each result is compared with the same polygon translated, winding-reversed, and start-index-rotated.

The test compares every band's ordered option set, including size, magnets, verified links, source-window provenance, and non-negative exact slack.

Result: PASS.

## Measured performance

Apple Clang Release, 1,000-vertex polygon, bands 2 and 3, 100 hot iterations and 20 cold iterations:

```text
returned options per solve          147
hot enumeration mean                126.24 ms
validation + enumeration mean       130.89 ms
8,100-point preparation               1.52 ms (5,872 canonical vertices)
```

The prototype now builds evidence for every option; these numbers are therefore not comparable to the old winner-only solve as the same workload. Target iOS, Android, Safari Wasm, and Chrome Wasm measurements remain outstanding.

The C ABI surface reports 44 band-2 options and 844 band-3 options for the square fixture, including both the full four-disc layout and pair layouts at 72 mm. With sparse mode disabled, band 3 still reports the same 844 dense options. The default sparse policy labels 64 of them incompatible instead of hiding them.

## Covered fixtures

```text
72 mm square exposes the full four-node square and lawful pair subsets
all passing legal sizes remain present
band-3 circle at 120 exposes cross, linked-three and four-node L variants
overlapping parent windows deduplicate physical variants and retain provenance
band 2 does not engage sparse phases
band 3 retains every dense option and labels sparse compatibility under ANY
sparse ALL labels incompatibility without deleting the dense option
sparse-disabled and sparse-enabled runs have identical dense option sets
sparse-incompatible staircase remains reviewable
flap coverage is computed per option
U corridor retains a lawful non-full connected four-node option
168 mm band-4 square exposes the complete 4x4 option
single-call multi-band C ABI streams every option after one canonicalisation
source translation, winding and start-index invariance
invalid polygon and custom-size rejection
C ABI error isolation
```

## Unresolved release gates

- automatic selection is deliberately absent; manual review must establish whether one answer per band can be guaranteed;
- exact review-mode p95 and memory on target devices;
- sanitizer and cross-compiler runs;
- applied UI review of all options on the cut-out library.
