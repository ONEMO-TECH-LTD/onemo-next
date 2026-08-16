# `@onemo/magnetic-next`

Thin React/Next.js integration package. It contains no product rules.

## Exports

- `loadMagneticEngine`
- `adaptStudioOutline`
- `useMagneticSolutions`
- `ShapeSolutionOverlay`
- `solutionViewModels`
- `bindSelectedBand`
- `certifyAndBindSelectedBand`
- `serializeManufacturingSpec` / `parseManufacturingSpec`
- `verifyOnServer`

## Recommended flow

1. Use `useMagneticSolutions` for live preview offers.
2. Display exact width/height and centre overlays.
3. On selection, run `certifyAndBindSelectedBand`.
4. Persist only the returned canonical spec.
5. Run `verifyOnServer` before creating a fulfilment record.

The package declares React and Next as peer dependencies and does not bundle them. The source compiles without React installed by using a local declaration shim; the host application supplies the real runtime and types.

A reference App Router page is included under `example/app/page.tsx`.
