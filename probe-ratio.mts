import { handleGridJob } from './src/lib/effect/grid'
type P = [number, number]
const ell = (ry: number, n = 72): P[] => Array.from({ length: n }, (_, i) => {
  const t = (i / n) * Math.PI * 2; return [0.5 + 0.5 * Math.cos(t), 0.5 + ry * Math.sin(t)] as P })
function wh(pts: ReadonlyArray<P>) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
  return [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]
}
for (const [name, ry] of [['round   1.0 : 1', 0.5], ['oval    1.7 : 1', 0.30], ['oval    3.1 : 1', 0.16], ['sliver  8.3 : 1', 0.06]] as [string, number][]) {
  const pts = ell(ry)
  const [iw, ih] = wh(pts)
  try {
    const lad: any = handleGridJob({ operation: 'ladder',
      recipe: { kind: 'uniform-contour', unitContour: { outer: { pts }, holes: [] } } as any,
      mode: 'standard', options: { source: 'ai', density: 'standard', center: 'centroid' } } as any)
    const rungs = lad.value.filter((r: any) => r.visible !== false)
    const r = rungs[1] ?? rungs[0]
    const [ow, oh] = wh(r.derivedContourMM.outer.pts)
    console.log(`${name}  uploaded ${ (iw/ih).toFixed(2) }:1   ->  returned at ${r.sizeMM}mm as ${ (ow/oh).toFixed(2) }:1   (${ow.toFixed(0)} x ${oh.toFixed(0)} mm)`)
  } catch (e: any) { console.log(`${name}  ERR ${String(e.message).slice(0,50)}`) }
}
