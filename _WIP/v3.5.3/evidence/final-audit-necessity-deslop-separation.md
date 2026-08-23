# Final audit — necessity · deslop · module separation · production readiness

Auditor: s62-kai-lead · 2026-08-23 · product `64d73365` (closed) · full re-read of every final file: `spec.ts` 196, `logic.ts` 203, `engine.ts` 191, `compute.ts` 4, `compute/seat.ts` 450, `compute/centre-evidence.ts` 268, `compute/wrap-measurement.ts` 50, `compute/identity.ts` 11, `magnetic-grid-bridge.ts` 145, `law.worker.ts` 108, `LawPanel.tsx` 873, `separation.test.ts` 310 — 2,499 runtime lines + guard. Tooling: re-export-aware production reference trace over every export (tests and frozen legacy excluded), `git ls-files`, eslint, tsc, 50 tests. **Independent QA and Meta audits follow; nothing below is adopted on my word alone.**

## 1. Necessity (`/o-necessity --review`)

**Directive set (Dan, in his words):** 1 mm ruler / even sizes / no rocket science; final contract = v3.5.3; build purely by contract; step cadence with QA→Meta gates; final-gate Playwright; "compute/spec/logic/bridge/UI carry nothing that does not belong to that module".

**Kill-list (what a senior engineer deletes):**

| # | Element | Evidence | Verdict |
|---|---|---|---|
| N1 | `GridConfig.segmentsDetail` + the `'light'` branch in `safeSegments` (centre-evidence.ts 114–130) | no Law producer ever passes `'light'` (the only `'light'` in the repo is the legacy grid-lab's unrelated density); the legacy walk that used it is deleted | **CUT-drift** — dormant config + dead branch (~20 lines). Touches the frozen `centre-evidence.ts`, so needs QA+Meta sign-off; the `'full'` path is untouched |
| N2 | `GridResult.panMM` + `bestKx/bestKy` in `computeGrid` | no consumer in LawPanel/worker/bridge (the legacy page has its own) | **CUT-drift** — dead output field (~5 lines) |
| N3 | exports `Location` (seat), `WrapResult` (wrap-measurement), `pressExcessMM` (seat), `WrapRefusalReason` (spec) | used only inside their own file | trivial — un-export (4 keywords); not a body deletion |
| N4 | stale comments: `seat.ts` header ("the exact predicate, and nothing else… BigInt") describes a file that now hosts lattice/parity/perimeter/nearest; orphan "Marching-squares topology" comment at `seat.ts` 386; `engine.ts` 53 "Sweep the lattice phase at the placement step (ruled 1mm), seat exactly, score…" describes the deleted sweep | doc slop | fix (comment-only) |

Everything else has a live consumer: every other export traced to a production reference; `pressExcessMM`/`excessMM` and `reach` feed the frozen Centre display-pick tie-break (KEEP-justified by the Centre freeze — see S2 below).

**Sufficiency:** every deliverable in the directive set is covered (traced per step in the ledgers; F1 closed by QA+Meta). — **delivers the directive in full.**
**Necessity line:** **shrink: N1, N2 (+ N3/N4 tidy)** — pending QA+Meta disposition.

## 2. Deslop (`/o-deslop --sweep` over the Law runtime)

- **dead:** N2 `panMM`. **dormant:** N1 `segmentsDetail`/'light'. **stale docs:** N4. **zombie / duplicate / over-abstraction:** none found — no parallel implementation, no pass-through wrapper (`wrapPolicyOf` is the single config→policy reader, allowlisted), no commented-out code. `git ls-files src/lib/magnetic-grid` = 16 tracked files, none legacy-named (`contact-root`, `exact-real` gone).
- **Risk notes:** N1 edits a frozen file (characterise with the existing nine-policy Centre replay before/after). N2 removes a public result field (type change, compile-checked).

## 3. Module separation — "each module carries only what belongs to it"

Enforced mechanically by `separation.test.ts` (import allow-lists per owner; Logic may import `spec` only; compute files may not mention `CentreMode|Governor|MagnetPlan|Coverage`; Engine no JSX; LawPanel imports nothing from `@/lib/magnetic-grid/*`, only the bridge door; worker's only magnetic-grid import is the engine door; `fitSizeInBand` body contains no compute/Logic identifier; one size loop; deleted identifiers absent; seven frozen donors byte-identical). Full read confirms the intent holds:

| Module | Carries | Foreign content found |
|---|---|---|
| `spec.ts` | constants + types only (guard forbids functions/arithmetic) | none |
| `compute/seat.ts` | geometry: integer seat kernel, lattice, edge index, material/nearest, parity measurement, perimeter split, scaling | none — `measureParity` is a measurement (returns evidence, decides nothing) |
| `compute/centre-evidence.ts` | sampled Centre ruler (frozen) | none; contains the dormant `'light'` branch (N1) |
| `compute/wrap-measurement.ts` | one signed clearance per node → seated/belt/measurement | none — the ruler conversion is the one law conversion, by contract |
| `compute/identity.ts` | contour identity string | none |
| `logic.ts` | Centre policy, Wrap verdict, concessions, ladder reduction, coverage, plan | none — imports `spec` only; no geometry |
| `engine.ts` | orchestration: config clamps, `wrapPolicyOf`, candidate assembly, size loop, stored overlay | **S1** `wrapPolicyOf` reads config into a policy object (accepted by QA+Meta as orchestration, §5.4 as amended); **S2** `reach = spot + flap` is handed to the frozen `pressExcessMM` tie-break — a policy value reaching a Centre measurement, inherited from `2c043257` and protected by the Centre freeze (changing it moves display picks) → **KEEP-FLAGGED**, record only |
| `magnetic-grid-bridge.ts` | shape preparation (normalise, trace, offset via `insetRingMM`), display lists, the UI door re-exports | none — offset geometry is shape preparation the contract assigns to the bridge (§4 "shape/vector adapters") |
| `law.worker.ts` | dispatch + caches + rung projection | none — no law, no geometry |
| `LawPanel.tsx` | UI state, controls, SVG rendering; `evenMM` (UI snap, approved S1-c), `dim`/scale (view math) | none — no compute or policy; reads results only |

**Verdict:** separation protocol in force; no compute in Logic or UI, no policy in Compute. Two recorded, contract-accepted orchestration points (S1, S2), nothing to re-room.

## 4. Production readiness

- Typecheck clean · 8 files / 50 tests green · `git diff --check` clean · branches pushed (`64d73365`, `b427241c`).
- **Open before "production":** (P1) `LawPanel.tsx` carries **3 inherited React-hooks lint errors** (`usePersisted` sets state inside an effect; two ref reads during render in `Stage`) — present since `2c043257`, untouched by the contract, and the lab is a `(dev)` route; if CI lints with `--max-warnings 0`/errors-fail, the PR will not pass. Fix is small (lazy `useState` initialiser; ref reads → state) but it is UI behaviour and must go through QA+Meta as a follow-up, not be slipped in. (P2) N1/N2 above. (P3) this route is an **admin/lab surface**, not the customer product; "production" here means the lab ships to staging/main behind `(dev)`.

## 5. Verdict lines

- **Necessity:** shrink: N1 `segmentsDetail`/'light', N2 `panMM` (+ N3 un-exports, N4 stale comments).
- **Sufficiency:** delivers the directive in full.
- **Separation:** in force; no re-rooming required.
- **Production:** ready on the engine; blocked on the decision for P1 (inherited lint) and the N1/N2 kill-list — both need QA+Meta dispositions before any deletion.

## Team patch adopted (QA + Meta cross-accepted) — product `50174b59` · `64db807c` · `fe7787bb`

- **M1 (Meta, critical):** `reach = spot + flap` was feeding the frozen Centre display tie-break — measured: preset star 128 Box changed phase between flap 0 and flap 4 while the governed centre stayed put. Deleted; flap reaches `wrapPolicyOf` only. Biting fixture: star 128 Box identical at flap 0/4; the tie-break with `12 + 4` picks a different phase.
- **M2:** ownership-only suppression now returns `NO_NEW_MAGNET_COUNT_IN_BAND` (was reported as a Wrap failure).
- **N1/N2/N5 (QA):** `segmentsDetail` + `'light'` branch, `panMM`, `PerimeterMeasurement` and Engine's duplicate `splitPerimeter` deleted; `applyCoverage(seated, perimeterOnly, belt) → Pt[]`; `measureWrap`'s ≤4 belt rule kept.
- **M3:** dead `PlacementCandidate.canon`/`.belt` removed; 14 private symbols un-exported (QA's ten + `contourIdentity`, `bandOf`, Engine re-exports of `safeSegments`/`spotRadiusOf`).
- **N4:** seven comment corrections (seat header, `pressExcessMM`, orphan MS paragraph, engine header, guard profile, LawPanel owner and witness comments).
- **M4:** LawPanel hook lint fixed as bounded (microtask hydration with cleanup; synchronous pending-pan update; `dragging` state for the cursor). Scoped eslint: 0 problems.
- **M5:** circle disposition fixture no longer solves 96 sizes twice; MagnetPlan ladder fixture has an explicit 15 s timeout. Full `vitest run`: 69 files / 666 tests pass in 15 s.
- Gates at `fe7787bb`: tsc clean · magnetic-grid 8 files / 51 tests · scoped lint 0 · full suite green.
