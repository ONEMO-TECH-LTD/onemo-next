// BEN2-ONNX background-removal — Web Worker (Lane A / Kai · §8.3)
//
// The ML inference (BEN2-ONNX via transformers.js, webgpu→wasm) is the 30–60s blocking step.
// It runs HERE, off the main thread, so the UI stays responsive (Magic no longer freezes — §8.4).
//
// Split (Option A — DOM stays on main): this worker runs ONLY the transformers pipeline and posts
// back the full-res RGBA RawImage buffer (alpha = subject matte) + dims. The main-thread `segmentML`
// wrapper (segment-ml.ts) does the canvas rasterize/downscale + alpha→mask (workers have no DOM).
// Buffer is transferred (zero-copy hand-off).

const MODEL_ID = 'onnx-community/BEN2-ONNX'

// Worker global — typed loosely to avoid DOM/WebWorker lib conflicts in the shared tsconfig.
const ctx: { onmessage: ((e: MessageEvent) => void) | null; postMessage: (msg: unknown, transfer?: Transferable[]) => void } =
  self as unknown as typeof ctx

// Lazy, cached: one pipeline per worker lifetime (mirrors the old main-thread cache).
let segmenterPromise: Promise<(input: string[]) => Promise<unknown>> | null = null
function getSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const mod = await import('@huggingface/transformers')
      mod.env.allowLocalModels = false // fetch weights from the HF hub
      let seg
      try {
        seg = await mod.pipeline('background-removal', MODEL_ID, { device: 'webgpu' })
      } catch {
        seg = await mod.pipeline('background-removal', MODEL_ID) // wasm fallback
      }
      return seg as unknown as (input: string[]) => Promise<unknown>
    })()
  }
  return segmenterPromise
}

interface RawImageData {
  data: Uint8ClampedArray | Uint8Array
  width: number
  height: number
  channels: number
}

ctx.onmessage = async (e: MessageEvent<{ id: number; url: string }>) => {
  const { id, url } = e.data
  try {
    const segmenter = await getSegmenter()
    const result = (await segmenter([url])) as RawImageData[] | RawImageData
    const raw = (Array.isArray(result) ? result[0] : result) as RawImageData
    if (!raw?.data) throw new Error('BEN2 returned no image data')
    const { width, height, channels } = raw
    // Normalize to RGBA (ImageData layout) in a fresh standalone buffer (so it transfers cleanly).
    const rgba = new Uint8ClampedArray(width * height * 4)
    if (channels === 4) {
      rgba.set(raw.data)
    } else {
      for (let p = 0, s = 0, d = 0; p < width * height; p++, s += channels, d += 4) {
        rgba[d] = raw.data[s]
        rgba[d + 1] = raw.data[s + 1] ?? raw.data[s]
        rgba[d + 2] = raw.data[s + 2] ?? raw.data[s]
        rgba[d + 3] = 255
      }
    }
    ctx.postMessage({ id, ok: true, data: rgba.buffer, width, height }, [rgba.buffer])
  } catch (err) {
    ctx.postMessage({ id, ok: false, error: String((err as Error)?.message ?? err) })
  }
}

export {}
