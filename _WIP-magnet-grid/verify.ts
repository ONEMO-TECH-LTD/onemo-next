import { magnetLadder, laddersByPlacement, outlineAt, type Outline, type Pt, type GridLaw } from './magnet-grid'
const LAW: GridLaw = { pitchMM: 48, paddingMM: 10, maxSizeMM: 310, toleranceMM: 0.05 }
const ring = (f: (t: number) => Pt, n: number): Pt[] => Array.from({ length: n }, (_, i) => f((i / n) * Math.PI * 2))
const O = (pts: Pt[], holes: Pt[][] = []): Outline => ({ outer: { pts }, holes: holes.map((h) => ({ pts: h })) })

function inRing(p: Pt, r: ReadonlyArray<Pt>) { let c=false; for(let i=0,j=r.length-1;i<r.length;j=i++){const[xi,yi]=r[i],[xj,yj]=r[j]; if((yi>p[1])!==(yj>p[1])&&p[0]<((xj-xi)*(p[1]-yi))/(yj-yi)+xi)c=!c} return c }
function distRing(p: Pt, r: ReadonlyArray<Pt>) { let b=Infinity; for(let i=0,j=r.length-1;i<r.length;j=i++){const[ax,ay]=r[j],[bx,by]=r[i];const dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy;const t=l2===0?0:Math.max(0,Math.min(1,((p[0]-ax)*dx+(p[1]-ay)*dy)/l2));const d=Math.hypot(p[0]-(ax+t*dx),p[1]-(ay+t*dy));if(d<b)b=d} return b }
function room(p: Pt, o: Outline) { if(!inRing(p,o.outer.pts)) return -distRing(p,o.outer.pts); let r=distRing(p,o.outer.pts); for(const h of o.holes){ if(inRing(p,h.pts)) return -distRing(p,h.pts); r=Math.min(r,distRing(p,h.pts)) } return r }

console.log('=== FINDING 1: does any published magnet sit closer than 10mm? ===')
const shapes: Record<string, Outline> = {
  donut: O(ring((t)=>[Math.cos(t),Math.sin(t)],200), [ring((t)=>[0.42*Math.cos(-t),0.42*Math.sin(-t)],120)]),
  square: O([[0,0],[1,0],[1,1],[0,1]]),
  triangle: O([[0,0],[1,0],[0.5,Math.sqrt(3)/2]]),
}
let worst = Infinity, worstWhere = ''
for (const [name, s] of Object.entries(shapes)) {
  for (const rung of magnetLadder(s, LAW)) {
    const o = outlineAt(s, rung.sizeMM)
    for (const m of rung.magnets) {
      const r = room(m, o)
      if (r < worst) { worst = r; worstWhere = `${name} ${rung.sizeMM}mm magnet ${m}` }
    }
  }
}
console.log(`  worst clearance across every published magnet: ${worst.toFixed(6)}mm  (${worstWhere})`)
console.log(`  floor is 10mm -> ${worst >= 10 ? 'OK' : 'VIOLATION, magnet sits ' + (10-worst).toFixed(4) + 'mm too close'}`)

console.log('\n=== FINDING 5: at square 68mm, is a 4-magnet population being hidden? ===')
const sq = shapes.square
const all = laddersByPlacement(sq, LAW)
const at68: string[] = []
for (const pl of all) for (const r of pl.rungs) if (r.sizeMM === 68) at68.push(`phase ${pl.phaseMM.join('/')} -> ${r.magnets.length} magnets`)
console.log('  lawful populations reaching 68mm:'); at68.forEach((s) => console.log('   ', s))
console.log('  magnetLadder actually returns:', magnetLadder(sq, LAW).find((r) => r.sizeMM === 68)?.magnets.length, 'magnets')
console.log('  Dan\'s canon: 68mm = 4 magnets')
