import { prepareExactContour, pointInPreparedContour, distanceToPreparedContour } from '../src/lib/grid-engine/compute/grid-prepared'
import { Clipper, EndType, JoinType } from '@countertype/clipper2-ts'
import type { Contour, Pt } from '../src/lib/grid-engine/compute/types'
const sq=(s:number):Contour=>({outer:{pts:[[0,0],[s,0],[s,s],[0,s]] as Pt[]},holes:[]})

console.log('=== 1. Does the EXACT predicate accept a tangent disc? ===')
for (const [label,c,pt] of [
  ['24mm square, centre (12,12)',  sq(24),  [12,12] as Pt],
  ['72mm square, corner (12,12)',  sq(72),  [12,12] as Pt],
  ['72mm square, corner (60,60)',  sq(72),  [60,60] as Pt],
  ['72mm square, centre (36,36)',  sq(72),  [36,36] as Pt],
] as Array<[string,Contour,Pt]>) {
  const p=prepareExactContour(c)
  const inside=pointInPreparedContour(pt,p), d=distanceToPreparedContour(pt,p)
  console.log(`  ${label.padEnd(30)} inside=${String(inside).padEnd(5)} distance=${d.toFixed(9)}  legal(r=12)=${inside && d+Number.EPSILON>=12}`)
}

console.log('\n=== 2. What does Clipper give when the erosion is degenerate? ===')
const S=1000
const toPath=(r:ReadonlyArray<Pt>)=>{const f:number[]=[];for(const[x,y]of r)f.push(Math.round(x*S),Math.round(y*S));return Clipper.makePath(f)}
for (const s of [24, 24.1, 48, 72]) {
  const paths=Clipper.inflatePaths([toPath(sq(s).outer.pts)], -12*S, JoinType.Round, EndType.Polygon, 2, 5)
  const areas=paths.map(p=>Math.abs(Clipper.area(p))/(S*S))
  console.log(`  ${s}mm square eroded by 12mm -> ${paths.length} path(s), area(s) ${areas.map(a=>a.toFixed(4)).join(', ')||'—'}`)
}
