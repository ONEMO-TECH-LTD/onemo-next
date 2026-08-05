// cutout-ai — runtime loaders (ARCHITECTURE.md: the ONLY file that touches the two runtimes).
// Self-hosted ORT WebGPU build (same-origin /ort, WASM per-op fallback — Safari-safe, mirrors
// v5.3.1's ben.worker self-hosting) + @huggingface/transformers (already a repo dependency).

const ORT_BASE = '/ort/'

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface OrtSession { inputNames: string[]; outputNames: string[]; run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: Float32Array; dims: number[] }>> }
export interface OrtModule { InferenceSession: { create: (b: Uint8Array, o: unknown) => Promise<OrtSession> }; Tensor: new (t: string, d: Float32Array, dims: number[]) => unknown; env: { wasm: { wasmPaths: string; numThreads: number } } }

let ortP: Promise<OrtModule> | null = null
export const loadOrt = (): Promise<OrtModule> => (ortP ??= (async () => {
  const ort = await import(/* webpackIgnore: true */ `${ORT_BASE}ort.webgpu.min.mjs`) as unknown as OrtModule
  ort.env.wasm.wasmPaths = ORT_BASE
  ort.env.wasm.numThreads = 1 // threaded WASM deadlocks inside a Web Worker (v5.3.1 finding)
  return ort
})())

let txP: Promise<any> | null = null
export const loadTransformers = (): Promise<any> => (txP ??= import('@huggingface/transformers'))

/** Create an ORT session from a same-origin asset with the exec-appropriate providers. */
export async function ortSession(url: string, exec: 'auto' | 'wasm'): Promise<OrtSession> {
  const ort = await loadOrt()
  const eps = exec === 'wasm' ? ['wasm'] : ['webgpu', 'wasm']
  const buf = await (await fetch(url)).arrayBuffer()
  return ort.InferenceSession.create(new Uint8Array(buf), { executionProviders: eps })
}
