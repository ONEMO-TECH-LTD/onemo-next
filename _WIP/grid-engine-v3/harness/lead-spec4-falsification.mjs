// Implement grid-spec.md §4 and §6 from the DOCUMENT, then check against brute force.
const P = 12, PITCH = 48
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]], dot=(a,b)=>a[0]*b[0]+a[1]*b[1]
const len=a=>Math.hypot(a[0],a[1])
function segDist(p,a,b){const ab=sub(b,a),ap=sub(p,a);const L=dot(ab,ab)
  const t=L===0?0:Math.max(0,Math.min(1,dot(ap,ab)/L));return len(sub(p,[a[0]+ab[0]*t,a[1]+ab[1]*t]))}
function inside(p,poly){let c=false
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i],[xj,yj]=poly[j]
    if(((yi>p[1])!==(yj>p[1]))&&(p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi))c=!c}
  return c}
const clearance=(p,poly)=>{const d=Math.min(...poly.map((v,i)=>segDist(p,v,poly[(i+1)%poly.length])))
  return inside(p,poly)?d:-d}

// §4 closed form: demand = (padding + q·n_i) / d_i ; closure = max
function closureSpec4(poly, magnets){
  // outward normals + distance from origin(centre) to each edge line at scale 1
  let best=-Infinity, binding=null
  for(let i=0;i<poly.length;i++){
    const a=poly[i], b=poly[(i+1)%poly.length]
    const e=sub(b,a); let n=[e[1],-e[0]]; const L=len(n); n=[n[0]/L,n[1]/L]
    let d=dot(a,n); if(d<0){n=[-n[0],-n[1]]; d=-d}     // outward
    for(const q of magnets){
      const demand=(P + dot(q,n))/d
      if(demand>best){best=demand; binding={edge:i,q}}
    }
  }
  return {scale:best, binding}
}
// brute force truth: smallest scale where every magnet clears P
function bruteScale(poly, magnets){
  let lo=0.01, hi=2000
  const ok=s=>magnets.every(q=>clearance(q, poly.map(([x,y])=>[x*s,y*s]))>=P-1e-9)
  for(let i=0;i<200;i++){const m=(lo+hi)/2; ok(m)?hi=m:lo=m}
  return hi
}
const band=(n)=>{const o=n%2===0?PITCH/2:0, first=Math.round(-o/PITCH-(n-1)/2), out=[]
  for(let x=0;x<n;x++)for(let y=0;y<n;y++)out.push([o+(first+x)*PITCH,o+(first+y)*PITCH]);return out}
const unitSquare=[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]]
const unitCircle=(n)=>Array.from({length:n},(_,i)=>{const t=i/n*2*Math.PI;return [0.5*Math.cos(t),0.5*Math.sin(t)]})

console.log('shape        band  spec4-closure  brute-force   diff       spec4 longest side')
for(const [name,poly] of [['square',unitSquare],['circle-720',unitCircle(720)]]){
  for(const n of [2,3]){
    const m=band(n)
    const s4=closureSpec4(poly,m).scale, bf=bruteScale(poly,m)
    // longest side of the unit shape is 1, so size == scale
    console.log(`${name.padEnd(12)} ${n}     ${s4.toFixed(4).padStart(9)}   ${bf.toFixed(4).padStart(9)}   ${(s4-bf).toFixed(6).padStart(9)}   ${s4.toFixed(2)}mm`)
  }
}
console.log('\n=== §6 integer publication: E = 2*floor(exact/2); while any fails: E += 2 ===')
for(const [name,poly] of [['square',unitSquare],['circle-720',unitCircle(720)]]){
  for(const n of [2,3]){
    const m=band(n), exact=bruteScale(poly,m)
    let E=2*Math.floor(exact/2)
    const fails=s=>m.some(q=>clearance(q,poly.map(([x,y])=>[x*s,y*s]))<P-1e-9)
    while(fails(E)) E+=2
    const cl=Math.min(...m.map(q=>clearance(q,poly.map(([x,y])=>[x*E,y*E]))))
    console.log(`  ${name} ${n}x${n}: exact ${exact.toFixed(2)}  ships ${E}  clearance ${cl.toFixed(2)}`)
  }
}

console.log('\n=== §4a: does the closed form OVER-CONSTRAIN on concave shapes? ===')
const shapes = {
  'L-shape':      [[-0.5,-0.5],[0.1,-0.5],[0.1,0.1],[0.5,0.1],[0.5,0.5],[-0.5,0.5]],
  'deep notch':   [[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[0.08,0.5],[0.08,-0.30],[-0.08,-0.30],[-0.08,0.5],[-0.5,0.5]],
  'C / hollow-ish':[[-0.5,-0.5],[0.5,-0.5],[0.5,-0.2],[-0.15,-0.2],[-0.15,0.2],[0.5,0.2],[0.5,0.5],[-0.5,0.5]],
  'plus / cross': [[-0.17,-0.5],[0.17,-0.5],[0.17,-0.17],[0.5,-0.17],[0.5,0.17],[0.17,0.17],[0.17,0.5],[-0.17,0.5],[-0.17,0.17],[-0.5,0.17],[-0.5,-0.17],[-0.17,-0.17]],
  'crescent':     [[-0.5,-0.4],[0.5,-0.4],[0.5,0.4],[0.2,0.4],[0.3,0.0],[0.2,-0.2],[-0.2,-0.2],[-0.3,0.0],[-0.2,0.4],[-0.5,0.4]],
}
console.log('shape             band   spec4      brute      ratio    verdict')
for (const [name, poly] of Object.entries(shapes)) {
  for (const n of [2,3]) {
    const m = band(n)
    const s4 = closureSpec4(poly, m).scale
    const bf = bruteScale(poly, m)
    const ratio = s4/bf
    const v = Math.abs(ratio-1) < 1e-6 ? 'EXACT' : (ratio>1 ? 'OVER-CONSTRAINS' : 'UNDER (unsafe!)')
    console.log(`${name.padEnd(17)} ${n}    ${s4.toFixed(2).padStart(8)}  ${bf.toFixed(2).padStart(8)}   ${ratio.toFixed(3)}   ${v}`)
  }
}

console.log('\n=== DECISIVE: at the size §4 returns, do the magnets actually clear? ===')
for (const [name, poly] of Object.entries(shapes)) {
  for (const n of [2]) {
    const m = band(n)
    const s4 = closureSpec4(poly, m).scale
    const cl = m.map(q => clearance(q, poly.map(([x,y])=>[x*s4,y*s4])))
    const worst = Math.min(...cl)
    const nOk = cl.filter(c => c >= P-1e-9).length
    console.log(`${name.padEnd(17)} band ${n}: §4 says ${s4.toFixed(1)}mm -> worst clearance ${worst.toFixed(2)}mm (need ${P}), ${nOk}/${m.length} magnets supported  ${worst>=P-1e-9?'LAWFUL':'*** UNLAWFUL — §4 published an illegal answer ***'}`)
  }
}
