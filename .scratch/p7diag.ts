import { readFileSync } from 'node:fs'
import { solveCutout } from '../src/lib/grid-engine/bridge'
import { RELEASED, RELEASED_CALIBRATION } from '../src/lib/grid-engine/spec'
import { engineOutline, type OutlineUV } from '../src/lib/grid-engine/ui/trace-cutout'
import type { Contour, Pt } from '../src/lib/grid-engine/compute/types'
import { normalizeContour } from '../src/lib/grid-engine/compute/normalize'
import { scaleContour } from '../src/lib/grid-engine/compute/grid-core'
import { buildComponentHierarchy } from '../src/lib/grid-engine/compute/structure'
import { distanceToPreparedContour, pointInPreparedContour, prepareExactContour } from '../src/lib/grid-engine/compute/grid-prepared'
import { Clipper, PointInPolygonResult } from '@countertype/clipper2-ts'
const ORDER = ['coverage','upperHangingMass','unsupportedExtent','peelLeverage','distribution','distributionVariance','balance'] as const
type F = { outline: OutlineUV; box: { w: number; h: number } }
const canon = JSON.parse(readFileSync('src/lib/grid-engine/__tests__/__fixtures-canon-shapes.json','utf8')) as Record<string,F>
for (const name of ['pill','bat']) {
  const f = canon[name]
  const contour: Contour = { outer:{ pts: engineOutline(f.outline).map(([u,v]) => [u*f.box.w, v*f.box.h] as Pt) }, holes:[] }
  const j = solveCutout(RELEASED, RELEASED_CALIBRATION, contour)!
  const b2 = j.bands.find(b => b.band.band === 2)!
  console.log(`\n=== ${name} B2 · state=${b2.decisionState} offers=${b2.variants.length}`)
  for (const v of b2.variants) {
    const s: any = v.selection
    console.log(`  ${s.identity.patternVariant}@${s.identity.sizeMM} proof=${s.proofStatus} feasibility=${s.feasibility} hierarchyCertain=${s.hierarchyCertain} stoppedAt=${JSON.stringify(s.selectionTrace.stoppedAt)}`)
    console.log(`    re-measured indeterminate: ${JSON.stringify(ORDER.filter(k => s[k].status === 'DECISION_INDETERMINATE'))}`)
    console.log(`    node classes: ${JSON.stringify(s.nodes.map((n:any)=>`${n.structuralClass}@${n.edgeClearanceMM.toFixed(2)}`))}`)
    console.log(`    distinctMassCount=${s.distinctMassCount} supportedRegionCount=${s.supportedRegionCount}`)
    console.log(`    level statuses: ${JSON.stringify(s.structuralEvidence.levels.map((l:any)=>`${l.clearanceLevelMM}:${l.status}${l.collapsed?'/collapsed':''}`))}`)
    const viol = s.decisionReasons.filter((r:string)=>r.includes('bracket violation'))
    console.log(`    bracketViolations: ${viol.length ? JSON.stringify(viol) : 'none'}`)
    console.log(`    registration: ${JSON.stringify(s.registrationOffsetMM)}`)
    for (const key of ['coverage','balance'] as const) {
      const chain = s.selectionTrace.chain[key]
      const emitted = s[key]
      console.log(`    ${key}: chain=${JSON.stringify(chain && {lo:chain.lo,hi:chain.hi,regions:chain.argopt?.regions.length,points:chain.argopt?.points})} emitted=${JSON.stringify({lo:emitted.lo,hi:emitted.hi})}`)
      if (chain?.argopt?.regions?.length) console.log(`      first-region=${JSON.stringify(chain.argopt.regions[0])}`)
      if (chain?.argopt?.regions?.length) {
        const cp = Clipper.makePath(chain.argopt.regions[0].flatMap(([x,y]:Pt)=>[Math.round(x*1000),Math.round(y*1000)]))
        console.log(`      registration-in-first-region=${Clipper.pointInPolygon({x:Math.round(s.registrationOffsetMM[0]*1000),y:Math.round(s.registrationOffsetMM[1]*1000)},cp)}`)
      }
    }
    const normalized = normalizeContour(contour)!
    const sized = scaleContour(normalized, s.identity.sizeMM)
    const h = buildComponentHierarchy(sized, RELEASED_CALIBRATION.nodeClassification.clearanceLevelsMM)
    for (const [ri, region] of h.levels[0].nodes.entries()) {
      const preparedRegion = prepareExactContour({outer:{pts:region.ringMM},holes:[]})
      const path = Clipper.makePath(region.ringMM.flatMap(([x,y]:Pt)=>[Math.round(x*1000),Math.round(y*1000)]))
      console.log(`    region${ri} anchor checks: ${JSON.stringify(s.magnetCentresMM.map((p:Pt)=>({p,inside:pointInPreparedContour(p,preparedRegion),distance:distanceToPreparedContour(p,preparedRegion),lattice:Clipper.pointInPolygon({x:Math.round(p[0]*1000),y:Math.round(p[1]*1000)},path),outside:PointInPolygonResult.IsOutside})))}`)
      if (name === 'pill') {
        const origin = s.registrationOffsetMM as Pt
        const offs = s.magnetCentresMM.map(([x,y]:Pt)=>[x-origin[0],y-origin[1]] as Pt)
        const good: Pt[] = []
        for (let dx=-3;dx<=3;dx++) for (let dy=-3;dy<=3;dy++) {
          const t:Pt=[origin[0]+dx/1000,origin[1]+dy/1000]
          if (offs.some(([ox,oy]:Pt)=>Clipper.pointInPolygon({x:Math.round((t[0]+ox)*1000),y:Math.round((t[1]+oy)*1000)},path)!==PointInPolygonResult.IsOutside)) good.push(t)
        }
        console.log(`    nearby-covered=${JSON.stringify(good)}`)
      }
    }
  }
}
