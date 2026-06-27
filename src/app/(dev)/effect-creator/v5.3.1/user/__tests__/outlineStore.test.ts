import { describe, it, expect, beforeEach } from 'vitest'
import { useOutlineStore } from '../outlineStore'
import { getShape } from '@/lib/shape-library'
import { mintIds, ADJUSTMENTS_OFF, type OutlineSource } from '@/lib/effect/outline-resolve'
import type { VShape } from '@/lib/vector-core'

// F8 / inv 21 — transactional commits. The store's writers are R9 fail-closed: a commit that resolves to a
// null/non-cuttable contour must be REFUSED — the writer returns {ok:false}+reason and does NOT advance
// editor truth (committedShape/contour). Success — and the cleared (null) case — returns {ok:true} so
// void-ignoring flow callers (restoreSnap) are unaffected. This is the store-contract half of the F8 fold;
// the control-rollback / no-history-on-refusal half is covered by the descriptor commit path + live A/B.

const offAdj = () => ({ global: { ...ADJUSTMENTS_OFF.global }, local: {} })

/** A real, cuttable square source (well above any min-feature/size floor). */
const validSource = (): OutlineSource => ({
  shape: mintIds(getShape('square', 1000, 1000)),
  klass: 'stock',
  mmPerPx: 0.2,
  maskHeightPx: 1000,
})

/** A self-intersecting bowtie (the KAI-9077 R9 path): 4 real anchors so resolve() passes, but the ring
 *  self-intersects so assertContourCuttable refuses it. */
const bowtieSource = (): OutlineSource => ({
  shape: {
    paths: [{
      anchors: [
        { p: { x: 0, y: 0 }, hIn: null, hOut: null, corner: true },
        { p: { x: 100, y: 100 }, hIn: null, hOut: null, corner: true },
        { p: { x: 100, y: 0 }, hIn: null, hOut: null, corner: true },
        { p: { x: 0, y: 100 }, hIn: null, hOut: null, corner: true },
      ],
    }],
  } as VShape,
  klass: 'stock',
  mmPerPx: 0.2,
  maskHeightPx: 1000,
})

beforeEach(() => {
  useOutlineStore.setState({ source: null, adjustments: offAdj(), committedShape: null, committedContourMM: null, spec: null })
})

describe('outlineStore — F8 transactional commits (inv 21, R9 fail-closed)', () => {
  it('setSource(valid) → {ok:true} and advances editor truth', () => {
    const r = useOutlineStore.getState().setSource(validSource())
    expect(r.ok).toBe(true)
    expect(useOutlineStore.getState().committedShape).not.toBeNull()
    expect(useOutlineStore.getState().committedContourMM).not.toBeNull()
  })

  it('setSource(null) → {ok:true} and clears truth (cleared case stays ok so flow restores are unaffected)', () => {
    useOutlineStore.getState().setSource(validSource())
    const r = useOutlineStore.getState().setSource(null)
    expect(r.ok).toBe(true)
    expect(useOutlineStore.getState().committedShape).toBeNull()
  })

  it('setSource(non-cuttable) → {ok:false}+reason and does NOT advance truth (R9 refusal)', () => {
    // establish a valid baseline first
    useOutlineStore.getState().setSource(validSource())
    const baseline = useOutlineStore.getState().committedShape
    expect(baseline).not.toBeNull()
    // a refused commit must leave the prior truth intact
    const r = useOutlineStore.getState().setSource(bowtieSource())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/not-cuttable|null-contour/)
    expect(useOutlineStore.getState().committedShape).toBe(baseline) // unchanged — never advanced past the bad projection
  })

  it('setAdjustments with no source → {ok:true} (no truth to desync)', () => {
    const r = useOutlineStore.getState().setAdjustments(offAdj())
    expect(r.ok).toBe(true)
  })

  it('setAdjustments(off) on a valid source → {ok:true} (all-off === source)', () => {
    useOutlineStore.getState().setSource(validSource())
    const r = useOutlineStore.getState().setAdjustments(offAdj())
    expect(r.ok).toBe(true)
    expect(useOutlineStore.getState().committedShape).not.toBeNull()
  })
})
