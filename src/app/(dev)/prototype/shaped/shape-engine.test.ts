import { describe, expect, it } from 'vitest'
import { createShapeSpecDraftFromMask, type BinaryMask } from './contour'
import { createRoundedShapeGeometry } from './mesh-builder'
import { INITIAL_SHAPED_SETTINGS } from './shape-spec'

function rectangleMask(): BinaryMask {
  const width = 80
  const height = 60
  const data = new Uint8Array(width * height)
  for (let y = 12; y < 48; y += 1) {
    for (let x = 18; x < 62; x += 1) {
      data[y * width + x] = 1
    }
  }
  return { width, height, data, foregroundMode: 'alpha' }
}

describe('shaped effect draft pipeline', () => {
  it('creates a true-mm ShapeSpecDraft from a binary mask', () => {
    const draft = createShapeSpecDraftFromMask({
      sourceRef: 'test-rect',
      sourceWidth: 800,
      sourceHeight: 600,
      mask: rectangleMask(),
      settings: INITIAL_SHAPED_SETTINGS,
    })

    expect(draft.dimensions_mm.thickness_body).toBe(1.6)
    expect(draft.dimensions_mm.edge_profile).toBe('rounded')
    expect(draft.dimensions_mm.edge_radius_mm).toBe(1)
    expect(Math.min(draft.dimensions_mm.width, draft.dimensions_mm.height)).toBeCloseTo(70, 1)
    expect(draft.geometry_mm.outer.length).toBeGreaterThanOrEqual(4)
    expect(draft.attachment_template.grid_pitch_mm).toBe(54)
    expect(draft.attachment_template.layout).toBe('silhouette_adaptive')
  })

  it('builds a grouped rounded-edge BufferGeometry', () => {
    const draft = createShapeSpecDraftFromMask({
      sourceRef: 'test-rect',
      sourceWidth: 800,
      sourceHeight: 600,
      mask: rectangleMask(),
      settings: INITIAL_SHAPED_SETTINGS,
    })
    const geometry = createRoundedShapeGeometry(draft)

    expect(geometry.getAttribute('position').count).toBeGreaterThan(0)
    expect(geometry.getAttribute('normal').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.getAttribute('uv').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.groups).toHaveLength(3)
    expect(geometry.groups.map((group) => group.materialIndex)).toEqual([0, 1, 2])
  })
})
