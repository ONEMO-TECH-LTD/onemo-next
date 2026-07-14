# react-figma E5 — s58-lead Code/Write-Safety Gate (HEAD a93b039)

Reviewer: Kai (s58-lead). Codex covers UI/visual. Execution-backed; scratch/scaffold removed, tree clean.

## Execution-verified GOOD
- ✅ **create-component injection sealed** — name validated `/^[A-Za-z][A-Za-z0-9]*$/` BEFORE splice
  (lib.ts:472), and `name` is the ONLY interpolation into a FIXED template (no client importPath).
  Probed: `; export const X=1 //`→422, `café`(unicode)→422, `__proto__`→422, `../../../etc/x`→422,
  `a b`→422, `1Card`→422; `Card`→200. `constructor`→200 but HARMLESS — used only as filename +
  function name (never an object key), no prototype pollution. assertValidTsx guards output.
- ✅ **draw-to-place (insertDrawn) can't smuggle code** — coords are typed numbers from internal
  pointer math (`Math.max(1, r.w)` etc.), `tag` from a fixed armed set, `display` whitelisted to
  flex/grid; and the server insert-jsx-child runs assertValidTsx on the output → any smuggled coord
  → invalid TSX → 422. Double-guarded.
- ✅ **parseFigmaVariables is DoS-safe** — NON-recursive (reads only meta/variableCollections/
  variables/modes/variableIds/valuesByMode; ignores arbitrary nesting), aliases PRINTED not followed
  (`→ id`, no cycle loop), linear O(n) on arrays (no amplification). Client-side, user's own file,
  JSON.parse bounds it. `Object.values` ignores prototype. No crash/DoS vector.
- ✅ **colorToHex perf fine** — canvas 2d context MEMOIZED (`_ctx ??= …`, created once, reused), and
  the oklch fallback is a 1×1 `getImageData`. 200 nodes × 3 props = 600 calls each reuse the context
  + a 1px read → negligible. Right optimization.
- ✅ **E4 regression holds** — insert-component injection `x'; export const P=1 //` → 422; `.svg`
  excluded from image OK_EXT; JSX write-jail `.ts` → 403; assertValidTsx on both create paths.
- ✅ **Zero source pollution** — tracked tree CLEAN at a93b039 (probe reverts confirmed; only untracked
  `test-results/` = Codex's playwright artifact, not source). tsc 0 real errors.

## Findings
None. Every new write/parse surface is guarded (injection sealed, coords numeric+assertValidTsx,
parser non-recursive/cycle-safe, canvas memoized).

## Note (not a finding)
parseFigmaVariables has no explicit input-size cap — a pathologically huge user JSON would be slow to
parse client-side, but it's the user's own import bounded by JSON.parse; linear, no amplification. Fine
for v1; a size guard is a nicety if you ever accept untrusted uploads.

## Verdict: PASS — E5 code/write-safety clean at HEAD a93b039. Injection sealed, draw-coords can't
smuggle, parser DoS-safe, colorToHex perf sound, E4 regression holds, zero pollution. Codex's
UI/visual verdict stands independent.
