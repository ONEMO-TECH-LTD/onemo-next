import type { SourceAnchor } from '@/app/api/dev/editor/authoring-types'
import type { SourceProjection } from '@/app/api/dev/editor/source-projection'

export type SourceContentLayer = {
  id: string
  tag: string
  name: string
  source: {
    file: string
    exportName: string
    anchor: SourceAnchor
  }
  children: SourceContentLayer[]
}

export type RuntimeContentProvenance = {
  provenance: string | null
  tag: string
}

export type SourceContentBinding =
  | { kind: 'bound'; layer: SourceContentLayer }
  | {
    kind: 'refused'
    code:
      | 'SOURCE_CONTENT_PROVENANCE_MISSING'
      | 'SOURCE_CONTENT_PROVENANCE_UNOWNED'
      | 'SOURCE_CONTENT_PROVENANCE_AMBIGUOUS'
      | 'SOURCE_CONTENT_PROVENANCE_TAG_MISMATCH'
  }

export function sourceContentLayerId(anchor: SourceAnchor): string {
  return `${anchor.fingerprint}:${anchor.siblingSignatureOrdinal}`
}

export function sourceContentLayers(projection: SourceProjection): SourceContentLayer[] {
  if (!projection.structure) return []
  const anchorsByPosition = new Map<string, SourceAnchor[]>()
  for (const anchor of projection.anchors) {
    const key = positionKey(anchor.lastKnownLine, anchor.lastKnownCol)
    anchorsByPosition.set(key, [...(anchorsByPosition.get(key) ?? []), anchor])
  }

  const project = (node: NonNullable<SourceProjection['structure']>): SourceContentLayer => {
    if (node.line === undefined || node.col === undefined) {
      throw contentProjectionError('SOURCE_CONTENT_POSITION_MISSING', `source position missing for inner ${node.tag} layer`)
    }
    const candidates = anchorsByPosition.get(positionKey(node.line, node.col)) ?? []
    if (candidates.length !== 1) {
      throw contentProjectionError(
        candidates.length === 0 ? 'SOURCE_CONTENT_ANCHOR_MISSING' : 'SOURCE_CONTENT_ANCHOR_AMBIGUOUS',
        `${candidates.length === 0 ? 'no' : 'multiple'} source anchors at ${node.line}:${node.col}`,
      )
    }
    const anchor = candidates[0]!
    return {
      id: sourceContentLayerId(anchor),
      tag: node.tag,
      name: node.name ?? node.class ?? node.tag,
      source: { file: projection.file, exportName: projection.exportName, anchor },
      children: node.children.map(project),
    }
  }

  return [project(projection.structure)]
}

export function sourceContentProvenance(layer: SourceContentLayer): string {
  return `${layer.source.file}:${layer.source.anchor.lastKnownLine}:${layer.source.anchor.lastKnownCol}`
}

export function resolveSourceContentBindings(
  layers: SourceContentLayer[],
  runtimeNodes: RuntimeContentProvenance[],
): SourceContentBinding[] {
  const layersByProvenance = new Map<string, SourceContentLayer[]>()
  const index = (layer: SourceContentLayer) => {
    const provenance = sourceContentProvenance(layer)
    layersByProvenance.set(provenance, [...(layersByProvenance.get(provenance) ?? []), layer])
    for (const child of layer.children) index(child)
  }
  for (const layer of layers) index(layer)

  const runtimeCounts = new Map<string, number>()
  for (const node of runtimeNodes) {
    if (node.provenance) runtimeCounts.set(node.provenance, (runtimeCounts.get(node.provenance) ?? 0) + 1)
  }

  return runtimeNodes.map((node): SourceContentBinding => {
    if (!node.provenance) return { kind: 'refused', code: 'SOURCE_CONTENT_PROVENANCE_MISSING' }
    const candidates = layersByProvenance.get(node.provenance) ?? []
    if (candidates.length === 0) return { kind: 'refused', code: 'SOURCE_CONTENT_PROVENANCE_UNOWNED' }
    if (candidates.length !== 1 || runtimeCounts.get(node.provenance) !== 1) {
      return { kind: 'refused', code: 'SOURCE_CONTENT_PROVENANCE_AMBIGUOUS' }
    }
    const layer = candidates[0]!
    if (layer.tag.toLowerCase() !== node.tag.toLowerCase()) {
      return { kind: 'refused', code: 'SOURCE_CONTENT_PROVENANCE_TAG_MISMATCH' }
    }
    return { kind: 'bound', layer }
  })
}

function positionKey(line: number, col: number): string {
  return `${line}:${col}`
}

function contentProjectionError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code })
}
