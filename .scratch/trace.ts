import { solveCutout } from '../src/lib/grid-engine/bridge'
import { RELEASED, RELEASED_CALIBRATION, type CalibrationSpec } from '../src/lib/grid-engine/spec'
import type { Contour, Pt } from '../src/lib/grid-engine/compute/types'
const ring = (pts: Array<[number,number]>): Contour => ({ outer:{pts: pts as Pt[]}, holes:[] })
const rect = (w:number,h:number): Contour => ring([[0,0],[w,0],[w,h],[0,h]])
const narrow = (band:number,min:number,max:number): CalibrationSpec =>
  ({ ...RELEASED_CALIBRATION, sizeStepMM:12, bands:[{band,minSizeMM:min,maxSizeMM:max,released:true}] })
const ORDER = ['coverage','upperHangingMass','unsupportedExtent','peelLeverage','distribution','distributionVariance','balance'] as const

const judged = solveCutout(RELEASED, narrow(2,84,108), rect(100,100))
if (!judged) { console.log('solveCutout -> null') } else {
  const band = judged.bands[0]
  console.log(`decisionState=${band.decisionState}  variants=${band.variants.length}`)
  for (const variant of band.variants) {
    const s: any = variant.selection
    console.log(`\n--- ${s.identity.patternVariant}  proofStatus=${s.proofStatus}`)
    console.log(`    stoppedAt=${JSON.stringify(s.selectionTrace.stoppedAt)}`)
    for (const key of ORDER) {
      const e = s.selectionTrace.chain[key]
      if (!e) { console.log(`    ${key}: <absent — chain never reached it>`); continue }
      console.log(`    ${key}: ${e.status} lo=${e.lo} hi=${e.hi}`)
      console.log(`        proof: ${e.completenessProof}`)
    }
  }
}
