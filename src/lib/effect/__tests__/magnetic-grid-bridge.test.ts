import { describe, expect, it } from 'vitest'
import { passThroughLawContour } from '../magnetic-grid-bridge'
import type { Contour } from '@/lib/magnetic-grid/engine'

describe('v3.5.1 pass-through contour adapter', () => {
  it('preserves the supplied contour object and identities its exact coordinate bits', () => {
    const contour: Contour = { outer: { pts: [[0, 0], [1, 0], [0, 1]] }, holes: [] }
    const adapted = passThroughLawContour(contour)
    const changed = passThroughLawContour({ outer: { pts: [[0, 0], [1 + 2 ** -40, 0], [0, 1]] }, holes: [] })
    expect(adapted.contour).toBe(contour)
    expect(adapted.contourIdentity).not.toBe(changed.contourIdentity)
  })
})
