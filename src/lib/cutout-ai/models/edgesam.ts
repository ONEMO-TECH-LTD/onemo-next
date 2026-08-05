// cutout-ai model sub — EdgeSAM via raw onnxruntime-web. Implements SegModel.
// Verified s62 I/O: encoder takes preprocessed CHW [1,3,1024,1024] → prompt coords ×scale into the
// 1024 space; decoder is the simple interface (image_embeddings, point_coords, point_labels →
// scores, masks at low res → upscale).

/* eslint-disable @typescript-eslint/no-explicit-any */
import { samCHW, logitsToMask } from '../preprocess'
import { ortFor, ortKindFor, ortSession, type OrtSession } from '../runtime'
import { pickMask } from '../select'
import type { Exec, Frame, Mask, Point, SegModel, SegModelConfig } from '../types'

export class EdgeSamModel implements SegModel {
  private enc: OrtSession | null = null
  private dec: OrtSession | null = null
  private emb: any = null
  private scale = 1
  private W = 1
  private H = 1
  private exec: Exec = 'auto'

  async load(cfg: SegModelConfig, exec: Exec): Promise<string> {
    this.exec = exec
    this.enc = await ortSession(cfg.enc!, exec)
    this.dec = await ortSession(cfg.dec!, exec)
    return ortKindFor(exec)
  }

  async encode(frame: Frame): Promise<void> {
    const ort = await ortFor(this.exec)
    this.W = frame.w; this.H = frame.h
    const pre = samCHW(frame.rgba, frame.w, frame.h)
    this.scale = pre.scale
    const r = await this.enc!.run({ [this.enc!.inputNames[0]]: new ort.Tensor('float32', pre.data, pre.dims) })
    this.emb = r[this.enc!.outputNames[0]]
  }

  async segment(points: Point[], auto: boolean): Promise<Mask> {
    const ort = await ortFor(this.exec)
    const W = this.W, H = this.H, plane = W * H
    const pc: number[] = [], pl: number[] = []
    for (const q of points) { pc.push(q.x * W * this.scale, q.y * H * this.scale); pl.push(q.label) }
    const nP = pl.length
    const r = await this.dec!.run({
      image_embeddings: this.emb,
      point_coords: new ort.Tensor('float32', Float32Array.from(pc), [1, nP, 2]),
      point_labels: new ort.Tensor('float32', Float32Array.from(pl), [1, nP]),
    })
    const mout = r['masks'], sc = r['scores'] || r['iou_predictions']
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
