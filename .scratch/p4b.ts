import { solveCutout } from '../src/lib/grid-engine/bridge'
import { RELEASED, RELEASED_CALIBRATION, type CalibrationSpec } from '../src/lib/grid-engine/spec'
import type { Contour, Pt } from '../src/lib/grid-engine/compute/types'
const ring = (pts: Array<[number,number]>): Contour => ({ outer:{pts: pts as Pt[]}, holes:[] })
const rect = (w:number,h:number): Contour => ring([[0,0],[w,0],[w,h],[0,h]])
const CERT = { peelToleranceMM3: 50, peelMaxEvaluations: 20000 }
const narrow = (band:number,min:number,max:number,over: Partial<CalibrationSpec> = {}): CalibrationSpec =>
  ({ ...RELEASED_CALIBRATION, sizeStepMM:12, bands:[{band,minSizeMM:min,maxSizeMM:max,released:true}], ...over })
// A solid body with ONE narrow terminal limb: 100x100 body, a 10mm-wide tab reaching 30mm past the top.
const bodyWithLimb = ring([[0,0],[100,0],[100,100],[55,100],[55,130],[45,130],[45,100],[0,100]])
const CASES: Array<[string, Contour, CalibrationSpec]> = [
  ['square 100x100 b2 84-108 CERT', rect(100,100), narrow(2,84,108,CERT)],
  ['square 100x100 b2 96-108 CERT', rect(100,100), narrow(2,96,108,CERT)],
  ['square 100x100 b2 84-108 RELEASED', rect(100,100), narrow(2,84,108)],
  ['body+limb b2 84-108 CERT', bodyWithLimb, narrow(2,84,108,CERT)],
  ['body+limb b2 84-108 RELEASED', bodyWithLimb, narrow(2,84,108)],
]
for (const [name, contour, cal] of CASES) {
  const j = solveCutout(RELEASED, cal, contour)
  console.log(`\n=== ${name} ===`)
  if (!j) { console.log('  null'); continue }
  const b = j.bands[0]
  console.log(`  variants=${b.variants.length} state=${b.decisionState} codes=${JSON.stringify([...new Set(b.rejections.flatMap(r=>r.reasons))])}`)
  for (const v of b.variants.slice(0,3)) {
    const s: any = v.selection
    const p = s.unsupportedExtentPolicy
    console.log(`   - ${s.identity.patternVariant}@${s.identity.sizeMM} ${p.outcome} L=${p.perSideMM.left.toFixed(3)} R=${p.perSideMM.right.toFixed(3)} T=${p.perSideMM.top.toFixed(3)} B=${p.perSideMM.bottom.toFixed(3)} exempt=${JSON.stringify(p.exemptedSides)}`)
  }
}
