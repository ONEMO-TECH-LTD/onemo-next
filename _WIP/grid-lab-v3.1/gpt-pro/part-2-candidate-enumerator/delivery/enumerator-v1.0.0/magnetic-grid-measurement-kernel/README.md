# Magnetic-Grid Measurement Kernel

Exact, zero-dependency TypeScript geometry for:

1. full-disc containment at every supplied lattice position and size;
2. straight-capsule containment between two supplied lattice positions.

All product rules and all product values remain outside this package. See [`CONTRACT.md`](./CONTRACT.md) for the normative mathematical and API contract.

```bash
npm test
```

Primary exports:

```ts
import {
  measureLattice,
  measureStraightCapsule,
  serializeCanonical,
} from "./dist/index.js";
```
