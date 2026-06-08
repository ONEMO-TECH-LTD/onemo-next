// outline-core/reducer.ts — deterministic command replay (A1a · AMEND-C4 / F1)
//
// `applyOutlineCommands(base, commands, env)` replays the canonical semantic OutlineCommand log over
// a base snapshot to reconstruct the OutlineDocument. The command log is the canonical edit record
// (≠ UI undo); the document SHAPE it produces is the source of truth.
//
// `assertReplayMatchesHash` enforces the AMEND-F1 provenance invariant:
//   hash(replay(baseSnapshot, edit_ops)) === outline_document_hash  → reject (fail-closed) on mismatch
// so a remake can never reuse the stored document while the replay path reconstructs a different
// shape ("two truths"). One truth, verified.
//
// Pure + deterministic: no DOM, no three.js, no Date.now, no randomness.

import type {
  OutlineBaseSnapshot,
  OutlineCommand,
  OutlineDocument,
  OutlineRing,
  OutlineStyle,
  OutlineGenerator,
} from './types'
import { outlineDocumentHash } from './hash'

/** Doc-level fields the command log does not carry (the replay envelope). */
export interface ReplayEnv {
  image: OutlineDocument['image']
  mode: OutlineDocument['mode']
  readonly?: boolean
}

/** Reconstructed persistent state — the geometry the document derives everything else from. */
export interface ReplayState {
  rings: OutlineRing[]
  style: OutlineStyle
  generator?: OutlineGenerator
}

/** Deterministic deep clone of pure JSON-shaped state (no Dates/functions in OutlineDocument data). */
function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

function findRing(rings: OutlineRing[], ringId: string): OutlineRing {
  const r = rings.find((x) => x.id === ringId)
  if (!r) throw new Error(`outline-core: ring not found: ${ringId}`)
  return r
}

function findNodeIndex(ring: OutlineRing, nodeId: string): number {
  const i = ring.nodes.findIndex((n) => n.id === nodeId)
  if (i < 0) throw new Error(`outline-core: node not found: ${nodeId} in ring ${ring.id}`)
  return i
}

/** Replay the canonical command log over a base snapshot → reconstructed persistent state. Pure. */
export function replayCommands(base: OutlineBaseSnapshot, commands: OutlineCommand[]): ReplayState {
  const rings = deepClone(base.rings)
  const style = deepClone(base.style)
  let generator = base.generator ? deepClone(base.generator) : undefined

  for (const cmd of commands) {
    switch (cmd.op) {
      case 'MoveNode': {
        const ring = findRing(rings, cmd.ringId)
        ring.nodes[findNodeIndex(ring, cmd.nodeId)].p = [cmd.to[0], cmd.to[1]]
        break
      }
      case 'AddNode': {
        const ring = findRing(rings, cmd.ringId)
        if (cmd.afterNodeId === null) {
          ring.nodes.unshift(deepClone(cmd.node))
        } else {
          ring.nodes.splice(findNodeIndex(ring, cmd.afterNodeId) + 1, 0, deepClone(cmd.node))
        }
        break
      }
      case 'DeleteNode': {
        const ring = findRing(rings, cmd.ringId)
        ring.nodes.splice(findNodeIndex(ring, cmd.nodeId), 1)
        break
      }
      case 'SetCorner': {
        const ring = findRing(rings, cmd.ringId)
        ring.nodes[findNodeIndex(ring, cmd.nodeId)].corner = deepClone(cmd.corner)
        break
      }
      case 'SetGlobalCornerRadius': {
        style.globalOutlineCornerRadiusPx = cmd.outlineCornerRadiusPx
        break
      }
      case 'SetSmoothing': {
        style.smoothing = cmd.smoothing
        break
      }
      case 'SetBlend': {
        if (!generator || generator.type !== 'sdf_blend') {
          throw new Error('outline-core: SetBlend requires an sdf_blend generator')
        }
        generator.t = cmd.t
        break
      }
      case 'BakeBase': {
        generator = deepClone(cmd.generator)
        break
      }
      case 'SetSegment': {
        const ring = findRing(rings, cmd.ringId)
        ring.nodes[findNodeIndex(ring, cmd.fromNodeId)].segmentToNext = deepClone(cmd.segment)
        break
      }
      default: {
        // Exhaustiveness: TS errors here if a new OutlineCommand op is added without a case.
        const _never: never = cmd
        throw new Error(`outline-core: unhandled command ${JSON.stringify(_never)}`)
      }
    }
  }

  return { rings, style, generator }
}

/** Replay + assemble the full OutlineDocument (the command log is recorded for audit/replay). */
export function applyOutlineCommands(
  base: OutlineBaseSnapshot,
  commands: OutlineCommand[],
  env: ReplayEnv,
): OutlineDocument {
  const { rings, style, generator } = replayCommands(base, commands)
  return {
    version: 1,
    image: deepClone(env.image),
    mode: env.mode,
    rings,
    style,
    commands: deepClone(commands),
    baseSnapshot: deepClone(base),
    ...(generator !== undefined ? { generator } : {}),
    ...(env.readonly !== undefined ? { readonly: env.readonly } : {}),
  }
}

/**
 * AMEND-F1 provenance invariant. The approved OutlineDocument is the source of truth; the edit-ops
 * are replay/audit only. Reconstruct from (baseSnapshot, edit_ops), and reject (fail-closed) if the
 * canonical hash doesn't match the stored one. Returns the verified document on success.
 */
export function assertReplayMatchesHash(
  base: OutlineBaseSnapshot,
  commands: OutlineCommand[],
  expectedHash: string,
  env: ReplayEnv,
): OutlineDocument {
  const doc = applyOutlineCommands(base, commands, env)
  const actual = outlineDocumentHash(doc)
  if (actual !== expectedHash) {
    throw new Error(
      `outline-core: replay hash mismatch — expected ${expectedHash}, got ${actual} (AMEND-F1 fail-closed)`,
    )
  }
  return doc
}
