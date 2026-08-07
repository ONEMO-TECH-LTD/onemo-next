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

## I2d — the stack laws as stabilized by device rounds 3–6 (locked 2026-08-07, post r6b)

1. **One-session law (Dan critical, 02:04):** in edge mode the auto-cut AND the brush run through
   the ONE brush-worker EdgeSAM session (`ensureEdge` → `redetect`); **the engine worker never
   loads EdgeSAM.** The `?seg=` roster remains the selector law for auto-only models (u2net/
   silueta/harness). Gate: network probe — zero engine-model fetches in edge mode; `segment-edge`
   gesture present, engine `segment` absent.
2. **Warm law (r4 + audit A2):** page open downloads bytes, instantiates NOTHING — no ORT session,
   no OpenCV runtime. Edge: the two weight fetches. u2net: `preloadBen()` (its session-create is
   the engine's own 4MB u2netp — sanctioned). Manual ('none'): nothing, ever. Runtimes initialize
   on first USE behind the tool queue's visible status.
3. **Speed law (the r3 feel, restored structurally):** after the edge cut, session + encode are
   resident by construction (the cut used them) — strokes pay inference only (~0.3s measured).
4. **Fault law (B1):** recoverable timeouts warn + stay retryable; only real worker death flips
   edge-dead, which degrades LOUDLY to a u2net cut with the engine switch mirrored to the URL
   through the shell adapter.
5. **Manual mode:** `?seg=off` ↔ 'none' — no model may ever load; wand/paint are the creators.
6. **Wand v2 vendor law:** OpenCV.js floodFill FIXED_RANGE (13MB wasm, lazy-instantiated on first
   tap, module-owned) — the industrial standard, cited: `@techstark/opencv-js`; `magic-wand-tool`
   and the fillHoles glue are dead, not parked.
7. **Tool queue law (r5):** every tool op through ONE serialized latest-wins queue; no tool is
   gated on busy anywhere; a queued tap says so in the status.
8. **History law (B3):** undo/redo snapshots carry mask + drawn + knob settings + blend — state
   restores whole (value-reflection survives undo).
