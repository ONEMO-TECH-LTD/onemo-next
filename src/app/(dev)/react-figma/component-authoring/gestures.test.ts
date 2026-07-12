import { describe, expect, it } from 'vitest'

import { canvasHistoryAction, movedVariantFrame } from './gestures'

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
})
