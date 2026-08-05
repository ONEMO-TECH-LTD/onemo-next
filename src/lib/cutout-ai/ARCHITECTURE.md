# cutout-ai — architecture contract (s62, locked with Dan 2026-08-05)

The fixed reference. Any code in this folder that violates a line here is slop by definition
and gets deleted, not defended.

## Mission
Promptable AI cutout (SAM family) as **add-on microservices** wired to the **untouched v5.3.1
engine**, tested in onemo-next behind a thin UI shell, liftable later to the clean engine repo
as one unit.

## Laws
1. **v5.3.1 engine is read-only.** No file under `src/lib/effect/` or the v5.3.1 app dir changes.
   Its post-processing (trace → outline-resolve → compose) is THE finishing — never reimplemented
   here. No raster blur/offset/clean/composite code in this folder, ever.
2. **One sub = one job = one file.** Each AI model is its own sub behind the one shared interface.
   The brush is its own sub. No sub imports another sub except through the declared interfaces.
3. **No logic in the UI.** The shell holds state and render only. If a loop over pixels appears in
   a React component, it is slop.
4. **Pure and portable.** Subs have zero React/DOM/Next imports (workers/canvas boundary code lives
   only in the declared transport files). The folder lifts to the new repo by copy.
5. **No duplication of registries or math.** Model configs exist once (registry). Preprocessing
   exists once (preprocess). The page never carries its own copy of anything.
6. **Brush edits, never replaces.** The accepted mask is the base. Add = model-snapped fill,
   unioned into the base. Erase = subtract. Full re-detect is a separate explicit action.

## Modules
```
src/lib/cutout-ai/
  ARCHITECTURE.md      this contract
  types.ts             Mask, Point, Frame, SegModelConfig, the SegModel interface — data only
  registry.ts          the model list (one entry per sub), default model, central auto-prompt
  preprocess.ts        pure tensor builders: samCHW / samHWC (+ scale mapping). No runtime imports.
  select.ts            pure candidate-mask pick: auto = largest valid, guided = best score
  models/
    slimsam.ts         SlimSAM-77/50 (transformers.js SamModel)     — implements SegModel
    sam2.ts            SAM2-tiny     (transformers.js Sam2Model)    — implements SegModel
    mobilesam.ts       MobileSAM     (raw ORT, HWC encoder)         — implements SegModel
    edgesam.ts         EdgeSAM       (raw ORT, CHW encoder)         — implements SegModel
  brush.ts             the brush microservice: base-retain mask state,
                       addStroke(stroke) → prompt → model → union · eraseStroke → subtract ·
                       redetect() explicit. Pure; the model is an injected SegModel.
  runtime.ts           lazy loaders for the two runtimes (self-hosted /ort webgpu build,
                       @huggingface/transformers). The only file that touches them.
  worker.ts            thin transport: postMessage ↔ SegModel + brush. No logic.
  client.ts            thin main-thread handle over worker.ts. No logic.
```
u2net/silueta are NOT re-implemented here — they are v5.3.1's (`ben-chain`); the UI reaches them
through v5.3.1's own path.

## The SegModel interface (every model sub, identical)
```ts
load(exec: 'auto'|'wasm'): Promise<void>       // cold-start, own runtime pick
encode(frame: Frame): Promise<void>            // once per image
segment(points: Point[], auto: boolean): Promise<Mask>  // prompt → binary mask at frame res
```

## Wiring for the proto shell
upload → client(model sub).encode → auto segment → mask → **v5.3.1 finishing**
(`traceContourRaw` → `resolveTraceOutline` → `composeEffectArtwork`) → sticker preview.
Brush strokes → brush.ts (union/subtract) → same finishing. Timings shown per stage.

## Verification gate (before "done")
Each model sub + the brush exercised through the real shell on the real bench (Batman + Porsche
cases), v5.3.1 finishing applied, timings visible, and the ear-gap case: brushing a missed ear
tip FILLS it while the rest of the selection stays.
