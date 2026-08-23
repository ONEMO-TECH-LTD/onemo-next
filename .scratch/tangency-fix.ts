// PROTOTYPE ONLY — engine untouched. Does an exact-witness pass recover the tangent cases?
import { Clipper, EndType, FillRule, JoinType, type Path64 } from '@countertype/clipper2-ts'
import { prepareExactContour, pointInPreparedContour, distanceToPreparedContour } from '../src/lib/grid-engine/compute/grid-prepared'
import type { Contour, Pt } from '../src/lib/grid-engine/compute/types'
const S = 1000
const toPath=(r:ReadonlyArray<Pt>):Path64=>{const f:number[]=[];for(const[x,y]of r)f.push(Math.round(x*S),Math.round(y*S));return Clipper.makePath(f)}
const inset=(p:Path64,d:number)=>Clipper.inflatePaths([p],d*S,JoinType.Round,EndType.Polygon,2,0.005*S)

/** The exact predicate the engine already has — no guard, no epsilon beyond float noise. */
function legal(t:Pt, offsets:Pt[], r:number, prep:ReturnType<typeof prepareExactContour>):boolean{
  return offsets.every(([dx,dy])=>{
    const c:Pt=[t[0]+dx,t[1]+dy]
    return pointInPreparedContour(c,prep) && distanceToPreparedContour(c,prep)+Number.EPSILON>=r
  })
}

/** ZERO-GUARD intersection → its vertices are the critical points → exact-prove each. */
function exactWitnesses(contour:Contour, offsets:Pt[], r:number):Pt[]{
  const prep=prepareExactContour(contour)
  const safe=inset(toPath(contour.outer.pts), -r)          // NO conservative guard
  if(!safe.length) return []
  let f=safe
  for(const[dx,dy]of offsets){
    if(!f.length)break
    f=Clipper.intersect(f,Clipper.translatePaths(safe,-Math.round(dx*S),-Math.round(dy*S)),FillRule.NonZero)
  }
  const cands:Pt[]=[]
  for(const path of f) for(const {x,y} of path) cands.push([x/S,y/S])
  // dedupe on the micron lattice, then exact-prove
  const seen=new Set<string>(); const out:Pt[]=[]
  for(const c of cands){ const k=`${Math.round(c[0]*S)},${Math.round(c[1]*S)}`
    if(seen.has(k))continue; seen.add(k); if(legal(c,offsets,r,prep)) out.push(c) }
  return out
}

const sq=(s:number):Contour=>({outer:{pts:[[0,0],[s,0],[s,s],[0,s]] as Pt[]},holes:[]})
const cases:Array<[string,Contour,Pt[]]>=[
  ['24mm square · 1 magnet',            sq(24),  [[0,0]]],
  ['72mm square · 2x2 four',            sq(72),  [[0,0],[48,0],[0,48],[48,48]]],
  ['24x72 tall · vertical pair',        {outer:{pts:[[0,0],[24,0],[24,72],[0,72]] as Pt[]},holes:[]}, [[0,0],[0,48]]],
  ['72x24 wide · horizontal pair',      {outer:{pts:[[0,0],[72,0],[72,24],[0,24]] as Pt[]},holes:[]}, [[0,0],[48,0]]],
  ['120mm square · 3x3 nine',           sq(120), [[0,0],[48,0],[96,0],[0,48],[48,48],[96,48],[0,96],[48,96],[96,96]]],
  ['168mm square · 4x4 sixteen',        sq(168), [0,48,96,144].flatMap(x=>[0,48,96,144].map(y=>[x,y] as Pt))],
]
console.log('EXACT-WITNESS PASS (no guard, every candidate exactly re-proved)\n')
for(const [label,c,offs] of cases){
  const w=exactWitnesses(c,offs,12)
  console.log(`  ${label.padEnd(34)} lawful positions found: ${String(w.length).padStart(2)}   ${w.length?`e.g. (${w[0][0].toFixed(3)}, ${w[0][1].toFixed(3)})`:'— NONE'}`)
}
