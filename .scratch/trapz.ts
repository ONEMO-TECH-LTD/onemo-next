import { solveCutout } from '../src/lib/grid-engine/bridge'
import { RELEASED, RELEASED_CALIBRATION, type CalibrationSpec } from '../src/lib/grid-engine/spec'
import { balanceEvidence } from '../src/lib/grid-engine/compute/structure'
import { computeContinuousFeasibleSet } from '../src/lib/grid-engine/compute/continuous-feasibility'
import type { Contour, Pt } from '../src/lib/grid-engine/compute/types'

const ring = (pts: Array<[number,number]>): Contour => ({ outer:{pts: pts as Pt[]}, holes:[] })
const trapezoid = (w:number,h:number): Contour => ring([[w*0.1,0],[w*0.9,0],[w,h],[0,h]])
const boundsOf = (c: Contour): Contour => {
  let a=Infinity,b=Infinity,x=-Infinity,y=-Infinity
  for (const [px,py] of c.outer.pts){ if(px<a)a=px; if(px>x)x=px; if(py<b)b=py; if(py>y)y=py }
  return ring([[a,b],[x,b],[x,y],[a,y]])
}
const scaled = (sizeMM:number): Contour => {
  const s = trapezoid(100,100); const k = sizeMM/100
  return { outer:{ pts: s.outer.pts.map(([px,py]) => [px*k, py*k] as Pt) }, holes:[] }
}

for (const tol of [50, 500, 5000]) {
  const cal: CalibrationSpec = { ...RELEASED_CALIBRATION, sizeStepMM:12,
    bands:[{band:2,minSizeMM:84,maxSizeMM:96,released:true}],
    peelToleranceMM3: tol, peelMaxEvaluations: 20000 }
  const j = solveCutout(RELEASED, cal, trapezoid(100,100))
  console.log(`\n===== peelToleranceMM3=${tol} =====`)
  if (!j) { console.log('  solveCutout -> null'); continue }
  const b = j.bands[0]
  console.log(`  variants=${b.variants.length}  decisionState=${b.decisionState}`)
  let firstFull: any = null
  for (const v of b.variants) {
    const s: any = v.selection
    const p5 = s.selectionTrace.chain.peelLeverage
    console.log(`   - ${s.identity.patternVariant}  stoppedAt=${JSON.stringify(s.selectionTrace.stoppedAt)}  chain.balance=${s.selectionTrace.chain.balance ? 'present' : 'ABSENT'}`)
    console.log(`     P5: ${p5 ? p5.status : '<absent>'}${p5 && p5.status === 'DECISION_INDETERMINATE' ? ' :: ' + p5.completenessProof : ''}`)
    if (!firstFull && s.selectionTrace.stoppedAt === null && s.selectionTrace.chain.balance) firstFull = s
  }
  if (firstFull) {
    const contour = scaled(firstFull.identity.sizeMM)
    const offsetsMM: Pt[] = firstFull.nodeAddresses.map((n:any) =>
      [n.across*RELEASED.grid.basePitchMM, n.down*RELEASED.grid.basePitchMM] as Pt)
    const full = computeContinuousFeasibleSet({ contour, permittedDomain: boundsOf(contour),
      effectiveRadiusMM: RELEASED.grid.paddingMM, offsetsMM })
    const unrestricted = balanceEvidence({ contour, offsetsMM,
      effectiveRadiusMM: RELEASED.grid.paddingMM, feasible: full })
    console.log(`  FULL-CHAIN ${firstFull.identity.patternVariant} size=${firstFull.identity.sizeMM}`)
    console.log(`    unrestricted balance hi = ${unrestricted.hi}   (status ${unrestricted.status})`)
    console.log(`    chain balance lo        = ${firstFull.selectionTrace.chain.balance.lo}`)
    console.log(`    STRICT CONFLICT (unrestricted.hi < chain.lo) = ${unrestricted.hi < firstFull.selectionTrace.chain.balance.lo}`)
  } else {
    console.log('  no full-chain variant at this tolerance')
  }
}
