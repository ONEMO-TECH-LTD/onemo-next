# cutout-lab — flow-bridge contract (I1 · KAI-10196 · authored by s62-meta, 2026-08-06)

The execution contract for the Layer-2 rebuild. Code is MATCHED against this file — a line of code
that violates a line here is slop by definition and gets deleted, not defended. QA of the I1 delta
is a clause-by-clause match. Enforcement: `src/lib/cutout-ai/AUDIT.md` (which gains §8 Performance
in I3); companion module contract: `src/lib/cutout-ai/ARCHITECTURE.md`.

## Why this exists (the root cause being cured)

The lab consumed v5.3.1 as a function library (Layer-1) and re-invented orchestration policy
inline in the shell — compose-per-knob-tick, uncancelled, unbudgeted. Measured cost: a 10-step
Detail drag allocated **1.56 GB** (dozens of 61 MB mirror-mosaic canvases) → the iPhone tab dies
mid-gesture, model-independent. The engine's own Phase-5 architecture already solved this:
policy lives in a FLOW compose-function behind a `{state, actions}` seam; the original studio's
edit loop composites nothing. The lab gets the same shape.

## The three layers — hard boundaries

1. **Layer-1 — v5.3.1 engine (UNTOUCHED).** `lib/effect`, `vector-core`, `outline-core`, the
   v5.3.1 primitives/producers. No edits in I1. The flow COMPOSES these; it never re-implements
   any capability they own (the two killer questions apply to every function: does the engine own
   this? was this observed running?).
2. **Layer-2 — `cutoutLabFlow` (NEW — this increment).** One compose-function conforming to the
   flow-contract PATTERN (`flows/flow-contract.ts` is the reference; conform, don't import it
   wholesale — it is typed against v5.3.1's DesignState/sceneStore). Returns `{state, actions}`.
   OWNS ALL POLICY — the complete list, nothing stays in the shell:
   - compose cadence (the Cadence Law below) + bake sequencing, coalescing, cancellation
   - the auto-blend-on-outgrowth rule (value-true: sets the knob state, never a silent override)
   - undo/redo/clear history semantics (HistoryStack stays a pure module; the flow drives it)
   - engine selection STATE + segmentation calls (bridge `runCutout`/preseg). The `?seg=` URL
     read/write stays a SHELL adapter duty (the flow never touches location — CreatorAdapters
     precedent: `segPresent` is injected); the flow owns what the selection MEANS.
   - fault policy: the brush watchdog fault → edge-dead state → u2net-only degradation (the
     `edgeFault` path) — a flow state, not a shell decision
   - tool actions: AI brush strokes, wand fill/erase, paint add/erase, node/frame edit commits —
     all enter as flow ACTIONS; their orchestration (accept → prepare → finish → bake) is flow code
   - PerfHUD gesture marking (`perfGesture`) on every bake/resolve/segment
3. **Layer-3 — the shell (`page.tsx` + `EditorOverlay`) — NEUTRAL + SWAPPABLE.** Binds ONLY to
   `{state, actions}`. Render, gesture capture, coordinate mapping, ink/comet drawing, CSS, URL
   adapter duties (read/write `?seg=`, `?perf=` — values passed to the flow, never read inside it).
   ZERO policy: no compose calls, no cadence decisions, no RUNTIME engine imports (type-only
   imports are permitted — types are not behavior), no default-value decisions.
   Test: the Figma shell (I5) must be mountable on the same flow with no flow changes.

## The Cadence Law (the crash fix, stated as architecture)

- **During a drag, the compositor is NEVER called.** Knob ticks re-resolve vectors only
  (`resolveTraceOutline` path). The live view during a drag shows the last committed bake clipped
  to the updating outline — never a fresh compose per tick.
- **Compose is SINGLE-FLIGHT and LATCHED**: at most one bake in flight, ever; requests during a
  bake coalesce to the latest settings; a superseded in-flight bake is COOPERATIVELY cancelled —
  a cancellation token checked between pipeline stages (transform → mosaic → compose → flip →
  clip → crop), stages after the check skipped, canvas references dropped so memory frees. (True
  mid-draw abort does not exist in the platform — do not attempt it, do not claim it.) Trigger:
  knob release / idle (~250ms), upload-accept, tool-commit, Save, Preview. Reference
  implementation: `twoDFirstFlow`'s first-blur watcher (latched, in-flight-guarded, stale-guarded,
  reset-on-failure).
- **Mid-drag visual (design decision, Dan-vetoable on device):** during a drag the view shows the
  LAST COMMITTED bake clipped to the live-updating outline; the bake catches up on release. The
  transient clip mismatch at the edge is accepted; if Dan rules otherwise after feeling it, the
  fallback is raw-image-under-outline mid-drag — a flow-internal change, no shell impact.
- **Blend-0 short-circuit stands**: neutral settings inside the frame = original under the vector
  mask, compositor not invoked at all (existing law, re-verified in I1).

## Performance budgets (PerfHUD-enforced, `?perf=1`)

- Editor tick ≤ **16 ms** · no main-thread task > **50 ms** per interaction tick (the engine's own
  §9 budgets). **PerfHUD is IMPORTED from `v5.3.1/dev/PerfHUD` and mounted — never copied** (the
  lab already imports v5.3.1 app modules: producers, primitives; a copied HUD would be the exact
  clone class this contract forbids).
- **I1's gate is MID-DRAG**: pointerdown→last tick allocates ≤ **0.1 GB** with **zero** mosaic-class
  canvases and the compositor provably never called; exactly ONE release bake follows, at full res —
  its cost is RECORDED in the task, not gated in I1. (Adjudicated on the lead's guard-1 question,
  2026-08-06: the earlier "≤0.2 GB total" contradicted "preview-res is I2 — don't build early";
  mosaic-crop is also I2 scope, KAI-10197. The crash driver was dozens of uncancelled mosaics per
  drag, not one release bake.) **I2's gate** then lowers the edit-time ceiling to ~4 MB via
  preview-res compose + mosaic crop.
- Every bake/resolve/segment emits a `perfGesture(label, ms)` marker.

## Conform vs never-clone

- **Conform to**: the flow-contract pattern (`{state, actions}`, adapters injected — notify,
  URL params read by the shell and passed in; the flow never touches `window`/DOM except via its
  canvas inputs), the engine's preseg/bridge seams, the existing pure modules (HistoryStack,
  ui-config, cutout-ai subs, cutout-wand).
- **Never clone**: any engine formula or pipeline step (matte math, mask hygiene, trace, outline
  ops, compositing — all engine calls); the flow-contract file itself (pattern, not import); any
  constant that exists in the engine (import it — `SAM_AREA`, `SAM_CENTRAL_PROMPT`, `samSoftProb`
  precedents).
- **finish.ts** survives as the flow's internal glue (engine composition only); anything in it that
  decides WHEN moves into the flow. **page.tsx** sheds `recomposeLive`, bake sequencing, blend
  policy, engine selection wiring — all into the flow.

## Verification gates (I1's Done, all with evidence)

1. Shell purity: grep + whole-read of `page.tsx`/`EditorOverlay` — zero compose/cadence/policy.
2. Probe: 10-step Detail drag at defaults ≤ 0.2 GB, zero 61 MB canvases, max one bake in flight —
   numbers pasted into KAI-10196.
3. PerfHUD live; drag ticks within budget on desktop.
4. Regressions on the launched bench: ear-gap union · blend-0 no-compositor · offset-0 · u2net/
   EdgeSAM parity · undo/redo/clear · Save output unchanged (hash vs pre-I1, same inputs/settings).
5. Engine suite 402/402 · typecheck clean · `git diff` on the v5.3.1 perimeter empty.
6. On-device (Dan): Detail drag on iPhone — no crash. The defining test; nothing is Done before it.

## I2 — edit-time memory floor (KAI-10197 · contract added post-I1, grounded in the code @ 9b98dc45)

The live editing bake composes at DISPLAY resolution; full resolution exists only on Save and 👁
Preview. The mirror mosaic allocates O(composed region), never 9× texture area.

**The design the code dictates (read, not assumed):**
- `bakeStickerEngine`'s scale factor is `k = origCanvas.width / maskW` — it already composes
  correctly at ANY input scale, and `blendPercentToPixels(pct, sourceWidth) = pct·width/2500`
  scales the blur with source width, so a downscaled compose is visually proportional BY
  CONSTRUCTION. Therefore: **the bake function does not change for preview-res.** The FLOW builds
  a display-res `frontSrc` pair (orig + subj downscaled to the display width, built ONCE per
  prepare, cached on the prepared ref) and passes it to the SAME `bakeStickerEngine`. No second
  bake pipeline, no resolution parameter threaded through the engine.
- **Preview becomes a full-res compose trigger**: the page's preview branch draws `liveBakeRef`
  verbatim (read at head), so after I2 it would show the low-res bake. Entering 👁 Preview (and
  Save — already full-res) requests a FULL-RES bake through the same single-flight scheduler;
  the display-res bake may show as the interim until it lands. Exiting preview returns to the
  display-res live bake. All of this is FLOW policy (cadence law applies unchanged).
- **Mosaic crop** (mirror fill only — clamp default composes no mosaic): the composed region is
  `outputBoundsPx + pad` (read from the compose call); the mosaic source must be materialized
  only over that region (the per-axis flip pattern drawn into a region-sized canvas), never as
  the full 3w×3h canvas. Implementation is the builder's; the GATES are: allocation O(region),
  and the composed output pixel-identical (hash) to the full-mosaic compose for the same inputs.

**Laws carried unchanged:** compositor never called mid-drag · single-flight + cooperative
cancellation (the display-res and full-res bakes share the one scheduler and the one gen token —
never two bakes in flight) · blend-0 short-circuit · engine perimeter untouched · shell untouched
except, if needed, a preview-enter/exit action binding (no policy in the shell).

**I2 verification gates (all with evidence):**
1. Biggest single canvas allocated DURING EDITING ≤ ~4 MB (probe, drag + blend tweaks at defaults
   and at fill=mirror).
2. Save output byte-identical (hash) to pre-I2 Save for the same image + settings; Preview's
   landed full-res bake likewise.
3. Mirror-region hash gate: cropped-mosaic compose ≡ full-mosaic compose (same inputs).
4. Mid-drag stays 0-compose (I1's gate re-run, unchanged).
5. Suite 402/402 · tsc clean · perimeter diff empty · probe numbers pasted into KAI-10197.
6. On-device (Dan): blend-100 + mirror drag on iPhone — smooth, no crash.

## I2b — tool-loop responsiveness (Dan's device findings 2026-08-06 · blocks I3)

Grounded defects (code-cited, not assumed): the comet fade loop exits on pointer-up
(`cometLoop` gated on `paintingRef`) so the trail freezes for the whole recognition wait;
`polishMask`/`swathMask`/`wandRegion`/`maskFromShape`/`buildPreseg` run full-res pixel work ON THE
MAIN THREAD (>50 ms tasks — the contract's own budget law, unenforced during tool use); `prepareAI`
chain has NO timeout (a hang leaves `busy` stuck → all tools dead until reload); `buildPreseg`
re-decodes the image and allocates fresh texture-res canvases EVERY tap (nothing reused — the
"full stomach").

Laws:
1. **The comet is real-time, always.** The fade loop runs until the trail is empty, independent
   of recognition; recognition progress may not stop presentation frames. Gate: trail visibly
   dissolving WHILE a recognition is in flight (screen-capture evidence).
2. **No main-thread pixel op > 50 ms during tool use — scoped to the GLUE.** Post-processing the
   lab owns (polish/swath/wand/mask raster) moves off the main thread or is chunked under budget;
   PerfHUD gestures mark each. **Engine-internal awaited spans (matteToMLResult, prepareEffect
   trace stages) are RECORDED as the engine's own cost, not chunked and not worker-moved** — the
   perimeter law outranks the budget here, and the original studio's HUD treats its own one-time
   generation breach the same way (the I1 precedent). They are once-per-tap awaited spans, not
   per-frame work. (Adjudicated on the lead's guard-1 question, 2026-08-06.) Moving engine prepare
   into a worker is a possible LATER increment, opened only on Dan's device verdict — if the
   residual once-per-tap hitch (~2× 53–117 ms) still reads as a freeze on the phone.
3. **Every await in a tool path carries a timeout → fault status** (the I1 fault-policy pattern):
   a hang becomes a visible ⚠️ + `busy` released — a stuck-busy lockout is impossible by
   construction. Gate: injected stall → tool recovers without reload.
4. **Empty-stomach rule:** per-tap allocations are reused or released — the decoded image and
   texture-res scratch canvases are cached per upload (invalidated on new upload), not rebuilt per
   tap. Gate: 10 consecutive wand taps → allocation curve flat after tap 1 (probe numbers), no
   degradation through ≥10 iterations incl. after Clear.
5. Engine perimeter untouched · flow owns the policy · shell renders. Unchanged.

Fallback recorded (Dan's, only if optimization genuinely hits a wall — not first resort):
blend 0 default + clamp-only surface.

## I2c — holes support: true transparency for erase (Dan's directive 2026-08-07 · authorizes the
## engine-perimeter exception below)

Authorizing directive (Dan, verbatim): "wand is not working on removing objects — it actually does
holes that auto-filled with blur; without blur they would be holes — I need fully photoshop level
working wand tool or fill bucket." This supersedes the tracer's earlier "Holes dropped (solid
effect, per Dan)" ruling (contour.ts header) — both cited so provenance is unambiguous.

**The defect, code-cited:** erase punches the hole in the MASK correctly; `traceContourRaw`
(contour.ts:141) stitches ALL loops then keeps only the largest; `prepare-effect` hardcodes
`holes: 0`; every clip is single-ring — so the hole region backfills (blur at blend>0, original
at blend 0) instead of going transparent.

**What the code already provides (read, not assumed):** marching-squares emits the hole loops
today (they're discarded at the last step); `VShape.paths[]` is multi-path native;
`shapeToSVGPathD` emits multi-subpath `d`; the page scrim already fills `'evenodd'`;
outline-core's ring types already model `role:'hole'` (AMEND-C3). This increment CONNECTS
existing capability; it does not invent a geometry system.

### The sanctioned engine exception (third entry in the AUDIT §1.1 register)
Additive + flag-gated only — v5.3.1 behavior byte-identical with the flag off (suite stays 402):
1. **contour.ts** — an ADDITIVE trace variant returning outer + hole loops, winding-normalized
   (outer CCW, holes CW), with a min-area floor so mask speckle never becomes pinholes. The
   existing `traceContourRaw` is untouched.
2. **prepare-effect** — a cfg flag (default OFF; the lab turns it on via its existing `LAB_CFG`
   seam): when on, the spec's `vectorShape` carries the hole paths and `diagnostics.holes` reports
   the real count. No other output changes.
3. **mask.ts keep-largest — LAW AMENDED, not removed:** keep-largest applies to OUTER components
   (disconnected islands still drop, still announced loudly per §I2b); the winner's ENCLOSED holes
   are kept. A hole is not an island.

### Behavior laws
- **Erase = transparency everywhere:** live view, 👁 Preview, and Save PNG show alpha-0 inside
  holes; the blur-backfill is impossible by construction because every clip seam (bake clip,
  drawCutout, scrim) fills/clips `'evenodd'` on the multi-subpath `d`. At blend>0 the band exists
  OUTSIDE the outer ring only — never inside a hole.
- **Knob semantics on holes (defined, not implied):** detail/simplify/smooth/radius/curve apply
  PER RING with the same fold-guard; a hole additionally must stay inside its outer ring and
  vanishes (legitimately) if it collapses. **Offset is physical-material semantics:** positive
  offset grows the outer ring AND shrinks holes by the same margin (Clipper multi-ring inflate
  with correct windings does this natively); holes smaller than the offset are consumed — that is
  correct sticker physics, stated so nobody "fixes" it.
- **Matte/subject alpha:** already mask-driven and hole-correct — no change; the outline layer was
  the only backfiller.
- **Out of scope, flagged for the record:** manufacturing mm-spec/cutline export of inner rings
  (the engine-spec gains an open item — holes = inner cutlines — decided at productization, not
  here); multi-island shapes (separate product call already flagged to Dan, unchanged).

### Gates
1. Flag OFF: engine suite 402/402 AND the lab's Save byte-identity hash unchanged — proof the
   exception is invisible until opted into.
2. Flag ON: wand/paint erase inside the shape → Save PNG sampled alpha=0 in the hole; blend 100 →
   hole still alpha-0 (backfill dead); blend 0 → same.
3. Knob gates: offset grows outer + shrinks hole symmetrically (measured); smooth/radius on a
   holed shape stay fold-guarded per ring; hole-collapse removes the ring without artifacts.
4. Perf: trace with holes stays in the engine-span budget class (recorded, not chunked — §I2b
   adjudication applies).
5. On-device (Dan): the Photoshop test — wand-erase a region inside the object → a real see-through
   hole, tunable, savable. His pass closes the increment.
