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

## I2d — the stack laws (REWRITTEN 2026-08-07 post-r8; supersedes the post-r7 dual-lazy
## version — both prior versions in git history with their concessions)

**Provenance (two flips, both on device evidence — kept so the reasoning trail survives):**
(1) meta's A1 ("two sessions = crash") was conceded post-r7 — r4 ran dual sessions at steady
state and was device-good. (2) The dual-lazy restoration was then ITSELF refuted on device at
6e9cae2b: the FIRST-STROKE DUAL-INIT (brush session + encode next to the engine's live cut
session) is the standing crash — r4 had dodged it only by initing post-cut. r6b's one-session
routing is exonerated: its device failure was the unpinned webgpu-first runtime, deleted since.
The stable truth is BOTH halves together: one session AND the pinned runtime (meta B-on-pin
verdict, r8 @ 568b52e7).

1. **One-session-on-pin law (r8):** in edge mode the cut AND the strokes run through the brush
   worker's single EdgeSAM session on the pinned runtime — the engine worker never runs EdgeSAM
   and never spawns in edge mode. `?seg` stays the roster SELECTOR (the flow routes execution);
   u2net and manual stay roster-verbatim through the engine chain. Edge failure degrades loudly
   to u2net with the URL following.
2. **Runtime-pin law:** every ORT consumer in the lab uses ben.worker's exact proven recipe —
   pure-WASM build, single thread, `['wasm']` EPs, self-hosted. The webgpu-first probe is DELETED
   (its own comment admitted the webgpu build's CPU fallback wants an artifact we don't ship; iOS
   answered "no backend"). No probing, no fallback chains — one boring proven runtime.
3. **Warm law:** page open downloads bytes, instantiates NOTHING. Edge mode fetches the two
   brush weights only (`preloadBen` would session-create a model the engine worker must never
   run); u2net mode uses the engine's own preload; manual ('none') warms nothing; OpenCV loads
   ONLY on wand-selector press.
4. **Swap-not-stack law (ASYMMETRIC by platform truth):** entering wand DISPOSES the brush worker
   (terminate = real memory back) and instantiates OpenCV; the reverse cannot dispose OpenCV
   (main-thread Emscripten heap, no teardown — resident for page life). Leaving wand re-lazies the
   brush: next stroke reloads, re-encodes, re-seeds — and in edge mode that same path restores
   the CUT session (gate D). If the resident-OpenCV + brush envelope is tight on the oldest
   target, the completion is OpenCV-in-a-worker (disposable) — measured decision, not assumed.
5. **Fault law:** recoverable timeouts warn + stay retryable; real worker death → the corpse is
   DISPOSED AND RESPAWNED EMPTY (arena freed) BEFORE the loud u2net degradation runs — the
   fallback never executes inside a strangled tab.
6. **Manual mode:** `?seg=off` ↔ 'none' — no model ever loads; wand/paint create the shape.
7. **Wand v2 vendor law:** OpenCV.js floodFill FIXED_RANGE (`@techstark/opencv-js`), lazy on
   selector press, module-owned I/O; `magic-wand-tool` + fillHoles dead, not parked.
8. **Tool queue law:** every tool op through ONE serialized latest-wins queue; nothing gated on
   busy; queued taps say so.
9. **History law:** undo/redo snapshots carry mask + drawn + knobs + blend — state restores whole.

Gates (flipped to r8, probe-asserted): edge mode = `segment-edge` marker present, engine
`segment` marker ABSENT, ONLY ONE worker alive (the engine worker never spawns) · no u2netp
fetch in edge mode · no OpenCV fetch at open, chunk exactly on wand press · brush revives after
wand with the cut restored (gate D) · corpse disposal before fallback · suite 402/402 ·
perimeter EMPTY.

## I2e — structure pass (micro-contract, meta audit 2026-08-07 · pure moves, zero behavior change)

**Goal:** every tool Dan named is its own liftable block, so the I6 migration cherry-picks by
folder. This increment MOVES code; it rewrites nothing — behavior byte-identical by gate.

### Target block map (the migration checklist)
```
src/lib/effect, vector-core, outline-core   ENGINE (untouched, lifts as the base)
src/lib/cutout-ai/                          SAM brush add-on            (already clean)
src/lib/cutout-wand/                        Wand add-on                 (already clean)
src/lib/mask-tools/        ← NEW, moved OUT of finish.ts: swathMask · polishMask · unionMasks ·
                             subtractMasks · maskFromShape  (the PAINT tool's math — pure,
                             engine-calling via smoothMask, framework-free)
src/lib/vector-edit/       ← NEW, moved OUT of finish.ts: nodeAdjust · insertNode · deleteNode ·
                             measureNode · editableShape · nodeTapTol · shapeRing · shapePathD
                             (the NODE/FRAME tool's math — pure over engine kernels)
cutout-lab/finish.ts       shrinks to the true flow glue: preseg seam + cache · LAB_CFG ·
                             prepareAI/Native · finishSpec/finishDrawn · bake (mosaic/transform/
                             BakeCancelled) · render helpers (maskOverlay, drawCutout) · defaults
cutout-lab/flow.ts         Layer-2 (unchanged role; imports the two new libs)
cutout-lab/page.tsx        Layer-3 shell (unchanged role)
v5.3.1/dev/PerfHUD         budget law — the I6 lift MUST carry it (or lift it to a lib then)
eruda (?debug=1) + scripts/cutout-lab-verify.mjs   bench-only — EXCLUDED from the lift
```

### The three fixes
1. **S1 split** — the two moves above. Import-only refactor; no function body changes.
2. **S2 wand knob** — `wandTol` becomes FLOW state (like settings/blend); the shell renders it and
   stops importing `WAND_TOLERANCE` (the flow seeds from the module default). Knob semantics
   belong to the bridge; the Figma shell inherits it for free.
3. **Deslop** — delete the `dispW2`/`dispRefW` dead shim (page.tsx ~85–87); fix the stale r3-era
   docstring above `warmup` in flow.ts; fix `overlayRef` initial value to match state (`false`).

### Gates (all must hold — this is a zero-behavior increment)
- Suite 402/402 · typecheck clean · engine perimeter diff EMPTY (the two new libs are NEW dirs).
- Save byte-identity hash unchanged (same image + settings pre/post pass).
- Standing probes re-green: mid-drag 0-compose · wand flat-alloc · no-OpenCV-at-open · lazy brush.
- Import-graph proof: page.tsx runtime lib imports SHRINK (cutout-wand import gone); finish.ts
  line count ≈ halves; the two new libs have zero React/DOM/Next imports (grep).
- Contracts current: this section IS the block map; AUDIT §4 checks against it from now on.

## I2f — ONE BRUSH: the SAM comet brush with a driver switch (Dan ruling CLARIFIED 2026-08-07;
## supersedes the first framing — builds on I2e's moved modules; I2e stays byte-identical)

Authorizing directive (Dan, verbatim): "unify means delete wand brush keep the engine - re-use
brush from sam with wand engine."

### The law
The SAM comet brush IS the one brush — comet ink, Add/Erase, tap-or-drag, base-retain
(add = union, erase = subtract, polish, engine finish, through the one tool queue). It gains a
DRIVER switch:
- **SAM driver** — strokes → prompts → semantic region (today's behavior, unchanged).
- **Wand2 driver** — the same stroke → contrast region (flood from the stroke's samples,
  coalesced ≥ brushPx spacing through the tool queue — never per pointer-move); the tolerance
  knob appears only while this driver is active.
The WAND TOOL MODES DIE — chips, `Tool` union entries, the separate tap path: deleted, not
parked. The paint-deposit tools (draw/draw-erase) are OUTSIDE this ruling and unchanged.
(Paint-as-a-driver was considered and DEFERRED — not in scope.)

### Mechanics
- The driver seam lives in mask-tools (post-I2e): one region-source interface, `ensure/dispose`,
  declared weight class. **Swap-not-stack rides the driver switch** (§I2d.4 asymmetry included):
  wand driver disposes the brush worker + inits OpenCV; sam driver re-lazies the brush on next
  stroke.
- Flow owns driver MEANING + switch policy; shell renders the switch + the conditional tolerance
  knob. Mask tint follows mode (the r7b mask-view fix rides this round).

### Gates
1. Comet trail live under BOTH drivers; Add fills / Erase subtracts identically (ear-gap case per
   driver).
2. Driver swap disposes/revives, probe-asserted r7-style (worker gone on wand; OpenCV only on
   wand; brush revives with re-seed on sam).
3. Wand-driver drag: coalesced floods inside the tool budget (probe numbers recorded).
4. Tool surface shrink verified: wand chips + union entries gone from source (grep), deleted not
   parked.
5. Zero regressions: suite 402/402 · perimeter EMPTY · standing probes green · Save byte-identity
   unchanged same-driver · mask tint = current selection, one color per mode (screenshot).
6. Dan device gate: one brush, two drivers, zero mode confusion.
