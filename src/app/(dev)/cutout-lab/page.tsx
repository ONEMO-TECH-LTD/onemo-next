'use client'

// cutout-lab — EDGE-FIRST flow (Dan 2026-08-05, after the iPhone OOM): ONE AI runtime resident,
// ever. EdgeSAM loads up front and does BOTH the auto cut and the brush; u2net (v5.3.1 native) is
// the FALLBACK, entered only on a REGISTERED fault — a load/cut error or the client watchdog
// killing a frozen worker (iOS OOM freezes don't throw; the watchdog converts them to faults).
// Two runtimes in one iOS tab was the ceiling — that state no longer exists. Finishing is
// v5.3.1's outline engine (finish.ts glue). Shell is STATE + RENDER only (ARCHITECTURE.md).

import { useCallback, useEffect, useRef, useState } from 'react'
import { CutoutClient } from '@/lib/cutout-ai/client'
import { MODELS } from '@/lib/cutout-ai/registry'
import type { Mask, Point } from '@/lib/cutout-ai/types'
import { AUTO_SETTINGS, bakeSticker, BLEND_DEFAULTS, composeSticker, drawCutout, finishOutline, maskOverlay, PRESET_LABELS, type BlendSettings, type OutlineBounds, type PresetKey, type TraceOutlineSettings } from './finish'
import { preloadBen, segmentV531 } from './v531seg'

const WORK_MAX = 1024 // bounded working resolution (perf fix, s62)

export default function CutoutLab() {
  const [mode, setMode] = useState<'add' | 'erase'>('add')
  const [brushR, setBrushR] = useState(40)
  const [settings, setSettings] = useState<TraceOutlineSettings>(AUTO_SETTINGS)
  const [blend, setBlend] = useState<BlendSettings>(BLEND_DEFAULTS)
  const [status, setStatus] = useState('ready — upload an image')
  const [busy, setBusy] = useState(false)
  const [hasCut, setHasCut] = useState(false)
  const [edge, setEdge] = useState<'loading' | 'ready' | 'dead'>('loading')
  const [ms, setMs] = useState<{ cut?: number; stroke?: number }>({})
  const [disp, setDisp] = useState({ w: 480, h: 360 })

  const client = useRef<CutoutClient | null>(null)
  const imgCanvas = useRef<HTMLCanvasElement | null>(null) // master image at working res
  const viewRef = useRef<HTMLCanvasElement>(null)
  const prevRef = useRef<HTMLCanvasElement>(null)
  const maskRef = useRef<Mask | null>(null)
  const dRef = useRef<string | null>(null)
  const boundsRef = useRef<OutlineBounds | null>(null)
  const strokeRef = useRef<Point[]>([])
  const paintingRef = useRef(false)
  const cursorRef = useRef<{ x: number; y: number } | null>(null)
  const lastFileRef = useRef<File | null>(null)
  const edgeRef = useRef<'loading' | 'ready' | 'dead'>('loading'); edgeRef.current = edge
  const edgeEncodedRef = useRef(false)  // current image encoded in the worker
  const settingsRef = useRef(settings); settingsRef.current = settings
  const blendRef = useRef(blend); blendRef.current = blend
  const previewSeq = useRef(0)
  const modeRef = useRef(mode); modeRef.current = mode
  const hasCutRef = useRef(false); hasCutRef.current = hasCut
  const brushRef = useRef(brushR); brushRef.current = brushR

  // ── render (draw only — pixel/geometry work lives in finish.ts / the subs) ──
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
    const cur = cursorRef.current
    if (cur && hasCutRef.current && edgeRef.current === 'ready') {
      ctx.beginPath()
      ctx.arc(cur.x * img.width, cur.y * img.height, brushRef.current * (img.width / disp.w), 0, 6.29)
      ctx.lineWidth = Math.max(2, img.width * 0.003)
      ctx.strokeStyle = modeRef.current === 'add' ? 'rgba(34,197,94,1)' : 'rgba(239,68,68,1)'
      ctx.stroke()
    }
    if (prevRef.current && dRef.current && boundsRef.current && maskRef.current) {
      const seq = ++previewSeq.current
      const [mask, d, bounds] = [maskRef.current, dRef.current, boundsRef.current]
      composeSticker(prevRef.current, img, mask, d, bounds, blendRef.current)
        .catch(() => { if (seq === previewSeq.current && prevRef.current) drawCutout(prevRef.current!, img, d) })
    }
  }, [disp.w])

  const applyFinish = useCallback(() => {
    const mask = maskRef.current
    const fin = mask ? finishOutline(mask, settingsRef.current) : null
    dRef.current = fin?.d ?? null
    boundsRef.current = fin?.bounds ?? null
    render()
  }, [render])

  const acceptMask = useCallback((mask: Mask) => {
    maskRef.current = mask
    setHasCut(true)
    applyFinish()
    setStatus('✨ done — brush to fill/erase, tune sliders, Re-detect, or Save')
  }, [applyFinish])

  const edgeFault = useCallback((why: string) => {
    // REGISTERED fault → u2net takes over; the dead runtime's worker is gone (watchdog/terminate)
    edgeRef.current = 'dead'; setEdge('dead')
    preloadBen() // only NOW warm v5.3.1's engine — never two runtimes at once
    setStatus('⚠️ ' + why + ' — switched to u2net (auto only)')
  }, [])

  useEffect(() => {
    const c = new CutoutClient()
    client.current = c
    c.onProgress = (loaded, total) => setStatus(`⬇ AI ${(loaded / 1048576).toFixed(0)} / ${(total / 1048576).toFixed(0)} MB…`)
    ;(async () => {
      try {
        c.spawn()
        setStatus('⬇ loading AI (EdgeSAM, one-time)…')
        await c.load(MODELS.edgesam, 'auto')
        edgeRef.current = 'ready'; setEdge('ready')
        setStatus('ready — upload an image')
      } catch (e) { edgeFault('AI failed to start (' + String((e as Error).message) + ')') }
    })()
    return () => c.dispose()
  }, [edgeFault])

  // ── upload → u2net auto cut (the selected one-tap magic) ──
  const onFile = useCallback(async (file: File) => {
    lastFileRef.current = file
    maskRef.current = null; dRef.current = null; setHasCut(false); setMs({})
    edgeEncodedRef.current = false // new image → EdgeSAM must re-encode if/when brushed
    const url = URL.createObjectURL(file)
    const img = new Image(); img.src = url
    try { await img.decode() } catch (e) { URL.revokeObjectURL(url); setStatus('⚠️ could not open image: ' + String(e)); return }
    const s = Math.min(1, WORK_MAX / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s)
    const master = document.createElement('canvas'); master.width = w; master.height = h
    const mctx = master.getContext('2d', { willReadFrequently: true })!
    mctx.drawImage(img, 0, 0, w, h)
    imgCanvas.current = master
    const maxW = Math.min(520, typeof window !== 'undefined' ? window.innerWidth - 40 : 520)
    const k = Math.min(maxW / w, 440 / h, 1)
    setDisp({ w: Math.round(w * k), h: Math.round(h * k) })
    render()
    setBusy(true)
    if (edgeRef.current === 'ready') {
      try {
        setStatus('✨ AI magic (EdgeSAM)…')
        const t0 = performance.now()
        const px = mctx.getImageData(0, 0, w, h)
        await client.current!.encode(px.data, w, h)
        edgeEncodedRef.current = true
        const r = await client.current!.redetect()
        setMs({ cut: Math.round(performance.now() - t0) })
        acceptMask(r.mask)
        URL.revokeObjectURL(url); setBusy(false)
        return
      } catch (e) { edgeFault('AI froze on this image (' + String((e as Error).message) + ')') }
    }
    // fallback path — u2net via v5.3.1's own engine (auto only)
    try {
      setStatus('✨ AI magic (u2net fallback)…')
      const t0 = performance.now()
      const r = await segmentV531(url, WORK_MAX)
      setMs({ cut: Math.round(performance.now() - t0) })
      acceptMask(r.mask)
    } catch (e) { setStatus('⚠️ ' + String((e as Error).message)) }
    URL.revokeObjectURL(url)
    setBusy(false)
  }, [acceptMask, render])

  // ── brush prep: Edge is already resident; just sync the base (and encode if a fallback cut ran) ──
  const ensureEdge = useCallback(async () => {
    const c = client.current!
    if (!edgeEncodedRef.current) {
      setStatus('🧠 AI reading the image…')
      const img = imgCanvas.current!
      const px = img.getContext('2d')!.getImageData(0, 0, img.width, img.height)
      await c.encode(px.data, img.width, img.height)
      edgeEncodedRef.current = true
    }
    if (maskRef.current) await c.setBase(maskRef.current) // strokes edit the CURRENT accepted cut
  }, [])

  // ── brush (stroke = prompt; add unions into the base, erase subtracts — brush.ts owns it) ──
  const nrm = (e: React.PointerEvent): Point => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, label: 1 }
  }
  const onDown = (e: React.PointerEvent) => { if (!hasCut || busy || edgeRef.current !== 'ready') return; paintingRef.current = true; cursorRef.current = nrm(e); strokeRef.current = [nrm(e)]; render() }
  const onMove = (e: React.PointerEvent) => { cursorRef.current = nrm(e); if (paintingRef.current) strokeRef.current.push(nrm(e)); render() }
  const onUp = async () => {
    if (!paintingRef.current) return
    paintingRef.current = false
    const stroke = strokeRef.current; strokeRef.current = []
    if (stroke.length < 2) { render(); return }
    setBusy(true)
    try {
      await ensureEdge()
      setStatus(modeRef.current === 'add' ? '🟢 filling…' : '🔴 erasing…')
      const t0 = performance.now()
      const r = modeRef.current === 'add' ? await client.current!.addStroke(stroke) : await client.current!.eraseStroke(stroke)
      setMs((m) => ({ ...m, stroke: Math.round(performance.now() - t0) }))
      acceptMask(r.mask)
    } catch (e) { edgeFault('brush froze (' + String((e as Error).message) + ')') }
    setBusy(false)
  }

  const redetect = async () => {
    if (busy || !lastFileRef.current) return
    await onFile(lastFileRef.current) // full reset = re-run the u2net magic
  }

  const save = async () => {
    const img = imgCanvas.current
    if (!img || !dRef.current || !boundsRef.current || !maskRef.current) return
    const baked = await bakeSticker(img, maskRef.current, dRef.current, boundsRef.current, blendRef.current)
    baked.canvas.toBlob((b) => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'cutout.png'; a.click(); URL.revokeObjectURL(a.href) })
  }

  const setTune = (patch: Partial<TraceOutlineSettings>) => { setSettings((s) => { const n = { ...s, ...patch }; settingsRef.current = n; return n }); requestAnimationFrame(applyFinish) }
  const setBlendTune = (patch: Partial<BlendSettings>) => { setBlend((b) => { const n = { ...b, ...patch }; blendRef.current = n; return n }); requestAnimationFrame(render) }

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: 20, fontFamily: 'ui-sans-serif, system-ui', color: '#0f172a' }}>
      <h1 style={{ fontSize: 19, fontWeight: 700 }}>Cutout Lab — EdgeSAM magic + brush · u2net fallback</h1>
      <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>
        One AI resident: <b>EdgeSAM</b> auto-cuts on upload and powers the brush (<b>Add fills into</b> the cut,
        <b>Erase subtracts</b>). If it faults or freezes, the watchdog registers it and <b>u2net</b> takes over (auto only).
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0', alignItems: 'center' }}>
        <label style={{ ...btn, cursor: 'pointer', background: '#2563eb', color: '#fff', borderColor: '#2563eb' }}>⬆ Upload image
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} /></label>
        <button onClick={save} disabled={!hasCut} style={{ ...btn, background: hasCut ? '#16a34a' : '#e5e7eb', color: hasCut ? '#fff' : '#9ca3af' }}>💾 Save</button>
        <button onClick={redetect} disabled={!hasCut || busy} style={btn}>↻ Re-detect</button>
        <span style={{ fontSize: 12, color: edge === 'dead' ? '#b45309' : '#475569' }}>engine: <b>{edge === 'ready' ? 'EdgeSAM (auto + brush)' : edge === 'loading' ? 'EdgeSAM loading…' : 'u2net fallback (auto only, brush off)'}</b></span>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center', fontSize: 12, color: '#475569' }}>
        {(['add', 'erase'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} style={{ ...btn, background: mode === m ? '#0f172a' : '#f1f5f9', color: mode === m ? '#fff' : '#0f172a' }}>{m === 'add' ? '🟢 Add (fill)' : '🔴 Erase'}</button>
        ))}
        <Knob label="Brush" value={brushR} lo={8} hi={120} onChange={setBrushR} />
      </div>

      {/* VECTOR — the full v5.3.1 outline tool set (resolveTraceOutline). Birth = angled/simplified/offset, sharp. */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center', fontSize: 12, color: '#475569' }}>
        <span style={{ fontWeight: 700 }}>Vector:</span>
        {([['detail', 0, 100], ['offset', 0, 20], ['simplify', 0, 100], ['smooth', 0, 100], ['straighten', 0, 100], ['radius', 0, 100], ['curve', 0, 100]] as const).map(([k, lo, hi]) => (
          <Knob key={k} label={k} value={settings[k]} lo={lo} hi={hi} onChange={(v) => setTune({ [k]: v })} />
        ))}
        <span>join:</span>
        {(['sharp', 'round', 'bevel'] as const).map((j) => (
          <button key={j} onClick={() => setTune({ offsetJoin: j })} style={{ ...btn, padding: '4px 8px', fontSize: 11, background: settings.offsetJoin === j ? '#0f172a' : '#f1f5f9', color: settings.offsetJoin === j ? '#fff' : '#0f172a' }}>{j}</button>
        ))}
      </div>

      {/* BLEND — the s59-decoupled v5.3.1 2D artwork operation (composite.ts). */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center', fontSize: 12, color: '#475569' }}>
        <span style={{ fontWeight: 700 }}>Blend:</span>
        <Knob label="blend" value={blend.blend} lo={0} hi={100} onChange={(v) => setBlendTune({ blend: v })} />
        <Knob label="vignette" value={blend.vignette} lo={0} hi={100} onChange={(v) => setBlendTune({ vignette: v })} />
        {(['clamp', 'tile'] as const).map((f) => (
          <button key={f} onClick={() => setBlendTune({ fill: f })} style={{ ...btn, padding: '4px 8px', fontSize: 11, background: blend.fill === f ? '#0f172a' : '#f1f5f9', color: blend.fill === f ? '#fff' : '#0f172a' }}>{f}</button>
        ))}
        <select value={blend.preset} onChange={(e) => setBlendTune({ preset: e.target.value as PresetKey })} style={{ ...btn, fontSize: 11, padding: '4px 8px' }}>
          {Object.entries(PRESET_LABELS).map(([k, label]) => (<option key={k} value={k}>{label}</option>))}
        </select>
        <label style={lbl}>tint<input type="color" value={blend.tint ?? '#000000'} onChange={(e) => setBlendTune({ tint: e.target.value })} style={{ width: 28, height: 22, padding: 0, border: 'none' }} /></label>
        {blend.tint && <button onClick={() => setBlendTune({ tint: null })} style={{ ...btn, padding: '4px 8px', fontSize: 11 }}>tint off</button>}
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={cap}>Selection — green kept / red removed · blue = final outline</div>
          <canvas ref={viewRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => { cursorRef.current = null; onUp() }}
            style={{ width: disp.w, height: disp.h, border: '1px solid #e2e8f0', borderRadius: 8, touchAction: 'none', background: '#0b1220', cursor: 'crosshair' }} />
        </div>
        <div>
          <div style={cap}>Sticker preview (v5.3.1 outline)</div>
          <canvas ref={prevRef} style={{ width: disp.w, height: disp.h, border: '1px solid #e2e8f0', borderRadius: 8 }} />
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, maxWidth: 460 }}>
        <Stat label="magic cut" value={ms.cut != null ? `${ms.cut}ms` : '—'} />
        <Stat label="brush stroke" value={ms.stroke != null ? `${ms.stroke}ms` : '—'} />
      </div>
      <p style={{ marginTop: 12, fontSize: 13, color: '#334155' }}><b>Status:</b> {status}</p>
    </div>
  )
}

const btn: React.CSSProperties = { padding: '8px 12px', fontSize: 13, border: '1px solid #cbd5e1', borderRadius: 6, background: '#f1f5f9', fontWeight: 600 }
function Knob({ label, value, lo, hi, onChange }: { label: string; value: number; lo: number; hi: number; onChange: (v: number) => void }) {
  const clamp = (v: number) => Math.max(lo, Math.min(hi, Math.round(v)))
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {label}
      <input type="number" min={lo} max={hi} value={value} onChange={(e) => onChange(clamp(+e.target.value))}
        style={{ width: 44, padding: '3px 4px', fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 4 }} />
      <input type="range" min={lo} max={hi} step={1} value={value} onChange={(e) => onChange(clamp(+e.target.value))} style={{ width: 130 }} />
    </label>
  )
}
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
