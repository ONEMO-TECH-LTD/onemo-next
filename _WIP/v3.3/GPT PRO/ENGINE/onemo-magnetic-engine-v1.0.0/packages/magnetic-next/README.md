# `@onemo/magnetic-next`

Thin React/Next.js integration package. It contains no product rules.

## Exports

- `loadMagneticEngine`
- `adaptStudioOutline`
- `useMagneticSolutions`
- `ShapeSolutionOverlay`
- `solutionViewModels`
- `certifyAndBindSelectedBand`
- `serializeManufacturingSpec` / `parseManufacturingSpec`
- `verifyOnServer(spec, resolver)`

## Recommended flow

1. Use `useMagneticSolutions` for live preview offers.
2. Display exact width/height and centre overlays.
3. On selection, run `certifyAndBindSelectedBand`; it rejects any outline whose canonical source identity differs from preview.
4. Persist only the returned canonical spec.
5. Run `verifyOnServer` with the deployment's pinned profile/artifact resolver before creating a fulfilment record.

The package declares React and Next as peer dependencies and does not bundle them. Its source and example compile against the real React type package used by the host application.

A reference App Router page is included under `example/app/page.tsx`.
