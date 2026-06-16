// BEN2-ONNX background-removal — Web Worker (V3 · blueprint §6.2 + G5)
//
// The ML inference (BEN2-ONNX via transformers.js, webgpu→wasm) is the 30–60s blocking step.
// It runs HERE, off the main thread, so the UI stays responsive.
//
// G5 hardening (blueprint §7):
//  • SELF-HOSTED weights first: `env.localModelPath = '/models'` — pin the model under
//    `public/models/onnx-community/BEN2-ONNX/` (see TUNING) and it loads same-origin, no runtime
//    third-party hub fetch. Falls back to the HF hub (with a loud progress state) only when the
//    local copy is absent, so dev machines keep working before the weights are mirrored.
//  • HONEST PROGRESS: posts `{progress: 'downloading-model' | 'cutting'}` states so the UI can say
//    what the wait actually is (download vs inference) instead of a 30s mystery shimmer.
//  • LOUD OUTPUT GUARD (TD-D): a non-RGBA model output used to degrade silently into a full-frame
//    matte (alpha=255 everywhere). Now it throws — a wrong model output is an error, not a square.
//
// Split (Option A — DOM stays on main): this worker runs ONLY the transformers pipeline and posts
// back the full-res RGBA RawImage buffer (alpha = subject matte) + dims. The main-thread `segmentML`
// wrapper (segment-ml.ts) does the canvas rasterize/downscale + alpha→mask (workers have no DOM).
// Buffer is transferred (zero-copy hand-off).

// MODEL COMPARISON HARNESS — every candidate runs through the IDENTICAL pipeline method as BEN2
// (webgpu → wasm fallback, fp16). The page chooses the model via the `?seg=` URL param (read in
// segment-ml.ts and forwarded here), so we A/B all candidates on the SAME device under SAME conditions
// and compare peak memory. Default = BEN2 (the measured baseline ~977 MB). No CPU-forcing here — that's
// a separate experiment only if every model fails this method.
// Sizes: BEN2 219 MB (MIT) · RMBG-1.4 88 MB fp16 (PAID/BRIA) · BiRefNet_lite 114 MB (MIT).
// `adapter` is the STABLE identity reported back on a successful cut (R1 — the spec/telemetry records
// the model that actually ran, not a hard-coded constant). It is a model identity, not the HF repo id.
type SegModel = { id: string; dtype: 'fp16' | 'fp32' | 'q8' | 'int8'; device?: 'webgpu' | 'wasm'; adapter: string }
const MODELS: Record<string, SegModel> = {
  ben2: { id: 'onnx-community/BEN2-ONNX', dtype: 'fp16', adapter: 'ben2-onnx' }, // webgpu OK (default)
  rmbg: { id: 'briaai/RMBG-1.4', dtype: 'fp16', adapter: 'rmbg-1.4' },          // paid — not a ship candidate
  // BiRefNet's ops fail to compile on the ORT-web WebGPU backend (OrtRun shader_helper error) — it
  // runs correctly on the WASM backend. fp32 (no fp16/q8 perf issues on wasm) for reliability.
  birefnet: { id: 'onnx-community/BiRefNet_lite-ONNX', dtype: 'fp32', device: 'wasm', adapter: 'birefnet-lite' },
}
const DEFAULT_MODEL = MODELS.ben2
const resolveModel = (key?: string) => (key && MODELS[key]) || DEFAULT_MODEL

// ── rembg-style raw-ONNX models (U^2-Net / IS-Net family) — NOT transformers.js pipelines ───────
// These ship as bare .onnx (no HF config), so transformers.js can't load them. Proper install:
// run them via transformers.js's already-bundled+configured onnxruntime-web (wasm EP), with each
// model's documented preprocess (resize + /max + mean/std normalize) and postprocess (saliency →
// min-max → alpha → full-res RGBA matte). All MIT/Apache (free, commercial-OK). Weights mirrored on HF.
// `adapter` = the stable model identity reported back on a successful cut (R1 — true telemetry).
type RembgSpec = { adapter: string; url: string; size: number; mean: [number, number, number]; std: [number, number, number] }
// PRODUCTION trio weights are SELF-HOSTED same-origin under public/seg-models (committed; served by
// Vercel /public) — no third-party fetch, works offline, and the silueta fallback loads fast (no
// cold-CDN timeout → flood-fill). The test-only comparison models (u2net/isnet) stay on the HF CDN.
const SEG_HOST = '/seg-models'                                              // self-hosted (production)
const REMBG_HOST = 'https://huggingface.co/tomjackson2023/rembg/resolve/main' // CDN (test harness only)
const REMBG: Record<string, RembgSpec> = {
  // U^2-Net family — input 320, ImageNet mean/std
  silueta: { adapter: 'silueta', url: `${SEG_HOST}/silueta.onnx`,   size: 320, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] }, // self-hosted (fallback)
  u2netp:  { adapter: 'u2netp',  url: `${SEG_HOST}/u2netp.onnx`,    size: 320, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] }, // self-hosted (primary)
  u2net:   { adapter: 'u2net',   url: `${REMBG_HOST}/u2net.onnx`,   size: 320, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] }, // harness only
  // IS-Net (DIS general-use) — input 1024, 0.5/1.0 normalize
  isnet:   { adapter: 'isnet-general-use', url: `${REMBG_HOST}/isnet-general-use.onnx`, size: 1024, mean: [0.5, 0.5, 0.5], std: [1.0, 1.0, 1.0] },   // harness only
}

// PRODUCTION CUT-OUT CHAIN (Dan, 2026-06-16). Default (no `?seg=`) runs the free, mobile-fit trio:
//   u2netp (4 MB primary) → silueta (44 MB fallback) → [throw → prepare-effect flood-fill].
// Silueta is LAZY: it's only fetched/created when u2netp errors first (the chain loop only calls
// runRembg(silueta) after runRembg(u2netp) throws), so the 44 MB never lands on the device unless
// the primary actually fails. `?seg=<model>` overrides with a single model (the comparison harness);
// ben2 / birefnet (or an unknown key) → null → the transformers.js path (getSegmenter).
function resolveChain(seg?: string): RembgSpec[] | null {
  if (!seg) return [REMBG.u2netp, REMBG.silueta] // production default trio
  if (REMBG[seg]) return [REMBG[seg]]            // explicit single rembg model (test harness)
  return null                                    // ben2 / birefnet → transformers path
}

// Worker global — typed loosely to avoid DOM/WebWorker lib conflicts in the shared tsconfig.
const ctx: { onmessage: ((e: MessageEvent) => void) | null; postMessage: (msg: unknown, transfer?: Transferable[]) => void } =
  self as unknown as typeof ctx

// Lazy, cached PER MODEL (so switching `?seg=` mid-session re-inits cleanly). Same pipeline method
// for every model: webgpu first, wasm fallback — identical to the BEN2 baseline.
const segmenters = new Map<string, Promise<(input: string[]) => Promise<unknown>>>()
function getSegmenter(onProgress: (state: string) => void, model: SegModel) {
  let p = segmenters.get(model.id)
  if (!p) {
    p = (async () => {
      const mod = await import('@huggingface/transformers')
      // self-hosted pinned weights first (same-origin /models), hub fallback when not mirrored.
      mod.env.allowLocalModels = true
      mod.env.localModelPath = '/models'
      mod.env.allowRemoteModels = true
      let downloading = false
      const progress_callback = (pr: { status?: string }) => {
        if (!downloading && (pr.status === 'download' || pr.status === 'progress' || pr.status === 'initiate')) {
          downloading = true
          onProgress('downloading-model')
        }
      }
      const primary = model.device ?? 'webgpu' // some models (BiRefNet) only run on wasm
      let seg
      try {
        seg = await mod.pipeline('background-removal', model.id, { device: primary, dtype: model.dtype, progress_callback })
      } catch {
        seg = await mod.pipeline('background-removal', model.id, { device: 'wasm', dtype: model.dtype, progress_callback }) // wasm fallback
      }
      return seg as unknown as (input: string[]) => Promise<unknown>
    })()
    // a failed load must not poison every later attempt with the same rejected promise
    p.catch(() => { segmenters.delete(model.id) })
    segmenters.set(model.id, p)
  }
  return p
}

// ── rembg raw-ONNX inference (SELF-HOSTED onnxruntime-web, WASM EP) ───────────────────────────────
// transformers.js bundles a private DEV build of ORT (not exported, not servable for raw use), so we
// load a stable onnxruntime-web 1.21.0 that we MIRROR same-origin under public/ort (ort.wasm.min.mjs +
// ort-wasm-simd-threaded.{mjs,wasm}). webpackIgnore keeps the bundler out of the runtime import. Being
// same-origin it passes COEP automatically, needs no third-party uptime, and works offline. WASM EP
// only (U^2-Net / IS-Net ops are wasm-safe; avoids the ORT-web WebGPU shader bug BiRefNet hit).
const ORT_BASE = '/ort/' // self-hosted, same-origin (public/ort)
interface OrtSession { inputNames: string[]; outputNames: string[]; run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: Float32Array }>> }
interface OrtModule { InferenceSession: { create: (b: Uint8Array, o: unknown) => Promise<OrtSession> }; Tensor: new (t: string, d: Float32Array, dims: number[]) => unknown; env: { wasm: { wasmPaths: string; numThreads: number } } }
let ortMod: Promise<OrtModule> | null = null
function getOrt(): Promise<OrtModule> {
  if (!ortMod) ortMod = (async () => {
    const ort = await import(/* webpackIgnore: true */ `${ORT_BASE}ort.wasm.min.mjs`) as unknown as OrtModule
    ort.env.wasm.wasmPaths = ORT_BASE
    // Single-threaded: threaded WASM spawns nested worker-threads which DEADLOCK inside this Web
    // Worker (inference hangs at "Cutting out…"). 1 thread is reliable + still fast for 320² U^2-Net.
    ort.env.wasm.numThreads = 1
    return ort
  })()
  return ortMod
}
const rembgSessions = new Map<string, Promise<OrtSession>>()
function getRembgSession(spec: RembgSpec, onProgress: (s: string) => void): Promise<OrtSession> {
  let p = rembgSessions.get(spec.url)
  if (!p) {
    p = (async () => {
      const ort = await getOrt()
      onProgress('downloading-model')
      const buf = await fetch(spec.url).then((r) => r.arrayBuffer())
      return ort.InferenceSession.create(new Uint8Array(buf), { executionProviders: ['wasm'] })
    })()
    p.catch(() => rembgSessions.delete(spec.url))
    rembgSessions.set(spec.url, p)
  }
  return p
}
/** image URL → full-res RGBA matte (alpha = subject), via a rembg U^2-Net/IS-Net model. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('rembg-timeout:' + label)), ms))])
}
async function runRembg(imageUrl: string, spec: RembgSpec, onProgress: (s: string) => void): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const ort = await getOrt()
  const session = await getRembgSession(spec, onProgress)
  onProgress('cutting')
  const blob = await withTimeout(fetch(imageUrl).then((r) => r.blob()), 15000, 'fetch-img')
  const bmp = await withTimeout(createImageBitmap(blob), 15000, 'bitmap')
  const ow = bmp.width, oh = bmp.height, S = spec.size, plane = S * S
  // preprocess: resize SxS, scale by max, mean/std normalize → CHW float32
  const pc = new OffscreenCanvas(S, S); const pctx = pc.getContext('2d') as OffscreenCanvasRenderingContext2D
  pctx.drawImage(bmp, 0, 0, S, S)
  const px = pctx.getImageData(0, 0, S, S).data
  let mx = 1
  for (let i = 0; i < px.length; i += 4) mx = Math.max(mx, px[i], px[i + 1], px[i + 2])
  const input = new Float32Array(3 * plane)
  for (let p2 = 0, j = 0; p2 < plane; p2++, j += 4) {
    input[p2] = ((px[j] / mx) - spec.mean[0]) / spec.std[0]
    input[plane + p2] = ((px[j + 1] / mx) - spec.mean[1]) / spec.std[1]
    input[2 * plane + p2] = ((px[j + 2] / mx) - spec.mean[2]) / spec.std[2]
  }
  const feeds: Record<string, unknown> = {}
  feeds[session.inputNames[0]] = new ort.Tensor('float32', input, [1, 3, S, S])
  const res = await withTimeout(session.run(feeds), 60000, 'run')
  const od = res[session.outputNames[0]].data // [1,1,S,S] saliency
  let lo = Infinity, hi = -Infinity
  for (let i = 0; i < plane; i++) { const v = od[i]; if (v < lo) lo = v; if (v > hi) hi = v }
  const rng = (hi - lo) || 1
  // saliency → alpha at SxS, upscale to original
  const mImg = new ImageData(S, S)
  for (let i = 0; i < plane; i++) mImg.data[i * 4 + 3] = Math.round(((od[i] - lo) / rng) * 255)
  const mc = new OffscreenCanvas(S, S); (mc.getContext('2d') as OffscreenCanvasRenderingContext2D).putImageData(mImg, 0, 0)
  const ac = new OffscreenCanvas(ow, oh); const actx = ac.getContext('2d') as OffscreenCanvasRenderingContext2D
  actx.drawImage(mc, 0, 0, ow, oh)
  const alpha = actx.getImageData(0, 0, ow, oh).data
  const dc = new OffscreenCanvas(ow, oh); const dctx = dc.getContext('2d') as OffscreenCanvasRenderingContext2D
  dctx.drawImage(bmp, 0, 0, ow, oh)
  const rgb = dctx.getImageData(0, 0, ow, oh).data
  const rgba = new Uint8ClampedArray(ow * oh * 4)
  let subj = 0
  for (let i = 0, n = ow * oh; i < n; i++) { rgba[i * 4] = rgb[i * 4]; rgba[i * 4 + 1] = rgb[i * 4 + 1]; rgba[i * 4 + 2] = rgb[i * 4 + 2]; rgba[i * 4 + 3] = alpha[i * 4 + 3]; if (alpha[i * 4 + 3] > 128) subj++ }
  // Degenerate guard: an empty (subject not found) or full-frame matte is not a usable cut — treat as
  // a failure so the chain falls back to the next model (e.g. u2netp → Silueta).
  const frac = subj / (ow * oh)
  if (frac < 0.005 || frac > 0.995) throw new Error('rembg-degenerate:' + frac.toFixed(3))
  return { data: rgba, width: ow, height: oh }
}

interface RawImageData {
  data: Uint8ClampedArray | Uint8Array
  width: number
  height: number
  channels: number
}

ctx.onmessage = async (e: MessageEvent<{ id: number; url: string; preload?: boolean; seg?: string }>) => {
  const { id, url } = e.data
  const model = resolveModel(e.data.seg)
  const chain = resolveChain(e.data.seg) // rembg trio (default) / single rembg model / null → transformers
  // PRELOAD (SHORTLIST #31): DOWNLOAD-ONLY warm-up — fetch the weights into the browser cache
  // with ZERO GPU work. Initializing the webgpu session here drops the golden scene's WebGL
  // context at page boot ("THREE.WebGLRenderer: Context Lost" — reproduced live, Dan's freeze).
  // The GPU session still initializes at the first real Magic press (proven safe on a live scene);
  // by then the files are local, so the wait collapses to session init only.
  if (e.data.preload) {
    if (chain) {
      // Warm ONLY the primary (chain[0] = u2netp). rembg runs on the WASM EP (no GPU session), so
      // creating the session here is safe (no WebGL context loss) and makes the first Magic instant.
      // The fallback (silueta) is deliberately NOT warmed — it stays un-fetched until u2netp errors.
      try { await getRembgSession(chain[0], (s) => ctx.postMessage({ id, progress: s })) } catch { /* best-effort warm */ }
      ctx.postMessage({ id, ok: true, preloaded: true })
      return
    }
    try {
      const mod = await import('@huggingface/transformers')
      mod.env.allowLocalModels = true
      mod.env.localModelPath = '/models'
      mod.env.allowRemoteModels = true
      // from_pretrained on the MODEL (no pipeline, no device session) downloads + caches the
      // config/tokenizer/onnx weights via transformers.js' own Cache API, then frees the instance.
      const m = await mod.AutoModel.from_pretrained(model.id, {
        progress_callback: (p: { status?: string }) => {
          if (p.status === 'download' || p.status === 'initiate') ctx.postMessage({ id, progress: 'downloading-model' })
        },
        // wasm/cpu device for the throwaway instance — never webgpu at preload
        device: 'wasm',
        dtype: model.dtype, // match the run variant so the preload-warmed cache is reused (no re-download)
      } as Parameters<typeof mod.AutoModel.from_pretrained>[1])
      try { await (m as unknown as { dispose?: () => Promise<unknown> }).dispose?.() } catch { /* best-effort free */ }
      ctx.postMessage({ id, ok: true, preloaded: true })
    } catch (err) {
      ctx.postMessage({ id, ok: false, error: String((err as Error)?.message ?? err) })
    }
    return
  }
  try {
    if (chain) {
      // Run the chain in order; the FIRST model that produces a usable cut wins. A throw (load error
      // or degenerate matte) falls through to the next model — which is what makes silueta lazy: its
      // weights are only fetched here, inside runRembg, after u2netp has already failed. If every
      // model fails we rethrow the last error, and prepare-effect's catch drops to flood-fill.
      let lastErr: unknown
      for (const spec of chain) {
        try {
          const r = await runRembg(url, spec, (s) => ctx.postMessage({ id, progress: s }))
          ctx.postMessage({ id, ok: true, data: r.data.buffer, width: r.width, height: r.height, adapter: spec.adapter }, [r.data.buffer])
          return
        } catch (err) {
          lastErr = err // try the next model in the chain (e.g. u2netp → silueta)
        }
      }
      throw lastErr ?? new Error('rembg-chain-empty')
    }
    const segmenter = await getSegmenter((state) => ctx.postMessage({ id, progress: state }), model)
    ctx.postMessage({ id, progress: 'cutting' })
    const result = (await segmenter([url])) as RawImageData[] | RawImageData
    const raw = (Array.isArray(result) ? result[0] : result) as RawImageData
    if (!raw?.data) throw new Error('BEN2 returned no image data')
    const { width, height, channels } = raw
    // TD-D loud guard: the matte LIVES in the alpha channel — anything but RGBA means the model
    // output is not a matte. Synthesizing alpha=255 here would silently turn Magic into a no-op square.
    if (channels !== 4) {
      throw new Error(`BEN2 returned ${channels}-channel output (expected RGBA matte) — refusing to fake a full-frame matte`)
    }
    // Fresh standalone RGBA buffer (so it transfers cleanly).
    const rgba = new Uint8ClampedArray(width * height * 4)
    rgba.set(raw.data)
    ctx.postMessage({ id, ok: true, data: rgba.buffer, width, height, adapter: model.adapter }, [rgba.buffer])
  } catch (err) {
    ctx.postMessage({ id, ok: false, error: String((err as Error)?.message ?? err) })
  }
}

export {}
