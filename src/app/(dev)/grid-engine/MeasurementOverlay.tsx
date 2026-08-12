'use client'

// MEASUREMENT OVERLAY — drawn on the field in millimetres like everything else on this canvas.
// It computes NOTHING: every coordinate, clearance, held flag and link verdict came back from the
// engine through the bridge on this render. Its one piece of arithmetic is placing the traced
// outline at the measured size — a drawing transform, the same one the canvas applies to the
// cut-out picture itself.

import type { AnnotatedSize, OutlinePoints } from '@/lib/grid-engine/bridge'

const SHAPE_FILL = 'rgba(88, 194, 255, 0.08)'
const SHAPE_STROKE = '#58c2ff'
const HELD_FILL = 'rgba(37, 160, 105, 0.20)'
const HELD_STROKE = '#1f9d63'
const EMPTY_STROKE = 'rgba(120, 132, 148, 0.55)'
const LINK_DIRECT = 'rgba(31, 157, 99, 0.7)'
const LINK_BROKEN = 'rgba(214, 138, 32, 0.9)'

export interface MeasurementOverlayProps {
  /** The traced outline in the picture's own fractions, exactly as the tracer produced it. */
  outline: OutlinePoints | null
  /** The size being looked at, already measured by the engine and marked by the logic layer. */
  measured: AnnotatedSize | null
  /** Disc radius in millimetres, handed in from the guarded spec — never a literal here. */
  discRadiusMM: number
}

/** The outline placed the way the engine measured it: bbox centred, longest side = the size. */
function outlinePath(outline: OutlinePoints, sizeMM: number): string {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of outline) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const longest = Math.max(maxX - minX, maxY - minY) || 1
  const k = sizeMM / longest
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  return (
    outline.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${(x - cx) * k} ${(y - cy) * k}`).join(' ') +
    ' Z'
  )
}

export function MeasurementOverlay({ outline, measured, discRadiusMM }: MeasurementOverlayProps) {
  if (!outline || !measured) return null
  const { size } = measured
  const labelOffset = discRadiusMM + 7

  return (
    <g pointerEvents="none">
      <path
        d={outlinePath(outline, size.sizeMm)}
        fill={SHAPE_FILL}
        stroke={SHAPE_STROKE}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />

      {/* Link facts between held neighbours: solid when the engine found a straight full-width
          strip, dashed amber when it did not — the crescent evidence, drawn not argued. */}
      {size.links.map((link) => (
        <line
          key={`${link.axMm},${link.ayMm}-${link.bxMm},${link.byMm}`}
          x1={link.axMm}
          y1={link.ayMm}
          x2={link.bxMm}
          y2={link.byMm}
          stroke={link.direct ? LINK_DIRECT : LINK_BROKEN}
          strokeWidth={link.direct ? 2 : 1.5}
          strokeDasharray={link.direct ? undefined : '4 3'}
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {/* Every lattice position the engine reported — held ones filled, the rest as empty rings.
          Seeing what does NOT hold is the point of the instrument. */}
      {size.nodes.map((node) => (
        <circle
          key={`${node.xMm},${node.yMm}`}
          cx={node.xMm}
          cy={node.yMm}
          r={discRadiusMM}
          fill={node.held ? HELD_FILL : 'none'}
          stroke={node.held ? HELD_STROKE : EMPTY_STROKE}
          strokeWidth={node.held ? 1.5 : 1}
          strokeDasharray={node.held ? undefined : '3 3'}
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {size.nodes
        .filter((node) => node.held)
        .map((node) => (
          <text
            key={`label-${node.xMm},${node.yMm}`}
            x={node.xMm}
            y={node.yMm + labelOffset}
            textAnchor="middle"
            fontSize={7}
            fill={HELD_STROKE}
          >
            {node.clearanceMm.toFixed(1)}
          </text>
        ))}
    </g>
  )
}
