# C6 REWORK closure request — @s58-qa

**Frozen HEAD:** `0dfe98f` (worktree `onemo-ssot-global/.claude/worktrees/s58-figma-to-code`, branch `session58-task/figma-to-code-converter`, tools/figma-to-code). Delta commits: `fb76c53` (rework) + `0dfe98f` (deslop).

## Your BLOCKER, closed
> "watch does not enforce the measured-visual fidelity gate before promotion"

`watch --fidelity-route <url> [--budget 10]` now runs the measured gate IN the promotion path, **fail-closed**: over-budget OR unmeasurable (capture/judge crash) → rollback to previous output, `✗ HELD-VISUAL`. bin/figma-to-code.mjs watch block; SPEC §2 updated to match exactly.

**Live acceptance already run (logs verbatim):**
- Rollback proof (budget 0.01): `✗ HELD-VISUAL — residual 9.09% > budget 0.01%; ROLLED BACK to last good output` — route stayed 200 on last good (/tmp/s58-watch-rb4.log)
- Green path (budget 10): `✓ live in 11.5s (all gates green · visual residual 9.09% ≤ 10%)` (/tmp/s58-watch-live.log)
- Watch is RUNNING now (fixtures route, budget 10) — you can live-attack it.

## Two capture-harness bugs found by measurement (both fixed, both architectural)
1. **Headless Chrome min-width 500**: `--window-size=402,871` actually lays out at **500×784** (probe: file:///tmp/s58-vpprobe.html → "VP 500x784"). Any viewport-law screen falsely measured 23.71%; exact-viewport capture (audit/capture.mjs, Playwright on system Chrome) measures the same build at **2.39%** — best mother number ever (prior best 2.66%).
2. **execFileSync deadlock**: watch is blocked synchronously during the judge call, so a watch-hosted gate server can never respond — judge child now serves the gate dir itself (audit/capture.mjs --judge).

Also: fidelity-gate.mjs CLI body is now under a main-module guard — importing it from watch used to execute the CLI against watch's argv and crash the import.

## Root=viewport law completed (Dan directives, same batch)
- Pair `width:100%; height:100dvh` + `container-type: inline-size` now UNCONDITIONAL at depth 0 (HUG/FILL roots emitted no height → reverse false-FAILed ×1 on the fixture board; fixed at the emit law, not the gate).
- **Capped root children center**: direct root children with Figma `max-width` get `width:100%` + `margin-inline:auto` — fill to the cap, center in the viewport, no-op at design width. Flag `centerViewport` derived in **buildIr** (check-IR == convert-IR law). Reverse-guarded: `margin-inline` in GEOM_PROPS + geomOf mirror; canon RANK carries it.
- Live-verified in Chrome at 1645px: all three mother sections w=640, dead-center; at 402: byte-behavior unchanged.

## Fonts
s58-converted app had ZERO @font-face (system-font fallback = the weight drift Dan saw). Wired Chillax-Medium(500)/Satoshi 400/500 into `src/app/(dev)/converted/fonts.css` + layout.tsx + public/fonts/onemo/. capture.mjs waits on document.fonts.ready.

## Numbers at HEAD
- Mother @ exact 402×871 viewport, fonts loaded: **residual 2.39%** (budget 10) — measured via audit/fidelity-gate.mjs
- Fixture board via in-watch gate: 9.09%
- 35/35 tests · determinism byte-identical (fresh convert A/B) · official `check` green on fresh golden · canon 0 · reverse diff 0 ×6 frames

## Suggested attacks
- Re-run my two watch proofs at HEAD (budget 0.01 → must HELD-VISUAL+rollback; budget 10 → must promote with residual logged).
- Kill the route mid-verdict (stop dev server) → must HELD-VISUAL (unmeasured), not promote.
- Verify capture.mjs at 402 actually lays out 402 (probe innerWidth via its own screenshot vs raw Chrome).
- margin-inline/width mutation on a centerViewport child → check reverse must FAIL.
- Confirm SPEC §2/§3.1 claims match code exactly.

Report verdict to me (@s58-expert). Both halves (code battery + measured visual) mandatory per standing rule.
