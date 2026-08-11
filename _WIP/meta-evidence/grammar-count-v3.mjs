// META EVIDENCE v3 — supersedes grammar-count.mjs after Pixel's second audit.
//
// Fixes, each traced to a blocking finding:
//  B1 bands were merged under parity and deduped across bands  -> everything is BAND-SCOPED now:
//     grouping and counting are per (band, centreMethod, parityTarget), never across bands.
//  B2 component identity used vertices only                    -> arrangement identity is now
//     canonical VERTEX + ACTIVE-EDGE identity, because the active pair boxes are the region.
//  B3 optimum counted every four-corner occurrence             -> optimum is now the FIRST lawful
//     published size inside each disjoint interval of that canonical arrangement; later sizes with
//     the same topology are intermediate. Family optimum requires BOTH populations optimum there.
//  B4 output could not answer the centre question              -> raw lawful sizes, band-scoped
//     family counts and interval-first optimum counts are reported as separate columns.
//
// DECLARED APPROXIMATIONS (unchanged, labelled not claimed away): DP-simplified outlines;
// ON_EPS/CROSS_EPS numeric robustness guards; maximum-clearance is branch-and-bound, NOT the
// blueprint's finite segment-Voronoi construction — exploratory wherever it appears.

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ON_EPS = 1e-9, CROSS_EPS = 1e-12
const BASE_PITCH = 48, PADDING = 12, POSITIONS = 9
const BANDS = [2, 3], POPULATIONS = [48, 96]
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
function boxInPolygon(b, poly) {
  const c = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]]
  for (const q of c) {
    if (!pointInPolygon(q, poly)) {
      let on = false
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if (distToSegment(q, poly[i], poly[j]) <= ON_EPS) { on = true; break }
      if (!on) return false
    }
  }
  const be = [[c[0], c[1]], [c[1], c[2]], [c[2], c[3]], [c[3], c[0]]]
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const p = poly[j], q = poly[i]
    for (const [a, d] of be) {
      const d1 = cross(sub(d, a), sub(p, a)), d2 = cross(sub(d, a), sub(q, a))
      const d3 = cross(sub(q, p), sub(a, p)), d4 = cross(sub(q, p), sub(d, p))
      if (((d1 > CROSS_EPS && d2 < -CROSS_EPS) || (d1 < -CROSS_EPS && d2 > CROSS_EPS)) &&
          ((d3 > CROSS_EPS && d4 < -CROSS_EPS) || (d3 < -CROSS_EPS && d4 > CROSS_EPS))) return false
    }
  }
  return true
}
const boxCentre = (p) => { const xs = p.map(q => q[0]), ys = p.map(q => q[1]); return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2] }
const areaCentre = (p) => { let a2 = 0, cx = 0, cy = 0; for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length], c = cross(q, r); a2 += c; cx += (q[0] + r[0]) * c; cy += (q[1] + r[1]) * c } return a2 === 0 ? boxCentre(p) : [cx / (3 * a2), cy / (3 * a2)] }
const perimeterCentre = (p) => { let L = 0, cx = 0, cy = 0; for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length], e = Math.hypot(r[0] - q[0], r[1] - q[1]); L += e; cx += ((q[0] + r[0]) / 2) * e; cy += ((q[1] + r[1]) / 2) * e } return L === 0 ? boxCentre(p) : [cx / L, cy / L] }
const vertexCentre = (p) => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length]
const hull = (pts) => { const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]); const t = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); const h = (i) => { const o = []; for (const p of i) { while (o.length >= 2 && t(o[o.length - 2], o[o.length - 1], p) <= 0) o.pop(); o.push(p) } return o }; return [...h(s).slice(0, -1), ...h([...s].reverse()).slice(0, -1)] }
const orientedBoxCentre = (p) => { const h = hull(p); let best = null; const rot = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]; for (let i = 0; i < h.length; i++) { const a = h[i], b = h[(i + 1) % h.length], an = -Math.atan2(b[1] - a[1], b[0] - a[0]); const loc = h.map(q => rot(q, an)); const xs = loc.map(q => q[0]), ys = loc.map(q => q[1]); const ar = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)); if (!best || ar < best.ar) best = { ar, c: rot([(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2], -an) } } return best ? best.c : boxCentre(p) }
const maxClearanceCentre = (p) => {
  const signed = (q) => { let d = Infinity; for (let i = 0, j = p.length - 1; i < p.length; j = i++) d = Math.min(d, distToSegment(q, p[i], p[j])); return pointInPolygon(q, p) ? d : -d }
  const xs = p.map(q => q[0]), ys = p.map(q => q[1]); const minX = Math.min(...xs), minY = Math.min(...ys)
  const W = Math.max(...xs) - minX, H = Math.max(...ys) - minY, size = Math.min(W, H)
  let cells = []
  for (let x = minX; x < minX + W; x += size) for (let y = minY; y < minY + H; y += size) { const c = [x + size / 2, y + size / 2]; cells.push({ c, h: size / 2, d: signed(c) }) }
  let best = cells.reduce((a, b) => (b.d > a.d ? b : a), cells[0]); const stop = 1e-6 * Math.max(W, H); let it = 0
  while (cells.length && it++ < 40000) {
    cells.sort((a, b) => (b.d + b.h * Math.SQRT2) - (a.d + a.h * Math.SQRT2))
    const cell = cells.shift(); if (cell.d > best.d) best = cell
    if (cell.d + cell.h * Math.SQRT2 - best.d <= stop) continue
    const h = cell.h / 2
    for (const [dx, dy] of [[-h, -h], [h, -h], [-h, h], [h, h]]) { const c = [cell.c[0] + dx, cell.c[1] + dy]; cells.push({ c, h, d: signed(c) }) }
  }
  return best.c
}
const CENTRES = { box: boxCentre, 'oriented-box': orientedBoxCentre, area: areaCentre, perimeter: perimeterCentre, vertices: vertexCentre, 'maximum-clearance': maxClearanceCentre }

const target = (k) => (k % 2 === 1 ? 0 : 24)
const run = (s, k) => Array.from({ length: k }, (_, i) => s * (i - Math.floor((k - 1) / 2)))
function windowOf(s, r, c) {
  const xs = run(s, c), ys = run(s, r), V = []
  for (const y of ys) for (const x of xs) V.push([x, y])
  const E = []
  for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) {
    const dx = Math.abs(V[i][0] - V[j][0]), dy = Math.abs(V[i][1] - V[j][1])
    if ((dx === s && dy === 0) || (dy === s && dx === 0)) E.push([i, j])
  }
  return { s, r, c, V, E, parity: `${target(c)},${target(r)}` }
}
const boxOfEdge = (a, b) => ({ x0: Math.min(a[0], b[0]) - PADDING, x1: Math.max(a[0], b[0]) + PADDING, y0: Math.min(a[1], b[1]) - PADDING, y1: Math.max(a[1], b[1]) + PADDING })

/** Components with their INTERNAL ACTIVE EDGES — identity is vertices AND edges (B2). */
function componentsWithEdges(V, E, active) {
  const parent = V.map((_, i) => i)
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])))
  const uni = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb }
  E.forEach((e, k) => { if (active[k]) uni(e[0], e[1]) })
  const byRoot = new Map()
  E.forEach((e, k) => {
    if (!active[k]) return
    const r = find(e[0])
    if (!byRoot.has(r)) byRoot.set(r, { verts: new Set(), edges: [] })
    const g = byRoot.get(r); g.verts.add(e[0]); g.verts.add(e[1]); g.edges.push(e)
  })
  return [...byRoot.values()].map(g => {
    const verts = [...g.verts].sort((a, b) => a - b)
    const vsig = verts.map(i => V[i].join(':')).join('|')
    const esig = g.edges.map(([i, j]) => [V[i].join(':'), V[j].join(':')].sort().join('>')).sort().join('~')
    return { verts, vertPts: verts.map(i => V[i]), sig: `${vsig}#${esig}`, four: isFourCorner(verts.map(i => V[i])) }
  })
}
function isFourCorner(pts) {
  if (pts.length !== 4) return false
  const xs = [...new Set(pts.map(p => p[0]))].sort((a, b) => a - b)
  const ys = [...new Set(pts.map(p => p[1]))].sort((a, b) => a - b)
  if (xs.length !== 2 || ys.length !== 2) return false
  for (const x of xs) for (const y of ys) if (!pts.some(p => p[0] === x && p[1] === y)) return false
  return true
}

/** One shape, one centre, ONE BAND (B1: never merged across bands). */
function measureBand(points, centre, band) {
  const centred = points.map(p => sub(p, centre))
  const xs = points.map(p => p[0]), ys = points.map(p => p[1])
  const L = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))

  const windows = []
  for (const s of POPULATIONS) for (let r = 1; r <= band; r++) for (let c = 1; c <= band; c++) {
    const w = windowOf(s, r, c); if (w.E.length) windows.push(w)
  }
  const boxKey = new Map()
  for (const w of windows) w.boxIds = w.E.map(([i, j]) => {
    const b = boxOfEdge(w.V[i], w.V[j]), k = `${b.x0},${b.y0},${b.x1},${b.y1}`
    if (!boxKey.has(k)) boxKey.set(k, { b, id: boxKey.size })
    return boxKey.get(k).id
  })
  const boxes = [...boxKey.values()].sort((a, b) => a.id - b.id).map(v => v.b)

  const perSize = []                       // [{ m, byParity: Map(parity -> {48:[arr],96:[arr]}) }]
  const lawfulSizesOf = new Map()          // arrangement sig -> [sizes]
  const rawSizes = []

  for (let m = 2; m <= CEILING; m += 2) {
    const sc = m / L
    const contained = boxes.map(b => boxInPolygon({ x0: b.x0 / sc, x1: b.x1 / sc, y0: b.y0 / sc, y1: b.y1 / sc }, centred))
    const byParity = new Map(); let any = false
    for (const w of windows) {
      const active = w.boxIds.map(id => contained[id])
      if (!active.some(Boolean)) continue
      for (const comp of componentsWithEdges(w.V, w.E, active)) {
        any = true
        if (!byParity.has(w.parity)) byParity.set(w.parity, { 48: new Map(), 96: new Map() })
        byParity.get(w.parity)[w.s].set(comp.sig, comp)
        if (!lawfulSizesOf.has(comp.sig)) lawfulSizesOf.set(comp.sig, [])
        const arr = lawfulSizesOf.get(comp.sig)
        if (arr[arr.length - 1] !== m) arr.push(m)
      }
    }
    if (any) rawSizes.push(m)
    perSize.push({ m, byParity })
  }

  // B3: optimum = FIRST lawful published size in each disjoint interval of that arrangement
  const firstOfInterval = new Map()        // sig -> Set(sizes)
  for (const [sig, sizes] of lawfulSizesOf) {
    const firsts = new Set(); let prev = null
    for (const m of sizes) { if (prev === null || m !== prev + 2) firsts.add(m); prev = m }
    firstOfInterval.set(sig, firsts)
  }

  let families = 0, optimumFamilies = 0
  const optimumSizes = new Set()
  for (const { m, byParity } of perSize) {
    for (const [, pops] of byParity) {
      for (const a of pops[48].values()) for (const b of pops[96].values()) {
        families++
        const aOpt = a.four && firstOfInterval.get(a.sig).has(m)
        const bOpt = b.four && firstOfInterval.get(b.sig).has(m)
        if (aOpt && bOpt) { optimumFamilies++; optimumSizes.add(m) }
      }
    }
  }
  return { rawSizes: rawSizes.length, families, optimumFamilies, optimumSizes: [...optimumSizes].sort((x, y) => x - y) }
}

const corpus = JSON.parse(readFileSync(join(HERE, 'corpus-outlines.json'), 'utf8'))
console.log('META EVIDENCE v3 — band-scoped, vertex+edge identity, interval-first optimum')
console.log(`spec: pitch ${BASE_PITCH}, padding ${PADDING}, positions ${POSITIONS} (ceiling ${CEILING}mm), populations ${POPULATIONS.join('/')}`)
console.log('APPROX DECLARED: DP-simplified outlines; ON_EPS 1e-9 / CROSS_EPS 1e-12 robustness guards;')
console.log('maximum-clearance is branch-and-bound, NOT segment-Voronoi — exploratory.\n')
console.log('shape | centre | band | lawful sizes | families | optimum families | optimum sizes')
console.log('------|--------|------|--------------|----------|------------------|--------------')
for (const s of corpus) {
  if (s.error) continue
  for (const [name, fn] of Object.entries(CENTRES)) {
    const c = fn(s.points)
    for (const band of BANDS) {
      const r = measureBand(s.points, c, band)
      console.log(`${s.name} | ${name} | ${band} | ${r.rawSizes} | ${r.families} | ${r.optimumFamilies} | ${r.optimumSizes.length ? r.optimumSizes.join(',') : '—'}`)
    }
  }
}
console.log('\nProvenance:')
for (const s of corpus) if (!s.error) console.log(`  ${s.name} sha256:${s.sha256} ${s.wPx}x${s.hPx}px ring ${s.rawPoints} -> ${s.points.length} pts (DP 1px)`)
