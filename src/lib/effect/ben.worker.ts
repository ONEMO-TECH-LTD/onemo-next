// Cut-out background-removal — Web Worker (V3 · blueprint §6.2 + G5)
//
// Production = self-hosted u2netp -> lazy Silueta -> visible caller-owned flood-fill on the WASM EP.
// The ML inference is the blocking step — it runs HERE, off the main thread, so the UI stays responsive.
//
// G5 hardening (blueprint §7):
//  • HONEST PROGRESS: posts `{progress: 'downloading-model' | 'cutting'}` states so the UI can say
//    what the wait actually is (download vs inference) instead of a 30s mystery shimmer.
//
// Split (Option A — DOM stays on main): this worker posts a full-res RGBA buffer (alpha = subject
// matte) + dims. The main-thread `segmentML`
// wrapper (segment-ml.ts) does the canvas rasterize/downscale + alpha→mask (workers have no DOM).
// Buffer is transferred (zero-copy hand-off).

// KAI-9087: the rembg cut-out CHAIN composition + matte feasibility live in ./ben-chain — a PURE,
// unit-tested module (a direct worker import would crash a test on onmessage/self/postMessage).
import { resolveChain, isDegenerateMatte, type RembgSpec } from './ben-chain'

// ── U^2-Net raw-ONNX inference ───────────────────────────────────────────────────────────────────
// Each model uses its documented preprocess (resize + /max + mean/std normalize) and postprocess
// (saliency → min-max → alpha → full-res RGBA matte).
// `adapter` = the stable model identity reported back on a successful cut (R1 — true telemetry).
// (RembgSpec / REMBG / resolveChain extracted to ./ben-chain — imported above — KAI-9087.)

// Worker global — typed loosely to avoid DOM/WebWorker lib conflicts in the shared tsconfig.
const ctx: { onmessage: ((e: MessageEvent) => void) | null; postMessage: (msg: unknown, transfer?: Transferable[]) => void } =
  self as unknown as typeof ctx

// ── rembg raw-ONNX inference (SELF-HOSTED onnxruntime-web, WASM EP) ───────────────────────────────
// Load the pinned onnxruntime-web 1.21.0 mirror under public/ort (ort.wasm.min.mjs +
// ort-wasm-simd-threaded.{mjs,wasm}). webpackIgnore keeps the bundler out of the runtime import. Being
// same-origin it passes COEP automatically, needs no third-party uptime, and works offline. WASM EP
// only; the production models are WASM-safe.
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
async function runRembg(bmp: ImageBitmap, spec: RembgSpec, onProgress: (s: string) => void): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const ort = await getOrt()
  const session = await getRembgSession(spec, onProgress)
  onProgress('cutting')
  // v5.5 inv 19 — cap the WORKER's post-process resolution. ow×oh drives the full-res alpha/rgb/rgba
  // buffers below (the upload-OOM +2GB half; texDim does NOT reach here — segment-ml rasterizes only AFTER).
  const WORKER_DIM_CAP = 1536
  const _bw = bmp.width, _bh = bmp.height
  const _wscale = Math.min(1, WORKER_DIM_CAP / Math.max(_bw, _bh))
  const ow = Math.round(_bw * _wscale), oh = Math.round(_bh * _wscale), S = spec.size, plane = S * S
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
  const res = await session.run(feeds)
  const od = res[session.outputNames[0]].data
  return finishMatte(od, S, S, bmp, ow, oh)
}

/**
 * THE one post-generation tail (extracted verbatim from runRembg — every roster model plugs into
 * it): raw low-res model map → min-max normalize → alpha at map res → canvas upscale to ow×oh →
 * RGBA matte over the original pixels → degenerate guard.
 */
function finishMatte(
  od: ArrayLike<number>, mw: number, mh: number, bmp: ImageBitmap, ow: number, oh: number,
): { data: Uint8ClampedArray; width: number; height: number } {
  const plane = mw * mh
  let lo = Infinity, hi = -Infinity
  for (let i = 0; i < plane; i++) { const v = od[i] as number; if (v < lo) lo = v; if (v > hi) hi = v }
  const rng = (hi - lo) || 1
  const mImg = new ImageData(mw, mh)
  for (let i = 0; i < plane; i++) mImg.data[i * 4 + 3] = Math.round((((od[i] as number) - lo) / rng) * 255)
  const mc = new OffscreenCanvas(mw, mh); (mc.getContext('2d') as OffscreenCanvasRenderingContext2D).putImageData(mImg, 0, 0)
  const ac = new OffscreenCanvas(ow, oh); const actx = ac.getContext('2d') as OffscreenCanvasRenderingContext2D
  actx.drawImage(mc, 0, 0, mw, mh, 0, 0, ow, oh)
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
  if (isDegenerateMatte(frac)) throw new Error('rembg-degenerate:' + frac.toFixed(3))
  return { data: rgba, width: ow, height: oh }
}

ctx.onmessage = async (e: MessageEvent<{ id: number; url: string }>) => {
  const { id, url } = e.data
  try {
    const blob = await fetch(url).then((r) => r.blob())
    const bmp = await createImageBitmap(blob)
    // The first usable matte wins. Silueta remains lazy because this loop reaches it only after
    // u2netp throws. Both models reuse this one decoded, already-bounded bitmap.
    try {
      let lastErr: unknown
      for (const spec of resolveChain()) {
        try {
          const r = await runRembg(bmp, spec, (s) => ctx.postMessage({ id, progress: s }))
          ctx.postMessage({ id, ok: true, data: r.data.buffer, width: r.width, height: r.height, adapter: spec.adapter }, [r.data.buffer])
          return
        } catch (err) {
          lastErr = err
        }
      }
      throw lastErr ?? new Error('rembg-chain-empty')
    } finally {
      bmp.close()
    }
  } catch (err) {
    ctx.postMessage({ id, ok: false, error: String((err as Error)?.message ?? err) })
  }
}

export {}
