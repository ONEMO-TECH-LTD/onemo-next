// cutout-ai — main-thread client (ARCHITECTURE.md: plumbing only). Fresh worker per model spawn
// gives true cold-start load timing. Promise per id-matched message.

import type { Exec, Mask, Point, SegModelConfig } from './types'

export interface MaskReply { mask: Mask; ms: number }

/* eslint-disable @typescript-eslint/no-explicit-any */
export class CutoutClient {
  private worker: Worker | null = null
  private pending = new Map<number, (v: any) => void>()
  private nextId = 1
  onError: ((msg: string) => void) | null = null

  /** (Re)spawn a fresh worker — call before loading a model to measure it cold. */
  spawn(): void {
    this.worker?.terminate(); this.pending.clear()
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (e) => { const r = this.pending.get(e.data.id); if (r) { this.pending.delete(e.data.id); r(e.data) } }
    w.onerror = (ev) => this.onError?.(ev.message)
    this.worker = w
  }

  private call(msg: any, transfer?: Transferable[]): Promise<any> {
    return new Promise((res) => { const id = this.nextId++; this.pending.set(id, res); this.worker!.postMessage({ ...msg, id }, transfer || []) })
  }

  private async maskCall(msg: any): Promise<MaskReply> {
    const r = await this.call(msg)
    if (r.type === 'error') throw new Error(r.error)
    return { mask: { data: new Uint8Array(r.mask), w: r.w, h: r.h }, ms: r.ms }
  }

  async load(cfg: SegModelConfig, exec: Exec): Promise<{ device: string; ms: number }> {
    const r = await this.call({ type: 'load', cfg, exec })
    if (r.type === 'error') throw new Error(r.error)
    return { device: r.device, ms: r.ms }
  }

  async encode(rgba: Uint8ClampedArray, w: number, h: number): Promise<{ ms: number }> {
    const buf = rgba.buffer.slice(0) // caller keeps its pixels; transfer the copy
    const r = await this.call({ type: 'encode', data: buf, w, h }, [buf])
    if (r.type === 'error') throw new Error(r.error)
    return { ms: r.ms }
  }

  redetect(): Promise<MaskReply> { return this.maskCall({ type: 'redetect' }) }
  addStroke(stroke: Point[]): Promise<MaskReply> { return this.maskCall({ type: 'add', stroke }) }
  eraseStroke(stroke: Point[]): Promise<MaskReply> { return this.maskCall({ type: 'erase', stroke }) }

  dispose(): void { this.worker?.terminate(); this.worker = null }
}
