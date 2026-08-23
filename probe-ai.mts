import { handleGridJob } from './src/lib/effect/grid'

// A realistic AI cut-out outline: lobed blob, N points, unit-normalised.
function blob(n: number, lobes = 5, amp = 0.22): { outer: { pts: [number,number][] }, holes: any[] } {
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2
    const r = 0.5 * (1 + amp * Math.sin(lobes * t) + 0.08 * Math.sin(3.7 * t + 1.1))
    pts.push([0.5 + r * Math.cos(t), 0.5 + r * Math.sin(t)])
  }
  return { outer: { pts }, holes: [] }
}

function run(label: string, n: number, minM: number, maxM: number) {
  const unitContour: any = blob(n)
  const t0 = Date.now()
  let rungs = -1, err = ''
  try {
    const r: any = handleGridJob({
      operation: 'ladder',
      recipe: { kind: 'uniform-contour', unitContour, minMarginMM: minM, maxMarginMM: maxM } as any,
      mode: 'standard' as any,
      options: { source: 'ai', density: 'standard', center: 'centroid' } as any,
    } as any)
    rungs = r.value.filter((v: any) => v.visible !== false).length
  } catch (e: any) { err = String(e.message).slice(0, 60) }
  const ms = Date.now() - t0
  console.log(`${label}|pts=${n}|margin=${minM}-${maxM}|${ms}ms|rungs=${rungs}${err ? '|ERR ' + err : ''}`)
}

run('A no-margin  ', 120, 0, 0)
run('B no-margin  ', 400, 0, 0)
run('C margin-band', 120, 0, 12)
run('D margin-band', 400, 0, 12)
