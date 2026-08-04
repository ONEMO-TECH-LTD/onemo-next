'use client'

// Grid Lab v2 — Control surface (P6).
//
// The ADMIN control/config surface for the grid engine. It holds ZERO engine logic (law §10.2):
// it edits + SAVES the EngineConfig, calls the sealed API (`solveGrid` / `solveLadder`), and renders
// what comes back. Clipper is controlled by the engine, never touched here. Every focal value is an
// editable, saved input (law §7/§10.6). Disposable viewer — the engine is the product.

import { useEffect, useMemo, useState } from 'react'
import {
  solveGrid,
  solveLadder,
  defaultConfig,
  type EngineInput,
  type ShapeFamily,
  type Mode,
} from '@/lib/grid-v2'

const FAMILIES: ShapeFamily[] = ['square', 'rectangle', 'triangle', 'diamond', 'circle', 'pill', 'freeform']
const STORAGE_KEY = 'grid-lab-v2.config'

// A sample freeform (AI-class) outline — the engine only ever receives a finished contour.
function sampleBlob(points = 12, wobble = 0.45): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  for (let i = 0; i < points; i++) {
    const a = (i / points) * 2 * Math.PI
    const r = 120 * (1 + (i % 2 === 0 ? wobble : -wobble))
    out.push({ x: 300 + r * Math.cos(a), y: 300 + r * Math.sin(a) })
  }
  return out
}

interface ConfigOverrides {
  paddingMM: number
  frameMM: number
  ceilingMM: number
  extremeMM: number
  interiorMM: number
}

const DEFAULT_OVERRIDES: ConfigOverrides = {
  paddingMM: defaultConfig.padding.radiusMM,
  frameMM: defaultConfig.frame.defaultMM,
  ceilingMM: defaultConfig.bounds.ceilingMM,
  extremeMM: defaultConfig.magnets.extremeMM,
  interiorMM: defaultConfig.magnets.interiorMM,
}

function toEngineConfig(o: ConfigOverrides) {
  return {
    padding: { radiusMM: o.paddingMM },
    frame: { defaultMM: o.frameMM },
    bounds: { ceilingMM: o.ceilingMM },
    magnets: { extremeMM: o.extremeMM, interiorMM: o.interiorMM },
  }
}

export default function GridLabV2Bench() {
  const [family, setFamily] = useState<ShapeFamily>('square')
  const [mode, setMode] = useState<Mode>(defaultConfig.publication.defaultMode) // Light is the product default (§4.3)
  const [pitchMM, setPitchMM] = useState<number>(defaultConfig.lattice.basePitchMM)
  const [nx, setNx] = useState(3)
  const [ny, setNy] = useState(3)
  const [cornerRadiusMM, setCornerRadiusMM] = useState(0)
  const [overrides, setOverrides] = useState<ConfigOverrides>(DEFAULT_OVERRIDES)
  const [saved, setSaved] = useState<string | null>(null)

  // Load saved config on mount (the persistence side of the admin layer).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) setOverrides({ ...DEFAULT_OVERRIDES, ...JSON.parse(raw) })
    } catch {
      /* first run / private mode — fall back to defaults */
    }
  }, [])

  const contour = useMemo(() => (family === 'freeform' ? sampleBlob() : undefined), [family])

  // A triangle's base must be odd for its apex to land on a magnet (law §3.2) — keep the bench lawful.
  const lawfulNx = family === 'triangle' && nx % 2 === 0 ? nx + 1 : nx

  const input: EngineInput = useMemo(
    () => ({ family, span: { nx: lawfulNx, ny }, pitchMM, mode, cornerRadiusMM, contour, config: toEngineConfig(overrides) }),
    [family, lawfulNx, ny, pitchMM, mode, cornerRadiusMM, contour, overrides],
  )

  const { result, error } = useMemo(() => {
    try {
      return { result: solveGrid(input), error: null as string | null }
    } catch (e) {
      return { result: null, error: (e as Error).message }
    }
  }, [input])

  const ladder = useMemo(() => {
    try {
      return solveLadder(input)
    } catch {
      return []
    }
  }, [input])

  const save = () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
    setSaved(`saved ${new Date().toLocaleTimeString()}`)
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

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.h1}>Grid Lab v2 — control surface</h1>
        <span style={styles.sub}>engine: <code>src/lib/grid-v2</code> · sealed API · clipper-driven</span>
      </header>

      <div style={styles.body}>
        {/* ── Controls ───────────────────────────────────────────────── */}
        <aside style={styles.panel}>
          <Section title="Shape">
            <div style={styles.chips}>
              {FAMILIES.map((f) => (
                <button key={f} onClick={() => setFamily(f)} style={chip(f === family)}>{f}</button>
              ))}
            </div>
          </Section>

          <Section title="Mode (Light = product default)">
            <div style={styles.chips}>
              {(['light', 'standard'] as Mode[]).map((m) => (
                <button key={m} onClick={() => setMode(m)} style={chip(m === mode)}>{m}</button>
              ))}
            </div>
          </Section>

          <Section title="Density (pitch)">
            <div style={styles.chips}>
              {defaultConfig.lattice.pitchSetMM.map((p) => (
                <button key={p} onClick={() => setPitchMM(p)} style={chip(p === pitchMM)}>{p}mm</button>
              ))}
            </div>
          </Section>

          <Section title="Size (magnet span)">
            <Range label={`nx = ${nx}`} min={2} max={8} value={nx} onChange={setNx} />
            <Range label={`ny = ${ny}`} min={1} max={8} value={ny} onChange={setNy} />
            {(family === 'square' || family === 'triangle' || family === 'diamond') && (
              <Range label={`corner radius = ${cornerRadiusMM}mm`} min={0} max={40} value={cornerRadiusMM} onChange={setCornerRadiusMM} />
            )}
          </Section>

          <Section title="Admin config (editable · saved)">
            <NumField label="padding (mm)" value={overrides.paddingMM} onChange={(v) => setOverrides({ ...overrides, paddingMM: v })} />
            <NumField label="frame (mm)" value={overrides.frameMM} onChange={(v) => setOverrides({ ...overrides, frameMM: v })} />
            <NumField label="ceiling (mm)" value={overrides.ceilingMM} onChange={(v) => setOverrides({ ...overrides, ceilingMM: v })} />
            <NumField label="focal magnet (mm)" value={overrides.extremeMM} onChange={(v) => setOverrides({ ...overrides, extremeMM: v })} />
            <NumField label="interior magnet (mm)" value={overrides.interiorMM} onChange={(v) => setOverrides({ ...overrides, interiorMM: v })} />
            <div style={styles.chips}>
              <button onClick={save} style={chip(false)}>save</button>
              <button onClick={reload} style={chip(false)}>reload</button>
              {saved && <span style={styles.saved}>{saved}</span>}
            </div>
          </Section>
        </aside>

        {/* ── Stage ──────────────────────────────────────────────────── */}
        <main style={styles.stage}>
          {error ? (
            <div style={styles.error}>engine error: {error}</div>
          ) : result ? (
            <>
              <Stage result={result} />
              <div style={styles.readout}>
                <b>{result.family}</b> · {mode} · {pitchMM}mm ·{' '}
                <b>{result.sizeMM.widthMM}×{result.sizeMM.heightMM}mm</b>
                {result.spec.frameMM > 0 && <> · frame {result.spec.frameMM}mm → {result.spec.framedBboxMM.widthMM}×{result.spec.framedBboxMM.heightMM}</>}
                {' · '}{result.population.length} magnets · area {result.spec.areaMM2}mm²
                {' · '}{result.contour.analytic.kind}
              </div>
            </>
          ) : (
            <div style={styles.error}>no result</div>
          )}
        </main>

        {/* ── Ladder ─────────────────────────────────────────────────── */}
        <aside style={styles.panel}>
          <Section title="Size ladder">
            {ladder.length === 0 ? (
              <span style={styles.sub}>slider family — no tier ladder</span>
            ) : (
              <div style={styles.ladder}>
                {ladder.map((r) => (
                  <button
                    key={r.label}
                    onClick={() => { setNx(r.span.nx); setNy(r.span.ny) }}
                    style={chip(r.span.nx === nx && r.span.ny === ny)}
                  >
                    <b>{r.label}</b> · {r.sizeMM}mm
                  </button>
                ))}
              </div>
            )}
          </Section>
        </aside>
      </div>
    </div>
  )
}

// ── The visual stage — draws contour + magnets from the spec (no engine logic here) ──
function Stage({ result }: { result: ReturnType<typeof solveGrid> }) {
  const paths = result.contour.paths
  const plan = result.spec.magnetPlan
  const all = [...paths.flat(), ...plan.map((m) => ({ x: m.x, y: m.y }))]
  const pad = 24
  const minX = Math.min(...all.map((p) => p.x)) - pad
  const maxX = Math.max(...all.map((p) => p.x)) + pad
  const minY = Math.min(...all.map((p) => p.y)) - pad
  const maxY = Math.max(...all.map((p) => p.y)) + pad
  const w = maxX - minX
  const h = maxY - minY
  const maxD = plan.reduce((mx, m) => Math.max(mx, m.diameterMM), 0) // the focal (extreme) diameter
  // Flip Y (math y-up → SVG y-down) via viewBox + a scale(1,-1) group.
  const d = paths.map((ring) => 'M ' + ring.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ') + ' Z').join(' ')

  return (
    <svg viewBox={`${minX} ${minY} ${w} ${h}`} style={styles.svg} preserveAspectRatio="xMidYMid meet">
      <g transform={`translate(0 ${minY + maxY}) scale(1 -1)`}>
        <path d={d} fill="rgba(80,140,255,0.12)" stroke="#3b82f6" strokeWidth={Math.max(w, h) / 260} fillRule="evenodd" />
        {plan.map((m, i) => (
          <circle key={i} cx={m.x} cy={m.y} r={m.diameterMM / 2} fill={m.diameterMM === maxD ? '#ef4444' : '#111827'} />
        ))}
      </g>
    </svg>
  )
}

// ── tiny presentational helpers ──
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 18 }}>
      <div style={styles.sectionTitle}>{title}</div>
      {children}
    </section>
  )
}
function Range({ label, min, max, value, onChange }: { label: string; min: number; max: number; value: number; onChange: (v: number) => void }) {
  return (
    <label style={styles.range}>
      <span style={styles.rangeLabel}>{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: '100%' }} />
    </label>
  )
}
function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label style={styles.numField}>
      <span style={styles.rangeLabel}>{label}</span>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} style={styles.numInput} />
    </label>
  )
}
const chip = (active: boolean): React.CSSProperties => ({
  padding: '6px 12px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontSize: 13,
  borderColor: active ? '#3b82f6' : '#d1d5db', background: active ? '#3b82f6' : '#fff', color: active ? '#fff' : '#374151',
})

const styles: Record<string, React.CSSProperties> = {
  page: { fontFamily: 'ui-sans-serif, system-ui, sans-serif', color: '#111827', background: '#f9fafb', minHeight: '100vh' },
  header: { padding: '16px 24px', borderBottom: '1px solid #e5e7eb', background: '#fff', display: 'flex', alignItems: 'baseline', gap: 16 },
  h1: { fontSize: 18, fontWeight: 700, margin: 0 },
  sub: { fontSize: 12, color: '#6b7280' },
  body: { display: 'grid', gridTemplateColumns: '300px 1fr 220px', gap: 16, padding: 16, alignItems: 'start' },
  panel: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 },
  sectionTitle: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#9ca3af', marginBottom: 8, fontWeight: 600 },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  range: { display: 'block', marginBottom: 10 },
  rangeLabel: { display: 'block', fontSize: 12, color: '#4b5563', marginBottom: 2 },
  numField: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 },
  numInput: { width: 80, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 },
  stage: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 },
  svg: { width: '100%', height: 460, background: '#fbfbfd', borderRadius: 8 },
  readout: { fontSize: 13, color: '#374151' },
  error: { color: '#b91c1c', fontSize: 14, padding: 24 },
  ladder: { display: 'flex', flexDirection: 'column', gap: 6 },
  saved: { fontSize: 11, color: '#059669' },
}
