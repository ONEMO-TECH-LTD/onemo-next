// META EVIDENCE — how many lawful FOUR-POINT sizes does each cut-out have, per centre method.
//
// Measurement only. No default is chosen, no bar is asserted, no law/contract/blueprint is touched.
// It answers exactly one question, so Dan can rule the centre policy by looking at a table:
//
//   for each shape and each of the six centre constructions, how many published even sizes exist
//   at which the four-corner 2x2 arrangement is lawful.
//
// LAWFULNESS is the ruled predicate (L18, blueprint v2.1 §7.1): the union of the arrangement's
// adjacent PAIR BOXES must be contained in the scaled outline. Union containment is a conjunction
// of box containments, so each of the four boxes is tested exactly. Containment is CLOSED —
// tangency is lawful, no epsilon — which is why a square lands exactly on its canon.
//
// The engine's own solver is NOT used and is not importable here by design: this is an independent
// second implementation, so agreement is evidence and disagreement is a finding.
//
// Provenance is printed with the result: fixture sha256, traced point counts, spec values.

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const corpus = JSON.parse(readFileSync(join(HERE, 'corpus-outlines.json'), 'utf8'))

// ── released spec (guarded law values; nothing here is invented) ──────────────
const BASE_PITCH = 48
const PADDING = 12
const POSITIONS = 9
const BANDS = [2, 3]            // operational bands only (EC-03)
const POPULATIONS = [48, 96]
const FIELD_SPAN = (POSITIONS - 1) * BASE_PITCH + 2 * PADDING   // 408mm ceiling as a count

// ── geometry ─────────────────────────────────────────────────────────────────
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

/** Closed containment of an axis-aligned box in a simple polygon. */
function boxInPolygon(box, poly) {
  const { x0, y0, x1, y1 } = box
  const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
  // 1. every corner inside or on the boundary
  for (const c of corners) {
    if (!pointInPolygon(c, poly)) {
      let onEdge = false
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        if (distToSegment(c, poly[i], poly[j]) <= 1e-9) { onEdge = true; break }
      }
      if (!onEdge) return false
    }
  }
  // 2. no polygon edge crosses a box edge (a notch can enter with all corners inside)
  const boxEdges = [[corners[0], corners[1]], [corners[1], corners[2]], [corners[2], corners[3]], [corners[3], corners[0]]]
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const p = poly[j], q = poly[i]
    for (const [a, b] of boxEdges) {
      const d1 = cross(sub(b, a), sub(p, a)), d2 = cross(sub(b, a), sub(q, a))
      const d3 = cross(sub(q, p), sub(a, p)), d4 = cross(sub(q, p), sub(b, p))
      if (((d1 > 1e-12 && d2 < -1e-12) || (d1 < -1e-12 && d2 > 1e-12)) &&
          ((d3 > 1e-12 && d4 < -1e-12) || (d3 < -1e-12 && d4 > 1e-12))) return false
    }
  }
  return true
}

// ── centre constructions (six, exactly as the blueprint defines them) ─────────
const boxCentre = (p) => {
  const xs = p.map(q => q[0]), ys = p.map(q => q[1])
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
}
const areaCentre = (p) => {
  let a2 = 0, cx = 0, cy = 0
  for (let i = 0; i < p.length; i++) {
    const q = p[i], r = p[(i + 1) % p.length], c = cross(q, r)
    a2 += c; cx += (q[0] + r[0]) * c; cy += (q[1] + r[1]) * c
  }
  return a2 === 0 ? boxCentre(p) : [cx / (3 * a2), cy / (3 * a2)]
}
const perimeterCentre = (p) => {
  let L = 0, cx = 0, cy = 0
  for (let i = 0; i < p.length; i++) {
    const q = p[i], r = p[(i + 1) % p.length]
    const e = Math.hypot(r[0] - q[0], r[1] - q[1])
    L += e; cx += ((q[0] + r[0]) / 2) * e; cy += ((q[1] + r[1]) / 2) * e
  }
  return L === 0 ? boxCentre(p) : [cx / L, cy / L]
}
const vertexCentre = (p) => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length]
const hull = (pts) => {
  const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const turn = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  const half = (inp) => { const o = []; for (const p of inp) { while (o.length >= 2 && turn(o[o.length - 2], o[o.length - 1], p) <= 0) o.pop(); o.push(p) } return o }
  return [...half(s).slice(0, -1), ...half([...s].reverse()).slice(0, -1)]
}
const orientedBoxCentre = (p) => {
  const h = hull(p); let best = null
  const rot = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length]
    const ang = -Math.atan2(b[1] - a[1], b[0] - a[0])
    const loc = h.map(q => rot(q, ang))
    const xs = loc.map(q => q[0]), ys = loc.map(q => q[1])
    const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))
    if (!best || area < best.area) best = { area, centre: rot([(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2], -ang) }
  }
  return best ? best.centre : boxCentre(p)
}
/** Maximum-clearance: branch and bound to ANSWER STABILITY, not to an invented resolution. */
const maxClearanceCentre = (p) => {
  const signed = (q) => {
    let d = Infinity
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) d = Math.min(d, distToSegment(q, p[i], p[j]))
    return pointInPolygon(q, p) ? d : -d
  }
  const xs = p.map(q => q[0]), ys = p.map(q => q[1])
  const minX = Math.min(...xs), minY = Math.min(...ys)
  const W = Math.max(...xs) - minX, H = Math.max(...ys) - minY
  let cells = []
  const size = Math.min(W, H)
  for (let x = minX; x < minX + W; x += size) for (let y = minY; y < minY + H; y += size) {
    const c = [x + size / 2, y + size / 2]; cells.push({ c, h: size / 2, d: signed(c) })
  }
  let best = cells.reduce((a, b) => (b.d > a.d ? b : a), cells[0])
  const stop = 1e-6 * Math.max(W, H)
  while (cells.length) {
    cells.sort((a, b) => (b.d + b.h * Math.SQRT2) - (a.d + a.h * Math.SQRT2))
    const cell = cells.shift()
    if (cell.d > best.d) best = cell
    if (cell.d + cell.h * Math.SQRT2 - best.d <= stop) continue
    const h = cell.h / 2
    for (const [dx, dy] of [[-h, -h], [h, -h], [-h, h], [h, h]]) {
      const c = [cell.c[0] + dx, cell.c[1] + dy]; cells.push({ c, h, d: signed(c) })
    }
    if (cells.length > 20000) break
  }
  return best.c
}
const CENTRES = {
  box: boxCentre, 'oriented-box': orientedBoxCentre, area: areaCentre,
  perimeter: perimeterCentre, vertices: vertexCentre, 'maximum-clearance': maxClearanceCentre,
}

// ── the four-point arrangement and its pair boxes ─────────────────────────────
/** Band n, population pitch s: the centred 2x2 (four corners of the band's outermost extent). */
function fourCornerMagnets(band, pitch) {
  // Four corners of the band's outermost rectangular extent, on the one lattice, parity-centred.
  const span = (band - 1) * pitch
  const half = span / 2
  return [[-half, -half], [half, -half], [half, half], [-half, half]]
}
/** Adjacent pairs of the 2x2 (four edges of the ring) and their padded boxes. */
function pairBoxes(magnets) {
  const boxes = []
  const adj = [[0, 1], [1, 2], [2, 3], [3, 0]]
  for (const [i, j] of adj) {
    const a = magnets[i], b = magnets[j]
    boxes.push({
      x0: Math.min(a[0], b[0]) - PADDING, x1: Math.max(a[0], b[0]) + PADDING,
      y0: Math.min(a[1], b[1]) - PADDING, y1: Math.max(a[1], b[1]) + PADDING,
    })
  }
  return boxes
}

// ── count lawful published sizes ─────────────────────────────────────────────
function countFourPoint(points, centre, band, pitch) {
  const centred = points.map(p => sub(p, centre))
  const xs = points.map(p => p[0]), ys = points.map(p => p[1])
  const srcLongest = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
  const boxes = pairBoxes(fourCornerMagnets(band, pitch))
  const sizes = []
  for (let m = 2; m <= FIELD_SPAN; m += 2) {
    const s = m / srcLongest
    const poly = centred.map(([x, y]) => [x * s, y * s])
    let ok = true
    for (const b of boxes) { if (!boxInPolygon(b, poly)) { ok = false; break } }
    if (ok) sizes.push(m)
  }
  return sizes
}

// ── run ──────────────────────────────────────────────────────────────────────
console.log('META EVIDENCE — lawful FOUR-POINT sizes per shape per centre method')
console.log(`spec: basePitch ${BASE_PITCH}mm, padding ${PADDING}mm, positions ${POSITIONS} (ceiling ${FIELD_SPAN}mm), bands ${BANDS.join('/')}, populations ${POPULATIONS.join('/')}`)
console.log('predicate: union of adjacent pair boxes contained in the scaled outline, closed, no epsilon\n')

const rows = []
for (const shape of corpus) {
  if (shape.error) { console.log(`${shape.name}: ${shape.error}`); continue }
  const pts = shape.points
  for (const [name, fn] of Object.entries(CENTRES)) {
    const centre = fn(pts)
    const per = {}
    for (const band of BANDS) for (const pitch of POPULATIONS) {
      per[`b${band}@${pitch}`] = countFourPoint(pts, centre, band, pitch)
    }
    // a family requires BOTH populations lawful at the SAME published size (L14 condition 2)
    const coupled = {}
    for (const band of BANDS) {
      const a = new Set(per[`b${band}@48`]), b = per[`b${band}@96`]
      coupled[`band${band}`] = b.filter(m => a.has(m))
    }
    rows.push({ shape: shape.name, sha: shape.sha256, centre: name, per, coupled,
      total48: BANDS.reduce((n, b) => n + per[`b${b}@48`].length, 0),
      totalCoupled: BANDS.reduce((n, b) => n + coupled[`band${b}`].length, 0) })
  }
}

const header = ['shape', 'centre method', 'b2@48', 'b3@48', 'b2@96', 'b3@96', '48-only total', 'coupled 48+96']
console.log(header.join(' | '))
console.log(header.map(h => '-'.repeat(h.length)).join('-|-'))
for (const r of rows) {
  console.log([
    r.shape, r.centre,
    r.per['b2@48'].length, r.per['b3@48'].length,
    r.per['b2@96'].length, r.per['b3@96'].length,
    r.total48, r.totalCoupled,
  ].join(' | '))
}

console.log('\nProvenance:')
for (const s of corpus) if (!s.error) console.log(`  ${s.name}  sha256:${s.sha256}  ${s.wPx}x${s.hPx}px  ring ${s.rawPoints} -> ${s.points.length} pts`)
