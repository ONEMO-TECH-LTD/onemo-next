import { describe, it, expect } from 'vitest'
import { liteSpec, liteSource } from '../transactions'
import type { EffectSpecDraft } from '@/lib/effect/types'

type SourceArg = Parameters<typeof liteSource>[0]

// Phase-2 KAI-9223 — the dep-free, pure part of the history transaction: the F25 memory strip.
// (The hook behaviour — undo/redo/restore, generation cancel, sessions — is covered by the live A/B +
// dual QA; the vitest harness is node-env with no React-hook testing infra. See KAI-9223 notes.)

describe('history transaction — liteSpec (F25 memory strip, inv 20)', () => {
  it('strips rawTracePx so a stored snapshot never retains the raw trace ×N', () => {
    const spec = { sourceRef: 'x', maskWidthPx: 10, maskHeightPx: 10, mmPerPx: 1, rawTracePx: [[1, 2], [3, 4]] } as unknown as EffectSpecDraft
    const lite = liteSpec(spec)
    expect(lite?.rawTracePx).toBeUndefined()        // the heavy raw trace is dropped from history
    expect(lite?.sourceRef).toBe('x')               // every other field is preserved
    expect(lite?.maskWidthPx).toBe(10)
    expect((spec as { rawTracePx?: unknown }).rawTracePx).toBeDefined() // original is not mutated
  })

  it('returns the spec unchanged when rawTracePx is already absent (no needless copy)', () => {
    const spec = { sourceRef: 'y' } as unknown as EffectSpecDraft
    expect(liteSpec(spec)).toBe(spec)
  })

  it('passes null through', () => {
    expect(liteSpec(null)).toBeNull()
  })
})

describe('history transaction — liteSource (F25 memory strip, inv 20)', () => {
  it('strips rawTracePx from the stored source (write-only provenance, no reader)', () => {
    const source = { kind: 'auto', rawTracePx: [[1, 2], [3, 4]] } as unknown as SourceArg
    const lite = liteSource(source)
    expect((lite as { rawTracePx?: unknown }).rawTracePx).toBeUndefined()
    expect((lite as { kind?: string }).kind).toBe('auto')                       // other fields preserved
    expect((source as { rawTracePx?: unknown }).rawTracePx).toBeDefined()        // original not mutated
  })

  it('returns the source unchanged when rawTracePx is already absent', () => {
    const source = { kind: 'manual' } as unknown as SourceArg
    expect(liteSource(source)).toBe(source)
  })

  it('passes null through', () => {
    expect(liteSource(null)).toBeNull()
  })
})
