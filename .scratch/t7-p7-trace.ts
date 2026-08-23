import { readFileSync } from 'node:fs'
import { solveCutout } from '../src/lib/grid-engine/bridge'
import { RELEASED, RELEASED_CALIBRATION } from '../src/lib/grid-engine/spec'
import { engineOutline, type OutlineUV } from '../src/lib/grid-engine/ui/trace-cutout'
import type { Contour, Pt } from '../src/lib/grid-engine/compute/types'

type CanonFixture = { outline: OutlineUV; box: { w: number; h: number } }
const fixtures = JSON.parse(
  readFileSync('src/lib/grid-engine/__tests__/__fixtures-canon-shapes.json', 'utf8'),
) as Record<string, CanonFixture>

for (const name of ['bat', 'pill']) {
  const fixture = fixtures[name]
  const contour: Contour = {
    outer: { pts: engineOutline(fixture.outline).map(([u, v]) => [u * fixture.box.w, v * fixture.box.h] as Pt) },
    holes: [],
  }
  const judged = solveCutout(RELEASED, RELEASED_CALIBRATION, contour)
  const band = judged?.bands.find((answer) => answer.band.band === 2)
  console.log(`\n${name} B2 ${band?.decisionState} offers=${band?.variants.length}`)
  for (const variant of band?.variants ?? []) {
    const selection = variant.selection!
    const distribution = selection.selectionTrace.chain.distribution
    console.log(`${selection.patternId}@${selection.identity.sizeMM} stoppedAt=${selection.selectionTrace.stoppedAt}`)
    console.log(JSON.stringify({
      distinctMassCount: selection.distinctMassCount,
      hierarchyCertain: selection.hierarchyCertain,
      deepLevel: selection.structuralEvidence.levels[RELEASED_CALIBRATION.nodeClassification.strongLevelIndex],
      distribution: distribution && {
        status: distribution.status,
        lo: distribution.lo,
        hi: distribution.hi,
        proof: distribution.completenessProof,
        regions: distribution.argopt?.regions.length ?? null,
        points: distribution.argopt?.points.length ?? null,
        perComponent: distribution.perComponent.map((entry) => ({
          resolved: entry.resolved,
          lo: entry.lo,
          hi: entry.hi,
          regions: entry.argopt?.regions.length ?? null,
          points: entry.argopt?.points.length ?? null,
        })),
        witnesses: distribution.witnessEvidence.length,
      },
    }, null, 2))
  }
}
