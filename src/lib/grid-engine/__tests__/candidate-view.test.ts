// The four assertions agreed for the candidate diagnostic, before it was built.
//
// They are about the SHELL's behaviour, and this repo has no React test environment — adding one is
// a structural change that is not this installation's to make. So the transitions live as plain
// data in `candidate-view` and are asserted directly. A promise that a handler is disabled is not
// evidence; a refused transition is.

import { describe, expect, it } from 'vitest'
import {
  applyPan,
  clearSelection,
  CLOSED,
  isDragEnabled,
  selectCandidate,
  solveKey,
  stepCandidate,
} from '../../../app/(dev)/grid-engine/candidate-view'
import { layoutField, solveCandidates } from '../bridge'
import { RELEASED } from '../spec'

const ring = {
  points: [
    [0.5, 0.5],
    [199.5, 0.5],
    [199.5, 199.5],
    [0.5, 199.5],
  ] as ReadonlyArray<readonly [number, number]>,
  width: 200,
  height: 200,
}

describe('assertion 1 — an attempted drag while a candidate is selected changes nothing', () => {
  it('leaves pan at the origin and the drag disabled', () => {
    const open = selectCandidate(CLOSED, 3)
    expect(isDragEnabled(open)).toBe(false)

    const dragged = applyPan(open, [37, -12])
    expect(dragged.panMM).toEqual([0, 0])
    expect(dragged).toBe(open) // refused, not re-derived
  })

  it('and the same drag DOES move the lattice when nothing is selected', () => {
    // The pair is what makes assertion 1 meaningful. A state that ignores every pan would satisfy
    // the first half while breaking the field.
    const dragged = applyPan(CLOSED, [37, -12])
    expect(isDragEnabled(CLOSED)).toBe(true)
    expect(dragged.panMM).toEqual([37, -12])
  })

  it('entering the view resets a pan that was already applied', () => {
    const panned = applyPan(CLOSED, [96, 48])
    expect(panned.panMM).toEqual([96, 48])
    expect(selectCandidate(panned, 0).panMM).toEqual([0, 0])
  })
})

describe('assertion 2 — stepping changes only which candidate is shown', () => {
  it('moves the index and touches nothing else', () => {
    const open = selectCandidate(CLOSED, 0)
    const next = stepCandidate(open, 5, 1)
    expect(next.selected).toBe(1)
    expect(next.panMM).toEqual(open.panMM)
    expect(Object.keys(next).sort()).toEqual(Object.keys(open).sort())
  })

  it('wraps in both directions rather than running off the end', () => {
    const open = selectCandidate(CLOSED, 0)
    expect(stepCandidate(open, 5, -1).selected).toBe(4)
    expect(stepCandidate({ ...open, selected: 4 }, 5, 1).selected).toBe(0)
  })

  it('the solve key excludes the selection and the pan — so browsing cannot re-solve', () => {
    // This is the executable form of "stepping calls the seam zero times": the engine is re-solved
    // for the ring, the size and the spec, and those are the only things in the key.
    const key = solveKey('ring-a', 300, 48, 12, 9, 'point')
    expect(key).toBe(solveKey('ring-a', 300, 48, 12, 9, 'point'))
    expect(key).not.toContain('selected')
    // every input that SHOULD re-solve does
    expect(solveKey('ring-b', 300, 48, 12, 9, 'point')).not.toBe(key)
    expect(solveKey('ring-a', 301, 48, 12, 9, 'point')).not.toBe(key)
    expect(solveKey('ring-a', 300, 96, 12, 9, 'point')).not.toBe(key)
    expect(solveKey('ring-a', 300, 48, 13, 9, 'point')).not.toBe(key)
    expect(solveKey('ring-a', 300, 48, 12, 8, 'point')).not.toBe(key)
    expect(solveKey('ring-a', 300, 48, 12, 9, 'gap')).not.toBe(key)
  })
})

describe('assertion 3 — clearing the selection restores the drag', () => {
  it('closes the view and lets the lattice move again', () => {
    const open = selectCandidate(CLOSED, 2)
    expect(isDragEnabled(open)).toBe(false)

    const closed = clearSelection(open)
    expect(closed.selected).toBeNull()
    expect(isDragEnabled(closed)).toBe(true)
    expect(applyPan(closed, [24, 24]).panMM).toEqual([24, 24])
  })

  it('clearing an already-closed view is a no-op rather than a reset', () => {
    const panned = applyPan(CLOSED, [10, 10])
    expect(clearSelection(panned)).toBe(panned)
  })
})

describe('assertion 4 — the highlighted candidate sits on the drawn magnets', () => {
  it('every selected centre coincides exactly with a magnet the canvas draws', () => {
    const solved = solveCandidates(RELEASED, ring, 300)
    expect(solved.candidates.candidates.length).toBeGreaterThan(0)

    // What the canvas draws: the bridge's own layout at the frozen origin the diagnostic uses.
    const drawn = layoutField(RELEASED, { x: 0, y: 0, w: 0, h: 0 }, [0, 0])
    const drawnKeys = new Set(drawn.magnets.map(([x, y]) => `${x},${y}`))
    expect(drawnKeys.size).toBeGreaterThan(0)

    for (const entry of solved.display) {
      for (const [x, y] of entry.centresMM) {
        expect(
          drawnKeys.has(`${x},${y}`),
          `candidate ${entry.candidateId} centre ${x},${y} is not a drawn magnet centre`,
        ).toBe(true)
      }
    }
  })
})

describe('the ranking layer reports its gap by name and is never called', () => {
  it('names exactly what part 3 requires and does not have', () => {
    const solved = solveCandidates(RELEASED, ring, 300)
    expect(solved.productLogic.kind).toBe('unavailable')
    expect(solved.productLogic.missingInputs.length).toBeGreaterThan(0)
    for (const missing of solved.productLogic.missingInputs) {
      expect(missing).toMatch(/gravity|tightWrap|regionalSupport|bands|judgements/)
    }
    // no ranking, no tiers, no winner anywhere in the result
    expect(JSON.stringify(solved)).not.toMatch(/"tiers"|"ordering"|"winner"|"ranked"/)
  })
})
