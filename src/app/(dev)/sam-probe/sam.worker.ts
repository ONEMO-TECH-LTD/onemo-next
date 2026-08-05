// SAM inference worker (s62 probe) — runs the heavy segmentation OFF the main thread so mobile Safari
// (WASM, slow encode) doesn't freeze the tab. Main thread owns the light geometry + rendering.
// Safari-safe: the image is decoded on the MAIN thread (<img>→canvas) and raw RGBA pixels are handed
// here — NO createImageBitmap / RawImage.read / OffscreenCanvas (all Safari-fragile) on either side.

let txP: Promise<typeof import('@huggingface/transformers')> | null = null
const TX = () => (txP ??= import('@huggingface/transformers'))

let model: any = null, processor: any = null, inputs: any = null, emb: any = null
const ctx = self as unknown as { onmessage: ((e: MessageEvent) => void) | null; postMessage: (m: unknown, t?: Transferable[]) => void }
const post = (m: unknown, t?: Transferable[]) => ctx.postMessage(m, t || [])

ctx.onmessage = async (e: MessageEvent) => {
  const d = e.data
  try {
    if (d.type === 'load') {
      const tx = await TX(); const t0 = performance.now()
      let device = 'wasm'
      if (d.exec === 'auto') {
        try { model = await tx.SamModel.from_pretrained(d.modelId, { dtype: 'fp16', device: 'webgpu' as any }); device = 'webgpu' }
        catch { model = await tx.SamModel.from_pretrained(d.modelId, { dtype: 'fp32', device: 'wasm' as any }); device = 'wasm' }
      } else {
        try { model = await tx.SamModel.from_pretrained(d.modelId, { dtype: 'q8', device: 'wasm' as any }) }
        catch { model = await tx.SamModel.from_pretrained(d.modelId, { dtype: 'fp32', device: 'wasm' as any }) }
        device = 'wasm'
      }
      processor = await tx.AutoProcessor.from_pretrained(d.modelId)
      emb = null; inputs = null
      post({ type: 'loaded', id: d.id, device, ms: Math.round(performance.now() - t0) })
    } else if (d.type === 'encode') {
      const tx = await TX(); const t0 = performance.now()
      // raw RGBA pixels from the main thread → RawImage (no decode APIs here). SAM wants RGB.
      const raw = new tx.RawImage(new Uint8ClampedArray(d.data), d.W, d.H, 4).rgb()
      inputs = await processor(raw)
      emb = await model.get_image_embeddings(inputs)
      post({ type: 'encoded', id: d.id, W: d.W, H: d.H, ms: Math.round(performance.now() - t0) })
    } else if (d.type === 'decode') {
      const tx = await TX(); const t0 = performance.now()
      const rs = inputs.reshaped_input_sizes[0]
      const pts = d.points.map((q: { x: number; y: number }) => [q.x * rs[1], q.y * rs[0]])
      const feeds: Record<string, any> = { ...emb }
      feeds.input_points = new tx.Tensor('float32', pts.flat(Infinity) as number[], [1, 1, pts.length, 2])
      feeds.input_labels = new tx.Tensor('int64', d.labels.map((l: number) => BigInt(l)), [1, 1, d.labels.length])
      const out = await model(feeds)
      const masks = await processor.post_process_masks(out.pred_masks, inputs.original_sizes, inputs.reshaped_input_sizes)
      const m = masks[0]; const [, n, H, W] = m.dims as number[]
      const src = m.data as Uint8Array, plane = H * W
      const scores = Array.from(out.iou_scores.data as Float32Array)
      let best = 0
      if (!d.guided) {
        // auto-detect = the WHOLE object → pick the LARGEST valid mask (stable across fp16/q8), not
        // best-IoU (which flips between the face sub-mask and the full figure on tiny score deltas).
        best = -1; let ba = -1
        for (let i = 0; i < n; i++) { let a = 0; for (let k = 0; k < plane; k++) a += src[i * plane + k]; const f = a / plane; if (f > 0.05 && f < 0.92 && a > ba) { ba = a; best = i } }
        if (best < 0) { best = 0; for (let i = 1; i < n; i++) if (scores[i] > scores[best]) best = i }
      } else for (let i = 1; i < n; i++) if (scores[i] > scores[best]) best = i
      const buf = new Uint8Array(plane), off = best * plane; for (let i = 0; i < plane; i++) buf[i] = src[off + i]
      post({ type: 'decoded', id: d.id, mask: buf.buffer, W, H, ms: Math.round(performance.now() - t0) }, [buf.buffer])
    }
  } catch (err) {
    post({ type: 'error', id: d?.id, stage: d?.type, error: String((err as Error)?.message ?? err) })
  }
}

export {}
