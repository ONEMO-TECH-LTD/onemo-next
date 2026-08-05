// cutout-ai — data types + the one SegModel interface (ARCHITECTURE.md). No runtime, no DOM.

/** Binary mask, row-major, length w*h. 1 = object, 0 = background. `soft` (optional) is the
 *  CONTINUOUS alpha (0-255) from the model's logits — the engine-parity matte channel: v5.3.1's
 *  compositing expects a soft matte, never a hard binary cut. */
export interface Mask {
  data: Uint8Array
  w: number
  h: number
  soft?: Uint8Array
}

/** Normalized prompt point (0..1 in image space). label 1 = include, 0 = exclude. */
export interface Point {
  x: number
  y: number
  label: 0 | 1
}

/** RGBA pixels at the bounded working resolution. */
export interface Frame {
  rgba: Uint8ClampedArray
  w: number
  h: number
}

export type Exec = 'auto' | 'wasm' // auto = WebGPU→WASM fallback; wasm = force CPU (Safari path)

/** Static description of a model sub — registry data only. */
export interface SegModelConfig {
  key: string
  label: string
  /** which sub implements it (models/<sub>.ts) */
  sub: 'edgesam'
  /** transformers.js hub id (slimsam / sam2) */
  id?: string
  /** raw-ORT asset urls (mobilesam / edgesam) */
  enc?: string
  dec?: string
}

/** The ONE interface every model sub implements (ARCHITECTURE.md). */
export interface SegModel {
  /** cold-start load; resolves the actual device label (e.g. 'webgpu' | 'wasm').
   *  `onProgress` reports model download bytes (loaded, total) so first load is never a silent hang. */
  load(cfg: SegModelConfig, exec: Exec, onProgress?: (loaded: number, total: number) => void): Promise<string>
  /** once per image. */
  encode(frame: Frame): Promise<void>
  /** prompt → binary mask at frame resolution. `auto` = pick the whole object. */
  segment(points: Point[], auto: boolean): Promise<Mask>
}
