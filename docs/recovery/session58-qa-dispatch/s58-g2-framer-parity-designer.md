# G2 vs real Framer — measured parity comparison (designer Meta)

**Auditor:** @s58-designer · 2026-07-12 · **ONEMO at exact SHA `b9d72f1`** (my pinned worktree, server :3027, Playwright chromium — real pointer/keyboard input; prior G2 notes discarded per dispatch)
**Framer side provenance:** **expert-live-probed 2026-07-12** in authenticated Framer (`s58-framer-live-probe-expert-2026-07-12.md`) — fresh live observation, NOT memory/§B recall; my own live lane blocked (Chrome MCP down, 2FA wall — unblockable by a 2-min Dan assist if my-hands evidence is wanted). Two Framer sub-items remain [FRAMER-STANDARD, not harness-verifiable]: exact rename trigger/Esc, move-drag/snap — flagged inline, not asserted.
**Evidence:** `s58-g2-parity-screens/16–23.png` + probe JSON in transcript. Baseline re-verified by me at b9d72f1: 168/168 tests, tsc 0 (after clearing my stale .next types), components-canvas route retired, worktree clean + pinned.

**NO PARITY CLAIM is made for the two unverified Framer sub-items. Everything else below is measured on both sides.**

---

## D1 · Same-canvas context

**(a) Behavior vs Framer: PARITY IN KIND, one placement deviation.**
- ONEMO measured: authoring renders INSIDE the same canvas host (`data-screen-host` contains the authoring canvas), page iframe `visibility:hidden`, dot-grid + pan/zoom shared, ONLY the edited component's variants on canvas; other components exist in the left rail only. Framer live: same infinite canvas `?node=`, page fully hidden, page tree remains in left Pages tab. **Match.**
- **DEVIATION D1-a:** our breadcrumb lives INSIDE the zoom transform — it pans/zooms with the canvas (measured: `breadcrumbInsideZoomTransform: true`). Framer's chip bar is fixed top-bar chrome. See D5.
- **Open sub-item:** ONEMO auto-selects Primary on entry (ghost visible immediately). Framer's entry-selection state wasn't captured — needs one observation before calling it either way.

## D2 · Primary/default treatment

**(a) vs Framer: MECHANISM PARITY (exact), one visual deviation, one cosmetic bug.**
- Primary = **name-label suffix `· Primary`** in accent — ONEMO uses exactly Framer's mechanism (suffix, not chip/pill). **Match, measured both sides.**
- **BUG D2-a (cosmetic, fix cheap):** default variant is *named* "Primary", so the label renders **"Primary · Primary"**. Either name the default variant "Variant 1" (Framer's convention) or suppress the suffix when displayName === "Primary".
- **DEVIATION D2-b (real):** unselected frames show a **1px dashed accent border** (measured post-deselect). Framer live: unselected = **NO border at all** — fill against canvas. Worse: dashed is *our own reserved grammar for child deep-select* (V7), so dashed-when-merely-unselected overloads a semantic we depend on. Recommend: unselected = borderless.
- Selected = solid accent outline ✓ parity in kind. Framer's corner resize-handles + right-edge ⚡ connect-handle are absent — expected (resize/connectors = later phases), listed for the phase map, not a G2 deviation.

## D3 · Free-frame placement

**(a) vs Framer: PARITY on all measured behaviors; one scope gap.**
- Ghost sits RIGHT of the last frame, same row; new variant **spawns at the ghost slot**, auto-shifts next — measured on both sides. **Match.**
- **Ghosts are selection-scoped on both sides** — measured: true deselect (click empty canvas) hides our ghost; Framer live: no ghost unless a variant is selected. **Match** (this was the old NodeLayer trap — now correct).
- Free positioning persists (drag + reload proven in the flow probes). **Match** with Framer's free-placement model.
- **SCOPE GAP D3-a (not a deviation):** no STATE ghost (Hover/Pressed below the selected variant) — state-variant creation isn't in this G2 slice; belongs to the interactions phase with the G0-closed Hover/Pressed evidence.
- Gap width (ours 24px logical vs Framer's ~100px at 395w frames) → **(b)** spacing decision, not behavior.

## D4 · Create / rename / move affordances

**(a) vs Framer:**
- **CREATE: EXACT PARITY, measured** — single-click ghost → variant created immediately, auto-named "Variant N" (measured "Variant 2"), real source write. Framer live: identical (single click, direct create, same name pattern).
- **RENAME: PARITY GAP — F-P1 (MED, the one real interaction finding).** ONEMO: select-then-single-click label → inline input (works, measured). But the commit model is **blur-only**: **Enter does NOT commit** (input stays open), **Esc does NOT cancel** (input stays, text kept), and **click-away can silently DISCARD the edit** (measured: my typed rename was lost when clicking empty canvas — input unmounted without commit). Framer's exact trigger is the one unverified sub-item, but Enter-commit/Esc-cancel is table-stakes inline-edit convention regardless. Fix: keydown handlers on the input (Enter=commit, Esc=cancel) + commit-on-unmount or explicit cancel.
- **MOVE: PARITY IN KIND, measured on our side** — drag the frame body from anywhere, live drag preview (measured mid-drag), free placement, sidecar-only write (source hash untouched), ⌘Z reverts. Framer's drag gesture itself is the second unverified sub-item ([FRAMER-STANDARD]); its snap-to-guides is absent in ours — later-phase polish.
- **UNDO:** ⌘Z measured working; the gesture helper also maps ⇧⌘Z→redo — redo not yet probed end-to-end (one-line follow-up).

## D5 · Home / breadcrumb navigation

**(a) vs Framer: ANATOMY PARITY, two deviations.**
- Chip anatomy matches: neutral pill "Home" + bare `›` + accent-bordered/tinted component chip (measured styles both sides); Home click exits cleanly back to the page (measured: authoring unmounts, page iframe returns visible). **Match.**
- **DEVIATION D5-a (same as D1-a):** our bar is inside the canvas transform; Framer's is fixed top-bar chrome. Under zoom/pan ours drifts and scales — Framer's never moves. Recommend hoisting the breadcrumb out of the transformed container to fixed canvas chrome.
- **DEVIATION D5-b (minor semantic):** clicking OUR component chip selects the frame root; Framer live: clicking the component chip opens the **component context menu** (Rename/Duplicate/…, not navigation). Harmless today; align when component lifecycle actions land (G4).
- **(b)-adjacent gap:** chips lack the doc/◈ icons — icon work is Phosphor-law polish, listed for the skin pass.

## FLOW FINDING (outside the 5 dimensions, found on the way in)

**F-P0 (HIGH for the user flow): `import-source` has NO UI surface.** A user who creates a component and double-clicks to edit hits a dead-end `role=alert`: *"import the component source before authoring"* — correct named refusal (AUTHORING_GRAPH_MISSING, the contract's explicit import gate working), but **nothing in the UI can perform the import**; only a raw API call unblocks (that's how my probe — and presumably the engineer/QA proofs — proceeded). This is exactly the class of dead-end Dan's live test punishes. Fix: on AUTHORING_GRAPH_MISSING, offer the one-click import (classification preview → import) inline.
**MED note:** the import hash-precondition set includes `.next/dev/types/*.d.ts` (ephemeral build artifacts) — the precondition churns whenever the dev server regenerates types; consider excluding transient ambient types from the snapshot authority or the gate will 409 spuriously in normal dev.

## (b) ONEMO's deliberate design decisions (NOT deviations — per contract §7, not meant to match Framer pixel-for-pixel)

- **Color:** everything Framer renders purple, we render in the ONEMO brand oklch family (`--sem-col-border-brand` etc.) — measured throughout; zero Framer purple.
- **Type:** Chillax via `--al-type-family-primary` + fluid label tokens vs Framer's UI font.
- **Chip/radius language:** full-radius pills + DS radii tokens; ghost = brand-tinted dashed frame with "+ Variant" text vs Framer's grey ⊕ placeholder — same semantics, our voice.
- **Spacing scale:** 24px ghost gap and frame padding from our scale, not Framer's ~100px.
All (a)-row semantics survive these skins — that's the contract's "behavior exact, skin ours" line, held.

## Verdict for the lead

**Measured parity holds on the core model**: same-canvas scoping, suffix-based Primary, selection-scoped ghost placement/spawn, single-click auto-named create, free drag with sidecar-only persistence, Home-exit — all match live Framer with evidence on both sides. **Not claimable as parity yet:** the two [FRAMER-STANDARD] sub-items (rename trigger/Esc, drag/snap) until a manual Framer pass fires them. **Needs fixing before G2 gate closes:** F-P0 (import dead-end — flow-breaking), F-P1 (rename Enter/Esc/silent-discard), D2-b (dashed-unselected border), D2-a (Primary·Primary label), D5-a (breadcrumb inside zoom transform). D5-b/D3-a/icons = tracked to their phases. No sign-off implied — Dan's gate.
