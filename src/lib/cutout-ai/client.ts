// cutout-ai — main-thread client (ARCHITECTURE.md: plumbing only). Fresh worker per model spawn
// gives true cold-start load timing. Promise per id-matched message.

import type { Exec, Mask, Point, SegModelConfig } from './types'

export interface MaskReply { mask: Mask; ms: number }

/* eslint-disable @typescript-eslint/no-explicit-any */
export class CutoutClient {
  private worker: Worker | null = null
  private pending = new Map<number, (v: any) => void>()
  private kick = new Map<number, () => void>() // watchdog re-arm per in-flight call (progress = alive)
  private nextId = 1
  onError: ((msg: string) => void) | null = null
  onProgress: ((loaded: number, total: number) => void) | null = null

  /** (Re)spawn a fresh worker — call before loading a model to measure it cold. */
  spawn(): void {
    this.worker?.terminate(); this.pending.clear()
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (e) => {
      if (e.data.type === 'progress') { this.kick.get(e.data.id)?.(); this.onProgress?.(e.data.loaded, e.data.total); return }
      const r = this.pending.get(e.data.id); if (r) { this.pending.delete(e.data.id); this.kick.delete(e.data.id); r(e.data) }
    }
    w.onerror = (ev) => this.onError?.(ev.message)
    this.worker = w
  }

  /** Watchdog (iOS: a WASM OOM can freeze the worker WITHOUT throwing — the hang must become a
   *  registered fault). A call that outlives its deadline kills the worker and rejects. */
  private call(msg: any, transfer?: Transferable[], timeoutMs = 60000): Promise<any> {
    return new Promise((res, rej) => {
      const id = this.nextId++
      let watchdog: ReturnType<typeof setTimeout>
      const arm = () => {
        clearTimeout(watchdog)
        watchdog = setTimeout(() => {
          if (!this.pending.has(id)) return
          this.pending.delete(id); this.kick.delete(id)
          this.worker?.terminate(); this.worker = null
          rej(new Error('brush AI froze (watchdog) — worker terminated'))
        }, timeoutMs)
      }
      arm()
      this.kick.set(id, arm) // download progress = alive → re-arm
      this.pending.set(id, (v) => { clearTimeout(watchdog); res(v) })
      this.worker!.postMessage({ ...msg, id }, transfer || [])
    })
  }

  private async maskCall(msg: any): Promise<MaskReply> {
    const r = await this.call(msg)
    if (r.type === 'error') throw new Error(r.error)
    return { mask: { data: new Uint8Array(r.mask), w: r.w, h: r.h, soft: r.soft ? new Uint8Array(r.soft) : undefined }, ms: r.ms }
  }

  async load(cfg: SegModelConfig, exec: Exec): Promise<{ device: string; ms: number }> {
    const r = await this.call({ type: 'load', cfg, exec }, undefined, 180000) // download + init
    if (r.type === 'error') throw new Error(r.error)
    return { device: r.device, ms: r.ms }
  }

  async encode(rgba: Uint8ClampedArray, w: number, h: number): Promise<{ ms: number }> {
    const buf = rgba.buffer.slice(0) // caller keeps its pixels; transfer the copy
    const r = await this.call({ type: 'encode', data: buf, w, h }, [buf])
    if (r.type === 'error') throw new Error(r.error)
    return { ms: r.ms }
  }

  /** Seed the brush base with an external mask (copy is transferred; caller keeps its data). */
  async setBase(mask: Mask): Promise<void> {
    const buf = mask.data.slice().buffer
    const r = await this.call({ type: 'setBase', mask: buf, w: mask.w, h: mask.h }, [buf])
    if (r.type === 'error') throw new Error(r.error)
  }

  redetect(): Promise<MaskReply> { return this.maskCall({ type: 'redetect' }) }
  addStroke(stroke: Point[]): Promise<MaskReply> { return this.maskCall({ type: 'add', stroke }) }
  eraseStroke(stroke: Point[]): Promise<MaskReply> { return this.maskCall({ type: 'erase', stroke }) }

  dispose(): void { this.worker?.terminate(); this.worker = null }
}
