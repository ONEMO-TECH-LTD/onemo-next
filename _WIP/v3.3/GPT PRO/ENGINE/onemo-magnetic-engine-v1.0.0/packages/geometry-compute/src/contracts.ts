export type Exactness = 'EXACT' | 'CERTIFIED_APPROXIMATE' | 'INDETERMINATE';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface IntPoint {
  readonly x: number;
  readonly y: number;
}

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface Edge {
  readonly a: Point;
  readonly b: Point;
  readonly index: number;
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly dx: number;
  readonly dy: number;
  readonly lengthSquared: number;
}

export interface PolygonMetrics {
  readonly bounds: Bounds;
  readonly width: number;
  readonly height: number;
  readonly dominantDimension: number;
  readonly signedArea: number;
  readonly area: number;
  readonly centroid: Point;
  readonly boundsCenter: Point;
  readonly centroidInside: boolean;
  readonly vertexCount: number;
  readonly edgeCount: number;
}

export interface PreparedPolygon {
  readonly kind: 'PreparedPolygon';
  readonly quantumMm: number;
  readonly ringInt: readonly IntPoint[];
  readonly ringMm: readonly Point[];
  readonly edges: readonly Edge[];
  readonly metrics: PolygonMetrics;
  readonly geometryHash: string;
  readonly artifactHash: string;
}

export type PointLocation = 'INSIDE' | 'OUTSIDE' | 'BOUNDARY';

export interface ClearanceResult {
  readonly point: Point;
  readonly location: PointLocation;
  readonly signedClearanceMm: number;
  readonly clearanceMm: number;
  readonly nearestBoundaryPoint: Point;
  readonly nearestEdgeIndex: number;
  readonly exactness: Exactness;
}

export interface DiscContainmentResult extends ClearanceResult {
  readonly radiusMm: number;
  readonly marginMm: number;
  readonly legal: boolean;
  readonly exactAtQuantum: boolean;
}

export interface AdaptiveOptions {
  readonly toleranceMm: number;
  readonly maxCells: number;
  readonly quantumMm: number;
  readonly maxDepth?: number;
  readonly witnessIterations?: number;
}

export type BoxStatus = 'INSIDE' | 'OUTSIDE' | 'BOUNDARY';

export interface AdaptiveBox extends Bounds {
  readonly depth: number;
  readonly status: BoxStatus;
  readonly id: string;
}

export interface FeasibleTranslationSet {
  readonly domain: Bounds;
  readonly insideBoxes: readonly AdaptiveBox[];
  readonly boundaryBoxes: readonly AdaptiveBox[];
  readonly witnessPoints: readonly Point[];
  readonly status: 'FEASIBLE' | 'INFEASIBLE_CERTIFIED' | 'INDETERMINATE_WITHIN_TOLERANCE';
  readonly toleranceMm: number;
  readonly cellsVisited: number;
  readonly maxDepthReached: number;
  readonly exactness: Exactness;
}

export interface SafeGridCell {
  readonly ix: number;
  readonly iy: number;
  readonly centre: Point;
  readonly clearanceMm: number;
  readonly levelMask: number;
}

export interface SafeComponent {
  readonly id: string;
  readonly levelIndex: number;
  readonly radiusMm: number;
  readonly cellCount: number;
  readonly areaEstimateMm2: number;
  readonly bounds: Bounds;
  readonly centroid: Point;
  readonly maxClearanceMm: number;
  readonly cells: readonly number[];
  readonly parentId?: string;
  readonly childIds: readonly string[];
  readonly nearToleranceBoundary: boolean;
}

export interface ComponentHierarchy {
  readonly bounds: Bounds;
  readonly stepMm: number;
  readonly levelsMm: readonly number[];
  readonly cells: readonly SafeGridCell[];
  readonly components: readonly SafeComponent[];
  readonly errorEnvelopeMm: number;
  readonly exactness: Exactness;
}

export interface LatticePoint extends Point {
  readonly i: number;
  readonly j: number;
}

export interface DirectionalCapMetrics {
  readonly direction: Point;
  readonly polygonMin: number;
  readonly polygonMax: number;
  readonly anchorMin: number;
  readonly anchorMax: number;
  readonly positiveUnsupportedExtentMm: number;
  readonly negativeUnsupportedExtentMm: number;
  readonly positiveCapAreaMm2: number;
  readonly negativeCapAreaMm2: number;
  readonly positiveCapCentroid: Point | null;
  readonly negativeCapCentroid: Point | null;
  readonly positiveFirstMomentMm3: number;
  readonly negativeFirstMomentMm3: number;
}

export interface ScoreInterval {
  readonly lower: number;
  readonly upper: number;
}

export interface CompoundScoreInterval {
  readonly components: readonly ScoreInterval[];
}

export type CriterionComparator = 'MIN' | 'MAX' | 'LEX_MIN_MAX' | 'LEX_MAX_MIN' | 'LEX_ASC';

export type GeometryCriterionDescriptor =
  | { readonly id: 'REGION_COVERAGE_V1'; readonly regions: readonly RegionEvidence[] }
  | { readonly id: 'REGION_SUBSET_COVERAGE_V1'; readonly regions: readonly RegionEvidence[]; readonly subsetIds: readonly string[] }
  | { readonly id: 'CAP_FIRST_MOMENT_V1'; readonly direction: Point }
  | { readonly id: 'MAX_DIRECTIONAL_OVERHANG_V1'; readonly directions: readonly Point[] }
  | { readonly id: 'DISCRETE_SCALAR_V1'; readonly value: number; readonly comparator: 'MIN' | 'MAX' }
  | { readonly id: 'REGION_MAX_LOAD_V1'; readonly regions: readonly RegionEvidence[] }
  | { readonly id: 'ANCHOR_CENTROID_BALANCE_V1'; readonly materialCentroid: Point; readonly lateralDirection: Point }
  | { readonly id: 'POINT_COUNT_V1'; readonly count: number }
  | { readonly id: 'DISCRETE_KEY_V1'; readonly key: readonly (string | number)[] }
  | { readonly id: 'FINAL_REGISTRATION_ORDER_V1'; readonly canonicalTarget: Point };

export interface RegionEvidence {
  readonly id: string;
  readonly bounds: Bounds;
  readonly gridOrigin: Point;
  readonly cellStepMm: number;
  readonly occupiedCellKeys: ReadonlySet<string>;
}

export interface CriterionEvaluation {
  readonly descriptorId: GeometryCriterionDescriptor['id'];
  readonly score: ScoreInterval | CompoundScoreInterval;
  readonly exactness: Exactness;
  readonly unit: string;
  readonly witness?: Point;
}

export interface CandidateBoxEvaluation {
  readonly box: AdaptiveBox;
  readonly evaluation: CriterionEvaluation;
}

export interface OptimizationResult {
  readonly descriptorId: GeometryCriterionDescriptor['id'];
  readonly survivingBoxes: readonly AdaptiveBox[];
  readonly witnessPoints: readonly Point[];
  readonly optimum: ScoreInterval | CompoundScoreInterval;
  readonly status: 'CERTIFIED' | 'INDETERMINATE_WITHIN_TOLERANCE';
  readonly refinements: number;
}

export interface FinalTieBreakResult {
  readonly status: 'SELECTED' | 'FEASIBLE_BELOW_OUTPUT_QUANTUM' | 'INDETERMINATE_WITHIN_TOLERANCE';
  readonly point?: Point;
  readonly canonicalDistanceSquared?: number;
  readonly attemptedPoints: number;
}

export type ComputeErrorCode =
  | 'INVALID_OUTLINE'
  | 'SELF_INTERSECTION'
  | 'NUMERIC_OVERFLOW'
  | 'UNSUPPORTED_QUANTUM'
  | 'INVALID_RADIUS'
  | 'INVALID_DIRECTION'
  | 'UNSUPPORTED_CRITERION_DESCRIPTOR'
  | 'INVALID_LATTICE_BASIS'
  | 'BACKEND_NOT_INITIALISED'
  | 'BACKEND_FAILURE'
  | 'APPROXIMATION_CONTRACT_BREACH'
  | 'INDETERMINATE_WITHIN_TOLERANCE'
  | 'FEASIBLE_BELOW_OUTPUT_QUANTUM'
  | 'EXACT_REVALIDATION_FAILED'
  | 'RESOURCE_LIMIT_EXCEEDED';

export class ComputeError extends Error {
  public readonly code: ComputeErrorCode;
  public readonly details: Readonly<Record<string, unknown>>;

  public constructor(code: ComputeErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ComputeError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}
