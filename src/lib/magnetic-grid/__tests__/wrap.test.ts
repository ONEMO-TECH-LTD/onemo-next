import { describe, expect, it } from 'vitest'
import { canonicalExact,rational } from '../compute/exact-real'
import { measureWrap, prepareContour } from '../compute/contact-root'
import { certifyContactWitness, contourBoundaryTruth } from '../compute/identity'
import { evaluateWrap } from '../logic'
import { computeGrid } from '../engine'
import type { Contour } from '../spec'

const square = (side: number): Contour => ({
  outer: { pts: [[-side / 2, -side / 2], [side / 2, -side / 2], [side / 2, side / 2], [-side / 2, side / 2]] },
  holes: [],
})

const diamond = (axisRadius: number): Contour => ({
  outer: { pts: [[0, axisRadius], [axisRadius, 0], [0, -axisRadius], [-axisRadius, 0]] },
  holes: [],
})

const baseConfig = { paddingMM: 12, centreMode: 0, perimeterOnly: true } as const

describe('v3.5.1 exact Wrap', () => {
  it('accepts square24 at flap 0 with a stored exact segment witness', () => {
    const grid = computeGrid(square(24), { ...baseConfig, flapMM: 0, wrapMode: 'fixed' })
    expect(grid.wrap.status).toBe('lawful')
    if (grid.wrap.status !== 'lawful') return
    expect(grid.wrap.requiredFlap).toEqual({ numerator: '0', denominator: '1' })
    expect(grid.wrap.witnesses).toHaveLength(4)
    expect(new Set(grid.wrap.witnesses.map((witness) => witness.beltAnchorId)).size).toBe(1)
    expect(new Set(grid.wrap.witnesses.map((witness) => witness.outlineElementId)).size).toBe(4)
    for (const witness of grid.wrap.witnesses) {
      expect(witness.scale.approximateMM).toBe(24)
      expect(witness.boundaryTruth.rule).toBe('supplied-final-contour')
      expect(witness.boundaryTruth.contourIdentity).toMatch(/^[0-9a-f]{64}$/)
      expect(witness.outlineElementKind).toBe('segment')
      expect(witness.equation.kind).toBe('polynomial')
      if(witness.equation.kind==='polynomial')expect(witness.equation.polynomial.length).toBeGreaterThan(0)
      expect(witness.regimeId).toBe('fixed-size')
      expect(witness.certificateId).toMatch(/^[0-9a-f]{64}$/)
    }
    expect(grid.contactsMM).toHaveLength(grid.wrap.witnesses.length)
  })

  it('refuses the square24.1 loose near-miss at flap 0', () => {
    const grid = computeGrid(square(24.1), { ...baseConfig, flapMM: 0, wrapMode: 'fixed' })
    expect(grid.wrap.status).toBe('refused')
    if (grid.wrap.status !== 'refused') return
    expect(grid.wrap.code).toBe('WRAP_EXCEEDS_ALLOWANCE')
    expect(grid.wrap.requiredFlapApproxMM).toBeGreaterThan(0)
    expect(grid.contactsMM).toEqual([])
  })

  it('returns the exact irrational diamond18 Auto minimum and enforces its cap', () => {
    const lawful = computeGrid(diamond(18), { ...baseConfig, wrapMode: 'auto', autoFlapCapMM: 1 })
    expect(lawful.wrap.status).toBe('lawful')
    if (lawful.wrap.status !== 'lawful') return
    expect('polynomial' in lawful.wrap.appliedFlap).toBe(true)
    expect(lawful.wrap.appliedFlapApproxMM).toBeCloseTo(18 / Math.sqrt(2) - 12, 14)

    const refused = computeGrid(diamond(18), { ...baseConfig, wrapMode: 'auto', autoFlapCapMM: 0.7 })
    expect(refused.wrap.status).toBe('refused')
  })

  it('measures Wrap on the perimeter belt regardless of output coverage', () => {
    const perimeter = computeGrid(square(120), { ...baseConfig, flapMM: 0, wrapMode: 'fixed', perimeterOnly: true })
    const full = computeGrid(square(120), { ...baseConfig, flapMM: 0, wrapMode: 'fixed', perimeterOnly: false })
    expect(canonicalExact(perimeter.wrap.requiredFlap)).toBe(canonicalExact(full.wrap.requiredFlap))
    const perimeterIds = [...new Set(perimeter.wrap.witnesses.map((witness) => witness.beltAnchorId))]
    const fullIds = [...new Set(full.wrap.witnesses.map((witness) => witness.beltAnchorId))]
    expect(perimeterIds).toHaveLength(perimeter.anchors.length)
    expect(fullIds).toHaveLength(perimeter.anchors.length)
    expect(perimeterIds).toEqual(fullIds)
    for (const anchorId of perimeterIds) {
      expect(perimeter.wrap.witnesses.filter((witness) => witness.beltAnchorId === anchorId).length).toBeGreaterThan(0)
      expect(full.wrap.witnesses.filter((witness) => witness.beltAnchorId === anchorId).length).toBeGreaterThan(0)
    }
  })

  it('uses the complete supplied boundary, including holes, and keeps the hole binder', () => {
    const holed: Contour = {
      outer: { pts: [[-20,-20],[20,-20],[20,20],[-20,20]] },
      holes: [{ pts: [[-5,-5],[5,-5],[5,5],[-5,5]] }],
    }
    const prepared=prepareContour(holed,contourBoundaryTruth(holed))
    const measured=measureWrap(prepared,[[0,10]],4)
    const witnesses=measured.witnesses.map(certifyContactWitness)
    expect(measured.refusal).toBeNull()
    expect(measured.requiredFlapApproxMM).toBe(1)
    expect(witnesses).toHaveLength(1)
    expect(witnesses[0].outlineElementId).toMatch(/^hole:0:segment:/)
    expect(witnesses[0].boundaryTruth).toEqual(prepared.truth)
  })

  it('fails closed for a hole/overlap seat, empty belt and degenerate boundary', () => {
    const holed: Contour = {
      outer: { pts: [[-20,-20],[20,-20],[20,20],[-20,20]] },
      holes: [{ pts: [[-5,-5],[5,-5],[5,5],[-5,5]] }],
    }
    const prepared=prepareContour(holed,contourBoundaryTruth(holed))
    expect(measureWrap(prepared,[[0,0]],4).refusal).toEqual({code:'WRAP_EXCEEDS_ALLOWANCE',reason:'invalid-seat'})
    expect(measureWrap(prepared,[],4).refusal).toEqual({code:'NO_WRAPPED_LAYOUT_IN_BAND',reason:'empty-belt'})
    const degenerate:Contour={outer:{pts:[]},holes:[]}
    expect(measureWrap(prepareContour(degenerate,contourBoundaryTruth(degenerate)),[[0,0]],4).refusal)
      .toEqual({code:'NO_WRAPPED_LAYOUT_IN_BAND',reason:'invalid-boundary'})
  })

  it('keeps anchor and co-binding identities stable when belt enumeration reverses',()=>{
    const contour=square(72),prepared=prepareContour(contour,contourBoundaryTruth(contour)),belt:[[number,number],[number,number]]=[[ -24,-24],[24,24]]
    const map=(ordered:typeof belt)=>{
      const witnesses=measureWrap(prepared,ordered,12).witnesses.map(certifyContactWitness),out=new Map<string,string[]>()
      for(const witness of witnesses){const ids=out.get(witness.beltAnchorId)??[];ids.push(witness.outlineElementId);out.set(witness.beltAnchorId,ids.sort())}
      return [...out.entries()].sort(([a],[b])=>a.localeCompare(b))
    }
    expect(map(belt)).toEqual(map([...belt].reverse() as typeof belt))
    expect(map(belt).every(([,binders])=>binders.length===2)).toBe(true)
  })
  it('never lets the report-only decimal decide the law',()=>{
    const contour=square(25),prepared=prepareContour(contour,contourBoundaryTruth(contour)),raw=measureWrap(prepared,[[0,0]],12)
    const measured={...raw,witnesses:raw.witnesses.map(certifyContactWitness)}
    const policy={mode:'fixed' as const,allowance:rational(0),allowanceApproxMM:0}
    expect(evaluateWrap(measured,policy).status).toBe('refused')
    expect(evaluateWrap({...measured,requiredFlapApproxMM:-999},policy).status).toBe('refused')
  })
})
