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

function positionKey(line: number, col: number): string {
  return `${line}:${col}`
}

function contentProjectionError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code })
}
