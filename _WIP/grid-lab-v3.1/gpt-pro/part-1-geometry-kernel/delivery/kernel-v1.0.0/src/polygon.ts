import { KernelInputError } from "./errors.js";
import { parseInteger } from "./arithmetic.js";
import type { CanonicalPolygonInput } from "./types.js";

export interface IntegerPoint {
  readonly x: bigint;
  readonly y: bigint;
}

export interface IntegerEdge {
  readonly index: number;
  readonly startVertexIndex: number;
  readonly endVertexIndex: number;
  readonly a: IntegerPoint;
  readonly b: IntegerPoint;
}

export interface PreparedPolygon {
  /** Canonical CCW cycle, rotated to its lexicographically smallest vertex. */
  readonly vertices: readonly IntegerPoint[];
  readonly edges: readonly IntegerEdge[];
}

export function pointEquals(left: IntegerPoint, right: IntegerPoint): boolean {
  return left.x === right.x && left.y === right.y;
}

export function subtract(left: IntegerPoint, right: IntegerPoint): IntegerPoint {
  return { x: left.x - right.x, y: left.y - right.y };
}

export function dot(left: IntegerPoint, right: IntegerPoint): bigint {
  return left.x * right.x + left.y * right.y;
}

export function cross(left: IntegerPoint, right: IntegerPoint): bigint {
  return left.x * right.y - left.y * right.x;
}

export function orientation(a: IntegerPoint, b: IntegerPoint, c: IntegerPoint): bigint {
  return cross(subtract(b, a), subtract(c, a));
}

export function squaredLength(vector: IntegerPoint): bigint {
  return dot(vector, vector);
}

export function pointOnSegment(point: IntegerPoint, a: IntegerPoint, b: IntegerPoint): boolean {
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

export function segmentsIntersectInclusive(
  a: IntegerPoint,
  b: IntegerPoint,
  c: IntegerPoint,
  d: IntegerPoint,
): boolean {
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

export function preparePolygon(input: CanonicalPolygonInput): PreparedPolygon {
  const raw = input.vertices.map((vertex, index) => ({
    x: parseInteger(vertex.x, `polygon.vertices[${index}].x`),
    y: parseInteger(vertex.y, `polygon.vertices[${index}].y`),
  }));

  if (raw.length < 3) {
    throw new KernelInputError(
      "POLYGON_TOO_FEW_VERTICES",
      "polygon.vertices",
      "a simple polygon requires at least three vertices",
    );
  }

  if (pointEquals(raw[0]!, raw[raw.length - 1]!)) {
    throw new KernelInputError(
      "REPEATED_CLOSING_VERTEX",
      `polygon.vertices[${raw.length - 1}]`,
      "the closing vertex must not repeat the first vertex",
    );
  }

  const seen = new Map<string, number>();
  for (let index = 0; index < raw.length; index += 1) {
    const point = raw[index]!;
    const key = pointKey(point);
    const previous = seen.get(key);
    if (previous !== undefined) {
      throw new KernelInputError(
        "DUPLICATE_VERTEX",
        `polygon.vertices[${index}]`,
        `duplicates polygon.vertices[${previous}]`,
      );
    }
    seen.set(key, index);
  }

  for (let index = 0; index < raw.length; index += 1) {
    const next = (index + 1) % raw.length;
    if (pointEquals(raw[index]!, raw[next]!)) {
      throw new KernelInputError(
        "ZERO_LENGTH_EDGE",
        `polygon.vertices[${index}]`,
        "consecutive vertices form a zero-length edge",
      );
    }
  }

  let areaTwice = 0n;
  for (let index = 0; index < raw.length; index += 1) {
    areaTwice += cross(raw[index]!, raw[(index + 1) % raw.length]!);
  }
  if (areaTwice === 0n) {
    throw new KernelInputError(
      "POLYGON_ZERO_AREA",
      "polygon.vertices",
      "signed area is zero",
    );
  }

  validateAdjacentEdges(raw);
  validateNonAdjacentEdges(raw);

  const ccw = areaTwice > 0n ? [...raw] : [...raw].reverse();
  const start = lexicographicallySmallestIndex(ccw);
  const vertices = rotate(ccw, start);
  const edges: IntegerEdge[] = vertices.map((a, index) => {
    const endVertexIndex = (index + 1) % vertices.length;
    return {
      index,
      startVertexIndex: index,
      endVertexIndex,
      a,
      b: vertices[endVertexIndex]!,
    };
  });

  return { vertices, edges };
}

function validateAdjacentEdges(vertices: readonly IntegerPoint[]): void {
  const count = vertices.length;
  for (let sharedIndex = 0; sharedIndex < count; sharedIndex += 1) {
    const previous = vertices[(sharedIndex - 1 + count) % count]!;
    const shared = vertices[sharedIndex]!;
    const next = vertices[(sharedIndex + 1) % count]!;
    const towardPrevious = subtract(previous, shared);
    const towardNext = subtract(next, shared);
    if (cross(towardPrevious, towardNext) === 0n && dot(towardPrevious, towardNext) > 0n) {
      throw new KernelInputError(
        "POLYGON_NOT_SIMPLE",
        `polygon.vertices[${sharedIndex}]`,
        "adjacent edges overlap by backtracking from their shared vertex",
      );
    }
  }
}

function validateNonAdjacentEdges(vertices: readonly IntegerPoint[]): void {
  const count = vertices.length;
  for (let first = 0; first < count; first += 1) {
    const firstNext = (first + 1) % count;
    const a = vertices[first]!;
    const b = vertices[firstNext]!;
    for (let second = first + 1; second < count; second += 1) {
      const secondNext = (second + 1) % count;
      if (
        first === second ||
        firstNext === second ||
        secondNext === first
      ) {
        continue;
      }
      const c = vertices[second]!;
      const d = vertices[secondNext]!;
      if (segmentsIntersectInclusive(a, b, c, d)) {
        throw new KernelInputError(
          "POLYGON_NOT_SIMPLE",
          `polygon.edges[${first}],polygon.edges[${second}]`,
          "non-adjacent polygon edges intersect or touch",
        );
      }
    }
  }
}

function lexicographicallySmallestIndex(vertices: readonly IntegerPoint[]): number {
  let best = 0;
  for (let index = 1; index < vertices.length; index += 1) {
    const candidate = vertices[index]!;
    const current = vertices[best]!;
    if (candidate.x < current.x || (candidate.x === current.x && candidate.y < current.y)) {
      best = index;
    }
  }
  return best;
}

function rotate<T>(values: readonly T[], start: number): T[] {
  return [...values.slice(start), ...values.slice(0, start)];
}

function pointKey(point: IntegerPoint): string {
  return `${point.x.toString()},${point.y.toString()}`;
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
