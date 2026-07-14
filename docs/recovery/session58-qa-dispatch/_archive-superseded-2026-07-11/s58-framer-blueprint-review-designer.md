# Blueprint review — designer lane (independent verification, Dan-ordered)

**Reviewer:** @s58-designer (Kai-Claude) · 2026-07-10
**Reviewed:** `s58-framer-clone-BLUEPRINT.md` (+ evidence ledger `s58-framer-extraction-ledger.md`)
**Method:** my OWN full Framer extraction FIRST (fresh throwaway project "Average Book", user-position click-through + DOM/code dig incl. fetching the real generated component module) — ledger `s58-framer-extraction-designer-ledger.md`, gap report `s58-framer-gap-report-designer.md`. Blueprint read only AFTER my pass was on disk.

## VERDICT

**Direction independently CONFIRMED** — my extraction converges with the blueprint on every structural claim: the model inversion (infinite canvas, edit-in-place, free named variants, generalized trigger→Set-Variant interactions, play mode, folder tree, two insert paths, instance ops), KEEP-the-engine, the phased plan (my independently-derived order matches P0→P6), and the styling law. **But it is not sign-ready yet: 1 MED-HIGH + 2 MED accuracy findings below would bake wrong or missing behavior into the ACs.** All are cheap to fold.

## FINDINGS (fidelity to Framer)

### F-D1 — MED-HIGH · §1.4 + P3 AC: trigger vocabulary is ASSUMED and partially WRONG
Blueprint: "Trigger dropdown = Framer's event set (Click, Hover, Press, Appear, Scroll, …)". Your ledger's own wording shows it was inferred, not read ("hover/press/appear/scroll family — Framer's standard event set").
**I read the actual `<select>` in the live Set Variant popover. The real vocabulary is exactly: `Click · Click Start · Appear · Mouse Enter · Mouse Leave`.** No "Hover", no "Press", no "Scroll" tokens at variant-transition level — hover/press semantics live in the **Hover/Pressed state-variant gestures**, a different mechanism the blueprint itself documents in §1.3. P3's AC ("triggers match Framer set … Click/Hover/Press/Appear/Scroll") would build the wrong vocabulary and then pass the wrong test.
**Fix:** replace with the extracted five; separately extract **New Event**'s own vocabulary (neither of us opened it — flag as pre-build extraction item, not an assumption).

### F-D2 — MED · §1.4/B6: the interaction's actual PARAMETERS are missing
The Set Variant popover (operated live) is: **`On` (trigger) · `Delay` (seconds stepper) · `Transition: Once | Cycle` (segmented) · `Variant` (target)**; clearing the action leaves **`Reset…`** (reset-to-base action state); **multiple interaction rows per variant** are allowed.
Delay / Once|Cycle / Reset are absent from the blueprint — and they ARE the "rules for the nodes" Dan explicitly asked for (his Q5). `Cycle` is precisely what our engine's switch-cycle maps to. **Fix:** add to §1.4, B6, and P3's AC.

### F-D3 — MED · P3: wire rendering/visibility rules absent (the exact trap the old NodeLayer fell into)
Two measured behaviors the blueprint doesn't spec:
1. **Wire = STRAIGHT line, arrowhead at the TARGET end**, edge-to-edge, drawn from the interaction-OWNING variant to the target the instant a target is set.
2. **Selection-scoped overlay:** wires, ghost slots (+Variant / state), and the label badge render **only while a variant frame is selected**; deep-selecting a child (dashed selection) or deselecting hides the whole overlay. Escape pops selection up the hierarchy.
Our old wire layer was always-on — cloning that again is exactly the fidelity gap this reset is about. **Fix:** spec both rules in P3 + AC.

### F-D4 — LOW-MED · §2 styling table: "curved wires (Framer's feel)" contradicts BOTH extractions
Mine measured straight edge-to-edge lines; **your own 2026-07-09 extraction wrote "a straight PURPLE line"**. Spec straight, or hand-verify a case where Framer curves (e.g. non-aligned frames) before writing curves into P6.

### F-D5 — LOW · ▶ badge semantics asserted but not settled
Ledger: "▶ badge appears once it has an interaction." Counter-observation from my pass: the badge was present on a freshly created variant with ZERO interactions while it was selected (and disappears on deselect for plain variants). Both observations are real; the rule is richer than the blueprint's one-liner. Hand-verify before any AC references the badge.

### F-D6 — LOW · missing lifecycle details worth one line each
- Create Component opens a **naming dialog** (copy: "Components can be edited in their own canvas. Double-click on any instance…") — B11 should include the dialog step.
- Component **Delete is DISABLED while instances exist** (referential-integrity guard, seen live) — P5 needs the same guard; it's also an engine-op contract.
- Framer's context menus are **searchable command palettes** (type-to-search field at top) — relevant to our menu primitive choice.
- Instance menu also carries **Replace With / Replace All Instances With** (blueprint has detach/replace generically — the two distinct scopes matter).

### F-D7 — LOW · spring parametrization mismatch to note
The generated code's default transition is `{type:"spring", bounce:0.2, duration:0.4, delay:0}` — **bounce/duration parametrization**, while our engine (and the July-9 extraction) speak stiffness/damping/mass. Framer supports both spring forms; the blueprint should record which one we author and the conversion decision.

### F-D8 — enhancement · code-level proof now exists (use it)
I fetched the component's real generated ESM module via Copy Import (saved: scratchpad `framer-buybutton-module.js`): flat variant-ID set + `humanReadableVariantMap` (names are aliases), interactions compiled to per-variant `onTap`-class overrides calling `setVariant(id)`, spring via MotionConfigContext, `addPropertyControls` Enum for the instance variant picker, `withCSS` scoped-class strings, imports from `"framer"`+`"framer-motion"` (proprietary runtime — proves B15/KEEP and our clean-output advantage at code level). Cite it as blueprint evidence; it fixes P2's compile-target semantics exactly.

### Resolved in your favor
My small-zoom observation of "2 corner dots" vs your `resizehandle-*` testids (8 handles + rotation): your DOM evidence is stronger — dropped.

## FIDELITY TO DAN'S ASK (behavior exact, OUR skin)

§2 styling-interpretation table: **PASS with F-D4 folded.** It maps element-by-element to semantics (our accent, Phosphor-light, DS control-states Option B, our surfaces) — no Framer-purple mixed bag. Suggest adding the explicit test: *"semantic parity per element — every Framer affordance (selected-variant label, ghost slot, wire direction, badge) has exactly ONE our-styled equivalent that communicates the same thing."* The LAW section + per-phase designer-verified ACs match Dan's directive as relayed.

## BOTTOM LINE
Fold F-D1..D3 (they change ACs), fix F-D4 wording, flag F-D5/New-Event as pre-build hand-checks, absorb F-D6..D8 — then, from my lane's perspective, the blueprint is a faithful spec of Framer's behavior rendered in our language, and ready for Dan. My independent gap/features report (`s58-framer-gap-report-designer.md`) reaches the same build order you did — that convergence is worth telling Dan.
