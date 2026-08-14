// The candidate diagnostic's view state — the shell's own presentation logic, and nothing else.
//
// PURE ON PURPOSE. The agreed gate for this step asserts behaviour the shell owns: that panning is
// impossible while a candidate is shown, that stepping never re-solves, and that clearing gives the
// drag back. This repo has no React test environment, and adding one is a structural change that is
// not this installation's to make — so the transitions live here as plain data and are tested
// directly, rather than being asserted about in prose.
//
// It holds no geometry, no law value and no engine call. It decides which candidate is on screen.

/** Nothing selected: the field behaves exactly as it always has, drag included. */
export interface CandidateViewState {
  /** Which candidate is on screen, or null when the diagnostic is closed. */
  readonly selected: number | null
  /** Where the lattice sits, in millimetres. Frozen at the origin while a candidate is shown. */
  readonly panMM: readonly [number, number]
}

export const CLOSED: CandidateViewState = Object.freeze({
  selected: null,
  panMM: Object.freeze([0, 0]) as readonly [number, number],
})

/**
 * THE WHOLE REASON PAN IS FROZEN. Live pan in the solve input would make the candidate document
 * depend on every pointer move: re-solving mid-drag re-runs the kernel's quadratic polygon
 * validation, and not re-solving leaves the candidates describing a lattice that has moved. Sliding
 * the highlights instead only looks right — which positions actually hold changes when the lattice
 * moves under a fixed shape, so it would draw discs on spots that no longer hold.
 *
 * So the lattice holds still while candidates are on screen, and browsing them is free.
 */
export const isDragEnabled = (state: CandidateViewState): boolean => state.selected === null

/** Open the diagnostic at a candidate. Pan returns to the origin and the drag goes away. */
export function selectCandidate(state: CandidateViewState, index: number): CandidateViewState {
  if (!Number.isInteger(index) || index < 0) return state
  return { selected: index, panMM: [0, 0] }
}

/** Close it. The drag comes back, and pan stays where the frozen view left it — at the origin. */
export function clearSelection(state: CandidateViewState): CandidateViewState {
  return state.selected === null ? state : { selected: null, panMM: state.panMM }
}

/**
 * Step through the set, wrapping. Changes the INDEX and nothing else: no solve, no pan, no spec.
 * `total` is the candidate count the bridge returned on this render.
 */
export function stepCandidate(
  state: CandidateViewState,
  total: number,
  delta: number,
): CandidateViewState {
  if (state.selected === null || total <= 0) return state
  const next = (((state.selected + delta) % total) + total) % total
  return { ...state, panMM: state.panMM, selected: next }
}

/**
 * A drag arriving while a candidate is shown is REFUSED, not applied. Returning the same state is
 * what makes "an attempted drag leaves pan at the origin" a fact rather than a promise about the
 * surface remembering to disable a handler.
 */
export function applyPan(
  state: CandidateViewState,
  panMM: readonly [number, number],
): CandidateViewState {
  if (!isDragEnabled(state)) return state
  return { ...state, panMM }
}

/**
 * What the engine is re-solved for. Deliberately excludes the selection and the pan: those are how
 * you LOOK at an answer, not what the answer depends on. A change here is a re-solve; a change
 * outside it never is.
 */
export function solveKey(
  ringId: string,
  sizeMM: number,
  pitchMM: number,
  paddingMM: number,
  positionsPerAxis: number,
  registration: string,
): string {
  return [ringId, sizeMM, pitchMM, paddingMM, positionsPerAxis, registration].join('|')
}
