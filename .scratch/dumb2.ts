import { solveCutout } from '../src/lib/grid-engine/bridge'
import { RELEASED, RELEASED_CALIBRATION } from '../src/lib/grid-engine/spec'
import type { Contour, Pt } from '../src/lib/grid-engine/compute/types'
const dumbbell = (): Contour => ({ outer: { pts: [
  [0,0],[40,0],[40,35],[60,35],[60,0],[100,0],[100,100],[60,100],[60,65],[40,65],[40,100],[0,100],
] as Pt[] }, holes: [] })
const b2 = solveCutout(RELEASED, RELEASED_CALIBRATION, dumbbell())!.bands.find(b=>b.band.band===2)!
console.log(`B2 state=${b2.decisionState} offers=${b2.variants.length}`)
for (const v of b2.variants) {
  const s: any = v.selection
  console.log(`  ${s.identity.patternVariant}@${s.identity.sizeMM} anchors=${s.magnetCentresMM.length} proof=${s.proofStatus}`)
  console.log(`    xs=${s.magnetCentresMM.map((p:Pt)=>p[0].toFixed(1)).join(',')}  ys=${s.magnetCentresMM.map((p:Pt)=>p[1].toFixed(1)).join(',')}`)
  const rel = s.decisionReasons.filter((r:string)=>/beats|defeated|co-optimum|unresolved/.test(r))
  console.log(`    ${rel.join(' | ').slice(0,260)}`)
}
