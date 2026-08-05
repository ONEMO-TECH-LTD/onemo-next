'use client'

// cutout-lab — proto shell over the cutout-ai subs + the v5.3.1 engine (ARCHITECTURE.md).
// STATE + RENDER ONLY: models run in the cutout-ai worker (client.ts), the brush semantics live in
// brush.ts (add=union / erase=subtract, base retained), finishing is v5.3.1's (finish.ts glue).
// Safari-safe upload (<img>.decode → canvas), bounded working res, per-stage wall-clock timings.

import { useCallback, useEffect, useRef, useState } from 'react'
import { CutoutClient } from '@/lib/cutout-ai/client'
import { DEFAULT_MODEL, MODELS } from '@/lib/cutout-ai/registry'
import type { Exec, Mask, Point } from '@/lib/cutout-ai/types'
import { AUTO_SETTINGS, drawCutout, finishOutline, maskOverlay, type TraceOutlineSettings } from './finish'

const WORK_MAX = 1024 // bounded working resolution (perf fix, s62)

export default function CutoutLab() {
  const [modelKey, setModelKey] = useState(DEFAULT_MODEL)
  const [exec, setExec] = useState<Exec>('auto')
  const [mode, setMode] = useState<'add' | 'erase'>('add')
  const [brushR, setBrushR] = useState(40)
  const [settings, setSettings] = useState<TraceOutlineSettings>(AUTO_SETTINGS)
  const [status, setStatus] = useState('starting…')
  const [device, setDevice] = useState('—')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [hasCut, setHasCut] = useState(false)
  const [ms, setMs] = useState<{ load?: number; encode?: number; recognize?: number }>({})
  const [disp, setDisp] = useState({ w: 480, h: 360 })

  const client = useRef<CutoutClient | null>(null)
  const imgCanvas = useRef<HTMLCanvasElement | null>(null) // master image at working res
  const viewRef = useRef<HTMLCanvasElement>(null)
  const prevRef = useRef<HTMLCanvasElement>(null)
  const maskRef = useRef<Mask | null>(null)
  const dRef = useRef<string | null>(null)
  const strokeRef = useRef<Point[]>([])
  const paintingRef = useRef(false)
  const lastFileRef = useRef<File | null>(null)
  const settingsRef = useRef(settings); settingsRef.current = settings
  const modeRef = useRef(mode); modeRef.current = mode
  const brushRef = useRef(brushR); brushRef.current = brushR

  // ── render (draw only — all pixel/geometry work is in finish.ts / the subs) ──
  const render = useCallback(() => {
    const view = viewRef.current, img = imgCanvas.current
    if (!view || !img) return
    view.width = img.width; view.height = img.height
    const ctx = view.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const mask = maskRef.current
    if (mask) {
      const tmp = document.createElement('canvas'); tmp.width = mask.w; tmp.height = mask.h
      tmp.getContext('2d')!.putImageData(maskOverlay(mask), 0, 0)
      ctx.drawImage(tmp, 0, 0)
    }
    if (dRef.current) { ctx.strokeStyle = '#2563eb'; ctx.lineWidth = Math.max(2, img.width / 400); ctx.stroke(new Path2D(dRef.current)) }
    const st = strokeRef.current
    if (st.length) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.strokeStyle = modeRef.current === 'add' ? 'rgba(34,197,94,0.55)' : 'rgba(239,68,68,0.55)'
      ctx.lineWidth = brushRef.current * 2 * (img.width / disp.w)
      ctx.beginPath(); ctx.moveTo(st[0].x * img.width, st[0].y * img.height)
      for (const q of st) ctx.lineTo(q.x * img.width, q.y * img.height)
      ctx.stroke()
    }
    if (prevRef.current && dRef.current) drawCutout(prevRef.current, img, dRef.current)
  }, [disp.w])

  const applyFinish = useCallback(() => {
    const mask = maskRef.current
    dRef.current = mask ? finishOutline(mask, settingsRef.current)?.d ?? null : null
    render()
  }, [render])

  const acceptMask = useCallback((mask: Mask, recognizeMs: number) => {
    maskRef.current = mask
    setMs((m) => ({ ...m, recognize: recognizeMs }))
    setHasCut(true)
    applyFinish()
    setStatus('✨ done — brush to fill/erase, tune sliders, Re-detect, or Save')
  }, [applyFinish])

  // ── model lifecycle (fresh worker per model/engine = true cold-start timing) ──
  const loadModel = useCallback(async (key: string, ex: Exec) => {
    setReady(false); setHasCut(false); maskRef.current = null; dRef.current = null; setMs({})
    setStatus(`loading ${MODELS[key].label}…`)
    const c = client.current!
    c.spawn()
    try {
      const t0 = performance.now()
      const r = await c.load(MODELS[key], ex)
      setDevice(`${r.device} · ${key}`); setMs({ load: Math.round(performance.now() - t0) })
      setReady(true); setStatus('ready — upload an image')
      if (lastFileRef.current) await onFile(lastFileRef.current)
    } catch (e) { setStatus('⚠️ model load failed: ' + String((e as Error).message)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    client.current = new CutoutClient()
    client.current.onError = (m) => setStatus('⚠️ worker: ' + m)
    loadModel(DEFAULT_MODEL, 'auto')
    return () => client.current?.dispose()
  }, [loadModel])

  // ── upload (Safari-safe) → encode → auto detect ──
  const onFile = useCallback(async (file: File) => {
    lastFileRef.current = file
    maskRef.current = null; dRef.current = null; setHasCut(false)
    const url = URL.createObjectURL(file)
    const img = new Image(); img.src = url
    try { await img.decode() } catch (e) { URL.revokeObjectURL(url); setStatus('⚠️ could not open image: ' + String(e)); return }
    const s = Math.min(1, WORK_MAX / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s)
    const master = document.createElement('canvas'); master.width = w; master.height = h
    const mctx = master.getContext('2d', { willReadFrequently: true })!
    mctx.drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url)
    imgCanvas.current = master
    const maxW = Math.min(520, typeof window !== 'undefined' ? window.innerWidth - 40 : 520)
    const k = Math.min(maxW / w, 440 / h, 1)
    setDisp({ w: Math.round(w * k), h: Math.round(h * k) })
    render()
    setBusy(true); setStatus('🧠 encoding image…')
    try {
      const t0 = performance.now()
      await client.current!.encode(mctx.getImageData(0, 0, w, h).data, w, h)
      setMs((m) => ({ ...m, encode: Math.round(performance.now() - t0) }))
      setStatus('✨ detecting the object…')
      const t1 = performance.now()
      const r = await client.current!.redetect()
      acceptMask(r.mask, Math.round(performance.now() - t1))
    } catch (e) { setStatus('⚠️ ' + String((e as Error).message)) }
    setBusy(false)
  }, [acceptMask, render])

  // ── brush (stroke = prompt; add fills into the base, erase subtracts — brush.ts owns it) ──
  const nrm = (e: React.PointerEvent): Point => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, label: 1 }
  }
  const onDown = (e: React.PointerEvent) => { if (!hasCut || busy) return; paintingRef.current = true; strokeRef.current = [nrm(e)]; render() }
  const onMove = (e: React.PointerEvent) => { if (!paintingRef.current) return; strokeRef.current.push(nrm(e)); render() }
  const onUp = async () => {
    if (!paintingRef.current) return
    paintingRef.current = false
    const stroke = strokeRef.current; strokeRef.current = []
    if (stroke.length < 2) { render(); return }
    setBusy(true); setStatus(modeRef.current === 'add' ? '🟢 filling…' : '🔴 erasing…')
    try {
      const t0 = performance.now()
      const r = modeRef.current === 'add' ? await client.current!.addStroke(stroke) : await client.current!.eraseStroke(stroke)
      acceptMask(r.mask, Math.round(performance.now() - t0))
    } catch (e) { setStatus('⚠️ ' + String((e as Error).message)) }
    setBusy(false)
  }

  const redetect = async () => {
    if (!ready || busy || !imgCanvas.current) return
    setBusy(true); setStatus('✨ re-detecting (replaces the selection)…')
    try { const t0 = performance.now(); const r = await client.current!.redetect(); acceptMask(r.mask, Math.round(performance.now() - t0)) }
    catch (e) { setStatus('⚠️ ' + String((e as Error).message)) }
    setBusy(false)
  }

  const save = () => {
    const img = imgCanvas.current
    if (!img || !dRef.current) return
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
    const ctx = c.getContext('2d')!
    ctx.clip(new Path2D(dRef.current)); ctx.drawImage(img, 0, 0)
    c.toBlob((b) => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'cutout.png'; a.click(); URL.revokeObjectURL(a.href) })
  }

  const setTune = (patch: Partial<TraceOutlineSettings>) => { setSettings((s) => { const n = { ...s, ...patch }; settingsRef.current = n; return n }); requestAnimationFrame(applyFinish) }

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: 20, fontFamily: 'ui-sans-serif, system-ui', color: '#0f172a' }}>
      <h1 style={{ fontSize: 19, fontWeight: 700 }}>Cutout Lab — cutout-ai subs + v5.3.1 finishing</h1>
      <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>
        Upload → auto-detect → v5.3.1 outline finishing → <b>Save</b>. Brush: <b>Add fills into</b> the selection
        (gaps close, the rest stays) · <b>Erase subtracts</b> · <b>Re-detect</b> is the only full reset.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0', alignItems: 'center' }}>
        <label style={{ ...btn, cursor: 'pointer', background: '#2563eb', color: '#fff', borderColor: '#2563eb' }}>⬆ Upload image
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} /></label>
        <button onClick={save} disabled={!hasCut} style={{ ...btn, background: hasCut ? '#16a34a' : '#e5e7eb', color: hasCut ? '#fff' : '#9ca3af' }}>💾 Save</button>
        <button onClick={redetect} disabled={!hasCut || busy} style={btn}>↻ Re-detect</button>
        <span style={{ fontSize: 12, color: ready ? '#16a34a' : '#b45309', fontWeight: 600 }}>{ready ? `● ${device}` : '○ loading…'}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center', fontSize: 12, color: '#475569' }}>
        <span style={{ fontWeight: 700 }}>Model:</span>
        <select value={modelKey} disabled={busy} onChange={(e) => { setModelKey(e.target.value); loadModel(e.target.value, exec) }} style={{ ...btn, fontSize: 12 }}>
          {Object.values(MODELS).map((m) => (<option key={m.key} value={m.key}>{m.label}</option>))}
        </select>
        <span style={{ fontWeight: 700, marginLeft: 4 }}>Engine:</span>
        {(['auto', 'wasm'] as Exec[]).map((e) => (
          <button key={e} disabled={busy} onClick={() => { setExec(e); loadModel(modelKey, e) }} style={{ ...btn, fontSize: 12, background: exec === e ? '#7c3aed' : '#f1f5f9', color: exec === e ? '#fff' : '#0f172a' }}>{e === 'auto' ? 'Auto (WebGPU→WASM)' : 'Force WASM · Safari'}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center', fontSize: 12, color: '#475569' }}>
        {(['add', 'erase'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} style={{ ...btn, background: mode === m ? '#0f172a' : '#f1f5f9', color: mode === m ? '#fff' : '#0f172a' }}>{m === 'add' ? '🟢 Add (fill)' : '🔴 Erase'}</button>
        ))}
        <label style={lbl}>Brush {brushR}<input type="range" min={8} max={120} value={brushR} onChange={(e) => setBrushR(+e.target.value)} style={{ width: 80 }} /></label>
        <label style={lbl}>Detail {settings.detail}<input type="range" min={0} max={100} value={settings.detail} onChange={(e) => setTune({ detail: +e.target.value })} style={{ width: 80 }} /></label>
        <label style={lbl}>Offset {settings.offset}<input type="range" min={0} max={20} value={settings.offset} onChange={(e) => setTune({ offset: +e.target.value })} style={{ width: 80 }} /></label>
        <label style={lbl}>Smooth {settings.smooth}<input type="range" min={0} max={100} value={settings.smooth} onChange={(e) => setTune({ smooth: +e.target.value })} style={{ width: 80 }} /></label>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={cap}>Selection — green kept / red removed · blue = final outline</div>
          <canvas ref={viewRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
            style={{ width: disp.w, height: disp.h, border: '1px solid #e2e8f0', borderRadius: 8, touchAction: 'none', background: '#0b1220' }} />
        </div>
        <div>
          <div style={cap}>Sticker preview (v5.3.1 outline)</div>
          <canvas ref={prevRef} style={{ width: disp.w, height: disp.h, border: '1px solid #e2e8f0', borderRadius: 8 }} />
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, maxWidth: 620 }}>
        <Stat label="engine · model" value={device} />
        <Stat label="model load" value={ms.load != null ? `${ms.load}ms` : '—'} />
        <Stat label="encode / image" value={ms.encode != null ? `${ms.encode}ms` : '—'} />
        <Stat label="recognize" value={ms.recognize != null ? `${ms.recognize}ms` : '—'} />
      </div>
      <p style={{ marginTop: 12, fontSize: 13, color: '#334155' }}><b>Status:</b> {status}</p>
    </div>
  )
}

const btn: React.CSSProperties = { padding: '8px 12px', fontSize: 13, border: '1px solid #cbd5e1', borderRadius: 6, background: '#f1f5f9', fontWeight: 600 }
const lbl: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6 }
const cap: React.CSSProperties = { fontSize: 11, textTransform: 'uppercase', color: '#64748b', marginBottom: 4 }
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 10px' }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2, wordBreak: 'break-word' }}>{value}</div>
    </div>
  )
}
