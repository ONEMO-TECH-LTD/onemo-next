// outline-core/hash.ts — pinned canonical content hashing (A1a · NIT-F1)
//
// A deterministic JSON serializer + a pinned content hash (cyrb53 → 16-char hex), used so the
// client worker and the server canonical compiler hash IDENTICALLY. Pure + deterministic:
// no DOM, no Date.now, no randomness, no platform crypto — both sides compute it the same.

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
 * deterministic equality across client + server. Pure number math (Math.imul, two 32-bit lanes) —
 * no BigInt / no ES2020-target dependency, no platform crypto — so both sides compute it identically.
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
