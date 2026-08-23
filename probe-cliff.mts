import { handleGridJob } from './src/lib/effect/grid'
function blob(n: number, lobes = 5, amp = 0.22) {
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2
    const r = 0.5 * (1 + amp * Math.sin(lobes * t) + 0.08 * Math.sin(3.7 * t + 1.1))
    pts.push([0.5 + r * Math.cos(t), 0.5 + r * Math.sin(t)])
  }
  return { outer: { pts }, holes: [] }
}
for (const n of [36, 40, 44, 48, 56, 64, 80, 96, 120]) {
  const t0 = Date.now()
  let rungs = -1, err = ''
  try {
    const r: any = handleGridJob({
      operation: 'ladder',
      recipe: { kind: 'uniform-contour', unitContour: blob(n) } as any,
      mode: 'standard' as any,
      options: { source: 'ai', density: 'standard', center: 'centroid' } as any,
    } as any)
    rungs = r.value.filter((v: any) => v.visible !== false).length
  } catch (e: any) { err = String(e.message).slice(0, 50) }
  console.log(`blob ${String(n).padStart(3)}pts -> ${Date.now() - t0}ms rungs=${rungs}${err ? ' ERR ' + err : ''}`)
}
