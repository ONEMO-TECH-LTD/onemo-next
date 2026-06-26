import { describe, it, expect } from 'vitest'
import { liteSpec, liteSource, imageFxChanged, editorSessionChanged, filterSessionChanged } from '../transactions'
import type { AppSnap } from '../transactions'
import type { EffectSpecDraft } from '@/lib/effect/types'

type SourceArg = Parameters<typeof liteSource>[0]

const DEFAULT_FX = { brightness: 100, contrast: 100, saturate: 100, warmth: 0 }
// Minimal pre-snapshot for the change-detection predicates (only the read fields matter).
const snap = (over: Record<string, unknown> = {}): AppSnap => ({
  genId: 0, recipe: null, autoOutline: false,
  designState: { offsetX: 0, offsetY: 0, scale: 1 },
  imageFx: null, wrapTile: false,
  outline: { spec: null, committedShape: null, source: null, adjustments: {}, bgBlur: null },
  trim: { backColor: '#000', frameColor: '#000', bgColor: '#000' },
  ...over,
}) as unknown as AppSnap

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

describe('sessions — imageFxChanged (null→default normalization, KAI-8971/F2)', () => {
  it('treats null vs the explicit {100/100/100/0} default as NO change (the edge the live A/B misses)', () => {
    expect(imageFxChanged(null, DEFAULT_FX as never)).toBe(false)
    expect(imageFxChanged(DEFAULT_FX as never, null)).toBe(false)
    expect(imageFxChanged(null, null)).toBe(false)
  })
  it('reports a genuine value change', () => {
    expect(imageFxChanged(null, { brightness: 120, contrast: 100, saturate: 100, warmth: 0 } as never)).toBe(true)
    expect(imageFxChanged({ ...DEFAULT_FX, warmth: 10 } as never, DEFAULT_FX as never)).toBe(true)
  })
})

describe('sessions — editorSessionChanged (commit one step iff something changed)', () => {
  type EditorCur = Parameters<typeof editorSessionChanged>[0]
  const baseCur = { committedShape: null, bgBlur: null, imageFx: null, artwork: { offsetX: 0, offsetY: 0, scale: 1 } }
  const cur = (over: Record<string, unknown> = {}) => ({ ...baseCur, ...over }) as unknown as EditorCur
  it('no change → false (no spurious history step on a no-op close)', () => {
    expect(editorSessionChanged(cur(), snap())).toBe(false)
  })
  it('a null imageFx vs a default-fx snapshot is still NO change (value compare)', () => {
    expect(editorSessionChanged(cur(), snap({ imageFx: DEFAULT_FX }))).toBe(false)
  })
  it('shape change → true', () => {
    expect(editorSessionChanged(cur({ committedShape: { id: 'x' } }), snap())).toBe(true)
  })
  it('blur change → true', () => {
    expect(editorSessionChanged(cur({ bgBlur: 50 }), snap())).toBe(true)
  })
  it('photo-position change → true', () => {
    expect(editorSessionChanged(cur({ artwork: { offsetX: 5, offsetY: 0, scale: 1 } }), snap())).toBe(true)
  })
})

describe('sessions — filterSessionChanged (imageFx by REFERENCE — verbatim with the inline test)', () => {
  const fx = { ...DEFAULT_FX }
  it('same imageFx ref + same blur/tile → false', () => {
    expect(filterSessionChanged({ imageFx: fx, bgBlur: null, wrapTile: false } as never, snap({ imageFx: fx }))).toBe(false)
  })
  it('a DIFFERENT imageFx object (same values) → true (reference compare, by design)', () => {
    expect(filterSessionChanged({ imageFx: { ...DEFAULT_FX }, bgBlur: null, wrapTile: false } as never, snap({ imageFx: { ...DEFAULT_FX } }))).toBe(true)
  })
  it('blur change → true', () => {
    expect(filterSessionChanged({ imageFx: fx, bgBlur: 30, wrapTile: false } as never, snap({ imageFx: fx }))).toBe(true)
  })
  it('wrapTile change → true', () => {
    expect(filterSessionChanged({ imageFx: fx, bgBlur: null, wrapTile: true } as never, snap({ imageFx: fx }))).toBe(true)
  })
})
