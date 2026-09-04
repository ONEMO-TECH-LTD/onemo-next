# T4 — Package seam: plan (v1, for QA · engine v3.5.7-2 → v4)

Roadmap v3 task 4, the last item. Baseline: staging `cc2f649c`. Dan, 2026-09-03: "version is v4".

## 0 · Measured (closure walk from `pipeline/solve.ts`, resolving `@/` → `src/`)

- **60 files** in the transitive closure. **Zero from `src/app/`** — the engine already does not reach the shell.
- **One external package:** `@countertype/clipper2-ts`.
- **Ten files outside `src/lib/effect/`**, and they are the real lift boundary:
  `src/lib/grid-engine/compute/geometry.ts` · `src/lib/outline-core/{hash,math,resolver,types}.ts` ·
  `src/lib/vector-core/{index,fit,ops,path,types}.ts`.
- Inside the effect folder the closure is the cluster plus `library/` (27 files) and `units/` (7). The DOM-using
  files in `lib/effect` (`composite`, `mask`, `prepare-effect`, `segment-ml`) are **not** in the closure.
- Today the only production consumer of the pipeline is the worker, importing `pipeline/solve` and
  `pipeline/types` by path.

## 1 · Minimal diff

| # | change | why |
|---|---|---|
| 1 | `src/lib/effect/pipeline/index.ts` — re-exports exactly `solveGrid` and the types `GridRequest`, `GridSolve`. Nothing else. | the one door a caller uses; `anchorFnFor` stays internal (test-only today) |
| 2 | `solve.worker.ts` imports from `@/lib/effect/pipeline` instead of the two file paths | the seam is used, not merely declared |
| 3 | `pipeline/__tests__/package.test.ts` — the **lift check**: walks the closure from `index.ts` and asserts (a) no file under `src/app/`, (b) no `document`/`window`/`self`/`navigator`/`localStorage` reference in any closure file, (c) the external package set equals the pinned `['@countertype/clipper2-ts']`, (d) the closure's out-of-`lib/effect` files equal the pinned ten, (e) `index.ts` exports exactly the three pinned names | proves liftability by measurement, and fails the day someone adds an app or DOM edge |
| 4 | `tsconfig.engine.json` (extends the root, `include: ["src/lib/**/*.ts"]`, `exclude` adds `src/app`) + `"typecheck:engine"` script | proves the engine compiles with the app absent — the actual "lift" |
| 5 | `page.tsx`: the header string `v3.5.7-1` → `v4` | Dan's ruling; the only product-visible line in T4 |

Nothing moves, nothing is renamed, no package is published, no Studio wiring.

## 2 · Proof (Done means)
1. `npx vitest run src/lib/effect/pipeline` green, including the lift check.
2. Mutations each fail: an `@/app/...` import added to a closure file · a `document.` reference added to
   `pipeline/solve.ts` · an extra export added to `index.ts`.
3. `npx tsc -p tsconfig.engine.json` clean with `src/app` excluded.
4. Full suite green (serial), strict lint clean on changed files.
5. Live 4065: the bench solves as now and the header reads **v4**; console clean.

## 3 · Stated, not fixed here
The pipeline still contains landing/Belt/sizing policy (L3 re-rooming, parked). The engine is liftable as a
**source subtree**, not yet as a published package: T4 proves the boundary, and packaging (its own
package.json, build, versioning) belongs to Studio integration when Dan calls it.

## 4 · Necessity / sufficiency
No unnecessary elements: one export file, one import change, one measurement test, one tsconfig + script,
one string. Delivers T4 in full: the seam exists, is used, is proven by measurement and by a compile with
the app absent.
