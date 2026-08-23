import { solveCutout } from '../src/lib/grid-engine/bridge'
import { RELEASED, RELEASED_CALIBRATION, type CalibrationSpec } from '../src/lib/grid-engine/spec'
import type { Contour, Pt } from '../src/lib/grid-engine/compute/types'
const rect = (w:number,h:number): Contour => ({ outer:{pts:[[0,0],[w,0],[w,h],[0,h]] as Pt[]}, holes:[] })
const CERT = { peelToleranceMM3: 50, peelMaxEvaluations: 20000 }
const narrow = (band:number,min:number,max:number,over: Partial<CalibrationSpec> = {}): CalibrationSpec =>
  ({ ...RELEASED_CALIBRATION, sizeStepMM:12, bands:[{band,minSizeMM:min,maxSizeMM:max,released:true}], ...over })
for (const [band,min,max] of [[2,84,108],[3,120,168],[4,168,216]] as const) {
  const j = solveCutout(RELEASED, narrow(band,min,max,CERT), rect(100,100))
  const b = j?.bands[0]
  console.log(`band ${band} ${min}-${max}: offers=${b?.variants.length ?? 0} state=${b?.decisionState}`)
  for (const v of (b?.variants ?? []).slice(0,2)) {
    const s: any = v.selection
    console.log(`   ${s.identity.patternVariant}@${s.identity.sizeMM} classes=${JSON.stringify(s.nodes.map((n:any)=>`${n.structuralClass}@${n.edgeClearanceMM.toFixed(2)}`))}`)
  }
  if (!b?.variants.length) console.log(`   refusals=${JSON.stringify([...new Set((b?.rejections??[]).flatMap(r=>r.reasons))])}`)
}
