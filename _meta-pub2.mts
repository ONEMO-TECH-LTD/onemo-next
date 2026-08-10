import { publishedSizeMM } from '@/lib/grid-engine/engine'
import { RELEASED } from '@/lib/grid-engine/spec'
import { solveLayout, signedDistanceMM } from '@/lib/grid-engine/solve'
const circle=(d=200,n=180)=>Array.from({length:n},(_,i)=>{const a=2*Math.PI*i/n;return [Math.cos(a)*d/2,Math.sin(a)*d/2] as [number,number]})
const star=(d=200,p=5,inn=0.382)=>Array.from({length:p*2},(_,i)=>{const r=(i%2?inn:1)*d/2;const a=Math.PI*i/p-Math.PI/2;return [Math.cos(a)*r,Math.sin(a)*r] as [number,number]})

const check=(label:string, shape:[number,number][])=>{
  const L=solveLayout(RELEASED,shape); if(!L){console.log(label,'no layout');return}
  const bb=shape.reduce((a,[x,y])=>({w:Math.max(a.w,Math.abs(x)*2),h:Math.max(a.h,Math.abs(y)*2)}),{w:0,h:0})
  const longest=Math.max(bb.w,bb.h)
  const pub=publishedSizeMM(L.sizeMM)
  const sExact=L.scale, sPub=pub/longest
  const clr=(s:number)=>Math.min(...L.magnets.map(([x,y])=>s*signedDistanceMM(shape,x/s,y/s)))
  console.log(label.padEnd(10),
    `exact ${L.sizeMM.toFixed(2)} → published ${pub}`.padEnd(34),
    `clearance exact ${clr(sExact).toFixed(4)}`.padEnd(26),
    `published ${clr(sPub).toFixed(4)}`.padEnd(22),
    clr(sPub) >= RELEASED.grid.paddingMM-1e-6 ? 'FLOOR HOLDS' : '*** FLOOR BROKEN ***')
}
check('circle', circle())
check('star', star())
