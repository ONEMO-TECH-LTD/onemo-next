const ladders={
 BUTTERFLY:[176,182,186,188,192,198,212,228,230,320,326,334,352,354],
 POKE1:[130,132,164,174,178,180,186,214,222,224,280,300,304,318,336,386],
 BOT:[132,142,152,176,180,186,204,216,220,238,254,256,308,310,322,348,380,390,394],
 PILL:[206,210,212,338,346,350,352,354],
}
// greedy thinning: keep the first, then keep the next size at least SEP away
const thin=(L,sep)=>{const out=[L[0]]
  for(const v of L.slice(1)) if(v-out[out.length-1]>=sep) out.push(v)
  return out}
const evenness=L=>{if(L.length<3) return '-'
  const g=L.slice(1).map((v,i)=>v-L[i])
  const m=g.reduce((a,b)=>a+b,0)/g.length
  const sd=Math.sqrt(g.reduce((a,b)=>a+(b-m)**2,0)/g.length)
  return `${(sd/m*100).toFixed(0)}%`}
console.log('CHERRY-PICKING BY MINIMUM SEPARATION — what each law-derived value leaves')
console.log('(separation candidates are lattice quantities, not invented numbers:')
console.log(' 12 = padding, 24 = the magnet spot, 48 = one pitch, 96 = the sparse pitch)\n')
for(const [name,L] of Object.entries(ladders)){
  console.log(`${name}  raw ${L.length} sizes, spread ${L[0]}-${L[L.length-1]}mm, gap unevenness ${evenness(L)}`)
  for(const sep of [12,24,48,96]){
    const t=thin(L,sep)
    console.log(`   >=${String(sep).padStart(2)}mm apart:  ${String(t.length).padStart(2)} sizes  unevenness ${String(evenness(t)).padStart(4)}   ${t.join(' ')}`)
  }
  console.log()
}
