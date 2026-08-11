import { readFileSync } from 'node:fs'
const R=12, CEIL=408
const real=JSON.parse(readFileSync(process.env.CLAUDE_JOB_DIR+'/tmp/real.json','utf8'))
const sub=(P,n)=>{const st=Math.max(1,Math.floor(P.length/n));return P.filter((_,i)=>i%st===0)}
const inside=(p,poly)=>{let c=false
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i],[xj,yj]=poly[j]
    if(((yi>p[1])!==(yj>p[1]))&&(p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi))c=!c}
  return c}
const segD=(p,a,b)=>{const ab=[b[0]-a[0],b[1]-a[1]],ap=[p[0]-a[0],p[1]-a[1]]
  const L=ab[0]**2+ab[1]**2,t=L===0?0:Math.max(0,Math.min(1,(ap[0]*ab[0]+ap[1]*ab[1])/L))
  return Math.hypot(p[0]-(a[0]+ab[0]*t),p[1]-(a[1]+ab[1]*t))}
const clr=(p,P)=>{let m=Infinity
  for(let i=0;i<P.length;i++){const d=segD(p,P[i],P[(i+1)%P.length]);if(d<m)m=d}
  return inside(p,P)?m:-m}
const area=P=>{let A=0,cx=0,cy=0
  for(let i=0,j=P.length-1;i<P.length;j=i++){const f=P[j][0]*P[i][1]-P[i][0]*P[j][1]
    A+=f;cx+=(P[j][0]+P[i][0])*f;cy+=(P[j][1]+P[i][1])*f}
  A*=0.5;return [cx/(6*A),cy/(6*A)]}
const maxClear=P=>{let best=[0,0],bv=-Infinity
  for(const step of [0.05,0.0125,0.003,0.001]){const [bx,by]=best
    for(let x=bx-step*6;x<=bx+step*6;x+=step)for(let y=by-step*6;y<=by+step*6;y+=step){
      const v=clr([x,y],P);if(v>bv){bv=v;best=[x,y]}}}
  return best}
// a FOUR-POINT layout = a 2x2 block of adjacent positions, at pitch s
const pairBox=(a,b)=>({x0:Math.min(a[0],b[0])-R,x1:Math.max(a[0],b[0])+R,
                       y0:Math.min(a[1],b[1])-R,y1:Math.max(a[1],b[1])+R})
const region2x2=(cx,cy,s)=>{const q=[[cx,cy],[cx+s,cy],[cx,cy+s],[cx+s,cy+s]]
  return [pairBox(q[0],q[1]),pairBox(q[2],q[3]),pairBox(q[0],q[2]),pairBox(q[1],q[3])]}
const edge=(b,n=90)=>{const p=[],W=b.x1-b.x0,H=b.y1-b.y0
  for(let i=0;i<n;i++){const t=i/n*4,x=t%1
    p.push(t<1?[b.x0+W*x,b.y0]:t<2?[b.x1,b.y0+H*x]:t<3?[b.x1-W*x,b.y1]:[b.x0,b.y1-H*x])}
  return p}
// all 2x2 blocks whose corners lie in the band-n window, both pitches, bands 2 and 3
const blocks=()=>{const out=[]
  for(const s of [48,96]) for(const n of [2,3]){
    const run=Array.from({length:n},(_,i)=>s*(i-(n-1)/2))
    for(const x of run) for(const y of run)
      if(run.includes(x+s)&&run.includes(y+s)) out.push({cx:x,cy:y,s,n})}
  return out}
const sizesFor=(P,c)=>{const found=new Set()
  for(const b of blocks()){
    const pts=region2x2(b.cx,b.cy,b.s).flatMap(x=>edge(x))
    for(let E=24;E<=CEIL;E+=2){
      const q=P.map(([x,y])=>[(x-c[0])*E,(y-c[1])*E])
      if(pts.every(p=>inside(p,q))){found.add(E);break}}}
  return [...found].sort((a,b)=>a-b)}
console.log("DAN'S ASSUMPTION, MEASURED — how many FOUR-POINT (2x2) sizes each library shape has")
console.log("bands 2 and 3, pitches 48 and 96, ceiling 408mm\n")
console.log('shape        box centre        area centroid     maximum clearance')
for(const [name,P0] of Object.entries(real)){
  const P=sub(P0,800)
  const cs={box:[0,0], area:area(P), mc:maxClear(P)}
  const r=Object.fromEntries(Object.entries(cs).map(([k,c])=>[k,sizesFor(P,c)]))
  const f=a=>a.length?`${a.length}: ${a.slice(0,3).join(',')}${a.length>3?'…':''}`:'none'
  console.log(`${name.padEnd(12)} ${f(r.box).padEnd(17)} ${f(r.area).padEnd(17)} ${f(r.mc)}`)
}
