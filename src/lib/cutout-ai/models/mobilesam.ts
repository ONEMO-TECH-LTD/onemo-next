// cutout-ai model sub — MobileSAM via raw onnxruntime-web. Implements SegModel.
// Verified s62 I/O: encoder takes the RAW image HWC [H,W,3] (preprocessing baked in) → prompt
// coords in ORIGINAL space; decoder is the standard SAM interface (padding point, mask_input,
// has_mask_input, orig_im_size → masks at original res).

/* eslint-disable @typescript-eslint/no-explicit-any */
import { samHWC, logitsToMask } from '../preprocess'
import { loadOrt, ortSession, type OrtSession } from '../runtime'
import { pickMask } from '../select'
import type { Exec, Frame, Mask, Point, SegModel, SegModelConfig } from '../types'

export class MobileSamModel implements SegModel {
  private enc: OrtSession | null = null
  private dec: OrtSession | null = null
  private emb: any = null
  private W = 1
  private H = 1

  async load(cfg: SegModelConfig, exec: Exec): Promise<string> {
    this.enc = await ortSession(cfg.enc!, exec)
    this.dec = await ortSession(cfg.dec!, exec)
    return exec === 'wasm' ? 'wasm' : 'webgpu'
  }

  async encode(frame: Frame): Promise<void> {
    const ort = await loadOrt()
    this.W = frame.w; this.H = frame.h
    const pre = samHWC(frame.rgba, frame.w, frame.h)
    const r = await this.enc!.run({ [this.enc!.inputNames[0]]: new ort.Tensor('float32', pre.data, pre.dims) })
    this.emb = r[this.enc!.outputNames[0]]
  }

  async segment(points: Point[], auto: boolean): Promise<Mask> {
    const ort = await loadOrt()
    const W = this.W, H = this.H, plane = W * H
    const pc: number[] = [], pl: number[] = []
    for (const q of points) { pc.push(q.x * W, q.y * H); pl.push(q.label) }
    pc.push(0, 0); pl.push(-1) // standard SAM padding-point convention
    const nP = pl.length
    const r = await this.dec!.run({
      image_embeddings: this.emb,
      point_coords: new ort.Tensor('float32', Float32Array.from(pc), [1, nP, 2]),
      point_labels: new ort.Tensor('float32', Float32Array.from(pl), [1, nP]),
      mask_input: new ort.Tensor('float32', new Float32Array(256 * 256), [1, 1, 256, 256]),
      has_mask_input: new ort.Tensor('float32', Float32Array.from([0]), [1]),
      orig_im_size: new ort.Tensor('float32', Float32Array.from([H, W]), [2]),
    })
    const mout = r['masks'], sc = r['iou_predictions']
    const dims = mout.dims, data = mout.data
    const num = dims.length === 4 ? dims[1] : 1, mh = dims[dims.length - 2], mw = dims[dims.length - 1], mp = mh * mw
    const areas: number[] = [], scores = sc ? Array.from(sc.data) : []
    for (let i = 0; i < num; i++) { let a = 0; for (let k = 0; k < mp; k++) if (data[i * mp + k] > 0) a++; areas.push(a); if (scores[i] == null) scores[i] = 0 }
    const best = pickMask(areas, scores as number[], mp, auto)
    const sub = data.subarray(best * mp, best * mp + mp)
    if (mh === H && mw === W) { const out = new Uint8Array(plane); for (let i = 0; i < plane; i++) out[i] = sub[i] > 0 ? 1 : 0; return { data: out, w: W, h: H } }
    return { data: logitsToMask(sub, mh, mw, W, H), w: W, h: H }
  }
}
