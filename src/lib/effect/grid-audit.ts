// grid-audit.ts — the STANDING verification gate for the magnetic-grid engine (s59).
// Run: npx tsx src/lib/effect/grid-audit.ts   → exits non-zero on any violation.
// Covers the launch laws across representative contour families: 48/68 vocabulary, mode purity,
// coverage semantics, ring spacing, focal-8 radial extremes, padding monotonicity, centering,
// semantic ladders (ONE + sequential labels, ascending sizes), caps/floors/format laws.
import { computeGrid, autoGrid, balancedFit, resolveGridPlan, semanticLadder, stdShapeContour, maxDesignMM, minEffectMM, rectFormat, legalPatterns, DEFAULT_LAW } from './grid-admin'
import { resolveUserPlan } from './grid-user'
import { insetRingMM } from './offset'
import type { Contour, Pt } from './types'

const blob = (s: number): Contour => { const pts: Pt[] = []; for (let i = 0; i < 64; i++) { const t = i / 64 * Math.PI * 2; const r = s / 2 * (1 + 0.18 * Math.sin(3 * t) + 0.1 * Math.cos(5 * t)); pts.push([s / 2 + r * Math.cos(t), s / 2 + r * Math.sin(t)]) } return { outer: { pts }, holes: [] } }
const Lsh = (s: number): Contour => ({ outer: { pts: [[0, 0], [s, 0], [s, s / 2], [s / 2, s / 2], [s / 2, s], [0, s]] as Pt[] }, holes: [] })
const star = (s: number): Contour => { const pts: Pt[] = []; for (let i = 0; i < 10; i++) { const t = i / 10 * Math.PI * 2 - Math.PI / 2; const r = (i % 2 === 0 ? 0.5 : 0.22) * s; pts.push([s / 2 + r * Math.cos(t), s / 2 + r * Math.sin(t)]) } return { outer: { pts }, holes: [] } }
const SH: [string, (s: number) => Contour][] = [
  ['square', s => stdShapeContour('square', s)], ['diamond', s => stdShapeContour('diamondShape', s)],
  ['circle', s => stdShapeContour('circle', s)], ['triangle', s => stdShapeContour('triangle', s)],
  ['rect', s => stdShapeContour('rect', s, Math.round(s * 0.6))], ['blob', blob], ['L', Lsh], ['star', star]]
let V = 0
const flag = (m: string) => { V++; console.log('⚠️ ' + m) }
const wrap = (d: Contour) => (m: number): Contour => { if (Math.abs(m) < 0.01) return d; const o = insetRingMM(d.outer.pts, m, 'round'); return o && o.length >= 3 ? { outer: { pts: o }, holes: [] } : d }
const SEQ = ['2XS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL']

for (const [nm, mk] of SH) {
  for (const mode of ['auto', 'standard', 'quincunx', 'diamond'] as const) {
    for (const s of [80, 140, 200, 250]) {
      const d = mk(s); const w = wrap(d)
      const pin = mode === 'auto' ? undefined : mode
      const sel = autoGrid(w, { paddingMM: 10, perimeterOnly: true, sparseThin: true }, 0, 12, { pattern: pin })
      const f = balancedFit(w, { paddingMM: 10, perimeterOnly: true, sparseThin: true, pitchMM: sel.pitchMM, pattern: sel.pattern }, 0, 12)
      const a = f.grid.anchors
      if (![48, 96].includes(sel.pitchMM)) flag(`${nm}${s} ${mode}: pitch ${sel.pitchMM}`)
      if (sel.pattern === 'quincunx' && f.grid.pitchCentreMM < 96) flag(`${nm}${s}: dice below 96`)
      if (a.length > 1) {
        let mp = Infinity
        for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) { const dd = Math.hypot(a[i].p[0] - a[j].p[0], a[i].p[1] - a[j].p[1]); if (dd < mp) mp = dd }
        const ok = mode === 'standard' ? [48, 96] : mode === 'diamond' ? [68, 136] : [48, 68, 96, 136]
        if (!ok.some(v => Math.abs(mp - v) < 2.5)) flag(`${nm}${s} ${mode}: min-link ${mp.toFixed(1)}`)
        if (mp < 20 - 1e-6) flag(`${nm}${s} ${mode}: ring overlap`)
      }
    }
    const lad = semanticLadder((s) => mk(s), DEFAULT_LAW, mode)
    if (!lad.length) flag(`${nm}/${mode}: EMPTY ladder`)
    if (lad.length && lad[0].label !== 'ONE') flag(`${nm}/${mode}: first rung not ONE`)
    // multi-point sizes are required in AUTO (the mode the user sees — union of all legal layouts);
    // strict sub-modes may legitimately express fewer (a triangle's 60° tips can't take dice/diamond)
    if (mode === 'auto' && ['square', 'diamond', 'circle', 'triangle'].includes(nm) && !lad.some(r => r.points >= 2)) flag(`${nm}/auto: no multi-point sizes`)
    let li = -2
    for (const r of lad) {
      if (r.label === 'ONE') { if (r.points !== 1) flag(`${nm}/${mode}: ONE with ${r.points}pt`); continue }
      const i = SEQ.indexOf(r.label)
      if (i < 0) flag(`${nm}/${mode}: label outside audit sequence ${r.label}`)
      if (li >= 0 && i !== li + 1) flag(`${nm}/${mode}: label skip ${SEQ[li]}→${r.label}`)
      li = i
    }
    for (let i = 1; i < lad.length; i++) if (lad[i].sizeMM <= lad[i - 1].sizeMM) flag(`${nm}/${mode}: sizes not ascending`)
  }
  const d = mk(160)
  const g = computeGrid(d, { pitchMM: 48, paddingMM: 10, pattern: 'standard', perimeterOnly: true, plan: 'corners8' })
  if (g.anchors.length >= 3 && !g.anchors.some(x => x.dia === 8)) flag(`${nm}: corners8 assigns NO 8mm`)
  const g10 = computeGrid(d, { pitchMM: 48, paddingMM: 10, perimeterOnly: false })
  const g20 = computeGrid(d, { pitchMM: 48, paddingMM: 20, perimeterOnly: false })
  if (g20.anchors.length > g10.anchors.length) flag(`${nm}: pad20 > pad10`)
  for (const pat of ['standard', 'quincunx', 'diamond'] as const) {
    const gF = computeGrid(d, { pitchMM: 48, paddingMM: 10, pattern: pat, perimeterOnly: false })
    const gP = computeGrid(d, { pitchMM: 48, paddingMM: 10, pattern: pat, perimeterOnly: true })
    if (gP.anchors.length > gF.anchors.length) flag(`${nm}/${pat}: belt > full`)
  }
  for (const cm of ['centroid', 'bbox'] as const) if (computeGrid(d, { pitchMM: 48, paddingMM: 10, perimeterOnly: true, center: cm }).anchors.length < 1) flag(`${nm}: ${cm} seats 0`)
}
// ATTACHMENT LAW: velcro = no grid & ok; twin-fix = identical grid to magnetic + twinRequired
for (const [nm, mk] of SH.slice(0, 4)) {
  const d = mk(140)
  const m = computeGrid(d, { attachment: 'magnetic', pitchMM: 48, paddingMM: 10 })
  const t = computeGrid(d, { attachment: 'twinfix', pitchMM: 48, paddingMM: 10 })
  const v = computeGrid(d, { attachment: 'velcro', pitchMM: 48, paddingMM: 10 })
  if (v.anchors.length !== 0 || !v.ok || v.twinRequired) flag(`${nm}: velcro law broken`)
  if (t.anchors.length !== m.anchors.length || !t.twinRequired) flag(`${nm}: twin-fix law broken`)
  if (m.twinRequired) flag(`${nm}: magnetic flagged twinRequired`)
}
// USER PRODUCT LAW: auto never selects admin-only Dice; large Light shapes are perimeter-first; a
// pad-valid region missed by the lattice receives one local rescue instead of staying silently empty.
for (const [nm, contour, pitch, anchors, rescues] of [
  ['circle303', stdShapeContour('circle', 303), 48, 16, 8],
  ['diamond310', stdShapeContour('diamondShape', 310), 96, 12, 6],
] as const) {
  const user = resolveUserPlan(contour, { attachment: 'magnetic' })
  const dice = resolveGridPlan(contour, { mode: 'quincunx', density: 'light' })
  if (user.pattern !== 'standard' || user.pitchMM !== pitch) flag(`${nm}: user auto pattern/pitch drifted`)
  if (user.grid.anchors.length !== anchors || user.grid.rescueAnchors.length !== rescues) flag(`${nm}: user belt/rescue count drifted`)
  if (user.grid.flaps.length) flag(`${nm}: user perimeter rescue left uncovered material`)
  if (user.grid.anchors.length >= dice.grid.anchors.length) flag(`${nm}: user belt not sparser than Dice`)
  if (dice.pattern !== 'quincunx' || dice.pitchMM !== 96) flag(`${nm}: admin Dice unavailable`)
}
{
  const dumbbell: Contour = { outer: { pts: [
    [0, 0], [100, 0], [100, 16], [130, 16], [130, 10], [152, 10],
    [152, 32], [130, 32], [130, 26], [100, 26], [100, 120], [0, 120],
  ] }, holes: [] }
  const user = resolveUserPlan(dumbbell, { attachment: 'magnetic' })
  if (user.grid.rescueAnchors.length !== 1 || user.grid.rescueAnchors[0][0] < 130) flag('user rescue: pad-valid lobe missed')
  if (user.grid.flaps.length) flag('user rescue: pad-valid lobe remains uncovered')
}
// FOCAL-RAMP LAW (auto plan default): <=100mm all-6; >100mm 8mm at radial extremes (+6 rest when
// interior anchors exist); ramp widens >=200
{
  const g70 = computeGrid(stdShapeContour('square', 70), { pitchMM: 48, paddingMM: 10 })
  if (g70.anchors.some(a => a.dia === 8)) flag('focal: 8mm below 100')
  const g118 = computeGrid(stdShapeContour('square', 118), { pitchMM: 48, paddingMM: 10 })
  if (!g118.anchors.some(a => a.dia === 8) || !g118.anchors.some(a => a.dia === 6)) flag('focal: 118 not mixed 8+6')
  const g214 = computeGrid(stdShapeContour('square', 214), { pitchMM: 48, paddingMM: 10 })
  const n8 = (g: ReturnType<typeof computeGrid>) => g.anchors.filter(a => a.dia === 8).length
  if (n8(g214) <= n8(g118)) flag('focal: ramp did not widen at 214')
  const gd = computeGrid(stdShapeContour('diamondShape', 176), { pitchMM: 48, paddingMM: 10, pattern: 'diamond' })
  if (gd.anchors.length >= 3 && !gd.anchors.some(a => a.dia === 8)) flag('focal: rotated diamond got no 8mm')
}
// canon: the square's exact zero-points
const sqLad = semanticLadder((s) => stdShapeContour('square', s), DEFAULT_LAW, 'auto').map(r => r.sizeMM)
for (const c of [22, 70, 118, 166, 214, 262, 310]) if (!sqLad.includes(c)) flag(`square canon missing ${c} (got ${sqLad.join(',')})`)
// scalar laws
if (maxDesignMM('std') !== 310 || maxDesignMM('preset') !== 310) flag('std/preset cap != 310')
if (maxDesignMM('gen') !== 180 || maxDesignMM('magic') !== 180) flag('random cap != 180')
if (minEffectMM() !== 22) flag('ONE floor != 22')
if (rectFormat(214, 70) !== 'strip' || rectFormat(214, 118) !== 'panoramic' || rectFormat(166, 118) !== 'block') flag('rectFormat broken')
if (legalPatterns(48).includes('quincunx')) flag('dice legal at 48')

console.log(V === 0 ? '✓ GRID AUDIT: ALL LAWS PASS (8 shapes × 4 modes × sizes + ladders + canon + scalar laws)' : `✗ ${V} VIOLATIONS`)
process.exit(V === 0 ? 0 : 1)
