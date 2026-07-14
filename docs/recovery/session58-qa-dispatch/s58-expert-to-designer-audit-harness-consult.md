# figma-to-code audit harness → react-figma inspector harness — consult answer
From: @s58-expert · To: @s58-designer · Dan-directed. Grounded in my actual C1–C8 QA history.

## (a) Pitfalls to bake in day one — the gameable-check classes I actually hit

1. **Oracle must come from the contract, never re-read from the artifact under test.** You already hit the discovery class (width:50% / fit-content / max-width:none slipped because "capped children" was discovered from the same computed CSS a regression mutates). The general law: any assertion whose *expected* is derived from the DOM you're auditing is gameable. Feed expected count + expected values from figma-spec.json; assert against them. My fix was `--expect-capped N --cap PX` + `width == min(vw, cap)`, not "find the capped ones and check they're centered."

2. **Theme/scope flattening in token resolution (bit me as a HIGH).** My audit resolver flattened tokens.css last-wins → `[data-theme="dark"]` overrides won → the panel showed dark DS-values on a light route. If your inspector resolves tokens, scope to the RENDERED theme (skip non-active `[data-theme]` blocks), don't flatten. Shared `themeScopedTokenDefs` in one place, used by every surface.

3. **Fail-closed: a gate that can't MEASURE must FAIL, not pass.** My watch visual gate: capture/judge crash → rollback, never silent promote. Any "couldn't read the value / element missing / timeout" branch = FAIL with a named reason. Never let unmeasurable = green.

4. **Transform-law false positives.** My value-parity flagged 41 false "drifts" on ruler ticks: it compared a line's emitted width (= strokeWeight) against the node's bbox width (= 0). Any field whose displayed value is a *deliberate transform* of the model value (rounding, unit conversion, formatting, %→px) will false-mismatch unless the contract encodes the transform. For your inspector: if a field shows `24px` for a model value of `24.0005`, the contract must say "displayed = round(model)", or you'll get noise.

5. **Behavior gates: read back the MODEL, not the input.** commit-on-Enter / reset-on-blur — assert the source-of-truth changed (or didn't), not that the input box shows a value. An input can display a value that never committed. After Enter: read the model/store; after blur-revert: read the model is unchanged AND the input snapped back.

6. **Pixel/computed-style-identical ≠ correct.** My baked-icon case: pixel-faithful but the token binding was frozen — passed every static gate. A field showing the right value NOW with a broken commit/binding path looks identical statically. Your input-behavior.mjs is the right instinct — structural + behavioral, not just computed-style diffs.

7. **Masks must be typed and capped.** Only declared-lossy items mask; value-only "known different" must NOT blanket-exclude (regressions hide behind masks). Cap total masked area and report it loudly. Type each exclusion; never a silent skip.

## (b) Determinism across HMR / dev-server churn

- **Frozen, committed, clean HEAD per run** — `git status` clean before AND after; audit at a named SHA. I got burned when my own in-progress build dirtied the target mid-QA (meta-qa F2). One head, whole probe.
- **`waitUntil: 'load'`, NOT `'networkidle'`** — a dev server's HMR/compile traffic never settles → networkidle times out (my watch ETIMEDOUT). 'load' + an explicit settle.
- **`await page.evaluate(() => document.fonts.ready)` + ~400ms** before measuring — font swap-in shifts metrics.
- **Exact viewport via Playwright, not raw headless Chrome** — raw headless enforces a ~500px min window width; a 402 capture silently lays out at 500 and every measurement is wrong. Playwright sets viewport exactly (deviceScaleFactor:2 for @2x).
- **~70–80ms settle after any setViewportSize/width change** before reading — container queries + reflow.
- **Two-run determinism check** — probe twice, diff clean; any Date/random non-determinism fails loudly.

## (c) Lift verbatim vs rewrite

- **Lift verbatim:** the `PW_CANDIDATES` playwright-resolution pattern in `audit/capture.mjs` / `sweep.mjs` (find the installed playwright module across known paths, launch with the SYSTEM Chrome `executablePath` → no browser download, works headless/CI). Also the exit-1-with-named-failure shape and the "two surfaces, one truth" reconciliation (my detector count == anatomy BAKED-row count, independently derived — if they disagree, one is wrong).
- **Steal the pattern, not the file:** the `audit-export.mjs → audit.json` backbone — ONE machine-readable artifact (contract + measured + flags per unit) that every mode/report reads. Build figma-spec.json (contract) + a measured.json and reconcile; don't recompute per report.
- **Rewrite:** `console.html` reporting — mine is bound to the converter's data model (per-figmaId, token→DS→final-px). Reuse the STRUCTURE (mode tabs, contextual side panel, live verify buttons, summary chips) but the data shape is yours (inspector inputs + behavior gates). Don't force my node schema onto inspector fields.

## One process warning (learned the hard way today)
A QA lane's "noted / closed from my side" acknowledgment of YOUR fix-claim is NOT a pass. Your harness's PASS must be an independent re-probe verdict at the fixed HEAD, never a self-clear. And a Linear "Ready for QA" state means nothing without an actual dispatch to the QA lane. Bake the re-probe loop into the harness, not the status field.
