import { magnetLadder, magnetsFor, type Outline, type Pt, type GridLaw } from './magnet-grid'

const LAW: GridLaw = { pitchMM: 48, paddingMM: 10, maxSizeMM: 310, toleranceMM: 0.05 }
const ring = (f: (t: number) => Pt, n: number): Pt[] =>
  Array.from({ length: n }, (_, i) => f((i / n) * Math.PI * 2))
const O = (pts: Pt[], holes: Pt[][] = []): Outline =>
  ({ outer: { pts }, holes: holes.map((h) => ({ pts: h })) })

const SHAPES: Record<string, Outline> = {
  square:    O([[0,0],[1,0],[1,1],[0,1]]),
  circle:    O(ring((t) => [Math.cos(t), Math.sin(t)], 240)),
  triangle:  O([[0,0],[1,0],[0.5, Math.sqrt(3)/2]]),
  'L-shape': O([[0,0],[0.45,0],[0.45,0.55],[1,0.55],[1,1],[0,1]]),
  'oval 3:1':O(ring((t) => [Math.cos(t), 0.33*Math.sin(t)], 240)),
  sliver:    O(ring((t) => [Math.cos(t), 0.10*Math.sin(t)], 240)),
  blob:      O(ring((t) => { const r = 1 + 0.22*Math.sin(5*t); return [r*Math.cos(t), r*Math.sin(t)] }, 240)),
  'figure (600pt)': O(ring((t) => { const r = 1 + 0.30*Math.sin(4*t) + 0.10*Math.sin(7*t); return [r*Math.cos(t), r*Math.sin(t)] }, 600)),
  'donut':   O(ring((t) => [Math.cos(t), Math.sin(t)], 200), [ring((t) => [0.42*Math.cos(-t), 0.42*Math.sin(-t)], 120)]),
}

console.log('YOUR ACCEPTANCE (law 3.24a):  square 68/4 116/9 164/16   circle 88/4 156/9 224/16   triangle 1-1-3 five magnets\n')
for (const [name, shape] of Object.entries(SHAPES)) {
  const t0 = Date.now()
  const ladder = magnetLadder(shape, LAW)
  const ms = Date.now() - t0
  const std = ladder.map((r) => `${r.sizeMM}/${magnetsFor(r, 'standard').length}`).join('  ')
  console.log(`${name.padEnd(16)} ${std}`)
  console.log(`${''.padEnd(16)} light: ${ladder.map((r) => `${r.sizeMM}/${magnetsFor(r, 'light').length}`).join('  ')}   [${ms}ms]`)
}

// the triangle construction Dan drew: 1-1-3
const tri = magnetLadder(SHAPES.triangle, LAW)
const five = tri.find((r) => r.magnets.length === 5)
if (five) {
  const rows = new Map<number, number>()
  for (const [, y] of five.magnets) rows.set(Math.round(y), (rows.get(Math.round(y)) ?? 0) + 1)
  const shape = [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, n]) => n).join('-')
  console.log(`\ntriangle five-magnet rung: ${five.sizeMM}mm, rows top->bottom = ${shape}   (your drawing: 1-1-3)`)
} else {
  console.log('\ntriangle: no five-magnet rung')
}
