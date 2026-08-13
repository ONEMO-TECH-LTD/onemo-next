import {
  lcm,
  makeRational,
  parseInteger,
  parseRationalPoint,
  rationalJson,
  rationalPointFromScaledIntegers,
  rationalPointJson,
  type Rational,
  type RationalPoint,
} from "./arithmetic.js";
import { KernelInputError } from "./errors.js";
import {
  buildWorkPolygon,
  locatePoint,
  measurePointBoundary,
  measureSegmentBoundary,
  squaredDistanceAtLeastRadius,
  type WorkEdge,
  type WorkPoint,
  type WorkPolygon,
} from "./geometry.js";
import { preparePolygon, type PreparedPolygon } from "./polygon.js";
import type {
  FieldExtentInput,
  KernelParametersInput,
  LatticeMeasurementDocumentJson,
  LatticePositionMeasurementJson,
  MeasureLatticeInput,
  MeasureStraightCapsuleInput,
  SizeMeasurementJson,
  StraightCapsuleMeasurementJson,
} from "./types.js";

interface ParsedFieldExtent {
  readonly minColumn: bigint;
  readonly maxColumn: bigint;
  readonly minRow: bigint;
  readonly maxRow: bigint;
}

interface ParsedParameters {
  readonly latticePitch: bigint;
  readonly latticeOrigin: RationalPoint;
  readonly fieldExtent: ParsedFieldExtent;
  readonly discDiameter: bigint;
  readonly sourceSize: bigint;
  readonly sourceAnchor: RationalPoint;
  readonly targetAnchor: RationalPoint;
}

interface SizeContext {
  readonly size: bigint;
  readonly scale: Rational;
  readonly workDenominator: bigint;
  readonly radiusWork: bigint;
  readonly polygon: WorkPolygon;
  readonly parameters: ParsedParameters;
}

export function measureLattice(input: MeasureLatticeInput): LatticeMeasurementDocumentJson {
  const polygon = preparePolygon(input.polygon);
  const parameters = parseParameters(input.parameters);
  const sizes: SizeMeasurementJson[] = input.sizes.map((sizeInput, sizeIndex) => {
    const size = parsePositiveSize(sizeInput, `sizes[${sizeIndex}]`);
    const context = buildSizeContext(polygon, parameters, size);
    return measureOneSize(context);
  });

  return {
    schema: "magnetic-grid-measurement-kernel/lattice/v1",
    sizes,
  };
}

export function measureStraightCapsule(
  input: MeasureStraightCapsuleInput,
): StraightCapsuleMeasurementJson {
  const polygon = preparePolygon(input.polygon);
  const parameters = parseParameters(input.parameters);
  const size = parsePositiveSize(input.size, "size");
  const firstColumn = parseInteger(input.first.column, "first.column");
  const firstRow = parseInteger(input.first.row, "first.row");
  const secondColumn = parseInteger(input.second.column, "second.column");
  const secondRow = parseInteger(input.second.row, "second.row");
  const context = buildSizeContext(polygon, parameters, size);
  const firstPoint = latticePointWork(context, firstColumn, firstRow);
  const secondPoint = latticePointWork(context, secondColumn, secondRow);
  const firstLocation = locatePoint(firstPoint, context.polygon);
  const secondLocation = locatePoint(secondPoint, context.polygon);
  const boundary = measureSegmentBoundary(
    firstPoint,
    secondPoint,
    context.polygon,
    context.workDenominator,
  );
  const fits =
    firstLocation === "inside" &&
    secondLocation === "inside" &&
    squaredDistanceAtLeastRadius(
      boundary.workDistanceNumerator,
      boundary.workDistanceDenominator,
      context.radiusWork,
    );

  return {
    schema: "magnetic-grid-measurement-kernel/straight-capsule/v1",
    size: size.toString(),
    scale: rationalJson(context.scale),
    first: {
      column: firstColumn.toString(),
      row: firstRow.toString(),
      center: workPointJson(firstPoint, context.workDenominator),
      centerLocation: firstLocation,
    },
    second: {
      column: secondColumn.toString(),
      row: secondRow.toString(),
      center: workPointJson(secondPoint, context.workDenominator),
      centerLocation: secondLocation,
    },
    centrelineIntersectsBoundary: boundary.workDistanceNumerator === 0n,
    clearance: boundary.clearance,
    fits,
    limitingContacts: boundary.limitingContacts,
  };
}

function measureOneSize(context: SizeContext): SizeMeasurementJson {
  const positions: LatticePositionMeasurementJson[] = [];
  const extent = context.parameters.fieldExtent;

  for (let row = extent.minRow; row <= extent.maxRow; row += 1n) {
    for (let column = extent.minColumn; column <= extent.maxColumn; column += 1n) {
      const center = latticePointWork(context, column, row);
      const boundary = measurePointBoundary(center, context.polygon, context.workDenominator);
      positions.push({
        column: column.toString(),
        row: row.toString(),
        center: workPointJson(center, context.workDenominator),
        centerLocation: boundary.location,
        clearance: boundary.clearance,
        fits:
          boundary.location === "inside" &&
          squaredDistanceAtLeastRadius(
            boundary.workDistanceNumerator,
            boundary.workDistanceDenominator,
            context.radiusWork,
          ),
        limitingContacts: boundary.limitingContacts,
      });
    }
  }

  return {
    size: context.size.toString(),
    scale: rationalJson(context.scale),
    positions,
  };
}

function parseParameters(input: KernelParametersInput): ParsedParameters {
  const latticePitch = parseInteger(input.lattice.pitch, "parameters.lattice.pitch");
  if (latticePitch <= 0n) {
    throw new KernelInputError(
      "NON_POSITIVE_LATTICE_PITCH",
      "parameters.lattice.pitch",
      "lattice pitch must be positive",
    );
  }

  const discDiameter = parseInteger(input.discDiameter, "parameters.discDiameter");
  if (discDiameter <= 0n) {
    throw new KernelInputError(
      "NON_POSITIVE_DISC_DIAMETER",
      "parameters.discDiameter",
      "disc diameter must be positive",
    );
  }

  const sourceSize = parseInteger(
    input.sizeTransform.sourceSize,
    "parameters.sizeTransform.sourceSize",
  );
  if (sourceSize <= 0n) {
    throw new KernelInputError(
      "NON_POSITIVE_SOURCE_SIZE",
      "parameters.sizeTransform.sourceSize",
      "sourceSize must be positive",
    );
  }

  return {
    latticePitch,
    latticeOrigin: parseRationalPoint(
      input.lattice.origin,
      "parameters.lattice.origin",
    ),
    fieldExtent: parseFieldExtent(input.lattice.fieldExtent),
    discDiameter,
    sourceSize,
    sourceAnchor: parseRationalPoint(
      input.sizeTransform.sourceAnchor,
      "parameters.sizeTransform.sourceAnchor",
    ),
    targetAnchor: parseRationalPoint(
      input.sizeTransform.targetAnchor,
      "parameters.sizeTransform.targetAnchor",
    ),
  };
}

function parseFieldExtent(input: FieldExtentInput): ParsedFieldExtent {
  const extent = {
    minColumn: parseInteger(input.minColumn, "parameters.lattice.fieldExtent.minColumn"),
    maxColumn: parseInteger(input.maxColumn, "parameters.lattice.fieldExtent.maxColumn"),
    minRow: parseInteger(input.minRow, "parameters.lattice.fieldExtent.minRow"),
    maxRow: parseInteger(input.maxRow, "parameters.lattice.fieldExtent.maxRow"),
  };
  if (extent.minColumn > extent.maxColumn || extent.minRow > extent.maxRow) {
    throw new KernelInputError(
      "INVALID_FIELD_EXTENT",
      "parameters.lattice.fieldExtent",
      "inclusive minimum indices must not exceed maximum indices",
    );
  }
  return extent;
}

function parsePositiveSize(input: bigint | string, path: string): bigint {
  const size = parseInteger(input, path);
  if (size <= 0n) {
    throw new KernelInputError(
      "NON_POSITIVE_SIZE",
      path,
      "every requested size must be positive",
    );
  }
  return size;
}

function buildSizeContext(
  sourcePolygon: PreparedPolygon,
  parameters: ParsedParameters,
  size: bigint,
): SizeContext {
  const scale = makeRational(size, parameters.sourceSize);
  const workDenominator = commonWorkDenominator(scale, parameters);
  const vertices: WorkPoint[] = sourcePolygon.vertices.map((vertex) => ({
    x: transformCoordinateToWork(
      vertex.x,
      parameters.sourceAnchor.x,
      parameters.targetAnchor.x,
      scale,
      workDenominator,
    ),
    y: transformCoordinateToWork(
      vertex.y,
      parameters.sourceAnchor.y,
      parameters.targetAnchor.y,
      scale,
      workDenominator,
    ),
  }));
  const edges: WorkEdge[] = sourcePolygon.edges.map((edge) => {
    const a = vertices[edge.startVertexIndex]!;
    const b = vertices[edge.endVertexIndex]!;
    return {
      index: edge.index,
      startVertexIndex: edge.startVertexIndex,
      endVertexIndex: edge.endVertexIndex,
      a,
      b,
      minX: a.x < b.x ? a.x : b.x,
      maxX: a.x > b.x ? a.x : b.x,
      minY: a.y < b.y ? a.y : b.y,
      maxY: a.y > b.y ? a.y : b.y,
    };
  });

  const radiusWorkNumerator = parameters.discDiameter * workDenominator;
  if (radiusWorkNumerator % 2n !== 0n) {
    throw new Error("internal invariant: work denominator must make the radius integral");
  }

  return {
    size,
    scale,
    workDenominator,
    radiusWork: radiusWorkNumerator / 2n,
    polygon: buildWorkPolygon(vertices, edges),
    parameters,
  };
}

function commonWorkDenominator(scale: Rational, parameters: ParsedParameters): bigint {
  const factors = [
    2n,
    parameters.latticeOrigin.x.denominator,
    parameters.latticeOrigin.y.denominator,
    parameters.targetAnchor.x.denominator,
    parameters.targetAnchor.y.denominator,
    scale.denominator * parameters.sourceAnchor.x.denominator,
    scale.denominator * parameters.sourceAnchor.y.denominator,
  ];
  let denominator = 1n;
  for (const factor of factors) {
    denominator = lcm(denominator, factor);
  }
  return denominator;
}

function transformCoordinateToWork(
  sourceCoordinate: bigint,
  sourceAnchor: Rational,
  targetAnchor: Rational,
  scale: Rational,
  workDenominator: bigint,
): bigint {
  const targetFactor = exactQuotient(
    workDenominator,
    targetAnchor.denominator,
    "target-anchor denominator",
  );
  const sourceTermDenominator = scale.denominator * sourceAnchor.denominator;
  const sourceFactor = exactQuotient(
    workDenominator,
    sourceTermDenominator,
    "scaled source-anchor denominator",
  );

  return (
    targetAnchor.numerator * targetFactor +
    scale.numerator *
      (sourceCoordinate * sourceAnchor.denominator - sourceAnchor.numerator) *
      sourceFactor
  );
}

function latticePointWork(context: SizeContext, column: bigint, row: bigint): WorkPoint {
  const denominator = context.workDenominator;
  const origin = context.parameters.latticeOrigin;
  return {
    x:
      origin.x.numerator *
        exactQuotient(denominator, origin.x.denominator, "lattice-origin x denominator") +
      column * context.parameters.latticePitch * denominator,
    y:
      origin.y.numerator *
        exactQuotient(denominator, origin.y.denominator, "lattice-origin y denominator") +
      row * context.parameters.latticePitch * denominator,
  };
}

function workPointJson(point: WorkPoint, workDenominator: bigint) {
  return rationalPointJson(
    rationalPointFromScaledIntegers(point.x, point.y, workDenominator),
  );
}

function exactQuotient(dividend: bigint, divisor: bigint, label: string): bigint {
  if (dividend % divisor !== 0n) {
    throw new Error(`internal invariant: ${label} does not divide the work denominator`);
  }
  return dividend / divisor;
}
