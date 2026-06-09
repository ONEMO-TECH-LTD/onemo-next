// outline-core golden fixtures (A1a) — the pass/fail surface for the deterministic foundation.
// These encode WHY each behaviour matters, not just that it happens:
//   - the reducer replays the canonical command log faithfully + deterministically
//   - the hash is over the SHAPE only (derived fields + edit envelope excluded) so client & server
//     agree (AMEND-F1 / NIT-F1)
//   - the F1 provenance invariant rejects a replay that doesn't reproduce the stored shape

import { describe, it, expect } from 'vitest'
import type {
  OutlineBaseSnapshot,
  OutlineCommand,
  OutlineDocument,
  OutlineNode,
  SdfBlendGenerator,
} from '../types'
import {
  applyOutlineCommands,
  assertReplayMatchesHash,
  replayCommands,
  type ReplayEnv,
} from '../reducer'
import { canonicalProjection, outlineDocumentHash, stableStringify } from '../hash'

const env: ReplayEnv = {
  image: { widthPx: 1000, heightPx: 800, sourceHash: 'src-abc', orientation: 'baked' },
  mode: 'semi_auto',
}

function node(id: string, x: number, y: number, extra: Partial<OutlineNode> = {}): OutlineNode {
  return { id, p: [x, y], role: 'corner', corner: { mode: 'inherit' }, ...extra }
}

/** A 100×100 square outer ring. */
function squareBase(): OutlineBaseSnapshot {
  return {
    rings: [
      {
        id: 'r1',
        role: 'outer',
        closed: true,
        nodes: [node('n1', 0, 0), node('n2', 100, 0), node('n3', 100, 100), node('n4', 0, 100)],
      },
    ],
    style: { globalOutlineCornerRadiusPx: 0, smoothing: 0 },
  }
}

/** Outer square + a centered square hole (discriminated union: hole REQUIRES parentRingId). */
function holeBase(): OutlineBaseSnapshot {
  return {
    rings: [
      {
        id: 'r1',
        role: 'outer',
        closed: true,
        nodes: [node('n1', 0, 0), node('n2', 100, 0), node('n3', 100, 100), node('n4', 0, 100)],
      },
      {
        id: 'h1',
        role: 'hole',
        parentRingId: 'r1',
        closed: true,
        nodes: [node('m1', 40, 40), node('m2', 60, 40), node('m3', 60, 60), node('m4', 40, 60)],
      },
    ],
    style: { globalOutlineCornerRadiusPx: 0, smoothing: 0 },
  }
}

describe('reducer — command replay', () => {
  it('MoveNode updates exactly the targeted node', () => {
    const { rings } = replayCommands(squareBase(), [
      { op: 'MoveNode', ringId: 'r1', nodeId: 'n2', to: [120, -10] },
    ])
    expect(rings[0].nodes.find((n) => n.id === 'n2')!.p).toEqual([120, -10])
    expect(rings[0].nodes.find((n) => n.id === 'n1')!.p).toEqual([0, 0]) // untouched
  })

  it('AddNode inserts after the named node, or at the start when afterNodeId is null', () => {
    const after = replayCommands(squareBase(), [
      { op: 'AddNode', ringId: 'r1', afterNodeId: 'n2', node: node('nx', 110, 50) },
    ])
    expect(after.rings[0].nodes.map((n) => n.id)).toEqual(['n1', 'n2', 'nx', 'n3', 'n4'])

    const front = replayCommands(squareBase(), [
      { op: 'AddNode', ringId: 'r1', afterNodeId: null, node: node('n0', -5, -5) },
    ])
    expect(front.rings[0].nodes.map((n) => n.id)).toEqual(['n0', 'n1', 'n2', 'n3', 'n4'])
  })

  it('DeleteNode removes exactly the targeted node', () => {
    const { rings } = replayCommands(squareBase(), [{ op: 'DeleteNode', ringId: 'r1', nodeId: 'n3' }])
    expect(rings[0].nodes.map((n) => n.id)).toEqual(['n1', 'n2', 'n4'])
  })

  it('SetCorner / SetGlobalCornerRadius / SetSmoothing persist', () => {
    const { rings, style } = replayCommands(squareBase(), [
      { op: 'SetCorner', ringId: 'r1', nodeId: 'n1', corner: { mode: 'manual', outlineCornerRadiusPx: 8, locked: true } },
      { op: 'SetGlobalCornerRadius', outlineCornerRadiusPx: 4 },
      { op: 'SetSmoothing', smoothing: 0.5 },
    ])
    expect(rings[0].nodes[0].corner).toEqual({ mode: 'manual', outlineCornerRadiusPx: 8, locked: true })
    expect(style.globalOutlineCornerRadiusPx).toBe(4)
    expect(style.smoothing).toBe(0.5)
  })

  it('SetSegment attaches the segment to the from-node', () => {
    const { rings } = replayCommands(squareBase(), [
      { op: 'SetSegment', ringId: 'r1', fromNodeId: 'n1', segment: { type: 'cubic', c1: [10, -10], c2: [40, -10] } },
    ])
    expect(rings[0].nodes[0].segmentToNext).toEqual({ type: 'cubic', c1: [10, -10], c2: [40, -10] })
  })

  it('does not mutate the base snapshot (pure replay)', () => {
    const base = squareBase()
    replayCommands(base, [{ op: 'MoveNode', ringId: 'r1', nodeId: 'n1', to: [999, 999] }])
    expect(base.rings[0].nodes[0].p).toEqual([0, 0]) // base untouched
  })

  it('throws on a missing ring or node, and on SetBlend without an sdf_blend generator', () => {
    expect(() => replayCommands(squareBase(), [{ op: 'MoveNode', ringId: 'nope', nodeId: 'n1', to: [0, 0] }])).toThrow(/ring not found/)
    expect(() => replayCommands(squareBase(), [{ op: 'MoveNode', ringId: 'r1', nodeId: 'nope', to: [0, 0] }])).toThrow(/node not found/)
    expect(() => replayCommands(squareBase(), [{ op: 'SetBlend', t: 0.5 }])).toThrow(/sdf_blend/)
  })

  it('SetBlend updates t on an sdf_blend generator; BakeBase swaps the generator', () => {
    const gen: SdfBlendGenerator = {
      type: 'sdf_blend',
      from: { type: 'rounded_rect', rectPx: { x: 0, y: 0, w: 100, h: 100 }, cornerRadiusPx: 12 },
      to: { type: 'ben2_silhouette', maskHash: 'mask-1' },
      rasterDomain: { widthPx: 256, heightPx: 256, scaleToSourcePx: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
      t: 0.2,
      topologyPolicy: { components: 'largest', holes: 'preserve', minComponentAreaPx2: 16, minHoleAreaPx2: 16 },
    }
    const base: OutlineBaseSnapshot = { ...squareBase(), generator: gen }
    const blended = replayCommands(base, [{ op: 'SetBlend', t: 0.9 }])
    expect((blended.generator as SdfBlendGenerator).t).toBe(0.9)

    const baked = replayCommands(base, [{ op: 'BakeBase', generator: { type: 'manual' } }])
    expect(baked.generator).toEqual({ type: 'manual' })
  })
})

describe('hash — canonical projection', () => {
  it('is deterministic: same (base, commands) → identical hash', () => {
    const cmds: OutlineCommand[] = [{ op: 'MoveNode', ringId: 'r1', nodeId: 'n2', to: [120, 0] }]
    const a = outlineDocumentHash(applyOutlineCommands(squareBase(), cmds, env))
    const b = outlineDocumentHash(applyOutlineCommands(squareBase(), cmds, env))
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{16}$/)
  })

  it('EXCLUDES derived fields (ring.winding, corner.kind, corner.maxRadiusPx)', () => {
    const plain = applyOutlineCommands(squareBase(), [], env)
    const withDerived: OutlineDocument = JSON.parse(JSON.stringify(plain))
    // Inject derived/non-persistent fields — these must NOT change identity.
    ;(withDerived.rings[0] as { winding?: string }).winding = 'ccw'
    withDerived.rings[0].nodes[0].corner.kind = 'convex'
    withDerived.rings[0].nodes[0].corner.maxRadiusPx = 13.7
    expect(outlineDocumentHash(withDerived)).toBe(outlineDocumentHash(plain))
  })

  it('EXCLUDES the edit envelope (commands / undoStack / readonly): same shape → same hash', () => {
    const base = squareBase()
    const a = applyOutlineCommands(base, [{ op: 'SetSmoothing', smoothing: 0 }], { ...env, readonly: false })
    // Same resulting shape, different envelope (no commands, readonly, an undo stack).
    const b: OutlineDocument = {
      ...JSON.parse(JSON.stringify(a)),
      commands: [],
      undoStack: [{ label: 'noop', commandIndex: 0 }],
      readonly: true,
    }
    expect(outlineDocumentHash(b)).toBe(outlineDocumentHash(a))
  })

  it('node ORDER is significant (geometry order, not key order)', () => {
    const a = applyOutlineCommands(squareBase(), [], env)
    const reordered = applyOutlineCommands(squareBase(), [], env)
    reordered.rings[0].nodes.reverse()
    expect(outlineDocumentHash(reordered)).not.toBe(outlineDocumentHash(a))
  })

  it('hole rings keep parentRingId in the projection', () => {
    const proj = canonicalProjection(applyOutlineCommands(holeBase(), [], env))
    const rings = proj.rings as Array<Record<string, unknown>>
    expect(rings[1].role).toBe('hole')
    expect(rings[1].parentRingId).toBe('r1')
    // stableStringify must be stable across calls
    const doc = applyOutlineCommands(holeBase(), [], env)
    expect(stableStringify(canonicalProjection(doc))).toBe(stableStringify(canonicalProjection(doc)))
  })
})

describe('AMEND-F1 — replay provenance invariant (fail-closed)', () => {
  it('round-trips: replaying a document\'s own (baseSnapshot, commands) reproduces its hash', () => {
    const cmds: OutlineCommand[] = [
      { op: 'MoveNode', ringId: 'r1', nodeId: 'n2', to: [120, -8] },
      { op: 'SetCorner', ringId: 'r1', nodeId: 'n3', corner: { mode: 'manual', outlineCornerRadiusPx: 6 } },
    ]
    const doc = applyOutlineCommands(squareBase(), cmds, env)
    const h = outlineDocumentHash(doc)
    // Re-resolve from the stored base + ops (what the server does) → same shape, same hash.
    expect(() => assertReplayMatchesHash(doc.baseSnapshot, doc.commands, h, env)).not.toThrow()
  })

  it('rejects a tampered command log (different shape → hash mismatch)', () => {
    const cmds: OutlineCommand[] = [{ op: 'MoveNode', ringId: 'r1', nodeId: 'n2', to: [120, 0] }]
    const doc = applyOutlineCommands(squareBase(), cmds, env)
    const h = outlineDocumentHash(doc)
    const tampered: OutlineCommand[] = [...cmds, { op: 'MoveNode', ringId: 'r1', nodeId: 'n1', to: [5, 5] }]
    expect(() => assertReplayMatchesHash(squareBase(), tampered, h, env)).toThrow(/AMEND-F1 fail-closed/)
  })

  it('rejects when the stored hash is wrong (no "two truths")', () => {
    const doc = applyOutlineCommands(squareBase(), [], env)
    expect(() => assertReplayMatchesHash(doc.baseSnapshot, doc.commands, 'deadbeefdeadbeef', env)).toThrow(/mismatch/)
  })
})
