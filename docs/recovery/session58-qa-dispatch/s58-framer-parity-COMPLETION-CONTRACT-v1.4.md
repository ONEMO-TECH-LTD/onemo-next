# Framer Component Module — COMPLETION CONTRACT v1.4 (immutable; binds AC-3; census enumeration CLOSED)

**Owner:** @s58-designer (lead + meta) · **2026-07-13** · supersedes v1.3 (folds Chief-QA round-3: 2 sign blockers) and binds the census-expanded acceptance authority. The v0 architecture spec §§1–10 (`__qa-dispatch/s58-framer-component-authoring-HARD-CONTRACT-v0.md`, SHA-256 `5893dcedbe0b660db5e09b250f81dc68783946aac7b725c8d04148b16b5d1a36`) stands as design/invariant REFERENCE only; its header "Build authorization: G2 AUTHORIZED AND ACTIVE" and continuous-gate order are SUPERSEDED by this contract — on any conflict v1.4 wins, and no product build occurs before Dan signs v1.4. LAW + structure only; NO status matrix (status → Linear).
**Reviewed-before-sign:** one FRESH adversarial pass by @s58-qa (Chief QA) + @s58-expert on this whole immutable doc → then Dan sign.

## BINDING — acceptance authority
- **Acceptance authority = `__qa-dispatch/s58-framer-parity-ATOMIC-ACCEPTANCE-CHECKLIST.md`, revision AC-3 · 335 stable rows · 428 lines · SHA-256 `06294d605b3416a75770c98b9ec0550fc889f4a90f5d08a6ed81074ecf2bea0a`.**
- **Prior immutable bases (byte-accounted inside AC-3, no ID/text changed):** AC-2 · 264 rows · SHA `c00dbb58ba84b64e035ac9ebe66f342ed471471ab33fa4bd4da0f24d4dfc87d3`; AC-1 · 159 rows · SHA `6c4554c186d7c8ba272186a00305a990544620308716af52580b401b55e30b3e`. AC-3 appends census-reconciliation rows only.
- **AC-3 is the sole row/count authority (335 rows).** No per-group totals are restated in this contract — AC-3 owns them; the census reconciliation (`s58-framer-components-CENSUS-reconciliation-chief-qa-2026-07-13.md`, SHA `db9d94e845cfd6ff36a55f02eb9e7a042649028fc1ec96b900c4176e22bac69d`) records the per-prefix additions.
- **Any AC change → new annex revision (AC-4…) + new hash + Chief-QA re-freeze + one fresh review → LEAD issues successor v1.5. Never silent.**
- **v1.4 is PERMANENTLY bound to AC-3** — an immutable doc does not re-bind itself. A later annex is bound only by a successor contract.

## ★ PARITY-CENSUS CLOSURE LAW — enumeration CLOSED 2026-07-13 (full parity must win)
- **The mandatory exhaustive census of the entire Framer Components surface is COMPLETE and enumeration-CLOSED.** @s58-expert delivered the 13-family free-tier own-hands sweep (`s58-framer-components-CENSUS-expert-2026-07-13.md`, SHA `96c78a8312caa484ccdb21c641394c10c06a55fce1d6aa90caf866d53a160e82`); Chief QA reconciled it into AC-3 (71 source-backed rows added) and, as different eyes, ran a second full completeness pass. Closure is declared at the hashes above.
- **Closure = ENUMERATION only. It does NOT mean the product is complete, SPEC-PENDING rows are resolved, or any build may self-start.** Final completion remains blocked by every unsatisfied AC-3 row and every SPEC-PENDING / Dan-decision hold.
- **Completeness bar (full-functionality-wins):** enumeration is exhaustive; own-hands OPERATION is bounded to the **free-tier UI surface**; paid-gated surfaces (Convert triggers, team-Library tiers) and harness-limited gestures (cross-panel drag, clipboard) are enumerated + FLAGGED needs-manual / Dan-hands. **A flagged item BLOCKS final** until EITHER (a) live evidence lands OR (b) Dan explicitly dispositions it (accept / defer / drop). `AC-J-045` is the standing safety net — access limitation NEVER grants an implicit parity waiver.
- Any future-discovered un-censused behavior reopens enumeration via an AC-4 annex + successor contract.

## Product Law
Clone Framer's behaviour/model/full functionality in ONEMO/Figma styling (DS tokens, Chillax, brand oklch, Phosphor-light — never Framer purple/chrome; `AC-J-013/014`). Clone only what is extracted + in front — no invention, no vibe-code, no guessed numbers.

## Dan product decisions (approved / pending)
- Approved: Drag-insert = MANDATORY (`AC-I-002`) · New Event = BUILD, mints an **Event variable** not a wire (`AC-F-024..027`) · Blank-create = RESTORE — Framer confirmed to have it (`AC-B-021..027`).
- **Pending Dan calls (do not guess):** (1) **Redo** — restore or drop (`AC-C-012`). (2) **Breadcrumb prominence** — icon/size target for `AC-A-008` (expert measures Framer's bar; not invented). (3) **Add To Agent** — clone / defer / not-applicable (`AC-J-040`, DAN DECISION). (4) **Global/library entry** — requires a measurement pass in Dan's library-enabled workspace (`AC-A-009`), which gates `AC-A-005`, `AC-B-012`, `AC-H-037`.

## Completion Law — stamps (Dan FINAL-only sign-off)
Each atomic AC row carries FIVE stamps: **① source-proof (`AC-J-005`) · ② human-visible browser proof (`AC-J-006`) · ③ Chief-QA PASS (`AC-J-007`) · ④ Meta/design-fidelity PASS (`AC-J-008`) · ⑤ Dan sign (`AC-J-009`).**
- **Per-slice progress gate = the FOUR pre-Dan stamps (①–④).** A row advances when ①–④ are met (`AC-J-010`: no LIVE/DONE without all required stamps).
- **⑤ Dan sign is FINAL-only** — Dan signs the completed product, not every slice, unless Dan explicitly chooses to sign an interim slice. Only Dan may mark Done (`AC-J-009`).
- Nothing is FINAL-DONE without all five + every SPEC-PENDING/Dan-hold resolved. Stamps tracked per Linear row.

## Layer discipline
`schema` ≠ `command` ≠ `UI` ≠ `runtime`. Schema-only = UNBUILT/foundation. `semantic command` ≠ `lifecycle op`. Old `lib.ts` route-refused writers = removal work, not capability (`AC-J-030..032`).

## TRUE-STATE HEADLINE @ 8d64fd3 (3 audits + expert real-Chrome)
**No working authoring path from any real CONTENT page.** create-from-selection refuses any module-css-styled element (every real content element; module-css escapes root — the passing E2E was a lab fixture); asset double-click dead-ends; empty-canvas click can crash (pan null-race, `page.tsx:3666`). The free-variant slice works only via a synthetic fixture OR a dependency-free selection (empty draft-page root — expert-proven live). **P0 restores a real-content authoring path first.**

## Traceability — AC-3 stable rows ↔ Linear E12 (stable IDs only; NO per-row phase field)
Sprint **E12 = KAI-9437**. **Atomic unit of work = one AC-3 stable ROW** (e.g. `AC-A-001`), not a phase or a whole issue. Each issue is a container; its checkboxes = stable rows; each row is built + 4-stamped independently.
- **There is NO per-row phase field in the checklist or in Linear.** The **Build-order section below is the sole phase-allocation authority** — every AC-3 row is allocated there by prefix (with exact P0 IDs and explicit gated-row holds). (This corrects the v1.3 claim that a definitive per-row phase field existed.)
- Group (stable-ID prefix) → owning issue: `AC-A-*`→**KAI-9438** · `AC-X-001..006`→**KAI-9450** (sole P0 real-path/crash/UX owner) · `AC-B-*`→KAI-9439 · `AC-C-*`→KAI-9440 · `AC-D-*`→KAI-9441 · `AC-E-*`→KAI-9442 · `AC-F-*`→KAI-9443 · `AC-G-*`→KAI-9444 · `AC-H-*`→KAI-9445 · `AC-I-*`→KAI-9446 · `AC-K-*`→KAI-9447 · `AC-L-*`→KAI-9449.
- `AC-J-*` → **KAI-9448 = CROSS-CUTTING GATE**, applied to EVERY row CONTINUOUSLY. The per-row stamps ARE AC-J rows: **AC-J-005 source · AC-J-006 human-browser · AC-J-007 QA · AC-J-008 Meta · AC-J-009 Dan (final)**; all applicable AC-J-* rows gate. Supersedes stale E7/E10/E11.
- **AC-3 additions land in the SAME group issue as their prefix** (per census reconciliation: A +2, B +3, C +12, E +6, F +8, G +12, I +15, J +7, L +6 = 71). No new Linear issue required.

## Build-order (dependency-correct; EVERY AC-3 row allocated to exactly one phase; Chief-QA deterministic map; J runs throughout)
**Allocation rule:** each row is assigned to EXACTLY ONE phase; a row named in P0 is NOT re-run in its group's later phase; a group's later phase = "the group's remaining rows."
**Gating rule (blocker-2 fix — no P0→P1 prerequisite inversion):** a **SPEC-PENDING** row, or a gate row, is allocated to the SAME phase as the row it blocks, and is **measured/frozen inside that phase before build — never dispatched while pending**. Specifically `AC-A-009` (the Dan-workspace library gate) is co-phased in P0 beside the `AC-A-005` it blocks, so the prerequisite never sits in a later phase than its dependent.

**P0** — real-content path + editor stability + reachable entry + blank-create dialog + breadcrumb:
`AC-X-001..006` (KAI-9450) + `AC-A-003, AC-A-004, AC-A-005, AC-A-006, AC-A-008, AC-A-009` + `AC-B-021, AC-B-022` + `AC-H-012, AC-H-030`.
  - `AC-A-009` (SPEC-PENDING, Dan-workspace library evidence) and `AC-B-022` (SPEC-PENDING, blank-create effect) are measured/frozen in P0 before their dependent rows (`AC-A-005`, blank-create result) build — held-until-measured, never dispatched pending, never silently green.
**P1** remaining `AC-A-*` (`AC-A-001` pan/zoom, `AC-A-002` unbounded surface, `AC-A-007` page-hidden, `AC-A-010` zoom-submenu) + all `AC-K-*` (content-edit foundation) + all `AC-L-*` (style-inspector foundation). →
**P2** remaining `AC-B-*` (lifecycle/manage-menu, Create From Code `AC-B-028..030`, blank-create dialog detail `AC-B-023..027`) + remaining `AC-H-*` (Assets sections, page/folder/category/moves, parse-guard). →
**P3** `AC-C-*` (variants/override incl. `AC-C-013..024`) + `AC-D-*` (Hover/Pressed states). →
**P4** `AC-E-*` (unified Variables model, 15 kinds, `AC-E-001..048`). →
**P5** `AC-F-*` (interactions/nodes incl. `AC-F-030..037`) + `AC-G-*` (preview incl. `AC-G-005..016`). →
**P6** `AC-I-*` (instances incl. `AC-I-012..026`; `AC-I-011` paid Trigger = Event-UI boundary + `AC-J-045` hold — see § hold-set, never dropped by fiat).
**CONTINUOUS** `AC-J-*` gates on every row in every phase (stamps `AC-J-005..009`; law `AC-J-001..004, 010..027, 039`; process `AC-J-023..026, 028, 029`; deslop `AC-J-030..038`; `AC-J-040` Add-To-Agent DAN DECISION; `AC-J-041..044` Lock/Hide; `AC-J-045` final safety net).

Within every phase, each SPEC-PENDING row is measured/frozen before its build dispatches; each ROW = one atomic slice, sources in front, 4-stamped (`AC-J-005..008`) before the next; Dan (`AC-J-009`) signs at FINAL.

## Owners
designer = lead/meta (no build) · engineer = sole builder (one atomic AC row at a time, sources in front, no invention, human-visible proof) · expert = adversarial peer + live-extraction of every SPEC-PENDING/⧗ row before its owning slice dispatches + overflow · s58-qa = CHIEF QA (sole AC writer, per-row ①–④ gate, human-visible, no self-closure) · Dan = product decisions + FINAL sign.

## ⧗ Hold set (marker-set by reference + explicit non-marker exceptions — no re-listed drift)
- **Primary hold set = every AC-3 row bearing the literal `SPEC-PENDING` or `DAN DECISION` marker** — bound by reference to those markers in AC-3, NOT re-enumerated here (re-listing drifts). Each freezes only after its live-Framer extraction lands or Dan dispositions it.
- **Non-marker holds — semantic rule (exhaustive, not a fixed list):** ANY AC-3 row whose own acceptance text requires prior evidence, a prior freeze, or a Dan disposition is a HOLD — whether or not it carries a literal marker, and whether or not it appears in the examples below. **The row's own text governs; omission from any example list NEVER waives a row's stated prerequisite.** Named instances (non-exhaustive): `AC-A-008` (breadcrumb — prominence/icon target is a pending Dan call, § Dan product decisions), `AC-C-012` (Redo — explicit Dan disposition before dispatch), `AC-F-002` (New Event frozen from live+compiled Framer evidence before dispatch), `AC-F-019` (transition ownership frozen from Framer evidence before schema change), `AC-H-031` (New Folder dispatches only after measured folder-creation acceptance is frozen), `AC-L-015`/`AC-L-016`/`AC-L-017` (Effects/Overlays/Cursor frozen from Framer evidence before edit), and the `AC-I-011` boundary below.
- **Boundary + insurance (`AC-I-011`):** the instance-panel "Trigger" row is never implemented or counted as component Event-variable UI. The paid Convert capability ITSELF is a flagged HOLD under `AC-J-045` — resolved only by live evidence or Dan's clone/defer/drop; it is never dropped by fiat.
- No hold dispatches while pending; none is ever silently green.

## Process (locked)
Probes/E2E in THROWAWAY per-auditor worktrees on dedicated ports/stores (`AC-J-028, 029`), never the build branch. Cleanliness = capture baseline both repos + restore exact baseline (quarantine-move, never rm untracked without Dan confirm — `AC-J-023..025`). Batch → freeze → one review. Prior contract versions (v1.1–v1.3) are archived reversibly (quarantine-move, never deleted) only AFTER Dan signs v1.4 — never before sign.

---
**v1.4 is immutable on Dan's sign and permanently AC-3-bound.** The census is enumeration-CLOSED; final completion is still gated by every unsatisfied AC-3 row + every SPEC-PENDING/Dan-hold (`AC-J-045`). Next: fresh adversarial review (@s58-qa + @s58-expert) on this whole doc → both PASS → Dan sign → build P0. **No product build until Dan signs.**
