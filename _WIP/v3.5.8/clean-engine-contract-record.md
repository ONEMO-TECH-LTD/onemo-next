# Clean engine — the contract as ruled, and where ddb0c7b5 stands against it

Record only (s62-kai-lead, 2026-09-02). Every line traces to a source named beside it. No plan is
authorised by this file.

## 1 · The contract, in Dan's words

| date | ruling (verbatim) | source |
|---|---|---|
| 2026-08-20 16:16 | "engine = modules have no overlapping and leaking code into each other and separate cleanly **compute** (math neutrally driving the engine no logic nothing) / **logic** that stores the laws and reasoning policies and selection judgement part of engine / **spec** (the raw ruled value storage feeding compute based on logic) / **ui** (admin panel pure page shell having none from the prior modules) + **bridge** if needed to store supporting UI related logic" | vault s62/lead 08-20 |
| 2026-08-28 10:18 | "this is admin ui — when we finish all we need to **export engine to integrate headless into the studio for the backend** minimum to define the sizes and manufacturing layouts — so the engine will have to be **clean modular unit that has no cross dependencies — compute/logic/spec/orchestration/library** … clean separation and **UI must have nothing except only shell**" | vault s62/lead 08-28 |
| 2026-08-28 10:22–10:27 | pipeline is its own module — orchestration, not logic; "that module IS the API". Structure ruled: spec · types · kernel(foundation) · **units** (semantic, self-sufficient: segment · classifier · centring · wrap · judge · library) · **pipeline** · **adapters** · shell. **A unit never imports another unit.** | vault s62/lead 08-28 |
| 2026-08-29 | "API is the last phase. We need to finish the engine first" · "surgical swap and stop … migrating from one pipeline to another not wholesale cutover" | architecture record S10; vault 08-29 23:16 |
| 2026-08-25 | "audit current library module we cant create noodle soup … modular clean separation" | vault s62/lead 08-25 |

## 2 · The written contract (repo)

- `_WIP/v3.5.6/grid-lab-architecture.md` — laws **L1** shared foundation never rebuilt · **L2** a unit never imports another unit · **L3** the pipeline holds sequence, never rules · **L4** one home per fact · **L5** the shell renders; page/panel reach the engine only through adapters · **L6** proven bodies move, never retyped. Target tree: `spec · types · foundation/ · units/ · pipeline/ · adapters/`; worker shrinks to transport/cache; `grid-magnet.ts`, `-compute`, `-logic`, `-class`, `-wrap-compute` retire at cutover (S5). API bundle is **S10, last, after the engine is correct**.
- `_WIP/v3.5.6/grid-lab-move-matrix.md` — per-declaration owner for every legacy symbol incl. the worker (`bakeOf`, `anchorFnFor`, `ctx.onmessage` SPLIT into pipeline / units / adapters).
- `_WIP/v3.5.6/v3.5.6-current-brief.md` §8 — no result-affecting value hardcoded in UI, worker, bridge, engine, compute or logic; all in Spec. §9 — Worker/bridge = transport, caching, request/result wiring **only**; UI renders Spec controls and returned results, no solver logic.
- `_WIP/v3.5.6/v3.5.6-delivery-plan.md` P1.3 — "one way in, runs without a browser": door callable from a plain test, worker = transport and cache, page reaches the engine through an adapter.
- Enforcement: `src/lib/effect/__tests__/grid-magnet-separation.test.ts` zones 1 (portable), 2 (one-way traffic, per-file allow-lists, page → door/spec/bridge only), 2b (units self-sufficient; only named sequencer seats hold unit edges), 2c (foundation primitives only), 2d (page holds **zero** unit edges; worker exactly `classifier · judge · centring`, marked temporary until pipeline lands).

## 3 · Measured state at `ddb0c7b5` (branch session62-task/balanced-mode)

**Holds:** 7 units, none imports another · foundation export set pinned · zero React/Next/DOM in the cluster · no `lib → app` import · spec is values only.

**Violations (each with provenance):**

| # | leak | where | since | contract clause |
|---|---|---|---|---|
| V1 | page imports a unit (`type UnprotectedEvidence` from `units/protection`) | `page.tsx:24` | `77b55a08` 09-01 (pixel-builder diagnostic clone) | L5 · zone 2d — **2 red tests today** |
| V1b | **page executes engine compute**: `safeSegments(libraryModel.contour, spotRadiusOf(RELEASED_PADDING_MM), 'full')` — segmentation running in the shell, entering through the `grid-magnet` barrel so zone 2d does not see it | `page.tsx:149` | `08fd49e7` 08-30 (s62-lead) | L5 · current-brief §9 — **live, ungated**. Repair: library segment derivation moves into the library view adapter; zone 2d forbids computational engine barrel exports, not just `units/*` |
| V2 | worker holds 4 unit edges (`centring · protection · judge · classifier`) vs pinned 3; protection edge unpinned | `solve.worker.ts:9-15` | protection `77b55a08`; the other three 08-28/29 | zone 2d |
| V3 | the pipeline lives in the worker: step-1 bake, centring rule (`anchorFnFor` — Core exception + linear scaling), classify → lookup → priority → solve → Rule-4 landing → Belt → wrapGrid → sizes → protection, 227 lines in a browser Worker file | `solve.worker.ts` | pre-existing, named in architecture §3 | §9 worker = transport only · L3 · P1.3 headless |
| V4 | no `pipeline/`, no `adapters/`; three files sequence units (`grid-magnet.ts`, `grid-magnet-wrap-compute.ts`, `grid-magnet-canon-experiment.ts`) | `lib/effect` | S3 never landed | one orchestration module (08-28 ruling) |
| V5 | worker imports 4 retiring shims + door + catalogue + experiment + bridge (12 engine import lines); no single entry point a backend could call | `solve.worker.ts:4-18` | pre-existing | "that module IS the API" |
| V6 | old classifier (`shapeFamilyOf`, `classFrameNodes`, DELETE-S4 in the matrix) still called for the `recog` readout | `solve.worker.ts:12,195-201` | pre-existing | matrix §3 |
| V7 | stale pin `[16, 12]` in zone 7 (Belt delivery test) — 1 red test | separation test | inherited | — |
| V8 | `protectionPaddingMM` travels outside `GridConfig`/Spec (display-only today; becomes result-affecting the moment the protector ranks) | worker `SolveRequest:31` | `77b55a08` | current-brief §8 |

Suite at `ddb0c7b5`: **76 pass / 3 fail** — the 3 are V1 (×2) and V7.

Repo hygiene (not code): 8 stale Codex worktrees under `.codex/worktrees/` (6 × `s62-protector-*` ≈ 7.6 GB, 2 × `s62-v3.5.7-*` ≈ 4.6 GB), 3 stashes on this tree.

## 4 · What "API-ready for migration" means under this contract

One serialisable call — shape contour + pitch/padding/plan/band/centring settings in → every lawful
offer with size, points, roles, band, evidence out — living in `pipeline/`, callable from Node with no
worker and no browser. The worker becomes a dispatcher that posts that call's result; the studio
backend calls the same function. Adapters own transport envelope, caches and view-model shaping. The
shell imports adapter types and spec only. The **API bundle** (packaging, versioning, external
contract) stays S10 — after the engine answers correctly (Dan 08-29).

## 5 · Amendments from QA audit (`/tmp/s62-clean-engine-recovery-audit.md`, 2026-09-02) — verified at source

- **V1 corrected — the page COMPUTES, not just types.** `page.tsx:149` executes `safeSegments(libraryModel.contour, spotRadiusOf(RELEASED_PADDING_MM), 'full')` — segmentation (a unit body) running in the shell, reached through the door barrel. Since `08fd49e7` (2026-08-30, s62-lead — mine, not pixel-builder). The type import (`77b55a08`) is the smaller half. Fix belongs in the library view adapter (`libraryStageModel`), and the page import matrix must forbid computational barrel exports as well as `units/*`.
- **V9 — public boundary not serialisable.** `WrapConfig.anchorAtMM` is a function; `SolveRequest`/response are worker-local shapes. A backend call needs data-only request/result (JSON round-trip test = the browser-independence proof).
- **V10 — manufacturing save has no seam.** `persistence.ts` (`makeSavedEffect`/`toDesignRow`) is pure and dormant; its locked payload carries no magnetic layout. Saving is a product action after a user picks an offer, never the solver's; the record = contour identity + engine version/config hash + catalogue entry/view + phase/origin + nodes/diameters + omissions + exact wrapped size + actual band + evidence.
- **Precise band size** for users/backends = each offer's actual wrapped `sizeMM` and landed band, never the requested band or page arithmetic.

## 6 · Productisation boundary (Dan, 2026-09-02 14:42–14:44, via s62-qa; verified in the vault)

> "what i mean by productisation the state when the engine is clean and kept all functionality / optimised where possible and wrapped as api package" · "backend product flow can be added in the studio repo — engine just needs to be clean optimised and api callable headless for computation the UI shell is admin layer"

- **Engine package owes:** clean separation per §1–2 · every current function kept · measured optimisation where needed · one headless, data-only (JSON) call in / result out.
- **Studio owns:** persistence, user selection, manufacturing save, product flow, auth, schema. **None of it is engine work.** V10 above is therefore a *Studio* item; it stays listed only so the engine result carries every field Studio will need (exact wrapped size, landed band, nodes/diameters, omissions, evidence).
- **The UI shell is the admin layer** — it renders and forwards; it remains a bench, not a product surface.
