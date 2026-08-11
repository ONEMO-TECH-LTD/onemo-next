import { readFileSync } from 'node:fs'
const R=12, CEIL=408
const real=JSON.parse(readFileSync(process.env.CLAUDE_JOB_DIR+'/tmp/real.json','utf8'))
const sub=(P,n)=>{const st=Math.max(1,Math.floor(P.length/n));return P.filter((_,i)=>i%st===0)}
const inside=(p,poly)=>{let c=false
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i],[xj,yj]=poly[j]
    if(((yi>p[1])!==(yj>p[1]))&&(p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi))c=!c}
  return c}
const pairBox=(a,b)=>({x0:Math.min(a[0],b[0])-R,x1:Math.max(a[0],b[0])+R,
                       y0:Math.min(a[1],b[1])-R,y1:Math.max(a[1],b[1])+R})
const adj=(a,b,s)=>{const dx=Math.abs(a[0]-b[0]),dy=Math.abs(a[1]-b[1])
  return (dx===s&&dy===0)||(dy===s&&dx===0)}
const region=(A,s)=>{const o=[];for(let i=0;i<A.length;i++)for(let j=i+1;j<A.length;j++)
  if(adj(A[i],A[j],s)) o.push(pairBox(A[i],A[j])); return o}
const conn=(A,s)=>{if(A.length<2)return false
  const seen=new Set([0]),st=[0]
  while(st.length){const i=st.pop();A.forEach((q,j)=>{if(!seen.has(j)&&adj(A[i],q,s)){seen.add(j);st.push(j)}})}
  return seen.size===A.length}
const edge=(b,n=100)=>{const p=[],W=b.x1-b.x0,H=b.y1-b.y0
  for(let i=0;i<n;i++){const t=i/n*4,x=t%1
    p.push(t<1?[b.x0+W*x,b.y0]:t<2?[b.x1,b.y0+H*x]:t<3?[b.x1-W*x,b.y1]:[b.x0,b.y1-H*x])}
  return p}
const runS=(k,s)=>Array.from({length:k},(_,i)=>s*(i-(k-1)/2))
const win=(n,s)=>runS(n,s).flatMap(x=>runS(n,s).map(y=>[x,y]))
const subsets=(W,s)=>{const o=[]
  for(let m=1;m<(1<<W.length);m++){const a=[]
    for(let i=0;i<W.length;i++) if(m&(1<<i)) a.push(W[i])
    if(a.length>=2&&conn(a,s)) o.push(a)}
  return o}
const hull=B=>({x0:Math.min(...B.map(b=>b.x0)),x1:Math.max(...B.map(b=>b.x1)),
                y0:Math.min(...B.map(b=>b.y0)),y1:Math.max(...B.map(b=>b.y1))})
const solve=(P,A,s)=>{const B=region(A,s); if(!B.length)return null
  const pts=B.flatMap(b=>edge(b))
  for(let E=24;E<=CEIL;E+=2){const q=P.map(([x,y])=>[x*E,y*E])
    if(pts.every(p=>inside(p,q))){
      const h=hull(B)
      const f={left:Math.max(0,h.x0-Math.min(...q.map(p=>p[0]))),
               right:Math.max(0,Math.max(...q.map(p=>p[0]))-h.x1),
               top:Math.max(0,h.y0-Math.min(...q.map(p=>p[1]))),
               bottom:Math.max(0,Math.max(...q.map(p=>p[1]))-h.y1)}
      const v=Object.values(f)
      return {E,A:A.length,s,max:Math.max(...v),spread:Math.max(...v)-Math.min(...v),f}
    }}
  return null}
console.log("DAN'S RULE APPLIED — 'select the optimal by how fewer flap it has, if it is")
console.log("harmonious and centered, and how snug it fits the bounding box'\n")
for(const [name,P0] of Object.entries(real)){
  if(!['BUTTERFLY','POKE1','PILL','BOT','POKE2'].includes(name)) continue
  const P=sub(P0,600), all=[]
  for(const s of [48,96]) for(const n of [2,3])
    for(const A of subsets(win(n,s),s)){const r=solve(P,A,s); if(r) all.push(r)}
  if(!all.length){console.log(`${name}: nothing`);continue}
  // rank: fewest flap (max overhang), then most harmonious (spread), then snuggest (size)
  const rank=[...all].sort((a,b)=>a.max-b.max || a.spread-b.spread || a.E-b.E)
  const w=rank[0]
  console.log(`${name}  — ${all.length} lawful candidates`)
  console.log(`   WINNER  ${w.E}mm   ${w.A} magnets @ ${w.s}mm   max flap ${w.max.toFixed(1)}mm  spread ${w.spread.toFixed(1)}mm`)
  console.log(`           L${w.f.left.toFixed(1)} R${w.f.right.toFixed(1)} T${w.f.top.toFixed(1)} B${w.f.bottom.toFixed(1)}`)
  for(const r of rank.slice(1,4))
    console.log(`   next    ${r.E}mm   ${r.A} magnets @ ${r.s}mm   max flap ${r.max.toFixed(1)}  spread ${r.spread.toFixed(1)}`)
  console.log()
}
