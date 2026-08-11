const normalise = (value: unknown): unknown => {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new RangeError('Canonical output cannot contain a non-finite number.')
    return Object.is(value, -0) ? 0 : value
  }
  if (Array.isArray(value)) return value.map(normalise)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, normalise(item)]))
  }
  return value
}

export const canonicalSerialise = (value: unknown): string => JSON.stringify(normalise(value))

export function canonicalId(value: unknown): string {
  let hash = 0xcbf29ce484222325n
  for (const byte of new TextEncoder().encode(canonicalSerialise(value))) {
    hash ^= BigInt(byte)
    hash = BigInt.asUintN(64, hash * 0x100000001b3n)
  }
  return hash.toString(16).padStart(16, '0')
}
