// COMPUTE ALONE. No logic, no permission table, no limit. Geometry + spec numbers in, raw numbers out.
import { computeContinuousFeasibleSet } from '../src/lib/grid-engine/compute/continuous-feasibility'
import { buildComponentHierarchy, coverageEvidence, upperHangingMassEvidence, balanceEvidence } from '../src/lib/grid-engine/compute/structure'
import type { Contour, Pt } from '../src/lib/grid-engine/compute/types'

const sq = (s: number): Contour => ({ outer: { pts: [[0,0],[s,0],[s,s],[0,s]] as Pt[] }, holes: [] })
const PAD = 12, PITCH = 48

const box = (c: Contour) => { const xs=c.outer.pts.map(p=>p[0]), ys=c.outer.pts.map(p=>p[1])
  return { minX:Math.min(...xs), minY:Math.min(...ys), maxX:Math.max(...xs), maxY:Math.max(...ys) } }

function probe(label: string, contour: Contour, offsets: Pt[]) {
  const b = box(contour)
  const domain: Contour = { outer:{pts:[[b.minX,b.minY],[b.maxX,b.minY],[b.maxX,b.maxY],[b.minX,b.maxY]] as Pt[]}, holes:[] }
  const f = computeContinuousFeasibleSet({ contour, permittedDomain: domain, effectiveRadiusMM: PAD, offsetsMM: offsets })
  console.log(`\n── ${label} · ${offsets.length} magnet(s) at ${PITCH}mm ──`)
  console.log(`   status            ${f.status}`)
  console.log(`   lawful regions    ${f.components.length}`)
  for (const comp of f.components) {
    const xs=comp.map(p=>p[0]), ys=comp.map(p=>p[1])
    console.log(`     region span     x ${Math.min(...xs).toFixed(3)}..${Math.max(...xs).toFixed(3)}   y ${Math.min(...ys).toFixed(3)}..${Math.max(...ys).toFixed(3)}`)
  }
  console.log(`   exact witnesses   ${f.exactWitnessesMM.length}`)
  console.log(`   omission bound    ${f.envelope.omissionBoundMM}mm  (positions with less margin than this may be missed)`)
  return f
}

console.log('=== COMPUTE ALONE — padding 12mm, pitch 48mm ===')
// B1: one magnet in a 24 square, and in a 72 square
probe('square 24mm', sq(24), [[0,0]])
probe('square 72mm', sq(72), [[0,0]])
// B2: the 2x2, in the 72 square — arithmetic says exactly one lawful position at (12,12)
probe('square 72mm', sq(72), [[0,0],[48,0],[0,48],[48,48]])
// B2 vertical pair in a 24x72 tall rectangle
probe('tall 24x72', { outer:{pts:[[0,0],[24,0],[24,72],[0,72]] as Pt[]}, holes:[] }, [[0,0],[0,48]])
// B3: 3x3 in a 120 square
probe('square 120mm', sq(120), [[0,0],[48,0],[96,0],[0,48],[48,48],[96,48],[0,96],[48,96],[96,96]])

// structural + descriptors on the 72 square
const c = sq(72)
const h = buildComponentHierarchy(c, [12,24])
console.log(`\n── structural hierarchy · square 72mm · levels [12,24] ──`)
h.levels.forEach((L,i)=>console.log(`   level ${i} (${L.clearanceLevelMM}mm)  status ${L.status}  regions ${L.nodes.length}  witnesses ${L.witnessesMM.length}`))
