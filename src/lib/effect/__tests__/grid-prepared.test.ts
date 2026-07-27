import { describe, expect, it } from 'vitest'

import { assertGridJsonByteEqual } from '../grid-byte-oracle'
import {
  computeGrid,
  computePreparedGrid,
  contourWithOuterMargin,
  stdShapeContour,
  type GridConfig,
} from '../grid'
import {
  PreparedContourSource,
  prepareExactContour,
} from '../grid-prepared'
import { DENSE_REAL_AI_GRID_CONTOUR } from '../grid-s0-corpus'
import type { Contour } from '../types'

const holed: Contour = {
  outer: { pts: [[0, 0], [118, 0], [118, 118], [0, 118]] },
  holes: [{ pts: [[40, 40], [40, 78], [78, 78], [78, 40]] }],
}

describe('S1a exact prepared-contour representation', () => {
  it('retains the concrete contour and every source-ordered edge without resampling', () => {
    const prepared = prepareExactContour(holed)

    expect(prepared.contour).toBe(holed)
    expect(prepared.segmentRings).toHaveLength(2)
    expect(prepared.segmentRings[0]).toMatchObject({ ringIndex: 0, pts: holed.outer.pts })
    expect(prepared.segmentRings[1]).toMatchObject({ ringIndex: 1, pts: holed.holes[0].pts })
    const outer = prepared.segmentRings[0].pts
    expect([outer[0], outer[1]]).toEqual([holed.outer.pts[0], holed.outer.pts[1]])
    expect([outer.at(-1), outer[0]]).toEqual([holed.outer.pts.at(-1), holed.outer.pts[0]])
  })

  it('reuses exact margin variants only inside one bounded concrete-size source', () => {
    const base = stdShapeContour('square', 118)
    let builds = 0
    const source = new PreparedContourSource((marginMM) => {
      builds += 1
      return contourWithOuterMargin(base, marginMM)
    })

    expect(source.get(0)).toBe(source.get(0))
    expect(source.get(12)).toBe(source.get(12))
    expect(source.get(12.000001)).not.toBe(source.get(12))
    expect(source.get(-0)).toBe(source.get(0))
    expect(source.size).toBe(3)
    expect(builds).toBe(3)

    const nextSize = new PreparedContourSource((marginMM) =>
      contourWithOuterMargin(stdShapeContour('square', 119), marginMM))
    expect(nextSize.get(0)).not.toBe(source.get(0))
  })

  it('keeps direct and prepared grid output full-JSON byte-identical', () => {
    const fixtures: ReadonlyArray<{ contour: Contour; config: GridConfig }> = [
      {
        contour: stdShapeContour('square', 70),
        config: { pitchMM: 48, pattern: 'standard' },
      },
      {
        contour: DENSE_REAL_AI_GRID_CONTOUR,
        config: { pitchMM: 96, pattern: 'diamond', sparseThin: true },
      },
      {
        contour: holed,
        config: { pitchMM: 48, pattern: 'standard', perimeterOnly: false },
      },
    ]

    for (const { contour, config } of fixtures) {
      const direct = computeGrid(contour, config)
      const prepared = computePreparedGrid(prepareExactContour(contour), config)
      expect(() => assertGridJsonByteEqual(prepared, direct)).not.toThrow()
    }
  })
})
