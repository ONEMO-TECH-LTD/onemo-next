import type { Bounds, IntPoint, Point } from './contracts.js';
import { ComputeError } from './contracts.js';

export const EPSILON = 1e-12;
export const MAX_SAFE_CANONICAL = 9_000_000_000_000;

export function assertQuantum(quantumMm: number): void {
  if (!Number.isFinite(quantumMm) || quantumMm <= 0) {
    throw new ComputeError('UNSUPPORTED_QUANTUM', 'coordinate quantum must be finite and positive', { quantumMm });
  }
}

export function roundHalfAwayFromZero(value: number): number {
  if (!Number.isFinite(value)) throw new ComputeError('NUMERIC_OVERFLOW', 'cannot round a non-finite value', { value });
  return value < 0 ? -Math.floor(-value + 0.5) : Math.floor(value + 0.5);
}

export function quantizeScalar(mm: number, quantumMm: number): number {
  assertQuantum(quantumMm);
  const value = roundHalfAwayFromZero(mm / quantumMm);
  if (!Number.isSafeInteger(value) || Math.abs(value) > MAX_SAFE_CANONICAL) {
    throw new ComputeError('NUMERIC_OVERFLOW', 'quantized coordinate exceeds safe integer range', { mm, quantumMm, value });
  }
  return value;
}

export function dequantizeScalar(value: number, quantumMm: number): number {
  if (!Number.isSafeInteger(value)) throw new ComputeError('NUMERIC_OVERFLOW', 'canonical coordinate must be a safe integer', { value });
  return value * quantumMm;
}

export function quantizePoint(point: Point, quantumMm: number): IntPoint {
  return { x: quantizeScalar(point.x, quantumMm), y: quantizeScalar(point.y, quantumMm) };
}

export function dequantizePoint(point: IntPoint, quantumMm: number): Point {
  return { x: dequantizeScalar(point.x, quantumMm), y: dequantizeScalar(point.y, quantumMm) };
}

export function compareNumbers(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function comparePoints(a: Point, b: Point): number {
  return compareNumbers(a.x, b.x) || compareNumbers(a.y, b.y);
}

export function compareIntPoints(a: IntPoint, b: IntPoint): number {
  return compareNumbers(a.x, b.x) || compareNumbers(a.y, b.y);
}

export function boundsWidth(bounds: Bounds): number { return bounds.maxX - bounds.minX; }
export function boundsHeight(bounds: Bounds): number { return bounds.maxY - bounds.minY; }
export function boundsCentre(bounds: Bounds): Point {
  return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
}
export function boxHalfDiagonal(bounds: Bounds): number {
  return Math.hypot(boundsWidth(bounds) / 2, boundsHeight(bounds) / 2);
}
export function containsPoint(bounds: Bounds, point: Point, tolerance = 0): boolean {
  return point.x >= bounds.minX - tolerance && point.x <= bounds.maxX + tolerance &&
    point.y >= bounds.minY - tolerance && point.y <= bounds.maxY + tolerance;
}
export function intersectsBounds(a: Bounds, b: Bounds, tolerance = 0): boolean {
  return !(a.maxX < b.minX - tolerance || b.maxX < a.minX - tolerance ||
    a.maxY < b.minY - tolerance || b.maxY < a.minY - tolerance);
}
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
export function clampPoint(point: Point, bounds: Bounds): Point {
  return { x: clamp(point.x, bounds.minX, bounds.maxX), y: clamp(point.y, bounds.minY, bounds.maxY) };
}
export function normalizeDirection(direction: Point): Point {
  const length = Math.hypot(direction.x, direction.y);
  if (!Number.isFinite(length) || length <= EPSILON) {
    throw new ComputeError('INVALID_DIRECTION', 'direction must have non-zero finite length', { direction });
  }
  return { x: direction.x / length, y: direction.y / length };
}
export function dot(a: Point, b: Point): number { return a.x * b.x + a.y * b.y; }
export function add(a: Point, b: Point): Point { return { x: a.x + b.x, y: a.y + b.y }; }
export function subtract(a: Point, b: Point): Point { return { x: a.x - b.x, y: a.y - b.y }; }
export function scale(point: Point, factor: number): Point { return { x: point.x * factor, y: point.y * factor }; }
export function squaredDistance(a: Point, b: Point): number {
  const dx = a.x - b.x; const dy = a.y - b.y; return dx * dx + dy * dy;
}
export function boxKey(bounds: Bounds, depth: number): string {
  return `${depth}:${bounds.minX},${bounds.minY},${bounds.maxX},${bounds.maxY}`;
}

export function bigIntOrient(a: IntPoint, b: IntPoint, c: IntPoint): bigint {
  return BigInt(b.x - a.x) * BigInt(c.y - a.y) - BigInt(b.y - a.y) * BigInt(c.x - a.x);
}

export function bigIntDot(ax: number, ay: number, bx: number, by: number): bigint {
  return BigInt(ax) * BigInt(bx) + BigInt(ay) * BigInt(by);
}
