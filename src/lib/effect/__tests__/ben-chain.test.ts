// KAI-9087 — cut-out chain coverage: the trio composition, the lazy-fallback order, the degenerate
// matte guard, and the R1 adapter-IDENTITY contract (true model ids, never the hard-coded ben2-onnx).

import { describe, test, expect } from 'vitest'
import { REMBG, resolveChain, isDegenerateMatte } from '../ben-chain'

describe('KAI-9087 — cut-out trio chain', () => {
  test('default (no seg) = the production trio u2netp → silueta, in that order (silueta is the lazy fallback)', () => {
    const chain = resolveChain()
    expect(chain).not.toBeNull()
    expect(chain!.map((s) => s.adapter)).toEqual(['u2netp', 'silueta'])
  })

  test('an explicit ?seg= model resolves to that single model (comparison harness)', () => {
    expect(resolveChain('silueta')!.map((s) => s.adapter)).toEqual(['silueta'])
    expect(resolveChain('u2net')!.map((s) => s.adapter)).toEqual(['u2net'])
  })

  test('an unknown / transformers key (ben2, birefnet) → null → transformers.js path', () => {
    expect(resolveChain('ben2')).toBeNull()
    expect(resolveChain('birefnet')).toBeNull()
  })

  test('production trio is self-hosted same-origin (offline-capable)', () => {
    expect(REMBG.u2netp.url.startsWith('/seg-models/')).toBe(true)
    expect(REMBG.silueta.url.startsWith('/seg-models/')).toBe(true)
  })
})

describe('KAI-9087 — R1 adapter identity (true ids, never ben2-onnx)', () => {
  test('each rembg spec reports its TRUE model id as the adapter', () => {
    expect(REMBG.u2netp.adapter).toBe('u2netp')
    expect(REMBG.silueta.adapter).toBe('silueta')
  })
  test('no rembg model masquerades as the retired ben2-onnx constant', () => {
    for (const k of Object.keys(REMBG)) expect(REMBG[k].adapter).not.toBe('ben2-onnx')
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
