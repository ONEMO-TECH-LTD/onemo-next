# Framer Component Module — COMPLETION CONTRACT v1.3 (immutable; binds AC-2; adds parity-census law)

**Owner:** @s58-designer (lead + meta) · **2026-07-13** · supersedes v1.2 (folds Chief-QA v1.2 REWORK: 4 freeze blockers). v0 architecture §1–§10 stands. LAW + structure only; NO status matrix (status → Linear).
**Reviewed-before-sign:** one FRESH adversarial pass by @s58-qa (Chief QA) + @s58-expert on this whole immutable doc → then Dan sign.

## BINDING — acceptance authority
- **Acceptance authority = `__qa-dispatch/s58-framer-parity-ATOMIC-ACCEPTANCE-CHECKLIST.md`, revision AC-2 · 264 stable rows · SHA-256 `c00dbb58ba84b64e035ac9ebe66f342ed471471ab33fa4bd4da0f24d4dfc87d3`** (append-only over AC-1 `6c4554c1…`).
- **Any AC change → new annex revision (AC-3…) + new hash + Chief-QA re-freeze + one fresh review. Never silent.**
- **v1.3 is PERMANENTLY bound to AC-2** — it does NOT re-bind itself (an immutable doc cannot mutate its binding). **The parity-census law (§ below) may surface gaps → Chief QA freezes AC-3 (only if source-backed gaps exist — no manufactured rows) → LEAD issues a SUCCESSOR contract (v1.4) binding AC-3 with exact count/hash + a fresh QA/Expert review.** v1.3 stays as-is.

## ★ PARITY-CENSUS CLOSURE LAW (Chief-QA blocker #1 — full parity must win)
AC-2's 264 rows cover **extracted** behavior. That is NOT proof of completeness. Therefore:
- **A full, exhaustive census of the entire Framer Components surface is MANDATORY** — @s58-expert enumerates every Components capability live (menus, panels, variables/props, interactions, assets, instances, preview, everything), Chief QA reconciles it against AC-2, and **every gap becomes an AC-3 row.**
- **Any un-extracted / un-censused Framer Components behavior BLOCKS FINAL completion.** "All current AC rows done" ≠ done. Final completion requires: census CLOSED + every source-backed gap turned into a satisfied AC-3 row. **The AC-3 rule is conditional: AC-3 is minted ONLY IF the census surfaces source-backed gaps — the 2026-07-13 census DID, so AC-3 is now required; had it found none, AC-2 would stand as the final authority and no v1.4 would issue.**
- **Census CLOSURE definition (expert G1):** the census is CLOSED only when (a) the expert's sweep doc lands with per-item provenance, (b) Chief QA reconciles it vs AC-2 → mints AC-3, AND (c) one completeness pass on the census itself by DIFFERENT eyes (Chief QA, or Dan 2-min). Until (a)+(b)+(c), "zero known gaps" is not declarable. Chief QA declares closure.
- **Completeness bar (honesty bound + full-functionality-wins):** ENUMERATION must be exhaustive (every surface named). OPERATION own-hands is bounded to the **free-tier UI surface** — paid-gated surfaces (Convert triggers, team Library tiers) and harness-limited gestures (cross-panel drag, clipboard) get **enumerated + FLAGGED** needs-manual / Dan-hands. **A flagged item BLOCKS final** until EITHER (a) evidence lands (a Dan-workspace or manual pass operates it) OR (b) Dan explicitly dispositions it (accept / defer / drop). Flagged is a HOLD, never a silent pass — full functionality wins; the free-tier bound limits what WE can operate, not what the product must ultimately do.
- The census runs in parallel with P0 build (P0 = known dead-end/crash fixes, not blocked by the census); it gates FINAL, not P0-start.

## Product Law
Clone Framer's behaviour/model/full functionality in ONEMO/Figma styling (DS tokens, Chillax, brand oklch, Phosphor-light — never Framer purple/chrome). Clone only what is extracted + in front — no invention, no vibe-code, no guessed numbers.

## Dan product decisions (approved)
Drag-insert = MANDATORY · New Event = BUILD (mints an **Event variable**, not a wire) · Blank-create = RESTORE (Framer confirmed to have it).

## Completion Law — stamps (Chief-QA blocker #3 fix: aligns with Dan's FINAL-only sign-off)
Each atomic AC row carries FIVE stamps: **① source-proof · ② human-visible browser proof · ③ Chief-QA PASS · ④ Meta/design-fidelity PASS · ⑤ Dan sign.**
- **Per-slice progress gate = the FOUR pre-Dan stamps (①–④).** A slice advances to the next when ①–④ are met.
- **⑤ Dan sign is FINAL-only** — Dan signs the completed product, NOT every slice (per standing "Done = Dan signs, final gate" law), unless Dan explicitly chooses to sign an interim slice.
- Nothing is FINAL-DONE without all five + census closed. Stamps tracked per Linear row.

## Layer discipline
`schema` ≠ `command` ≠ `UI` ≠ `runtime`. Schema-only = UNBUILT/foundation. `semantic command` ≠ `lifecycle op`. Old lib.ts writers = route-refused cemetery = removal work, not capability.

## TRUE-STATE HEADLINE @ 8d64fd3 (3 audits + expert real-Chrome)
**No working authoring path from any real CONTENT page.** create-from-selection refuses any module-css-styled element (every real content element; module-css escapes root — passing E2E was a lab fixture); asset double-click dead-ends; empty-canvas click can crash (pan null-race). The free-variant slice works only via a synthetic fixture OR a dependency-free selection (empty draft-page root — expert-proven live). **P0 restores a real-content authoring path first.**

## Traceability — AC-2 stable rows ↔ Linear E12 (stable IDs only; every row allocated; ROWS are the atomic slices)
Sprint **E12 = KAI-9437**. **Atomic unit of work = one AC-2 stable ROW** (e.g. `AC-A-001`), not a phase or a whole issue. Each issue is a container; its checkboxes = stable rows; each row is built + 4-stamped independently. **Row counts are NOT restated here — AC-2 is the sole count authority (264 rows).** Group (stable-ID prefix) → owning issue:
- `AC-A-*` → **KAI-9438** (A rows stay in 9438 even when scheduled inside P0).
- `AC-X-001..006` → **KAI-9450** (sole owner of the P0 real-path/crash/UX rows).
- `AC-B-*`→9439 · `AC-C-*`→9440 · `AC-D-*`→9441 · `AC-E-*`→9442 · `AC-F-*`→9443 · `AC-G-*`→9444 · `AC-H-*`→9445 · `AC-I-*`→9446 · `AC-K-*`(content-edit)→9447 · `AC-L-*`→9449.
- `AC-J-*` → **KAI-9448 = CROSS-CUTTING GATE**, applied to EVERY row CONTINUOUSLY (never "done once"). The per-row stamps ARE AC-J rows: **AC-J-005 source · AC-J-006 human-browser · AC-J-007 QA verdict · AC-J-008 Meta verdict · AC-J-009 Dan sign (final)**; all applicable AC-J-* rows gate. Supersedes stale E7/E10/E11.

## Build-order (dependency-correct; every group allocated; rows are slices; J runs throughout)
Each row is assigned to EXACTLY ONE phase (no group spans phases by overlap; a row named in P0 is NOT re-run in its group's later phase). Exact P0 rows named; later phases = "the group's remaining rows."
**P0** real-content path + reachable entry: `AC-X-001..006` (KAI-9450) + `AC-A-003, AC-A-004, AC-A-005, AC-A-006` (double-click / ctx-Edit / global-library entry / always-a-reachable-path — kills the dead-end) + `AC-A-008` (breadcrumb Home›Component; prominence target ⧗) + `AC-B-021, AC-B-022` and `AC-H-012, AC-H-030` (blank-create dialog + entry). →
**P1** remaining `AC-A-*` (`AC-A-001` canvas pan/zoom, `AC-A-002` unbounded surface, `AC-A-007` page-hidden) + `AC-K-*` (content-edit) + `AC-L-*` (style-inspector foundation). →
**P2** remaining `AC-B-*` (lifecycle/menu) + remaining `AC-H-*` (folders/page/category/moves). →
**P3** `AC-C-*` (variants/override) + `AC-D-*` (states). →
**P4** `AC-E-*` (props/Variables, 15 kinds). →
**P5** `AC-F-*` (interactions incl. New Event=event variable) + `AC-G-*` (play/preview). →
**P6** `AC-I-*` (instances). **`AC-J-*` gates run continuously on every row in every phase.** Each ROW = one atomic slice, sources in front, 4-stamped (AC-J-005..008) before the next; Dan (AC-J-009) signs at FINAL. *(Definitive per-row phase field lives on each AC-2/AC-3 row + its Linear issue — this order is the law, the row field is the record.)*

## Owners
designer = lead/meta (no build) · engineer = sole builder (one atomic AC row at a time, sources in front, no invention, human-visible proof) · expert = adversarial peer + **the mandatory Framer Components census** + live-extraction of ⧗ rows + overflow · s58-qa = CHIEF QA (sole AC writer, census reconciliation, per-row ①–④ gate, human-visible, no self-closure) · Dan = product decisions + FINAL sign.

## ⧗ SPEC-PENDING (Chief-QA blocker #4 fix: bound to AC-2 stable IDs, not prose)
The complete SPEC-PENDING set = **all AC-2 rows flagged SPEC-PENDING** (bind the AC-2 set by reference — includes AC-D-006, C-011, E-042, B-022, H-027, H-036, H-037, H-039, H-040 + the expert needs-manual items: instance value-edit/reset, event-on-instance, layer fire-event, zero-instance Delete state, folder-… contents, Library › submenu, drag-into-folder, one Copy-Import ESM fetch, breadcrumb A3 dims). Each SPEC-PENDING row's AC freezes only after its live-Framer extraction lands. **Spec insurance:** instance-panel "Trigger" row = PAID Convert add-on, NOT event UI — never spec as event UI.

## Process (locked)
Probes/E2E in THROWAWAY per-auditor worktrees, never the build branch. Cleanliness = capture baseline both repos + restore exact baseline (quarantine-move, never rm untracked without Dan confirm). Batch → freeze → one review.

---
**v1.3 is immutable on Dan's sign and permanently AC-2-bound.** Because the census surfaced source-backed gaps (2026-07-13), a SUCCESSOR (v1.4) will bind AC-3 after Chief QA freezes it — never a self-rebind; had the census found none, v1.3/AC-2 would stand as final. Next: fresh adversarial review (@s58-qa + @s58-expert) on this whole doc → both PASS → Dan sign → build P0 (census→AC-3→v1.4 runs in parallel and gates FINAL). **No product build until Dan signs.**
