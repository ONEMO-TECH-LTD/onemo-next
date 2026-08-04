import { describe, expect, it } from 'vitest'

import {
  deriveGridFirstLadder,
  geometrySpecFromRecipe,
  materializeGridGeometry,
  type GridGeometryParameters,
  type LadderRecipe,
} from '../grid'
import { prepareExactContour } from '../grid-prepared'

function dimensions(recipe: LadderRecipe, parameters: GridGeometryParameters) {
  const prepared = prepareExactContour(
    materializeGridGeometry(geometrySpecFromRecipe(recipe), parameters),
  )
  return {
    widthMM: prepared.bbox.maxX - prepared.bbox.minX,
    heightMM: prepared.bbox.maxY - prepared.bbox.minY,
  }
}

describe('grid-first geometry specification', () => {
  it('keeps geometry invariants separate from grid-derived dimensions', () => {
    expect(dimensions(
      { kind: 'standard', shape: 'square' },
      { widthMM: 116, heightMM: 164 },
    )).toEqual({ widthMM: 116, heightMM: 116 })

    expect(dimensions(
      { kind: 'standard', shape: 'rect' },
      { widthMM: 164, heightMM: 68 },
    )).toEqual({ widthMM: 164, heightMM: 68 })

    expect(dimensions(
      { kind: 'standard', shape: 'circle' },
      { widthMM: 156, heightMM: 224 },
    )).toEqual({ widthMM: 156, heightMM: 156 })
  })

  it('lets one triangle specification materialize different lawful proportions', () => {
    const spec = geometrySpecFromRecipe({ kind: 'standard', shape: 'triangle' })
    expect(dimensions(
      { kind: 'standard', shape: 'triangle' },
      { widthMM: 146, heightMM: 126 },
    )).toEqual({ widthMM: 146, heightMM: 126 })
    expect(dimensions(
      { kind: 'standard', shape: 'triangle' },
      { widthMM: 180, heightMM: 120 },
    )).toEqual({ widthMM: 180, heightMM: 120 })
    expect(spec.adjustable).toEqual(['widthMM', 'heightMM'])
  })

  it('preserves an absolute rounded-corner radius while dimensions adapt', () => {
    const spec = geometrySpecFromRecipe({
      kind: 'rounded-square',
      radiusMM: 20,
      minimumAnchors: 4,
    })
    expect(spec.fixed).toEqual({ radiusMM: 20 })
    expect(dimensions(
      { kind: 'rounded-square', radiusMM: 20, minimumAnchors: 4 },
      { widthMM: 116, heightMM: 164 },
    )).toEqual({ widthMM: 116, heightMM: 116 })
    expect(() => materializeGridGeometry(spec, { widthMM: 30, heightMM: 80 }))
      .toThrow('fixed 20mm radius')
  })

  it('keeps arbitrary contour topology while applying only declared axis transforms', () => {
    const unitContour = {
      outer: { pts: [[0, 0], [1, 0], [1, 0.4], [0.4, 0.4], [0.4, 1], [0, 1]] as Array<[number, number]> },
      holes: [],
    }
    const spec = geometrySpecFromRecipe({ kind: 'uniform-contour', unitContour })
    const contour = materializeGridGeometry(spec, { widthMM: 180, heightMM: 120 })
    expect(contour.outer.pts).toEqual([
      [0, 0], [180, 0], [180, 48], [72, 48], [72, 120], [0, 120],
    ])
    expect(contour.holes).toEqual([])
  })

  it('derives square and circle sizes from the same population-first inverse', () => {
    const law = { paddingMM: 10, maxTestedMM: 164, maxRungMM: 164 }
    const square = deriveGridFirstLadder(
      geometrySpecFromRecipe({ kind: 'standard', shape: 'square' }),
      law,
      'standard',
      { pitchMM: 48, density: 'standard' },
    )
    const circle = deriveGridFirstLadder(
      geometrySpecFromRecipe({ kind: 'standard', shape: 'circle' }),
      law,
      'standard',
      { pitchMM: 48, density: 'standard' },
    )
    expect(square.map(({ sizeMM, points }) => [sizeMM, points])).toEqual([
      [20, 1], [68, 4], [116, 9], [164, 16],
    ])
    expect(circle.map(({ sizeMM, points }) => [sizeMM, points])).toEqual([
      [20, 1], [88, 4], [156, 9],
    ])
  })

  it('lets triangle topology induce a ragged population before deriving its geometry', () => {
    const ladder = deriveGridFirstLadder(
      geometrySpecFromRecipe({ kind: 'standard', shape: 'triangle' }),
      { paddingMM: 10, maxTestedMM: 150, maxRungMM: 150 },
      'standard',
      { pitchMM: 48, density: 'standard' },
    )
    const five = ladder.find(({ points }) => points === 5)
    expect(five).toBeDefined()
    const rows = new Map<number, number>()
    for (const [, row] of five!.construction.population) {
      rows.set(row, (rows.get(row) ?? 0) + 1)
    }
    expect([...rows.values()].sort((a, b) => b - a)).toEqual([3, 1, 1])
    expect(five!.geometry.widthMM).not.toBe(150)
    expect(five!.geometry.heightMM).not.toBe(150)
  })

  it('keeps a fixed rounded-square radius while the grid derives the square size', () => {
    const recipe = { kind: 'rounded-square', radiusMM: 20, minimumAnchors: 4 } as const
    const ladder = deriveGridFirstLadder(
      geometrySpecFromRecipe(recipe),
      { paddingMM: 10, maxTestedMM: 100, maxRungMM: 100 },
      'standard',
      { pitchMM: 48, density: 'standard' },
      4,
    )
    expect(ladder[0]).toMatchObject({ points: 4, sizeMM: 74 })
    expect(ladder[0].geometry.widthMM).toBe(ladder[0].geometry.heightMM)
    expect(geometrySpecFromRecipe(recipe).fixed).toEqual({ radiusMM: 20 })
  })

  it('is rotation-stable on an asymmetric concave contour and reacts to its geometry', () => {
    const contour = {
      outer: { pts: [[0, 0], [1, 0], [1, 0.4], [0.4, 0.4], [0.4, 1], [0, 1]] as Array<[number, number]> },
      holes: [],
    }
    const rotated = {
      outer: { pts: contour.outer.pts.map(([x, y]) => [1 - y, x] as [number, number]) },
      holes: [],
    }
    const mutated = {
      outer: { pts: [[0, 0], [1, 0], [1, 0.55], [0.4, 0.55], [0.4, 1], [0, 1]] as Array<[number, number]> },
      holes: [],
    }
    const law = { paddingMM: 10, maxTestedMM: 180, maxRungMM: 180 }
    const solve = (unitContour: typeof contour) => deriveGridFirstLadder(
      geometrySpecFromRecipe({ kind: 'uniform-contour', unitContour }),
      law,
      'standard',
      { pitchMM: 48, density: 'standard' },
    ).map(({ sizeMM, points }) => [sizeMM, points])
    expect(solve(rotated)).toEqual(solve(contour))
    expect(solve(mutated)).not.toEqual(solve(contour))
  })

  it('does not let a source label alter geometry or population', () => {
    const recipe = { kind: 'standard', shape: 'circle' } as const
    const law = { paddingMM: 10, maxTestedMM: 100, maxRungMM: 100 }
    const results = (['std', 'preset', 'gen', 'magic'] as const).map((source) =>
      deriveGridFirstLadder(
        geometrySpecFromRecipe(recipe),
        law,
        'standard',
        { pitchMM: 48, density: 'standard', source },
      ))
    expect(results.slice(1).every((result) => JSON.stringify(result) === JSON.stringify(results[0])))
      .toBe(true)
  })
})
