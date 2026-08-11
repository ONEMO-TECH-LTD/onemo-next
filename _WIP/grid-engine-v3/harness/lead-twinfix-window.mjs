const R=12
const inside=(p,poly)=>{let c=false
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i],[xj,yj]=poly[j]
    if(((yi>p[1])!==(yj>p[1]))&&(p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi))c=!c}
  return c}
const box={x0:-36,x1:36,y0:-12,y1:12}   // the twin-fix region: 72 x 24
const edge=(b,n=400)=>{const p=[],W=b.x1-b.x0,H=b.y1-b.y0
  for(let i=0;i<n;i++){const t=i/n*4,x=t%1
    p.push(t<1?[b.x0+W*x,b.y0]:t<2?[b.x1,b.y0+H*x]:t<3?[b.x1-W*x,b.y1]:[b.x0,b.y1-H*x])}
  return p}
// elongated rounded shapes of varying aspect, longest side = 1
const lozenge=(ar,n=600)=>Array.from({length:n},(_,i)=>{const t=i/n*2*Math.PI
  return [0.5*Math.cos(t), 0.5/ar*Math.sin(t)]})
console.log('WHERE THE TWIN FIX ACTUALLY WORKS — a pair box is 72 x 24, aspect 3:1')
console.log('aspect   size   overhang L/R   T/B    max     flap12  flap24  <=168?')
for(const ar of [1.0,1.5,2.0,2.5,3.0,3.5,4.0]){
  const P=lozenge(ar), pts=edge(box)
  let E=null
  for(let s=24;s<=400;s+=2){const q=P.map(([x,y])=>[x*s,y*s])
    if(pts.every(p=>inside(p,q))){E=s;break}}
  if(!E){console.log(`${ar.toFixed(1)}:1     none`);continue}
  const q=P.map(([x,y])=>[x*E,y*E])
  const f={l:Math.max(0,box.x0-Math.min(...q.map(p=>p[0]))),r:Math.max(0,Math.max(...q.map(p=>p[0]))-box.x1),
           t:Math.max(0,box.y0-Math.min(...q.map(p=>p[1]))),b:Math.max(0,Math.max(...q.map(p=>p[1]))-box.y1)}
  const mx=Math.max(f.l,f.r,f.t,f.b)
  console.log(`${ar.toFixed(1)}:1   ${String(E).padStart(4)}mm    ${f.l.toFixed(0)}/${f.r.toFixed(0)}        ${f.t.toFixed(0)}/${f.b.toFixed(0)}     ${mx.toFixed(0).padStart(3)}mm   ${mx<=12?'PASS':'fail'}    ${mx<=24?'PASS':'fail'}    ${E<=168?'yes':'no'}`)
}
