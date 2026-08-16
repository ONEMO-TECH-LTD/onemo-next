# Effects Studio integration guide

## Required seam

The engine begins after the existing browser shell has produced one validated outer contour. The shell must provide millimetre coordinates or a declared conversion to millimetres. Pixels, alpha masks and image tracing are outside this package.

## Client route sequence

1. Load the Effects Studio page.
2. Begin lazy import of `@onemo/magnetic-logic` through `loadMagneticEngine`.
3. When the editor emits a stable contour, call `adaptStudioOutline`.
4. Run `useMagneticSolutions` or `solveOutline` in summary mode.
5. Render each `BandOffer` and its centres.
6. When the user chooses a band, run `certifyAndBindSelectedBand`.
7. Persist the returned canonical ManufacturingSpec; do not reconstruct it from UI state.
8. Verify again server-side before accepting the production handoff.

## Outline adapter

```ts
const canonicalOutline = adaptStudioOutline(editorOutline, {
  inputYAxis: 'DOWN',
  centreOnBounds: true,
  scaleToMm: 1
});
```

The adapter flips the canvas axis when required and moves the bbox centre to `(0,0)`. It does not simplify or repair geometry.

## Lazy loading

```ts
const engine = await loadMagneticEngine();
const result = await engine.solveOutline({
  outlineMm: canonicalOutline,
  profile,
  diagnosticLevel: 'summary'
});
```

## Persistence

Use `serializeManufacturingSpec` and `parseManufacturingSpec`. Store the exact serialized payload and its hash. Do not save only `B3`, a pattern label, or visible pixel coordinates.

## Server verification

```ts
verifyOnServer(spec, registeredProfile);
```

Verification checks artifact hashes, profile hash, canonical hash, final geometry hash and exact centre containment at the effective verification radius.

## Error handling

Treat stable codes as state, not as prose. In particular:

- `DECISION_INDETERMINATE`: do not emit a size/product offer.
- `FEASIBLE_BELOW_OUTPUT_QUANTUM`: do not manufacture.
- `EXACT_REVALIDATION_FAILED`: reject candidate.
- artifact/profile/hash mismatch: hard stop.
- `REFERENCE_PROFILE_NOT_PRODUCTION`: calibrate and approve a production profile.
