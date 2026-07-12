import { createHash } from 'node:crypto'

import { assertAuthoringGraphV1, isSha256 } from './authoring-schema'
import type { AuthoringGraphV1, StoreId } from './authoring-types'
import { createEmptyAuthoringGraph } from './authoring-store'
import type { SourceProjection } from './source-projection'

export type ProjectionImportResult =
  | { kind: 'imported'; graph: AuthoringGraphV1 }
  | { kind: 'hold'; compatibility: 'legacy-multi-axis'; reason: string }
  | { kind: 'unsupported'; reason: string }

export function importProjectionToAuthoringGraph(input: {
  storeId: StoreId
  projection: SourceProjection
  sourceHashes: Record<string, string>
  environmentFingerprint: string
}): ProjectionImportResult {
  const { storeId, projection, sourceHashes, environmentFingerprint } = input
  if (projection.compatibility === 'unsupported') {
    return { kind: 'unsupported', reason: projection.unsupportedReason ?? 'unsupported projection' }
  }
  if (projection.compatibility === 'legacy-multi-axis') {
    if (projection.variantAxes.length < 2) {
      return { kind: 'unsupported', reason: 'multi-axis compatibility does not match source axes' }
    }
    return { kind: 'hold', compatibility: 'legacy-multi-axis', reason: 'multi-axis source requires explicit conversion preview' }
  }
  if (!isSha256(sourceHashes[projection.file]) || Object.values(sourceHashes).some((hash) => !isSha256(hash)) || !isSha256(environmentFingerprint)) {
    return { kind: 'unsupported', reason: 'exact source hashes are required for import' }
  }
  const values = importableVariantValues(projection)
  if (!values) return { kind: 'unsupported', reason: 'single-axis source is not losslessly importable' }
  const graph = createEmptyAuthoringGraph({
    storeId,
    rootKind: 'project',
    sourceHashes,
    environmentFingerprint,
  })
  const componentId = stableId('component', storeId, projection.file, projection.exportName)
  const variantIds = values.map((_, index) =>
    stableId('variant', storeId, projection.file, projection.exportName, 'source-slot', String(index)))
  const primaryIndex = projection.variantAxes[0]
    ? projection.variantAxes[0].values.indexOf(projection.variantAxes[0].defaultValue)
    : 0
  const primaryVariantId = variantIds[primaryIndex]!

  graph.components[componentId] = {
    id: componentId,
    displayName: projection.exportName,
    source: { storeId, file: projection.file, exportName: projection.exportName },
    primaryVariantId,
    folderId: null,
    compatibility: projection.compatibility,
  }
  for (const [index, displayName] of values.entries()) {
    const id = variantIds[index]!
    const primary = index === primaryIndex
    graph.variants[id] = {
      id,
      componentId,
      displayName,
      frame: { x: index * 344, y: 0, width: 320, height: 180 },
      inheritance: primary
        ? { kind: 'primary' }
        : { kind: 'linked', primaryVariantId, overridePropertyIds: [] },
      kind: primary ? 'primary' : 'custom',
      transition: { kind: 'instant', delayMs: 0 },
    }
  }
  return { kind: 'imported', graph: assertAuthoringGraphV1(graph) }
}

function importableVariantValues(projection: SourceProjection): string[] | null {
  if (projection.compatibility === 'native-v1') return projection.variantAxes.length === 0 ? ['Primary'] : null
  if (projection.compatibility !== 'legacy-single-axis' || projection.variantAxes.length !== 1) return null
  const axis = projection.variantAxes[0]
  if (!axis || axis.values.length === 0 || new Set(axis.values).size !== axis.values.length) return null
  if (axis.values.some((value) => value.length === 0) || !axis.values.includes(axis.defaultValue)) return null
  return axis.values
}

export function stableId(prefix: string, ...parts: string[]): string {
  return `${prefix}_${createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 16)}`
}
