'use client'

// Grid Lab v2 — Control surface (P6, fresh build).
//
// The ADMIN control/config surface. ZERO engine logic (law §10.2): it edits + SAVES the EngineConfig,
// reaches EVERY focal handle, calls the sealed API (solveGrid/solveLadder), feeds AI outlines to the
// freeform strategy, and renders what comes back. Clipper is driven by the engine, never touched here.
// Boot = the garment canon: Light · 96 · dice · magnetic (law §4.3, §6.2).

import { useEffect, useMemo, useState } from 'react'
import {
  solveGrid,
  solveLadder,
  defaultConfig,
  type EngineInput,
  type EngineOutput,
  type ShapeFamily,
  type Mode,
  type Pattern,
  type AttachmentMode,
  type GarmentLayout,
} from '@/lib/grid-v2'

const FAMILIES: ShapeFamily[] = ['square', 'rectangle', 'triangle', 'diamond', 'circle', 'pill', 'freeform']
const PATTERNS: Pattern[] = ['straight', 'diamond', 'dice']
const ATTACHMENTS: AttachmentMode[] = ['magnetic', 'twin-fix', 'velcro']
const ROUNDABLE: ReadonlySet<ShapeFamily> = new Set(['square', 'rectangle', 'triangle', 'diamond'])
const STORAGE_KEY = 'grid-lab-v2.config'

/** pitch + pattern → the garment layout it represents (for the 5.1a attachment filter). */
function garmentLayout(pitchMM: number, pattern: Pattern): GarmentLayout | null {
  if (pattern === 'straight') return pitchMM === 48 ? '48-straight' : pitchMM === 96 ? '96-straight' : null
  if (pattern === 'dice' && pitchMM === 96) return '96-dice'
  return null // diamond pattern / 48-dice are not garment-canon layouts
}

interface ConfigOverrides {
  paddingMM: number
  frameMM: number
  ceilingMM: number
  extremeMM: number
  interiorMM: number
  marginAllowanceMM: number
  registration: 'centroid' | 'bbox-center'
}
const DEFAULT_OVERRIDES: ConfigOverrides = {
  paddingMM: defaultConfig.padding.radiusMM,
  frameMM: defaultConfig.frame.defaultMM,
  ceilingMM: defaultConfig.bounds.ceilingMM,
  extremeMM: defaultConfig.magnets.extremeMM,
  interiorMM: defaultConfig.magnets.interiorMM,
  marginAllowanceMM: defaultConfig.padding.marginAllowanceMM,
  registration: defaultConfig.registration.default,
}
function toEngineConfig(o: ConfigOverrides) {
  return {
    padding: { radiusMM: o.paddingMM, marginAllowanceMM: o.marginAllowanceMM },
    frame: { defaultMM: o.frameMM },
    bounds: { ceilingMM: o.ceilingMM },
    magnets: { extremeMM: o.extremeMM, interiorMM: o.interiorMM },
    registration: { default: o.registration },
  }
}

export default function GridLabV2Bench() {
  // Boot = garment canon (law §4.3/§6.2): Light · 96 · dice · magnetic.
  const [family, setFamily] = useState<ShapeFamily>('square')
  const [mode, setMode] = useState<Mode>('light')
  const [pitchMM, setPitchMM] = useState<number>(96)
  const [pattern, setPattern] = useState<Pattern>('dice')
  const [attachment, setAttachment] = useState<AttachmentMode>('magnetic')
  const [nx, setNx] = useState(3)
  const [ny, setNy] = useState(3)
  const [radiusByFamily, setRadiusByFamily] = useState<Partial<Record<ShapeFamily, number>>>({}) // per-family, no leak
  const [overrides, setOverrides] = useState<ConfigOverrides>(DEFAULT_OVERRIDES)
  const [saved, setSaved] = useState<string | null>(null)
  const [aiOutline, setAiOutline] = useState<{ x: number; y: number }[] | null>(null)
  const [aiStatus, setAiStatus] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) setOverrides({ ...DEFAULT_OVERRIDES, ...JSON.parse(raw) })
    } catch {
      /* first run */
    }
  }, [])

  const cornerRadiusMM = ROUNDABLE.has(family) ? radiusByFamily[family] ?? 0 : 0
  const lawfulNx = family === 'triangle' && nx % 2 === 0 ? nx + 1 : nx
  const diceLegal = pitchMM === 96
  const layout = garmentLayout(pitchMM, pattern)
  const compatibleLayouts = defaultConfig.attachment.compatibility[attachment]
  const attachmentOk = layout != null && compatibleLayouts.includes(layout)

  const input: EngineInput = useMemo(
    () => ({
      family,
      span: { nx: lawfulNx, ny },
      pitchMM,
      mode,
      pattern,
      cornerRadiusMM,
      contour: family === 'freeform' ? aiOutline ?? undefined : undefined,
      config: toEngineConfig(overrides),
    }),
    [family, lawfulNx, ny, pitchMM, mode, pattern, cornerRadiusMM, aiOutline, overrides],
  )

  const { result, error } = useMemo(() => {
    if (family === 'freeform' && !aiOutline) return { result: null as EngineOutput | null, error: 'Upload an image for AI Magic →' }
    try {
      return { result: solveGrid(input), error: null as string | null }
    } catch (e) {
      return { result: null as EngineOutput | null, error: (e as Error).message }
    }
  }, [input, family, aiOutline])

  const ladder = useMemo(() => {
    try {
      return solveLadder(input)
    } catch {
      return []
    }
  }, [input])

  const save = () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
    setSaved(`saved`)
  }
  const reload = () => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      setOverrides(raw ? { ...DEFAULT_OVERRIDES, ...JSON.parse(raw) } : DEFAULT_OVERRIDES)
      setSaved('reloaded')
    } catch {
      setOverrides(DEFAULT_OVERRIDES)
    }
  }

  // AI Magic: image → v5.3.1 cut-out + traced outline → freeform contour (mm) → engine.
  const onImage = async (file: File | undefined) => {
    if (!file) return
    setAiStatus('cutting…')
    setFamily('freeform')
    const url = URL.createObjectURL(file)
    try {
      const { prepareShaped } = await import('../v5.3.1/core/primitives')
      const prepared = await prepareShaped(url, undefined, (s) => setAiStatus(s))
      // geometryMM is the derived manufacturing contour (mm, y-up); its points are [x, y] tuples.
      const pts = prepared.spec.geometryMM.outer.pts.map((p) => ({ x: p[0], y: p[1] }))
      if (pts.length < 3) throw new Error('outline too small')
      setAiOutline(pts)
      setAiStatus(`outline: ${pts.length} pts`)
    } catch (e) {
      setAiOutline(null)
      setAiStatus(`AI error: ${(e as Error).message}`) // fail loud, never a silent spinner (law §9.2)
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div style={S.page}>
      <header style={S.header}>
        <h1 style={S.h1}>Grid Lab v2 — control surface</h1>
        <span style={S.sub}>engine <code>src/lib/grid-v2</code> · sealed API · clipper-driven · boot = garment canon (Light·96·dice·magnetic)</span>
      </header>

      <div style={S.body}>
        <aside style={S.panel}>
          <Sec title="Shape">
            <Chips items={FAMILIES} value={family} onPick={setFamily} />
          </Sec>

          <Sec title="Mode — Light is the product default; Standard is admin">
            <Chips items={['light', 'standard'] as Mode[]} value={mode} onPick={setMode} />
          </Sec>

          <Sec title="Density (pitch)">
            <Chips items={defaultConfig.lattice.pitchSetMM} value={pitchMM} onPick={(p) => { setPitchMM(p); if (p === 48 && pattern === 'dice') setPattern('straight') }} suffix="mm" />
          </Sec>

          <Sec title="Pattern (dice = the garment canvas, legal only at 96)">
            <div style={S.chips}>
              {PATTERNS.map((p) => {
                const disabled = p === 'dice' && !diceLegal
                return (
                  <button key={p} disabled={disabled} onClick={() => setPattern(p)} style={chip(p === pattern, disabled)}>{p}</button>
                )
              })}
            </div>
            {!diceLegal && <div style={S.note}>dice is greyed at 48mm — its cell centres would land at 24mm (law §4.3a)</div>}
          </Sec>

          <Sec title="Attachment — live 5.1a compatibility">
            <Chips items={ATTACHMENTS} value={attachment} onPick={setAttachment} />
            <div style={S.note}>
              holds on: {compatibleLayouts.join(' · ')}
              {layout && (attachmentOk
                ? <span style={S.ok}> — current {layout} ✓</span>
                : <span style={S.bad}> — current {layout} ✗ incompatible (law §5.1a)</span>)}
              {!layout && <span style={S.bad}> — {pattern}·{pitchMM} is not a garment layout</span>}
            </div>
          </Sec>

          <Sec title="Size (magnet span)">
            <Range label={`nx = ${lawfulNx}${family === 'triangle' && nx % 2 === 0 ? ' (triangle base must be odd)' : ''}`} min={2} max={8} value={nx} onChange={setNx} />
            {family === 'rectangle' && <Range label={`ny = ${ny}`} min={1} max={8} value={ny} onChange={setNy} />}
            {ROUNDABLE.has(family) && (
              <Range label={`corner radius = ${cornerRadiusMM}mm`} min={0} max={40} value={cornerRadiusMM}
                onChange={(v) => setRadiusByFamily((r) => ({ ...r, [family]: v }))} />
            )}
          </Sec>

          <Sec title="AI Magic — image → v5.3.1 outline → freeform">
            <input type="file" accept="image/*" onChange={(e) => onImage(e.target.files?.[0])} style={S.file} />
            {aiStatus && <div style={S.note}>{aiStatus}</div>}
          </Sec>
        </aside>

        <main style={S.stage}>
          {error ? (
            <div style={S.error}>{error}</div>
          ) : result ? (
            <>
              <Stage result={result} />
              <div style={S.readout}>
                <b>{result.family}</b> · {mode} · {pattern} · {pitchMM}mm · <b>{result.sizeMM.widthMM}×{result.sizeMM.heightMM}mm</b>
                {result.spec.frameMM > 0 && <> · frame {result.spec.frameMM}mm → {result.spec.framedBboxMM.widthMM}×{result.spec.framedBboxMM.heightMM}mm</>}
                {' · '}{result.population.length} magnets · attach {attachment}
              </div>
            </>
          ) : (
            <div style={S.error}>no result</div>
          )}
        </main>

        <aside style={S.panel}>
          <Sec title="Size ladder (vs published catalogue)">
            {ladder.length === 0 ? (
              <span style={S.sub}>slider family — no tier ladder (law §3.14)</span>
            ) : (
              <div style={S.ladder}>
                {ladder.map((r) => (
                  <button key={r.label} onClick={() => { setNx(r.span.nx); setNy(r.span.ny) }} style={chip(r.span.nx === lawfulNx && r.span.ny === ny, false)}>
                    <b>{r.label}</b> · {r.sizeMM}mm
                  </button>
                ))}
              </div>
            )}
          </Sec>

          <Sec title="Admin config (editable · saved · reloaded)">
            <Num label="padding" value={overrides.paddingMM} onChange={(v) => setOverrides({ ...overrides, paddingMM: v })} />
            <Num label="frame" value={overrides.frameMM} onChange={(v) => setOverrides({ ...overrides, frameMM: v })} />
            <Num label="ceiling" value={overrides.ceilingMM} onChange={(v) => setOverrides({ ...overrides, ceilingMM: v })} />
            <Num label="focal magnet" value={overrides.extremeMM} onChange={(v) => setOverrides({ ...overrides, extremeMM: v })} />
            <Num label="interior magnet" value={overrides.interiorMM} onChange={(v) => setOverrides({ ...overrides, interiorMM: v })} />
            <Num label="margin band" value={overrides.marginAllowanceMM} onChange={(v) => setOverrides({ ...overrides, marginAllowanceMM: v })} />
            <label style={S.numField}>
              <span style={S.rangeLabel}>registration</span>
              <select value={overrides.registration} onChange={(e) => setOverrides({ ...overrides, registration: e.target.value as ConfigOverrides['registration'] })} style={S.numInput}>
                <option value="centroid">centroid</option>
                <option value="bbox-center">bbox-center</option>
              </select>
            </label>
            <div style={S.chips}>
              <button onClick={save} style={chip(false, false)}>save</button>
              <button onClick={reload} style={chip(false, false)}>reload</button>
              {saved && <span style={S.ok}>{saved}</span>}
            </div>
          </Sec>
        </aside>
      </div>
    </div>
  )
}

function Stage({ result }: { result: EngineOutput }) {
  const paths = result.contour.paths
  const plan = result.spec.magnetPlan
  const all = [...paths.flat(), ...plan.map((m) => ({ x: m.x, y: m.y }))]
  const pad = 24
  const minX = Math.min(...all.map((p) => p.x)) - pad, maxX = Math.max(...all.map((p) => p.x)) + pad
  const minY = Math.min(...all.map((p) => p.y)) - pad, maxY = Math.max(...all.map((p) => p.y)) + pad
  const w = maxX - minX, h = maxY - minY
  const maxD = plan.reduce((mx, m) => Math.max(mx, m.diameterMM), 0)
  const d = paths.map((ring) => 'M ' + ring.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ') + ' Z').join(' ')
  return (
    <svg viewBox={`${minX} ${minY} ${w} ${h}`} style={S.svg} preserveAspectRatio="xMidYMid meet">
      <g transform={`translate(0 ${minY + maxY}) scale(1 -1)`}>
        <path d={d} fill="rgba(80,140,255,0.12)" stroke="#3b82f6" strokeWidth={Math.max(w, h) / 260} fillRule="evenodd" />
        {plan.map((m, i) => (
          <circle key={i} cx={m.x} cy={m.y} r={m.diameterMM / 2} fill={m.diameterMM === maxD ? '#ef4444' : '#111827'} />
        ))}
      </g>
    </svg>
  )
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return <section style={{ marginBottom: 16 }}><div style={S.secTitle}>{title}</div>{children}</section>
}
function Chips<T extends string | number>({ items, value, onPick, suffix = '' }: { items: readonly T[]; value: T; onPick: (v: T) => void; suffix?: string }) {
  return <div style={S.chips}>{items.map((it) => <button key={String(it)} onClick={() => onPick(it)} style={chip(it === value, false)}>{it}{suffix}</button>)}</div>
}
function Range({ label, min, max, value, onChange }: { label: string; min: number; max: number; value: number; onChange: (v: number) => void }) {
  return <label style={S.range}><span style={S.rangeLabel}>{label}</span><input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: '100%' }} /></label>
}
function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return <label style={S.numField}><span style={S.rangeLabel}>{label}</span><input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} style={S.numInput} /></label>
}
const chip = (active: boolean, disabled: boolean): React.CSSProperties => ({
  padding: '6px 12px', borderRadius: 8, border: '1px solid', fontSize: 13,
  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
  borderColor: active ? '#3b82f6' : '#d1d5db', background: active ? '#3b82f6' : '#fff', color: active ? '#fff' : '#374151',
})
const S: Record<string, React.CSSProperties> = {
  page: { fontFamily: 'ui-sans-serif, system-ui, sans-serif', color: '#111827', background: '#f9fafb', minHeight: '100vh' },
  header: { padding: '14px 22px', borderBottom: '1px solid #e5e7eb', background: '#fff', display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' },
  h1: { fontSize: 17, fontWeight: 700, margin: 0 },
  sub: { fontSize: 12, color: '#6b7280' },
  body: { display: 'grid', gridTemplateColumns: '300px 1fr 240px', gap: 14, padding: 14, alignItems: 'start' },
  panel: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 },
  secTitle: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: '#9ca3af', marginBottom: 7, fontWeight: 600 },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  note: { fontSize: 11, color: '#6b7280', marginTop: 6, lineHeight: 1.5 },
  ok: { color: '#059669' },
  bad: { color: '#b91c1c' },
  range: { display: 'block', marginBottom: 10 },
  rangeLabel: { display: 'block', fontSize: 12, color: '#4b5563', marginBottom: 2 },
  numField: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7, gap: 8 },
  numInput: { width: 96, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 },
  file: { fontSize: 12, width: '100%' },
  stage: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 },
  svg: { width: '100%', height: 470, background: '#fbfbfd', borderRadius: 8 },
  readout: { fontSize: 13, color: '#374151' },
  error: { color: '#b45309', fontSize: 14, padding: 24 },
  ladder: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 },
}
