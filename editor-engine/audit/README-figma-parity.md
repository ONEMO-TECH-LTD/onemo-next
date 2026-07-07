# Figma-console ↔ build parity (Dan's mandate)

The oracle is the LIVE Figma web console, never a hand-written spec — that eliminates the
mis-measurement class (e.g. the X/Y field edge is an `outline`, which a border-only census missed).

## Run
1. Select the reference node in the Figma tab (the DS inspector showing X/Y/Rotation/…).
2. In the Figma tab console: paste `figma-census.js`, then `copy(JSON.stringify(figmaCensus()))` → save as `figma-census.json`.
3. In the build tab console (element selected): same → save as `build-census.json`.
4. `node editor-engine/audit/figma-parity.mjs figma-census.json build-census.json`
   → per-property MATCH/DIFF matrix; exit 1 on any diff, naming field · prop · figma · build.

`figma-census.js` captures the FULL field-edge (border AND outline AND box-shadow) so no visible
rule is ever silently skipped.
