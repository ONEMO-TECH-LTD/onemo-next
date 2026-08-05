// cutout-ai — worker transport (ARCHITECTURE.md: plumbing only). Instantiates the requested model
// sub, wires the brush session to it, and moves messages. Every op returns the current mask + ms.

import { BrushSession } from './brush'
import { EdgeSamModel } from './models/edgesam'
import { MobileSamModel } from './models/mobilesam'
import { Sam2Model } from './models/sam2'
import { SlimSamModel } from './models/slimsam'
import type { Mask, SegModel, SegModelConfig } from './types'

const SUBS: Record<SegModelConfig['sub'], new () => SegModel> = {
  slimsam: SlimSamModel,
  sam2: Sam2Model,
  mobilesam: MobileSamModel,
  edgesam: EdgeSamModel,
}

let model: SegModel | null = null
let brush: BrushSession | null = null

const ctx = self as unknown as { onmessage: ((e: MessageEvent) => void) | null; postMessage: (m: unknown, t?: Transferable[]) => void }
const post = (m: unknown, t?: Transferable[]) => ctx.postMessage(m, t || [])
const postMask = (id: number, type: string, mask: Mask, t0: number) => {
  const copy = mask.data.slice() // the brush keeps its base; transfer a copy
  post({ type, id, mask: copy.buffer, w: mask.w, h: mask.h, ms: Math.round(performance.now() - t0) }, [copy.buffer])
}

ctx.onmessage = async (e: MessageEvent) => {
  const d = e.data
  try {
    const t0 = performance.now()
    if (d.type === 'load') {
      const cfg = d.cfg as SegModelConfig
      model = new SUBS[cfg.sub]()
      brush = new BrushSession((pts, auto) => model!.segment(pts, auto))
      const device = await model.load(cfg, d.exec)
      post({ type: 'loaded', id: d.id, device, ms: Math.round(performance.now() - t0) })
    } else if (d.type === 'encode') {
      brush!.reset()
      await model!.encode({ rgba: new Uint8ClampedArray(d.data), w: d.w, h: d.h })
      post({ type: 'encoded', id: d.id, ms: Math.round(performance.now() - t0) })
    } else if (d.type === 'redetect') {
      postMask(d.id, 'mask', await brush!.redetect(), t0)
    } else if (d.type === 'add') {
      postMask(d.id, 'mask', await brush!.addStroke(d.stroke), t0)
    } else if (d.type === 'erase') {
      postMask(d.id, 'mask', await brush!.eraseStroke(d.stroke), t0)
    }
  } catch (err) {
    post({ type: 'error', id: d?.id, stage: d?.type, error: String((err as Error)?.message ?? err) })
  }
}

export {}
