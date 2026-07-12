import type { EntityId, VariantFrame } from './authoring-types'

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).sort().join('\0') === [...keys].sort().join('\0')
}
