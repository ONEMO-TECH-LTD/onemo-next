'use client'

// MEASUREMENT OVERLAY — measurement marks ONLY: discs, link facts, clearance labels. It computes
// NOTHING and draws NO shape — the cut-out is rendered by the scaffold's own box/outline path,
// exactly as before the instrument existed (Dan: "the shape must behave like it was before").

import type { AnnotatedVariant } from '@/lib/grid-engine/bridge'

const HELD_FILL = 'rgba(37, 160, 105, 0.20)'
const HELD_STROKE = '#1f9d63'
const EMPTY_STROKE = 'rgba(120, 132, 148, 0.55)'
const LINK_DIRECT = 'rgba(31, 157, 99, 0.7)'
const LINK_BROKEN = 'rgba(214, 138, 32, 0.9)'

export interface MeasurementOverlayProps {
  /** The variant being looked at, already measured by the engine and marked by the logic layer. */
  measured: AnnotatedVariant | null
  /** Disc radius in millimetres, handed in from the guarded spec — never a literal here. */
  discRadiusMM: number
}


export function MeasurementOverlay({ measured, discRadiusMM }: MeasurementOverlayProps) {
  if (!measured) return null
  const { variant } = measured
  const labelOffset = discRadiusMM + 7

  return (
    <g pointerEvents="none">
      {/* Link facts between held neighbours: solid when the engine found a straight full-width
          strip, dashed amber when it did not — the crescent evidence, drawn not argued. */}
      {variant.links.map((link) => (
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
      {variant.nodes.map((node) => (
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

      {variant.nodes
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
