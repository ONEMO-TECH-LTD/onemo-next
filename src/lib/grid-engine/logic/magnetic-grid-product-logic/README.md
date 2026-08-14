# Magnetic-grid product logic

Standalone TypeScript product-ordering layer for accepted magnetic-grid candidate and measurement documents.

It contains **only this layer**. It does not contain or execute the measurement kernel or candidate enumerator.

## Build and test

A TypeScript compiler is required on the build machine. The package has no runtime or package dependencies.

```bash
npm run build
npm test
```

`npm test` builds this package and runs only `test/product-logic.test.mjs`.

## API

```ts
import {
  applyProductLogic,
  serializeCanonical,
  type ApplyProductLogicInput,
} from "magnetic-grid-product-logic";

const result = applyProductLogic(input satisfies ApplyProductLogicInput);
const bytes = serializeCanonical(result);
```

See [`CONTRACT.md`](./CONTRACT.md) for the complete input and ordering law. See `fixtures/example-input.json` and `fixtures/example-output.canonical.json` for a complete wire example.

## Deliberate non-features

The package performs no geometry, creates no candidates, selects no winner, assigns no implicit status, and contains no size, family, population, density, step, clearance, or count preference.
