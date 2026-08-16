# `@onemo/magnetic-logic`

Versioned product-policy package for ONEMO magnetic free-shape effects.

## Main API

- `createReferenceProfile()`
- `registerProfile(profile)`
- `solveOutline(input)` — low-latency preview offers across bands
- `certifySizeSolution(input)` — continuous selected-size certification
- `selectedOffer(result, band)`
- `createEngineManufacturingSpec(result, solution, profile)`
- `verifyEngineManufacturingSpec(spec, profile)`
- `completeFulfilmentSpec(engineSpec, profile, physicalComponent)`
- `verifyFulfilmentSpec(spec, profile)`

## Profile lifecycle

- `draft`: editable; cannot run production.
- `approved`: canonicalised, hashed and deeply frozen.
- `retired`: unavailable for new products but retained for historical verification.

Any value change produces a new content hash. A released order is never reinterpreted under a newer profile.

## Reference profile

`profiles/onemo-magnetic-v1-reference.json` encodes the approved/proposed foundation values and conservative treatment of unresolved items. It is executable for development and editor preview but `productionReady: false`.

`profiles/onemo-magnetic-v1-production-template.json` lists the remaining calibration and approval work. See `PROFILE-GUIDE.md`.
