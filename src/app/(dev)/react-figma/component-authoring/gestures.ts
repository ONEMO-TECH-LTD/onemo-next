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
