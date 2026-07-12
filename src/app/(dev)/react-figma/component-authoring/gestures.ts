export type CanvasHistoryAction = 'undo' | 'redo'

export function canvasHistoryAction(input: {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
}): CanvasHistoryAction | null {
  if (!(input.metaKey || input.ctrlKey) || input.key.toLowerCase() !== 'z') return null
  return input.shiftKey ? 'redo' : 'undo'
}

export function movedVariantFrame<T extends { x: number; y: number }>(
  frame: T,
  deltaX: number,
  deltaY: number,
): T | null {
  if (Math.abs(deltaX) + Math.abs(deltaY) < 2) return null
  return { ...frame, x: frame.x + deltaX, y: frame.y + deltaY }
}

type FrameGeometry = { x: number; y: number; width: number; height: number }

export function componentCanvasGeometry(frames: FrameGeometry[], primary: FrameGeometry) {
  const ghost = {
    x: Math.max(...frames.map((frame) => frame.x + frame.width), 0) + 24,
    y: primary.y,
    width: primary.width,
    height: primary.height,
  }
  return {
    ghost,
    bounds: {
      width: Math.max(800, ...frames.map((frame) => frame.x + frame.width + 80), ghost.x + ghost.width + 80),
      height: Math.max(600, ...frames.map((frame) => frame.y + frame.height + 80), ghost.y + ghost.height + 80),
    },
  }
}
