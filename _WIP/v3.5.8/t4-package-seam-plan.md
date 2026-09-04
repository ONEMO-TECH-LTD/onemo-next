# T4 — Package seam: plan (v2, QA F1+F2 applied · engine v3.5.7-2 → v4)

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

## 0b · Spike (run before promising the package — evidence, not intent)

A throwaway build proved the package is achievable exactly as QA requires, and named the two real
obstacles:

- `tsc` with `lib: ["ES2022"]` (no DOM) and `types: ["node"]` compiles the whole closure **clean**. The
  only non-ES need is `console` (`geometry-truth.ts:57`), which `@types/node` supplies — that is the
  "minimum runtime types" clause.
- `tsc` does **not** rewrite `@/` aliases into the emitted JS/d.ts (13 raw specifiers in `solve.js`), and
  its relative specifiers carry no `.js`, so Node ESM cannot load them. Both are fixed by one build step.
- With that step, a plain Node consumer imported the built entry and solved a real request:
  `120.01 mm · 8 magnets in 121 ms`, result JSON round-trips. No Next, no worker, no `src/app`.

## 1 · Minimal diff

| # | change | why |
|---|---|---|
| 1 | `src/lib/effect/pipeline/index.ts` — re-exports exactly `solveGrid`, `GridRequest`, `GridSolve` | the one door; `anchorFnFor` stays internal |
| 2 | `solve.worker.ts` imports `@/lib/effect/pipeline` | the seam is used, not merely declared |
| 3 | **`src/lib/effect/engine-package/`** — a private package following the repo's existing in-repo convention (`grid-engine/compute/*`): `package.json` (`private`, `type: module`, `exports`/`types` → `dist`, `@countertype/clipper2-ts` as the one dependency, `build`/`test` scripts), `tsconfig.json` (entry = `pipeline/index.ts`, `lib: ES2022`, `types: ["node"]`, declarations, `rootDir` the repo `src`), and `scripts/build.mjs` (tsc, then rewrite `@/` to relative and add ESM extensions in the emitted JS and d.ts) | the API package Dan asked for, built from the existing sources — nothing is moved or retyped |
| 4 | `test/consumer.test.mjs` in that package — imports the built entry **through the package export** and calls `solveGrid` with a serialisable request; asserts the answer and a JSON round trip. It imports no source path, no Next, no worker, no `src/app` | proves an independent consumer, which is what "API package" means |
| 5 | `pipeline/__tests__/package.test.ts` — the closure gate: no file under `src/app/`, no `document`/`window`/`self`/`navigator`/`localStorage`, external set equals `['@countertype/clipper2-ts']`, out-of-`lib/effect` set equals the pinned ten, `index.ts` exports equal the three names, and **zero `@/` specifiers survive in `dist`** | the runtime-import inventory |
| 6 | root `tsconfig.json` + `vitest.config.mts` exclude the package's `dist` (as the three existing packages are excluded) | keeps the app build and suite unchanged |
| 7 | `page.tsx`: header `v3.5.7-1` → `v4` | Dan, 2026-09-03 |

No publishing, no Studio wiring, no persistence, no auth, no manufacturing save.

## 2 · Proof (Done means)
1. `npm run build` in the package: tsc clean with **no DOM lib**, dist emitted, zero `@/` specifiers left.
2. `npm test` in the package: the consumer smoke solves a real request through the package export.
3. Mutations each fail: a `document.` reference added to a closure file (fails the **build**, not just a
   text scan) · an `@/app/...` import added to a closure file (fails the closure gate) · a fourth export
   added to `index.ts` (fails the export pin).
4. Root suite green (serial), `tsc --noEmit` clean, strict lint clean on changed files.
5. Live 4065: the bench solves as now and the header reads **v4**; console clean.

## 3 · Stated, not fixed here
The pipeline still contains landing/Belt/sizing policy (L3 re-rooming, parked). The package is **private
and unpublished**: it proves an independent consumer can build and call the engine. Publishing, semver
and Studio wiring stay outside, as Dan scoped.

## 4 · Necessity / sufficiency
No unnecessary elements: one export file, one import change, one private package (manifest, config, build
step), one consumer smoke, one closure gate, two config excludes, one string — each demanded by the
directive "wrapped as api package" or by its proof. Delivers T4 in full: the door exists and is used, the
package builds DOM-free from the existing sources with no repository aliases in the artifact, and an
independent Node consumer calls it.
