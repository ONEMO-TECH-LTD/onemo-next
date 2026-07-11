export type VariantFrameGeometry = {
  x: number
  y: number
  width: number
  height: number
}

export type VariantGestureModel = {
  displayName: string
  frame: VariantFrameGeometry
}

export type CanvasGestureCommand =
  | { kind: 'create-variant'; file: string; name: string }
  | { kind: 'rename-variant'; file: string; from: string; to: string }
  | { kind: 'move-variant-frame'; file: string; variantId: string; frame: VariantFrameGeometry }
  | { kind: 'undo' }

export type UndoShortcutInput = {
  key: string
  metaKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  defaultPrevented?: boolean
}

export function nextAutoVariantName(variants: readonly VariantGestureModel[], baseName = 'Variant'): string {
  const existing = new Set(variants.map((variant) => variant.displayName.toLowerCase()))
  let index = variants.length + 1
  let name = `${baseName} ${index}`
  while (existing.has(name.toLowerCase())) {
    index += 1
    name = `${baseName} ${index}`
  }
  return name
}

export function createGhostFrame(variants: readonly VariantGestureModel[]): VariantFrameGeometry {
  const last = variants.at(-1)
  if (!last) return { x: 24, y: 48, width: 280, height: 160 }
  return {
    ...last.frame,
    x: last.frame.x + last.frame.width + 32,
  }
}

export function createVariantCommandFromGhost(
  file: string,
  variants: readonly VariantGestureModel[],
): CanvasGestureCommand {
  return { kind: 'create-variant', file, name: nextAutoVariantName(variants) }
}

export function renameVariantCommandFromDraft(
  file: string,
  from: string,
  draft: string,
): CanvasGestureCommand | null {
  const to = draft.trim()
  if (!to || to === from) return null
  return { kind: 'rename-variant', file, from, to }
}

export function translateVariantFrame(
  frame: VariantFrameGeometry,
  deltaX: number,
  deltaY: number,
): VariantFrameGeometry {
  return {
    ...frame,
    x: Math.max(0, Math.round(frame.x + deltaX)),
    y: Math.max(0, Math.round(frame.y + deltaY)),
  }
}

export function moveVariantFrameCommandFromDrag(
  file: string,
  variantId: string,
  frame: VariantFrameGeometry,
  deltaX: number,
  deltaY: number,
): CanvasGestureCommand {
  return {
    kind: 'move-variant-frame',
    file,
    variantId,
    frame: translateVariantFrame(frame, deltaX, deltaY),
  }
}

export function isUndoKeyboardShortcut(input: UndoShortcutInput): boolean {
  return !input.defaultPrevented
    && input.metaKey === true
    && input.altKey !== true
    && input.shiftKey !== true
    && input.key.toLowerCase() === 'z'
}

export function undoCommandFromKeyboard(
  input: UndoShortcutInput,
  canUndo: boolean,
): CanvasGestureCommand | null {
  if (!canUndo || !isUndoKeyboardShortcut(input)) return null
  return { kind: 'undo' }
}
