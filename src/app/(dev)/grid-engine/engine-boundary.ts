import { Clipper, EndType, FillRule, JoinType, type Path64 } from '@countertype/clipper2-ts'
import type { StudioPoint } from '@onemo/magnetic-next'
import { DEFAULT_LAW } from '@/lib/grid-engine/compute/grid-core'
import { engineOutline, type OutlineUV } from '@/lib/grid-engine/ui/trace-cutout'

function containedAtQuantum(raw: Path64, prepared: Path64): boolean {
  return Clipper.difference([prepared], [raw], FillRule.NonZero).length === 0
}

export function toMagneticStudioOutline(
  outline: Readonly<OutlineUV>,
  box: Readonly<{ w: number; h: number }>,
  numeric: Readonly<{ coordinateQuantumMm: number; approximationToleranceMm: number }>,
): StudioPoint[] {
  const raw = outline.map(([u, v]) => ({ x: u * box.w, y: v * box.h }))
  const prepared = engineOutline([...outline]).map(([u, v]) => ({ x: u * box.w, y: v * box.h }))
  const scale = 1 / numeric.coordinateQuantumMm
  const rawPath = raw.map(({ x, y }) => ({ x: Math.round(x * scale), y: Math.round(y * scale) }))
  const preparedPath = prepared.map(({ x, y }) => ({ x: Math.round(x * scale), y: Math.round(y * scale) }))
  const maximumOffsetQuanta = Math.ceil(
    (Math.max(box.w, box.h) / DEFAULT_LAW.maxRungMM + Math.SQRT2 * numeric.coordinateQuantumMm)
      / numeric.coordinateQuantumMm,
  )
  for (let offsetQuanta = 0; offsetQuanta <= maximumOffsetQuanta; offsetQuanta++) {
    const candidates = (offsetQuanta === 0
      ? [preparedPath]
      : Clipper.inflatePaths([preparedPath], -offsetQuanta, JoinType.Round, EndType.Polygon, 2, 0.25)
    ).filter((candidate) => candidate.length >= 3 && Math.abs(Clipper.area(candidate)) >= 1)
    if (candidates.length !== 1 || !containedAtQuantum(rawPath, candidates[0]!)) continue
    return candidates[0]!.map(({ x, y }) => ({
      x: x * numeric.coordinateQuantumMm,
      y: y * numeric.coordinateQuantumMm,
    }))
  }
  return raw
}
