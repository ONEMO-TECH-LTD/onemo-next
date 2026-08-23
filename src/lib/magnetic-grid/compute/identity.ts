import type { BoundaryTruth, Contour } from '../spec'

/** A contour's identity is its canonical ordered coordinate string — outer ring then each hole, as supplied. */
function contourIdentity(contour: Contour): string {
  return JSON.stringify([['outer', contour.outer.pts], ...contour.holes.map((hole, index) => [`hole:${index}`, hole.pts])])
}
export const contourBoundaryTruth = (contour: Contour): BoundaryTruth => ({
  rule: 'supplied-final-contour',
  contourIdentity: contourIdentity(contour),
})
