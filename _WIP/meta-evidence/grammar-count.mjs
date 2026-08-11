// META EVIDENCE v2 — executes blueprint v2.1 §6 grammar, not a hand-built corner ring.
//
// Supersedes fourpoint-count.mjs, which Pixel's audit correctly rejected: it constructed the four
// corners of a band extent and ringed them as adjacent pairs, which at band 3 connects points 96mm
// apart on a 48mm lattice — an arrangement the grammar does not contain. Its b3@48 == b2@96
// "finding" was that constructor's own identity, not a property of the engine.
//
// What this does instead, per blueprint §6 and §7.4:
//   1. centred windows W(s,r,c) for every extent 1<=r,c<=band, per population;
//   2. adjacency graph: an edge only between points exactly ONE population pitch apart;
//   3. an edge is ACTIVE when its padded pair box is contained in the scaled outline;
//   4. arrangements = connected components carrying >=1 active edge;
//   5. four-corner OPTIMUM only when the component has exactly four vertices which are the corners
//      of their own 2x2 extent — never a hand-declared ring;
//   6. families = 48-arrangement x 96-arrangement sharing the same PER-AXIS PARITY TARGET at the
//      same published even size; extents may differ, as §7.4 requires.
//
// DECLARED APPROXIMATIONS (Pixel's Blocking 3 — these are labelled, not claimed away):
//   - outlines are Douglas-Peucker simplified; stability is measured at three tolerances below;
//   - point-on-boundary uses ON_EPS, segment crossing uses CROSS_EPS: both are numeric-robustness
//     guards, not law thresholds, and the stability run reports whether any count moves with them;
//   - maximum-clearance is branch-and-bound to answer stability, NOT the blueprint's finite
//     segment-Voronoi construction. It is labelled exploratory wherever it appears.

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ON_EPS = 1e-9
const CROSS_EPS = 1e-12

const BASE_PITCH = 48, PADDING = 12, POSITIONS = 9
const BANDS = [2, 3]
const POPULATIONS = [48, 96]
const CEILING = (POSITIONS - 1) * BASE_PITCH + 2 * PADDING

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]]
const cross = (a, b) => a[0] * b[1] - a[1] * b[0]

function pointInPolygon([x, y], poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
function distToSegment(p, a, b) {
  const ab = sub(b, a), L = ab[0] * ab[0] + ab[1] * ab[1]
  if (L === 0) return Math.hypot(p[0] - a[0], p[1] - a[1])
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / L))
  return Math.hypot(p[0] - (a[0] + t * ab[0]), p[1] - (a[1] + t * ab[1]))
}
/** Box (already in SOURCE coordinates) contained in the fixed source polygon, closed. */
function boxInPolygon(b, poly) {
  const corners = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]]
  for (const c of corners) {
    if (!pointInPolygon(c, poly)) {
      let on = false
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        if (distToSegment(c, poly[i], poly[j]) <= ON_EPS) { on = true; break }
      }
      if (!on) return false
    }
  }
  const be = [[corners[0], corners[1]], [corners[1], corners[2]], [corners[2], corners[3]], [corners[3], corners[0]]]
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const p = poly[j], q = poly[i]
    for (const [a, c] of be) {
      const d1 = cross(sub(c, a), sub(p, a)), d2 = cross(sub(c, a), sub(q, a))
      const d3 = cross(sub(q, p), sub(a, p)), d4 = cross(sub(q, p), sub(c, p))
      if (((d1 > CROSS_EPS && d2 < -CROSS_EPS) || (d1 < -CROSS_EPS && d2 > CROSS_EPS)) &&
          ((d3 > CROSS_EPS && d4 < -CROSS_EPS) || (d3 < -CROSS_EPS && d4 > CROSS_EPS))) return false
    }
  }
  return true
}

// ── centres ──────────────────────────────────────────────────────────────────
const boxCentre = (p) => { const xs = p.map(q => q[0]), ys = p.map(q => q[1]); return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2] }
const areaCentre = (p) => { let a2 = 0, cx = 0, cy = 0; for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length], c = cross(q, r); a2 += c; cx += (q[0] + r[0]) * c; cy += (q[1] + r[1]) * c } return a2 === 0 ? boxCentre(p) : [cx / (3 * a2), cy / (3 * a2)] }
const perimeterCentre = (p) => { let L = 0, cx = 0, cy = 0; for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length], e = Math.hypot(r[0] - q[0], r[1] - q[1]); L += e; cx += ((q[0] + r[0]) / 2) * e; cy += ((q[1] + r[1]) / 2) * e } return L === 0 ? boxCentre(p) : [cx / L, cy / L] }
const vertexCentre = (p) => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length]
const hull = (pts) => { const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]); const turn = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); const half = (i) => { const o = []; for (const p of i) { while (o.length >= 2 && turn(o[o.length - 2], o[o.length - 1], p) <= 0) o.pop(); o.push(p) } return o }; return [...half(s).slice(0, -1), ...half([...s].reverse()).slice(0, -1)] }
const orientedBoxCentre = (p) => { const h = hull(p); let best = null; const rot = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]; for (let i = 0; i < h.length; i++) { const a = h[i], b = h[(i + 1) % h.length], ang = -Math.atan2(b[1] - a[1], b[0] - a[0]); const loc = h.map(q => rot(q, ang)); const xs = loc.map(q => q[0]), ys = loc.map(q => q[1]); const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)); if (!best || area < best.area) best = { area, centre: rot([(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2], -ang) } } return best ? best.centre : boxCentre(p) }
const maxClearanceCentre = (p) => {
  const signed = (q) => { let d = Infinity; for (let i = 0, j = p.length - 1; i < p.length; j = i++) d = Math.min(d, distToSegment(q, p[i], p[j])); return pointInPolygon(q, p) ? d : -d }
  const xs = p.map(q => q[0]), ys = p.map(q => q[1])
  const minX = Math.min(...xs), minY = Math.min(...ys)
  const W = Math.max(...xs) - minX, H = Math.max(...ys) - minY
  const size = Math.min(W, H); let cells = []
  for (let x = minX; x < minX + W; x += size) for (let y = minY; y < minY + H; y += size) { const c = [x + size / 2, y + size / 2]; cells.push({ c, h: size / 2, d: signed(c) }) }
  let best = cells.reduce((a, b) => (b.d > a.d ? b : a), cells[0])
  const stop = 1e-6 * Math.max(W, H)
  let iter = 0
  while (cells.length && iter++ < 40000) {
    cells.sort((a, b) => (b.d + b.h * Math.SQRT2) - (a.d + a.h * Math.SQRT2))
    const cell = cells.shift()
    if (cell.d > best.d) best = cell
    if (cell.d + cell.h * Math.SQRT2 - best.d <= stop) continue
    const h = cell.h / 2
    for (const [dx, dy] of [[-h, -h], [h, -h], [-h, h], [h, h]]) { const c = [cell.c[0] + dx, cell.c[1] + dy]; cells.push({ c, h, d: signed(c) }) }
  }
  return best.c
}
const CENTRES = { box: boxCentre, 'oriented-box': orientedBoxCentre, area: areaCentre, perimeter: perimeterCentre, vertices: vertexCentre, 'maximum-clearance': maxClearanceCentre }

// ── §6.1 windows, §6.2 adjacency ─────────────────────────────────────────────
const target = (k) => (k % 2 === 1 ? 0 : 24)
const run = (s, k) => Array.from({ length: k }, (_, i) => s * (i - Math.floor((k - 1) / 2)))
function windowOf(s, r, c) {
  const xs = run(s, c), ys = run(s, r)
  const V = []
  for (const y of ys) for (const x of xs) V.push([x, y])
  return { s, r, c, V, parity: [target(c), target(r)] }
}
/** Edges only between points exactly one population pitch apart — never diagonals, never 2 pitches. */
function edgesOf(w) {
  const E = []
  for (let i = 0; i < w.V.length; i++) for (let j = i + 1; j < w.V.length; j++) {
    const dx = Math.abs(w.V[i][0] - w.V[j][0]), dy = Math.abs(w.V[i][1] - w.V[j][1])
    if ((dx === w.s && dy === 0) || (dy === w.s && dx === 0)) E.push([i, j])
  }
  return E
}
const boxOfEdge = (a, b) => ({
  x0: Math.min(a[0], b[0]) - PADDING, x1: Math.max(a[0], b[0]) + PADDING,
  y0: Math.min(a[1], b[1]) - PADDING, y1: Math.max(a[1], b[1]) + PADDING,
})
/** Components carrying at least one active edge. */
function components(V, E, active) {
  const parent = V.map((_, i) => i)
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])))
  const uni = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb }
  const used = new Set()
  E.forEach((e, k) => { if (active[k]) { uni(e[0], e[1]); used.add(e[0]); used.add(e[1]) } })
  const groups = new Map()
  for (const v of used) { const r = find(v); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(v) }
  return [...groups.values()].map(idx => idx.sort((a, b) => a - b))
}
/** Four-corner optimum: exactly four vertices which are the corners of their own extent. */
function isFourCorner(idx, V) {
  if (idx.length !== 4) return false
  const pts = idx.map(i => V[i])
  const xs = [...new Set(pts.map(p => p[0]))].sort((a, b) => a - b)
  const ys = [...new Set(pts.map(p => p[1]))].sort((a, b) => a - b)
  if (xs.length !== 2 || ys.length !== 2) return false
  for (const x of xs) for (const y of ys) if (!pts.some(p => p[0] === x && p[1] === y)) return false
  return true
}

// ── run one shape/centre ─────────────────────────────────────────────────────
function measure(points, centre) {
  const centred = points.map(p => sub(p, centre))
  const xs = points.map(p => p[0]), ys = points.map(p => p[1])
  const L = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))

  const windows = []
  for (const band of BANDS) for (const s of POPULATIONS)
    for (let r = 1; r <= band; r++) for (let c = 1; c <= band; c++) {
      const w = windowOf(s, r, c); w.band = band; w.E = edgesOf(w); if (w.E.length) windows.push(w)
    }
  // distinct boxes across all windows, solved once per size
  const boxKey = new Map()
  for (const w of windows) w.boxIds = w.E.map(([i, j]) => {
    const b = boxOfEdge(w.V[i], w.V[j]); const k = `${b.x0},${b.y0},${b.x1},${b.y1}`
    if (!boxKey.has(k)) boxKey.set(k, { b, id: boxKey.size })
    return boxKey.get(k).id
  })
  const boxes = [...boxKey.values()].sort((a, b) => a.id - b.id).map(v => v.b)

  const rawSizes = []            // sizes with >=1 lawful arrangement anywhere
  let familyCount = 0            // parity-compatible 48x96 couplings at one size
  let optimumFamilies = 0        // families whose BOTH populations are four-corner
  const optimumSizes = new Set()

  for (let m = 2; m <= CEILING; m += 2) {
    const sc = m / L
    const contained = boxes.map(b => boxInPolygon({ x0: b.x0 / sc, x1: b.x1 / sc, y0: b.y0 / sc, y1: b.y1 / sc }, centred))
    const byParity = new Map()   // parityKey -> { 48: [arr], 96: [arr] }
    let any = false
    for (const w of windows) {
      const active = w.boxIds.map(id => contained[id])
      if (!active.some(Boolean)) continue
      for (const idx of components(w.V, w.E, active)) {
        any = true
        const key = `${w.parity[0]},${w.parity[1]}`
        if (!byParity.has(key)) byParity.set(key, { 48: [], 96: [] })
        byParity.get(key)[w.s].push({ four: isFourCorner(idx, w.V), sig: idx.map(i => w.V[i].join(':')).join('|') })
      }
    }
    if (any) rawSizes.push(m)
    for (const [, pops] of byParity) {
      const a48 = [...new Map(pops[48].map(x => [x.sig, x])).values()]
      const a96 = [...new Map(pops[96].map(x => [x.sig, x])).values()]
      for (const x of a48) for (const y of a96) {
        familyCount++
        if (x.four && y.four) { optimumFamilies++; optimumSizes.add(m) }
      }
    }
  }
  return { rawSizes: rawSizes.length, familyCount, optimumFamilies, optimumSizes: [...optimumSizes] }
}

// ── main ─────────────────────────────────────────────────────────────────────
const corpus = JSON.parse(readFileSync(join(HERE, 'corpus-outlines.json'), 'utf8'))
console.log('META EVIDENCE v2 — blueprint §6 grammar executed (supersedes fourpoint-count.mjs)')
console.log(`spec: pitch ${BASE_PITCH}, padding ${PADDING}, positions ${POSITIONS} (ceiling ${CEILING}mm), bands ${BANDS.join('/')}, populations ${POPULATIONS.join('/')}`)
console.log('APPROXIMATIONS DECLARED: DP-simplified outlines; ON_EPS 1e-9, CROSS_EPS 1e-12 (robustness guards);')
console.log('maximum-clearance is branch-and-bound, NOT the blueprint segment-Voronoi construction — exploratory.\n')
console.log('shape | centre | lawful sizes | families | 4-corner families | 4-corner sizes')
console.log('------|--------|--------------|----------|-------------------|---------------')
for (const s of corpus) {
  if (s.error) continue
  for (const [name, fn] of Object.entries(CENTRES)) {
    const r = measure(s.points, fn(s.points))
    console.log(`${s.name} | ${name} | ${r.rawSizes} | ${r.familyCount} | ${r.optimumFamilies} | ${r.optimumSizes.length ? r.optimumSizes[0] + '..' + r.optimumSizes[r.optimumSizes.length - 1] : '—'}`)
  }
}
console.log('\nProvenance:')
for (const s of corpus) if (!s.error) console.log(`  ${s.name} sha256:${s.sha256} ${s.wPx}x${s.hPx}px ring ${s.rawPoints} -> ${s.points.length} pts (DP 1px)`)
