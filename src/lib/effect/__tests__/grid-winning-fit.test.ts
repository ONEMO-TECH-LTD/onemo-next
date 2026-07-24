import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  autoGrid,
  balancedFit,
  contourWithOuterMargin,
  stdShapeContour,
  type GridConfig,
} from '../grid-admin'
import type { Contour } from '../types'

function withMargin(contour: Contour): (marginMM: number) => Contour {
  return (marginMM) => contourWithOuterMargin(contour, marginMM)
}

describe('S1c winning balanced-fit reuse', () => {
  it.each([
    {
      name: 'default user target',
      contour: stdShapeContour('circle', 180),
      cfg: { paddingMM: 10, perimeterOnly: true, sparseThin: true, rescueCoverage: true },
      minN: undefined,
    },
    {
      name: 'fallback with unreachable custom target',
      contour: stdShapeContour('triangle', 90),
      cfg: { paddingMM: 10, perimeterOnly: true, sparseThin: true },
      minN: 100,
    },
  ] satisfies Array<{
    name: string
    contour: Contour
    cfg: GridConfig
    minN: number | undefined
  }>)('returns the exact current re-solve for $name', ({ contour, cfg, minN }) => {
    const source = withMargin(contour)
    const selected = autoGrid(source, cfg, 0, 12, { minN })
    const currentResolve = balancedFit(
      source,
      { ...cfg, pitchMM: selected.pitchMM, pattern: selected.pattern },
      0,
      12,
      { target: minN },
    )

    expect(JSON.stringify(selected.fit)).toBe(JSON.stringify(currentResolve))
  })

  it('keeps the production resolver from re-solving after auto selection', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/lib/effect/grid-core.ts'), 'utf8')
    const start = source.indexOf('function resolveGridPlanWithPolicy(')
    const end = source.indexOf('/** Product-safe resolver:', start)
    const resolver = source.slice(start, end)

    expect(resolver).toContain('const fit = selected.fit')
    expect(resolver).not.toContain('balancedPreparedFit(')
  })
})
