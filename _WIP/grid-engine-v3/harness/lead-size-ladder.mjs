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
const region=(A,s)=>{const out=[]
  for(let i=0;i<A.length;i++)for(let j=i+1;j<A.length;j++) if(adj(A[i],A[j],s)) out.push(pairBox(A[i],A[j]))
  return out}
const conn=(A,s)=>{if(A.length<2)return false
  const seen=new Set([0]),st=[0]
  while(st.length){const i=st.pop(); A.forEach((q,j)=>{if(!seen.has(j)&&adj(A[i],q,s)){seen.add(j);st.push(j)}})}
  return seen.size===A.length}
const edge=(b,n=100)=>{const p=[],W=b.x1-b.x0,H=b.y1-b.y0
  for(let i=0;i<n;i++){const t=i/n*4,x=t%1
    p.push(t<1?[b.x0+W*x,b.y0]:t<2?[b.x1,b.y0+H*x]:t<3?[b.x1-W*x,b.y1]:[b.x0,b.y1-H*x])}
  return p}
const runS=(k,s)=>Array.from({length:k},(_,i)=>s*(i-(k-1)/2))
const win=(n,s)=>runS(n,s).flatMap(x=>runS(n,s).map(y=>[x,y]))
const subsets=(W,s)=>{const out=[]
  for(let m=1;m<(1<<W.length);m++){const a=[]
    for(let i=0;i<W.length;i++) if(m&(1<<i)) a.push(W[i])
    if(a.length>=2&&conn(a,s)) out.push(a)}
  return out}
const pub=(P,boxes)=>{const pts=boxes.flatMap(b=>edge(b)); if(!pts.length) return null
  for(let E=24;E<=CEIL;E+=2){const q=P.map(([x,y])=>[x*E,y*E])
    if(pts.every(p=>inside(p,q))) return E}
  return null}
console.log('THE SIZE LADDER A USER WOULD SEE — every lawful size, bands 2 and 3, both populations')
console.log('(9x9 ceiling 408mm; outline subsampled to ~700 pts for speed)\n')
for(const [name,P0] of Object.entries(real)){
  if(!['BUTTERFLY','POKE1','PILL','BOT'].includes(name)) continue
  const P=sub(P0,700)
  const sizes=new Set()
  for(const s of [48,96]) for(const n of [2,3])
    for(const A of subsets(win(n,s),s)){const E=pub(P,region(A,s)); if(E) sizes.add(E)}
  const L=[...sizes].sort((a,b)=>a-b)
  const gaps=L.slice(1).map((v,i)=>v-L[i])
  console.log(`${name}  — ${L.length} distinct sizes`)
  console.log(`   ${L.join('  ')}`)
  if(gaps.length) console.log(`   gaps: min ${Math.min(...gaps)}mm  max ${Math.max(...gaps)}mm  median ${gaps.sort((a,b)=>a-b)[Math.floor(gaps.length/2)]}mm`)
  console.log()
}
