import { readFileSync } from 'node:fs'
const R=12, CEIL=408, STEP=2
const real=JSON.parse(readFileSync(process.env.CLAUDE_JOB_DIR+'/tmp/real.json','utf8'))
const sub=(P,n)=>{const st=Math.max(1,Math.floor(P.length/n));return P.filter((_,i)=>i%st===0)}
const inside=(p,poly)=>{let c=false
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i],[xj,yj]=poly[j]
    if(((yi>p[1])!==(yj>p[1]))&&(p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi))c=!c}
  return c}
const segD=(p,a,b)=>{const ab=[b[0]-a[0],b[1]-a[1]],ap=[p[0]-a[0],p[1]-a[1]]
  const L=ab[0]**2+ab[1]**2,t=L===0?0:Math.max(0,Math.min(1,(ap[0]*ab[0]+ap[1]*ab[1])/L))
  return Math.hypot(p[0]-(a[0]+ab[0]*t),p[1]-(a[1]+ab[1]*t))}
const clr=(p,P)=>{let m=Infinity;for(let i=0;i<P.length;i++){const d=segD(p,P[i],P[(i+1)%P.length]);if(d<m)m=d}
  return inside(p,P)?m:-m}
const CENTRES={
  box:P=>{const xs=P.map(p=>p[0]),ys=P.map(p=>p[1])
    return [(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2]},
  area:P=>{let A=0,cx=0,cy=0
    for(let i=0,j=P.length-1;i<P.length;j=i++){const f=P[j][0]*P[i][1]-P[i][0]*P[j][1]
      A+=f;cx+=(P[j][0]+P[i][0])*f;cy+=(P[j][1]+P[i][1])*f}
    A*=0.5;return [cx/(6*A),cy/(6*A)]},
  perimeter:P=>{let L=0,cx=0,cy=0
    for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length]
      const l=Math.hypot(b[0]-a[0],b[1]-a[1]);L+=l;cx+=(a[0]+b[0])/2*l;cy+=(a[1]+b[1])/2*l}
    return [cx/L,cy/L]},
  vertices:P=>[P.reduce((s,p)=>s+p[0],0)/P.length,P.reduce((s,p)=>s+p[1],0)/P.length],
  'max-clearance':P=>{let best=[0,0],bv=-Infinity
    for(const step of [0.05,0.0125,0.003,0.001]){const [bx,by]=best
      for(let x=bx-step*6;x<=bx+step*6;x+=step)for(let y=by-step*6;y<=by+step*6;y+=step){
        const v=clr([x,y],P);if(v>bv){bv=v;best=[x,y]}}}
    return best},
}
const pairBox=(a,b)=>({x0:Math.min(a[0],b[0])-R,x1:Math.max(a[0],b[0])+R,
                       y0:Math.min(a[1],b[1])-R,y1:Math.max(a[1],b[1])+R})
const edge=(b,n=80)=>{const p=[],W=b.x1-b.x0,H=b.y1-b.y0
  for(let i=0;i<n;i++){const t=i/n*4,x=t%1
    p.push(t<1?[b.x0+W*x,b.y0]:t<2?[b.x1,b.y0+H*x]:t<3?[b.x1-W*x,b.y1]:[b.x0,b.y1-H*x])}
  return p}
// §6.1 centred run windows, bands 2 and 3, every extent
const run=(s,k)=>Array.from({length:k},(_,i)=>s*(i-Math.floor((k-1)/2)))
const windows=s=>{const out=[]
  for(const n of [2,3]) for(let r=1;r<=n;r++) for(let c=1;c<=n;c++){
    const V=run(s,c).flatMap(x=>run(s,r).map(y=>[x,y]))
    out.push({V,r,c,n})}
  return out}
// §6.2 adjacency graph: edge iff one population pitch apart, horizontal or vertical
const edgesOf=(V,s)=>{const E=[]
  for(let i=0;i<V.length;i++)for(let j=i+1;j<V.length;j++){
    const dx=Math.abs(V[i][0]-V[j][0]),dy=Math.abs(V[i][1]-V[j][1])
    if((dx===s&&dy===0)||(dy===s&&dx===0)) E.push([i,j])}
  return E}
const components=(V,E)=>{const par=V.map((_,i)=>i)
  const find=x=>par[x]===x?x:(par[x]=find(par[x]))
  for(const [a,b] of E) par[find(a)]=find(b)
  const g=new Map()
  for(const [a,b] of E){const k=find(a); if(!g.has(k))g.set(k,{v:new Set(),e:[]}); g.get(k).v.add(a).add(b); g.get(k).e.push([a,b])}
  return [...g.values()].map(c=>({v:[...c.v].sort((x,y)=>x-y), e:c.e}))}
// §6.3 four corners of the component's own outermost rectangular extent
const isFourCorner=(pts)=>{if(pts.length!==4) return false
  const xs=[...new Set(pts.map(p=>p[0]))], ys=[...new Set(pts.map(p=>p[1]))]
  if(xs.length!==2||ys.length!==2) return false
  return xs.every(x=>ys.every(y=>pts.some(p=>p[0]===x&&p[1]===y)))}
// lawful components at ONE size, for one population
const compsAt=(P,c,s,Emm)=>{
  const T=P.map(([x,y])=>[(x-c[0])*Emm,(y-c[1])*Emm])
  const out=[]
  for(const {V} of windows(s)){
    const E=edgesOf(V,s); if(!E.length) continue
    const active=E.filter(([a,b])=>edge(pairBox(V[a],V[b])).every(p=>inside(p,T)))
    if(!active.length) continue
    for(const comp of components(V,active)){
      const pts=comp.v.map(i=>V[i])
      const id=comp.v.join(',')+'|'+comp.e.map(([a,b])=>a+'-'+b).sort().join(',')
      out.push({id,pts,n:pts.length})
    }}
  return out}

// EC-05: a FAMILY exists at size E when BOTH populations are lawful at E.
// interval-first: a component is `optimum` only at the FIRST size its own id is lawful.
const families=(P,c)=>{
  const firstSeen=new Map()
  const fam=[]
  for(let Emm=24;Emm<=CEIL;Emm+=STEP){
    const a=compsAt(P,c,48,Emm)
    if(!a.length) continue
    const b=compsAt(P,c,96,Emm)
    if(!b.length) continue                       // EC-05: both populations must hold
    for(const comp of a){
      const first=!firstSeen.has(comp.id)
      if(first) firstSeen.set(comp.id,Emm)
      const kind = comp.n===2 ? 'floor'
                 : (isFourCorner(comp.pts) && first) ? 'optimum'
                 : 'intermediate'
      fam.push({sizeMM:Emm, kind})
    }}
  return fam}

console.log('CONFORMANT COUNT — blueprint v2.1 grammar: active-edge components, interval-first classification')
console.log('bands 2+3, every extent, both populations, EC-05 coupling at one published size, ceiling 408mm\n')
const methods=Object.keys(CENTRES)
console.log('FOUR-CORNER OPTIMUM COUNT — the classification Dan cares about, per centre\n')
console.log('shape'.padEnd(11)+methods.map(m=>m.padStart(15)).join(''))
for(const [name,P0] of Object.entries(real)){
  const P=sub(P0,500)
  const cells=methods.map(m=>{
    const c=CENTRES[m](P)
    const fam=families(P,c)
    const cnt=k=>fam.filter(x=>x.kind===k).length
    return String(cnt('optimum'))
  })
  console.log(name.padEnd(11)+cells.map(v=>(v==='0'?'—':v).padStart(15)).join(''))
}
