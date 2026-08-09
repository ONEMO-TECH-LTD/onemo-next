// Production chain coverage: exact lazy-fallback order, self-hosted assets, and matte feasibility.

import { describe, test, expect } from 'vitest'
import { REMBG, resolveChain, isDegenerateMatte } from '../ben-chain'

describe('KAI-9087 — cut-out trio chain', () => {
  test('production = u2netp → Silueta in exact lazy-fallback order', () => {
    const chain = resolveChain()
    expect(chain.map((s) => s.adapter)).toEqual(['u2netp', 'silueta'])
  })

  test('production trio is self-hosted same-origin (offline-capable)', () => {
    expect(REMBG.u2netp.url.startsWith('/seg-models/')).toBe(true)
    expect(REMBG.silueta.url.startsWith('/seg-models/')).toBe(true)
  })
})

describe('KAI-9087 — exact adapter identity', () => {
  test('each production spec reports its model id', () => {
    expect(REMBG.u2netp.adapter).toBe('u2netp')
    expect(REMBG.silueta.adapter).toBe('silueta')
  })
})

describe('KAI-9087 — degenerate-mask guard (empty / full-frame matte → fall back)', () => {
  test('an empty matte (subject not found) is degenerate', () => {
    expect(isDegenerateMatte(0)).toBe(true)
    expect(isDegenerateMatte(0.004)).toBe(true)
  })
  test('a full-frame matte (no background removed) is degenerate', () => {
    expect(isDegenerateMatte(0.996)).toBe(true)
    expect(isDegenerateMatte(1)).toBe(true)
  })
  test('a normal subject fraction is NOT degenerate', () => {
    expect(isDegenerateMatte(0.05)).toBe(false)
    expect(isDegenerateMatte(0.5)).toBe(false)
    expect(isDegenerateMatte(0.9)).toBe(false)
  })
})
