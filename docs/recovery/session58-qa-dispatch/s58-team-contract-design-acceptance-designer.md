# Team Contract — DESIGN/BEHAVIOR ACCEPTANCE LAYER (designer/Meta input)

**Author:** @s58-designer (Kai-Claude) · 2026-07-10 · for @s58-lead/Dan
**Sources:** my independent Framer extraction (`s58-framer-extraction-designer-ledger.md`), gap report (`s58-framer-gap-report-designer.md`), blueprint review (`s58-framer-blueprint-review-designer.md`), ONEMO DS v2.3.1 (control-states Option B), standing icon/verification rules.
**Scope note:** acceptance definitions only — no product edits made; no sign-ready claim expressed or implied. These are the gates work must pass, not a verdict on any build.

---

## 1 · ONEMO/Figma visual-language INVARIANTS (the skin contract)

Every invariant is testable; the test is named inline.

| # | Invariant | Test |
|---|---|---|
| V1 | **Zero Framer tokens in shipped UI**: no `#9747FF` (or any Framer-purple family), no Framer font stack, no copied Framer chrome assets | grep + computed-style sweep over the editor surface; count must be 0 |
| V2 | **One accent**: everything Framer renders purple (selection borders, wires, arrowheads, breadcrumb component chip, ghost-hover tint, badges, handles) uses the ONEMO accent token — the same token, not per-feature approximations | computed-style hash: all accent-role elements resolve to the DS token value |
| V3 | **Icons: Phosphor light or Figma-extracted only** — no invented SVG paths, no unicode glyphs as icons (standing rule) | icon inventory diff: every icon maps to a Phosphor/Figma source id |
| V4 | **Segmented controls** (panel tabs à la Agent/Style, `Once｜Cycle`) = DS v2.3.1 control-states **Option B** (parametric state-layer + motion) | state-layer presence + motion params measured against DS spec |
| V5 | **Chips** (breadcrumb): our chip primitive; page chip = neutral surface, component chip = accent-tinted surface; Phosphor doc/component glyphs | screenshot + computed-style vs DS chip spec |
| V6 | **Ghost slots**: our neutral pill w/ dashed or low-emphasis border; hover = accent-tinted fill (semantic parity to Framer's grey→lavender) | hover computed-style delta measured |
| V7 | **Selection grammar preserved through re-skin**: variant-frame select = solid accent border + handles; child deep-select = **dashed** border; the solid/dashed distinction is load-bearing (it drives overlay visibility) and MUST survive styling | DOM class/style assert in both selection states |
| V8 | **Wire**: our accent stroke, **STRAIGHT** edge-to-edge, **arrowhead at the TARGET end**; stroke width/marker from DS tokens | geometry probe (§2-S6) + token check |
| V9 | **Type/spacing**: one DS type scale for panel rows, labels, chips; row heights from DS density tokens — no per-panel ad-hoc sizes | computed-style sweep across panels |
| V10 | **Semantic parity per element**: every Framer affordance (selected-variant label, ▶ badge, ghost slots, wire direction, connect handle, Primary tag) has exactly ONE our-styled equivalent communicating the same thing — no orphan chrome, no dual affordances | checklist walk, element by element, screenshot-evidenced |

## 2 · SEMANTICS THAT MUST BE MEASURED (behavior contract)

Each row = a behavior with a binary measurement. "Measured" means DOM/geometry/computed-style probes on the live editor, not eyeballing.

**S1 — Selection ladder.** Click variant frame → frame-select (solid). Click into content → child deep-select (dashed). Escape pops selection UP one level per press. Variant LABEL click selects its frame. Click empty canvas → deselect.
**S2 — Overlay visibility rule.** Wires + ghost slots (+Variant, state) + label badge render **iff a variant frame is selected**; child deep-select or deselect hides ALL of them. Probe DOM in all three states.
**S3 — Inspector structure.** Variant-selected section order: `Interactions · Link · Position&Size · Layout · Effects · Overlays · Cursor · Styles (Transition FIRST: ⚡ Spring) · Selection Colors · Accessibility · Code Overrides`. Instance-selected: `<Name> · Component` section = **Variant picker · Trigger: Add… · [Edit Component]**.
**S4 — Interaction row anatomy.** Row = `[trigger] → [action chip] ✕`; trigger select options EXACTLY `Click · Click Start · Appear · Mouse Enter · Mouse Leave`; Set-Variant popover fields = `On · Delay(s) · Transition Once|Cycle · Variant(target)`; clearing the action leaves `Reset…`; multiple rows per variant allowed; row ✕ removes the interaction.
**S5 — Context menus.** (a) Element menu: Create Component = top action + ⌥⌘K, opens a **naming dialog** before creating; (b) menus are **searchable** (type-to-search field); (c) component menu: `Insert · Edit · Find · Rename · Duplicate · Delete · Library · Copy Import/URL` with **Delete DISABLED while instances exist**; (d) instance menu: `Edit · Set Default Size · Detach Instance · Replace With · Replace All Instances With` (two distinct replace scopes).
**S6 — Wire geometry.** Drawn the instant an interaction gets a target; straight segment; endpoints ON the frames' edges (owner → target); arrowhead marker at target end. Measure endpoints vs frame rects. **Fidelity note: do NOT re-introduce orthogonal/elbow routing** — straight is the Framer behavior even if it overlaps content (see U6).
**S7 — Preview contract.** ▶ → full-screen live render of the **actual compiled component** (our real generated React+CSS — not a canvas simulation); interactions fire for real (variant class change measurable on hover/tap); viewport W×H fields; `‹ Back` restores the exact edit context (same selection id, scroll, zoom).
**S8 — Variant lifecycle.** +Variant ghost = one click, no dialog, auto-name "Variant N", full copy, free frame; label double-click = inline rename accepting ANY string; Primary tag on the default variant; free x/y positions persist.
**S9 — Referential integrity.** Component deletion blocked while instances exist (UI disabled state AND engine-op refusal — both measured).

## 3 · PER-PHASE ACCEPTANCE (screenshot / geometry / accessibility)

Applies on top of the blueprint's P0–P6 ACs; each item names its evidence artifact.

**P0** — crash-free select ×20 consecutive (script-driven, log archived); component open latency measured (target <1s, numbers in ledger); insert places an instance (instance rect measured on canvas). *Evidence: probe log + latency table.*
**P1** — screenshot PAIR (page canvas ↔ component-edit canvas): component edit shows ONLY that component's variants; breadcrumb chips measured in the canvas TOP BAR (not attached to any frame — chip rect vs canvas-bar rect); zoom/pan persists across enter/exit (values compared); a11y: chips focusable + labeled, panel tabs keyboard-reachable. *Evidence: screenshots + geometry JSON + a11y tree dump.*
**P2** — create ≥3 variants at arbitrary positions (x/y persist after reload); inline rename with spaces/unicode; DOM contains NO fixed state list; S2 overlay rule holds (three-state DOM probe); S8 full pass. *Evidence: before/after screenshots + DOM asserts.*
**P3** — S4 vocabulary probe (read the real options — exactly five, fail on any extra/missing); S6 wire geometry probe on ≥2 interactions incl. a non-horizontal pair; S2 re-probed with wires present; remove paths (row ✕ AND wire-delete) leave model clean (engine round-trip byte-check); Once|Cycle → engine mapping proven (Cycle=switch-cycle, Once=single); a11y: rows/✕/popover fields labeled + keyboard-operable per DS Option B focus states. *Evidence: geometry JSON + option-list dump + round-trip diff.*
**P4** — S7 full pass: variant-class change measured in preview on hover AND tap; Back-restore equality (selection/scroll/zoom triple); preview renders the generated component file from disk (fingerprint match between preview DOM and compiled output). *Evidence: computed-style deltas + state-restore log.*
**P5** — folder create/nest/sort operations; S9 delete-guard both layers; both insert paths (menu now, drag when P0 fix lands); Detach yields a non-instance copy (DOM: no component ref); Replace With (single) vs Replace All (global) scopes verified on 2 instances. *Evidence: op log + DOM asserts.*
**P6** — V1–V10 full sweep (the skin contract above); screenshot suite of every surface archived; Framer-token sweep = 0 hits; icon inventory = 100% Phosphor/Figma-sourced; semantic-parity checklist (V10) walked element-by-element. *Evidence: sweep reports + annotated screenshot set.*
**All phases** — accessibility floor: every icon-only control (▶, ✕, handles, ghost slots) has an accessible name; focus visible per DS; menus/popovers keyboard-dismissable (Escape) — a11y tree dump per phase.

## 4 · UNCERTAIN FRAMER OBSERVATIONS (do not build on these without the named check)

| # | Uncertainty | Status / required check |
|---|---|---|
| U1 | **New Event trigger vocabulary** — never opened by either lane | Hand-open before P3 AC freeze |
| U2 | **▶ label-badge exact rule** — expert saw it appear with an interaction; I saw it on a zero-interaction variant while selected | Hand-verify matrix: {selected, has-interaction} × badge |
| U3 | **Connect-handle hover-reveal + drag pickup** — never reproduced synthetically; the corner dots are RESIZE handles | Hand-verify the handle's reveal zone + drag semantics before speccing ours |
| U4 | **State-ghost creation product** (auto-wire base→Hover on state creation) — seen in the 7/9 expert pass; NOT reproduced in my 7/10 session (menu resists synthetic clicks) | Hand-recreate once; confirm auto-wire + what the wire encodes |
| U5 | **Spring parametrization surface** — generated code defaults to `bounce/duration`; earlier inspector observation showed `stiffness/damping/mass`; which form the inspector exposes where is unresolved | Hand-check the Transition editor; record the authoring form + conversion |
| U6 | **Straight-wire overlap policy** — straight lines imply wires may cross frames in adverse layouts; unverified whether Framer mitigates | Hand-arrange an adverse layout; observe |
| U7 | **Resize-handle count** — 8 per testids vs 2 dots seen at small zoom; likely zoom-dependent | Trivial hand-check at high zoom |
| U8 | **Drag-insert feel** (drop highlight, placement rules) — mechanic confirmed, live feel not reproducible synthetically | Hand-drag once when P0 fix lands |

## 5 · META EVIDENCE REQUIRED BEFORE DAN REVIEW (per phase gate)

1. **Execution-backed only** (standing rule): every AC claim carries a live probe on the running editor — measured geometry, computed-style hashes/deltas, DOM asserts in all relevant states, latency numbers. Eyeball-only or "it should" = automatic FAIL at Meta.
2. **Screenshot + zoom pairs** archived per phase in `__qa-dispatch/` (whole-surface + zoomed detail), so Dan's review needs no live session to see the state.
3. **Round-trip proof** for every authoring surface: UI action → engine write → re-read model → byte-level diff of generated output (the engine's lossless contract must survive the new shell).
4. **Both-states probing**: any visibility/state rule (S1/S2/V7) evidenced in EVERY state, not the happy path.
5. **Auditable QA only** (hard block): verification runs in a visible session / committed ledger / PR review — hidden sub-agent output does not count toward any gate.
6. **Two-repo cleanliness** after every probe (engine worktree + component library `git status --short` incl. untracked — untracked ≠ clean).
7. **U-items resolved before their phase**: U1/U2/U3/U4/U5 closed (hand-checks, findings appended to the extraction ledgers) before P3's AC freezes; U6/U7/U8 before P6.
8. **P6 sweep reports** (V1 token sweep, V3 icon inventory, V10 parity checklist) as committed artifacts.
9. **Dan-facing package**: product-language summary + the screenshot walkthrough — no technical codes without translation (standing rule).

---
*Designer/Meta acceptance input complete. No sign-ready claim is made here; sign-readiness is assessed against these gates per phase, and Done remains Dan's gate alone.*
