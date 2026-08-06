// Cut-out background-removal — Web Worker (V3 · blueprint §6.2 + G5)
//
// Production default = the self-hosted trio (u2netp -> silueta -> flood-fill) on the WASM EP
// (no WebGPU → Safari-safe); BEN2 (transformers.js, webgpu→wasm) is opt-in only via ?seg=ben2.
// The ML inference is the blocking step — it runs HERE, off the main thread, so the UI stays responsive.
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

// KAI-9087: the rembg cut-out CHAIN composition + matte feasibility live in ./ben-chain — a PURE,
// unit-tested module (a direct worker import would crash a test on onmessage/self/postMessage).
import { resolveChain, isDegenerateMatte, isSamSpec, samAreaEligible, SAM_CENTRAL_PROMPT, type RembgSpec, type SamSpec, type ChainSpec } from './ben-chain'

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
// (RembgSpec / REMBG / resolveChain extracted to ./ben-chain — imported above — KAI-9087.)

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
  // v5.5 inv 19 — cap the WORKER's post-process resolution. ow×oh drives the full-res alpha/rgb/rgba
  // buffers below (the upload-OOM +2GB half; texDim does NOT reach here — segment-ml rasterizes only AFTER).
  // The cut-LINE is re-traced at maskDim (1200), so a ~1536 matte is sub-pixel at the outline
  // (visually-neutral); the texImage is sourced from the original at texDim separately. Original untouched.
  const WORKER_DIM_CAP = 1536
  const _bw = bmp.width, _bh = bmp.height
  const _wscale = Math.min(1, WORKER_DIM_CAP / Math.max(_bw, _bh))
  const ow = Math.round(_bw * _wscale), oh = Math.round(_bh * _wscale), S = spec.size, plane = S * S
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
  return finishMatte(od, S, S, S, S, bmp, ow, oh)
}

/**
 * THE one post-generation tail (extracted verbatim from runRembg — every roster model plugs into
 * it): raw low-res model map → min-max normalize → alpha at map res → canvas upscale to ow×oh →
 * RGBA matte over the original pixels → degenerate guard. `vw×vh` = the VALID region of the map
 * (SAM's map covers its zero-padded square; rembg maps cover the image exactly, vw=mw/vh=mh).
 */
function finishMatte(
  od: ArrayLike<number>, mw: number, mh: number, vw: number, vh: number,
  bmp: ImageBitmap, ow: number, oh: number,
): { data: Uint8ClampedArray; width: number; height: number } {
  const plane = mw * mh
  let lo = Infinity, hi = -Infinity
  for (let i = 0; i < plane; i++) { const v = od[i] as number; if (v < lo) lo = v; if (v > hi) hi = v }
  const rng = (hi - lo) || 1
  const mImg = new ImageData(mw, mh)
  for (let i = 0; i < plane; i++) mImg.data[i * 4 + 3] = Math.round((((od[i] as number) - lo) / rng) * 255)
  const mc = new OffscreenCanvas(mw, mh); (mc.getContext('2d') as OffscreenCanvasRenderingContext2D).putImageData(mImg, 0, 0)
  const ac = new OffscreenCanvas(ow, oh); const actx = ac.getContext('2d') as OffscreenCanvasRenderingContext2D
  actx.drawImage(mc, 0, 0, vw, vh, 0, 0, ow, oh)
  const alpha = actx.getImageData(0, 0, ow, oh).data
  const dc = new OffscreenCanvas(ow, oh); const dctx = dc.getContext('2d') as OffscreenCanvasRenderingContext2D
  dctx.drawImage(bmp, 0, 0, ow, oh)
  bmp.close() // v5.5 inv 27: free the decoded bitmap (was never closed — a retained-memory leak)
  const rgb = dctx.getImageData(0, 0, ow, oh).data
  const rgba = new Uint8ClampedArray(ow * oh * 4)
  let subj = 0
  for (let i = 0, n = ow * oh; i < n; i++) { rgba[i * 4] = rgb[i * 4]; rgba[i * 4 + 1] = rgb[i * 4 + 1]; rgba[i * 4 + 2] = rgb[i * 4 + 2]; rgba[i * 4 + 3] = alpha[i * 4 + 3]; if (alpha[i * 4 + 3] > 128) subj++ }
  // Degenerate guard: an empty (subject not found) or full-frame matte is not a usable cut — treat as
  // a failure so the chain falls back to the next model (e.g. u2netp → Silueta).
  const frac = subj / (ow * oh)
  if (isDegenerateMatte(frac)) throw new Error('rembg-degenerate:' + frac.toFixed(3))
  return { data: rgba, width: ow, height: oh }
}

/** SAM roster runner (s62): encoder+decoder with the spec's documented preprocess and the central
 *  auto-prompt, then the raw low-res mask map plugs into the SAME finishMatte tail as u2net. */
async function runSam(imageUrl: string, spec: SamSpec, onProgress: (s: string) => void): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const ort = await getOrt()
  const enc = await getRembgSession({ url: spec.enc } as RembgSpec, onProgress)
  const dec = await getRembgSession({ url: spec.dec } as RembgSpec, onProgress)
  onProgress('cutting')
  const blob = await withTimeout(fetch(imageUrl).then((r) => r.blob()), 15000, 'fetch-img')
  const bmp = await withTimeout(createImageBitmap(blob), 15000, 'bitmap')
  const WORKER_DIM_CAP = 1536
  const _wscale = Math.min(1, WORKER_DIM_CAP / Math.max(bmp.width, bmp.height))
  const ow = Math.round(bmp.width * _wscale), oh = Math.round(bmp.height * _wscale)
  // preprocess: aspect-preserving resize (longest side → size), zero-PAD, (px - mean)/std → CHW
  const T = spec.size, scale = T / Math.max(bmp.width, bmp.height)
  const nw = Math.round(bmp.width * scale), nh = Math.round(bmp.height * scale), plane = T * T
  const pc = new OffscreenCanvas(T, T); const pctx = pc.getContext('2d') as OffscreenCanvasRenderingContext2D
  pctx.drawImage(bmp, 0, 0, nw, nh)
  const px = pctx.getImageData(0, 0, T, T).data
  const input = new Float32Array(3 * plane) // zeros = padding
  for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
    const di = y * T + x, j = di * 4
    input[di] = (px[j] - spec.mean[0]) / spec.std[0]
    input[plane + di] = (px[j + 1] - spec.mean[1]) / spec.std[1]
    input[2 * plane + di] = (px[j + 2] - spec.mean[2]) / spec.std[2]
  }
  const embRes = await withTimeout(enc.run({ [enc.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, T, T]) }), 60000, 'sam-encode')
  const emb = embRes[enc.outputNames[0]] as unknown as { data: Float32Array; dims?: number[] }
  // decoder: central auto-prompt in the model's coordinate space (the VALID nw×nh region)
  const pts = SAM_CENTRAL_PROMPT
  const coords = new Float32Array(pts.length * 2)
  const labels = new Float32Array(pts.length).fill(1)
  pts.forEach(([nx, ny], i) => { coords[i * 2] = nx * nw; coords[i * 2 + 1] = ny * nh })
  const feeds: Record<string, unknown> = {
    [dec.inputNames[0]]: new ort.Tensor('float32', emb.data, (emb.dims ?? [1, 256, 64, 64]) as number[]),
    point_coords: new ort.Tensor('float32', coords, [1, pts.length, 2]),
    point_labels: new ort.Tensor('float32', labels, [1, pts.length]),
  }
  const out = await withTimeout(dec.run(feeds), 60000, 'sam-decode') as Record<string, { data: Float32Array; dims?: number[] }>
  const maskName = dec.outputNames.find((n) => /mask/i.test(n)) ?? dec.outputNames[dec.outputNames.length - 1]
  const scoreName = dec.outputNames.find((n) => /score|iou/i.test(n))
  const masks = out[maskName], scores = scoreName ? out[scoreName] : undefined
  const dims = masks.dims ?? [1, 1, 256, 256]
  const num = dims[1] ?? 1, mh = dims[dims.length - 2], mw2 = dims[dims.length - 1]
  // CANDIDATE PICK (s62 device-verified auto rule): a SAM candidate is ELIGIBLE only if its subject
  // area is a sane fraction of the image (5–92%) — best-score-only kept selecting the near-full-
  // frame mask (subject = the whole photo → 'no compositing', Dan 2026-08-06). Among eligible:
  // highest score. None eligible → throw, and the chain falls back to u2netp like any model failure.
  const vx2 = Math.round(mw2 * (nw / T)), vy2 = Math.round(mh * (nh / T))
  const validArea = Math.max(1, vx2 * vy2)
  let best = -1, bestScore = -Infinity
  for (let i = 0; i < num; i++) {
    const m = masks.data.subarray(i * mh * mw2, (i + 1) * mh * mw2)
    let pos = 0
    for (let y = 0; y < vy2; y++) for (let x = 0; x < vx2; x++) if (m[y * mw2 + x] > 0) pos++
    const frac = pos / validArea
    if (!samAreaEligible(frac)) continue
    const s = scores ? scores.data[i] : 0
    if (s > bestScore) { bestScore = s; best = i }
  }
  if (best < 0) { bmp.close(); throw new Error('sam-no-valid-candidate') }
  const map = masks.data.subarray(best * mh * mw2, (best + 1) * mh * mw2)
  // LOGITS → PROBABILITY before the shared tail (Dan's two-ghost-images catch, 2026-08-06): SAM
  // emits signed logits — a linear min-max (the u2net tail's math, correct for non-negative
  // saliency) leaves the BACKGROUND at ~30-40% alpha, making the subject layer a ghost of the whole
  // image. Sigmoid is SAM's own probability map: background → ~0, subject → ~1 — the same
  // saliency-like field u2net hands the tail. Model-output conversion belongs to the model slot.
  // Clamped linear ramp centred on the zero-crossing (adaptive width hi/4): background → exactly 0
  // (no ghost layer), subject interior → exactly 1 (SOLID for print), boundary at the model's true
  // zero-crossing, and a CONTINUOUS gradient so the upscale traces sub-pixel (a raw sigmoid at 256²
  // is near-binary → the jittery outline + semi-transparent interior Dan caught, 15:32).
  let hiL = 0
  for (let i = 0; i < mh * mw2; i++) if (map[i] > hiL) hiL = map[i]
  const Tramp = Math.max(1e-6, hiL / 4)
  const prob = new Float32Array(mh * mw2)
  for (let i = 0; i < prob.length; i++) prob[i] = Math.min(1, Math.max(0, 0.5 + map[i] / (2 * Tramp)))
  // SPATIAL parity with u2net: SAM's logits flip within ~1 map px while u2net's saliency ramps over
  // 2–3 px — the residual staircase Dan compared (15:32). Two separable [1,2,1] passes widen the
  // boundary to the same ~2-3 px signal class; interior/背景 plateaus are invariant (stay 1/0 solid).
  for (let pass = 0; pass < 2; pass++) {
    const tmp = new Float32Array(prob)
    for (let y = 0; y < mh; y++) for (let x = 1; x < mw2 - 1; x++) { const i = y * mw2 + x; prob[i] = (tmp[i - 1] + 2 * tmp[i] + tmp[i + 1]) / 4 }
    tmp.set(prob)
    for (let y = 1; y < mh - 1; y++) for (let x = 0; x < mw2; x++) { const i = y * mw2 + x; prob[i] = (tmp[i - mw2] + 2 * tmp[i] + tmp[i + mw2]) / 4 }
  }
  // SAM's map covers the zero-padded square — only the nw×nh fraction is the image (the padded-square
  // misalignment fix). Plug into the ONE shared tail.
  return finishMatte(prob, mw2, mh, Math.round(mw2 * (nw / T)), Math.round(mh * (nh / T)), bmp, ow, oh)
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
      try {
        const first = chain[0]
        await getRembgSession(isSamSpec(first) ? ({ url: first.enc } as RembgSpec) : first, (s) => ctx.postMessage({ id, progress: s }))
      } catch { /* best-effort warm */ }
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
          const r = isSamSpec(spec)
            ? await runSam(url, spec, (s) => ctx.postMessage({ id, progress: s }))
            : await runRembg(url, spec, (s) => ctx.postMessage({ id, progress: s }))
          ctx.postMessage({ id, ok: true, data: r.data.buffer, width: r.width, height: r.height, adapter: spec.adapter }, [r.data.buffer])
          return
        } catch (err) {
          lastErr = err // try the next model in the chain (e.g. edgesam → u2netp → silueta)
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
