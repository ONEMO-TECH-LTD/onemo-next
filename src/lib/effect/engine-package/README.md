# onemo-grid-engine (private, v4)

The magnetic-grid solve as one headless call. A cutout and its settings go in; every lawful layout
comes back with its exact wrapped size, magnet positions, roles, landed band and protection evidence.

```js
import { solveGrid } from 'onemo-grid-engine'

const solve = solveGrid({
  base: { outer: { pts: [[0, 0], [1, 0], [1, 1], [0, 1]] }, holes: [] },
  offsetMM: 0, mode: 3, sizeMM: 0, stepSel: null,
  cfg: { pitchMM: 48, paddingMM: 12, perimeterOnly: true, centreMode: 2, governor: 0, plan: 'all6' },
  settings: { protectionPaddingMM: 24 },
})
```

`npm run build` compiles the engine from the repository sources with **no browser library** and rewrites
the repository's path aliases into relative specifiers, so the artifact resolves anywhere Node does.
`npm test` builds, then calls the package through its own export from a plain Node consumer.

Request and answer are plain data: both survive a JSON round trip, which is what lets a server, a
worker or a test call the same function.

**Not in this package:** persistence, selection, manufacturing save, publishing. Those are Studio's.
