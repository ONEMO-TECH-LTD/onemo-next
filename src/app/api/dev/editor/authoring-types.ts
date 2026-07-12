export type StoreId = string
export type EntityId = string
export type PropertyId = string
export type Sha256 = string

export type RootKind = 'project' | 'global'

export type AuthoringGraphV1 = {
  schemaVersion: 2
  storeId: StoreId
  revision: number
  root: { kind: RootKind }
  sourceHashes: Record<string, Sha256>
  environmentFingerprint: Sha256
  components: Record<EntityId, ComponentDefinition>
  variants: Record<EntityId, VariantFrame>
  sourceProperties: Record<PropertyId, SourcePropertyRef>
  interactions: Record<EntityId, InteractionEdge>
  interactionOverrides: Record<EntityId, InteractionOverride>
  instances: Record<EntityId, ComponentInstance>
  folders: Record<EntityId, AssetFolder>
}

export type SourceRef = {
  storeId: StoreId
  file: string
  exportName: string
}

export type SourcePropertyRef = {
  id: PropertyId
  componentId: EntityId
  variantId: EntityId
  source: SourceRef
  ownerAnchor: SourceAnchor
  inheritedFromPropertyId: PropertyId | null
  binding:
    | { kind: 'jsx-prop'; propName: string }
    | { kind: 'inline-style'; property: string }
    | { kind: 'module-css'; stylesheet: { storeId: StoreId; file: string }; localClass: string; property: string }
    | { kind: 'text-content' }
}

export type ComponentDefinition = {
  id: EntityId
  displayName: string
  source: SourceRef
  projectionFingerprint: Sha256
  primaryVariantId: EntityId
  folderId: EntityId | null
  compatibility: 'native-v1' | 'legacy-single-axis' | 'legacy-multi-axis' | 'unsupported'
}

export type VariantFrame = {
  id: EntityId
  componentId: EntityId
  displayName: string
  frame: { x: number; y: number; width: number; height: number }
  inheritance:
    | { kind: 'primary' }
    | { kind: 'linked'; primaryVariantId: EntityId; overridePropertyIds: PropertyId[] }
    | { kind: 'detached' }
  kind: 'primary' | 'custom' | 'hover' | 'pressed'
  transition: TransitionSpec
}

export type TransitionSpec =
  | { kind: 'instant'; delayMs: number }
  | { kind: 'ease'; durationMs: number; easing: string; delayMs: number }
  | { kind: 'spring-time'; durationMs: number; bounce: number; delayMs: number }
  | { kind: 'spring-physics'; stiffness: number; damping: number; mass: number; delayMs: number }

export type InteractionEdge = {
  id: EntityId
  componentId: EntityId
  sourceVariantId: EntityId
  trigger: 'click' | 'click-start' | 'appear' | 'mouse-enter' | 'mouse-leave'
  action: { kind: 'set-variant'; targetVariantId: EntityId }
  repeat: 'once' | 'cycle'
  delayMs: number
  inheritedFromEdgeId: EntityId | null
}

export type InteractionOverride = {
  id: EntityId
  variantId: EntityId
  inheritedEdgeId: EntityId
  disposition: 'suppressed' | 'replaced'
  replacementEdgeId: EntityId | null
}

export type ComponentInstance = {
  id: EntityId
  componentId: EntityId
  source: { storeId: StoreId; file: string; anchor: SourceAnchor }
  variantId: EntityId
}

export type SourceAnchor = {
  version: 1
  fingerprint: Sha256
  exportName: string
  semanticPath: Array<{
    syntaxKind: string
    symbol: string
    keyLiteral: string | null
    staticPropNames: string[]
  }>
  parentFingerprint: Sha256
  siblingSignatureOrdinal: number
  lastKnownLine: number
  lastKnownCol: number
}

export type AssetFolder = {
  id: EntityId
  name: string
  parentId: EntityId | null
  sortKey: string
}
