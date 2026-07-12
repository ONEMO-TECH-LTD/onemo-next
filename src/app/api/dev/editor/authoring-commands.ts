import type { EntityId, VariantFrame } from './authoring-types'
import { isStoreRelativePath } from './authoring-schema'

export type CreateComponentFromSelectionCommand = {
  kind: 'create-component-from-selection'
  commandId: string
  file: string
  line: number
  col: number
  name: string
}

export type CreateVariantCommand = {
  kind: 'create-variant'
  commandId: string
  componentId: EntityId
  displayName: string
}

export type RenameVariantCommand = {
  kind: 'rename-variant'
  commandId: string
  componentId: EntityId
  variantId: EntityId
  displayName: string
}

export type MoveVariantCommand = {
  kind: 'move-variant'
  commandId: string
  componentId: EntityId
  variantId: EntityId
  frame: VariantFrame['frame']
}

export type G2VariantCommand = CreateVariantCommand | RenameVariantCommand | MoveVariantCommand

export function parseCreateComponentFromSelectionCommand(value: unknown): CreateComponentFromSelectionCommand | null {
  if (!isRecord(value) || !exactKeys(value, ['kind', 'commandId', 'file', 'line', 'col', 'name'])) return null
  if (value.kind !== 'create-component-from-selection' || !validCommandId(value.commandId) ||
    typeof value.file !== 'string' || !isProjectSelectionFile(value.file) ||
    !positivePosition(value.line) || !positivePosition(value.col) ||
    typeof value.name !== 'string' || value.name.length > 120 || !/^[A-Z][A-Za-z0-9]*$/.test(value.name)) return null
  return value as CreateComponentFromSelectionCommand
}

export function isProjectSelectionFile(value: string): boolean {
  return isStoreRelativePath(value) && value.endsWith('.tsx') &&
    (value.startsWith('src/') || value.startsWith('storybook/'))
}

export function parseG2VariantCommand(value: unknown): G2VariantCommand | null {
  if (!isRecord(value)) return null
  const base = validCommandId(value.commandId) && validId(value.componentId)
  if (!base) return null
  if (value.kind === 'create-variant') {
    return exactKeys(value, ['kind', 'commandId', 'componentId', 'displayName']) && validDisplayName(value.displayName)
      ? value as CreateVariantCommand
      : null
  }
  if (value.kind === 'rename-variant') {
    return exactKeys(value, ['kind', 'commandId', 'componentId', 'variantId', 'displayName']) &&
      validId(value.variantId) && validDisplayName(value.displayName)
      ? value as RenameVariantCommand
      : null
  }
  if (value.kind === 'move-variant') {
    if (!exactKeys(value, ['kind', 'commandId', 'componentId', 'variantId', 'frame']) ||
      !validId(value.variantId) || !isRecord(value.frame) || !exactKeys(value.frame, ['x', 'y', 'width', 'height'])) return null
    const frame = value.frame as Record<string, unknown>
    if (![frame.x, frame.y, frame.width, frame.height].every((entry) => typeof entry === 'number' && Number.isFinite(entry)) ||
      (frame.width as number) <= 0 || (frame.height as number) <= 0) return null
    return value as MoveVariantCommand
  }
  return null
}

function validCommandId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
}

function validDisplayName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 120 && !/[\u0000-\u001f\u007f]/.test(value)
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 200 && !/[\u0000-\u001f\u007f]/.test(value)
}

function positivePosition(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).sort().join('\0') === [...keys].sort().join('\0')
}
