# Code map — every law, and the line that carries it

The daily files say *why* each rule exists. This says *where it lives*, with line numbers read from
the actual trees (not inferred). Two columns because the same law is carried in two places:

- **v1** = `origin/session62/sam-probe-tool` at `050d557e` (tag `s62-cutout-lab-v1`) — read with
  `git show origin/session62/sam-probe-tool:<path>`.
- **v2** = `session62-task/cutout-lab-v2` worktree, current head.

---

## 1 · The engine perimeter (both trees)

| what | file | why it matters |
|---|---|---|
| mask hygiene + the memory cap | `src/lib/effect/mask.ts` — `smoothMask` :185, `postProcessMask` :240 (= `cleanup` + `largestComponent`), `dilateMask` :250, **`MOBILE_TEXTURE_DIM_CAP = 1536` :45 / `effectiveTextureDim` :46** (the F25 mobile-OOM cap) | **The anti-reinvention set.** `postProcessMask` is a 1 px close + keep-largest — it does **NOT** fill interior holes ([08-07 F9](./2026-08-07.md)). |
| the Magic orchestrator | `src/lib/effect/prepare-effect.ts` | `traceContourRaw → dilateMask → smoothMask → rdpClosed → contourFromShape → composeEffectArtwork`. `:169–170` — `const texDim = effectiveTextureDim(); const orig = await loadImageData(url, texDim)` — loads the subject from the **full-res url at `texDim`** — independent of any segmentation cap (the manufacturing-resolution guarantee, [08-07 F15](./2026-08-07.md)). |
| vector outline engine | `src/lib/effect/outline-resolve.ts` | `resolve(source, adjustments)` — simplify/smooth/straighten/radius/curve on Paper.js + Clipper2, fold-guarded, **all-off returns the source byte-identical** ([08-05 D32](./2026-08-05.md)). |
| the 2D compositor | `src/lib/effect/composite.ts` — `composeEffectArtwork` | magic-blend + fill (clamp/tile) + SVG-filter presets. **The s59 operation.** Blur runs as an SVG filter in **linearRGB** because `ctx.filter` is a silent no-op on Safari ([08-06 F3/F4](./2026-08-06.md)). |
| tracer | `src/lib/effect/contour.ts:134–141` — `traceContourRaw` | **largest outer loop only — the outline can carry no holes.** This is why interior erase is invisible and why the laser cutline is always safe ([08-07 E4](./2026-08-07.md)). |
| model roster | `src/lib/effect/ben-chain.ts`, `ben.worker.ts` | `?seg=` selects the model; **no param = the u2netp→silueta trio.** `ben.worker.ts:102–121` is the device-proven recipe: `wasmPaths = ORT_BASE` (:104), **`numThreads = 1` (:107, with the reason inline — threaded WASM spawns nested worker-threads that DEADLOCK inside this Web Worker)**, `executionProviders: ['wasm']` (:121). |
| the bridge | `src/app/(dev)/effect-creator/v5.3.1/flows/flow-contract.ts` · `twoDFirstFlow.ts` · `v53Flow.ts` | **`{state, actions}` — the page binds only to this.** *"A new pipeline is a new compose-function, not a socket rewrite."* ([08-06 F25](./2026-08-06.md)) |
| perf instrument | `src/app/(dev)/effect-creator/v5.3.1/dev/PerfHUD.tsx` | `?perf=1`; 16 ms tick / 50 ms task budgets; `perfGesture(label, ms)` sink. **Import it, never copy it.** |

**The one sanctioned engine-adjacent edit in v2:**
`src/app/(dev)/effect-creator/v5.3.1/core/primitives.ts:74–76` —
`{ ...EFFECT_BUILD_CONFIG, minFeatureMM: detailToFloorMm(100), paddingMM: 0 }`.
Through the function's **existing cfg-override seam**, so the engine's own API carries it.
*Why:* the engine bakes a **1.5 mm `paddingMM`** into the trace that the Offset knob never reported.
Dan, [08-07 20:18](./2026-08-07.md): *"1.5 mm margin must be 0 offset and all controls must be true
representation of the outline."*
The same intent is also recorded as policy data at `src/lib/bridge-compose-policy/index.ts:94` —
`LAB_CFG_POLICY = { paddingMM: 0, detailKnobFullFidelity: 100 }` — so the values live in one place
rather than as a magic number at the call site.

---

## 2 · The laws, and where each one lives

| law | v1 | v2 |
|---|---|---|
| **THE ONE LAW** — every brush shapes the **outline only**; the subject is what's inside it; the blend band is the offset ring alone | `cutout-lab/finish.ts:204` (the ruling quoted in the comment) | `flow-bindings.ts` `usePaintBinding` — strokes produce a mask, never a blend region |
| **blend 0 = NO compositor call** | `finish.ts:85` `BLEND_DEFAULTS` (`blend: 0, fill: 'clamp'`, with Dan's date + reason inline) | `bridge-compose-policy:19` `BLEND_POLICY_DEFAULTS` (`blend: 0`) + `:23` `neutralNoComposite()` — the predicate that decides whether the compositor is called at all — driving `useComposeBinding` (`flow-bindings.ts:174`) |
| **Cadence Law** — compositor **never** mid-drag; single-flight, latch-latest, real cancellation | `flow.ts:32` `BAKE_IDLE_MS = 250`; `finish.ts:269` token checked **between pipeline stages** | `bridge-compose-policy:47` `BAKE_IDLE_MS = 250` + `:49` `class ComposeScheduler` |
| **Display-res while editing, full-res only on Save/Preview** — same bake fn, no second pipeline | `flow.ts:123–145` `displayPrepared` (cache keyed on the prepared ref) + `flow.ts:39` `MAX_DPR = 3`; triggers at `flow.ts:509–524` | the constants are ported (`bridge-compose-policy:86` `MAX_DPR = 3`, `:87` `displayScale`) — v2 composes from the engine op directly, so the second bake path never existed |
| **Auto-composite on frame outgrowth, value-true** (the knob shows the applied blend) | `flow.ts:202` | `bridge-compose-policy:29` `outgrown()` + `bridge-control-surface:31` `autoBlendOnOutgrowth`, gated by `SETTLE_MS = 400` (`flow-bindings.ts:233`) — **the settle gate exists because auto-blend fired on a transient commit shape** ([08-07 F23](./2026-08-07.md)) |
| **No-matte guard** — a full-image composite may not exist anywhere | `finish.ts:291` | inherited (blend-0 default + engine-only compose) |
| **Never-destroy erase, bounded by the gesture** | `flow.ts:41` `MIN_ERASE_KEEP_RATIO = 0.1`; `lib/cutout-grabcut/index.ts:97–107` corridor bound (`CORRIDOR_MULT 2.5`, `CORRIDOR_MIN_PX 24`) | `lib/tool-grabcut/index.ts:27–28` `CORRIDOR_MULT = 2.5` / `CORRIDOR_MIN_PX = 24`, applied at `:88–97`; `:122–124` `MIN_ERASE_KEEP_RATIO = 0.1` + `eraseWouldDestroy()`; called from `flow-bindings.ts:137–146` |
| **Empty-stomach cache** — decode once per upload, never per tap | `finish.ts:164` | `flow-bindings.ts` (cached display pair) |
| **Paint polish uses the ENGINE's own smoothing, radius tied to brush size** | `lib/mask-tools/index.ts:35–37` — `polishMask` calls `smoothMask` at radius `brushPx / polishDiv`; `PAINT_DEFAULTS` :16 (`swathMult 2, polishDiv 3, closeFrac 0.2` — the `?admin=1` panel's three factors) | `lib/tool-paint-math` — the same `smoothMask` call, wired through `lib/bridge-paint-flow` |
| **Node editing: measure the real curve, one adjustment per call** | `lib/vector-edit/index.ts` — `nodeAdjust` :37, `measureNode` :59 (samples the curve either side of the anchor, **not the handles**, which are collinear on a smooth node), `insertNode` :92 (true bezier split), `deleteNode` :128 (min-3 guard), `NODE_KNOB_MAX` :10 | `lib/tool-node-math` — same, **plus** the math extracted out of the shell in the self-audit: `hitAnchor` :145, `moveAnchor` :156 (glued handles), `FRAME_SCALE_LIMITS` :170, `frameScaleFactors` :171, `scaleShape` :182, `shapeBounds` :192, `frameGrips` :204, `hitGrip` :213 |
| **Control-surface data (tabs/chips/ranges), inversion in ONE place** | `cutout-lab/ui-config.ts:9–10` — the chip lists with the removal reasons written inline (straighten + curve dropped from the surface, **engine keeps both**) | `bridge-control-surface:12–13` `VEC_CHIPS`/`BLEND_CHIPS` (same reasons inline), `:15` `CHIP_RANGE`, `:25–26` `detailKnobToEngine`/`detailEngineToKnob` — **the inversion exists exactly once** |
| **Dan's default recipe** — offset 3, the rest 10, detail inverted (0 = full) | `ui-config.ts` ranges + flow defaults | `bridge-control-surface:22` `AUTO_KNOBS = { detail: 10, offset: 3, simplify: 10, smooth: 10, radius: 10 }`, applied once per upload's **first** cut (`flow-bindings.ts:253–264`; detail deferred 120 ms because same-tick commits share a gen record) |
| **The squircle is state, not rendering** — no outline unless the generator is a real traced cut | — (v1 had no bridge auto-prepare) | `page.tsx:83–84` `const traced = !!spec && spec.generator.adapter !== 'standard'` |
| **Fixed viewport** — box never resizes; content contain-fits | v1's canvas was a fixed `disp.w × disp.h` | `bridge-compose-policy:35` `viewBoxFor()` computes the box; `page.tsx:415–417` renders it — `viewBox` grows while the element keeps `aspectRatio: imgW / imgH` + `preserveAspectRatio="xMidYMid meet"` |
| **Status line tells the truth** — a spent warning is not current state | — (the v1 defect) | `page.tsx:45` `clearMsg`, called on every new intent (:164, :333, :343–374) |
| **GrabCut without the 13 MB dependency** | v1 used `@techstark/opencv-js` (13 MB for three functions) | `lib/tool-grabcut-provider/index.ts:184` `slimCv` satisfying the tool's `CvProvider`; solve bounded at `SOLVE_MAX = 256` (:34) with label upsampling (:160–164); `maxflow.ts:16` **`class MaxFlow` = Dinic — terminates by construction** |

---

## 3 · Two constructor traps, verbatim from the code

**`new cv.Mat(rows, cols, TYPE)`** — `tool-grabcut-provider/index.ts:44–45`:
```ts
constructor(rows = 0, cols = 0, _type = CV_8UC1) {
  this.rows = rows; this.cols = cols; this.channels = 1
```
The 3-arg form's third argument is a **type code**, never a channel count. Treating it as channels
allocates a zero-length buffer and every write silently goes nowhere ([08-07 F24](./2026-08-07.md)).

**`ort-wasm-simd-threaded.wasm` being fetched is not threading.** Modern ORT ships **one artifact for
both modes**; with `numThreads=1` it runs single-threaded inside it. Do not read the filename as
evidence ([08-07 D8](./2026-08-07.md)).

---

## 4 · What v1 carries that v2 does **not** — the deliberate omissions

| v1 | status in v2 |
|---|---|
| `finish.ts` `prepareNative` / `finishSpec` / the compose wrapper's mosaic-pad-crop plumbing | **not ported** — the bridge already does it; copying it is `finish.ts` reborn ([08-07 F19](./2026-08-07.md)) |
| `v531seg.ts` `cutSource` + `CUT_MAX` | **not ported** — it was the Mac lag (main-thread decode → downscale → PNG re-encode → worker re-decode, all serial before the cut) |
| the crash breadcrumb (`crashStage`) | **not ported** — a diagnostic for a bug that no longer exists |
| `cutout-ai` (EdgeSAM stack) · `cutout-wand` · `freeshape` | **deleted in the v1 pivot itself**; never re-created |
| the `?seg` URL adapter | **deleted** — and the reader lesson stands: a param is not retired until every reader is gone ([08-07 F14](./2026-08-07.md)) |

---

## 5 · Where to look first, by symptom

| symptom | read |
|---|---|
| a knob shows 0 while the shape is clearly adjusted | [08-05 D32](./2026-08-05.md) value-truth, then `outline-resolve` |
| the outline has a margin at offset 0 | `primitives.ts:74–76` (`paddingMM: 0`) |
| the viewport jumps on offset | `page.tsx:415–417` |
| erase does nothing inside the shape | [08-07 E4](./2026-08-07.md) — it is the tracer's one-ring law, not a bug |
| erase wipes the whole selection | the corridor bound — `cutout-grabcut:97–107` |
| a semi-transparent patch inside the sticker | [08-06 F18](./2026-08-06.md) blur falloff, or [08-07 F10](./2026-08-07.md) `logitsToMask` |
| two images visible / a ghost under pan-scale | [08-06 F12](./2026-08-06.md) — signed logits through a linear normalize |
| a blur or filter does nothing on Safari | `ctx.filter` — [08-06 F4](./2026-08-06.md) |
| a tab dies with "no available backend" | it is **OOM** — [08-07 D8](./2026-08-07.md) |
| a deletion "didn't take" on one device only | the reader is still alive — [08-07 F14](./2026-08-07.md) |
