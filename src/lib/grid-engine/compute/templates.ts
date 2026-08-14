// compute/templates.ts — place a released layout template as a v1 GridConstruction.
//
// The verbatim engine's CATALOGUE DOOR (grid-core: `cfg.construction`) validates and delivers an
// explicit lattice population without re-solving — padding, on-lattice and overlap checks are the
// engine's own. This helper only assembles that construction: origin plus whole-lattice steps.
// Pure arithmetic, no values, no judgement.

import type { GridConstruction } from './grid-core'
import type { Pt } from './types'

export function placeTemplate(
  originMM: Pt,
  steps: ReadonlyArray<readonly [number, number]>,
  basePitchMM: number,
): GridConstruction {
  return {
    pattern: 'standard',
    pitchMM: basePitchMM,
    originMM: [originMM[0], originMM[1]],
    basisMM: [
      [basePitchMM, 0],
      [0, basePitchMM],
    ],
    population: steps.map(([across, down]) => [across, down] as [number, number]),
  }
}
