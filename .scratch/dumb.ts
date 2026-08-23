import { solveCutout } from '../src/lib/grid-engine/bridge'
import { RELEASED, RELEASED_CALIBRATION } from '../src/lib/grid-engine/spec'
import type { Contour, Pt } from '../src/lib/grid-engine/compute/types'
const dumbbell = (): Contour => ({ outer: { pts: [
  [0,20],[30,20],[30,35],[70,35],[70,20],[100,20],[100,80],[70,80],[70,65],[30,65],[30,80],[0,80],
] as Pt[] }, holes: [] })
const j = solveCutout(RELEASED, RELEASED_CALIBRATION, dumbbell())!
const b2 = j.bands.find(b=>b.band.band===2)!
console.log(`B2 state=${b2.decisionState} offers=${b2.variants.length}`)
for (const v of b2.variants) {
  const s: any = v.selection
  console.log(`  ${s.identity.patternVariant}@${s.identity.sizeMM} anchors=${s.magnetCentresMM.length} proof=${s.proofStatus}`)
  console.log(`    x=${s.magnetCentresMM.map((p:Pt)=>p[0].toFixed(1)).join(',')}`)
  const rel = s.decisionReasons.filter((r:string)=>r.includes('beats')||r.includes('defeated')||r.includes('co-optimum'))
  console.log(`    ${rel.join(' | ').slice(0,200)}`)
}
