import { describe, expect, it } from 'vitest'

import { canvasHistoryAction, componentCanvasGeometry, movedVariantFrame } from './gestures'

describe('component canvas gestures', () => {
  it('dispatches platform undo and redo shortcuts without treating plain Z as history', () => {
    expect(canvasHistoryAction({ key: 'z', metaKey: true, ctrlKey: false, shiftKey: false })).toBe('undo')
    expect(canvasHistoryAction({ key: 'Z', metaKey: false, ctrlKey: true, shiftKey: true })).toBe('redo')
    expect(canvasHistoryAction({ key: 'z', metaKey: false, ctrlKey: false, shiftKey: false })).toBeNull()
  })

  it('turns a real pointer displacement into sidecar geometry and ignores a click', () => {
    const frame = { x: 20, y: 40, width: 320, height: 180 }
    expect(movedVariantFrame(frame, 56, 32)).toEqual({ x: 76, y: 72, width: 320, height: 180 })
    expect(movedVariantFrame(frame, -20_020, 0)).toEqual({ x: -20_000, y: 40, width: 320, height: 180 })
    expect(movedVariantFrame(frame, 1, 0)).toBeNull()
  })

  it('places the create ghost without defining a finite canvas boundary', () => {
    const primary = { x: 0, y: 0, width: 320, height: 180 }
    const frames = [primary, { ...primary, x: 20_000 }]

    const geometry = componentCanvasGeometry(frames, primary)

    expect(geometry.ghost).toEqual({ x: 20_344, y: 0, width: 320, height: 180 })
    expect('bounds' in geometry).toBe(false)
  })
})
