import { writeFileSync } from 'node:fs'
import { laddersByPlacement, outlineAt, magnetsFor, type Outline, type Pt, type GridLaw, type Rung } from './magnet-grid'

const LAW: GridLaw = { pitchMM: 48, paddingMM: 10, maxSizeMM: 310, toleranceMM: 0.05 }
const ring = (f: (t: number) => Pt, n: number): Pt[] => Array.from({ length: n }, (_, i) => f((i / n) * Math.PI * 2))
const O = (pts: Pt[], holes: Pt[][] = []): Outline => ({ outer: { pts }, holes: holes.map((h) => ({ pts: h })) })

const CASES: Array<{ name: string; note: string; shape: Outline; targetMM: number }> = [
  { name: 'Triangle', note: 'your drawing: five magnets, 1-1-3', targetMM: 158,
    shape: O([[0,0],[1,0],[0.5, Math.sqrt(3)/2]]) },
  { name: 'Square', note: 'control — your 116 with 9', targetMM: 116,
    shape: O([[0,0],[1,0],[1,1],[0,1]]) },
  { name: 'AI cut-out (figure)', note: 'four limbs — the real case', targetMM: 214,
    shape: O(ring((t) => { const r = 1 + 0.30*Math.sin(4*t) + 0.10*Math.sin(7*t); return [r*Math.cos(t), r*Math.sin(t)] }, 300)) },
  { name: 'L-shape', note: 'the empty corner', targetMM: 214,
    shape: O([[0,0],[0.45,0],[0.45,0.55],[1,0.55],[1,1],[0,1]]) },
]

function svg(shape: Outline, rung: Rung, sizeMM: number): string {
  const o = outlineAt(shape, sizeMM)
  const pad = 30
  const half = LAW.maxSizeMM / 2
  const vb = `${-half - pad} ${-half - pad} ${2 * (half + pad)} ${2 * (half + pad)}`
  const path = (pts: Pt[]) => `M ${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ')} Z`
  const rims = new Set(rung.rimMagnets.map((p) => p.join(',')))
  const dots = rung.magnets.map(([x, y]) => {
    const isRim = rims.has(`${x},${y}`)
    return `<circle cx="${x}" cy="${y}" r="${LAW.paddingMM}" class="pad"/>`
      + `<circle cx="${x}" cy="${y}" r="5" class="${isRim ? 'mag rim' : 'mag'}"/>`
  }).join('')
  return `<svg viewBox="${vb}" preserveAspectRatio="xMidYMid meet"><g transform="scale(1,-1)">
    <g class="lat">${Array.from({ length: 15 }, (_, i) => {
      const v = (i - 7) * LAW.pitchMM + rung.phaseMM[0]
      return `<line x1="${v}" y1="${-half}" x2="${v}" y2="${half}"/>`
    }).join('')}${Array.from({ length: 15 }, (_, i) => {
      const v = (i - 7) * LAW.pitchMM + rung.phaseMM[1]
      return `<line x1="${-half}" y1="${v}" x2="${half}" y2="${v}"/>`
    }).join('')}</g>
    <path d="${path(o.outer.pts)}" class="shape"/>
    ${o.holes.map((h) => `<path d="${path(h.pts)}" class="hole"/>`).join('')}
    ${dots}
  </g></svg>`
}

let body = ''
for (const c of CASES) {
  const placements = laddersByPlacement(c.shape, LAW)
  // one panel per DISTINCT population at (or just above) the target size
  const seen = new Set<string>()
  const panels: string[] = []
  for (const pl of placements) {
    const rung = pl.rungs.find((r) => r.sizeMM >= c.targetMM) ?? pl.rungs[pl.rungs.length - 1]
    if (!rung) continue
    const key = rung.magnets.map(([x, y]) => `${Math.round((x - pl.phaseMM[0]) / LAW.pitchMM)},${Math.round((y - pl.phaseMM[1]) / LAW.pitchMM)}`).sort().join(' ') + '|' + rung.sizeMM
    if (seen.has(key)) continue
    seen.add(key)
    const rows = new Map<number, number>()
    for (const [, y] of rung.magnets) rows.set(Math.round(y), (rows.get(Math.round(y)) ?? 0) + 1)
    const shapeDesc = [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, n]) => n).join('-')
    panels.push(`<figure>
      ${svg(c.shape, rung, rung.sizeMM)}
      <figcaption><b>${rung.sizeMM}mm · ${rung.magnets.length} magnets</b>
      <span>rows ${shapeDesc}</span>
      <span>grid offset ${pl.phaseMM[0]}/${pl.phaseMM[1]}mm · Light shows ${rung.rimMagnets.length}</span></figcaption>
    </figure>`)
  }
  body += `<section><h2>${c.name}</h2><p class="note">${c.note} — every option below is legal under the law as written. <b>${panels.length} lawful placements.</b></p><div class="grid">${panels.join('')}</div></section>`
}

writeFileSync(new URL('./o3.html', import.meta.url), `<!doctype html><html><head><meta charset="utf-8">
<title>O3 — which layout ships?</title><style>
:root{--bg:#0e0f12;--fg:#e8e9ed;--dim:#8c92a0;--line:#23262e;--card:#15171c;--acc:#60a5fa;--mag:#f8fafc;--rim:#4ade80}
@media(prefers-color-scheme:light){:root{--bg:#fbfbfd;--fg:#16181d;--dim:#6b7280;--line:#e4e6eb;--card:#fff;--acc:#1d4ed8;--mag:#111;--rim:#15803d}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.55 ui-sans-serif,-apple-system,system-ui,sans-serif;padding:30px 24px 70px}
h1{font-size:21px;margin:0 0 6px;letter-spacing:-.01em}
.lede{color:var(--dim);max-width:760px;margin:0 0 30px}
h2{font-size:15px;margin:34px 0 4px;letter-spacing:.02em}
.note{color:var(--dim);margin:0 0 14px;font-size:13px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px}
figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px}
svg{width:100%;height:auto;display:block}
.shape{fill:color-mix(in srgb,var(--acc) 14%,transparent);stroke:var(--acc);stroke-width:2.4}
.hole{fill:var(--bg);stroke:var(--acc);stroke-width:1.6}
.pad{fill:color-mix(in srgb,var(--rim) 10%,transparent);stroke:var(--dim);stroke-width:1.4;stroke-dasharray:4 3;opacity:.85}
.mag{fill:var(--mag)}.mag.rim{fill:var(--rim)}
.lat line{stroke:var(--line);stroke-width:1}
figcaption{font-size:12px;margin-top:8px;display:flex;flex-direction:column;gap:2px}
figcaption b{font-size:13px}figcaption span{color:var(--dim)}
</style></head><body>
<h1>O3 — when several grid positions are legal, which one ships?</h1>
<p class="lede">Dashed circle = the 10mm padding each magnet owns. <b style="color:var(--rim)">Green</b> = what Light shows. Faint lines = the lattice at that offset. Every panel obeys the law in full — that is the problem. The law does not say which to pick, and it says the choice is yours.</p>
${body}</body></html>`)
console.log('wrote o3.html')
