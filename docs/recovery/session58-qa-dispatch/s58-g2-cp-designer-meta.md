# G2 checkpoints 1+2 — Designer Meta measured pass (folded, one live probe)

**Auditor:** @s58-designer · 2026-07-11 · **Commits:** ecfb24d (cp1) + 5b7ab8a (cp2, contains cp1) — probed at **5b7ab8a**
**Method:** execution-backed. Own pinned worktree `s58-designer-g2-5b7ab8a` (detached @ 5b7ab8a, created because QA's pinned tree was in use and the shared tree has in-flight next-slice edits). Dev server :3027 from that tree. Click-through via Playwright chromium 1.58.2 (Chrome MCP down — same vehicle class as QA, labeled). Disposable probe component `MetaProbeCard` created project-root INSIDE my worktree only — shared library untouched (verified: its status unchanged, still only the pre-existing N3 residue). Evidence: `s58-g2-cp-screens/01–07.png` + `probe-log.json` (raw measurements). Tests 52/52 + tsc 0 re-run by me at 5b7ab8a.

## MEASURED PASS — the required G2 flow works end-to-end, live

| Probe | Result |
|---|---|
| Board entry | `[data-authoring-canvas]` rendered 1707ms after nav (single cold-ish run; budget = Dan §14.5, QA's 20-warm protocol later) |
| Create variant | UI → server → **source hash changed** (544c50→996577), "Hover State" in TSX, sidecar created, new frame at free x=360 |
| Rename | UI → source hash changed, DOM + TSX show "Pressed State" |
| Move +24px | sidecar x 360→384, **source hash UNCHANGED — sidecar-only PROVEN** |
| Reload (S8) | free x/y PERSISTED (384px survived reload) |
| Undo #1 (move) | sidecar reverted 384→360, **source still untouched** — sidecar-only undo proven |
| Undo #2 (rename) | DOM + **source restored** to "Hover State", "Pressed State" gone — G1-transaction preimage undo proven live |
| Sidecar shape | `root:{kind:project}`, `storeId:project-main`, **zero absolute-path leak** — H1 proven on live-written sidecar |
| Selection | pointerdown → 2px solid outline on selected frame only (S1 partial: select works; no deep-select ladder yet — G2-residual) |
| Primary semantics | filled diamond = Primary, hollow = linked variant — correct lineage read |
| Console | **ZERO errors/warnings** across the whole flow |

## FINDINGS (all G2-close blocking, none checkpoint-blocking)

### F-G2-1 — Framer purple + no DS tokens (V1/V2/V9) — now MEASURED, not just code-read
Computed styles on the live board: boardBorder `rgb(151,71,255)` = **#9747FF Framer purple**, breadcrumb `rgb(134,56,229)` = #8638E5, button borders same purple; `system-ui` font; all inline styles. The board answers the lead's "does it feel ONEMO?" question: **it currently feels like the old dev-tool board** — same palette constants reused. G2's AC ("ONEMO selection/ghost/breadcrumb semantics measured") cannot pass until the board renders in DS tokens.

### F-G2-2 — form-control authoring vs canvas gestures (S8)
Create = text input + button (Framer: +Variant ghost, one click, auto-name). Rename = second input + button (Framer/S8: inline label double-click). Move = "Move +24px" button (Framer: drag). Undo = button (fine as a surface, needs ⌘Z too eventually). Right data flow, placeholder interaction model — engineer self-reported this honestly.

### F-G2-3 — NEW: authoring board is EMBEDDED in the full inventory board
Screenshot 06: the authoring canvas renders as one section INSIDE the all-components scroll surface — "PROJECT / UNGROUPED" header above it, "GLOBAL / BUTTONS / DemoButton" fully visible below it. The contract's G2 AC and B2 require edit-in-place showing **ONLY that component's variants** — and this is verbatim Dan's original live-test complaint ("why pressing selected component opens entire board with all components as opposed to only selected?"). The graph-backed board replaced the *content* of the edited component's cell, not the *scope* of the surface. Must be fixed inside G2 — flagging now so it doesn't ride to the gate as a surprise.

### LOW
- Group header says "9 variants" while the graph board shows 2 — legacy frame-count (union/ghost frames) leaking into the label next to the graph-backed board. Confusing adjacency; fix when the board scope is fixed.
- Breadcrumb is text inside the board div, not canvas-top-bar chips — already tracked as G2 residual by the lead.

## Residuals already tracked by lead (confirmed, not re-flagged)
Breadcrumb placement, deep-select ladder absent, ⌘Z, drag gestures — all G2-scope, listed above where they intersect my S-probes.

## Verdict
**Checkpoints 1+2: PASS as data-flow checkpoints** — the canonical flow (create/rename/move → reload → undo) is live-proven with byte-diff discipline, exactly the architecture working as contracted (staged compiler writes, sidecar-only geometry, transaction undo). **G2 phase close requires F-G2-1/2/3 resolved** and the S/V probes re-run on the reskinned, edit-scoped board. Worktree + probe artifacts retained as evidence until gate close (my pinned tree is disposable; library repo untouched).
