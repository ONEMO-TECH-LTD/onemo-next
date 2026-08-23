import { readFileSync } from 'node:fs'
import { solveCutout } from '../src/lib/grid-engine/bridge'
import { RELEASED, RELEASED_CALIBRATION } from '../src/lib/grid-engine/spec'
import { engineOutline, type OutlineUV } from '../src/lib/grid-engine/ui/trace-cutout'
import type { Contour, Pt } from '../src/lib/grid-engine/compute/types'
type F = { outline: OutlineUV; box: { w: number; h: number } }
const canon = JSON.parse(readFileSync('src/lib/grid-engine/__tests__/__fixtures-canon-shapes.json','utf8')) as Record<string,F>
const f = canon['pill']
const contour: Contour = { outer:{ pts: engineOutline(f.outline).map(([u,v]) => [u*f.box.w, v*f.box.h] as Pt) }, holes:[] }
const j = solveCutout(RELEASED, RELEASED_CALIBRATION, contour)!
const s: any = j.bands.find(b=>b.band.band===2)!.variants[0].selection
console.log('registration', s.registrationOffsetMM)
console.log('anchors', JSON.stringify(s.magnetCentresMM))
console.log('node clearances', s.nodes.map((n:any)=>n.edgeClearanceMM.toFixed(4)))
console.log('CHAIN coverage    ', JSON.stringify({lo:s.selectionTrace.chain.coverage.lo, hi:s.selectionTrace.chain.coverage.hi, status:s.selectionTrace.chain.coverage.status}))
console.log('PUBLISHED coverage', JSON.stringify({lo:s.coverage.lo, hi:s.coverage.hi, status:s.coverage.status}))
console.log('published proof:', s.coverage.completenessProof.slice(0,150))
console.log('perComponent published:', JSON.stringify(s.coverage.perComponent.map((c:any)=>({i:c.componentIndex,lo:c.lo,hi:c.hi,resolved:c.resolved}))))
console.log('witnessEvidence published:', JSON.stringify(s.coverage.witnessEvidence))
console.log('supportedRegionCount', s.supportedRegionCount)
console.log('structural regions', JSON.stringify(s.structuralEvidence.regions.map((r:any)=>({id:r.regionId,lvl:r.levelIndex,aLo:r.areaMM2Lo.toFixed(1),aHi:r.areaMM2Hi.toFixed(1)}))))
