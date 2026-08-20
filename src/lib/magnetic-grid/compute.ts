export { bbox, latticeAt, latticeOver, parityPhases, scaleContour } from './compute/seat'
export {
  allMasses, centreMeasurements, centroidOf, coreCentre,
  exactBoxCentre, exactCentreEvidence, exactWeightCentre,
  type ExactCentreEvidence, type ExactIsland, type MeasuredRegion,
} from './compute/centre-evidence'
export { exactContour, toUnits, type ExactContour } from './compute/clearance'
// The one arithmetic Logic may import: a neutral exact ordering that knows no law and no geometry.
export { compareExact } from './compute/exact-real'
