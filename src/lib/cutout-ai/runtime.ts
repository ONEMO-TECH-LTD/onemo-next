// cutout-ai — runtime loaders (ARCHITECTURE.md: the ONLY file that touches the two runtimes).
// ORT is self-hosted same-origin under /ort (mirrors v5.3.1's ben.worker). The BUILD is picked by
// what the context actually has: the WebGPU (jsep) build only when WebGPU exists AND exec allows
// it; otherwise the pure-WASM build (its CPU artifacts are the ones we host — the webgpu build's
// CPU fallback wants an asyncify artifact we don't ship, verified failing in no-GPU Chromium).

const ORT_BASE = '/ort/'

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface OrtSession { inputNames: string[]; outputNames: string[]; run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: Float32Array; dims: number[] }>> }
export interface OrtModule { InferenceSession: { create: (b: Uint8Array, o: unknown) => Promise<OrtSession> }; Tensor: new (t: string, d: Float32Array, dims: number[]) => unknown; env: { wasm: { wasmPaths: string; numThreads: number } } }

type OrtKind = 'webgpu' | 'wasm'
const hasWebGPU = (): boolean => typeof navigator !== 'undefined' && !!(navigator as any).gpu
export const ortKindFor = (exec: 'auto' | 'wasm'): OrtKind => (exec === 'wasm' || !hasWebGPU() ? 'wasm' : 'webgpu')

/** navigator.gpu existing ≠ a usable adapter (headless, or a memory-pressured iOS tab). Probe the
 *  REAL adapter once so we never instantiate the webgpu build just to watch it fail into its
 *  heavier CPU fallback — on iPhone that double-runtime churn was itself the OOM amplifier. */
let adapterOk: boolean | null = null
async function webgpuUsable(): Promise<boolean> {
  if (adapterOk !== null) return adapterOk
  try { adapterOk = !!(await (navigator as any).gpu?.requestAdapter?.()) } catch { adapterOk = false }
  return adapterOk!
}

const ortCache = new Map<OrtKind, Promise<OrtModule>>()
function loadOrtBuild(kind: OrtKind): Promise<OrtModule> {
  let p = ortCache.get(kind)
  if (!p) {
    p = (async () => {
      const file = kind === 'webgpu' ? 'ort.webgpu.min.mjs' : 'ort.wasm.min.mjs'
      const ort = await import(/* webpackIgnore: true */ `${ORT_BASE}${file}`) as unknown as OrtModule
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

let txP: Promise<any> | null = null
export const loadTransformers = (): Promise<any> => (txP ??= import('@huggingface/transformers'))

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

/** Create an ORT session from a same-origin asset: preferred build first, pure-WASM fallback. */
export async function ortSession(url: string, exec: 'auto' | 'wasm', onProgress?: (loaded: number, total: number) => void): Promise<OrtSession> {
  const buf = await fetchWithProgress(url, onProgress)
  const create = async (kind: OrtKind) => {
    const ort = await loadOrtBuild(kind)
    const s = await ort.InferenceSession.create(buf, { executionProviders: kind === 'webgpu' ? ['webgpu', 'wasm'] : ['wasm'] })
    resolvedKind = kind
    return s
  }
  let kind = resolvedKind ?? ortKindFor(exec)
  if (kind === 'webgpu' && !(await webgpuUsable())) kind = 'wasm' // real adapter probe, not just the API
  if (kind === 'wasm') return create('wasm')
  try { return await create('webgpu') } catch { return create('wasm') }
}
