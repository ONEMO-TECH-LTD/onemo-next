// library/band-ranges.ts — WHAT SIZE EACH CLASS IS, PER BAND.
//
// The band is the skeleton: the legal span the magnets occupy, in 48mm steps (spec owns the
// ranges). The body is the shape, and every class wears a different body over the same skeleton —
// a square's 3×3 outline is 120mm, a diamond's is 130, a triangle's runs 135–159. This is that
// table, so the sizer can be told "class X, band 3" and get the sizes worth searching.
//
// DERIVED, never declared. Each class already defines its size through its own frames and its own
// outline recipe; writing the numbers out again would be a second home for one fact, and the two
// would disagree the first time a corpus changed. The class IS the declaration — this reads it.

import { catalogue } from './catalogue'
import { aspectOf, bandIdOfMM, legalExtentMM } from './rules'
import type { LibraryFamily } from './types'

export interface ClassBandRange {
  readonly classId: LibraryFamily
  readonly bandId: number
  /** The skeleton: the legal span this band's layouts occupy. */
  readonly legalMinMM: number
  readonly legalMaxMM: number
  /** The body: outline sizes this class needs to wrap those layouts. */
  readonly outlineMinMM: number
  readonly outlineMaxMM: number
  /** The allowance this class wears — how much outline it adds over its own skeleton. */
  readonly allowanceMinMM: number
  readonly allowanceMaxMM: number
  /** The legal-box ratios these layouts occupy — the key a shape's own legal box matches against.
   *  Infinity where a layout is a single line of magnets and has no width. */
  readonly aspectMin: number
  readonly aspectMax: number
  readonly layouts: number
}

const round = (n: number) => Math.round(n * 10) / 10

/** Every class's size range per band, at one pitch. Bands a class does not reach are absent —
 *  an absent cell is an answer ("this class has no layout at that skeleton"), not a gap. */
export function classBandRanges(pitchMM: number): readonly ClassBandRange[] {
  const cells = new Map<string, { classId: LibraryFamily; bandId: number; legal: number[]; outline: number[]; aspect: number[] }>()
  for (const entry of catalogue(pitchMM)) {
    if (entry.bandId === null) continue
    const key = entry.classId + '|' + entry.bandId
    let cell = cells.get(key)
    if (!cell) {
      cell = { classId: entry.classId, bandId: entry.bandId, legal: [], outline: [], aspect: [] }
      cells.set(key, cell)
    }
    cell.legal.push(legalExtentMM(entry.nodesMM))
    cell.outline.push(Math.max(entry.widthMM, entry.heightMM))
    cell.aspect.push(aspectOf(entry.legalWidthMM, entry.legalHeightMM))
  }
  return Object.freeze([...cells.values()]
    .sort((a, b) => a.bandId - b.bandId || a.classId.localeCompare(b.classId))
    .map((cell) => {
      const allowances = cell.outline.map((o, i) => o - cell.legal[i])
      return Object.freeze({
        classId: cell.classId,
        bandId: cell.bandId,
        legalMinMM: round(Math.min(...cell.legal)),
        legalMaxMM: round(Math.max(...cell.legal)),
        outlineMinMM: round(Math.min(...cell.outline)),
        outlineMaxMM: round(Math.max(...cell.outline)),
        allowanceMinMM: round(Math.min(...allowances)),
        allowanceMaxMM: round(Math.max(...allowances)),
        aspectMin: round(Math.min(...cell.aspect)),
        aspectMax: round(Math.max(...cell.aspect)),
        layouts: cell.outline.length,
      })
    }))
}

/** The sizes worth searching for one class in one band — null where that class has no layout
 *  at that skeleton. This is what the classifier hands the sizer. */
export function sizeRangeForBand(
  classId: LibraryFamily, bandId: number, pitchMM: number,
): { minMM: number; maxMM: number } | null {
  const cell = classBandRanges(pitchMM).find((r) => r.classId === classId && r.bandId === bandId)
  return cell ? { minMM: cell.outlineMinMM, maxMM: cell.outlineMaxMM } : null
}

export { bandIdOfMM }
