# QA — C8 Audit Console (FULL, re-QA) — @s58-meta-qa

**Frozen HEAD:** `24d3ccd` — `tools/figma-to-code`, branch `session58-task/figma-to-code-converter`. One head, whole console (Dan: build locked scope e2e). Verdict to @s58-expert.

## Your C8.1 F1 (HIGH) — fixed at the class
Audit token resolution flattened tokens.css last-wins, so `[data-theme="dark"]` overrides won → wrong DS-value on the light route. New `src/token-defs.mjs themeScopedTokenDefs` (skips non-active-theme blocks), wired into **conformance + anatomy + audit-export**. Verify: icon color now resolves `--prim-col-grey-11 → oklch(50.25%…)` = the light computed value (was 76.86% dark). Re-check the DS-value column now matches the final-px column's theme.

## Your F2 (dirty target) — resolved
The dirt was the in-progress C8.2–C8.6 build. It's all committed now; `git status` clean at 24d3ccd.

## The console — all modes (open http://localhost:3077/audit-console.html)
- **Inspect** — click element → box + W×H on pixels → panel: Figma anatomy ↔ CSS with token → DS value → final px.
- **Fidelity** — live pixel diff vs Figma, heatmap overlay + per-zone. Self-measured: overall 2.68%, top 1.31 / canvas 1.45 / bottom 6.04, budget 10 PASS.
- **Responsive** — width slider; live invariants (root=viewport / no-overflow / capped-centered) recomputed per width; clone-resize ground truth line (640 4.06 / 900 4.13).
- **Theming** — flip light↔dark button; 11/11 token icons must re-colour (0.5025→0.7686).
- **Structure** — layer tree 1:1 (clickable → Inspect), gates, asset byte-exactness (16 svgs, 2 images byte-exact by sha1==imageRef).
- **Zones** — selector highlights the region box (top/canvas/bottom).

## Both halves mandatory
### Code
1. Product build (no --audit) byte-identical to tag `c7-complete-pre-console-c0beb59` (the token-defs fix is audit-only — emit output must not move). Prove tsx+css.
2. --audit build gates green, 97 data-fc, determinism diff-clean.
3. audit-export: `audit.json` reconciles with conformance.json + convert-run.json; structure.images byteExact=true (sha1==ref); zones = 3 root regions.
4. token-defs: confirm dark overrides no longer win; conformance parity still 0, coverage 76%.
5. `npm test` = 39/39.

### Visual (drive it — Playwright/Chrome)
6. Each mode renders + its numbers are correct: recompute the Fidelity overall independently (should ≈2.7%); flip theme and confirm computed icon color actually changes; drag responsive width and confirm invariants + that a forced break (e.g. inject margin-inline:0) would flip it red; click a tree node → jumps to Inspect with box.
7. DS-value column matches final-px theme (the F1 regression must be gone).

## Known/flagged (not hiding)
- Fidelity uses pre-generated `/audit/fidelity-*.png` (Figma render + build screenshot) — the diff is live in-browser but the source images are captured at deploy, not per-session. Flag if you want them regenerated in-gate.
- `audit.json` + audit route deploy is a manual step (not wired into `convert`).
- Drift/approx flags render (verified with synthetic) but this screen is clean (0/0).

Verdict + findings to @s58-expert.
