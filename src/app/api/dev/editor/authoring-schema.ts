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
  return !value.split('/').some((part) => part === '.' || part === '..' || part === '')
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
  validateGraphEntities(input, errors)
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
    validateExactKeys(`sourceProperties.${id}`, ref, [
      'id', 'componentId', 'variantId', 'source', 'ownerAnchor', 'inheritedFromPropertyId', 'binding',
    ], errors)
    if (ref.id !== id) errors.push(`sourceProperties.${id}.id must match record key`)
    if (!isNonEmptyString(ref.componentId)) errors.push(`sourceProperties.${id}.componentId is required`)
    if (!isNonEmptyString(ref.variantId)) errors.push(`sourceProperties.${id}.variantId is required`)
    if (!isRecord(ref.source)) {
      errors.push(`sourceProperties.${id}.source is required`)
    } else {
      validateExactKeys(`sourceProperties.${id}.source`, ref.source, ['storeId', 'file', 'exportName'], errors)
      if (!isNonEmptyString(ref.source.storeId)) errors.push(`sourceProperties.${id}.source.storeId is required`)
      if (!isStoreRelativePath(ref.source.file)) errors.push(`sourceProperties.${id}.source.file must be store-relative`)
      if (!isNonEmptyString(ref.source.exportName)) errors.push(`sourceProperties.${id}.source.exportName is required`)
    }
    validateSourceAnchor(`sourceProperties.${id}.ownerAnchor`, ref.ownerAnchor, errors)
    if (
      isRecord(ref.source) &&
      isNonEmptyString(ref.source.exportName) &&
      isRecord(ref.ownerAnchor) &&
      isNonEmptyString(ref.ownerAnchor.exportName) &&
      ref.ownerAnchor.exportName !== ref.source.exportName
    ) {
      errors.push(`sourceProperties.${id}.ownerAnchor.exportName must match source.exportName`)
    }
    if (ref.inheritedFromPropertyId !== null && !isNonEmptyString(ref.inheritedFromPropertyId)) {
      errors.push(`sourceProperties.${id}.inheritedFromPropertyId must be null or a non-empty string`)
    }
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
  if (binding.kind === 'jsx-prop' && isNonEmptyString(binding.propName)) {
    validateExactKeys(`sourceProperties.${id}.binding`, binding, ['kind', 'propName'], errors)
    return
  }
  if (binding.kind === 'inline-style' && isNonEmptyString(binding.property)) {
    validateExactKeys(`sourceProperties.${id}.binding`, binding, ['kind', 'property'], errors)
    return
  }
  if (binding.kind === 'text-content') {
    validateExactKeys(`sourceProperties.${id}.binding`, binding, ['kind'], errors)
    return
  }
  if (binding.kind === 'module-css') {
    if (
      isRecord(binding.stylesheet) &&
      isNonEmptyString(binding.stylesheet.storeId) &&
      isStoreRelativePath(binding.stylesheet.file) &&
      isNonEmptyString(binding.localClass) &&
      isNonEmptyString(binding.property)
    ) {
      validateExactKeys(`sourceProperties.${id}.binding`, binding, ['kind', 'stylesheet', 'localClass', 'property'], errors)
      validateExactKeys(`sourceProperties.${id}.binding.stylesheet`, binding.stylesheet, ['storeId', 'file'], errors)
      return
    }
  }
  errors.push(`sourceProperties.${id}.binding is invalid`)
}

function validateGraphEntities(graph: Record<string, unknown>, errors: string[]) {
  validateComponents(graph.components, errors)
  validateVariants(graph.variants, errors)
  validateInteractions(graph.interactions, errors)
  validateInteractionOverrides(graph.interactionOverrides, errors)
  validateInstances(graph.instances, errors)
  validateFolders(graph.folders, errors)
}

function validateComponents(value: unknown, errors: string[]) {
  if (!isRecord(value)) return
  const compatibility = new Set(['native-v1', 'legacy-single-axis', 'legacy-multi-axis', 'unsupported'])
  for (const [id, component] of Object.entries(value)) {
    if (!isRecord(component)) {
      errors.push(`components.${id} must be an object`)
      continue
    }
    validateExactKeys(`components.${id}`, component, ['id', 'displayName', 'source', 'primaryVariantId', 'folderId', 'compatibility'], errors)
    if (!isNonEmptyString(component.displayName)) errors.push(`components.${id}.displayName must be a non-empty string`)
    validateSourceRef(`components.${id}.source`, component.source, errors)
    if (!isNonEmptyString(component.primaryVariantId)) errors.push(`components.${id}.primaryVariantId must be a non-empty string`)
    if (component.folderId !== null && !isNonEmptyString(component.folderId)) errors.push(`components.${id}.folderId must be null or a non-empty string`)
    if (!compatibility.has(String(component.compatibility))) errors.push(`components.${id}.compatibility is invalid`)
  }
}

function validateVariants(value: unknown, errors: string[]) {
  if (!isRecord(value)) return
  const kinds = new Set(['primary', 'custom', 'hover', 'pressed'])
  for (const [id, variant] of Object.entries(value)) {
    if (!isRecord(variant)) {
      errors.push(`variants.${id} must be an object`)
      continue
    }
    validateExactKeys(`variants.${id}`, variant, ['id', 'componentId', 'displayName', 'frame', 'inheritance', 'kind', 'transition'], errors)
    if (!isNonEmptyString(variant.displayName)) errors.push(`variants.${id}.displayName must be a non-empty string`)
    if (!kinds.has(String(variant.kind))) errors.push(`variants.${id}.kind is invalid`)
    validateFrame(`variants.${id}.frame`, variant.frame, errors)
    validateInheritance(`variants.${id}.inheritance`, variant.inheritance, errors)
    validateTransition(`variants.${id}.transition`, variant.transition, errors)
  }
}

function validateFrame(label: string, value: unknown, errors: string[]) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object`)
    return
  }
  validateExactKeys(label, value, ['x', 'y', 'width', 'height'], errors)
  if (!isFiniteNumber(value.x)) errors.push(`${label}.x must be finite`)
  if (!isFiniteNumber(value.y)) errors.push(`${label}.y must be finite`)
  if (!isPositiveFiniteNumber(value.width)) errors.push(`${label}.width must be positive and finite`)
  if (!isPositiveFiniteNumber(value.height)) errors.push(`${label}.height must be positive and finite`)
}

function validateInheritance(label: string, value: unknown, errors: string[]) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object`)
    return
  }
  if (value.kind === 'primary' || value.kind === 'detached') {
    validateExactKeys(label, value, ['kind'], errors)
    return
  }
  if (value.kind === 'linked') {
    validateExactKeys(label, value, ['kind', 'primaryVariantId', 'overridePropertyIds'], errors)
    if (!isNonEmptyString(value.primaryVariantId)) errors.push(`${label}.primaryVariantId must be a non-empty string`)
    if (!Array.isArray(value.overridePropertyIds) || value.overridePropertyIds.some((id) => !isNonEmptyString(id))) {
      errors.push(`${label}.overridePropertyIds must be an array of non-empty strings`)
    } else if (new Set(value.overridePropertyIds).size !== value.overridePropertyIds.length) {
      errors.push(`${label}.overridePropertyIds must not contain duplicates`)
    }
    return
  }
  errors.push(`${label}.kind is invalid`)
}

function validateTransition(label: string, value: unknown, errors: string[]) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object`)
    return
  }
  if (value.kind === 'instant') {
    validateExactKeys(label, value, ['kind', 'delayMs'], errors)
    validateNonNegativeNumber(`${label}.delayMs`, value.delayMs, errors)
  } else if (value.kind === 'ease') {
    validateExactKeys(label, value, ['kind', 'durationMs', 'easing', 'delayMs'], errors)
    validateNonNegativeNumber(`${label}.durationMs`, value.durationMs, errors)
    if (!isNonEmptyString(value.easing)) errors.push(`${label}.easing must be a non-empty string`)
    validateNonNegativeNumber(`${label}.delayMs`, value.delayMs, errors)
  } else if (value.kind === 'spring-time') {
    validateExactKeys(label, value, ['kind', 'durationMs', 'bounce', 'delayMs'], errors)
    validateNonNegativeNumber(`${label}.durationMs`, value.durationMs, errors)
    validateNonNegativeNumber(`${label}.bounce`, value.bounce, errors)
    validateNonNegativeNumber(`${label}.delayMs`, value.delayMs, errors)
  } else if (value.kind === 'spring-physics') {
    validateExactKeys(label, value, ['kind', 'stiffness', 'damping', 'mass', 'delayMs'], errors)
    validatePositiveNumber(`${label}.stiffness`, value.stiffness, errors)
    validateNonNegativeNumber(`${label}.damping`, value.damping, errors)
    validatePositiveNumber(`${label}.mass`, value.mass, errors)
    validateNonNegativeNumber(`${label}.delayMs`, value.delayMs, errors)
  } else {
    errors.push(`${label}.kind is invalid`)
  }
}

function validateInteractions(value: unknown, errors: string[]) {
  if (!isRecord(value)) return
  const triggers = new Set(['click', 'click-start', 'appear', 'mouse-enter', 'mouse-leave'])
  for (const [id, interaction] of Object.entries(value)) {
    if (!isRecord(interaction)) {
      errors.push(`interactions.${id} must be an object`)
      continue
    }
    validateExactKeys(`interactions.${id}`, interaction, ['id', 'componentId', 'sourceVariantId', 'trigger', 'action', 'repeat', 'delayMs', 'inheritedFromEdgeId'], errors)
    if (!triggers.has(String(interaction.trigger))) errors.push(`interactions.${id}.trigger is invalid`)
    if (interaction.repeat !== 'once' && interaction.repeat !== 'cycle') errors.push(`interactions.${id}.repeat is invalid`)
    validateNonNegativeNumber(`interactions.${id}.delayMs`, interaction.delayMs, errors)
    if (interaction.inheritedFromEdgeId !== null && !isNonEmptyString(interaction.inheritedFromEdgeId)) {
      errors.push(`interactions.${id}.inheritedFromEdgeId must be null or a non-empty string`)
    }
    if (!isRecord(interaction.action)) errors.push(`interactions.${id}.action must be an object`)
    else {
      validateExactKeys(`interactions.${id}.action`, interaction.action, ['kind', 'targetVariantId'], errors)
      if (interaction.action.kind !== 'set-variant') errors.push(`interactions.${id}.action.kind must be set-variant`)
      if (!isNonEmptyString(interaction.action.targetVariantId)) errors.push(`interactions.${id}.action.targetVariantId must be a non-empty string`)
    }
  }
}

function validateInteractionOverrides(value: unknown, errors: string[]) {
  if (!isRecord(value)) return
  for (const [id, override] of Object.entries(value)) {
    if (!isRecord(override)) {
      errors.push(`interactionOverrides.${id} must be an object`)
      continue
    }
    validateExactKeys(`interactionOverrides.${id}`, override, ['id', 'variantId', 'inheritedEdgeId', 'disposition', 'replacementEdgeId'], errors)
    if (override.disposition !== 'suppressed' && override.disposition !== 'replaced') errors.push(`interactionOverrides.${id}.disposition is invalid`)
    if (override.replacementEdgeId !== null && !isNonEmptyString(override.replacementEdgeId)) errors.push(`interactionOverrides.${id}.replacementEdgeId must be null or a non-empty string`)
    if (override.disposition === 'suppressed' && override.replacementEdgeId !== null) errors.push(`interactionOverrides.${id}.suppressed override cannot have replacementEdgeId`)
    if (override.disposition === 'replaced' && !isNonEmptyString(override.replacementEdgeId)) errors.push(`interactionOverrides.${id}.replaced override requires replacementEdgeId`)
  }
}

function validateInstances(value: unknown, errors: string[]) {
  if (!isRecord(value)) return
  for (const [id, instance] of Object.entries(value)) {
    if (!isRecord(instance)) {
      errors.push(`instances.${id} must be an object`)
      continue
    }
    validateExactKeys(`instances.${id}`, instance, ['id', 'componentId', 'source', 'variantId'], errors)
    if (isRecord(instance.source)) {
      validateExactKeys(`instances.${id}.source`, instance.source, ['storeId', 'file', 'anchor'], errors)
    }
  }
}

function validateFolders(value: unknown, errors: string[]) {
  if (!isRecord(value)) return
  for (const [id, folder] of Object.entries(value)) {
    if (!isRecord(folder)) {
      errors.push(`folders.${id} must be an object`)
      continue
    }
    validateExactKeys(`folders.${id}`, folder, ['id', 'name', 'parentId', 'sortKey'], errors)
    if (folder.id !== id) errors.push(`folders.${id}.id must match record key`)
    if (!isNonEmptyString(folder.name)) errors.push(`folders.${id}.name must be a non-empty string`)
    if (folder.parentId !== null && !isNonEmptyString(folder.parentId)) errors.push(`folders.${id}.parentId must be null or a non-empty string`)
    if (!isNonEmptyString(folder.sortKey)) errors.push(`folders.${id}.sortKey must be a non-empty string`)
  }
}

function validateSourceRef(label: string, value: unknown, errors: string[]) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object`)
    return
  }
  validateExactKeys(label, value, ['storeId', 'file', 'exportName'], errors)
  if (!isNonEmptyString(value.storeId)) errors.push(`${label}.storeId must be a non-empty string`)
  if (!isStoreRelativePath(value.file)) errors.push(`${label}.file must be store-relative`)
  if (!isNonEmptyString(value.exportName)) errors.push(`${label}.exportName must be a non-empty string`)
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
      if (
        isStoreRelativePath(component.source.file) &&
        (!isRecord(graph.sourceHashes) || !isSha256(graph.sourceHashes[component.source.file]))
      ) {
        errors.push(`components.${componentId}.source.file missing source hash: ${component.source.file}`)
      }
    }
    if (!isNonEmptyString(component.primaryVariantId)) {
      errors.push(`components.${componentId}.primaryVariantId is required`)
    } else {
      const primary = graph.variants[component.primaryVariantId]
      if (!isRecord(primary)) errors.push(`components.${componentId}.primaryVariantId missing variant: ${component.primaryVariantId}`)
      else if (primary.componentId !== componentId) errors.push(`components.${componentId}.primaryVariantId points to another component`)
      else if (!isRecord(primary.inheritance) || primary.inheritance.kind !== 'primary' || primary.kind !== 'primary') {
        errors.push(`components.${componentId}.primaryVariantId must point to the primary variant`)
      }
    }
    if (component.folderId !== null && component.folderId !== undefined && (!isRecord(graph.folders) || !isRecord(graph.folders[component.folderId as string]))) {
      errors.push(`components.${componentId}.folderId missing folder: ${String(component.folderId)}`)
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
    if (isRecord(variant.inheritance) && ((variant.inheritance.kind === 'primary') !== (variant.kind === 'primary'))) {
      errors.push(`variants.${variantId}.kind and inheritance.kind must agree on primary identity`)
    }
    if (isRecord(variant.inheritance) && variant.inheritance.kind === 'linked') {
      if (!isNonEmptyString(variant.inheritance.primaryVariantId) || !isRecord(graph.variants[variant.inheritance.primaryVariantId])) {
        errors.push(`variants.${variantId}.inheritance.primaryVariantId missing variant: ${String(variant.inheritance.primaryVariantId)}`)
      }
      const linkedPrimary = isNonEmptyString(variant.inheritance.primaryVariantId)
        ? graph.variants[variant.inheritance.primaryVariantId]
        : null
      if (isRecord(linkedPrimary) && (linkedPrimary.componentId !== variant.componentId || !isRecord(linkedPrimary.inheritance) || linkedPrimary.inheritance.kind !== 'primary')) {
        errors.push(`variants.${variantId}.inheritance.primaryVariantId must reference its component primary`)
      }
      if (!Array.isArray(variant.inheritance.overridePropertyIds)) {
        errors.push(`variants.${variantId}.inheritance.overridePropertyIds must be an array`)
      } else {
        for (const propertyId of variant.inheritance.overridePropertyIds) {
          if (!isNonEmptyString(propertyId) || !isRecord(graph.sourceProperties[propertyId])) {
            errors.push(`variants.${variantId}.inheritance.overridePropertyIds missing property: ${String(propertyId)}`)
          } else if ((graph.sourceProperties[propertyId] as Record<string, unknown>).variantId !== variantId) {
            errors.push(`variants.${variantId}.inheritance.overridePropertyIds property belongs to another variant: ${propertyId}`)
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
    if (isNonEmptyString(property.componentId) && isRecord(property.source)) {
      const component = graph.components[property.componentId]
      if (isRecord(component) && isRecord(component.source) && (
        property.source.storeId !== component.source.storeId ||
        property.source.file !== component.source.file ||
        property.source.exportName !== component.source.exportName
      )) {
        errors.push(`sourceProperties.${propertyId}.source must match its component source`)
      }
    }
    if (property.inheritedFromPropertyId !== null && property.inheritedFromPropertyId !== undefined && !isRecord(graph.sourceProperties[property.inheritedFromPropertyId as string])) {
      errors.push(`sourceProperties.${propertyId}.inheritedFromPropertyId missing property: ${String(property.inheritedFromPropertyId)}`)
    } else if (isNonEmptyString(property.inheritedFromPropertyId)) {
      const inherited = graph.sourceProperties[property.inheritedFromPropertyId]
      if (isRecord(inherited) && inherited.componentId !== property.componentId) {
        errors.push(`sourceProperties.${propertyId}.inheritedFromPropertyId belongs to another component`)
      } else if (isRecord(inherited) && isNonEmptyString(property.componentId)) {
        const component = graph.components[property.componentId]
        if (isRecord(component) && inherited.variantId !== component.primaryVariantId) {
          errors.push(`sourceProperties.${propertyId}.inheritedFromPropertyId must reference a primary property`)
        }
        if (!propertyBindingsMatch(property.binding, inherited.binding)) {
          errors.push(`sourceProperties.${propertyId}.inheritedFromPropertyId must reference a matching typed binding`)
        }
      }
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
    const sourceVariant = isNonEmptyString(interaction.sourceVariantId) ? graph.variants[interaction.sourceVariantId] : null
    const targetVariant = isRecord(interaction.action) && isNonEmptyString(interaction.action.targetVariantId)
      ? graph.variants[interaction.action.targetVariantId]
      : null
    if (isRecord(sourceVariant) && sourceVariant.componentId !== interaction.componentId) errors.push(`interactions.${interactionId}.sourceVariantId belongs to another component`)
    if (isRecord(targetVariant) && targetVariant.componentId !== interaction.componentId) errors.push(`interactions.${interactionId}.action.targetVariantId belongs to another component`)
    if (interaction.inheritedFromEdgeId !== null && interaction.inheritedFromEdgeId !== undefined && !isRecord(graph.interactions[interaction.inheritedFromEdgeId as string])) {
      errors.push(`interactions.${interactionId}.inheritedFromEdgeId missing interaction: ${String(interaction.inheritedFromEdgeId)}`)
    } else if (isNonEmptyString(interaction.inheritedFromEdgeId)) {
      const inherited = graph.interactions[interaction.inheritedFromEdgeId]
      if (isRecord(inherited) && inherited.componentId !== interaction.componentId) errors.push(`interactions.${interactionId}.inheritedFromEdgeId belongs to another component`)
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
    const variant = isNonEmptyString(override.variantId) ? graph.variants[override.variantId] : null
    const inherited = isNonEmptyString(override.inheritedEdgeId) ? graph.interactions[override.inheritedEdgeId] : null
    const replacement = isNonEmptyString(override.replacementEdgeId) ? graph.interactions[override.replacementEdgeId] : null
    if (isRecord(variant) && isRecord(inherited) && inherited.componentId !== variant.componentId) errors.push(`interactionOverrides.${overrideId}.inheritedEdgeId belongs to another component`)
    if (isRecord(variant) && isRecord(replacement) && replacement.componentId !== variant.componentId) errors.push(`interactionOverrides.${overrideId}.replacementEdgeId belongs to another component`)
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
    if (isNonEmptyString(instance.variantId) && isNonEmptyString(instance.componentId)) {
      const variant = graph.variants[instance.variantId]
      if (isRecord(variant) && variant.componentId !== instance.componentId) errors.push(`instances.${instanceId}.variantId belongs to another component`)
    }
  }
  validateFolderReferencesAndCycles(graph.folders, errors)
}

function validateSourceAnchor(label: string, anchor: unknown, errors: string[]) {
  if (!isRecord(anchor)) {
    errors.push(`${label} is required`)
    return
  }
  validateExactKeys(label, anchor, [
    'version', 'fingerprint', 'exportName', 'semanticPath', 'parentFingerprint',
    'siblingSignatureOrdinal', 'lastKnownLine', 'lastKnownCol',
  ], errors)
  const typed = anchor as Partial<SourceAnchor>
  if (typed.version !== 1) errors.push(`${label}.version must be 1`)
  if (!isSha256(typed.fingerprint)) errors.push(`${label}.fingerprint must be sha256`)
  if (!isNonEmptyString(typed.exportName)) errors.push(`${label}.exportName is required`)
  if (!Array.isArray(typed.semanticPath)) errors.push(`${label}.semanticPath must be an array`)
  else {
    typed.semanticPath.forEach((part, index) => {
      const partLabel = `${label}.semanticPath.${index}`
      if (!isRecord(part)) {
        errors.push(`${partLabel} must be an object`)
        return
      }
      validateExactKeys(partLabel, part, ['syntaxKind', 'symbol', 'keyLiteral', 'staticPropNames'], errors)
      if (!isNonEmptyString(part.syntaxKind)) errors.push(`${partLabel}.syntaxKind must be a non-empty string`)
      if (!isNonEmptyString(part.symbol)) errors.push(`${partLabel}.symbol must be a non-empty string`)
      if (part.keyLiteral !== null && typeof part.keyLiteral !== 'string') errors.push(`${partLabel}.keyLiteral must be null or a string`)
      if (!Array.isArray(part.staticPropNames) || part.staticPropNames.some((name) => !isNonEmptyString(name))) {
        errors.push(`${partLabel}.staticPropNames must be an array of non-empty strings`)
      }
    })
  }
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

function validateFolderReferencesAndCycles(value: unknown, errors: string[]) {
  if (!isRecord(value)) return
  for (const [id, folder] of Object.entries(value)) {
    if (!isRecord(folder) || folder.parentId === null || folder.parentId === undefined) continue
    if (!isNonEmptyString(folder.parentId) || !isRecord(value[folder.parentId])) {
      errors.push(`folders.${id}.parentId missing folder: ${String(folder.parentId)}`)
    }
  }
  const completed = new Set<string>()
  for (const id of Object.keys(value)) {
    if (completed.has(id)) continue
    const visited = new Set<string>()
    let current: string | null = id
    while (current !== null) {
      if (visited.has(current)) {
        errors.push(`folders contain a parent cycle at ${current}`)
        break
      }
      if (completed.has(current)) break
      visited.add(current)
      const folder: unknown = value[current]
      if (!isRecord(folder) || folder.parentId === null || !isNonEmptyString(folder.parentId)) break
      current = folder.parentId
    }
    for (const item of visited) completed.add(item)
  }
}

function validateExactKeys(label: string, value: Record<string, unknown>, allowed: string[], errors: string[]) {
  const allowedSet = new Set(allowed)
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) errors.push(`${label} contains unknown key: ${key}`)
  }
}

function propertyBindingsMatch(left: unknown, right: unknown): boolean {
  if (!isRecord(left) || !isRecord(right) || left.kind !== right.kind) return false
  if (left.kind === 'text-content') return true
  if (left.kind === 'jsx-prop') return left.propName === right.propName
  if (left.kind === 'inline-style') return left.property === right.property
  if (left.kind !== 'module-css' || !isRecord(left.stylesheet) || !isRecord(right.stylesheet)) return false
  return left.stylesheet.storeId === right.stylesheet.storeId &&
    left.stylesheet.file === right.stylesheet.file &&
    left.localClass === right.localClass &&
    left.property === right.property
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0
}

function validateNonNegativeNumber(label: string, value: unknown, errors: string[]) {
  if (!isFiniteNumber(value) || value < 0) errors.push(`${label} must be non-negative and finite`)
}

function validatePositiveNumber(label: string, value: unknown, errors: string[]) {
  if (!isPositiveFiniteNumber(value)) errors.push(`${label} must be positive and finite`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}
