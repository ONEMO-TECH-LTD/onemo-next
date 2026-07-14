# Framer Component Module — COMPLETION CONTRACT v1.1 (atomic, traceable full-parity scoreboard)

**Owner:** @s58-designer (lead + meta) · **2026-07-13** · supersedes v1 (folds Codex-Chief-QA's 19-finding review: atomic rows, no-green-without-visible-proof, missing surfaces, per-row traceability, no invented numbers). v0 architecture §1–§10 stands.
**Reviewed-by-before-Dan:** Codex-Chief-QA + s58-expert (adversarial) — required before Dan sign.

## Product Law
Clone Framer's **behaviour, model, full functionality**, rendered in **ONEMO/Figma styling** (DS tokens, Chillax, brand oklch, Phosphor-light icons — never Framer purple/chrome). Clone only what is **extracted and in front of us** — **no invention, no vibe-coding, no guessed numbers**. Any target dimension/vocabulary must come from a measured Framer source or a Dan decision.

## Dan product decisions (2026-07-13, approved)
Drag-insert = MANDATORY · New Event = extract+BUILD · Blank create = RESTORE.

## Completion Law — the 5-stamp rule (per atomic row)
A row is DONE only with ALL FIVE: **① source-proof** (named commit) · **② human-visible browser proof** (Dan-openable; headless NEVER substitutes) · **③ QA independent PASS** · **④ Meta/design-fidelity PASS** (Figma-styled Framer, V/S) · **⑤ Dan sign-off**. Each stamp tracked in the row's Linear issue. **Nothing is green until all five. Today: zero rows are DONE.**

**Status taxonomy (honest):** `LIVE-WORKING` = exercised in a HEADED visible browser (human-visible ② met) · `MECH` = headless-only (visible owed) · `CODE` = code present, unrun · `PARTIAL` · `UNBUILT` · `REMOVED` · `BUG` · `⧗SPEC` = expert extraction owed.
**Layer discipline (s58-qa deslop rule — do NOT conflate):** `schema/model exists` ≠ `command exists` ≠ `UI exists` ≠ `runtime exists`. A capability with only graph schema (e.g. InteractionEdge, `VariantFrame.kind` hover/pressed [engineer: there is NO separate `stateKind`], TransitionSpec, AssetFolder, override-lineage) is **UNBUILT/foundation**, NOT partial-capability. Also: `semantic command` ≠ `lifecycle op` (import/revalidate/rebase/undo). And the old lib.ts component/state/connector/instance writers are **unreachable cemetery** (editor-write rejects them) = reviewed-removal work, not evidence of partial capability.
**Audit basis:** THREE independent audits converged @ 8d64fd3 — designer, Codex-Chief-QA (source), s58-qa (**HEADED visible Chrome :3030 + headed committed E2E 1/1 in 54.6s + dead-end screenshot**). Command surface = exactly 4 semantic commands (create-from-selection, create/rename/move variant) + 4 lifecycle ops. The free-variant slice is now HUMAN-VISIBLE-PROVEN; everything else foundation-only or UNBUILT.
**Open real gap (s58-qa):** `editor-components/route.ts:23-25` silently maps every parser failure to `variantAxes:[]` — inventory can't tell true-no-axis from corrupt/unsupported; contradicts the projection-error law. Add as a fix row.

---

## THE SCOREBOARD — atomic rows (Linear E12 = KAI-9437; each row → its issue)

### A · Canvas & shell — KAI-9438
| Row | Capability | Status |
|---|---|---|
| A1 | Infinite canvas (Framer pan/zoom, free placement) | PARTIAL (s58-qa: pan/zoom + expanding graph bounds exist, but authoring is a finite 800×600-min host clipped by the screen container — "expanding finite host", NOT true infinite) |
| A2a | Entry via **page-element selection** → Create-from-selection → dialog → flow | **LIVE-WORKING** (s58-qa headed E2E 1/1, 54.6s — full flow visible) |
| A2b | Entry via **asset double-click** on a component → canvas | **BUG / FALSELY-CLAIMED** (s58-qa headed: only global DemoButton shipped, edit is project-only → red "Global library authoring not available" toast, no canvas; screenshot proof). *These are TWO separate rows (s58-qa correction — a working authoring path DOES exist via page-selection).* |
| A3 | Breadcrumb prominent + Figma-styled + icons | PARTIAL (both QA: works outside zoom but `label-xs`/10px materially smaller than §6 top-bar target; **TARGET dims ⧗ pending expert Framer measurement or Dan choice — NOT invented**) |
| A4 | One-canvas scoping (page hidden, one component) | **LIVE-WORKING** (s58-qa headed: same host overlays ComponentCanvas, page iframe returns on Home) |
| A5 | Component **content editing** (edit inner layers/elements) — KAI-9447 | UNBUILT |

### B · Component lifecycle + menu — KAI-9439 (atomic — each menu item fail-able alone)
| B1 create-from-selection | LIVE (page-selection, s58-qa headed E2E) · B2 blank-create | REMOVED→restore · B3 rename-component | **UNBUILT/foundation** (route rejects AUTHORING_TRANSACTION_REQUIRED + UI disabled — cemetery, not reachable) · B4 duplicate | UNBUILT · B5 delete | UNBUILT · B6 find | UNBUILT · B7 copy-import | **CODE** (reachable, page.tsx:3932) · B8 copy-URL | UNBUILT ⧗ · B9 library | UNBUILT ⧗

### C · Variants + Primary-override — KAI-9440
| C1 create-variant | MECH · C2 rename-variant | MECH · C3 move-variant (sidecar-only) | MECH · C4 delete-variant | UNBUILT · C5 Primary default+label | MECH · C6 Show Primary | UNBUILT · C7 Detach From Primary | UNBUILT · C8 Update Primary | UNBUILT · C9 Reset Overrides | UNBUILT

### D · States — KAI-9441
| D1 Hover state ghost→frame+implicit wire | UNBUILT · D2 Pressed state ghost→frame+implicit wire | UNBUILT

### E · Props / property-controls — KAI-9442 (⧗ model pending expert)
| E1 expose-as-prop (text) | UNBUILT ⧗ · E2 control types (bool/enum/color/number) | UNBUILT ⧗ · E3 instance props panel + set-instance-prop | UNBUILT ⧗ · E4 reset-to-default | UNBUILT · E5 pipeline safety (tsc0/parse-guard) | UNBUILT

### F · Node / interaction system — KAI-9443
| F1 New Transition | UNBUILT · F2 New Event | UNBUILT ⧗ · F3 trigger vocab (5) | UNBUILT · F4 Set Variant params | UNBUILT · F5 wires straight/arrow/scoped | UNBUILT · F6 connector drag-pickup | UNBUILT · F7 transitions (4 forms) | UNBUILT · F8 ▶ play badge | UNBUILT · F9 Reset Override+undo | UNBUILT

### G · Play/preview — KAI-9444
| G1 ▶ preview iframe, live run, Back-restore | UNBUILT

### H · Assets/folders/page — KAI-9445 (⧗ page spec pending expert)
| H1 folder tree CRUD+sort, no import churn | UNBUILT ⧗ · H2 project/global/category | PARTIAL (global authoring blocked) · H3 search | UNBUILT · H4 real rendered previews | UNBUILT · H5 instance counts | UNBUILT

### I · Instances — KAI-9446
| I1 insert-menu | UNBUILT · I2 insert-drag (mandatory) | UNBUILT · I3 detach | UNBUILT · I4 replace-with | UNBUILT · I5 replace-all | UNBUILT · I6 variant picker | UNBUILT · I7 go-to-main | UNBUILT

### K · Style inspector — KAI-9449 (⧗ panel spec pending expert)
| K1 Framer section set (Position/Size/Layout/Effects/Fill/Radius/Transition/…) editing→source | UNBUILT ⧗

### J · Cross-cutting gate — KAI-9448 (applies to every row)
J1 Figma-styled skin V1–V10 · J2 behavior S1–S9 · J3 persistence/reload/undo/dead-end · J4 human-visible proof (Dan's rule) · J5 two-repo clean. **These ARE stamps ④/②/③ of the 5-stamp rule.**

**Correction (QA + own): redo is REMOVED** (was implied); confirm as a row under C/history or drop by Dan choice.

## V1–V10 / S1–S9 mapping (embedded, no longer just referenced)
- **V1** zero Framer purple · **V2** one accent token · **V3** Phosphor-light icons only · **V4** DS Option-B segmented controls · **V5** ONEMO chips · **V6** ghost pills · **V7** solid/dashed selection grammar · **V8** wire = accent stroke straight arrowhead · **V9** DS type/spacing · **V10** semantic-parity per element. → all live under **J1**, checked per surface as each row ships.
- **S1** selection ladder · **S2** overlay selection-scoped · **S3** inspector section order · **S4** interaction row anatomy · **S5** context menus+guards · **S6** wire geometry measured · **S7** preview honesty+Back · **S8** variant lifecycle persistence · **S9** delete-guard UI+engine. → all live under **J2**, mapped to the owning row (S3/S6/S7→F,K,G; S8→C; S5→B,I; S1/S2→A,F).

## Owners
designer = lead/meta (no build) · engineer = sole builder (atomic slice, sources in front, no invention) · expert = adversarial QA + live-Framer extraction of ⧗ rows + overflow · Codex-Chief-QA + s58-qa = independent classification + adversarial per-slice + human-visible gate · Dan = decisions + sign.

## Engineer seam-map corrections (folded inline below — content captured, no external-path dependency; engineer to promote the source artifact to `__qa-dispatch/` if it becomes a binding input, 2026-07-13)
- Command union re-confirmed (4). **Dead-end root cause (exact):** zero project TSX components + DemoButton is global + page opens only project entries + session hardcodes `project-main` + blank-create deferred → nothing editable. Fix A2b via B2 blank-create restore (Dan-approved) + a seeded/editable path.
- **SourcePropertyRef already exists** (C override foundation real). **No separate `stateKind`** — `VariantFrame.kind` already carries hover/pressed (correct my earlier wording). Legacy prop/state/connector/insert writers exist but are correctly blocked → must become **staged compiler plans** (not reused as-is). **Props/controls need a new typed schema.**
- **OPEN ARCHITECTURE DECISION (lead/meta owns, resolve before F/transitions slice):** per-edge transition ownership (does the transition live on the InteractionEdge or the target variant). Not a Dan call — I decide with the architecture before that slice builds.
- Slice sizing (S/M/L per command group) captured in the seam map → feeds the build-order.

## ⧗ Spec-pending (expert extraction dispatched — AC frozen after it lands)
Props model (E1–E3) · New Event (F2) · component menu items (B7–B9) · Components-page behaviors (H1,H3–H5) · Style-inspector panel (K1) · breadcrumb TARGET dims (A3).

## Build-order (QA-corrected dependency chain — content-editing + inspector are FOUNDATIONAL, not last)
**P0** reachable entry: A2b dead-end fix + B2 blank-create restore + A3 breadcrumb (measured). →
**P1** inner-content selection/edit (A5 content-editing) + inspector foundation (L style-inspector) — these underpin everything; A5 CANNOT be last. →
**P2** lifecycle/organization (B menu, H folders/page/category/moves). →
**P3** variants/states (C4–C9 override, D states). →
**P4** props (E). →
**P5** interactions/preview (F node system, G play). →
**P6** instances (I). Each = one atomic slice, QA-gated, human-visible before next.

---
## ⚠ POST-FREEZE MATERIAL FINDINGS — expert adversarial audit (real visible Chrome, 2026-07-13) — MUST fold into v1.2
`__qa-dispatch/s58-framer-parity-adversarial-audit-expert.md`. These change the true state and are new P0s:
- **X1 — create-from-selection is LAB-ONLY, USER-RED (P0).** It REFUSES every element of every real page: `CREATE_COMPONENT_SOURCE_UNSUPPORTED` — an un-normalized module-css dep escapes the component root (e.g. `…/converted/mother-v2/mother-v2.module.css`). The s58-qa headed E2E was a dependency-free LAB FIXTURE (lab-green). **Correct B1/A2a from LIVE-WORKING → LAB-ONLY / user-red.** Combined with the A2b global-block dead-end: **NO authoring path exists from any real content page at 8d64fd3.** Fix = normalize/allow module-css deps within root. → new Linear P0.
- **X2 — empty-canvas click hard-crashes the editor (P0).** pan null-race `page.tsx:3666` (guard passes, setView updater derefs `pan.current!` after pointer-up nulls it) → Next error overlay, editor dead. One-line fix. → new Linear P0.
- **X3 (UX):** refusal dialog wedges (retry fires no request); raw error codes shown to user.
- **X4 (process):** shared :3030 runtime was wiped mid-audit by a parallel lane's fixture-restore → **per-auditor isolated worktrees required** (confirms the cleanliness root fix).
- **Confirmed GOOD (expert real-input, on the one eligible lab path):** variant create/rename(Enter/Esc)/move/undo/one-canvas/Home/DS-skin/borderless-unselected/no-double-Primary — my 5 closed findings HOLD. Breadcrumb 10px tiny ◐ agreed. *(Minor discrepancy to resolve at F-P1: expert saw rename click-away COMMIT, I measured it DISCARD — reconcile.)*
- **/o-deslop:** legacy WriteOps zombie block in lib.ts (route-refused since f5b81e7, impls remain) → EXTRACT/KILL; 5 stale pre-reset docs in source tree → ARCHIVE.

**TRUE-STATE HEADLINE (corrected):** at 8d64fd3 there is **NO working authoring path from a real ONEMO page** — create refuses (X1), asset double-click dead-ends (A2b), empty-canvas click can crash (X2). The free-variant slice works ONLY in a synthetic fixture. P0 must restore a real user path before anything else.

---
## ⛔ FROZEN FOR CONVERGENCE (2026-07-13) — stop live-patching this doc
The status cells above are a **dated snapshot**, not the live authority. To end the review-a-moving-target thrash:
- **Live status/stamps → Linear E12 (KAI-9437 + KAI-9438…9449).** Each capability issue's checkboxes track the 5-stamp progress. Status changes there, not here.
- **Atomic acceptance → Codex-Chief-QA's durable checklist** `__qa-dispatch/s58-framer-parity-ATOMIC-ACCEPTANCE-CHECKLIST.md` = the BINDING per-row AC authority (NOT the /tmp copy). v1.2 binds this exact artifact, assigns a **stable row ID** to every checkbox, and maps those IDs **1:1 into Linear E12** (each E12 issue's checkboxes = the stable rows). Source-precedence law: exact-source truth > contract prose > any snapshot.
- **This markdown = the LAW + structure + owners + decisions** only (product law, 5-stamp rule, layer discipline, spec-pending, build order). It does not duplicate a status matrix.
- **v1.2 = ONE consolidation pass by me** (lead) integrating QA's atomic acceptance checklist (bound by exact path + revision/hash; exact CHECKBOX count stated truthfully at freeze — NOT the line count; QA still atomizing compound checks, so the number is not final until ID-freeze) + all corrections into this structure, then **ONE** adversarial review by both QA lanes + expert on the whole frozen doc — not live-edit drift.
Unscored items still owed in v1.2: A2 context-menu Edit / intended global-library behavior / inventory reachability; A3 icon assumption (drop unless expert-measured/Dan-chosen); A5 atomization; instance Trigger + Edit-Component; category + Project/Global moves; blank-create AC; redo resolution; inspector-behind-ellipsis; build-order (content-editing is foundational — move earlier, not last). **No product build until v1.2 clears one review + Dan signs.**
