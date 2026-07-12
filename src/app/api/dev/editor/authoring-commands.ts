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
