'use client'

import { useEffect, useMemo, useState } from 'react'

import type { Contour, Pt } from '@/lib/effect/types'
import {
  resolveUserPlan,
  semanticLadder,
  standardShapeContour,
  type Attachment,
  type ResolvedGridPlan,
  type SemanticRung,
  type UserStandardShape,
} from '@/lib/effect/grid-user'
import { ensureSession } from '@/lib/supabase/session-client'

type UserShape = UserStandardShape
type SessionState = 'connecting' | 'ready' | 'error'

const SHAPES: ReadonlyArray<{ value: UserShape; label: string }> = [
  { value: 'square', label: 'Square' },
  { value: 'circle', label: 'Circle' },
  { value: 'diamondShape', label: 'Diamond' },
  { value: 'triangle', label: 'Triangle' },
]

const ATTACHMENTS: ReadonlyArray<{ value: Attachment; label: string }> = [
  { value: 'magnetic', label: 'Magnetic' },
  { value: 'twinfix', label: 'Twin-fix' },
  { value: 'velcro', label: 'Velcro' },
]

function nearestRung(ladder: SemanticRung[], sizeMM: number): SemanticRung {
  return ladder.reduce((best, rung) => {
    const nextDistance = Math.abs(rung.sizeMM - sizeMM)
    const bestDistance = Math.abs(best.sizeMM - sizeMM)
    return nextDistance < bestDistance ? rung : best
  })
}

export default function CreatePage() {
  const [shape, setShape] = useState<UserShape>('square')
  const [sizeMM, setSizeMM] = useState(70)
  const [attachment, setAttachment] = useState<Attachment>('magnetic')
  const [session, setSession] = useState<SessionState>('connecting')

  useEffect(() => {
    let mounted = true
    void ensureSession()
      .then(() => { if (mounted) setSession('ready') })
      .catch((error) => {
        console.error(error)
        if (mounted) setSession('error')
      })
    return () => { mounted = false }
  }, [])

  const ladder = useMemo(
    () => semanticLadder((candidateMM) => standardShapeContour(shape, candidateMM)),
    [shape],
  )
  const rung = useMemo(() => nearestRung(ladder, sizeMM), [ladder, sizeMM])
  const designContour = useMemo(
    () => standardShapeContour(shape, rung.sizeMM),
    [shape, rung.sizeMM],
  )
  const plan = useMemo(
    () => resolveUserPlan(designContour, { attachment }),
    [designContour, attachment],
  )

  return (
    <main className="create-grid">
      <style>{CSS}</style>

      <header className="create-head">
        <div>
          <p className="create-kicker">ONEMO Creator</p>
          <h1>Build the effect. The engine handles the hold.</h1>
          <p className="create-intro">
            Choose the product shape, its real size, and how it attaches. Registration,
            pitch, perimeter coverage, and rescue points resolve automatically.
          </p>
        </div>
        <span className={`session-pill ${session}`}>
          {session === 'ready' ? 'Session ready' : session === 'error' ? 'Session unavailable' : 'Connecting session'}
        </span>
      </header>

      <div className="create-body">
        <section className="preview-card" aria-label="Resolved effect preview">
          <div className="preview-head">
            <div>
              <span>Resolved product</span>
              <strong>{SHAPES.find((choice) => choice.value === shape)?.label} · {rung.label}</strong>
            </div>
            <span className={`hold-pill ${plan.grid.ok ? 'ok' : 'bad'}`}>
              {plan.grid.ok ? 'Holds' : "Won't hold"}
            </span>
          </div>

          <ProductPreview design={designContour} plan={plan} />

          <div className="preview-legend" aria-label="Preview legend">
            <span><i className="belt-dot" />Perimeter anchor</span>
            <span><i className="rescue-dot" />Coverage rescue</span>
            <span><i className="design-line" />Design edge</span>
          </div>

          <dl className="product-facts">
            <Fact label="Total effect size" value={`${Math.round(longestDimension(plan.effectContourMM))} mm`} />
            <Fact label="Resolved pattern" value={plan.pattern == null ? 'Surface' : plan.pattern === 'quincunx' ? 'Dice-5' : plan.pattern} />
            <Fact label="Grid pitch" value={`${plan.pitchMM} mm`} />
            <Fact label="Seated anchors" value={String(plan.grid.anchors.length)} />
            <Fact label="Rescue anchors" value={String(plan.grid.rescueAnchors.length)} />
            <Fact label="Attachment" value={attachment === 'twinfix' ? 'Twin-fix' : attachment} />
          </dl>

          {plan.grid.issues.length > 0 && (
            <div className="issues" role="status">
              {plan.grid.issues.map((issue) => <p key={issue}>{issue}</p>)}
            </div>
          )}
        </section>

        <aside className="product-controls" aria-label="Product controls">
          <section className="control-card" data-user-control="shape">
            <div className="control-heading">
              <span>01</span>
              <div><h2>Shape</h2><p>The final cut silhouette.</p></div>
            </div>
            <div className="button-grid two">
              {SHAPES.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  aria-pressed={shape === choice.value}
                  onClick={() => setShape(choice.value)}
                >
                  <ShapeIcon shape={choice.value} />
                  {choice.label}
                </button>
              ))}
            </div>
          </section>

          <section className="control-card" data-user-control="size">
            <div className="control-heading">
              <span>02</span>
              <div><h2>Size</h2><p>Distinct products only. Measurements stay in the preview.</p></div>
            </div>
            <div className="size-grid">
              {ladder.map((option) => (
                <button
                  key={option.sizeMM}
                  type="button"
                  aria-pressed={rung.sizeMM === option.sizeMM}
                  onClick={() => setSizeMM(option.sizeMM)}
                  title={`${option.points} seated anchor${option.points === 1 ? '' : 's'}`}
                >
                  {option.label}{option.visible ? '' : '†'}
                </button>
              ))}
            </div>
          </section>

          <section className="control-card" data-user-control="attachment">
            <div className="control-heading">
              <span>03</span>
              <div><h2>Attachment</h2><p>The engine resolves the compatible registration plan.</p></div>
            </div>
            <div className="button-grid three">
              {ATTACHMENTS.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  aria-pressed={attachment === choice.value}
                  onClick={() => setAttachment(choice.value)}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  )
}

function ProductPreview({ design, plan }: { design: Contour; plan: ResolvedGridPlan }) {
  const effect = plan.effectContourMM
  const effectPoints = effect.outer.pts.map(([x, y]) => [x, -y] as Pt)
  const designPoints = design.outer.pts.map(([x, y]) => [x, -y] as Pt)
  const bounds = contourBounds(effectPoints)
  const longest = Math.max(bounds.width, bounds.height)
  const padding = Math.max(12, longest * 0.12)
  const rescue = new Set(plan.grid.rescueAnchors.map(pointKey))

  return (
    <div className="preview-stage">
      <svg
        role="img"
        aria-label={`${plan.grid.anchors.length} resolved anchors on the effect perimeter`}
        viewBox={`${bounds.minX - padding} ${bounds.minY - padding} ${bounds.width + 2 * padding} ${bounds.height + 2 * padding}`}
      >
        <path className="effect-fill" d={pathFrom(effectPoints)} />
        <path className="design-edge" d={pathFrom(designPoints)} />
        {plan.grid.anchors.map((anchor, index) => {
          const key = pointKey(anchor.p)
          return (
            <g key={`${key}-${index}`} transform={`translate(${anchor.p[0]} ${-anchor.p[1]})`}>
              <circle className={rescue.has(key) ? 'anchor rescue' : 'anchor'} r={anchor.dia / 2} />
              <circle className="anchor-ring" r={plan.grid.applicationPadMM} />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function ShapeIcon({ shape }: { shape: UserShape }) {
  if (shape === 'circle') return <i className="shape-icon circle" />
  if (shape === 'diamondShape') return <i className="shape-icon diamond" />
  if (shape === 'triangle') return <i className="shape-icon triangle" />
  return <i className="shape-icon square" />
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>
}

function pointKey([x, y]: Pt): string {
  return `${x.toFixed(3)},${y.toFixed(3)}`
}

function pathFrom(points: Pt[]): string {
  return `M ${points.map(([x, y]) => `${x.toFixed(3)} ${y.toFixed(3)}`).join(' L ')} Z`
}

function contourBounds(points: Pt[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of points) {
    minX = Math.min(minX, x); minY = Math.min(minY, y)
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
  }
  return { minX, minY, width: maxX - minX, height: maxY - minY }
}

function longestDimension(contour: Contour): number {
  const bounds = contourBounds(contour.outer.pts)
  return Math.max(bounds.width, bounds.height)
}

const CSS = `
.create-grid{--paper:#f3f0e9;--panel:#fffdf8;--ink:#191a18;--muted:#6d6e68;--line:#d9d5ca;--accent:#ff5a36;--accent-soft:#ffe5dc;--green:#18844e;--red:#c63e32;--rescue:#7857ff;min-height:100vh;background:var(--paper);color:var(--ink);padding:32px 24px 72px;font-family:var(--al-type-family-primary),system-ui,sans-serif}
.create-grid *{box-sizing:border-box}
.create-head{max-width:1180px;margin:0 auto 24px;display:flex;justify-content:space-between;gap:24px;align-items:flex-start}
.create-kicker{margin:0 0 8px;color:var(--accent);font:700 11px ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase}
.create-head h1{max-width:760px;margin:0;font-size:clamp(30px,5vw,58px);line-height:.98;letter-spacing:-.045em;font-weight:650}
.create-intro{max-width:680px;margin:16px 0 0;color:var(--muted);font-size:14px;line-height:1.55}
.session-pill{flex:none;border:1px solid var(--line);border-radius:999px;padding:8px 12px;background:var(--panel);color:var(--muted);font:650 11px ui-monospace,monospace}
.session-pill.ready{color:var(--green)}.session-pill.error{color:var(--red)}
.create-body{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) 390px;gap:20px;align-items:start}
.preview-card,.control-card{background:var(--panel);border:1px solid var(--line);border-radius:22px;box-shadow:0 12px 34px #302b2010}
.preview-card{padding:20px;position:sticky;top:20px}
.preview-head{display:flex;align-items:center;justify-content:space-between;gap:16px}
.preview-head div{display:flex;flex-direction:column;gap:3px}.preview-head span{color:var(--muted);font:650 10px ui-monospace,monospace;letter-spacing:.09em;text-transform:uppercase}.preview-head strong{text-transform:capitalize;font-size:17px}
.hold-pill{border-radius:999px;padding:7px 11px!important;background:#e4f4ea;color:var(--green)!important}.hold-pill.bad{background:#f9e3e0;color:var(--red)!important}
.preview-stage{height:min(56vw,520px);min-height:380px;margin:18px 0;display:grid;place-items:center;border:1px solid var(--line);border-radius:16px;overflow:hidden;background:linear-gradient(var(--line) 1px,transparent 1px) 0 0/24px 24px,linear-gradient(90deg,var(--line) 1px,transparent 1px) 0 0/24px 24px,#ece9e1}
.preview-stage svg{width:92%;height:92%;overflow:visible}.effect-fill{fill:#c6c2b8;stroke:#807c73;stroke-width:1.2;vector-effect:non-scaling-stroke}.design-edge{fill:none;stroke:var(--accent);stroke-width:1;stroke-dasharray:4 3;vector-effect:non-scaling-stroke}.anchor{fill:#242421;stroke:#fff;stroke-width:1;vector-effect:non-scaling-stroke}.anchor.rescue{fill:var(--rescue)}.anchor-ring{fill:none;stroke:#5b5b56;stroke-opacity:.25;stroke-width:.7;stroke-dasharray:2 2;vector-effect:non-scaling-stroke}
.preview-legend{display:flex;flex-wrap:wrap;gap:14px;margin:0 0 18px;color:var(--muted);font:600 11px ui-monospace,monospace}.preview-legend span{display:flex;align-items:center;gap:6px}.preview-legend i{display:block;width:10px;height:10px;border-radius:50%}.belt-dot{background:#242421}.rescue-dot{background:var(--rescue)}.preview-legend .design-line{height:0;width:15px;border-top:2px dashed var(--accent);border-radius:0}
.product-facts{margin:0;display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--line);border-radius:14px;overflow:hidden}.product-facts div{padding:12px;border-right:1px solid var(--line);border-bottom:1px solid var(--line)}.product-facts div:nth-child(3n){border-right:0}.product-facts div:nth-last-child(-n+3){border-bottom:0}.product-facts dt{color:var(--muted);font:650 9px ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase}.product-facts dd{margin:5px 0 0;font:700 13px ui-monospace,monospace;text-transform:capitalize}
.issues{margin-top:12px;padding:10px 12px;border-radius:12px;background:#f9e3e0;color:var(--red);font:600 11px ui-monospace,monospace}.issues p{margin:0}.issues p+p{margin-top:5px}
.product-controls{display:flex;flex-direction:column;gap:14px}.control-card{padding:18px}.control-heading{display:flex;gap:12px;align-items:flex-start;margin-bottom:14px}.control-heading>span{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--accent-soft);color:var(--accent);font:700 10px ui-monospace,monospace}.control-heading h2{margin:0;font-size:15px}.control-heading p{margin:3px 0 0;color:var(--muted);font-size:11.5px;line-height:1.35}
.button-grid,.size-grid{display:grid;gap:6px}.button-grid.two{grid-template-columns:1fr 1fr}.button-grid.three{grid-template-columns:repeat(3,1fr)}.size-grid{grid-template-columns:repeat(4,1fr)}
.button-grid button,.size-grid button{appearance:none;border:1px solid var(--line);border-radius:11px;background:#f4f1ea;color:var(--muted);min-height:44px;padding:9px 8px;cursor:pointer;font:650 12px inherit;transition:.12s}.button-grid.two button{display:flex;align-items:center;justify-content:center;gap:8px}.button-grid button:hover,.size-grid button:hover{border-color:#aaa69c;color:var(--ink)}.button-grid button[aria-pressed=true],.size-grid button[aria-pressed=true]{border-color:var(--ink);background:var(--ink);color:#fff;box-shadow:0 3px 10px #191a1825}
.shape-icon{display:block;width:15px;height:15px;border:1.5px solid currentColor}.shape-icon.circle{border-radius:50%}.shape-icon.diamond{transform:rotate(45deg);width:12px;height:12px}.shape-icon.triangle{width:0;height:0;border:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:15px solid currentColor}.shape-icon.square{border-radius:2px}
@media(max-width:900px){.create-body{grid-template-columns:1fr}.preview-card{position:static}.preview-stage{height:520px}.product-controls{display:grid;grid-template-columns:1fr 1fr}.control-card:last-child{grid-column:1/-1}}
@media(max-width:620px){.create-grid{padding:22px 14px 48px}.create-head{flex-direction:column}.session-pill{align-self:flex-start}.preview-stage{height:360px;min-height:300px}.product-facts{grid-template-columns:1fr 1fr}.product-facts div:nth-child(3n){border-right:1px solid var(--line)}.product-facts div:nth-child(2n){border-right:0}.product-facts div:nth-last-child(-n+3){border-bottom:1px solid var(--line)}.product-facts div:nth-last-child(-n+2){border-bottom:0}.product-controls{display:flex}.button-grid.three{grid-template-columns:1fr}.size-grid{grid-template-columns:repeat(3,1fr)}}
`
