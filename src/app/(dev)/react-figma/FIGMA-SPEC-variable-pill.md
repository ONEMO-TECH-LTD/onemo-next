# Figma variable-bound field + save UI — extracted spec (E2.5, awaiting Dan approval)

> Extracted from Figma's own panel DOM, node 4084:25999 (padding bound to spacing
> variables), Chrome console — 2026-07-04. Manual conformance per Dan's rule.

## Finding 1 — Figma's variable-bound field is NOT a purple pill (my earlier invention was wrong twice: wrong colour AND wrong form)

DOM of a variable-bound padding field:
```
<div> 88x24 bg:#fff radius:5px
  <label aria="Horizontal padding"> 88x24 bg:#f5f5f5 radius:5px   ← SAME grey chrome as unbound
    <div> 24x24  (property icon, colour rgba(0,0,0,.5))            ← SAME field icon, NOT swapped
    <div> 63x24  tokenizable_input--container
      <div> tokenizable_input--pills → variable_pill--root → variable_pill--text  "16"
```
Key facts:
- Field chrome is **identical to an unbound field**: 88×24, bg `#f5f5f5`, radius 5px, the field's
  own property icon unchanged (NOT replaced with a variable glyph, NOT tinted).
- The bound value sits in a `variable_pill` wrapper whose background is **transparent** for a
  numeric variable — it renders as the plain resolved number (`16`), no coloured box, no purple.
- A **named/colour** variable shows the token NAME inside the pill (wider, subtle tint) — the pill
  grows a visible chip only when it carries a name; numeric bindings show the value.
- A `Detach variable` button appears on hover (the `<button aria="Detac…">` in the wrapper).

So: **Figma marks a bound numeric field with almost nothing visible** — the value is just shown,
the affordance is the variable indicator on hover + in the Apply-variable menu. The strong pill is
a NAMED-token thing.

## The product decision that is YOURS (react-figma context differs from Figma)

In react-figma we ALWAYS know the CSS var name behind a bound value (we read `var(--…)` off the
cascade). Figma hides the numeric token name to save space; we don't have to. Two options:

- **A — Figma-exact:** bound numeric field looks identical to unbound (no visible mark); the token
  name shows only in the Apply-variable menu / on hover. Zero panel noise, matches Figma 1:1.
- **B — token name always visible:** show the resolved token NAME as a subtle grey pill in the
  field (Figma's named-pill form, extended to numerics) — because provenance visibility is a stated
  ONEMO goal ("fully traceable what token is showing"). Deviates from Figma, but serves your
  traceability requirement and is consistent with E2-C.

My recommendation: **B**, with the **named-pill visual copied exactly from Figma** (grey `#f5f5f5`
inner chip, no colour, 11px, the variable ◆ glyph) — so it's Figma's own treatment, just applied to
numerics too. This gives traceability without inventing a look. Needs your call.

## Finding 2 — Save UI
Figma has no "save to code" (cloud-native). This is a react-figma-specific affordance with no Figma
canon to copy — so it must be designed against our context, not extracted. Proposal (for approval):
reuse the neutral Figma toolbar-button visual for a "Save to code · N" button in the panel header
area, dirty count from the Overrides ledger; the current orange box was invented and is off.

## Status
NOT implemented — E2.5 is gated on your approval of (1) option A vs B for the pill, (2) the save-UI
proposal. Everything else in E2 (read/write wiring) is done and does not depend on this.
