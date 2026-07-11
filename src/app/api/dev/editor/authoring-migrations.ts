import { createHash } from 'node:crypto'

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
}): ProjectionImportResult {
  const { storeId, projection } = input
  if (projection.compatibility === 'unsupported') {
    return { kind: 'unsupported', reason: projection.unsupportedReason ?? 'unsupported projection' }
  }
  if (projection.compatibility === 'legacy-multi-axis') {
    return { kind: 'hold', compatibility: 'legacy-multi-axis', reason: 'multi-axis source requires explicit conversion preview' }
  }
  const graph = createEmptyAuthoringGraph({ storeId, rootKind: 'project' })
  const componentId = stableId('component', storeId, projection.file, projection.exportName)
  const primaryVariantId = stableId('variant', storeId, projection.file, projection.exportName, 'primary')

  graph.components[componentId] = {
    id: componentId,
    displayName: projection.exportName,
    source: { storeId, file: projection.file, exportName: projection.exportName },
    primaryVariantId,
    folderId: null,
    compatibility: projection.compatibility,
  }
  graph.variants[primaryVariantId] = {
    id: primaryVariantId,
    componentId,
    displayName: 'Primary',
    frame: { x: 0, y: 0, width: 320, height: 180 },
    inheritance: { kind: 'primary' },
    kind: 'primary',
    transition: { kind: 'instant', delayMs: 0 },
  }
  return { kind: 'imported', graph }
}

export function stableId(prefix: string, ...parts: string[]): string {
  return `${prefix}_${createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 16)}`
}
