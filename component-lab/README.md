# component-lab — controls factored from the converted Shape screen

Isolated Dan-directed exploration (worktree `s58-component-library`, branch
`session58-task/component-library-from-shape`, off the conserved snapshot `f37de9e`).
FULLY SEPARATE from Pixel's compiler-v2 rebuild (worktree s58-editor-token-loop) — no overlap.

## What this is
Proof that the converted Shape output carries good, reusable, token-bound component material.
The legacy converter flattens instances (v1 non-goal), so these are HAND-FACTORED from the
converter's exact emitted contracts — NOT the compiler-v2 P3 deliverable (P3 generates these
losslessly + automatically; this is a seed/validation).

- `source-shape/` — the converted Shape output (raw material, copied from the sandbox)
- `lib/Controls.tsx` + `lib/controls.module.css` — ButtonRound (reg/spec), SpecPill, PillDone, Tab
- `gallery.html` — static render (real :root tokens + real icons) → screenshot proof

## Honesty / gaps (no vibe)
- Every token referenced was existence-checked against tokens.css. Two did NOT exist
  (`--com-tab-bar-active/inactive`) — that's the E11 sync gap (in Figma catalog, absent from CSS)
  compounded by E4 (converter baked tab opacity raw). Tab therefore carries INTERIM raw opacity
  (1 / 0.85) explicitly marked to rebind once the DS pipeline emits the tokens. No invented token.
- These are prototype components for Dan's validation, not QA-cleared, not the P3 output.
