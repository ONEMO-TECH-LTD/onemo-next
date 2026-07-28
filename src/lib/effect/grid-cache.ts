/** Exact module-lifetime caches for the async magnetic-grid clients. No persistence or value rewriting. */

export function jsonByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength
}

export interface BoundedResultCacheOptions {
  maxEntries?: number
  maxBytes?: number
}

interface CacheEntry<T> {
  value: T
  bytes: number
}

/** LRU for arbitrary/dynamic results, bounded by both entry count and serialized bytes. */
export class BoundedResultCache<T> {
  readonly maxEntries: number
  readonly maxBytes: number
  private readonly entries = new Map<string, CacheEntry<T>>()
  private usedBytes = 0

  constructor({ maxEntries = 64, maxBytes = 16 * 1024 * 1024 }: BoundedResultCacheOptions = {}) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new RangeError('Grid result cache maxEntries must be a positive integer.')
    }
    if (!Number.isFinite(maxBytes) || maxBytes < 1) {
      throw new RangeError('Grid result cache maxBytes must be positive.')
    }
    this.maxEntries = maxEntries
    this.maxBytes = maxBytes
  }

  get size(): number { return this.entries.size }
  get byteSize(): number { return this.usedBytes }

  has(key: string): boolean { return this.entries.has(key) }

  peek(key: string): T | undefined {
    return this.entries.get(key)?.value
  }

  get(key: string): T | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry.value
  }

  set(key: string, value: T, bytes: number = jsonByteLength(value)): boolean {
    if (!Number.isFinite(bytes) || bytes < 0) {
      throw new RangeError('Grid result cache entry bytes must be finite and non-negative.')
    }
    const previous = this.entries.get(key)
    if (previous) {
      this.usedBytes -= previous.bytes
      this.entries.delete(key)
    }
    if (bytes > this.maxBytes) return false
    this.entries.set(key, { value, bytes })
    this.usedBytes += bytes
    this.evict()
    return this.entries.has(key)
  }

  delete(key: string): boolean {
    const entry = this.entries.get(key)
    if (!entry) return false
    this.usedBytes -= entry.bytes
    return this.entries.delete(key)
  }

  clear(): void {
    this.entries.clear()
    this.usedBytes = 0
  }

  keys(): string[] { return [...this.entries.keys()] }

  private evict(): void {
    while (this.entries.size > this.maxEntries || this.usedBytes > this.maxBytes) {
      const oldest = this.entries.entries().next().value as [string, CacheEntry<T>] | undefined
      if (!oldest) break
      this.entries.delete(oldest[0])
      this.usedBytes -= oldest[1].bytes
    }
  }
}

/** Pinned finite static results for one active law/option generation. Stale writes are rejected. */
export class StaticResultTable<T> {
  private activeGeneration: string | null = null
  private readonly entries = new Map<string, T>()

  get generation(): string | null { return this.activeGeneration }
  get size(): number { return this.entries.size }

  activate(generation: string): boolean {
    if (generation === this.activeGeneration) return false
    this.activeGeneration = generation
    this.entries.clear()
    return true
  }

  get(key: string): T | undefined {
    return this.entries.get(key)
  }

  set(generation: string, key: string, value: T): boolean {
    if (generation !== this.activeGeneration) return false
    this.entries.set(key, value)
    return true
  }

  clear(): void {
    this.activeGeneration = null
    this.entries.clear()
  }
}
