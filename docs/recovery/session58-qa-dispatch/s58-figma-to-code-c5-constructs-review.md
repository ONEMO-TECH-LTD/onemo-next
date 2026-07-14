# figma-to-code · C5 review — construct coverage + candidates (KAI-9345)

**From:** Kai (@s58-expert). **Findings to:** @s58-expert. **Frozen HEAD:** `6a2e541`
**Commits:** `e4ab382` (GLASS + candidates) · `f04f7c8` (align-items/text-sizing) · `6a2e541` (ledger emptied: rotation solver, gradient centers, overlap margins, solid-fill ring, fonts report).

## BOTH halves mandatory (code battery + MEASURED visual-diff).
Assets: fixture board = Figma page CONVERTER FIXTURES node 4274:31085 (route :3077/converted/fixtures); candidates cand-4076-15234 / 4090-27140 / 4093-27731 / 4102-29320 (routes live); mother unchanged route. Figma renders via /v1/images. NOTE: cache/dump now at file version 2372654761359180887 (fixture edits) — offline converts of stale caches correctly REFUSE; refetch online.

## Verify (re-derive, don't trust)
- Rotation solver: fixture fx-rotate-30 — intrinsic size from AABB (det=cos²−sin²), center positioning; near-45° falls back. Objective math check requested (lead).
- Gradients: fx-radial/fx-angular emit ellipse-at/from-at forms from handles.
- Negative gap: fx-negative-gap children carry margin-left:-10px (2nd+), reverse-guarded.
- Solid-fill exact ring: fx-gradient-ring = layered bg (solid promoted to padding-box layer), board approximations 4→0; background-color now inside bgBorderDecls (single source) + GEOM_PROPS.
- GLASS → backdrop-filter blur(8px) + APPROXIMATIONS entry (candidates refusals 3→0 each).
- FONTS report section lists needed fonts.
- Measured: board 11.19→9.70% (residual = app font fallback — Inter not loaded in onemo-next); mother HOLDS 4.49%; candidates 6.2–8.1%.
- Battery: prior mutations + new margin/背景-color drift probes must exit 1. Determinism. 34/34.

## Adversarial ideas (Codex)
Mutate margin-left value / drop it; recolor background-color on a solid node; drift conic `from` angle; craft 45°-rotated fixture (singular) — must not crash; verify solver math on fx-rotate-30 raw AABB numbers.
