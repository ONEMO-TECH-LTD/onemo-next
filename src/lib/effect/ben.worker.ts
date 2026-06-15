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

// Mobile cut-out: RMBG-1.4 (~88 MB fp16) REPLACES BEN2 (219 MB). BEN2 peaked ~977 MB live and iOS
// Safari OOM-killed the tab (measured on iPhone, Timelines). The matte-quality drop is irrelevant —
// the output is squared into a geometric marching-squares outline (fine edges/hair are discarded).
const MODEL_ID = 'briaai/RMBG-1.4'

// Worker global — typed loosely to avoid DOM/WebWorker lib conflicts in the shared tsconfig.
const ctx: { onmessage: ((e: MessageEvent) => void) | null; postMessage: (msg: unknown, transfer?: Transferable[]) => void } =
  self as unknown as typeof ctx

// Lazy, cached: one pipeline per worker lifetime (mirrors the old main-thread cache).
let segmenterPromise: Promise<(input: string[]) => Promise<unknown>> | null = null
function getSegmenter(onProgress: (state: string) => void) {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const mod = await import('@huggingface/transformers')
      // G5: self-hosted pinned weights first (same-origin /models), hub fallback for unmirrored devs.
      mod.env.allowLocalModels = true
      mod.env.localModelPath = '/models'
      mod.env.allowRemoteModels = true
      let downloading = false
      const progress_callback = (p: { status?: string }) => {
        // transformers.js emits per-file status events — surface the download state once.
        if (!downloading && (p.status === 'download' || p.status === 'progress' || p.status === 'initiate')) {
          downloading = true
          onProgress('downloading-model')
        }
      }
      let seg
      try {
        seg = await mod.pipeline('background-removal', MODEL_ID, { device: 'webgpu', dtype: 'fp16', progress_callback })
      } catch {
        seg = await mod.pipeline('background-removal', MODEL_ID, { dtype: 'fp16', progress_callback }) // wasm fallback (same fp16 weights → cache-coherent)
      }
      return seg as unknown as (input: string[]) => Promise<unknown>
    })()
    // a failed load must not poison every later attempt with the same rejected promise
    segmenterPromise.catch(() => { segmenterPromise = null })
  }
  return segmenterPromise
}

interface RawImageData {
  data: Uint8ClampedArray | Uint8Array
  width: number
  height: number
  channels: number
}

ctx.onmessage = async (e: MessageEvent<{ id: number; url: string; preload?: boolean }>) => {
  const { id, url } = e.data
  // PRELOAD (SHORTLIST #31): DOWNLOAD-ONLY warm-up — fetch the weights into the browser cache
  // with ZERO GPU work. Initializing the webgpu session here drops the golden scene's WebGL
  // context at page boot ("THREE.WebGLRenderer: Context Lost" — reproduced live, Dan's freeze).
  // The GPU session still initializes at the first real Magic press (proven safe on a live scene);
  // by then the files are local, so the wait collapses to session init only.
  if (e.data.preload) {
    try {
      const mod = await import('@huggingface/transformers')
      mod.env.allowLocalModels = true
      mod.env.localModelPath = '/models'
      mod.env.allowRemoteModels = true
      // from_pretrained on the MODEL (no pipeline, no device session) downloads + caches the
      // config/tokenizer/onnx weights via transformers.js' own Cache API, then frees the instance.
      const m = await mod.AutoModel.from_pretrained(MODEL_ID, {
        progress_callback: (p: { status?: string }) => {
          if (p.status === 'download' || p.status === 'initiate') ctx.postMessage({ id, progress: 'downloading-model' })
        },
        // wasm/cpu device for the throwaway instance — never webgpu at preload
        device: 'wasm',
        dtype: 'fp16', // match the run variant so the preload-warmed cache is reused (no re-download)
      } as Parameters<typeof mod.AutoModel.from_pretrained>[1])
      try { await (m as unknown as { dispose?: () => Promise<unknown> }).dispose?.() } catch { /* best-effort free */ }
      ctx.postMessage({ id, ok: true, preloaded: true })
    } catch (err) {
      ctx.postMessage({ id, ok: false, error: String((err as Error)?.message ?? err) })
    }
    return
  }
  try {
    const segmenter = await getSegmenter((state) => ctx.postMessage({ id, progress: state }))
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
    ctx.postMessage({ id, ok: true, data: rgba.buffer, width, height }, [rgba.buffer])
  } catch (err) {
    ctx.postMessage({ id, ok: false, error: String((err as Error)?.message ?? err) })
  }
}

export {}
