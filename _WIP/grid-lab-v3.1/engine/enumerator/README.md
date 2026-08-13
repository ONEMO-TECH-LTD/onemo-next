# Magnetic-Grid Candidate Enumerator

Pure TypeScript, zero-dependency combinatorial enumeration above the accepted measurement kernel.

```ts
import {
  enumerateCandidates,
  serializeCanonical,
} from "./dist/index.js";

const result = enumerateCandidates({ measurement, grammar });
const bytes = serializeCanonical(result);
```

Commands:

```bash
npm run build
npm test
npm run golden:update
```

See `CONTRACT.md` for the exact population grammar, the four family definitions, candidate identity, source-fact references, ambiguity switches, and canonical order.
