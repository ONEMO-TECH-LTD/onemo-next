// outline-core/hash.ts — canonical content hashing (A1a · AMEND-F1 / NIT-F1)
//
// `outlineDocumentHash()` hashes the CANONICAL PERSISTENT PROJECTION of an OutlineDocument:
//   - derived fields are excluded: `OutlineRing.winding`, `CornerSpec.kind`, `CornerSpec.maxRadiusPx`
//   - the doc envelope is excluded: `commands` / `undoStack` / `baseSnapshot` / `readonly`
//     (the edit-ops are audit; the snapshot is the replay base; readonly is a UI/mode flag — none
//      change the SHAPE)
//   - object keys are emitted in a stable (sorted) order; array order is preserved (geometry order
//     is meaningful)
// so the client worker and the server canonical compiler hash IDENTICALLY — otherwise the AMEND-F1
// replay-equality check would false-reject (the opposite of fail-closed, NIT-F1).
//
// Pure + deterministic: no DOM, no Date.now, no randomness. The hash algorithm is pinned HERE so
// both sides agree.

import type { OutlineDocument, OutlineRing, OutlineNode, CornerSpec } from './types'

/** Persistent projection of a corner — drops the derived `kind` + `maxRadiusPx`. */
function projectCorner(c: CornerSpec): Record<string, unknown> {
  const out: Record<string, unknown> = { mode: c.mode }
  if (c.roundingSide !== undefined) out.roundingSide = c.roundingSide
  if (c.outlineCornerRadiusPx !== undefined) out.outlineCornerRadiusPx = c.outlineCornerRadiusPx
  if (c.locked !== undefined) out.locked = c.locked
  return out
}

function projectNode(n: OutlineNode): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: n.id,
    p: [n.p[0], n.p[1]],
    role: n.role,
    corner: projectCorner(n.corner),
  }
  if (n.snap !== undefined) out.snap = n.snap
  if (n.segmentToNext !== undefined) out.segmentToNext = n.segmentToNext
  return out
}

/** Persistent projection of a ring — drops the derived `winding`. */
function projectRing(r: OutlineRing): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: r.id,
    role: r.role,
    nodes: r.nodes.map(projectNode),
  }
  if (r.role === 'hole') out.parentRingId = r.parentRingId
  if (r.locked !== undefined) out.locked = r.locked
  return out
}

/** The canonical persistent projection of a document's SHAPE (envelope + derived fields excluded). */
export function canonicalProjection(doc: OutlineDocument): Record<string, unknown> {
  return {
    version: doc.version,
    image: {
      widthPx: doc.image.widthPx,
      heightPx: doc.image.heightPx,
      sourceHash: doc.image.sourceHash,
      orientation: doc.image.orientation,
    },
    mode: doc.mode,
    generator: doc.generator ?? null,
    style: {
      globalOutlineCornerRadiusPx: doc.style.globalOutlineCornerRadiusPx,
      smoothing: doc.style.smoothing,
    },
    rings: doc.rings.map(projectRing),
  }
}

/** Deterministic JSON with recursively sorted object keys (arrays preserve order). */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

/**
 * cyrb53 — a pinned CONTENT hash → 16-char lowercase hex. Not cryptographic; its only job is
 * deterministic equality across client + server so the AMEND-F1 replay check is reliable. Pure
 * number math (Math.imul, two 32-bit lanes) — no BigInt / no ES2020-target dependency, no platform
 * crypto — so both sides compute it identically.
 */
export function contentHash(s: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  const hi = (h2 >>> 0).toString(16).padStart(8, '0')
  const lo = (h1 >>> 0).toString(16).padStart(8, '0')
  return hi + lo
}

/**
 * `outline_document_hash` — the hash over the canonical persistent projection (AMEND-F1 / NIT-F1).
 * Two documents with the same SHAPE hash identically regardless of edit history, undo stack, or
 * derived winding/kind/maxRadiusPx.
 */
export function outlineDocumentHash(doc: OutlineDocument): string {
  return contentHash(stableStringify(canonicalProjection(doc)))
}
