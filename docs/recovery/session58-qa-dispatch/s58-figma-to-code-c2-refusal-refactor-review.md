# figma-to-code · C2 review — kill structural refusals (100% structure/geometry conversion)

**From:** Kai (@s58-expert). **Report findings to:** @s58-expert. **Do not** loop in the designer.
**Branch:** `session58-task/figma-to-code-converter`
**Worktree:** `/Users/daniilsolopov/Dev/onemo-dev/onemo-ssot-global/.claude/worktrees/s58-figma-to-code`
**Tool dir:** `tools/figma-to-code`
**Commits under review:** `a5c867b` (refactor) + `b40e48f` (deslop + SPEC/canon sync). Base = `64071a4` (C1, already ×2 QA-cleared).

## Why this change (Dan's directive, 2026-07-04)
Dan rejected "refuse rather than guess" for structure: **"100% figma clean, 100% reproduction in
code. Period… the list of layers can surely be matched?"** The model:
- **Structure and geometry ALWAYS convert.** Layer tree = DOM tree 1:1. Auto-layout → flexbox;
  no auto-layout → `position:absolute` from real Figma coords; rotation → `transform: rotate(-deg)`.
- **Two modes** (with/without canon): every design converts fully. **Canon is a GRADE** (token-bound,
  flexbox vs absolute, semantic tags) scored in the report, **never a gate**.
- **Refusals demote to PROPERTY-level only** — the genuine unmappables with no faithful CSS
  (GLASS effect, GRADIENT_DIAMOND, CENTER/gradient stroke on non-vector, complex mask, unknown font
  style). The element still emits; only that property is reported.

## What changed
1. `src/ir.mjs build()`: removed `no-autolayout` / `rotated-container` / `negative-gap` structural
   refusals. New `build(node, parent, parentFlex)` + `offsetIn(parent,node)`; adds `absolute`
   (child offset from Figma coords when parent has no flex OR layoutPositioning:ABSOLUTE), `rotation`,
   `hasAbsoluteChild`. `refuse()` is now property-only (no `box`/placeholder).
2. `src/emit.mjs`: rotation → `transform` (visual rank); svg nodes carry absolute+rotation; gap guard
   `>0`. **Fix:** `position:relative` suppressed when the node is itself `absolute` (nested
   no-autolayout frames would otherwise emit duplicate `position` → canon R7). Removed placeholder branch.
3. `census/walk.mjs`: independent walker matches — no refusal-stops; removed unused helpers.
4. `src/canon-check.mjs`: property-order law now covers `transform` (rank 2 / visual).
5. `src/reverse.mjs`: removed placeholder projection both sides (provably unreachable).
6. Docs synced: SPEC §3.3 rewritten, §3.5 negative-gap/rotated, §4/§4b/AC7 placeholder refs;
   CODE-CANON rule 8 = `absoluteCount` budget; **NEW `FIGMA-CANON.md`** (input authoring contract).
7. Tests rewritten to the new intent (27/27).

## Evidence I already have (please re-derive, don't trust)
- `node --test test/*.test.mjs` → 27/27.
- Golden frame `4084-25997` `convert --offline --tokens-css …/onemo-next/src/app/tokens/tokens.css`:
  census OK · canon 0 · reverse diff 0 · conformance coverage 77% unresolved 0 · **determinism byte-identical**.
  55 elements, 4 absolute, 4 rotated, **0 structural refusals**, 1 property refusal (non-solid-stroke).
- **Token parity cross-check: MISSED (bound-in-Figma-but-emitted-raw) = 0** across 34 raws (28 genuine
  unbound design values, 6 font-weight which derive from style name — never a bound var).
- **Generality proof:** a DIFFERENT screen, node `518:5279` "Look aim" (402×874, 70 elements), converts
  with **zero code change** → census OK · canon 0 · reverse diff 0. Conformance FAIL is correct: the
  screen is 1% token-bound (WIP) AND the resolution gate caught 1 unresolved token
  `--branding-col-ice-ice-blue-1` — verified NOT a converter bug: Figma var "ICE/Ice Blue/1" in the
  `.0-Branding-Col` collection (600 vars) exists, but the app tokens.css defines ZERO branding-col
  tokens. Real DS gap, mechanically surfaced.

## Review asks
**@s58-lead (meta):** (1) Is the no-refuse model faithfully implemented — does every visible layer
become exactly one element with correct geometry? (2) SPEC == code: any doc still claiming a
structural refusal the code no longer does, or vice-versa? (3) Is the deslop safe — did removing the
placeholder machinery drop any real behavior (esp. the reverse gate)? (4) Can any AC pass while the
product intent ("100% faithful, both modes") fails?
**@s58-meta-qa (adversarial):** run the mutation battery on the official `check` command against the
golden output, PLUS attack the NEW paths: (a) reorder/duplicate the `position/left/top`/`transform`
declarations → canon must fail loudly; (b) hand-mutate a no-autolayout child's `left`/`top` → reverse
round-trip must catch it; (c) drop an absolute child → census must fail; (d) confirm determinism
(double-convert byte-compare) and that `absoluteCount` in the run record == the CSS `position:absolute`
count. Try to make a structural-slop artifact pass all gates.

Findings → me (@s58-expert). I fold + re-route until clean, then it goes to Dan.

---
## REWORK FOLDED → frozen HEAD `23ba592` (re-audit here; worktree is now clean)

All three findings fixed, each proven with the reviewer's own attack:

- **F1 (lead HIGH) — check varMap:** `check` now `loadVariableMap` + passes to `buildIr` (mirrors
  convert, honors `--no-vars`). `bin/figma-to-code.mjs:142-148`. Proof: `check` on pristine golden →
  `reverse round-trip: OK (diff 0)`, exit 0 (was FAIL ×1 span/h4).
- **F2 (lead MED) — reverse geometry diff:** `src/reverse.mjs` re-derives resolved geometry
  (position/left/top/width/height/transform, mirroring emit) and diffs it vs the CSS both directions
  (`geomOf` + the `cssGeom` walk). Proof: golden diff 0; `left 0→90` → `reverse FAIL [.bg geometry
  left ir="0" css="90"]`; `rotate -12→-42` → `geometry transform` FAIL. Unit test in c13.
- **meta-qa HIGH — unstyled wrapper:** `canon-check.mjs` rule 2b requires EVERY JSX element open-tag
  to carry `className={styles.x}` (emitter never emits a classless element). Proof: injecting `<div>`
  around `.fillShadow` → `canon: FAIL ×1 [rule 2 … unstyled/slop wrapper]` (and reverse ×10). Unit test in c13.

Gate state at 23ba592: 29/29 tests · census/canon/reverse/conformance OK on golden · determinism
byte-identical. Mutation battery all fail loudly: unstyled wrapper, styled slop, property reorder,
duplicate, drop-child, drop-map-entry, left/top/transform geometry. Findings → @s58-expert.
