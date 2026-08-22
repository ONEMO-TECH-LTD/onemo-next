// Probes run by s62-kai-lead on 2026-08-22 against a checkout of 2c043257.
// Usage: copy into src/lib/magnetic-grid/__tests__/ of that checkout and run `npx vitest run <file> --reporter=verbose`.
import { it } from 'vitest'
import { getShape } from '../../shape-library'
import { makeSizer, normBaseContour } from '../../effect/magnetic-grid-bridge'
import { computeGrid as legacy } from '../../effect/grid-origin'
import { computeGrid, fitSizeInBand, BANDS } from '../engine'
import type { Contour } from '../spec'

const square = (side: number): Contour => ({ outer: { pts: [[-side/2,-side/2],[side/2,-side/2],[side/2,side/2],[-side/2,side/2]] }, holes: [] })
const base = (k: Parameters<typeof getShape>[0]) => normBaseContour(getShape(k, 1024, 1024), 1024)!
const cfg = { pitchMM: 48, paddingMM: 12, phaseStepMM: 1, massDepthMM: 16, plan: 'all6' as const, perimeterOnly: true, circle: false }

// Result 2026-08-22: A24 anchors [[0,0]] refused req +0.5 WRAP_EXCEEDS_ALLOWANCE (correct); A48 same.
it('A. wrap square25 pitch24 flap0 (exact square)', () => {
  const g = computeGrid(square(25), { ...cfg, pitchMM: 24, centreMode: 0, flapMM: 0, wrapMode: 'fixed' })
  console.log('A24', JSON.stringify({ anchors: g.anchors.map(a=>a.p), status: g.wrap.status, req: g.wrap.requiredFlapApproxMM, code: (g.wrap as any).code, reason: (g.wrap as any).reason }))
})

// Result: all 9 policies eq=true on squircle72 and heart108. Weight mode squircle72: wrap=refused at req 0.000 (see D).
it('B. centre equivalence Law vs legacy Centre-rules, 9 policies, squircle72 + heart108', () => {
  const rows: string[] = []
  for (const [k, mm] of [['squircle', 72], ['heart', 108]] as const) {
    const c = makeSizer(base(k), 0)(mm)
    for (const centreMode of [0,1,2,3,4,5]) for (const governor of (centreMode === 2 ? [0,1,2,3] : [0])) {
      const l = computeGrid(c, { ...cfg, centreMode, governor, flapMM: 0, wrapMode: 'fixed' })
      const o = legacy(c, { ...cfg, centreMode, governor, positioning: 1, flapMM: 0, seatMarginMM: 0 })
      const eq = JSON.stringify(l.phaseMM) === JSON.stringify(o.phaseMM) && JSON.stringify(l.anchors) === JSON.stringify(o.anchors) && JSON.stringify(l.centreMainMM) === JSON.stringify(o.centreMainMM)
      rows.push(`${k}${mm} mode${centreMode}/gov${governor} eq=${eq} centre=${JSON.stringify(l.centreMainMM.map(v=>+v.toFixed(2)))} n=${l.anchors.length} wrap=${l.wrap.status} req=${l.wrap.requiredFlapApproxMM.toFixed(3)}`)
    }
  }
  console.log('B\n' + rows.join('\n'))
}, 120000)

// Result: square 1@24 4@72 8@120 12@168 16@216 (<1.1s/band). diamond: no rung in any band (at 72 n=1 req 10.08; at 120 n=2 req 6.61).
// squircle: 1@24 4@72; B3 none (at 120 n=6 req 24 refused); B4 none although at 168 n=8 req 0 LAWFUL; B3/B4/B5 = 53/72/86 s.
for (const k of ['square', 'diamond', 'squircle'] as const) {
  it(`C. ${k} existing bandWalk + exact Wrap gate, flap0 fixed, per band`, () => {
    const sized = makeSizer(base(k), 0)
    const rows: string[] = []
    for (const b of BANDS) {
      const t0 = Date.now()
      const fixed = fitSizeInBand(sized, { ...cfg, centreMode: 2, governor: 0, flapMM: 0, wrapMode: 'fixed' }, b.minMM, 1)
      const g1 = computeGrid(sized(b.minMM), { ...cfg, centreMode: 2, governor: 0, flapMM: 0, wrapMode: 'fixed' })
      rows.push(`${k} B${b.id} flap0: ${fixed.ladder.map(p=>`${p.count}@${p.sizeMM.toFixed(3)}`).join(' ')||'— (no rung)'} | at ${b.minMM}mm: n=${g1.anchors.length} req=${g1.wrap.requiredFlapApproxMM.toFixed(4)} ${g1.wrap.status} | ${Date.now()-t0}ms`)
    }
    console.log('C\n' + rows.join('\n'))
  }, 300000)
}

// Result: D-weight centre [49.99999999999999,50] refused NO_WRAPPED_LAYOUT_IN_BAND/invalid-seat reqExact 0/1; D-box [50,50] lawful.
// D-sq25p24 (shape-library square): anchor [16.861,16.861] refused invalid-seat reqExact -1/1125899906842624 (≈ -8.9e-16).
it('D. weight-mode squircle72 refusal detail + live-path shape-library square25 pitch24', () => {
  const c = makeSizer(base('squircle'), 0)(72)
  const w = computeGrid(c, { ...cfg, centreMode: 3, flapMM: 0, wrapMode: 'fixed' })
  console.log('D-weight', JSON.stringify({ centre: w.centreMainMM, phase: w.phaseMM, status: w.wrap.status, code: (w.wrap as any).code, reason: (w.wrap as any).reason, reqExact: w.wrap.requiredFlap }))
  const box = computeGrid(c, { ...cfg, centreMode: 0, flapMM: 0, wrapMode: 'fixed' })
  console.log('D-box', JSON.stringify({ centre: box.centreMainMM, phase: box.phaseMM, status: box.wrap.status, reqExact: box.wrap.requiredFlap }))
  const sq = makeSizer(base('square'), 0)(25)
  const g = computeGrid(sq, { ...cfg, pitchMM: 24, centreMode: 2, governor: 0, flapMM: 0, wrapMode: 'fixed' })
  console.log('D-sq25p24', JSON.stringify({ anchors: g.anchors.map(a=>a.p), centre: g.centreMainMM, status: g.wrap.status, code: (g.wrap as any).code, reason: (g.wrap as any).reason, reqExact: g.wrap.requiredFlap, reqApprox: g.wrap.requiredFlapApproxMM }))
})
