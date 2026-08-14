import {
  compareFractions,
  makeRational,
  rationalJson,
  rationalPointJson,
  type Rational,
  type RationalPoint,
} from "./arithmetic.js";
import type {
  BoundaryFeatureJson,
  CapsuleBoundaryContactJson,
  PointBoundaryContactJson,
  PointLocation,
  SqrtRationalJson,
} from "./types.js";

export interface WorkPoint {
  readonly x: bigint;
  readonly y: bigint;
}

export interface WorkEdge {
  readonly index: number;
  readonly startVertexIndex: number;
  readonly endVertexIndex: number;
  readonly a: WorkPoint;
  readonly b: WorkPoint;
  readonly minX: bigint;
  readonly maxX: bigint;
  readonly minY: bigint;
  readonly maxY: bigint;
}

interface WorkBounds {
  readonly minX: bigint;
  readonly maxX: bigint;
  readonly minY: bigint;
  readonly maxY: bigint;
}

interface WorkSpatialLeaf extends WorkBounds {
  readonly kind: "leaf";
  readonly edges: readonly WorkEdge[];
}

interface WorkSpatialBranch extends WorkBounds {
  readonly kind: "branch";
  readonly left: WorkSpatialNode;
  readonly right: WorkSpatialNode;
}

type WorkSpatialNode = WorkSpatialLeaf | WorkSpatialBranch;

export interface WorkPolygon {
  readonly vertices: readonly WorkPoint[];
  readonly edges: readonly WorkEdge[];
  readonly spatialIndex: WorkSpatialNode;
}

export function buildWorkPolygon(
  vertices: readonly WorkPoint[],
  edges: readonly WorkEdge[],
): WorkPolygon {
  if (edges.length === 0) {
    throw new Error("internal invariant: a polygon has at least one edge");
  }
  return {
    vertices,
    edges,
    spatialIndex: buildSpatialNode([...edges]),
  };
}

interface WorkRationalPoint {
  readonly xNumerator: bigint;
  readonly yNumerator: bigint;
  readonly denominator: bigint;
}

interface BoundaryFeatureInternal {
  readonly kind: "edge" | "vertex";
  readonly index: number;
  readonly startVertexIndex?: number;
  readonly endVertexIndex?: number;
}

interface PointDistanceCandidate {
  readonly distanceNumerator: bigint;
  readonly distanceDenominator: bigint;
  readonly feature: BoundaryFeatureInternal;
  readonly boundaryPoint: WorkRationalPoint;
}

interface SegmentDistanceCandidate {
  readonly distanceNumerator: bigint;
  readonly distanceDenominator: bigint;
  readonly feature: BoundaryFeatureInternal;
  readonly boundaryPoint: WorkRationalPoint;
  readonly centrelinePoint: WorkRationalPoint;
}

export interface PointBoundaryMeasurement {
  readonly location: PointLocation;
  readonly squaredClearance: Rational;
  readonly clearance: SqrtRationalJson;
  readonly limitingContacts: readonly PointBoundaryContactJson[];
  /** Minimum squared distance in work-coordinate units. */
  readonly workDistanceNumerator: bigint;
  readonly workDistanceDenominator: bigint;
}

export interface SegmentBoundaryMeasurement {
  readonly squaredClearance: Rational;
  readonly clearance: SqrtRationalJson;
  readonly limitingContacts: readonly CapsuleBoundaryContactJson[];
  readonly workDistanceNumerator: bigint;
  readonly workDistanceDenominator: bigint;
}

export function locatePoint(point: WorkPoint, polygon: WorkPolygon): PointLocation {
  const result = locatePointInNode(point, polygon.spatialIndex);
  if (result.boundary) {
    return "boundary";
  }
  return result.winding === 0 ? "outside" : "inside";
}

export function measurePointBoundary(
  point: WorkPoint,
  polygon: WorkPolygon,
  workDenominator: bigint,
): PointBoundaryMeasurement {
  let minimum: PointDistanceCandidate | undefined;
  const limiting = new Map<string, PointDistanceCandidate>();

  const accept = (candidate: PointDistanceCandidate): void => {
    if (minimum === undefined) {
      minimum = candidate;
      limiting.set(featureKey(candidate.feature), candidate);
      return;
    }

    const comparison = compareFractions(
      candidate.distanceNumerator,
      candidate.distanceDenominator,
      minimum.distanceNumerator,
      minimum.distanceDenominator,
    );
    if (comparison < 0) {
      minimum = candidate;
      limiting.clear();
      limiting.set(featureKey(candidate.feature), candidate);
    } else if (comparison === 0) {
      const key = featureKey(candidate.feature);
      const existing = limiting.get(key);
      if (
        existing === undefined ||
        compareWorkPoints(candidate.boundaryPoint, existing.boundaryPoint) < 0
      ) {
        limiting.set(key, candidate);
      }
    }
  };

  const visit = (node: WorkSpatialNode): void => {
    const lowerBound = pointToBoundsSquaredDistance(point, node);
    if (minimum !== undefined && fractionExceedsCandidate(lowerBound, minimum)) {
      return;
    }

    if (node.kind === "leaf") {
      for (const edge of node.edges) {
        const edgeLowerBound = pointToBoundsSquaredDistance(point, edge);
        if (minimum !== undefined && fractionExceedsCandidate(edgeLowerBound, minimum)) {
          continue;
        }
        accept(pointToEdgeDistance(point, edge));
      }
      return;
    }

    const leftLowerBound = pointToBoundsSquaredDistance(point, node.left);
    const rightLowerBound = pointToBoundsSquaredDistance(point, node.right);
    if (leftLowerBound <= rightLowerBound) {
      visit(node.left);
      visit(node.right);
    } else {
      visit(node.right);
      visit(node.left);
    }
  };

  visit(polygon.spatialIndex);

  if (minimum === undefined) {
    throw new Error("internal invariant: a polygon has at least one edge");
  }

  const squaredClearance = makeRational(
    minimum.distanceNumerator,
    minimum.distanceDenominator * workDenominator * workDenominator,
  );
  const contacts = [...limiting.values()]
    .sort(comparePointCandidatesCanonical)
    .map((candidate) => ({
      boundaryFeature: boundaryFeatureJson(candidate.feature, polygon.vertices.length),
      boundaryPoint: workRationalPointToPhysicalJson(candidate.boundaryPoint, workDenominator),
    }));

  return {
    location: locatePoint(point, polygon),
    squaredClearance,
    clearance: {
      kind: "sqrt-rational",
      radicand: rationalJson(squaredClearance),
    },
    limitingContacts: contacts,
    workDistanceNumerator: minimum.distanceNumerator,
    workDistanceDenominator: minimum.distanceDenominator,
  };
}

export function measureSegmentBoundary(
  start: WorkPoint,
  end: WorkPoint,
  polygon: WorkPolygon,
  workDenominator: bigint,
): SegmentBoundaryMeasurement {
  let minimum: SegmentDistanceCandidate | undefined;
  const limiting = new Map<string, SegmentDistanceCandidate>();
  const centrelineBounds: WorkBounds = {
    minX: minBigInt(start.x, end.x),
    maxX: maxBigInt(start.x, end.x),
    minY: minBigInt(start.y, end.y),
    maxY: maxBigInt(start.y, end.y),
  };

  const accept = (candidate: SegmentDistanceCandidate): void => {
    if (minimum === undefined) {
      minimum = candidate;
      limiting.set(segmentCandidateKey(candidate), candidate);
      return;
    }

    const comparison = compareFractions(
      candidate.distanceNumerator,
      candidate.distanceDenominator,
      minimum.distanceNumerator,
      minimum.distanceDenominator,
    );
    if (comparison < 0) {
      minimum = candidate;
      limiting.clear();
      limiting.set(segmentCandidateKey(candidate), candidate);
    } else if (comparison === 0) {
      limiting.set(segmentCandidateKey(candidate), candidate);
    }
  };

  const visit = (node: WorkSpatialNode): void => {
    const lowerBound = aabbToAabbSquaredDistance(centrelineBounds, node);
    if (minimum !== undefined && fractionExceedsSegmentCandidate(lowerBound, minimum)) {
      return;
    }

    if (node.kind === "leaf") {
      for (const edge of node.edges) {
        const edgeLowerBound = aabbToAabbSquaredDistance(centrelineBounds, edge);
        if (minimum !== undefined && fractionExceedsSegmentCandidate(edgeLowerBound, minimum)) {
          continue;
        }
        for (const candidate of segmentToEdgeDistance(start, end, edge)) {
          accept(candidate);
        }
      }
      return;
    }

    const leftLowerBound = aabbToAabbSquaredDistance(centrelineBounds, node.left);
    const rightLowerBound = aabbToAabbSquaredDistance(centrelineBounds, node.right);
    if (leftLowerBound <= rightLowerBound) {
      visit(node.left);
      visit(node.right);
    } else {
      visit(node.right);
      visit(node.left);
    }
  };

  visit(polygon.spatialIndex);

  if (minimum === undefined) {
    throw new Error("internal invariant: a polygon has at least one edge");
  }

  const squaredClearance = makeRational(
    minimum.distanceNumerator,
    minimum.distanceDenominator * workDenominator * workDenominator,
  );
  const contacts = [...limiting.values()]
    .sort(compareSegmentCandidatesCanonical)
    .map((candidate) => ({
      boundaryFeature: boundaryFeatureJson(candidate.feature, polygon.vertices.length),
      boundaryPoint: workRationalPointToPhysicalJson(candidate.boundaryPoint, workDenominator),
      centrelinePoint: workRationalPointToPhysicalJson(candidate.centrelinePoint, workDenominator),
    }));

  return {
    squaredClearance,
    clearance: {
      kind: "sqrt-rational",
      radicand: rationalJson(squaredClearance),
    },
    limitingContacts: contacts,
    workDistanceNumerator: minimum.distanceNumerator,
    workDistanceDenominator: minimum.distanceDenominator,
  };
}

export function squaredDistanceAtLeastRadius(
  distanceNumerator: bigint,
  distanceDenominator: bigint,
  radiusWork: bigint,
): boolean {
  return distanceNumerator >= radiusWork * radiusWork * distanceDenominator;
}

const SPATIAL_LEAF_EDGE_COUNT = 8;

function buildSpatialNode(edges: WorkEdge[]): WorkSpatialNode {
  const bounds = boundsOfEdges(edges);
  if (edges.length <= SPATIAL_LEAF_EDGE_COUNT) {
    return { kind: "leaf", ...bounds, edges };
  }

  const splitOnX = bounds.maxX - bounds.minX >= bounds.maxY - bounds.minY;
  edges.sort((left, right) => {
    const leftMidpointTwice = splitOnX ? left.minX + left.maxX : left.minY + left.maxY;
    const rightMidpointTwice = splitOnX ? right.minX + right.maxX : right.minY + right.maxY;
    return leftMidpointTwice < rightMidpointTwice
      ? -1
      : leftMidpointTwice > rightMidpointTwice
        ? 1
        : left.index - right.index;
  });
  const middle = Math.floor(edges.length / 2);
  return {
    kind: "branch",
    ...bounds,
    left: buildSpatialNode(edges.slice(0, middle)),
    right: buildSpatialNode(edges.slice(middle)),
  };
}

function boundsOfEdges(edges: readonly WorkEdge[]): WorkBounds {
  const first = edges[0];
  if (first === undefined) {
    throw new Error("internal invariant: a spatial node has at least one edge");
  }
  let minX = first.minX;
  let maxX = first.maxX;
  let minY = first.minY;
  let maxY = first.maxY;
  for (let index = 1; index < edges.length; index += 1) {
    const edge = edges[index]!;
    if (edge.minX < minX) minX = edge.minX;
    if (edge.maxX > maxX) maxX = edge.maxX;
    if (edge.minY < minY) minY = edge.minY;
    if (edge.maxY > maxY) maxY = edge.maxY;
  }
  return { minX, maxX, minY, maxY };
}

function locatePointInNode(
  point: WorkPoint,
  node: WorkSpatialNode,
): { readonly boundary: boolean; readonly winding: number } {
  if (point.y < node.minY || point.y > node.maxY || point.x > node.maxX) {
    return { boundary: false, winding: 0 };
  }

  if (node.kind === "branch") {
    const left = locatePointInNode(point, node.left);
    if (left.boundary) {
      return left;
    }
    const right = locatePointInNode(point, node.right);
    return right.boundary
      ? right
      : { boundary: false, winding: left.winding + right.winding };
  }

  let winding = 0;
  for (const edge of node.edges) {
    const withinY = point.y >= edge.minY && point.y <= edge.maxY;
    if (!withinY || point.x > edge.maxX) {
      continue;
    }

    if (point.x >= edge.minX && orientation(edge.a, edge.b, point) === 0n) {
      return { boundary: true, winding: 0 };
    }

    if (edge.a.y <= point.y) {
      if (edge.b.y > point.y && orientation(edge.a, edge.b, point) > 0n) {
        winding += 1;
      }
    } else if (edge.b.y <= point.y && orientation(edge.a, edge.b, point) < 0n) {
      winding -= 1;
    }
  }
  return { boundary: false, winding };
}

function pointToBoundsSquaredDistance(point: WorkPoint, bounds: WorkBounds): bigint {
  const dx =
    point.x < bounds.minX
      ? bounds.minX - point.x
      : point.x > bounds.maxX
        ? point.x - bounds.maxX
        : 0n;
  const dy =
    point.y < bounds.minY
      ? bounds.minY - point.y
      : point.y > bounds.maxY
        ? point.y - bounds.maxY
        : 0n;
  return dx * dx + dy * dy;
}

function aabbToAabbSquaredDistance(left: WorkBounds, right: WorkBounds): bigint {
  const dx =
    left.maxX < right.minX
      ? right.minX - left.maxX
      : right.maxX < left.minX
        ? left.minX - right.maxX
        : 0n;
  const dy =
    left.maxY < right.minY
      ? right.minY - left.maxY
      : right.maxY < left.minY
        ? left.minY - right.maxY
        : 0n;
  return dx * dx + dy * dy;
}

function fractionExceedsCandidate(
  lowerBound: bigint,
  candidate: PointDistanceCandidate,
): boolean {
  return (
    compareFractions(
      lowerBound,
      1n,
      candidate.distanceNumerator,
      candidate.distanceDenominator,
    ) > 0
  );
}

function fractionExceedsSegmentCandidate(
  lowerBound: bigint,
  candidate: SegmentDistanceCandidate,
): boolean {
  return (
    compareFractions(
      lowerBound,
      1n,
      candidate.distanceNumerator,
      candidate.distanceDenominator,
    ) > 0
  );
}

function pointToEdgeDistance(point: WorkPoint, edge: WorkEdge): PointDistanceCandidate {
  const vector = subtract(edge.b, edge.a);
  const fromStart = subtract(point, edge.a);
  const lengthSquared = dot(vector, vector);
  const projection = dot(fromStart, vector);

  if (projection <= 0n) {
    return {
      distanceNumerator: dot(fromStart, fromStart),
      distanceDenominator: 1n,
      feature: { kind: "vertex", index: edge.startVertexIndex },
      boundaryPoint: integerAsRationalPoint(edge.a),
    };
  }
  if (projection >= lengthSquared) {
    const fromEnd = subtract(point, edge.b);
    return {
      distanceNumerator: dot(fromEnd, fromEnd),
      distanceDenominator: 1n,
      feature: { kind: "vertex", index: edge.endVertexIndex },
      boundaryPoint: integerAsRationalPoint(edge.b),
    };
  }

  const area = cross(vector, fromStart);
  return {
    distanceNumerator: area * area,
    distanceDenominator: lengthSquared,
    feature: {
      kind: "edge",
      index: edge.index,
      startVertexIndex: edge.startVertexIndex,
      endVertexIndex: edge.endVertexIndex,
    },
    boundaryPoint: {
      xNumerator: edge.a.x * lengthSquared + vector.x * projection,
      yNumerator: edge.a.y * lengthSquared + vector.y * projection,
      denominator: lengthSquared,
    },
  };
}

function segmentToEdgeDistance(
  start: WorkPoint,
  end: WorkPoint,
  edge: WorkEdge,
): readonly SegmentDistanceCandidate[] {
  if (segmentsIntersectInclusive(start, end, edge.a, edge.b)) {
    const intersection = representativeIntersection(start, end, edge.a, edge.b);
    return [
      {
        distanceNumerator: 0n,
        distanceDenominator: 1n,
        feature: featureAtBoundaryPoint(intersection, edge),
        boundaryPoint: intersection,
        centrelinePoint: intersection,
      },
    ];
  }

  const candidates: SegmentDistanceCandidate[] = [];

  const fromStart = pointToEdgeDistance(start, edge);
  candidates.push({
    distanceNumerator: fromStart.distanceNumerator,
    distanceDenominator: fromStart.distanceDenominator,
    feature: fromStart.feature,
    boundaryPoint: fromStart.boundaryPoint,
    centrelinePoint: integerAsRationalPoint(start),
  });

  if (!pointEquals(start, end)) {
    const fromEnd = pointToEdgeDistance(end, edge);
    candidates.push({
      distanceNumerator: fromEnd.distanceNumerator,
      distanceDenominator: fromEnd.distanceDenominator,
      feature: fromEnd.feature,
      boundaryPoint: fromEnd.boundaryPoint,
      centrelinePoint: integerAsRationalPoint(end),
    });
  }

  const edgeStartToCentreline = pointToArbitrarySegmentDistance(edge.a, start, end);
  candidates.push({
    distanceNumerator: edgeStartToCentreline.distanceNumerator,
    distanceDenominator: edgeStartToCentreline.distanceDenominator,
    feature: { kind: "vertex", index: edge.startVertexIndex },
    boundaryPoint: integerAsRationalPoint(edge.a),
    centrelinePoint: edgeStartToCentreline.closestPoint,
  });

  const edgeEndToCentreline = pointToArbitrarySegmentDistance(edge.b, start, end);
  candidates.push({
    distanceNumerator: edgeEndToCentreline.distanceNumerator,
    distanceDenominator: edgeEndToCentreline.distanceDenominator,
    feature: { kind: "vertex", index: edge.endVertexIndex },
    boundaryPoint: integerAsRationalPoint(edge.b),
    centrelinePoint: edgeEndToCentreline.closestPoint,
  });

  let minimum = candidates[0]!;
  for (let index = 1; index < candidates.length; index += 1) {
    const candidate = candidates[index]!;
    if (
      compareFractions(
        candidate.distanceNumerator,
        candidate.distanceDenominator,
        minimum.distanceNumerator,
        minimum.distanceDenominator,
      ) < 0
    ) {
      minimum = candidate;
    }
  }

  const unique = new Map<string, SegmentDistanceCandidate>();
  for (const candidate of candidates) {
    if (
      compareFractions(
        candidate.distanceNumerator,
        candidate.distanceDenominator,
        minimum.distanceNumerator,
        minimum.distanceDenominator,
      ) === 0
    ) {
      unique.set(segmentCandidateKey(candidate), candidate);
    }
  }
  return [...unique.values()];
}

function pointToArbitrarySegmentDistance(
  point: WorkPoint,
  a: WorkPoint,
  b: WorkPoint,
): {
  readonly distanceNumerator: bigint;
  readonly distanceDenominator: bigint;
  readonly closestPoint: WorkRationalPoint;
} {
  const vector = subtract(b, a);
  const lengthSquared = dot(vector, vector);
  if (lengthSquared === 0n) {
    const delta = subtract(point, a);
    return {
      distanceNumerator: dot(delta, delta),
      distanceDenominator: 1n,
      closestPoint: integerAsRationalPoint(a),
    };
  }

  const fromStart = subtract(point, a);
  const projection = dot(fromStart, vector);
  if (projection <= 0n) {
    return {
      distanceNumerator: dot(fromStart, fromStart),
      distanceDenominator: 1n,
      closestPoint: integerAsRationalPoint(a),
    };
  }
  if (projection >= lengthSquared) {
    const fromEnd = subtract(point, b);
    return {
      distanceNumerator: dot(fromEnd, fromEnd),
      distanceDenominator: 1n,
      closestPoint: integerAsRationalPoint(b),
    };
  }

  const area = cross(vector, fromStart);
  return {
    distanceNumerator: area * area,
    distanceDenominator: lengthSquared,
    closestPoint: {
      xNumerator: a.x * lengthSquared + vector.x * projection,
      yNumerator: a.y * lengthSquared + vector.y * projection,
      denominator: lengthSquared,
    },
  };
}

function representativeIntersection(
  a: WorkPoint,
  b: WorkPoint,
  c: WorkPoint,
  d: WorkPoint,
): WorkRationalPoint {
  const ab = subtract(b, a);
  const cd = subtract(d, c);
  const denominator = cross(ab, cd);

  if (denominator !== 0n) {
    const fromA = subtract(c, a);
    const parameterNumerator = cross(fromA, cd);
    return normaliseWorkRationalPoint({
      xNumerator: a.x * denominator + ab.x * parameterNumerator,
      yNumerator: a.y * denominator + ab.y * parameterNumerator,
      denominator,
    });
  }

  const shared = [a, b, c, d]
    .filter((point, index, values) =>
      pointOnSegment(point, a, b) &&
      pointOnSegment(point, c, d) &&
      values.findIndex((candidate) => pointEquals(candidate, point)) === index,
    )
    .sort(compareIntegerPoints);

  const representative = shared[0];
  if (representative === undefined) {
    throw new Error("internal invariant: intersecting collinear segments have a shared endpoint of their overlap");
  }
  return integerAsRationalPoint(representative);
}

function featureAtBoundaryPoint(point: WorkRationalPoint, edge: WorkEdge): BoundaryFeatureInternal {
  const normalised = normaliseWorkRationalPoint(point);
  if (rationalPointEqualsInteger(normalised, edge.a)) {
    return { kind: "vertex", index: edge.startVertexIndex };
  }
  if (rationalPointEqualsInteger(normalised, edge.b)) {
    return { kind: "vertex", index: edge.endVertexIndex };
  }
  return {
    kind: "edge",
    index: edge.index,
    startVertexIndex: edge.startVertexIndex,
    endVertexIndex: edge.endVertexIndex,
  };
}

function boundaryFeatureJson(
  feature: BoundaryFeatureInternal,
  vertexCount: number,
): BoundaryFeatureJson {
  if (feature.kind === "vertex") {
    return {
      kind: "vertex",
      vertexIndex: feature.index.toString(),
    };
  }
  return {
    kind: "edge",
    edgeIndex: feature.index.toString(),
    startVertexIndex: (feature.startVertexIndex ?? feature.index).toString(),
    endVertexIndex: (feature.endVertexIndex ?? ((feature.index + 1) % vertexCount)).toString(),
  };
}

function workRationalPointToPhysicalJson(
  point: WorkRationalPoint,
  workDenominator: bigint,
) {
  const normalised = normaliseWorkRationalPoint(point);
  const physical: RationalPoint = {
    x: makeRational(normalised.xNumerator, normalised.denominator * workDenominator),
    y: makeRational(normalised.yNumerator, normalised.denominator * workDenominator),
  };
  return rationalPointJson(physical);
}

function normaliseWorkRationalPoint(point: WorkRationalPoint): WorkRationalPoint {
  let denominator = point.denominator;
  let xNumerator = point.xNumerator;
  let yNumerator = point.yNumerator;
  if (denominator < 0n) {
    denominator = -denominator;
    xNumerator = -xNumerator;
    yNumerator = -yNumerator;
  }
  const divisor = gcd3(xNumerator, yNumerator, denominator);
  return {
    xNumerator: xNumerator / divisor,
    yNumerator: yNumerator / divisor,
    denominator: denominator / divisor,
  };
}

function integerAsRationalPoint(point: WorkPoint): WorkRationalPoint {
  return { xNumerator: point.x, yNumerator: point.y, denominator: 1n };
}

function rationalPointEqualsInteger(point: WorkRationalPoint, integer: WorkPoint): boolean {
  return (
    point.xNumerator === integer.x * point.denominator &&
    point.yNumerator === integer.y * point.denominator
  );
}

function pointOnSegment(point: WorkPoint, a: WorkPoint, b: WorkPoint): boolean {
  if (orientation(a, b, point) !== 0n) {
    return false;
  }
  return (
    point.x >= minBigInt(a.x, b.x) &&
    point.x <= maxBigInt(a.x, b.x) &&
    point.y >= minBigInt(a.y, b.y) &&
    point.y <= maxBigInt(a.y, b.y)
  );
}

function segmentsIntersectInclusive(a: WorkPoint, b: WorkPoint, c: WorkPoint, d: WorkPoint): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (oppositeSigns(o1, o2) && oppositeSigns(o3, o4)) {
    return true;
  }
  return (
    (o1 === 0n && pointOnSegment(c, a, b)) ||
    (o2 === 0n && pointOnSegment(d, a, b)) ||
    (o3 === 0n && pointOnSegment(a, c, d)) ||
    (o4 === 0n && pointOnSegment(b, c, d))
  );
}

function orientation(a: WorkPoint, b: WorkPoint, c: WorkPoint): bigint {
  return cross(subtract(b, a), subtract(c, a));
}

function subtract(left: WorkPoint, right: WorkPoint): WorkPoint {
  return { x: left.x - right.x, y: left.y - right.y };
}

function dot(left: WorkPoint, right: WorkPoint): bigint {
  return left.x * right.x + left.y * right.y;
}

function cross(left: WorkPoint, right: WorkPoint): bigint {
  return left.x * right.y - left.y * right.x;
}

function pointEquals(left: WorkPoint, right: WorkPoint): boolean {
  return left.x === right.x && left.y === right.y;
}

function oppositeSigns(left: bigint, right: bigint): boolean {
  return (left < 0n && right > 0n) || (left > 0n && right < 0n);
}

function minBigInt(left: bigint, right: bigint): bigint {
  return left < right ? left : right;
}

function maxBigInt(left: bigint, right: bigint): bigint {
  return left > right ? left : right;
}

function featureKey(feature: BoundaryFeatureInternal): string {
  return `${feature.kind}:${feature.index}`;
}

function segmentCandidateKey(candidate: SegmentDistanceCandidate): string {
  return [
    featureKey(candidate.feature),
    rationalPointKey(candidate.boundaryPoint),
    rationalPointKey(candidate.centrelinePoint),
  ].join("|");
}

function rationalPointKey(point: WorkRationalPoint): string {
  const normalised = normaliseWorkRationalPoint(point);
  return `${normalised.xNumerator}/${normalised.denominator},${normalised.yNumerator}/${normalised.denominator}`;
}

function comparePointCandidatesCanonical(left: PointDistanceCandidate, right: PointDistanceCandidate): number {
  return compareFeatures(left.feature, right.feature) || compareWorkPoints(left.boundaryPoint, right.boundaryPoint);
}

function compareSegmentCandidatesCanonical(
  left: SegmentDistanceCandidate,
  right: SegmentDistanceCandidate,
): number {
  return (
    compareFeatures(left.feature, right.feature) ||
    compareWorkPoints(left.boundaryPoint, right.boundaryPoint) ||
    compareWorkPoints(left.centrelinePoint, right.centrelinePoint)
  );
}

function compareFeatures(left: BoundaryFeatureInternal, right: BoundaryFeatureInternal): number {
  const leftKind = left.kind === "vertex" ? 0 : 1;
  const rightKind = right.kind === "vertex" ? 0 : 1;
  return leftKind - rightKind || left.index - right.index;
}

function compareWorkPoints(left: WorkRationalPoint, right: WorkRationalPoint): number {
  const leftNormal = normaliseWorkRationalPoint(left);
  const rightNormal = normaliseWorkRationalPoint(right);
  const xComparison = compareFractions(
    leftNormal.xNumerator,
    leftNormal.denominator,
    rightNormal.xNumerator,
    rightNormal.denominator,
  );
  if (xComparison !== 0) {
    return xComparison;
  }
  return compareFractions(
    leftNormal.yNumerator,
    leftNormal.denominator,
    rightNormal.yNumerator,
    rightNormal.denominator,
  );
}

function compareIntegerPoints(left: WorkPoint, right: WorkPoint): number {
  return left.x < right.x ? -1 : left.x > right.x ? 1 : left.y < right.y ? -1 : left.y > right.y ? 1 : 0;
}

function gcd3(first: bigint, second: bigint, third: bigint): bigint {
  return gcd(gcd(first, second), third);
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a === 0n ? 1n : a;
}
