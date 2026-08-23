// THE CANON TABLE as an executable probe — logic-spec §6, through the real solve door.
import { readFileSync } from 'node:fs'
import { solveCutout } from '../src/lib/grid-engine/bridge'
import { RELEASED, RELEASED_CALIBRATION, type CalibrationSpec } from '../src/lib/grid-engine/spec'
import { engineOutline, type OutlineUV } from '../src/lib/grid-engine/ui/trace-cutout'
import type { Contour, Pt } from '../src/lib/grid-engine/compute/types'

type F = { outline: OutlineUV; box: { w: number; h: number } }
const canon = JSON.parse(readFileSync('src/lib/grid-engine/__tests__/__fixtures-canon-shapes.json','utf8')) as Record<string,F>
const contourOf = (n: string): Contour => {
  const f = canon[n]
  return { outer: { pts: engineOutline(f.outline).map(([u,v]) => [u*f.box.w, v*f.box.h] as Pt) }, holes: [] }
}
// logic-spec §6: ✅ = ruled/blessed by Dan. count = the RULED FAMILY's magnet count.
const RULED: Record<string, Record<number, {n: number; family: string}>> = {
  bat:       { 1:{n:1,family:'single on the face'}, 2:{n:2,family:'vertical pair face+chest'}, 3:{n:3,family:'face + base-row (3pt utmost corners / blessed 4pt tee)'} },
  duck:      { 1:{n:1,family:'single in the head'}, 2:{n:2,family:'vertical head+body pair'}, 3:{n:4,family:'rect 48x96 four corners, mid row skipped'} },
  butterfly: { 1:{n:1,family:'single in the body'}, 2:{n:2,family:'horizontal wing pair'}, 3:{n:4,family:'four-in-wings corner square'}, 4:{n:4,family:'four on the 96 grid'} },
  bot:       { 2:{n:2,family:'vertical pair'}, 3:{n:4,family:'narrow 96x48 rect four'} },
  pill:      { 2:{n:2,family:'diagonal pair'}, 3:{n:3,family:'diagonal 3-chain'} },
  poke1:     { 1:{n:1,family:'single'}, 2:{n:2,family:'vertical head-body pair'}, 3:{n:4,family:'corner square'}, 4:{n:4,family:'four on the 96 grid'} },
}
const limits = process.argv.slice(2).map(Number).filter(Number.isFinite)
for (const limitMM of (limits.length ? limits : [RELEASED_CALIBRATION.unsupportedExtent?.activeLimitMM ?? 12])) {
  const cal: CalibrationSpec = RELEASED_CALIBRATION.unsupportedExtent
    ? { ...RELEASED_CALIBRATION, unsupportedExtent: { ...RELEASED_CALIBRATION.unsupportedExtent, activeLimitMM: limitMM } }
    : RELEASED_CALIBRATION
  let pass = 0, fail = 0
  console.log(`\n════ overhang limit ${limitMM}mm ════`)
  for (const [shape, rows] of Object.entries(RULED)) {
    const judged = solveCutout(RELEASED, cal, contourOf(shape))
    for (const [bandStr, want] of Object.entries(rows)) {
      const band = Number(bandStr)
      const answer = judged?.bands.find(b => b.band.band === band)
      const got = answer?.variants ?? []
      const counts = [...new Set(got.map(v => v.anchors.length))]
      const ok = counts.includes(want.n)
      ok ? pass++ : fail++
      const state = answer?.decisionState ?? 'NONE'
      console.log(`  ${ok ? '  ok' : 'FAIL'}  ${shape.padEnd(10)} B${band}  want ${want.n}pt  got ${got.length ? counts.join('/')+'pt' : 'NOTHING'}  [${state}]  — ${want.family}`)
    }
  }
  console.log(`  ---- ${pass} pass / ${fail} FAIL of ${pass+fail} ruled rows`)
}
