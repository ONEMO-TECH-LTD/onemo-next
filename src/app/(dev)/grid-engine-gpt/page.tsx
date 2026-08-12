'use client'

// GPT-Pro reference engine — test surface.
//
// The shape comes from a dropped cut-out or one of the seven saved traces. Everything drawn below
// the shape is the engine's own answer, returned by the C++ core through /api/magfit: the size, the
// magnet coordinates, the verified 24 mm links, the limiting contact and the flap numbers. This page
// computes no geometry of its own — it maps millimetres to pixels and draws.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { traceContourRaw } from '@/lib/effect/contour'

type Outline = Array<[number, number]>

type MagnetOut = { x24: number; y24: number; xMm: number; yMm: number }

type BandOut = {
  band: number
  fit: boolean
  reason: string
  sizeMm?: number
  widthMm?: number
  heightMm?: number
  templateRunsX?: number
  templateRunsY?: number
  magnets?: MagnetOut[]
  links?: Array<{ ax: number; ay: number; bx: number; by: number }>
  binding?: {
    kind: string
    nodeXMm: number
    nodeYMm: number
    edgeIndex: number
    clearanceMm: number
    slackMm: number
  }
  flap?: {
    leftMm: number
    rightMm: number
    bottomMm: number
    topMm: number
    left12: boolean
    right12: boolean
    bottom12: boolean
    top12: boolean
    left24: boolean
    right24: boolean
    bottom24: boolean
    top24: boolean
  }
  sparse?: { xResidue: number; yResidue: number; connected: boolean; activeNodes: MagnetOut[] }
}

type EngineOut = { ok: boolean; engine?: string; vertexCount?: number; bands?: BandOut[]; error?: string }

const DISC_RADIUS_MM = 12
const SPARSE_MODES = ['ANY', 'ALL', 'FIXED', 'DISABLED'] as const

/** Outline as fractions of the picture's box → the same shape about its own bbox centre, unit-max. */
function normalise(outline: Outline): Outline {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of outline) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  const span = Math.max(maxX - minX, maxY - minY) || 1
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  return outline.map(([x, y]) => [(x - cx) / span, (y - cy) / span])
}

async function traceFile(file: File): Promise<Outline | null> {
  const bitmap = await createImageBitmap(file)
  const w = bitmap.width
  const h = bitmap.height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  const data = ctx.getImageData(0, 0, w, h).data
  const mask = new Uint8Array(w * h)
  let opaque = 0
  for (let i = 0; i < w * h; i++) {
    if (data[i * 4 + 3] > 128) {
      mask[i] = 1
      opaque++
    }
  }
  if (opaque === 0 || opaque > w * h * 0.995) return null
  const ring = traceContourRaw(mask, w, h)
  if (!ring || ring.length < 3) return null
  return ring.map(([x, y]) => [x / w, y / h] as [number, number])
}

export default function GridEngineGptPage() {
  const [outline, setOutline] = useState<Outline | null>(null)
  const [shapeName, setShapeName] = useState<string>('')
  const [corpus, setCorpus] = useState<Record<string, Outline>>({})
  const [result, setResult] = useState<EngineOut | null>(null)
  const [busy, setBusy] = useState(false)
  const [sparseMode, setSparseMode] = useState<(typeof SPARSE_MODES)[number]>('ANY')
  const [sparseMin, setSparseMin] = useState(1)
  const [requireLinks, setRequireLinks] = useState(true)
  const [requireBandSpan, setRequireBandSpan] = useState(true)
  const [activeBand, setActiveBand] = useState(2)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/magfit/corpus')
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => setCorpus(data as Record<string, Outline>))
      .catch(() => setCorpus({}))
  }, [])

  const solve = useCallback(
    async (shape: Outline) => {
      setBusy(true)
      try {
        const response = await fetch('/api/magfit', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            vertices: shape,
            bands: [2, 3],
            scale: 20000,
            sparseMode,
            sparseMinActive: sparseMin,
            requireLinks,
            requireBandSpan,
          }),
        })
        setResult((await response.json()) as EngineOut)
      } catch (error) {
        setResult({ ok: false, error: error instanceof Error ? error.message : String(error) })
      } finally {
        setBusy(false)
      }
    },
    [sparseMode, sparseMin, requireLinks, requireBandSpan],
  )

  useEffect(() => {
    if (outline) void solve(outline)
  }, [outline, solve])

  const loadCorpusShape = (name: string) => {
    const shape = corpus[name]
    if (!shape) return
    setShapeName(name)
    setOutline(normalise(shape))
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    const traced = await traceFile(file)
    if (!traced) {
      setResult({ ok: false, error: 'no silhouette found — the image needs transparency' })
      return
    }
    setShapeName(file.name)
    setOutline(normalise(traced))
  }

  const band = useMemo(
    () => result?.bands?.find((b) => b.band === activeBand),
    [result, activeBand],
  )

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Grid engine — GPT-Pro reference core</h1>
          <p style={styles.subtitle}>
            {result?.engine ?? 'magfit-core'} · exact integer geometry · every number below is the
            engine&rsquo;s own
          </p>
        </div>
        <div style={styles.controls}>
          <button style={styles.button} onClick={() => fileInput.current?.click()}>
            Upload cut-out
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
          {Object.keys(corpus).map((name) => (
            <button
              key={name}
              style={{
                ...styles.chip,
                ...(shapeName === name ? styles.chipActive : null),
              }}
              onClick={() => loadCorpusShape(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </header>

      <section style={styles.policyRow}>
        <label style={styles.label}>
          96&nbsp;mm phase
          <select
            style={styles.select}
            value={sparseMode}
            onChange={(event) => setSparseMode(event.target.value as (typeof SPARSE_MODES)[number])}
          >
            {SPARSE_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </label>
        <label style={styles.label}>
          min active nodes
          <input
            style={styles.number}
            type="number"
            min={1}
            max={9}
            value={sparseMin}
            onChange={(event) => setSparseMin(Number(event.target.value) || 1)}
          />
        </label>
        <label style={styles.label}>
          <input
            type="checkbox"
            checked={requireLinks}
            onChange={(event) => setRequireLinks(event.target.checked)}
          />
          require 24&nbsp;mm fabric link
        </label>
        <label style={styles.label}>
          <input
            type="checkbox"
            checked={requireBandSpan}
            onChange={(event) => setRequireBandSpan(event.target.checked)}
          />
          layout must span the band
        </label>
        <div style={styles.bandToggle}>
          {[2, 3].map((value) => (
            <button
              key={value}
              style={{ ...styles.chip, ...(activeBand === value ? styles.chipActive : null) }}
              onClick={() => setActiveBand(value)}
            >
              band {value}
            </button>
          ))}
        </div>
      </section>

      <section style={styles.body}>
        <Stage outline={outline} band={band} />
        <aside style={styles.panel}>
          {busy && <p style={styles.muted}>solving…</p>}
          {result && !result.ok && <p style={styles.error}>{result.error}</p>}
          {!outline && <p style={styles.muted}>Pick a saved shape or upload a cut-out.</p>}
          {band && <Readout band={band} vertexCount={result?.vertexCount} />}
        </aside>
      </section>
    </main>
  )
}

function Stage({ outline, band }: { outline: Outline | null; band: BandOut | undefined }) {
  const size = 620
  if (!outline) return <div style={{ ...styles.stage, width: size, height: size }} />

  // The engine scales the shape so its largest bbox side equals sizeMm, centred on the lattice
  // origin. Draw in millimetres, then one scalar to pixels.
  const sizeMm = band?.fit ? (band.sizeMm ?? 100) : 100
  const viewMm = Math.max(sizeMm * 1.35, 180)
  const toPx = (mm: number) => (mm / viewMm) * size + size / 2
  const lenPx = (mm: number) => (mm / viewMm) * size

  const path = outline
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${toPx(x * sizeMm)} ${toPx(y * sizeMm)}`)
    .join(' ')

  const gridLines: number[] = []
  for (let mm = -Math.ceil(viewMm / 2 / 48) * 48; mm <= viewMm / 2; mm += 48) gridLines.push(mm)

  return (
    <svg width={size} height={size} style={styles.stage}>
      <rect x={0} y={0} width={size} height={size} fill="#0d0f12" />
      {gridLines.map((mm) => (
        <g key={mm}>
          <line x1={toPx(mm)} y1={0} x2={toPx(mm)} y2={size} stroke="#1d2126" strokeWidth={1} />
          <line x1={0} y1={toPx(mm)} x2={size} y2={toPx(mm)} stroke="#1d2126" strokeWidth={1} />
        </g>
      ))}
      <path d={path} fill="rgba(120,160,255,0.16)" stroke="#7aa2ff" strokeWidth={1.5} />

      {band?.fit &&
        band.links?.map((link, index) => (
          <line
            key={`link-${index}`}
            x1={toPx(link.ax)}
            y1={toPx(link.ay)}
            x2={toPx(link.bx)}
            y2={toPx(link.by)}
            stroke="rgba(96,220,150,0.35)"
            strokeWidth={lenPx(DISC_RADIUS_MM * 2)}
            strokeLinecap="round"
          />
        ))}

      {band?.fit &&
        band.magnets?.map((magnet) => {
          const limiting =
            band.binding &&
            band.binding.nodeXMm === magnet.xMm &&
            band.binding.nodeYMm === magnet.yMm
          return (
            <g key={`${magnet.x24}:${magnet.y24}`}>
              <circle
                cx={toPx(magnet.xMm)}
                cy={toPx(magnet.yMm)}
                r={lenPx(DISC_RADIUS_MM)}
                fill={limiting ? 'rgba(255,140,90,0.30)' : 'rgba(255,255,255,0.14)'}
                stroke={limiting ? '#ff8c5a' : '#e6ebf2'}
                strokeWidth={1.5}
              />
              <circle cx={toPx(magnet.xMm)} cy={toPx(magnet.yMm)} r={2.5} fill="#e6ebf2" />
            </g>
          )
        })}

      {band?.fit &&
        band.sparse?.activeNodes.map((node) => (
          <circle
            key={`sparse-${node.x24}:${node.y24}`}
            cx={toPx(node.xMm)}
            cy={toPx(node.yMm)}
            r={lenPx(DISC_RADIUS_MM) + 4}
            fill="none"
            stroke="#ffd166"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        ))}
    </svg>
  )
}

function Readout({ band, vertexCount }: { band: BandOut; vertexCount?: number }) {
  if (!band.fit) {
    return (
      <div>
        <h2 style={styles.h2}>Band {band.band}: no size</h2>
        <p style={styles.muted}>{band.reason}</p>
        <p style={styles.muted}>{vertexCount} traced points</p>
      </div>
    )
  }
  const magnets = band.magnets ?? []
  return (
    <div>
      <h2 style={styles.h2}>
        Band {band.band}: {band.sizeMm} mm
      </h2>
      <p style={styles.muted}>
        {band.widthMm?.toFixed(1)} × {band.heightMm?.toFixed(1)} mm · {magnets.length} magnets ·{' '}
        {band.links?.length ?? 0} verified links · {band.templateRunsX}×{band.templateRunsY} template
      </p>

      <h3 style={styles.h3}>Magnet coordinates</h3>
      <ul style={styles.list}>
        {magnets.map((magnet) => (
          <li key={`${magnet.x24}:${magnet.y24}`}>
            ({magnet.xMm}, {magnet.yMm}) mm
          </li>
        ))}
      </ul>

      {band.binding && (
        <>
          <h3 style={styles.h3}>Limiting contact</h3>
          <p style={styles.muted}>
            {band.binding.kind === 'MAGNET_DISC' ? 'magnet disc' : 'link capsule'} at (
            {band.binding.nodeXMm}, {band.binding.nodeYMm}) mm against outline edge{' '}
            {band.binding.edgeIndex} — clearance {band.binding.clearanceMm.toFixed(2)} mm, slack{' '}
            {band.binding.slackMm.toFixed(2)} mm
          </p>
        </>
      )}

      {band.flap && (
        <>
          <h3 style={styles.h3}>Flap beyond the magnet box</h3>
          <p style={styles.muted}>
            left {band.flap.leftMm.toFixed(1)} · right {band.flap.rightMm.toFixed(1)} · bottom{' '}
            {band.flap.bottomMm.toFixed(1)} · top {band.flap.topMm.toFixed(1)} mm
          </p>
          <p style={styles.muted}>
            12 mm switch: {[band.flap.left12, band.flap.right12, band.flap.bottom12, band.flap.top12]
              .map((pass) => (pass ? 'pass' : 'fail'))
              .join(' / ')}
            {' · '}24 mm switch:{' '}
            {[band.flap.left24, band.flap.right24, band.flap.bottom24, band.flap.top24]
              .map((pass) => (pass ? 'pass' : 'fail'))
              .join(' / ')}
          </p>
        </>
      )}

      {band.sparse && (
        <>
          <h3 style={styles.h3}>96 mm garment</h3>
          <p style={styles.muted}>
            phase ({band.sparse.xResidue}, {band.sparse.yResidue}) ·{' '}
            {band.sparse.activeNodes.length} engaging magnet
            {band.sparse.activeNodes.length === 1 ? '' : 's'} ·{' '}
            {band.sparse.connected ? 'connected' : 'not connected'}
          </p>
        </>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#08090b',
    color: '#e6ebf2',
    padding: '24px 28px',
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
  },
  header: { display: 'flex', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' },
  title: { fontSize: 20, fontWeight: 600, margin: 0 },
  subtitle: { fontSize: 13, color: '#8b95a3', margin: '4px 0 0' },
  controls: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  policyRow: {
    display: 'flex',
    gap: 18,
    alignItems: 'center',
    flexWrap: 'wrap',
    margin: '18px 0',
    padding: '12px 14px',
    background: '#0d0f12',
    borderRadius: 10,
    fontSize: 13,
  },
  label: { display: 'flex', alignItems: 'center', gap: 8, color: '#b6c0cc' },
  select: { background: '#14181d', color: '#e6ebf2', border: '1px solid #232a32', borderRadius: 6, padding: '4px 8px' },
  number: { width: 56, background: '#14181d', color: '#e6ebf2', border: '1px solid #232a32', borderRadius: 6, padding: '4px 8px' },
  bandToggle: { display: 'flex', gap: 8, marginLeft: 'auto' },
  button: {
    background: '#1d5cff',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 13,
    cursor: 'pointer',
  },
  chip: {
    background: '#14181d',
    color: '#b6c0cc',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#232a32',
    borderRadius: 999,
    padding: '6px 12px',
    fontSize: 12,
    cursor: 'pointer',
  },
  chipActive: { background: '#1d5cff', color: '#fff', borderColor: '#1d5cff' },
  body: { display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' },
  stage: { borderRadius: 12, background: '#0d0f12', border: '1px solid #1b2027' },
  panel: { flex: '1 1 320px', minWidth: 300, fontSize: 13, lineHeight: 1.6 },
  h2: { fontSize: 17, margin: '0 0 6px' },
  h3: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.6, color: '#8b95a3', margin: '18px 0 6px' },
  list: { margin: 0, paddingLeft: 18, color: '#b6c0cc' },
  muted: { color: '#8b95a3', margin: '4px 0' },
  error: { color: '#ff8c5a' },
}
