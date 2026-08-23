import { readFileSync } from 'node:fs'
import { solveCutout } from '../src/lib/grid-engine/bridge'
import { RELEASED, RELEASED_CALIBRATION } from '../src/lib/grid-engine/spec'
import { engineOutline, type OutlineUV } from '../src/lib/grid-engine/ui/trace-cutout'
import { buildComponentHierarchy, coverageEvidence } from '../src/lib/grid-engine/compute/structure'
import { computeContinuousFeasibleSet } from '../src/lib/grid-engine/compute/continuous-feasibility'
import type { Contour, Pt } from '../src/lib/grid-engine/compute/types'
type F = { outline: OutlineUV; box: { w: number; h: number } }
const canon = JSON.parse(readFileSync('src/lib/grid-engine/__tests__/__fixtures-canon-shapes.json','utf8')) as Record<string,F>
const f = canon['pill']
const unit: Contour = { outer:{ pts: engineOutline(f.outline).map(([u,v]) => [u*f.box.w, v*f.box.h] as Pt) }, holes:[] }
const j = solveCutout(RELEASED, RELEASED_CALIBRATION, unit)!
const s: any = j.bands.find(b=>b.band.band===2)!.variants[0].selection
const scale = s.identity.sizeMM / Math.max(...unit.outer.pts.map(p=>p[0])) // rough
console.log('size', s.identity.sizeMM, 'origin', s.registrationOffsetMM, 'anchors', JSON.stringify(s.magnetCentresMM))
// rebuild the scaled contour exactly as judgeBand does: longest side -> sizeMM
const w = Math.max(...unit.outer.pts.map(p=>p[0])) - Math.min(...unit.outer.pts.map(p=>p[0]))
const h = Math.max(...unit.outer.pts.map(p=>p[1])) - Math.min(...unit.outer.pts.map(p=>p[1]))
const k = s.identity.sizeMM / Math.max(w,h)
const contour: Contour = { outer:{ pts: unit.outer.pts.map(([x,y])=>[x*k,y*k] as Pt) }, holes:[] }
const hier = buildComponentHierarchy(contour, RELEASED_CALIBRATION.nodeClassification.clearanceLevelsMM)
const major: Contour[] = (hier.levels[0]?.nodes ?? []).map(n => ({ outer:{pts:n.ringMM.map(([x,y])=>[x,y] as Pt)}, holes:[] }))
console.log('major regions:', major.length, 'bbox:', major.map(m=>{
  const xs=m.outer.pts.map(p=>p[0]), ys=m.outer.pts.map(p=>p[1])
  return `[${Math.min(...xs).toFixed(2)},${Math.min(...ys).toFixed(2)}]..[${Math.max(...xs).toFixed(2)},${Math.max(...ys).toFixed(2)}]`
}).join(' '))
const offsets: Pt[] = s.nodeAddresses.map((n:any)=>[n.across*RELEASED.grid.basePitchMM, n.down*RELEASED.grid.basePitchMM] as Pt)
console.log('offsets', JSON.stringify(offsets))
const env = { status:'PROVED_FEASIBLE' as const, components: [] as Pt[][], exactWitnessesMM: [s.registrationOffsetMM as Pt],
  envelope: (computeContinuousFeasibleSet({contour, permittedDomain: contour, effectiveRadiusMM: 12, offsetsMM: offsets })).envelope }
const at = coverageEvidence({ contour, offsetsMM: offsets, effectiveRadiusMM: 12, feasible: env }, major)
console.log('coverage AT ORIGIN:', at.lo, at.hi, at.status)
for (const [i,m] of major.entries()) {
  const xs=m.outer.pts.map(p=>p[0]), ys=m.outer.pts.map(p=>p[1])
  for (const a of s.magnetCentresMM as Pt[])
    console.log(`  anchor ${JSON.stringify(a)} vs region${i} bbox x[${Math.min(...xs).toFixed(2)},${Math.max(...xs).toFixed(2)}] y[${Math.min(...ys).toFixed(2)},${Math.max(...ys).toFixed(2)}] -> inBbox=${a[0]>=Math.min(...xs)&&a[0]<=Math.max(...xs)&&a[1]>=Math.min(...ys)&&a[1]<=Math.max(...ys)}`)
}
