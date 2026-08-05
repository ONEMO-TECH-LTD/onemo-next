# cutout-ai — architecture contract (s62; refreshed 2026-08-06 to the locked state)

The fixed reference. Any code in this folder that violates a line here is slop by definition
and gets deleted, not defended.

## Mission
Promptable AI segmentation (the SELECTED model: EdgeSAM) as an **add-on microservice** for the
**untouched v5.3.1 engine**. This folder produces MASKS + SOFT MATTES only; ALL finishing and
compositing is the engine's (`prepareShaped` consumes the matte via its preseg seam). Liftable
to the clean engine repo as one unit.

## Laws
1. **v5.3.1 engine is read-only.** No file under `src/lib/effect/` or the v5.3.1 app dir changes.
   No post-processing/compositing code in this folder, ever — the engine owns it.
2. **One sub = one job = one file.** Each AI model is its own sub behind the one `SegModel`
   interface. The brush is its own sub. Re-adding a model = one new file + one registry entry.
3. **No logic in the UI.** Shells hold state and render only.
4. **Pure and portable.** Subs have zero React/DOM/Next imports (worker/client transport and the
   runtime loader are the declared boundary files). The folder lifts by copy.
5. **No duplication of registries or math.** Model configs exist once (registry). Preprocessing
   exists once (preprocess).
6. **Brush edits, never replaces.** The accepted mask is the base. Add = model-snapped fill
   unioned in. Erase = subtract. Full re-detect is a separate explicit action. `setBase` seeds
   the base from any externally produced mask.
7. **Soft matte parity.** Model logits are upsampled BILINEARLY; the binary mask thresholds after
   interpolation and the `soft` channel (sigmoid) rides along — the engine's compositing expects
   a continuous matte, never a hard binary cut.
8. **One AI runtime resident per page** (iPhone OOM law, s62 device evidence). The shell enforces
   it; this folder enables it (fresh worker per spawn, watchdog kills hung workers so iOS freezes
   become registered faults).

## Modules (current)
```
src/lib/cutout-ai/
  ARCHITECTURE.md      this contract
  types.ts             Mask (+soft), Point, Frame, SegModelConfig, the SegModel interface
  registry.ts          the model list (EdgeSAM — the s62 selection), central auto-prompt
  preprocess.ts        pure tensor builders: samCHW/samHWC · logitsToMask (bilinear + soft out)
  select.ts            pure candidate-mask pick: auto = largest valid, guided = best score
  models/edgesam.ts    EdgeSAM (raw ORT, CHW encoder, padded-square-aware decode) — SegModel
  brush.ts             base-retain mask state: addStroke→union · eraseStroke→subtract ·
                       redetect explicit · setBase. Pure; model injected.
  runtime.ts           ORT loaders: self-hosted /ort, build picked by REAL WebGPU adapter probe,
                       session-probe fallback to pure WASM, streamed fetch with byte progress
  worker.ts            thin transport (watchdogged by client) — no logic
  client.ts            thin main-thread handle; per-call WATCHDOG converts silent iOS freezes
                       into registered faults (progress re-arms it) — no logic
```
Killed on the s62 verdict (git history preserves them): SlimSAM, SAM2-tiny, MobileSAM subs +
their weights. u2net/silueta were never here — they are v5.3.1's (`ben-chain`).

## Verification gates
Every change exercised through the real shell on the launched bench (headless gates alone are
never "done"), plus: the ear-gap case (a brushed gap FILLS, selection retained), and the
non-square alignment case (padded-square decode maps to image space exactly).
