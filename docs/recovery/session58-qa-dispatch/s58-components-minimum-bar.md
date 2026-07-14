# Components page — LOCKED MINIMUM BAR (Dan-directed, @s58-expert gate contract · 2026-07-08)

Dan verbatim: "make sure all the gaps above are filled and also additional framer must have modern
editor functions for component management and creation are in place and fully working **no toy ui**."

This supersedes "advice" — it is the scope the epic must ship, and the checklist my meta gate will
probe LIVE, item by item. A checkbox passes only on a real operation observed end-to-end (UI action →
server op → file change → HMR → visible result). Dead buttons, success-toasting stubs, name-only
placeholders = automatic FAIL (Dan's standing no-fake-actions law).

## A. Creation (relocated + completed)
- [ ] A1 Create blank component from the COMPONENTS page (name, Project/Global, category) → real file,
      appears in gallery + library grid without reload-hacks.
- [ ] A2 Create component FROM SELECTION from the Components page (existing make-component surfaced
      here) → instance replaces selection, component lands in gallery.
- [ ] A3 Duplicate component → new file, collision-safe name, barrel regen when global.
- [ ] A4 Delete component → refused (or consumer-list shown) when instances exist; clean delete when
      unused; barrel regen when global. (Op does not exist today — must be built.)
- [ ] A5 Rename component from the page (existing op, surfaced here — file + export + consumers).

## B. Props / Controls (the core new surface — Framer Properties parity)
- [ ] B1 `expose-as-prop`: select a text node inside a component → lift to prop with default; every
      existing instance keeps rendering (default fills). Text control first.
- [ ] B2 Control types minimum: **text, boolean, enum (variant-select counts), color, number**. Image +
      link controls may be phase 2 of the epic — named, not silently dropped.
- [ ] B3 Instance selected → Properties section in the inspector shows the component's props with
      current values; editing writes a REAL JSX attribute (`set-instance-prop` op — new).
- [ ] B4 Reset-to-default per prop (remove the attribute, fall back to default).
- [ ] B5 Props survive the pipeline: tsc 0 after every prop op; parse-guard refusal on unsafe lifts
      (local-scope refs) with an honest error — same discipline as make-component.

## C. Variants (authoring on the existing model)
- [ ] C1 Add variant (from the gallery or inspector): duplicates an export under a new name → new frame
      appears in the gallery group.
- [ ] C2 Rename / delete a variant (delete refused while instances use it, or consumers listed).
- [ ] C3 Instance variant SWITCHER in the inspector (rewrite tag to another export, AST-guarded).
- [ ] C4 Primary/default variant = the component-named export; UI marks it (Framer's Primary badge).

## D. Instance management (Framer must-haves)
- [ ] D1 Insert instance from the page's library grid into the selected container (existing op, moved).
- [ ] D2 **Detach instance** (Framer: Detach): replace `<Name …/>` with the component's subtree inlined
      (props substituted) — new op, the inverse of make-component.
- [ ] D3 **Go to main component**: from a selected instance, jump to the component in the gallery
      canvas (frame scrolled + selected). Client-side — the gallery jump plumbing already exists.
- [ ] D4 Replace instance: swap one component for another (tag + import rewrite; props dropped with an
      honest note when signatures differ).

## E. Library organization & browse (no toy UI)
- [ ] E1 Library grid shows REAL RENDERED previews (the gallery already renders components — reuse;
      name-only grey buttons are toy UI and fail the gate).
- [ ] E2 Working search (the current Assets search is a dead placeholder — wire it or it must not ship).
- [ ] E3 Categories visible + component move between category and Project↔Global (file move + barrel
      regen + consumer import rewrite; reuse rename-component's machinery).
- [ ] E4 Assets page = images/icons/upload ONLY — components tab REMOVED same batch (Dan's
      restructure-removes-old-surface rule).
- [ ] E5 Instance count per component in the library (consumer-walk already exists; cheap, honest).

## F. Gate discipline
- [ ] F1 Every new op parse-validated before write (assertValidTsx / postcss guard) + jailed like the
      existing ops; refusal errors are specific, not generic.
- [ ] F2 tsc 0 · eslint baseline (zero added) · /react-figma 200 · conformance/behavior suites green.
- [ ] F3 Engineer's Framer stock-take reconciled into the 4 buckets; every SKIP is named in the epic
      doc as a decision (nothing silently dropped).
- [ ] F4 Builder self-review → QA lane → my meta gate: I will live-probe EVERY checkbox above on the
      running editor before this routes to Dan. Partial scope = FAIL-with-findings, per Dan's
      locked-scope law (build all phases e2e, no mid-flight readiness theater).

## Sequencing steer (not binding, saves rework)
1) Relocation + E4 (page becomes self-sufficient with existing ops) → 2) A3/A4 lifecycle → 3) B props
(design-review the expose-as-prop AST contract WITH ME before implementing) → 4) C variants →
5) D2/D3/D4 instance ops → 6) E previews/search/move/counts polish.

— @s58-expert (gate owner for this epic per Dan's directive)
