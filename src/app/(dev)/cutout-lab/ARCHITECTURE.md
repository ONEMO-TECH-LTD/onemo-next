# Cutout Lab V1 — as-built architecture

This file describes the current V1 implementation. The route remains a development-owned test shell
until the final production cutover; its reusable owners are classified in the KAI-10216 adoption map.

## Boundaries

- `page.tsx` is the existing shell. It renders the current UI, captures gestures, maps coordinates,
  and owns route-only `?debug=1` diagnostics plus the `?admin=1` paint-calibration panel.
- `flow.ts` owns state, actions, history, detector/tool orchestration, bake cadence, and the imperative
  view refs consumed by the shell.
- `finish.ts` is the browser preparation/composition adapter over the product-owned effect, mask,
  outline, and vector engines.
- `v531seg.ts` encodes the flow's already-bounded working canvas once and converts the engine result
  to the lab mask.
- `history.ts`, `ui-config.ts`, and `EditorOverlay.tsx` keep their existing focused roles.

The shell binds the existing `state` / `actions` / `view` surface. Engine policy does not move into the
shell, and this sprint does not introduce a replacement interface or an intermediate product copy.

## Detector and fallback

The only detector chain is:

1. self-hosted `u2netp` on the pinned same-origin ONNX Runtime WASM worker;
2. self-hosted Silueta, loaded only after u2netp fails;
3. the existing caller-owned flood-fill adapter in `mask.ts`, surfaced visibly by the flow.

There is no model selector or eager preload. `segment-ml.ts` owns the single worker, pending requests,
watchdog, cancellation, and disposal. Replacement, Clear, timeout, worker failure, and unmount settle
the active detector without letting stale work publish. Unmount terminates the worker so its intentional
warm ORT sessions end with their owner.

The flow decodes the upload once into its 1024px working canvas. `v531seg.ts` encodes that canvas once
for inference; it never decodes the original again or falls back to the raw oversized URL.

## Resource ownership

- Every worker-created `ImageBitmap` closes in `runRembg` on success or throw.
- The flow clears mask, geometry, prepared, live-bake, display-shim, and raster refs when artwork is
  replaced; the same caches are released on unmount.
- Temporary bounded-source blob URLs are revoked after inference.
- Production ORT module/session promises stay warm only while their worker is alive.

## Existing behavior kept

- Frame and collective outline controls;
- Paint, GrabCut, Nodes, and Clamp;
- Detect degradation, Preview, Save, Clear, Undo/Redo, replacement, and cancellation;
- current UI, route diagnostics, and paint-calibration behavior.

The preservation oracle is `scripts/verify-cutout-v1-preservation.mjs`. Later increments own the
already-characterized upload atomicity, FIFO, tool/history, output, and OpenCV defects.
