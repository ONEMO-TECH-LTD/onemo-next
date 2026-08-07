// cutout-ai — runtime loaders (ARCHITECTURE.md: the ONLY file that touches the runtime).
// ORT is self-hosted same-origin under /ort and PINNED to ben.worker's proven recipe: the
// pure-WASM build, single thread, ['wasm'] EPs — the config Dan's device proved for a full day
// (§I2d runtime-pin law; the webgpu-first probe was deleted after iOS rejected it: 'no backend').

const ORT_BASE = '/ort/'

 
export interface OrtSession { inputNames: string[]; outputNames: string[]; run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: Float32Array; dims: number[] }>> }
export interface OrtModule { InferenceSession: { create: (b: Uint8Array, o: unknown) => Promise<OrtSession> }; Tensor: new (t: string, d: Float32Array, dims: number[]) => unknown; env: { wasm: { wasmPaths: string; numThreads: number } } }

// RUNTIME PIN (meta verdict on Dan's device evidence): the brush uses ben.worker's EXACT proven
// recipe — the pure-WASM build, single thread, ['wasm'] EPs — everywhere, always. The old
// webgpu-first probe was a live grenade regardless of routing: the webgpu build's CPU fallback
// wants an asyncify artifact we don't ship, and iOS rejected the path as 'no backend'.
// Deleted, not parked.
type OrtKind = 'wasm'
export const ortKindFor = (_exec: 'auto' | 'wasm'): OrtKind => 'wasm'

const ortCache = new Map<OrtKind, Promise<OrtModule>>()
function loadOrtBuild(kind: OrtKind): Promise<OrtModule> {
  let p = ortCache.get(kind)
  if (!p) {
    p = (async () => {
      void kind // one kind exists — the pinned pure-WASM build (ben.worker's proven recipe)
      const ort = await import(/* webpackIgnore: true */ `${ORT_BASE}ort.wasm.min.mjs`) as unknown as OrtModule
      ort.env.wasm.wasmPaths = ORT_BASE
      ort.env.wasm.numThreads = 1 // threaded WASM deadlocks inside a Web Worker (v5.3.1 finding)
      return ort
    })()
    p.catch(() => ortCache.delete(kind))
    ortCache.set(kind, p)
  }
  return p
}

// The kind that actually produced a working session in this context. `navigator.gpu` existing does
// NOT guarantee a usable adapter (headless/older GPUs), and some models (EdgeSAM) can't build a
// session on the webgpu build's CPU fallback — so session creation itself is the probe, and every
// later Tensor comes from the SAME build that succeeded.
let resolvedKind: OrtKind | null = null

/** The ORT module matching the resolved session build — model subs create tensors from THIS. */
export const ortFor = (exec: 'auto' | 'wasm'): Promise<OrtModule> => loadOrtBuild(resolvedKind ?? ortKindFor(exec))

/** Streamed same-origin fetch with byte progress (models are 15–45MB — the first-load wait must be
 *  visible, not a silent hang). */
export async function fetchWithProgress(url: string, onProgress?: (loaded: number, total: number) => void): Promise<Uint8Array> {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`fetch ${url}: ${resp.status}`)
  const total = Number(resp.headers.get('content-length')) || 0
  if (!resp.body || !onProgress || !total) return new Uint8Array(await resp.arrayBuffer())
  const reader = resp.body.getReader()
  const out = new Uint8Array(total)
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    out.set(value, loaded); loaded += value.length
    onProgress(loaded, total)
  }
  return loaded === total ? out : out.slice(0, loaded)
}

/** Create an ORT session from a same-origin asset — the PINNED pure-WASM recipe, always. */
export async function ortSession(url: string, _exec: 'auto' | 'wasm', onProgress?: (loaded: number, total: number) => void): Promise<OrtSession> {
  const buf = await fetchWithProgress(url, onProgress)
  const ort = await loadOrtBuild('wasm')
  const s = await ort.InferenceSession.create(buf, { executionProviders: ['wasm'] })
  resolvedKind = 'wasm'
  return s
}
