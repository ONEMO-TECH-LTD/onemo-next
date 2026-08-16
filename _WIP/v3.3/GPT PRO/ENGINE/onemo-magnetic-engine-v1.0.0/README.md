# ONEMO Magnetic Free-Shape Engine

Portable end-to-end implementation of the approved Turn-1 architecture for sizing a validated free-shape cutout, registering it against the ONEMO cell board, selecting lawful magnetic layouts, and preserving the selected result as a verifiable manufacturing specification.

## Delivered packages

| Package | Role |
|---|---|
| `@onemo/geometry-compute` | Product-neutral geometry, exact final disc containment, safe/feasible regions, structural measurements, neutral criteria, deterministic hashing and certification primitives. |
| `@onemo/magnetic-logic` | Versioned product profile, bands, frames, registrations, pattern permissions, mechanics, size offers, certification, ManufacturingSpec and fulfilment verifier. |
| `@onemo/magnetic-next` | React/Next.js loader, outline adapter, hook, overlay, persistence, selected-size certification and server verification adapters. |

The authoritative source specifications are preserved unchanged under `specs/`.

## Important delivery status

The software is complete as a modular reference implementation and executable package. It contains two intentionally different solve paths:

1. **Interactive preview solve** — low-latency deterministic critical/witness candidate evaluation with exact final 24 mm-disc legality. It is suitable for live Effects Studio size and overlay previews.
2. **Continuous certification solve** — dominance-safe adaptive feasibility and mechanical optimisation for a selected physical size. It either returns a certified solution or an explicit `DECISION_INDETERMINATE`; it never guesses.

The bundled `onemo-magnetic-v1-reference` profile is deliberately `productionReady: false` because the supplied final specifications still leave product values without approved concrete data: structural thresholds, the complete permission matrix, the Batwoman vector fixture, physical process tolerances, the 96 mm population decision, and several product policies. The engine therefore blocks final physical fulfilment under that reference profile instead of inventing those values.

## Runtime backend

One production runtime is included: dependency-free TypeScript using integer-quantised canonical coordinates and `BigInt` in exact boundary predicates. C++/WASM was not selected because Emscripten was unavailable in the execution environment, so a reproducible WASM build could not pass the backend gate. See `reports/backend-probe.md`.

## Quick start

The ZIP contains compiled ESM output; no install is required to inspect or run the CLI example with Node 20+.

```bash
node scripts/run-demo.mjs
```

To rebuild from source where `tsc` is available:

```bash
npm run clean
npm run build
npm run test
npm run benchmark
```

`npm run build` creates local workspace links itself; no third-party runtime package is downloaded.

### Minimal API

```ts
import {
  createReferenceProfile,
  solveOutline,
  certifySizeSolution,
  createEngineManufacturingSpec
} from '@onemo/magnetic-logic';

const profile = createReferenceProfile();
const outlineMm = [
  { x: -60, y: -60 },
  { x:  60, y: -60 },
  { x:  60, y:  60 },
  { x: -60, y:  60 }
];

const preview = await solveOutline({ outlineMm, profile });
const selected = preview.offers.find(x => x.band === 'B3')?.solution;
if (!selected) throw new Error('No B3 solution');

const certified = certifySizeSolution({
  outlineMm,
  profile,
  targetDominantMm: selected.targetDominantMm
});

if (certified.status === 'ACCEPTED') {
  const spec = createEngineManufacturingSpec(preview, certified, profile);
  // Under the bundled reference profile this is marked non-production.
  console.log(spec);
}
```

## Coordinate contract

- Unit: millimetres at the profile's canonical integer quantum.
- Origin: source-outline bounding-box centre.
- `+X`: right.
- `+Y`: up.
- Ring: one simple counter-clockwise outer outline, implicit closure.
- No holes, disconnected contours, rotation, mirroring or non-uniform deformation in V1.

The Next adapter converts canvas/SVG down-positive coordinates before solving.

## Verification summary

- 25 automated Node tests currently pass.
- Exact tangency passes; one-quantum intrusion fails.
- Concave-edge intrusion is rejected.
- Canonical geometry, profiles, solve outputs and manufacturing payloads are content-addressed.
- Compute and Logic runtime hashes are generated from their compiled executable JavaScript, excluding only the self-referential manifest module.
- Current container benchmark and compressed sizes are in `reports/`.
- Browser automation was attempted, but this execution environment blocked Chromium navigation by administrator policy and did not contain WebKit. No physical-device claim is made.

## Main documentation

- `QUICKSTART.md`
- `ARCHITECTURE.md`
- `IMPLEMENTATION-STATUS.md`
- `INTEGRATION-GUIDE.md`
- `MANUFACTURING-HANDOFF.md`
- `packages/geometry-compute/MATHEMATICS.md`
- `packages/magnetic-logic/PROFILE-GUIDE.md`
- `reports/compliance-matrix.md`
- `reports/known-limitations.md`

## Release archives

`dist/` contains package-specific ZIP files. The parent delivery also includes one master ZIP containing the complete monorepo, specifications, generated packages, tests, reports and manifests.
