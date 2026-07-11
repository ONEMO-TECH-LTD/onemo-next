import path from 'node:path'

import type { AuthoringGraphV1, Sha256, SourceAnchor } from './authoring-types'

export type ValidationResult =
  | { ok: true; graph: AuthoringGraphV1 }
  | { ok: false; errors: string[] }

const GRAPH_KEYS = new Set([
  'schemaVersion',
  'storeId',
  'revision',
  'root',
  'sourceHashes',
  'components',
  'variants',
  'sourceProperties',
  'interactions',
  'interactionOverrides',
  'instances',
  'folders',
])

const SHA256_RE = /^[a-f0-9]{64}$/

export function isSha256(value: unknown): value is Sha256 {
  return typeof value === 'string' && SHA256_RE.test(value)
}

export function isStoreRelativePath(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false
  if (path.isAbsolute(value)) return false
  if (value.includes('\\')) return false
  return !value.split('/').some((part) => part === '..' || part === '')
}

export function validateAuthoringGraphV1(input: unknown): ValidationResult {
  const errors: string[] = []
  if (!isRecord(input)) return { ok: false, errors: ['graph must be an object'] }

  for (const key of Object.keys(input)) {
    if (!GRAPH_KEYS.has(key)) errors.push(`unknown top-level key: ${key}`)
  }

  if (input.schemaVersion !== 1) errors.push('schemaVersion must be 1')
  if (!isNonEmptyString(input.storeId)) errors.push('storeId must be a non-empty string')
  if (typeof input.revision !== 'number' || !Number.isSafeInteger(input.revision) || input.revision < 0) {
    errors.push('revision must be a non-negative safe integer')
  }
  if (!isRecord(input.root) || (input.root.kind !== 'project' && input.root.kind !== 'global')) {
    errors.push('root.kind must be project or global')
  }
  if (isRecord(input.root)) {
    for (const key of Object.keys(input.root)) {
      if (key !== 'kind') errors.push(`root cannot persist ${key}`)
    }
  }

  validateHashMap(input.sourceHashes, errors)
  for (const key of ['components', 'variants', 'sourceProperties', 'interactions', 'interactionOverrides', 'instances', 'folders']) {
    if (!isRecord(input[key])) errors.push(`${key} must be an object record`)
  }
  validateGraphReferences(input, errors)
  validateSourcePropertyRefs(input.sourceProperties, errors)

  return errors.length === 0
    ? { ok: true, graph: input as AuthoringGraphV1 }
    : { ok: false, errors }
}

export function assertAuthoringGraphV1(input: unknown): AuthoringGraphV1 {
  const result = validateAuthoringGraphV1(input)
  if (result.ok) return result.graph
  throw Object.assign(new Error(result.errors.join('; ')), { status: 422, code: 'AUTHORING_GRAPH_INVALID' })
}

function validateHashMap(value: unknown, errors: string[]) {
  if (!isRecord(value)) {
    errors.push('sourceHashes must be an object record')
    return
  }
  for (const [file, hash] of Object.entries(value)) {
    if (!isStoreRelativePath(file)) errors.push(`sourceHashes key must be store-relative: ${file}`)
    if (!isSha256(hash)) errors.push(`sourceHashes value must be sha256 for ${file}`)
  }
}

function validateSourcePropertyRefs(value: unknown, errors: string[]) {
  if (!isRecord(value)) return
  for (const [id, ref] of Object.entries(value)) {
    if (!isRecord(ref)) {
      errors.push(`sourceProperties.${id} must be an object`)
      continue
    }
    if (ref.id !== id) errors.push(`sourceProperties.${id}.id must match record key`)
    if (!isNonEmptyString(ref.componentId)) errors.push(`sourceProperties.${id}.componentId is required`)
    if (!isNonEmptyString(ref.variantId)) errors.push(`sourceProperties.${id}.variantId is required`)
    if (!isRecord(ref.source)) {
      errors.push(`sourceProperties.${id}.source is required`)
    } else {
      if (!isNonEmptyString(ref.source.storeId)) errors.push(`sourceProperties.${id}.source.storeId is required`)
      if (!isStoreRelativePath(ref.source.file)) errors.push(`sourceProperties.${id}.source.file must be store-relative`)
      if (!isNonEmptyString(ref.source.exportName)) errors.push(`sourceProperties.${id}.source.exportName is required`)
    }
    validateSourceAnchor(`sourceProperties.${id}.ownerAnchor`, ref.ownerAnchor, errors)
    if (Object.prototype.hasOwnProperty.call(ref, 'value')) {
      errors.push(`sourceProperties.${id} must not persist source-owned values`)
    }
    validatePropertyBinding(id, ref.binding, errors)
  }
}

function validatePropertyBinding(id: string, binding: unknown, errors: string[]) {
  if (!isRecord(binding) || !isNonEmptyString(binding.kind)) {
    errors.push(`sourceProperties.${id}.binding is required`)
    return
  }
  if (binding.kind === 'jsx-prop' && isNonEmptyString(binding.propName)) return
  if (binding.kind === 'inline-style' && isNonEmptyString(binding.property)) return
  if (binding.kind === 'text-content') return
  if (binding.kind === 'module-css') {
    if (
      isRecord(binding.stylesheet) &&
      isNonEmptyString(binding.stylesheet.storeId) &&
      isStoreRelativePath(binding.stylesheet.file) &&
      isNonEmptyString(binding.localClass) &&
      isNonEmptyString(binding.property)
    ) return
  }
  errors.push(`sourceProperties.${id}.binding is invalid`)
}

function validateGraphReferences(graph: Record<string, unknown>, errors: string[]) {
  if (
    !isRecord(graph.components) ||
    !isRecord(graph.variants) ||
    !isRecord(graph.sourceProperties) ||
    !isRecord(graph.interactions) ||
    !isRecord(graph.interactionOverrides) ||
    !isRecord(graph.instances)
  ) return

  for (const [componentId, component] of Object.entries(graph.components)) {
    if (!isRecord(component)) continue
    if (component.id !== componentId) errors.push(`components.${componentId}.id must match record key`)
    if (!isNonEmptyString(component.displayName)) errors.push(`components.${componentId}.displayName is required`)
    if (!isRecord(component.source)) errors.push(`components.${componentId}.source is required`)
    else {
      if (!isNonEmptyString(component.source.storeId)) errors.push(`components.${componentId}.source.storeId is required`)
      if (!isStoreRelativePath(component.source.file)) errors.push(`components.${componentId}.source.file must be store-relative`)
      if (!isNonEmptyString(component.source.exportName)) errors.push(`components.${componentId}.source.exportName is required`)
    }
    if (!isNonEmptyString(component.primaryVariantId)) {
      errors.push(`components.${componentId}.primaryVariantId is required`)
    } else {
      const primary = graph.variants[component.primaryVariantId]
      if (!isRecord(primary)) errors.push(`components.${componentId}.primaryVariantId missing variant: ${component.primaryVariantId}`)
      else if (primary.componentId !== componentId) errors.push(`components.${componentId}.primaryVariantId points to another component`)
    }
  }

  const primaryCounts: Record<string, number> = {}
  for (const [variantId, variant] of Object.entries(graph.variants)) {
    if (!isRecord(variant)) continue
    if (variant.id !== variantId) errors.push(`variants.${variantId}.id must match record key`)
    if (!isNonEmptyString(variant.componentId) || !isRecord(graph.components[variant.componentId])) {
      errors.push(`variants.${variantId}.componentId missing component: ${String(variant.componentId)}`)
    }
    if (isRecord(variant.inheritance) && variant.inheritance.kind === 'primary' && isNonEmptyString(variant.componentId)) {
      primaryCounts[variant.componentId] = (primaryCounts[variant.componentId] ?? 0) + 1
    }
    if (isRecord(variant.inheritance) && variant.inheritance.kind === 'linked') {
      if (!isNonEmptyString(variant.inheritance.primaryVariantId) || !isRecord(graph.variants[variant.inheritance.primaryVariantId])) {
        errors.push(`variants.${variantId}.inheritance.primaryVariantId missing variant: ${String(variant.inheritance.primaryVariantId)}`)
      }
      if (!Array.isArray(variant.inheritance.overridePropertyIds)) {
        errors.push(`variants.${variantId}.inheritance.overridePropertyIds must be an array`)
      } else {
        for (const propertyId of variant.inheritance.overridePropertyIds) {
          if (!isNonEmptyString(propertyId) || !isRecord(graph.sourceProperties[propertyId])) {
            errors.push(`variants.${variantId}.inheritance.overridePropertyIds missing property: ${String(propertyId)}`)
          }
        }
      }
    }
  }
  for (const componentId of Object.keys(graph.components)) {
    if ((primaryCounts[componentId] ?? 0) !== 1) {
      errors.push(`components.${componentId} must have exactly one primary variant`)
    }
  }

  for (const [propertyId, property] of Object.entries(graph.sourceProperties)) {
    if (!isRecord(property)) continue
    if (!isNonEmptyString(property.componentId) || !isRecord(graph.components[property.componentId])) {
      errors.push(`sourceProperties.${propertyId}.componentId missing component: ${String(property.componentId)}`)
    }
    if (!isNonEmptyString(property.variantId) || !isRecord(graph.variants[property.variantId])) {
      errors.push(`sourceProperties.${propertyId}.variantId missing variant: ${String(property.variantId)}`)
    }
    if (isNonEmptyString(property.variantId)) {
      const variant = graph.variants[property.variantId]
      if (isRecord(variant) && variant.componentId !== property.componentId) {
        errors.push(`sourceProperties.${propertyId}.variantId belongs to another component`)
      }
    }
    if (property.inheritedFromPropertyId !== null && property.inheritedFromPropertyId !== undefined && !isRecord(graph.sourceProperties[property.inheritedFromPropertyId as string])) {
      errors.push(`sourceProperties.${propertyId}.inheritedFromPropertyId missing property: ${String(property.inheritedFromPropertyId)}`)
    }
  }

  for (const [interactionId, interaction] of Object.entries(graph.interactions)) {
    if (!isRecord(interaction)) continue
    if (interaction.id !== interactionId) errors.push(`interactions.${interactionId}.id must match record key`)
    if (!isNonEmptyString(interaction.componentId) || !isRecord(graph.components[interaction.componentId])) {
      errors.push(`interactions.${interactionId}.componentId missing component: ${String(interaction.componentId)}`)
    }
    if (!isNonEmptyString(interaction.sourceVariantId) || !isRecord(graph.variants[interaction.sourceVariantId])) {
      errors.push(`interactions.${interactionId}.sourceVariantId missing variant: ${String(interaction.sourceVariantId)}`)
    }
    if (!isRecord(interaction.action) || interaction.action.kind !== 'set-variant' || !isRecord(graph.variants[interaction.action.targetVariantId as string])) {
      errors.push(`interactions.${interactionId}.action.targetVariantId missing variant: ${isRecord(interaction.action) ? String(interaction.action.targetVariantId) : 'undefined'}`)
    }
    if (interaction.inheritedFromEdgeId !== null && interaction.inheritedFromEdgeId !== undefined && !isRecord(graph.interactions[interaction.inheritedFromEdgeId as string])) {
      errors.push(`interactions.${interactionId}.inheritedFromEdgeId missing interaction: ${String(interaction.inheritedFromEdgeId)}`)
    }
  }

  for (const [overrideId, override] of Object.entries(graph.interactionOverrides)) {
    if (!isRecord(override)) continue
    if (override.id !== overrideId) errors.push(`interactionOverrides.${overrideId}.id must match record key`)
    if (!isNonEmptyString(override.variantId) || !isRecord(graph.variants[override.variantId])) {
      errors.push(`interactionOverrides.${overrideId}.variantId missing variant: ${String(override.variantId)}`)
    }
    if (!isNonEmptyString(override.inheritedEdgeId) || !isRecord(graph.interactions[override.inheritedEdgeId])) {
      errors.push(`interactionOverrides.${overrideId}.inheritedEdgeId missing interaction: ${String(override.inheritedEdgeId)}`)
    }
    if (override.replacementEdgeId !== null && override.replacementEdgeId !== undefined && !isRecord(graph.interactions[override.replacementEdgeId as string])) {
      errors.push(`interactionOverrides.${overrideId}.replacementEdgeId missing interaction: ${String(override.replacementEdgeId)}`)
    }
  }

  for (const [instanceId, instance] of Object.entries(graph.instances)) {
    if (!isRecord(instance)) continue
    if (instance.id !== instanceId) errors.push(`instances.${instanceId}.id must match record key`)
    if (!isNonEmptyString(instance.componentId) || !isRecord(graph.components[instance.componentId])) {
      errors.push(`instances.${instanceId}.componentId missing component: ${String(instance.componentId)}`)
    }
    if (!isNonEmptyString(instance.variantId) || !isRecord(graph.variants[instance.variantId])) {
      errors.push(`instances.${instanceId}.variantId missing variant: ${String(instance.variantId)}`)
    }
    if (!isRecord(instance.source)) errors.push(`instances.${instanceId}.source is required`)
    else {
      if (!isNonEmptyString(instance.source.storeId)) errors.push(`instances.${instanceId}.source.storeId is required`)
      if (!isStoreRelativePath(instance.source.file)) errors.push(`instances.${instanceId}.source.file must be store-relative`)
      validateSourceAnchor(`instances.${instanceId}.source.anchor`, instance.source.anchor, errors)
    }
  }
}

function validateSourceAnchor(label: string, anchor: unknown, errors: string[]) {
  if (!isRecord(anchor)) {
    errors.push(`${label} is required`)
    return
  }
  const typed = anchor as Partial<SourceAnchor>
  if (typed.version !== 1) errors.push(`${label}.version must be 1`)
  if (!isSha256(typed.fingerprint)) errors.push(`${label}.fingerprint must be sha256`)
  if (!isNonEmptyString(typed.exportName)) errors.push(`${label}.exportName is required`)
  if (!Array.isArray(typed.semanticPath)) errors.push(`${label}.semanticPath must be an array`)
  if (!isSha256(typed.parentFingerprint)) errors.push(`${label}.parentFingerprint must be sha256`)
  if (typeof typed.siblingSignatureOrdinal !== 'number' || !Number.isSafeInteger(typed.siblingSignatureOrdinal) || typed.siblingSignatureOrdinal < 0) {
    errors.push(`${label}.siblingSignatureOrdinal must be a non-negative safe integer`)
  }
  if (typeof typed.lastKnownLine !== 'number' || !Number.isSafeInteger(typed.lastKnownLine) || typed.lastKnownLine < 1) {
    errors.push(`${label}.lastKnownLine must be positive`)
  }
  if (typeof typed.lastKnownCol !== 'number' || !Number.isSafeInteger(typed.lastKnownCol) || typed.lastKnownCol < 1) {
    errors.push(`${label}.lastKnownCol must be positive`)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}
