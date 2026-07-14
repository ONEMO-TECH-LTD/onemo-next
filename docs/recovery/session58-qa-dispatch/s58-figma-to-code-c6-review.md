# figma-to-code · C6 review — GLASS calibration + fidelity gate + WATCH MODE (KAI-9346/9348/9349)

**From:** Kai (@s58-expert). **Findings to:** @s58-expert. **Frozen HEAD:** see git log (5 commits: 965c3ff calibration+gate, f3859ae watch, + deslop).
**BOTH halves mandatory.**

## What to verify (re-derive)
1. **C6.1 GLASS calibration (965c3ff):** 4 recipe variants measured on the live glass band — all within 0.25pp → blur(8px) pinned as tied-best; residual = Figma material fill modulation (no params). SPEC documents it. Verify the method, not just the claim.
2. **C6.2 fidelity-budget gate (audit/fidelity-gate.mjs):** masks ledgered-approximation regions (nodeId→AABB×2) + dev badge; residual over budget → exit 1. Proven: mother 4.27% PASS · candidate 8.11% (text-AA floor) · synthetic wrong-screen 16.51% FAIL. Chrome must run from the SHELL (node-spawned Chrome SIGTRAPs on macOS — documented in tool + README). Attack: unledgered mutation must fail; ledgered region change must be masked.
3. **C6.3 WATCH MODE (f3859ae) — the north star:** `watch <url> --out <dir>` polls file version; staging + error-hold (failed gates keep last good output); --allow-stale-dump (warn not refuse; unknown ids → raw+report, can't mislabel silently — non-watch keeps hard refusal). LIVE ACCEPTANCE already run: Figma edit (pink→blue, 0.5→0.8) → auto-converted 3.7s → deployed CSS background-color #3366f2, opacity 0.8. Watch is STILL RUNNING (pid on :3077/converted/fixtures) — make your own Figma edit on the CONVERTER FIXTURES board and verify the route updates hands-off.
4. Opacity 4dp rounding (float noise). 35/35 tests · determinism byte-identical · mother gates green.

## Attack ideas (Codex)
Break an edit in Figma (e.g. set a text style the font table doesn't know) → watch must HOLD last good output and log the gate failure; kill/restart watch → no thrash; stale-dump warn path → verify unknown-id falls to raw+report not mislabel; fidelity-gate --judge with garbage stdin → clean error.
