# ADVERSARIAL AUDIT — independent QA pass on the TRUE-STATE doc (expert lane)
**Auditor:** @s58-expert · 2026-07-13 · **independent of Codex-Chief-QA (no notes compared)**
**Build audited:** `8d64fd3ede947aa1275e7896238bb3ce6f3aee4f` — verified twice from the serving worktree (`lsof` cwd of the :3030 next-server → `.codex/worktrees/s58-framer-architecture`; `git rev-parse HEAD` at audit start AND after the browser pass; tree clean, reflog clean).
**Instrument:** REAL VISIBLE Chrome (user's browser, real pointer/keyboard — not headless), source reads at the exact SHA, and live API instrumentation (fetch-log + direct preview calls). Evidence inline; screenshots in session transcript (ss_ ids cited).

## Verdict in one line
The designer's TRUE-STATE doc is **directionally correct and honest about the unbuilt majority** — my source pass confirms every UNBUILT/REMOVED row — but it **UNDER-counts the broken-ness of the one flow it calls working**: at this HEAD, **a real user cannot author a component from any real page** (finding X1), a **click on empty canvas can hard-crash the whole editor** (finding X2, new P0), and the fixture-based E2E green masks both.

---

## A. Row-by-row classification (my independent pass)

### "Built + mechanically verified" table
| Row | Designer | My classification | My evidence |
|---|---|---|---|
| Create from selection | ◐ human-verify owed | **PARTIAL — BROKEN on real pages** (see X1) | Live: refused with raw `CREATE_COMPONENT_SOURCE_UNSUPPORTED` on 2 real mother-v2 elements (ss_8551oyotq); works ONLY on a dependency-free element (empty draft-page root div) — full flow then works end-to-end (dialog → naming → transaction → auto-enter authoring, ss_9813n300p) |
| Create free variant | ✅ | **LIVE-WORKING** | ghost single-click → "Variant 2" spawned AT ghost slot, ghost shifted right same row (ss_8759592uh); real pointer |
| Rename (Enter/Esc) | ✅ | **LIVE-WORKING** | select→click-label → input; Enter committed "Hovered" (~5s real source txn); Esc discarded "JunkName"; click-away COMMITTED "ClickAway" (no silent discard) — all real keyboard |
| Move + persist | ✅ | **LIVE-WORKING** | real drag 344,0→422,286 (free x/y); rename survived crash+reload (durable store) |
| Undo ⌘Z | ✅ | **LIVE-WORKING** | ⌘Z reverted move to 344,0 |
| Import-source recovery | ✅ | **BUILT (source-verified), not independently UI-exercised** | recovery code real (`authoringState === 'import-preview'` path, 7a4e8b9); my create path auto-imports so the gate never fired for me; designer's 24-import-ui.png is the live evidence — no contrary evidence |
| One-canvas edit-in-place | ✅ | **LIVE-WORKING** | dbl-click project component → same canvas, page iframe hidden → Home → page iframe `visibility: visible` again |
| Breadcrumb | ◐ tiny | **AGREE ◐** | measured: **10px Chillax**; chrome-pinned is REAL (parent `transform: none` — outside zoom container; 832441b verified in source + DOM) but prominence gap vs Framer's top-bar chips stands |
| DS-token skin | ✅ | **LIVE-WORKING** | computed styles: selected outline `oklch(0.7033 0.1001 238.99)`, bg oklch brand ramp; `border:0`+`outline:none` when unselected (D2-b fix proven by computed style); no "Primary · Primary" (D2-a fix live) |

### "NOT built" table — **ALL CONFIRMED via source** (command vocabulary is exactly `create-component-from-selection / create-variant / rename-variant / move-variant / undo / revalidate-source / module-css / environment-rebase`; nothing else exists)
- States ✗ — no state commands; **but** `VariantFrame.kind: 'primary'|'custom'|'hover'|'pressed'` EXISTS in the graph type (designer's "stateKind field exists" is right in substance — the field is named `kind`). `TransitionSpec` type also already modeled (instant/ease/spring-time/spring-physics) — commands/UI zero.
- Node/connector/interaction system ✗ — `InteractionEdge` type + schema validation exist **with the correct live-verified trigger vocab** (`click, click-start, appear, mouse-enter, mouse-leave`) — zero commands, zero UI. Model groundwork is ahead of the doc's implication; build status ✗ stands.
- Transitions ✗ · Play/preview ✗ · Primary-override menu ✗ (SourcePropertyRef + InteractionOverride + inheritance `primary|linked|detached` all in the graph — no UI) · Folders ✗ (graph field, no CRUD) · Instances ✗ (type only) · ▶ badge ✗. Blank-create ⊘ — REMOVED **and disclosed in the UI** ("Blank component creation is not available in this phase…" ss_53990plrb) + ctx-menu items disabled with phase reasons (ss_9928cajsj).
- Infinite canvas ◐ — agree (bounded host; wheel didn't even pan in authoring mode during my pass).

### Bug row (double-tap dead-end)
**CONFIRMED live** — dbl-click DemoButton (only library component) → toast `Global library authoring is not available in this phase` (captured via MutationObserver; toast auto-fades — easy to miss headless). With zero project components + blank-create removed, the Components panel is a full dead-end. The rail's escape-hint ("Create from selection is available above") leads to finding X1.

---

## B. NEW findings (what the TRUE-STATE doc doesn't have)

### X1 — CRITICAL UNDER-COUNT: create-from-selection REFUSES every element of every real page
- Live: both attempted mother-v2 elements → dialog shows raw `CREATE_COMPONENT_SOURCE_UNSUPPORTED`.
- Root cause captured via direct preview call: **`exact source dependency required: src/app/(dev)/react-figma-components/../converted/mother-v2/mother-v2.module.css`** — the staged component imports the page's module CSS via an un-normalized relative path escaping the component root, and the exact-authority set refuses it. ⇒ **any element styled by a page's module.css — i.e. every element of the only real content page — cannot become a component.**
- The E2E "proof" of this flow uses a **synthetic dependency-free fixture** (`AuthoringE2EButton.tsx`, no CSS, planted into the component root by `tests/e2e/authoring-fixture.mjs`) — lab-green, user-red. The only user-reachable path I found: empty draft page's inline-styled root div (preview 200 → flow works).
- **Combined with the bug row: at this HEAD there is NO authoring path from any real content page.** This is exactly the dead-end class Dan's live test punishes.
- UX side-issues: raw error code shown verbatim (violates product-language law); after refusal the dialog is **wedged** — subsequent Create clicks fire NO request (fetch-instrumented, verified twice incl. precise ref-click on the enabled submit button); only Cancel escapes.

### X2 — NEW P0 CRASH: canvas pan null-race hard-crashes the editor
- `Runtime TypeError: Cannot read properties of null (reading 'vx')` at `src/app/(dev)/react-figma/page.tsx:3666` `ReactFigmaPage.useCallback[onMove]` (ss_4144a29y1).
- Code: `if (pan.current) setView(v => ({...v, x: pan.current!.vx + …}))` — guard passes, then the `setView` **updater** dereferences `pan.current!` after pointer-up nulled it. Classic guard-then-async-deref race.
- Trigger in my pass: a plain click (micro-drag) on empty page canvas during rename click-away → full Next error overlay, editor dead until reload. Real-pointer repro'd once; the race window is timing-dependent but the defect is deterministic in source.
- Fix is one line (capture `pan.current` before `setView` / null-check inside updater).

### X3 — Reload loses edit context
After crash+reload the editor returns to the page canvas; authoring does NOT restore (no Framer-style `?node=` URL state; resume is transaction-scoped only). Data was never lost (AuditProbe + committed rename survived). Roadmap-note, not a regression.

### X4 — Shared-audit-surface hazard (process finding for the lead)
At 08:57, while both independent audits ran against the same :3030 server/worktree, the runtime authoring state was **wiped underneath me** (component root reset: my `AuditProbe.tsx` + `.onemo` store deleted — consistent with the parallel lane's E2E fixture-restore or a clean). Git HEAD/reflog untouched; my evidence was captured pre-wipe and stands. But **two "independent" passes sharing one mutable server can destroy each other's repro state and produce false divergence** — the exact failure mode the two-pass design is meant to catch. Recommend: per-auditor server/store isolation for future rounds.
- Disclosure of my own mutations: created `AuditProbe` (component + variant renamed to "ClickAway") via the product UI on the shared build — since wiped by the parallel process; git tree clean at audit end. During earlier misclicks the build-source dropdown showed a "new-page-2" recent-build entry — I could not confirm whether my stray "+" click created it; git shows no tracked change.

### X5 — Minor Framer-parity deviation not in the matrix
Create-from-selection **auto-enters component authoring**; live Framer stays on the page and swaps the selection to an instance in place. Also unverified here: whether the consumer selection is actually replaced by an instance (my consumer page shows unchanged source — expected for a root-div create on an empty page, but the instance-swap behavior needs one dedicated check on a non-root selection once X1 is fixed).

---

## C. Q1/Q3 checks (the dispatch's under/over-count ask)
- **Q1 (no tracked metric): AGREE** — contract has gates not a checklist; stale Linear sprints (pre-reset) confirmed as described; this doc becoming the metric is the right fix.
- **Q3 sizing:** one correction — "stateKind field exists" → the field is `kind` on VariantFrame (hover/pressed already enumerated) AND `TransitionSpec` is already fully modeled; States and Transitions slices are slightly cheaper than the table implies (graph+schema done; commands/UI/compile remain). Node-system L sizing: agree. The expert/engineer split as written matches my lane constraints (I stay QA/evidence/re-probe; bounded slices to the engineer).

## D. /o-deslop pass (third triad leg, sweep-level)
- **Zombie implementation block (flag → engineer):** all legacy authoring WriteOps (`make-component`, `set-variant-structure`, `add-state`, `add-variant-axis/value`, `expose-as-prop`, `set-instance-prop`, `insert-component`, `set/remove-connector`, `create/rename-component`) are route-REFUSED since f5b81e7 (`AUTHORING_TRANSACTION_REQUIRED` 409 — contract-correct) but their implementations remain inside `src/app/api/dev/editor/lib.ts` (2750 lines) as unreachable code sharing the file with live ops (duplicate/delete-jsx etc.). Disposition proposal: EXTRACT-then-KILL by the engineer once Dan signs; risk: shared-file entanglement — not a naive delete.
- **Stale docs in source tree (ARCHIVE proposal):** `src/app/(dev)/react-figma/ENGINE-PLAN.md` (+`-E2.4`), `FIGMA-SPEC-text.md`, `FIGMA-SPEC-variable-pill.md`, `INSPECTOR_STOCKTAKE.md` — pre-reset era; `editor-write/route.ts` header still cites "ENGINE-PLAN.md §3 M4".
- E2E spec: clean (0 networkidle, 0 waitForTimeout — re-confirmed).

## E. What blocks a G2 "working" claim (my list, priority order)
1. **X1** — module-css dependency staging/normalization so real-page elements can be componentized (or an explicit product decision that converted pages are not source-eligible + product-language messaging). Includes dialog retry + human-readable error.
2. **X2** — one-line pan crash fix.
3. Bug row (global dead-end) — the doc's P0 slice already covers it.
4. X5 instance-swap verification once X1 lands.

Nothing here is a closure claim — **no sign-off implied; Dan's gate.** Framer-side re-probe of the un-specced capabilities (props/New Event/ctx-menu/assets page — incl. the blank-create contradiction row's Framer half) runs as the next block per the extraction dispatch.
