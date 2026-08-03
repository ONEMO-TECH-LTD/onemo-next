import { gridFirstLadder } from './grid-first'
import type { Contour, Pt } from './types'
const mk = (f: (s: number) => Pt[]) => (s: number): Contour => ({ outer: { pts: f(s) }, holes: [] })
const SHAPES: Record<string, (s: number) => Contour> = {
  square: mk(s => [[0,0],[s,0],[s,s],[0,s]]),
  circle: mk(s => Array.from({length:128},(_,i)=>{const t=i/128*Math.PI*2;return [s/2+s/2*Math.cos(t), s/2+s/2*Math.sin(t)] as Pt})),
  triangle: mk(s => [[0,0],[s,0],[s/2, s*Math.sqrt(3)/2]]),
  diamond: mk(s => [[s/2,0],[s,s/2],[s/2,s],[0,s/2]]),
  'L-shape': mk(s => [[0,0],[s,0],[s,s/2],[s/2,s/2],[s/2,s],[0,s]]),
  'AI-blob': mk(s => Array.from({length:40},(_,i)=>{const t=i/40*Math.PI*2
    const r=s/2*(1+0.26*Math.sin(3*t+1.1)+0.15*Math.cos(5*t+0.4)); return [s/2+r*Math.cos(t), s/2+r*Math.sin(t)] as Pt})),
}
for (const mask of ['perimeter','all'] as const){
  console.log(`\n════ ${mask === 'all' ? 'STANDARD mode (all magnets)' : 'LIGHT mode (perimeter only)'} ════`)
  for (const pitchMM of [48,96]){
    console.log(`  ── ${pitchMM}mm ──`)
    for (const [name, makeShape] of Object.entries(SHAPES)){
      const l = gridFirstLadder(makeShape, { pitchMM, mask, paddingMM: 10, maxSizeMM: 310 })
      console.log(`   ${name.padEnd(9)} ${l.map(s=>`${s.sizeMM}/${s.points}`).join('  ') || '<none>'}`)
    }
  }
}
console.log('\npublished today  square/48: 68/4 116/8 164/12 212/16 260/20 308/24   square/96: 116/4 212/8 308/12')
