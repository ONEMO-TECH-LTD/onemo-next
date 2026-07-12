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
    expect(movedVariantFrame(frame, 1, 0)).toBeNull()
  })

  it('keeps the complete create ghost inside host bounds after every create', () => {
    const primary = { x: 0, y: 0, width: 320, height: 180 }
    const frames = [primary, { ...primary, x: 344 }]

    for (let create = 0; create < 4; create += 1) {
      const { ghost, bounds } = componentCanvasGeometry(frames, primary)
      expect(ghost.x + ghost.width).toBeLessThanOrEqual(bounds.width)
      expect(ghost.y + ghost.height).toBeLessThanOrEqual(bounds.height)
      frames.push({ ...ghost })
    }
  })
})
