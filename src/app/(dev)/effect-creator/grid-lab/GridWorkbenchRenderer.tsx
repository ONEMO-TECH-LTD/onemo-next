import { useLayoutEffect } from 'react'
import type { Contour, Pt } from '@/lib/effect/types'

interface GridWorkbenchAnchor {
  p: Pt
  dia: number
}

interface GridWorkbenchGrid {
  attachment: string
  twinRequired: boolean
  anchors: GridWorkbenchAnchor[]
  candidates: Pt[]
  flaps: Pt[]
  ok: boolean
  issues: string[]
  pitchCentreMM: number
  edgeRangeMM: [number, number]
  applicationPadMM: number
}

interface GridWorkbenchNearestAnchorPair {
  first: { p: Pt }
  second: { p: Pt }
  distanceMM: number
}

interface GridWorkbenchModel {
  planKey: string
  contour: Contour
  design: Contour
  grid: GridWorkbenchGrid
  patternUsed: string
  anchorPair: GridWorkbenchNearestAnchorPair | null
}

export function contourDimension(c: Contour, axis: 0 | 1): number {
  let lo = Infinity, hi = -Infinity
  for (const p of c.outer.pts) { if (p[axis] < lo) lo = p[axis]; if (p[axis] > hi) hi = p[axis] }
  return hi - lo
}

export function GridWorkbenchStage({
  model,
  scale,
  viewportPx,
  fit,
  front,
  frontImg,
  emptyText,
  emptySpin,
  onRenderedPlanCommit,
}: {
  model: GridWorkbenchModel | null
  scale: number
  viewportPx: number
  fit: number
  front: boolean
  frontImg: string | null
  emptyText: string
  emptySpin?: boolean
  onRenderedPlanCommit: (planKey: string | null) => void
}) {
  useLayoutEffect(() => {
    onRenderedPlanCommit(model?.planKey ?? null)
  }, [model?.planKey, onRenderedPlanCommit])

  return (
    <section className="gl-card gl-stage" data-rendered-plan-key={model?.planKey ?? ''}>
      <div className="gl-stage-head">
        <span className="gl-eye">Editor viewport · fixed {viewportPx}px</span>
        <span className="gl-eye">{model ? `1mm = ${scale.toFixed(2)} px` : '—'}</span>
      </div>
      <div className="gl-vp">
        {model ? <Stage contour={model.contour} design={model.design} grid={model.grid} anchorPair={model.anchorPair} front={front} frontImg={frontImg} viewportPx={viewportPx} fit={fit} />
          : <Empty text={emptyText} spin={emptySpin} />}
      </div>
      {model && <Verdict grid={model.grid} />}
      <div className="gl-legend">
        <span><i style={{ background: 'var(--magnet)' }} />6mm magnet</span>
        <span><i style={{ background: 'var(--mag8)' }} />8mm magnet</span>
        <span><i style={{ background: 'var(--margin)' }} />margin band</span>
        <span><i style={{ background: 'var(--grid)', opacity: .55 }} />node · no material</span>
        <span><i style={{ background: 'var(--fail)' }} />flap risk</span>
      </div>
    </section>
  )
}

export function GridWorkbenchReadouts({ model, scale }: { model: GridWorkbenchModel; scale: number }) {
  return (
    <div className="gl-card gl-read">
      <Cell k="Real size" v={`${Math.round(contourDimension(model.contour, 0))}×${Math.round(contourDimension(model.contour, 1))} mm`} />
      <Cell k="Render scale" v={`${scale.toFixed(2)} px/mm`} />
      <Cell k="Pitch · center" v={`${model.grid.pitchCentreMM} mm`} />
      <Cell k="Pitch · edge" v={model.grid.edgeRangeMM[0] === model.grid.edgeRangeMM[1] ? `${model.grid.edgeRangeMM[0]} mm` : `${model.grid.edgeRangeMM[0]}–${model.grid.edgeRangeMM[1]} mm`} />
      <Cell k="Seated magnets" v={String(model.grid.anchors.length)} />
      <Cell k="Pattern" v={model.patternUsed === 'quincunx' ? 'dice-5' : model.patternUsed} />
    </div>
  )
}

const pathFrom = (pp: Pt[]) => 'M ' + pp.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ') + ' Z'
function Stage({ contour, design, grid, anchorPair, front, frontImg, viewportPx, fit }: { contour: Contour; design: Contour; grid: GridWorkbenchGrid; anchorPair: GridWorkbenchNearestAnchorPair | null; front: boolean; frontImg: string | null; viewportPx: number; fit: number }) {
  const ePts = contour.outer.pts.map(([x, y]) => [x, -y] as Pt)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of ePts) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  const w = maxX - minX, h = maxY - minY
  const pad = Math.max(w, h) * 0.09 // room for the edge-to-edge measurement frame + labels
  const vbW = w + 2 * pad, vbH = h + 2 * pad
  const S = (viewportPx * fit) / Math.max(vbW, vbH)
  const fontMM = pad * 0.5
  const eD = pathFrom(ePts)
  const hasMargin = design !== contour && design.outer.pts.length >= 3
  const dPts = design.outer.pts.map(([x, y]) => [x, -y] as Pt)
  const dD = hasMargin ? pathFrom(dPts) : ''
  const fy = (p: Pt): Pt => [p[0], -p[1]]
  const seat = new Set(grid.anchors.map(a => a.p[0].toFixed(2) + ',' + a.p[1].toFixed(2)))
  const hasFlap = grid.flaps.length > 0
  // design bbox (flipped screen space) for placing the front image
  let dmnx = Infinity, dmny = Infinity, dmxx = -Infinity, dmxy = -Infinity
  for (const [x, y] of dPts) { if (x < dmnx) dmnx = x; if (x > dmxx) dmxx = x; if (y < dmny) dmny = y; if (y > dmxy) dmxy = y }
  const dDall = pathFrom(dPts)
  return (
    <svg width={vbW * S} height={vbH * S} viewBox={`${minX - pad} ${minY - pad} ${vbW} ${vbH}`}>
      <defs><clipPath id="frontclip"><path d={dDall} /></clipPath></defs>
      {/* faint edge-to-edge frame at the ultimate extent + the real W×H (total effect size) */}
      <rect x={minX} y={minY} width={w} height={h} fill="none" stroke="var(--ink-3)" strokeOpacity={0.5} strokeWidth={0.6} strokeDasharray="3 2.2" />
      <text x={minX + w / 2} y={minY - pad * 0.28} fontSize={fontMM} fill="var(--ink-3)" textAnchor="middle" fontFamily="ui-monospace,monospace">{Math.round(w)} mm</text>
      <text x={minX - pad * 0.28} y={minY + h / 2} fontSize={fontMM} fill="var(--ink-3)" textAnchor="middle" fontFamily="ui-monospace,monospace" transform={`rotate(-90 ${minX - pad * 0.28} ${minY + h / 2})`}>{Math.round(h)} mm</text>
      {front ? <>
        {/* FRONT FACE — the design/artwork the wearer sees, with magnets as translucent overlay rings so
            the grid can be sanity-checked over the art. Positions are engine anchors, not re-derived. */}
        {frontImg
          ? <image href={frontImg} x={dmnx} y={dmny} width={dmxx - dmnx} height={dmxy - dmny} clipPath="url(#frontclip)" preserveAspectRatio="none" transform={`translate(0 ${dmny + dmxy}) scale(1 -1)`} />
          : <path d={dDall} fill="var(--suede)" />}
        <path d={dDall} fill="none" stroke="var(--suede-edge)" strokeWidth={1} strokeLinejoin="round" />
        {grid.anchors.map((a, i) => {
          const p = fy(a.p)
          return <g key={'fm' + i}>
            <circle cx={p[0]} cy={p[1]} r={a.dia / 2} fill="#fff" fillOpacity={0.35} stroke="#fff" strokeOpacity={0.9} strokeWidth={0.6} />
            <circle cx={p[0]} cy={p[1]} r={a.dia / 2} fill="none" stroke="#000" strokeOpacity={0.55} strokeWidth={0.5} strokeDasharray="1.1 1" />
          </g>
        })}
      </> : <>
      {/* effect = design + margin: fill the whole effect as MARGIN material, then the design on top → the
          margin band shows as the ring between the dashed design outline and the effect edge. */}
      <path d={eD} fill={hasMargin ? 'var(--margin)' : 'var(--suede)'} />
      {hasMargin && <path d={dD} fill="var(--suede)" />}
      {/* frame: fixed 1mm suede edge (engine law, always drawn) — turns red when edges would lift (flap risk).
          Always rendered: it is the manufactured border AND the flap-risk signal — never user-toggleable. */}
      <path d={eD} fill="none" stroke={hasFlap ? 'var(--fail)' : 'var(--suede-edge)'} strokeOpacity={hasFlap ? 0.85 : 1} strokeWidth={hasFlap ? 1.5 : 1} strokeLinejoin="round" />
      {hasMargin && <path d={dD} fill="none" stroke="var(--accent)" strokeOpacity={0.6} strokeWidth={0.8} strokeDasharray="3 2" />}
      {grid.candidates.filter(c => !seat.has(c[0].toFixed(2) + ',' + c[1].toFixed(2))).map((c, i) => {
        const p = fy(c); return <circle key={'c' + i} cx={p[0]} cy={p[1]} r={1.6} fill="var(--grid)" fillOpacity={0.5} />
      })}
      {/* per-spot application padding ring: magnet radius + padding — the material each magnet needs to bond */}
      {grid.anchors.map((a, i) => { const p = fy(a.p); return <circle key={'ring' + i} cx={p[0]} cy={p[1]} r={grid.applicationPadMM} fill="none" stroke="var(--accent)" strokeOpacity={0.3} strokeWidth={0.5} strokeDasharray="2.5 2.5" /> })}
      {grid.anchors.map((a, i) => {
        const p = fy(a.p)
        return <g key={'a' + i}>
          <circle cx={p[0]} cy={p[1]} r={a.dia / 2} fill={a.dia === 8 ? 'var(--mag8)' : 'var(--magnet)'} />
          <circle cx={p[0] - a.dia * 0.12} cy={p[1] - a.dia * 0.12} r={a.dia / 2 * 0.4} fill="var(--magnet-hi)" fillOpacity={0.5} />
        </g>
      })}
      </>}
      {/* live magnet-distance annotation: dimension line on the CLOSEST seated pair, real mm (back view) */}
      {!front && (() => {
        if (!anchorPair) return null
        const bd = anchorPair.distanceMM
        const p1 = fy(anchorPair.first.p), p2 = fy(anchorPair.second.p)
        const mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2
        return <g>
          {/* dark underlay + white overlay → legible on the dark suede AND the light margin band */}
          <line x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke="#000" strokeOpacity={0.5} strokeWidth={1.6} />
          <line x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke="#fff" strokeOpacity={0.95} strokeWidth={0.7} strokeDasharray="1.8 1.4" />
          <text x={mx} y={my - 2.4} fontSize={fontMM * 1.05} fontWeight={700} fill="#fff" stroke="#000" strokeWidth={fontMM * 0.22} strokeOpacity={0.65} style={{ paintOrder: 'stroke' }} textAnchor="middle" fontFamily="ui-monospace,monospace">{Math.round(bd)} mm{Math.abs(bd - grid.pitchCentreMM * Math.SQRT2) < 1.5 ? ` · ${grid.pitchCentreMM}×√2` : Math.abs(bd - grid.pitchCentreMM / Math.SQRT2) < 1.5 ? ` · dice ½·${grid.pitchCentreMM}√2` : ''}</text>
        </g>
      })()}
    </svg>
  )
}

function Verdict({ grid }: { grid: GridWorkbenchGrid }) {
  const head = grid.attachment === 'velcro'
    ? 'Velcro — full-surface hook, any shape and size, no grid'
    : grid.ok
      ? `Holds — ${grid.anchors.length} magnets seated${grid.twinRequired ? ' · ships as a TWIN pair (mirror grid clamps the fabric)' : ', spread across material'}`
      : "Won't hold reliably"
  return (
    <div className={`gl-verdict ${grid.ok ? 'ok' : 'bad'}`}>
      <div className="gl-vrow"><span className="gl-dot" /><b>{head}</b></div>
      {grid.issues.map((s, i) => <div key={i} className="gl-issue">{s}</div>)}
    </div>
  )
}

function Empty({ text, spin }: { text: string; spin?: boolean }) {
  return <div className="gl-empty">{spin && <span className="gl-spin" />}{text}</div>
}

function Cell({ k, v }: { k: string; v: string }) {
  return <div className="gl-cell"><span>{k}</span><b>{v}</b></div>
}
