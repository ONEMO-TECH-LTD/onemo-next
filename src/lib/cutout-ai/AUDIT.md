# s62 cutout deliverable — rigorous audit checklist

Runnable by any auditor (Kai, lead, Codex) from this worktree (`session62/sam-probe-tool`).
Scope: the WHOLE s62 cutout deliverable — engine perimeter, `src/lib/cutout-ai`,
`src/lib/freeshape`, the `src/app/(dev)/cutout-lab` shell.
Contracts under enforcement: `src/lib/cutout-ai/ARCHITECTURE.md` · `src/lib/freeshape/ARCHITECTURE.md`.

## How this audit must run (non-negotiable)

1. **Read every in-scope file whole.** No sampling. No trusting prior reports or summaries —
   including the builder's. (Seven correction rounds in s62 proved self-certification lies.)
2. **Every verdict carries file:line evidence.** A PASS without a line number fails the audit itself.
3. **Runtime claims are proven on the launched surface** (Vercel preview or device) with the
   artifact cited. Headless tests are necessary, never sufficient.
4. Apply the two killer questions to EVERY function in scope:
   **(a) does the engine already own this capability?** **(b) was this claim observed running?**
   These two catch everything that survived the s62 correction rounds.
5. Builder and closing auditor must be different actors where possible; a single actor records
   two distinct verdicts (QA + Meta) otherwise.

## 1 — Engine perimeter

- [ ] 1.1 `git diff origin/staging -- src/lib/effect 'src/app/(dev)/effect-creator'` — PASS = the
      ONLY engine changes are the recorded exceptions: (a) the `finishMatte` shared
      post-generation tail extracted verbatim from `runRembg` in `ben.worker.ts`, (b) the EdgeSAM
      roster entry in `ben-chain.ts` (+ its runner), (c) the I2c holes exception — additive
      flag-gated multi-ring trace (contour additive variant · prepare-effect cfg flag default OFF
      · keep-largest scoped to outer components), Dan's 2026-08-07 directive, contract
      cutout-lab/ARCHITECTURE.md §I2c. Anything else = FAIL.
- [ ] 1.2 The extraction is verbatim: diff `finishMatte` against the pre-extraction u2net path;
      engine suite green (402/402). Any behavioral delta = FAIL.

## 2 — No owned logic / no approximation / no clones

- [ ] 2.1 For every function in `cutout-ai`, `freeshape`, `cutout-lab`: grep the engine for the same
      capability (mask cleanup, feather/soften, matte-making, padding/dilate, trace,
      simplify/smooth/offset, compositing, flatten, curve-fit, coordinate transforms). Engine owns
      it + folder reimplements it = FAIL with both file:line pairs.
- [ ] 2.2 **Auto-cut path:** the lab's model switch only flips the engine's `?seg=` parameter;
      EdgeSAM's raw output enters `finishMatte` — the engine's own tail, SHARED not cloned.
- [ ] 2.3 **Brush path:** adjudicate `preprocess.ts` `logitsToMask` — it currently CLONES the
      worker's linear matte math (commit 08baaf75) rather than calling a shared function. Dan's law:
      "the pipeline must not be different nor cloned — it must be plugged into." Verify byte-equal
      behavior at minimum; flag the clone for consolidation into the engine tail as a finding.
- [ ] 2.4 u2net path = the bridge's own `runCutout` → `preseg` pass-through, engine config, result
      untouched. Any lab-side config override or matte mutation in between = FAIL.
- [ ] 2.5 Exactly ONE of each: compositing path (`prepareShaped`/`composeEffectArtwork`),
      matte-construction tail, model registry. Grep for a second implementation of any = FAIL.
- [ ] 2.6 No raw sigmoid anywhere in matte math (the ruled-out re-sharpening); soft alpha =
      `samSoftProb` (engine ben-chain: zero-crossing ramp + [1,2,1]² widening), imported by BOTH
      worker bundles — a local re-implementation of the formula = FAIL; threshold AFTER bilinear
      interpolation.

## 3 — No UI-carried logic

- [ ] 3.1 Read `cutout-lab/page.tsx` + `EditorOverlay.tsx` whole: zero pixel loops, geometry math,
      matte math, engine decisions, inline model maps. Allowed: wiring, state, render, deriving the
      display overlay from the mask.
- [ ] 3.2 `finish.ts` / `v531seg.ts` contain seam glue only — no re-implementation of engine steps.
- [ ] 3.3 `history.ts` (HistoryStack) and `ui-config.ts` are pure/data-only AND actually imported —
      not dead copies with logic still inline in the page.

## 4 — Modularity, liftability, hygiene

- [ ] 4.1 One sub = one job = one file; adding a model = one roster entry, nothing else touched.
- [ ] 4.2 `grep -rn "react\|next/\|document\.\|window\." src/lib/cutout-ai src/lib/freeshape`
      — hits only in declared transport/boundary files (worker/client/runtime, capture pointer
      handling). Anything else = FAIL.
- [ ] 4.3 Kill-list stays dead: no SlimSAM / SAM2 / MobileSAM files, registry entries, weights, or
      references anywhere (`git ls-files | grep -i`). Roster = EdgeSAM + u2net (+ engine's own
      silueta fallback) only.
- [ ] 4.4 Every export has a live caller (trace, don't assume). No orphaned loaders, warm-up hooks,
      probe leftovers, parked test scripts in the repo root.

## 5 — Behavior contract (verify by RUNNING each)

- [ ] 5.1 **Blend-off default = no compositing** (commit bfe61417): knob at 0 → compositor never
      called (log/breakpoint proof); output = original image under the vector mask; dark edges and
      double images impossible by construction. Compositing engages only on blend/fill/preset/
      vignette/tint/scale/pan.
- [ ] 5.2 **Offset 0 = truly no offset** (commit ed55d3f0): paddingMM 0 through engine cfg; the cut
      line sits on the trace at zero.
- [ ] 5.3 **Model parity:** same photo through u2net and EdgeSAM → same pipeline treatment, same
      smooth gradient edge class (the 13:23 convergence must still hold on the live build).
- [ ] 5.4 **Brush law:** add-brush a gap on an accepted cut → union, never collapse (the ear-gap
      case); erase subtracts; re-detect only on the explicit action; brush lazy-loads on first
      stroke; ONE AI runtime resident; watchdog → visible u2net fallback on a hung worker.
- [ ] 5.5 **Freeshape gates:** run `src/lib/freeshape/__tests__` — 8/8; open stroke → null;
      fold-guard holds; draw→normalize < 50ms.
- [ ] 5.6 **Vector doctrine:** all knobs zero → byte-identical source trace; knobs value-reflect;
      Detail inverted (0 = full fidelity); defaults all zero.
- [ ] 5.7 **Safari-fragile APIs absent from load/matte paths:** grep `ctx.filter`,
      `createImageBitmap`, `OffscreenCanvas`, `RawImage.read` — a hit on a required path = FAIL
      (silent no-op on the target device).
- [ ] 5.8 **Join chips removed** (Dan's call, commit e2b7d07c): no sharp/round/bevel chips in the
      UI; confirm no dead join-mode plumbing left behind.
- [ ] 5.9 Non-square alignment: padded-square decode maps to image space exactly (the EdgeSAM
      misalignment regression case).

## 6 — Contract docs & repo record

- [ ] 6.1 Both ARCHITECTURE.md files describe the CURRENT tree — verify every clause against code;
      a stale clause is itself a violation.
- [ ] 6.2 Branch `session62/sam-probe-tool` fully pushed; snapshot tag `s62-cutout-lab-audited`
      present; nothing material local-only.
- [ ] 6.3 `onemo-effects-engine/_context/engine-spec.md` contains only locked decisions.

## 7 — Known-open items (confirm ABSENT, never credit as done)

Mobile pinch brush-resize · Bézier handle detachment in node mode · knife gesture ·
comet ghost-pointer confirm UI · golden knob config lock · 48/96mm grid-seat sizing design ·
independent Codex adversarial audit. PASS = the audit report lists them as open AND no half-built
stubs of them exist in the tree.

## Report format

Per section: verdict + file:line evidence per item, most severe first. Close with the two
Necessity-Law lines ("no unnecessary elements" / "shrink: X" AND "delivers in full" /
"partial: X") and the runtime-evidence citations. FAIL on any item blocks "done" until fixed
and re-audited.
