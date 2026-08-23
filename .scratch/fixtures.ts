import { solveCutout } from '../src/lib/grid-engine/bridge'
import { RELEASED, RELEASED_CALIBRATION, type CalibrationSpec } from '../src/lib/grid-engine/spec'
import { balanceEvidence } from '../src/lib/grid-engine/compute/structure'
import { computeContinuousFeasibleSet } from '../src/lib/grid-engine/compute/continuous-feasibility'
import type { Contour, Pt } from '../src/lib/grid-engine/compute/types'

const ring = (pts: Array<[number,number]>): Contour => ({ outer:{pts: pts as Pt[]}, holes:[] })
const boundsOf = (c: Contour): Contour => {
  let a=Infinity,b=Infinity,x=-Infinity,y=-Infinity
  for (const [px,py] of c.outer.pts){ if(px<a)a=px; if(px>x)x=px; if(py<b)b=py; if(py>y)y=py }
  return ring([[a,b],[x,b],[x,y],[a,y]])
}
const scale = (c: Contour, k: number): Contour =>
  ({ outer:{ pts: c.outer.pts.map(([px,py]) => [px*k, py*k] as Pt) }, holes:[] })

const FIXTURES: Array<[string, Contour]> = [
  ['A top-step',    ring([[10,0],[90,0],[90,30],[100,30],[100,100],[0,100],[0,30],[10,30]])],
  ['B right-heavy', ring([[0,0],[75,0],[75,30],[100,30],[100,100],[0,100]])],
  ['C left-heavy',  ring([[100,0],[25,0],[25,30],[0,30],[0,100],[100,100]])],
]
const cal: CalibrationSpec = { ...RELEASED_CALIBRATION, sizeStepMM:12,
  bands:[{band:2,minSizeMM:84,maxSizeMM:96,released:true}],
  peelToleranceMM3: 50, peelMaxEvaluations: 20000 }

for (const [name, source] of FIXTURES) {
  const j = solveCutout(RELEASED, cal, source)
  console.log(`\n===== ${name} =====`)
  if (!j) { console.log('  solveCutout -> null'); continue }
  const b = j.bands[0]
  const full = b.variants.map(v => v.selection as any).filter(s => s.selectionTrace.stoppedAt === null)
  console.log(`  variants=${b.variants.length}  fullChain=${full.length}  decisionState=${b.decisionState}`)
  for (const s of full) {
    const contour = scale(source, s.identity.sizeMM / 100)
    const offsetsMM: Pt[] = s.nodeAddresses.map((n:any) =>
      [n.across*RELEASED.grid.basePitchMM, n.down*RELEASED.grid.basePitchMM] as Pt)
    const F = computeContinuousFeasibleSet({ contour, permittedDomain: boundsOf(contour),
      effectiveRadiusMM: RELEASED.grid.paddingMM, offsetsMM })
    const unrestricted = balanceEvidence({ contour, offsetsMM,
      effectiveRadiusMM: RELEASED.grid.paddingMM, feasible: F })
    const chainLo = s.selectionTrace.chain.balance?.lo
    console.log(`   - ${s.identity.patternVariant} size=${s.identity.sizeMM}: unrestricted.hi=${unrestricted.hi} chain.balance.lo=${chainLo} STRICT=${unrestricted.hi < chainLo}`)
  }
  if (!full.length) console.log('   (no full-chain variant)')
}
