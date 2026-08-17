import { Clipper, EndType, FillRule, JoinType, type Path64 } from '@countertype/clipper2-ts'
import type { StudioPoint } from '@onemo/magnetic-next'
import type { OutlineUV } from '@/lib/grid-engine/ui/trace-cutout'
import { rdpClosed, type Vec2Px } from '@/lib/outline-core/math'

export const ENGINE_PREPARATION_TOLERANCE_MM = 1
const ENGINE_PREPARATION_QUANTUM_MM = 0.01

function containedAtQuantum(raw: Path64, prepared: Path64): boolean {
  return Clipper.difference([prepared], [raw], FillRule.NonZero)
    .every((path) => Math.abs(Clipper.area(path)) < 1)
}

export function toMagneticStudioOutline(
  outline: Readonly<OutlineUV>,
  box: Readonly<{ w: number; h: number }>,
): StudioPoint[] {
  const raw = outline.map(([u, v]) => ({ x: u * box.w, y: v * box.h }))
  const simplified = rdpClosed(
    raw.map(({ x, y }) => [x, y] as Vec2Px),
    ENGINE_PREPARATION_TOLERANCE_MM,
  )
  const scale = 1 / ENGINE_PREPARATION_QUANTUM_MM
  const rawPath = raw.map(({ x, y }) => ({ x: Math.round(x * scale), y: Math.round(y * scale) }))
  const path = simplified.map(([x, y]) => ({ x: Math.round(x * scale), y: Math.round(y * scale) }))
  const preparedPaths = Clipper.inflatePaths(
    [path],
    -(ENGINE_PREPARATION_TOLERANCE_MM + ENGINE_PREPARATION_QUANTUM_MM) * scale,
    JoinType.Round,
    EndType.Polygon,
    2,
    ENGINE_PREPARATION_TOLERANCE_MM * scale / 5,
  ).filter((candidate) => candidate.length >= 3 && Math.abs(Clipper.area(candidate)) >= 1)
  if (preparedPaths.length !== 1 || !containedAtQuantum(rawPath, preparedPaths[0]!)) return raw
  const prepared = preparedPaths[0]!.map(({ x, y }) => ({
    x: x * ENGINE_PREPARATION_QUANTUM_MM,
    y: y * ENGINE_PREPARATION_QUANTUM_MM,
  }))
  return prepared
}
