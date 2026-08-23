import { solveCutout } from '../src/lib/grid-engine/bridge'
import { RELEASED, RELEASED_CALIBRATION, type CalibrationSpec } from '../src/lib/grid-engine/spec'
import type { Contour, Pt } from '../src/lib/grid-engine/compute/types'
const ring = (pts: Array<[number,number]>): Contour => ({ outer:{pts: pts as Pt[]}, holes:[] })
const rect = (w:number,h:number): Contour => ring([[0,0],[w,0],[w,h],[0,h]])
const CERT = { peelToleranceMM3: 50, peelMaxEvaluations: 20000 }
const narrow = (band:number,min:number,max:number,over: Partial<CalibrationSpec> = {}): CalibrationSpec =>
  ({ ...RELEASED_CALIBRATION, sizeStepMM:12, bands:[{band,minSizeMM:min,maxSizeMM:max,released:true}], ...over })

// Only fixtures ALREADY present in selection-funnel.test.ts.
const CASES: Array<[string, Contour, CalibrationSpec]> = [
  ['rect(100,100) b2 84-108 CERT', rect(100,100), narrow(2,84,108,CERT)],
  ['rect(100,100) b2 96-108 CERT', rect(100,100), narrow(2,96,108,CERT)],
  ['rect(100,100) b2 84-108 RELEASED', rect(100,100), narrow(2,84,108)],
  ['rect(60,190) b4 180-192', rect(60,190), narrow(4,180,192)],
  ['rect(240,240) b5 228-240', rect(240,240), narrow(5,228,240)],
  ['rect(24,84) b2 84-96', rect(24,84), narrow(2,84,96)],
]
for (const [name, contour, cal] of CASES) {
  const j = solveCutout(RELEASED, cal, contour)
  console.log(`\n=== ${name} ===`)
  if (!j) { console.log('  null'); continue }
  const b = j.bands[0]
  const codes = [...new Set(b.rejections.flatMap(r => r.reasons))]
  console.log(`  variants=${b.variants.length} state=${b.decisionState} rejectionCodes=${JSON.stringify(codes)}`)
  for (const v of b.variants) {
    const s: any = v.selection
    const p = s.unsupportedExtentPolicy
    console.log(`   - ${s.identity.patternVariant}@${s.identity.sizeMM} outcome=${p.outcome} limit=${p.activeLimitMM}`)
    console.log(`     perSide L=${p.perSideMM.left.toFixed(3)} R=${p.perSideMM.right.toFixed(3)} T=${p.perSideMM.top.toFixed(3)} B=${p.perSideMM.bottom.toFixed(3)} exempted=${JSON.stringify(p.exemptedSides)}`)
  }
}
