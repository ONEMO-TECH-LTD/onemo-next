import { computeContinuousFeasibleSet } from '../src/lib/grid-engine/compute/continuous-feasibility'
import type { Contour, Pt } from '../src/lib/grid-engine/compute/types'
const sq=(s:number):Contour=>({outer:{pts:[[0,0],[s,0],[s,s],[0,s]] as Pt[]},holes:[]})
const PAD=12
const box=(c:Contour)=>{const xs=c.outer.pts.map(p=>p[0]),ys=c.outer.pts.map(p=>p[1]);return{minX:Math.min(...xs),minY:Math.min(...ys),maxX:Math.max(...xs),maxY:Math.max(...ys)}}
function run(label:string,c:Contour,offsets:Pt[],witness?:Pt){
  const b=box(c)
  const domain:Contour={outer:{pts:[[b.minX,b.minY],[b.maxX,b.minY],[b.maxX,b.maxY],[b.minX,b.maxY]] as Pt[]},holes:[]}
  const f=computeContinuousFeasibleSet({contour:c,permittedDomain:domain,effectiveRadiusMM:PAD,offsetsMM:offsets,
    exactWitnessesMM: witness?[witness]:undefined})
  console.log(`${label.padEnd(46)} ${f.status.padEnd(30)} regions ${f.components.length}  witnesses ${f.exactWitnessesMM.length}`)
}
const four:Pt[]=[[0,0],[48,0],[0,48],[48,48]]
console.log('=== the exact-fit case: 72mm square, 2x2 at 48mm pitch ===')
console.log('    true answer: safe core is [12,60]^2, so F is the single point (12,12)\n')
run('72.0 square, no witness supplied', sq(72), four)
run('72.0 square, canonical witness (12,12)', sq(72), four, [12,12])
console.log('\n=== how much slack does it need before area appears? ===')
for (const s of [72, 72.01, 72.05, 72.1, 72.5, 73, 74]) run(`${s}mm square, no witness`, sq(s), four)
console.log('\n=== and with the canonical witness, as logic actually calls it ===')
for (const s of [72, 72.05, 73]) run(`${s}mm square + witness`, sq(s), four, [12,12])
