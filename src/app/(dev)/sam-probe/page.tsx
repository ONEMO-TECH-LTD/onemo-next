'use client'

// SAM sticker-cutout probe (s62) — AI-Magic one-tap flow. SAM inference runs in a WEB WORKER (so mobile
// Safari WASM doesn't freeze the tab); the main thread does the Safari-safe image load (<img>.decode →
// canvas, handles iPhone HEIC), the light geometry (clean/simplify/offset) and rendering. Layout is
// responsive (stacks on narrow screens). Model + Engine (WebGPU/WASM) toggles for A/B on the Safari path.

import { useCallback, useEffect, useRef, useState } from 'react'

type Pt = { x: number; y: number }
type Mode = 'add' | 'erase'

// every mobile-capable model < 50MB, wired for head-to-head testing. `auto` models (u2net family) are
// salient-object mattes with no prompt — brush does nothing for them; the rest are promptable.
const MODELS: Record<string, any> = {
  u2net: { kind: 'u2net', label: 'u2net · v5.3.1 (auto)', onnx: '/seg-models/u2netp.onnx', size: 320, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225], auto: true },
  silueta: { kind: 'u2net', label: 'Silueta · v5.3.1 (auto)', onnx: '/seg-models/silueta.onnx', size: 320, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225], auto: true },
  slim77: { kind: 'sam-tjs', label: 'SlimSAM-77 · ~5.5M', id: 'Xenova/slimsam-77-uniform' },
  slim50: { kind: 'sam-tjs', label: 'SlimSAM-50 · larger', id: 'Xenova/slimsam-50-uniform' },
  mobilesam: { kind: 'sam-onnx', label: 'MobileSAM · ~10M', enc: '/seg-models/mobilesam.encoder.onnx', dec: '/seg-models/mobilesam.decoder.onnx', preproc: 'hwc' },
  edgesam: { kind: 'sam-onnx', label: 'EdgeSAM · fastest', enc: '/seg-models/edgesam.encoder.onnx', dec: '/seg-models/edgesam.decoder.onnx', preproc: 'chw' },
  sam2tiny: { kind: 'sam2-tjs', label: 'SAM2-tiny · best', id: 'onnx-community/sam2-hiera-tiny-ONNX' },
}
const DETAIL_DEFAULT = 6, OFFSET_DEFAULT = 4
// Process at a BOUNDED working resolution, not the source's full res. A 2048² photo = 4.2M px churned
// through getImageData + transfer + connected-components + blur + distance-transform every run — that
// overhead dwarfs a fast model's inference. Cap the longest side; the display is ~540px so this is
// visually lossless for the probe, and it makes u2net/EdgeSAM near-instant.
const WORK_MAX = 1024
const CENTRAL: Pt[] = [{ x: 0.5, y: 0.5 }, { x: 0.4, y: 0.4 }, { x: 0.6, y: 0.4 }, { x: 0.4, y: 0.6 }, { x: 0.6, y: 0.6 }, { x: 0.5, y: 0.3 }, { x: 0.5, y: 0.7 }]

// ── mask geometry (pure, runs on the main thread — fast) ─────────────────────────────────────────
function cleanMask(buf: Uint8Array, W: number, H: number) {
  const N = W * H, label = new Int32Array(N).fill(-1), sizes: number[] = []
  const stack = new Int32Array(N); let sp = 0, cur = 0
  for (let i = 0; i < N; i++) {
    if (buf[i] && label[i] < 0) {
      label[i] = cur; sp = 0; stack[sp++] = i; let sz = 0
      while (sp) { const p = stack[--sp]; sz++; const x = p % W, y = (p / W) | 0
        if (x > 0 && buf[p - 1] && label[p - 1] < 0) { label[p - 1] = cur; stack[sp++] = p - 1 }
        if (x < W - 1 && buf[p + 1] && label[p + 1] < 0) { label[p + 1] = cur; stack[sp++] = p + 1 }
        if (y > 0 && buf[p - W] && label[p - W] < 0) { label[p - W] = cur; stack[sp++] = p - W }
        if (y < H - 1 && buf[p + W] && label[p + W] < 0) { label[p + W] = cur; stack[sp++] = p + W } }
      sizes.push(sz); cur++
    }
  }
  if (!cur) return
  let maxSz = 0; for (const s of sizes) if (s > maxSz) maxSz = s
  const keep = new Uint8Array(cur); for (let c = 0; c < cur; c++) keep[c] = sizes[c] >= maxSz * 0.12 ? 1 : 0
  const out = new Uint8Array(N)
  for (let i = 0; i < N; i++) if (buf[i] && keep[label[i]]) out[i] = 1
  const bg = new Uint8Array(N); sp = 0
  for (let x = 0; x < W; x++) { if (!out[x]) { bg[x] = 1; stack[sp++] = x } const b = (H - 1) * W + x; if (!out[b]) { bg[b] = 1; stack[sp++] = b } }
  for (let y = 0; y < H; y++) { const l = y * W; if (!out[l]) { bg[l] = 1; stack[sp++] = l } const r = y * W + W - 1; if (!out[r]) { bg[r] = 1; stack[sp++] = r } }
  while (sp) { const p = stack[--sp]; const x = p % W, y = (p / W) | 0
    if (x > 0 && !out[p - 1] && !bg[p - 1]) { bg[p - 1] = 1; stack[sp++] = p - 1 }
    if (x < W - 1 && !out[p + 1] && !bg[p + 1]) { bg[p + 1] = 1; stack[sp++] = p + 1 }
    if (y > 0 && !out[p - W] && !bg[p - W]) { bg[p - W] = 1; stack[sp++] = p - W }
    if (y < H - 1 && !out[p + W] && !bg[p + W]) { bg[p + W] = 1; stack[sp++] = p + W } }
  for (let i = 0; i < N; i++) if (!out[i] && !bg[i]) out[i] = 1
  buf.set(out)
}
function distTransform(bin: Uint8Array, W: number, H: number, target: number): Float32Array {
  const N = W * H, INF = 1e9, A = 1, B = 1.4142, d = new Float32Array(N)
  for (let i = 0; i < N; i++) d[i] = bin[i] === target ? 0 : INF
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; let v = d[i]; if (y > 0) { if (d[i - W] + A < v) v = d[i - W] + A; if (x > 0 && d[i - W - 1] + B < v) v = d[i - W - 1] + B; if (x < W - 1 && d[i - W + 1] + B < v) v = d[i - W + 1] + B } if (x > 0 && d[i - 1] + A < v) v = d[i - 1] + A; d[i] = v }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; let v = d[i]; if (y < H - 1) { if (d[i + W] + A < v) v = d[i + W] + A; if (x < W - 1 && d[i + W + 1] + B < v) v = d[i + W + 1] + B; if (x > 0 && d[i + W - 1] + B < v) v = d[i + W - 1] + B } if (x < W - 1 && d[i + 1] + A < v) v = d[i + 1] + A; d[i] = v }
  return d
}
function offsetMask(bin: Uint8Array, W: number, H: number, off: number): Uint8Array {
  if (!off) return bin
  const N = W * H, out = new Uint8Array(N)
  if (off > 0) { const df = distTransform(bin, W, H, 1); for (let i = 0; i < N; i++) out[i] = (bin[i] || df[i] <= off) ? 1 : 0 }
  else { const k = -off, db = distTransform(bin, W, H, 0); for (let i = 0; i < N; i++) out[i] = (bin[i] && db[i] > k) ? 1 : 0 }
  return out
}
function finishOutline(raw: Uint8Array, W: number, H: number, detail: number, offset: number): Uint8Array {
  const N = W * H
  const f = new Float32Array(N); for (let i = 0; i < N; i++) f[i] = raw[i]
  const r = Math.max(1, Math.round(detail))
  for (let pass = 0; pass < 2; pass++) {
    const t = new Float32Array(N), win = 2 * r + 1
    for (let y = 0; y < H; y++) { const row = y * W; let s = 0; for (let x = -r; x <= r; x++) s += f[row + Math.min(W - 1, Math.max(0, x))]; for (let x = 0; x < W; x++) { t[row + x] = s / win; s += f[row + Math.min(W - 1, x + r + 1)] - f[row + Math.min(W - 1, Math.max(0, x - r))] } }
    for (let x = 0; x < W; x++) { let s = 0; for (let y = -r; y <= r; y++) s += t[Math.min(H - 1, Math.max(0, y)) * W + x]; for (let y = 0; y < H; y++) { f[y * W + x] = s / win; s += t[Math.min(H - 1, y + r + 1) * W + x] - t[Math.min(H - 1, Math.max(0, y - r)) * W + x] } }
  }
  const bin = new Uint8Array(N); for (let i = 0; i < N; i++) bin[i] = f[i] >= 0.5 ? 1 : 0
  return offsetMask(bin, W, H, Math.round(offset))
}
const subsample = (a: Pt[], max: number) => a.length <= max ? a : a.filter((_, i) => i % Math.ceil(a.length / max) === 0)
const tmpCanvas = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }

export default function SamProbe() {
  const [status, setStatus] = useState('starting…')
  const [device, setDevice] = useState('—')
  const [modelKey, setModelKey] = useState('slim77')
  const [exec, setExec] = useState<'auto' | 'wasm'>('auto')
  const [loadMs, setLoadMs] = useState<number | null>(null)
  const [encodeMs, setEncodeMs] = useState<number | null>(null)
  const [cutMs, setCutMs] = useState<number | null>(null)
  const [mode, setMode] = useState<Mode>('add')
  const [brush, setBrush] = useState(40)
  const [detail, setDetail] = useState(DETAIL_DEFAULT)
  const [offset, setOffset] = useState(OFFSET_DEFAULT)
  const [overlay, setOverlay] = useState(true)
  const [disp, setDisp] = useState({ w: 320, h: 240 })
  const [vw, setVw] = useState(1000)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [hasCut, setHasCut] = useState(false)

  const workerRef = useRef<Worker | null>(null)
  const pending = useRef<Map<number, (v: any) => void>>(new Map())
  const nextId = useRef(1)
  const imgRef = useRef<HTMLCanvasElement>(null), maskCanvas = useRef<HTMLCanvasElement>(null), prevRef = useRef<HTMLCanvasElement>(null)
  const rawRef = useRef<Uint8Array | null>(null), bufRef = useRef<Uint8Array | null>(null)
  const fgRef = useRef<Pt[]>([]), bgRef = useRef<Pt[]>([])
  const strokeRef = useRef<{ pts: Pt[]; add: boolean } | null>(null)
  const dimRef = useRef({ W: 1, H: 1 })
  const dispRef = useRef({ w: 320, h: 240 }); dispRef.current = disp
  const vwRef = useRef(1000); vwRef.current = vw
  const brushRef = useRef(40); brushRef.current = brush
  const detailRef = useRef(DETAIL_DEFAULT); detailRef.current = detail
  const offsetRef = useRef(OFFSET_DEFAULT); offsetRef.current = offset
  const modeRef = useRef<Mode>('add'); modeRef.current = mode
  const ovRef = useRef(true); ovRef.current = overlay
  const modelKeyRef = useRef('slim77'); modelKeyRef.current = modelKey
  const execRef = useRef<'auto' | 'wasm'>('auto'); execRef.current = exec
  const lastFileRef = useRef<File | null>(null)
  const cursorRef = useRef<Pt | null>(null), paintingRef = useRef(false), lastRef = useRef<Pt | null>(null)

  const call = useCallback((msg: any, transfer?: Transferable[]) => new Promise<any>((res) => {
    const id = nextId.current++; pending.current.set(id, res)
    workerRef.current!.postMessage({ ...msg, id }, transfer || [])
  }), [])

  const loadModel = useCallback(async () => {
    setReady(false); setStatus(`loading ${MODELS[modelKeyRef.current].label} (${execRef.current === 'wasm' ? 'WASM' : 'auto'})…`)
    const t0 = performance.now()
    const r = await call({ type: 'load', cfg: MODELS[modelKeyRef.current], exec: execRef.current })
    if (r.type === 'error') { setStatus('⚠️ model load failed: ' + r.error); return }
    setDevice(`${r.device} · ${modelKeyRef.current}`); setLoadMs(Math.round(performance.now() - t0)); setReady(true); setStatus('ready — upload an image')
  }, [call])

  // spawn a FRESH worker (terminates any prior) → true from-scratch load timing per model/engine
  const spawnWorker = useCallback(() => {
    if (workerRef.current) { workerRef.current.terminate(); pending.current.clear() }
    const w = new Worker(new URL('./sam.worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (e) => { const r = pending.current.get(e.data.id); if (r) { pending.current.delete(e.data.id); r(e.data) } }
    w.onerror = (ev) => setStatus('⚠️ worker error: ' + ev.message)
    workerRef.current = w
  }, [])

  useEffect(() => { spawnWorker(); loadModel(); return () => workerRef.current?.terminate() }, [spawnWorker, loadModel])

  useEffect(() => { const f = () => setVw(window.innerWidth); f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f) }, [])
  const fitDisp = (w: number, h: number) => { const maxW = Math.min(560, vwRef.current - 34), maxH = 460, s = Math.min(maxW / w, maxH / h, 1); return { w: Math.round(w * s), h: Math.round(h * s) } }
  useEffect(() => { const { W, H } = dimRef.current; if (W > 1) setDisp(fitDisp(W, H)) }, [vw]) // reflow on rotate/resize

  const renderMask = useCallback(() => {
    const mc = maskCanvas.current; if (!mc) return
    const ctx = mc.getContext('2d')!; ctx.clearRect(0, 0, mc.width, mc.height)
    const buf = bufRef.current, { W, H } = dimRef.current, k = mc.width / dispRef.current.w, ky = mc.height / dispRef.current.h
    if (buf && ovRef.current) {
      const plane = W * H, ov = new ImageData(W, H)
      for (let i = 0; i < plane; i++) { const o = i * 4; if (buf[i]) { ov.data[o] = 34; ov.data[o + 1] = 197; ov.data[o + 2] = 94; ov.data[o + 3] = 104 } else { ov.data[o] = 239; ov.data[o + 1] = 68; ov.data[o + 2] = 68; ov.data[o + 3] = 86 } }
      const tmp = tmpCanvas(W, H); tmp.getContext('2d')!.putImageData(ov, 0, 0); ctx.drawImage(tmp, 0, 0, mc.width, mc.height)
    }
    const st = strokeRef.current
    if (st && st.pts.length) { ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = st.add ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'; ctx.lineWidth = brushRef.current * 2 * k; ctx.beginPath(); ctx.moveTo(st.pts[0].x * mc.width, st.pts[0].y * mc.height); for (const q of st.pts) ctx.lineTo(q.x * mc.width, q.y * mc.height); ctx.stroke() }
    const cur = cursorRef.current
    if (cur) { ctx.beginPath(); ctx.arc(cur.x * k, cur.y * ky, brushRef.current * k, 0, 6.29); ctx.lineWidth = Math.max(2, mc.width * 0.003); ctx.strokeStyle = modeRef.current === 'add' ? 'rgba(34,197,94,1)' : 'rgba(239,68,68,1)'; ctx.stroke() }
  }, [])

  const buildCutout = (): ImageData | null => {
    const ic = imgRef.current, buf = bufRef.current; if (!ic || !buf) return null
    const { W, H } = dimRef.current, img = ic.getContext('2d')!.getImageData(0, 0, W, H), out = new ImageData(W, H)
    for (let i = 0; i < W * H; i++) if (buf[i]) { const o = i * 4; out.data[o] = img.data[o]; out.data[o + 1] = img.data[o + 1]; out.data[o + 2] = img.data[o + 2]; out.data[o + 3] = 255 }
    return out
  }
  const renderPreview = useCallback(() => {
    const pc = prevRef.current; if (!pc) return
    const { W, H } = dimRef.current, ctx = pc.getContext('2d')!; ctx.clearRect(0, 0, W, H)
    const t = 16; for (let y = 0; y < H; y += t) for (let x = 0; x < W; x += t) { ctx.fillStyle = ((x / t + y / t) & 1) ? '#e5e7eb' : '#f8fafc'; ctx.fillRect(x, y, t, t) }
    const cut = buildCutout(); if (cut) { const tmp = tmpCanvas(W, H); tmp.getContext('2d')!.putImageData(cut, 0, 0); ctx.drawImage(tmp, 0, 0) }
  }, [])
  const renderAll = useCallback(() => { renderMask(); renderPreview() }, [renderMask, renderPreview])

  const refine = useCallback(() => {
    const raw = rawRef.current; if (!raw) return
    const { W, H } = dimRef.current
    bufRef.current = finishOutline(raw, W, H, detailRef.current, offsetRef.current); renderAll()
  }, [renderAll])

  const recognize = useCallback(async (guided: boolean) => {
    const fg = guided ? subsample(fgRef.current, 32) : CENTRAL
    const bg = subsample(bgRef.current, 24)
    const points = [...fg, ...bg], labels = [...fg.map(() => 1), ...bg.map(() => 0)]
    if (!points.length) return
    setBusy(true); setStatus(guided ? '🔎 recognizing…' : '✨ auto-detecting the object…')
    const t0 = performance.now()
    const r = await call({ type: 'decode', points, labels, guided })
    if (r.type === 'error') { setBusy(false); setStatus('⚠️ recognize failed: ' + r.error); return }
    const raw = new Uint8Array(r.mask), W = r.W, H = r.H
    cleanMask(raw, W, H); rawRef.current = raw; dimRef.current = { W, H }; setHasCut(true)
    refine(); setCutMs(Math.round(performance.now() - t0)); setBusy(false) // wall-clock: decode + geometry + render
    setStatus('✨ done — tune Detail/Offset, brush edge cases, or Save')
  }, [call, refine])

  const onFile = useCallback(async (file: File) => {
    lastFileRef.current = file
    rawRef.current = null; bufRef.current = null; fgRef.current = []; bgRef.current = []; setHasCut(false); setCutMs(null)
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.src = url
    try { await img.decode() } catch (e) { URL.revokeObjectURL(url); setStatus('⚠️ could not open image: ' + String(e)); return }
    const nw = img.naturalWidth, nh = img.naturalHeight
    const ws = Math.min(1, WORK_MAX / Math.max(nw, nh))
    const w = Math.round(nw * ws), h = Math.round(nh * ws) // bounded working resolution
    dimRef.current = { W: w, H: h }; setDisp(fitDisp(w, h))
    for (const c of [imgRef.current!, maskCanvas.current!, prevRef.current!]) { c.width = w; c.height = h }
    const ictx = imgRef.current!.getContext('2d')!
    ictx.drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url); renderAll()
    setStatus('🧠 encoding image (one-time)…')
    const t0 = performance.now()
    const px = ictx.getImageData(0, 0, w, h)
    const r = await call({ type: 'encode', data: px.data.buffer, W: w, H: h }, [px.data.buffer])
    if (r.type === 'error') { setStatus('⚠️ encode failed: ' + r.error); return }
    setEncodeMs(Math.round(performance.now() - t0)) // wall-clock: getImageData + transfer + worker compute
    await recognize(false)
  }, [call, recognize, renderAll])

  const reloadPipeline = useCallback(async () => {
    rawRef.current = null; bufRef.current = null; setHasCut(false); setLoadMs(null); setEncodeMs(null); setCutMs(null)
    spawnWorker() // FRESH worker → measure this model/engine from a cold start
    await loadModel()
    if (lastFileRef.current) await onFile(lastFileRef.current); else setStatus('fresh reload — upload an image')
  }, [spawnWorker, loadModel, onFile])

  const depositAlong = (a: Pt, b: Pt, add: boolean) => {
    const { W } = dimRef.current, r = brushRef.current * (W / dispRef.current.w)
    const arr = add ? fgRef.current : bgRef.current
    const steps = Math.max(1, Math.ceil(Math.hypot((b.x - a.x) * W, (b.y - a.y) * W) / (r * 0.6)))
    for (let i = 1; i <= steps; i++) arr.push({ x: a.x + (b.x - a.x) * i / steps, y: a.y + (b.y - a.y) * i / steps })
  }
  const nrm = (e: React.PointerEvent): Pt => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height } }
  const cursFrom = (e: React.PointerEvent) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); cursorRef.current = { x: (e.clientX - r.left) / r.width * dispRef.current.w, y: (e.clientY - r.top) / r.height * dispRef.current.h } }
  const onDown = (e: React.PointerEvent) => { if (!hasCut && !rawRef.current && !lastFileRef.current) return; const n = nrm(e); cursFrom(e); paintingRef.current = true; lastRef.current = n; const add = modeRef.current === 'add'; strokeRef.current = { pts: [n], add };(add ? fgRef.current : bgRef.current).push(n); renderMask() }
  const onMove = (e: React.PointerEvent) => { cursFrom(e); if (paintingRef.current) { const n = nrm(e); if (lastRef.current) depositAlong(lastRef.current, n, modeRef.current === 'add'); lastRef.current = n; strokeRef.current?.pts.push(n) } renderMask() }
  const onUp = () => { if (!paintingRef.current) return; paintingRef.current = false; lastRef.current = null; strokeRef.current = null; recognize(true) }
  const onLeave = () => { if (paintingRef.current) onUp(); cursorRef.current = null; renderMask() }
  const onWheel = (e: React.WheelEvent) => { setBrush((b) => Math.min(140, Math.max(6, Math.round(b - e.deltaY * 0.08)))); requestAnimationFrame(renderMask) }
  const clear = () => { rawRef.current = null; bufRef.current = null; fgRef.current = []; bgRef.current = []; strokeRef.current = null; setHasCut(false); setCutMs(null); renderAll(); setStatus('cleared — upload again or brush') }
  const save = () => { const cut = buildCutout(); if (!cut) return; const { W, H } = dimRef.current, c = tmpCanvas(W, H); c.getContext('2d')!.putImageData(cut, 0, 0); c.toBlob((b) => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'cutout.png'; a.click(); URL.revokeObjectURL(a.href) }) }

  const narrow = vw < 720
  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: narrow ? 12 : 24, fontFamily: 'ui-sans-serif, system-ui', color: '#0f172a' }}>
      <h1 style={{ fontSize: 19, fontWeight: 700 }}>AI Magic sticker-cutout probe</h1>
      <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>
        Upload → the object is auto-detected + finished (optimal smoothing + offset) → <b>Save</b>. Edge cases:{' '}
        <b>brush</b> a rough hint (Add/🟢 keep · Erase/🔴 remove — the AI re-recognises), tune <b>Detail</b>/<b>Offset</b> live.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0', alignItems: 'center' }}>
        <label style={{ ...btn, cursor: 'pointer', background: '#2563eb', color: '#fff', borderColor: '#2563eb' }}>⬆ Upload image
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} /></label>
        <button onClick={save} disabled={!hasCut} style={{ ...btn, background: hasCut ? '#16a34a' : '#e5e7eb', color: hasCut ? '#fff' : '#9ca3af', borderColor: hasCut ? '#16a34a' : '#e5e7eb' }}>💾 Save</button>
        <button onClick={clear} style={btn}>Clear</button>
        <button onClick={() => { setOverlay((o) => { ovRef.current = !o; return !o }); requestAnimationFrame(renderMask) }} style={{ ...btn, background: overlay ? '#0f172a' : '#f1f5f9', color: overlay ? '#fff' : '#0f172a' }}>{overlay ? 'Hide overlay' : 'Show overlay'}</button>
        <span style={{ fontSize: 12, color: ready ? '#16a34a' : '#b45309', fontWeight: 600 }}>{ready ? `● ${device}` : '○ loading…'}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center', fontSize: 12, color: '#475569' }}>
        <span style={{ fontWeight: 700, color: '#334155' }}>Model:</span>
        <select value={modelKey} disabled={busy} onChange={(e) => { setModelKey(e.target.value); modelKeyRef.current = e.target.value; reloadPipeline() }} style={{ ...btn, fontSize: 12, cursor: 'pointer' }}>
          {Object.entries(MODELS).map(([k, m]) => (<option key={k} value={k}>{m.label}</option>))}
        </select>
        <span style={{ fontWeight: 700, color: '#334155', marginLeft: 4 }}>Engine:</span>
        {([['auto', narrow ? 'Auto' : 'Auto (WebGPU→WASM)'], ['wasm', narrow ? 'WASM' : 'Force WASM · Safari']] as ['auto' | 'wasm', string][]).map(([e, lbl]) => (
          <button key={e} disabled={busy} onClick={() => { setExec(e); execRef.current = e; reloadPipeline() }} style={{ ...btn, fontSize: 12, background: exec === e ? '#7c3aed' : '#f1f5f9', color: exec === e ? '#fff' : '#0f172a', borderColor: exec === e ? '#7c3aed' : '#cbd5e1' }}>{lbl}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center', fontSize: 12, color: '#475569' }}>
        {([['add', '🟢 Add'], ['erase', '🔴 Erase']] as [Mode, string][]).map(([m, lbl]) => (
          <button key={m} onClick={() => { setMode(m); modeRef.current = m; renderMask() }} style={{ ...btn, background: mode === m ? '#0f172a' : '#f1f5f9', color: mode === m ? '#fff' : '#0f172a', borderColor: mode === m ? '#0f172a' : '#cbd5e1' }}>{lbl}</button>
        ))}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Brush {brush}<input type="range" min={6} max={140} value={brush} onChange={(e) => { setBrush(+e.target.value); requestAnimationFrame(renderMask) }} style={{ width: 80 }} /></label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Detail {detail}<input type="range" min={1} max={24} value={detail} onChange={(e) => { setDetail(+e.target.value); detailRef.current = +e.target.value; requestAnimationFrame(refine) }} style={{ width: 80 }} /></label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Offset {offset}<input type="range" min={-10} max={30} value={offset} onChange={(e) => { setOffset(+e.target.value); offsetRef.current = +e.target.value; requestAnimationFrame(refine) }} style={{ width: 80 }} /></label>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', marginBottom: 4 }}>Result — green kept / red removed</div>
          <div style={{ position: 'relative', width: disp.w, height: disp.h, background: '#0b1220', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', touchAction: 'none' }}>
            <canvas ref={imgRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
            <canvas ref={maskCanvas} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onLeave} onWheel={onWheel} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'none', touchAction: 'none' }} />
            {!hasCut && !busy && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 12, pointerEvents: 'none' }}>upload an image — the cutout is automatic</div>}
            {busy && <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(37,99,235,0.95)', color: '#fff', fontSize: 12, padding: '4px 10px', borderRadius: 5, pointerEvents: 'none' }}>✨ AI magic…</div>}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', marginBottom: 4 }}>Final cutout (Save)</div>
          <canvas ref={prevRef} style={{ width: disp.w, height: disp.h, border: '1px solid #e2e8f0', borderRadius: 8 }} />
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, maxWidth: 600 }}>
        <Stat label="engine · model" value={device} />
        <Stat label="model load" value={loadMs != null ? `${loadMs}ms` : '—'} />
        <Stat label="encode / image" value={encodeMs != null ? `${encodeMs}ms` : '—'} />
        <Stat label="recognize" value={cutMs != null ? `${cutMs}ms` : '—'} />
      </div>
      <p style={{ marginTop: 12, fontSize: 13, color: '#334155' }}><b>Status:</b> {status}</p>
    </div>
  )
}

const btn: React.CSSProperties = { padding: '8px 12px', fontSize: 13, border: '1px solid #cbd5e1', borderRadius: 6, background: '#f1f5f9', fontWeight: 600 }
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 10px' }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2, wordBreak: 'break-word' }}>{value}</div>
    </div>
  )
}
