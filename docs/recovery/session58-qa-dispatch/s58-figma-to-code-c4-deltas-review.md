# figma-to-code · C4 review — the 3 measured deltas closed (KAI-9344)

**From:** Kai (@s58-expert). **Findings to:** @s58-expert. **Frozen HEAD:** `91a8310`
**Branch:** `session58-task/figma-to-code-converter` · worktree `onemo-ssot-global/.claude/worktrees/s58-figma-to-code/tools/figma-to-code`
**Commits:** `c2eb7f8` (C4.1) · `240afcd` (C4.2) · `c5bc567` (C4.3) · `91a8310` (deslop)

## BOTH audit halves are MANDATORY this round (Dan called out C3's QA for skipping the visual)
1. **Code:** anatomy matrix (`audit/anatomy.mjs`) + gates + mutation battery.
2. **Visual:** MEASURED — `audit/visual-diff.mjs <outDir> <figma.png> <converted.png> --bands "top:0:120,canvas:120:1270,bottom:1270:1742"`.
   Real route runs at `http://localhost:3077/converted/editor-402-iphone-apple-blur-glass` (s58-converted worktree, dev server up). Figma render via `/v1/images` (FIGMA_TOKEN in onemo-next/.env.local). A PASS without measured visual numbers will be bounced by me.

## What changed (verify, don't trust)
- **C4.1 background-origin: border-box** on bordered bg nodes (Figma paints fills across full node bounds; CSS padding-box default shifted the card interior 10px). MEASURED: canvas 11.82% → 6.81%.
- **C4.2 exact gradient ring** on rounded FILLED nodes: layered backgrounds (fills→padding-box over stroke-gradient→border-box, transparent border, per-layer size/position/clip lists). Golden approximations 1→0 (unfilled rounded nodes keep avg + ledger). MEASURED: canvas 6.81% → 4.05%, overall 4.49% (C3 baseline 9.56%).
  **Architecture:** new `bgBorderDecls(node, images, notes)` in emit.mjs is THE single source for every background/border decl — called by BOTH declsFor and reverse geomOf. The check-IR≠convert-IR drift class is closed architecturally for this property family.
- **C4.3 TOKEN VALUE PARITY** conformance section: resolve each numeric var chain, evaluate clamp/rem/cqi at frame width, compare vs Figma raw (gap/width/height/radius/font-size/padding slots); >0.5px → report row. **First result is a retraction:** the suspected dial-gap DS drift does NOT exist (standard-xl @402 = 24.0005 = Figma's 24). +2 locking tests (drifted token → row; matching clamp → none).

## Gate state @ 91a8310
34/34 tests · census/canon/reverse/conformance OK · refusals 0 · **approximations 0** · determinism byte-identical · pristine check exit 0.

## Attack surface suggestions (Codex)
- Mutate the layered card: swap background-clip list order, drop the gradient layer, change border transparent→color — reverse/canon must fail.
- Parity evaluator: feed a token chain with calc()/nested var/vi units — verify no false rows on golden; craft a drifted tokens.css → row appears with correct numbers.
- Re-run your full prior battery (must stay loud).

## Lead asks
- Is bgBorderDecls-as-single-source sound (any emit path still hand-deriving bg/border)?
- Parity evaluator correctness: clamp/rem/cqi math @ frame width; the 0.5px threshold.
- SPEC sync: does §3.5/§4 need the layered-ring + parity sections? (I'll fold your call.)
- Visual: confirm the measured trajectory 9.56 → 4.49 overall with your own run.
