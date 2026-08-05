// cutout-ai model sub — SlimSAM-77/50 via transformers.js SamModel. Implements SegModel.
// Verified s62 path: auto → fp16/webgpu, fallback q8/wasm; prompt coords in reshaped-input space.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadTransformers } from '../runtime'
import { pickMask } from '../select'
import type { Exec, Frame, Mask, Point, SegModel, SegModelConfig } from '../types'

export class SlimSamModel implements SegModel {
  private model: any = null
  private proc: any = null
  private inputs: any = null
  private emb: any = null
  private W = 1
  private H = 1

  async load(cfg: SegModelConfig, exec: Exec, onProgress?: (loaded: number, total: number) => void): Promise<string> {
    const tx = await loadTransformers()
    const progress_callback = (p: any) => { if (p?.status === 'progress' && p.total) onProgress?.(p.loaded ?? 0, p.total) }
    let device = 'wasm'
    if (exec === 'auto') {
      try { this.model = await tx.SamModel.from_pretrained(cfg.id, { dtype: 'fp16', device: 'webgpu', progress_callback }); device = 'webgpu' }
      catch { this.model = await tx.SamModel.from_pretrained(cfg.id, { dtype: 'q8', device: 'wasm', progress_callback }) }
    } else {
      try { this.model = await tx.SamModel.from_pretrained(cfg.id, { dtype: 'q8', device: 'wasm', progress_callback }) }
      catch { this.model = await tx.SamModel.from_pretrained(cfg.id, { dtype: 'fp32', device: 'wasm', progress_callback }) }
    }
    this.proc = await tx.AutoProcessor.from_pretrained(cfg.id)
    return device
  }

  async encode(frame: Frame): Promise<void> {
    const tx = await loadTransformers()
    this.W = frame.w; this.H = frame.h
    const raw = new tx.RawImage(frame.rgba, frame.w, frame.h, 4).rgb()
    this.inputs = await this.proc(raw)
    this.emb = await this.model.get_image_embeddings(this.inputs)
  }

  async segment(points: Point[], auto: boolean): Promise<Mask> {
    const tx = await loadTransformers()
    const rs = this.inputs.reshaped_input_sizes[0]
    const pts = points.map((q) => [q.x * rs[1], q.y * rs[0]])
    const out = await this.model({
      ...this.emb,
      input_points: new tx.Tensor('float32', pts.flat(Infinity), [1, 1, pts.length, 2]),
      input_labels: new tx.Tensor('int64', points.map((q) => BigInt(q.label)), [1, 1, pts.length]),
    })
    const masks = await this.proc.post_process_masks(out.pred_masks, this.inputs.original_sizes, this.inputs.reshaped_input_sizes)
    const m = masks[0]; const [, n, mh, mw] = m.dims as number[]; const src = m.data as Uint8Array, mp = mh * mw
    const areas: number[] = [], scores = Array.from(out.iou_scores.data as Float32Array)
    for (let i = 0; i < n; i++) { let a = 0; for (let k = 0; k < mp; k++) a += src[i * mp + k]; areas.push(a) }
    const best = pickMask(areas, scores, mp, auto), off = best * mp
    const plane = this.W * this.H
    const data = new Uint8Array(plane); for (let i = 0; i < plane; i++) data[i] = src[off + i]
    return { data, w: this.W, h: this.H }
  }
}
