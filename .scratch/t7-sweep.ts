import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { solveCutout } from '../src/lib/grid-engine/bridge'
import { RELEASED, RELEASED_CALIBRATION } from '../src/lib/grid-engine/spec'
import { engineOutline, type OutlineUV } from '../src/lib/grid-engine/ui/trace-cutout'
import type { Contour, Pt } from '../src/lib/grid-engine/compute/types'

type CanonFixture = { outline: OutlineUV; box: { w: number; h: number } }
const fixtures = JSON.parse(
  readFileSync('src/lib/grid-engine/__tests__/__fixtures-canon-shapes.json', 'utf8'),
) as Record<string, CanonFixture>
const sha = (v: string) => createHash('sha256').update(v).digest('hex')
const toContour = (f: CanonFixture): Contour => ({
  outer: { pts: engineOutline(f.outline).map(([u, v]) => [u * f.box.w, v * f.box.h] as Pt) },
  holes: [],
})

const sweep = () =>
  Object.entries(fixtures).map(([name, fixture]) => {
    const contour = toContour(fixture)
    const judged = solveCutout(RELEASED, RELEASED_CALIBRATION, contour)
    return {
      name,
      vertices: contour.outer.pts.length,
      bands: (judged?.bands ?? []).map((band) => ({
        band: band.band.band,
        released: band.band.released,
        decisionState: band.decisionState,
        offers: band.variants.length,
        proofStatus: [...new Set(band.variants.map((v) => v.selection?.proofStatus ?? 'NONE'))],
        stoppedAt: [...new Set(band.variants.map((v) => v.selection?.selectionTrace.stoppedAt ?? null))],
        p4: [...new Set(band.variants.map((v) => v.selection?.unsupportedExtentPolicy.outcome ?? 'n/a'))],
        identity: band.variants.map((v) => ({
          pattern: v.selection!.identity.patternVariant,
          sizeMM: v.selection!.identity.sizeMM,
          geometry: v.selection!.identity.sourceGeometryHash,
          profile: v.selection!.identity.profileHash,
          evidence: v.selection!.identity.evidenceHash,
          result: v.selection!.identity.resultHash,
        })),
        refusals: [...new Set(band.rejections.flatMap((r) => r.reasons))],
      })),
    }
  })

const first = sweep()
const second = sweep()
const h1 = sha(JSON.stringify(first))
const h2 = sha(JSON.stringify(second))

for (const shape of first) {
  console.log(`\n### ${shape.name} — ${shape.vertices} vertices`)
  for (const b of shape.bands) {
    const rel = b.released ? 'released' : 'unreleased'
    console.log(`  B${b.band} [${rel}] ${b.decisionState} offers=${b.offers} proof=${JSON.stringify(b.proofStatus)} stoppedAt=${JSON.stringify(b.stoppedAt)} P4=${JSON.stringify(b.p4)}`)
    if (b.refusals.length) console.log(`      refusals: ${JSON.stringify(b.refusals)}`)
    for (const id of b.identity)
      console.log(`      ${id.pattern}@${id.sizeMM} geom=${id.geometry} prof=${id.profile} ev=${id.evidence} res=${id.result}`)
  }
}
const released = first.flatMap((s) => s.bands.filter((b) => b.released))
const indeterminate = released.filter((b) => b.decisionState === 'UNRESOLVED_SET')
const none = released.filter((b) => b.decisionState === 'NONE')
console.log('\n### SUMMARY')
console.log(`contours=${first.length} maxVertices=${Math.max(...first.map((s) => s.vertices))}`)
console.log(`released band-answers=${released.length}  CERTIFIED_WINNER=${released.filter(b=>b.decisionState==='CERTIFIED_WINNER').length}  CERTIFIED_SET=${released.filter(b=>b.decisionState==='CERTIFIED_SET').length}  UNRESOLVED_SET=${indeterminate.length}  NONE=${none.length}`)
console.log(`DETERMINISM: run1=${h1.slice(0,16)} run2=${h2.slice(0,16)} identical=${h1===h2}`)
console.log(`T7 GATE "no affected real contour is indeterminate": ${indeterminate.length === 0 ? 'PASS' : 'FAIL — ' + indeterminate.length + ' released band-answers unresolved'}`)
