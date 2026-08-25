// library/rules.ts — CLASS POLICY: sub-types, orientation, box measurement, labelling.
// The view asks these; it never tests 'is this a diamond'. Shared with the classifier bridge.

import { MIN_LIB_MM, type LibraryFamily } from './types'

/** The class floor: an n-line axis starts at 24mm and grows one pitch per extra line. */
const boxByClassFloor = (cols: number, rows: number, pitchMM: number) =>
  ({ w: MIN_LIB_MM + (cols - 1) * pitchMM, h: MIN_LIB_MM + (rows - 1) * pitchMM })

/** THE CLASS RULES — one description per class, read by the panel AND available to the
 *  classifier bridge. No class logic lives in the UI (Dan, 08-25): the view asks these, it
 *  never asks 'is this a diamond'. */
export interface ClassRules {
  /** Sub-types offered, in order. One entry means a single fixed type. */
  subs: string[]
  /** Which sub a frame belongs to. */
  subOf: (cols: number, rows: number) => string
  /** Does this class have a portrait/landscape orientation, or is it square by nature? */
  orientable: boolean
  /** The frame's outer box in mm — the class floor, or the wrapping rule the class needs. */
  boxMM: (cols: number, rows: number, pitchMM: number, padMM: number) => { w: number; h: number }
  /** How a frame is labelled to a human. */
  label: (cols: number, rows: number) => string
}

export const CLASS_RULES: Record<LibraryFamily, ClassRules> = {
  square: {
    subs: ['box'],
    subOf: () => 'box',
    orientable: false,
    boxMM: (c, r, pitch) => boxByClassFloor(c, r, pitch),
    label: (c, r) => c + '×' + r,
  },
  rectangle: {
    subs: ['frame', 'banner', 'slim'],
    subOf: (c, r) => (Math.min(c, r) <= 1 ? 'slim' : Math.min(c, r) === 2 ? 'banner' : 'frame'),
    orientable: true,
    boxMM: (c, r, pitch) => boxByClassFloor(c, r, pitch),
    label: (c, r) => c + '×' + r,
  },
  diamond: {
    subs: ['rhomb'],
    subOf: () => 'rhomb',
    orientable: false,
    // the outline WRAPS the ring: half-diagonal = ring radius + padding on the diagonal
    boxMM: (c, _r, pitch, pad) => {
      const span = 2 * (((c - 1) / 2) * pitch + pad * Math.SQRT2)
      return { w: span, h: span }
    },
    label: (c) => { const side = (c - 1) / 2 + 1; return side + '×' + side },
  },
}

/** How a frame reads to a human, per its class. One call site for every label in the panel. */
export function frameLabel(family: LibraryFamily, cols: number, rows: number): string {
  return CLASS_RULES[family].label(cols, rows)
}
