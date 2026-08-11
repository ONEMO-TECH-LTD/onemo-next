// CANONICAL OUTPUT — blueprint §1: "canonical-output.ts — stable ordering, fingerprints and
// byte-stable serialisation." Implements §9's two serialisation clauses:
//   "Output serialisation has fixed field and array order and locale-independent decimal formatting."
//   "No randomness, wall-clock value, platform locale or iteration order affects answer content.
//    Timing stays in diagnostics and outside the canonical answer hash."
//
import type { GridEngineSpec, PointMM } from './contract'

// The mechanism: serialisation recurses with SORTED object keys, so runtime insertion order can
// never reach the bytes; numbers are formatted through one locale-independent path; and the answer
// hash is computed over the result WITH ITS TIMING FIELD REMOVED, so two identical solves at
// different wall-clock speeds hash identically.

/** Locale-independent number formatting: JS Number.prototype.toString is locale-free by spec —
 *  never toLocaleString — and negative zero is normalised so -0 and 0 serialise identically. */
function formatNumber(n: number): string {
  if (!Number.isFinite(n)) throw new RangeError('canonical output cannot carry a non-finite number')
  return Object.is(n, -0) ? '0' : n.toString()
}

/** Byte-stable serialisation: arrays keep their (canonical, §9-ordered) order; object keys sort. */
export function canonicalSerialise(value: unknown): string {
  if (value === null) return 'null'
  switch (typeof value) {
    case 'number':
      return formatNumber(value)
    case 'string':
      return JSON.stringify(value)
    case 'boolean':
      return value ? 'true' : 'false'
    case 'undefined':
      throw new RangeError('canonical output cannot carry undefined — model absence explicitly')
    case 'object': {
      if (Array.isArray(value)) {
        return `[${value.map(canonicalSerialise).join(',')}]`
      }
      const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0,
      )
      for (const [k, v] of entries) {
        if (v === undefined) throw new RangeError(`canonical output cannot carry undefined (key ${k})`)
      }
      return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalSerialise(v)}`).join(',')}}`
    }
    default:
      throw new RangeError(`canonical output cannot carry a ${typeof value}`)
  }
}

/**
 * FNV-1a 64-bit over the canonical bytes — deterministic, dependency-free, and stable across
 * platforms. Not cryptographic and not required to be: §9 needs identity, not secrecy.
 * BigInt CONSTRUCTOR calls (repo targets ES2017 where the literal syntax is unavailable).
 */
const FNV_OFFSET = BigInt('14695981039346656037')
const FNV_PRIME = BigInt('1099511628211')
const U64_MASK = BigInt('18446744073709551615')

export function canonicalHash(canonicalBytes: string): string {
  let h = FNV_OFFSET
  for (let i = 0; i < canonicalBytes.length; i++) {
    h ^= BigInt(canonicalBytes.charCodeAt(i))
    h = (h * FNV_PRIME) & U64_MASK
  }
  return h.toString(16).padStart(16, '0')
}

/**
 * §9: timing stays in diagnostics and OUTSIDE the canonical answer hash. The hash input is the
 * result with `diagnostics.solveDurationMS` removed; everything else — families, order, evidence,
 * pending questions — is identity.
 */
export function answerHash(result: object): string {
  // STRUCTURAL strip of the one timing field — never a JSON round-trip, which coerces NaN and
  // Infinity to null and silently drops undefined, letting invalid answers hash as valid.
  const strip = (v: unknown, path: string): unknown => {
    if (v === null || typeof v !== 'object') return v
    if (Array.isArray(v)) return v.map((x, i) => strip(x, `${path}[${i}]`))
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (path === '.diagnostics' && k === 'solveDurationMS') continue
      out[k] = strip(val, `${path}.${k}`)
    }
    return out
  }
  return canonicalHash(canonicalSerialise(strip(result, '')))
}

/**
 * The request fingerprint (§10 step 1): canonical outline points plus every guarded spec input plus
 * the flap switches — the complete invalidation key (G11: outline + every law value that reaches
 * the engine; anything less serves a stale answer after a law change).
 */
export function requestFingerprint(input: {
  readonly outlinePoints: readonly PointMM[]
  readonly spec: GridEngineSpec
  readonly flapLimitsMM: readonly [number, number]
}): string {
  // the compiler now REQUIRES every guarded law input — omitting bands or centreMethods is a type
  // error, so the cache key cannot silently narrow (G11).
  return canonicalHash(canonicalSerialise(input))
}
