// Multi-backend segmentation worker (s62 probe) — runs every candidate model OFF the main thread so
// mobile Safari (WASM) never freezes. Main thread decodes the image (Safari-safe) and passes raw RGBA.
// Backends:
//   • sam-tjs  — transformers.js SamModel (SlimSAM-77/50)          [promptable]
//   • sam2-tjs — transformers.js Sam2Model (SAM2-tiny)            [promptable]
//   • sam-onnx — raw onnxruntime-web encoder+decoder (MobileSAM/EdgeSAM) [promptable]
//   • u2net    — raw onnxruntime-web salient-object matte (u2netp/silueta, the v5.3.1 models) [AUTO]
// Returns a binary Uint8Array mask at the original W×H for all backends → the page finishes it
// (clean → simplify(Detail) → offset(Offset)) and renders.

// ── self-hosted onnxruntime-web (same-origin /ort, WASM EP, single-thread — Safari-safe) ─────────
const ORT_BASE = '/ort/'
let ortP: Promise<any> | null = null
const ORT = () => (ortP ??= (async () => {
  const ort = await import(/* webpackIgnore: true */ `${ORT_BASE}ort.wasm.min.mjs`) as any
  ort.env.wasm.wasmPaths = ORT_BASE; ort.env.wasm.numThreads = 1
  return ort
})())
let txP: Promise<typeof import('@huggingface/transformers')> | null = null
const TX = () => (txP ??= import('@huggingface/transformers'))

type Cfg = { kind: string; id?: string; enc?: string; dec?: string; onnx?: string; size?: number; mean?: number[]; std?: number[]; exec?: string }
let cfg: Cfg | null = null
// transformers.js state
let tModel: any = null, tProc: any = null, tInputs: any = null, tEmb: any = null
// raw-onnx SAM state
let encS: any = null, decS: any = null, samEmb: any = null, samScale = 1
// u2net state
let u2S: any = null, u2Mask: Uint8Array | null = null
let dimW = 1, dimH = 1

const ctx = self as unknown as { onmessage: ((e: MessageEvent) => void) | null; postMessage: (m: unknown, t?: Transferable[]) => void }
const post = (m: unknown, t?: Transferable[]) => ctx.postMessage(m, t || [])

// nearest-neighbour resize of RGBA → normalized CHW float32 [1,3,S,S] (stretched square, for u2net)
function chwSquare(rgba: Uint8ClampedArray, W: number, H: number, S: number, mean: number[], std: number[], divMax: boolean, Tensor: any) {
  const plane = S * S, out = new Float32Array(3 * plane)
  let mx = 1
  if (divMax) for (let i = 0; i < rgba.length; i += 4) { if (rgba[i] > mx) mx = rgba[i]; if (rgba[i + 1] > mx) mx = rgba[i + 1]; if (rgba[i + 2] > mx) mx = rgba[i + 2] }
  else mx = 255
  for (let y = 0; y < S; y++) { const sy = Math.min(H - 1, (y * H / S) | 0); for (let x = 0; x < S; x++) { const sx = Math.min(W - 1, (x * W / S) | 0), si = (sy * W + sx) * 4, di = y * S + x; out[di] = ((rgba[si] / mx) - mean[0]) / std[0]; out[plane + di] = ((rgba[si + 1] / mx) - mean[1]) / std[1]; out[2 * plane + di] = ((rgba[si + 2] / mx) - mean[2]) / std[2] } }
  return new Tensor('float32', out, [1, 3, S, S])
}
// SAM preprocessing: aspect-preserve resize longest→1024, zero-pad, normalize → [1,3,1024,1024]; returns scale
function chwSam(rgba: Uint8ClampedArray, W: number, H: number, Tensor: any) {
  const T = 1024, scale = T / Math.max(W, H), nw = Math.round(W * scale), nh = Math.round(H * scale)
  const mean = [123.675, 116.28, 103.53], std = [58.395, 57.12, 57.375], plane = T * T, out = new Float32Array(3 * plane)
  for (let y = 0; y < nh; y++) { const sy = Math.min(H - 1, (y / scale) | 0); for (let x = 0; x < nw; x++) { const sx = Math.min(W - 1, (x / scale) | 0), si = (sy * W + sx) * 4, di = y * T + x; out[di] = (rgba[si] - mean[0]) / std[0]; out[plane + di] = (rgba[si + 1] - mean[1]) / std[1]; out[2 * plane + di] = (rgba[si + 2] - mean[2]) / std[2] } }
  return { tensor: new Tensor('float32', out, [1, 3, T, T]), scale }
}
// upscale a low-res logit mask (mh×mw) → binary Uint8 at W×H (threshold > 0)
function logitsToMask(data: Float32Array, mh: number, mw: number, W: number, H: number) {
  const out = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) { const sy = Math.min(mh - 1, (y * mh / H) | 0); for (let x = 0; x < W; x++) { const sx = Math.min(mw - 1, (x * mw / W) | 0); if (data[sy * mw + sx] > 0) out[y * W + x] = 1 } }
  return out
}
// pick a mask index: guided → best score; auto → largest valid area
function pickBest(areas: number[], scores: number[], guided: boolean, plane: number) {
  const n = areas.length
  if (guided) { let b = 0; for (let i = 1; i < n; i++) if (scores[i] > scores[b]) b = i; return b }
  let b = -1, ba = -1; for (let i = 0; i < n; i++) { const f = areas[i] / plane; if (f > 0.05 && f < 0.92 && areas[i] > ba) { ba = areas[i]; b = i } }
  if (b < 0) { b = 0; for (let i = 1; i < n; i++) if (scores[i] > scores[b]) b = i }
  return b
}

ctx.onmessage = async (e: MessageEvent) => {
  const d = e.data
  try {
    if (d.type === 'load') {
      cfg = d.cfg; const t0 = performance.now(); let device = 'wasm'
      tModel = tProc = tInputs = tEmb = encS = decS = samEmb = u2S = u2Mask = null
      if (cfg!.kind === 'sam-tjs' || cfg!.kind === 'sam2-tjs') {
        const tx = await TX(); const Cls: any = cfg!.kind === 'sam2-tjs' ? (tx as any).Sam2Model : tx.SamModel
        if (d.exec === 'auto') { try { tModel = await Cls.from_pretrained(cfg!.id, { dtype: 'fp16', device: 'webgpu' }); device = 'webgpu' } catch { tModel = await Cls.from_pretrained(cfg!.id, { dtype: 'q8', device: 'wasm' }); device = 'wasm' } }
        else { try { tModel = await Cls.from_pretrained(cfg!.id, { dtype: 'q8', device: 'wasm' }) } catch { tModel = await Cls.from_pretrained(cfg!.id, { dtype: 'fp32', device: 'wasm' }) }; device = 'wasm' }
        tProc = await tx.AutoProcessor.from_pretrained(cfg!.id)
      } else { // raw ONNX (sam-onnx | u2net)
        const ort = await ORT(); device = 'wasm'
        const mk = async (url: string) => ort.InferenceSession.create(new Uint8Array(await (await fetch(url)).arrayBuffer()), { executionProviders: ['wasm'] })
        if (cfg!.kind === 'sam-onnx') { encS = await mk(cfg!.enc!); decS = await mk(cfg!.dec!) }
        else { u2S = await mk(cfg!.onnx!) }
      }
      post({ type: 'loaded', id: d.id, device, ms: Math.round(performance.now() - t0) })

    } else if (d.type === 'encode') {
      const t0 = performance.now(); const rgba = new Uint8ClampedArray(d.data); dimW = d.W; dimH = d.H
      if (cfg!.kind === 'sam-tjs' || cfg!.kind === 'sam2-tjs') {
        const tx = await TX(); const raw = new tx.RawImage(rgba, d.W, d.H, 4).rgb()
        tInputs = await tProc(raw); tEmb = await tModel.get_image_embeddings(tInputs)
      } else if (cfg!.kind === 'sam-onnx') {
        const ort = await ORT(); const { tensor, scale } = chwSam(rgba, d.W, d.H, ort.Tensor); samScale = scale
        const r = await encS.run({ [encS.inputNames[0]]: tensor }); samEmb = r[encS.outputNames[0]]
      } else { // u2net auto — run the full matte here
        const ort = await ORT(); const S = cfg!.size || 320
        const t = chwSquare(rgba, d.W, d.H, S, cfg!.mean!, cfg!.std!, true, ort.Tensor)
        const r = await u2S.run({ [u2S.inputNames[0]]: t }); const od = r[u2S.outputNames[0]].data as Float32Array
        let lo = Infinity, hi = -Infinity; for (let i = 0; i < S * S; i++) { const v = od[i]; if (v < lo) lo = v; if (v > hi) hi = v } const rng = (hi - lo) || 1
        u2Mask = new Uint8Array(d.W * d.H)
        for (let y = 0; y < d.H; y++) { const sy = Math.min(S - 1, (y * S / d.H) | 0); for (let x = 0; x < d.W; x++) { const sx = Math.min(S - 1, (x * S / d.W) | 0); if (((od[sy * S + sx] - lo) / rng) > 0.5) u2Mask[y * d.W + x] = 1 } }
      }
      post({ type: 'encoded', id: d.id, W: d.W, H: d.H, ms: Math.round(performance.now() - t0) })

    } else if (d.type === 'decode') {
      const t0 = performance.now(); const W = dimW, H = dimH, plane = W * H
      let mask: Uint8Array
      if (cfg!.kind === 'u2net') {
        mask = u2Mask ? u2Mask.slice() : new Uint8Array(plane) // AUTO: prompts ignored
      } else if (cfg!.kind === 'sam-tjs' || cfg!.kind === 'sam2-tjs') {
        const tx = await TX(); const rs = tInputs.reshaped_input_sizes[0]
        const pts = d.points.map((q: any) => [q.x * rs[1], q.y * rs[0]])
        const feeds: any = { ...tEmb, input_points: new tx.Tensor('float32', pts.flat(Infinity), [1, 1, pts.length, 2]), input_labels: new tx.Tensor('int64', d.labels.map((l: number) => BigInt(l)), [1, 1, pts.length]) }
        const out = await tModel(feeds)
        const masks = await tProc.post_process_masks(out.pred_masks, tInputs.original_sizes, tInputs.reshaped_input_sizes)
        const m = masks[0]; const [, n, mh, mw] = m.dims as number[]; const src = m.data as Uint8Array
        const areas: number[] = [], scores = Array.from(out.iou_scores.data as Float32Array)
        for (let i = 0; i < n; i++) { let a = 0; for (let k = 0; k < mh * mw; k++) a += src[i * mh * mw + k]; areas.push(a) }
        const best = pickBest(areas, scores, d.guided, mh * mw), off = best * mh * mw
        mask = new Uint8Array(plane); for (let i = 0; i < plane; i++) mask[i] = src[off + i]
      } else { // sam-onnx (MobileSAM / EdgeSAM)
        const ort = await ORT()
        const pc: number[] = [], pl: number[] = []
        for (const q of d.points) { pc.push(q.x * W * samScale, q.y * H * samScale) }
        for (const l of d.labels) pl.push(l)
        const hasMaskInput = decS.inputNames.includes('mask_input')
        if (hasMaskInput) { pc.push(0, 0); pl.push(-1) } // SAM padding-point convention (MobileSAM)
        const nP = pl.length
        const feeds: any = { image_embeddings: samEmb, point_coords: new ort.Tensor('float32', Float32Array.from(pc), [1, nP, 2]), point_labels: new ort.Tensor('float32', Float32Array.from(pl), [1, nP]) }
        if (hasMaskInput) { feeds.mask_input = new ort.Tensor('float32', new Float32Array(256 * 256), [1, 1, 256, 256]); feeds.has_mask_input = new ort.Tensor('float32', Float32Array.from([0]), [1]); feeds.orig_im_size = new ort.Tensor('float32', Float32Array.from([H, W]), [2]) }
        const r = await decS.run(feeds)
        const mout = r['masks']; const sc = r['iou_predictions'] || r['scores']
        const dims = mout.dims as number[], data = mout.data as Float32Array
        const num = dims.length === 4 ? dims[1] : 1, mh = dims[dims.length - 2], mw = dims[dims.length - 1], mp = mh * mw
        const areas: number[] = [], scores = sc ? Array.from(sc.data as Float32Array) : []
        for (let i = 0; i < num; i++) { let a = 0; for (let k = 0; k < mp; k++) if (data[i * mp + k] > 0) a++; areas.push(a); if (!scores[i]) scores[i] = 0 }
        const best = pickBest(areas, scores, d.guided, mp)
        mask = (mh === H && mw === W) ? (() => { const o = new Uint8Array(plane); const off = best * mp; for (let i = 0; i < plane; i++) o[i] = data[off + i] > 0 ? 1 : 0; return o })() : logitsToMask(data.subarray(best * mp, best * mp + mp), mh, mw, W, H)
      }
      post({ type: 'decoded', id: d.id, mask: mask.buffer, W, H, ms: Math.round(performance.now() - t0) }, [mask.buffer])
    }
  } catch (err) {
    post({ type: 'error', id: d?.id, stage: d?.type, error: String((err as Error)?.message ?? err) })
  }
}

export {}
