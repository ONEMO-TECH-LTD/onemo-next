# Quick start

## Run the bundled demonstration

```bash
node scripts/run-demo.mjs
```

The demonstration:

1. loads the immutable reference profile;
2. evaluates one validated millimetre outline;
3. prints the offered size in each band;
4. selects one offer;
5. creates and verifies the engine-side ManufacturingSpec;
6. shows that fulfilment is intentionally blocked while the reference profile is not production-ready.

## Use from a Next.js Effects Studio route

Install or copy the three packages into the host workspace, then import only the adapter at the route that needs it:

```tsx
'use client';

import { useMemo } from 'react';
import { createReferenceProfile } from '@onemo/magnetic-logic';
import { ShapeSolutionOverlay, useMagneticSolutions } from '@onemo/magnetic-next';

export function MagneticSizing({ outline }) {
  const profile = useMemo(() => createReferenceProfile(), []);
  const state = useMagneticSolutions(outline, profile);

  if (state.status === 'loading') return <p>Calculating…</p>;
  if (state.status === 'error') return <p>{state.error?.message}</p>;

  return state.result?.offers.map(offer => (
    <section key={offer.band}>
      <h2>{offer.band}</h2>
      {offer.solution && <ShapeSolutionOverlay solution={offer.solution} coordinateQuantumMm={profile.numeric.coordinateQuantumMm} />}
    </section>
  ));
}
```

The hook uses the low-latency preview solve. Before issuing a production ManufacturingSpec, call `certifyAndBindSelectedBand` with the original Studio outline and the selected band.

## Calibrate for production

Do not change the geometry package. Clone the production profile template under:

```text
packages/magnetic-logic/profiles/onemo-magnetic-v1-production-template.json
```

Resolve every template marker, register/hash the profile, run the complete verification corpus, and set `productionReady: true` only after the process/component tolerances and continuous certification path pass.
