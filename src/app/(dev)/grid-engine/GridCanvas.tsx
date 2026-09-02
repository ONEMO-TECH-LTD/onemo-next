'use client'

// GridCanvas — the NEUTRAL CANVAS. A copy of the Figma field: ONEMO DS v2.3.6, node 14247-29777,
// measured at 10 Figma units per millimetre.
//
// ONE SVG user unit = ONE MILLIMETRE. What is drawn here is the manufacturing drawing.
//
// IT DRAWS THREE THINGS AND NOTHING ELSE — the millimetre rule, the field, and whatever the unit
// handed it. No controls, no labels, no readouts. It COMPUTES NOTHING: every position it draws came
// back from the bridge on this render, so it cannot show a number the engine did not just produce.
//
// One-way traffic: this file talks to the BRIDGE and to its own camera. It never reaches past the
// bridge into the engine, and the unit has no idea it exists.

import { useEffect, useRef, useState } from 'react'
import {
  atomSpan,
  describeRegion,
  layoutField,
  type FieldSummary,
} from '@/lib/grid-engine/bridge'
import type { GridSystemSpec } from '@/lib/grid-engine/spec'
import { viewBox, ZOOM_FIT } from '@/lib/grid-engine/ui/camera'
import styles from './GridCanvas.module.css'

/**
 * ONE CIRCLE PER MAGNET — the 24mm spot, and nothing inside it.
 *
 * Dan, 2026-08-11: "the internal magnets need not be visible the outer 24mm circle is only one
 * needed to be seeing and we can make fill colour milder with stroke".
 *
 * The Figma cell carries a blue and a white disc within the spot. They describe the part; what this
 * canvas is for is judging a shape against WHERE THE SPOTS ARE, and at four magnets on a 120mm shape
 * the inner discs are the loudest thing on screen. The spot is the whole of what matters here.
 */
const CELL_FILL = 'var(--magnet-fill)'
const CELL_STROKE = 'var(--magnet-stroke)'

/**
 * THE NOTEPAD'S INK. Dan, 2026-08-10: "the lattice must be sitting on the intersection of the
 * notepad grid nodes — that is the point — and be faint almost invisible so it gives geometric
 * background and not invasive."
 *
 * Read out of the Figma file, not chosen: the frame carries a GRID at sectionSize 10 units — one
 * millimetre — in #CFCFCF at 10% alpha, and COLUMNS + ROWS at 480 units — 48mm — in #858585 at 10%.
 * There is no 10mm level in the design; that one was mine, and it is the level that can never align
 * with a 48mm lattice.
 *
 * Ink follows the theme: the surface it is drawn on is not always white.
 */
const RULE_FINE_STROKE = 'var(--rule-fine)'
const PITCH_RULE_STROKE = 'var(--rule-pitch)'
/** Hairline thickness in SCREEN pixels — Figma draws a layout grid at one device pixel, never scaled. */
const RULE_HAIRLINE_PX = 1
/**
 * A level draws only while its cell is at least this many pixels across. Below it the hairline is a
 * sizeable fraction of the cell and the rule floods to a solid wash instead of reading as a rule.
 */
const RULE_MIN_PX = 4

export interface GridCanvasProps {
  spec: GridSystemSpec
  /** Plain view scale. 1 is fit. It changes what you look at and nothing about the field. */
  zoom?: number
  /**
   * Where the LATTICE sits against the shape, in millimetres. This is NOT a camera: it moves the
   * magnets themselves, so it is placement — geometry with a manufacturing consequence — and it is
   * computed in the engine, never here.
   */
  panMM?: [number, number]
  /** Told what is on screen, so the shell can label it without counting anything itself. */
  onView?: (summary: FieldSummary) => void
  /** Anything the unit produced, already in millimetres, drawn on top of the field. */
  children?: React.ReactNode
}

export function GridCanvas({ spec, zoom = ZOOM_FIT, panMM, onView, children }: GridCanvasProps) {
  const frame = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 1, h: 1 })

  // The window is fixed by its container; we need its aspect to keep millimetres square.
  useEffect(() => {
    const el = frame.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setBox({ w: Math.max(1, width), h: Math.max(1, height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // THE UNIT, through the bridge. This file knows nothing about where magnets go or why.
  //
  // THE FIELD FRAMES ITSELF (law 5.1). An empty region at the origin is all the unit needs: it grows
  // every region to the released block, so the block IS the answer and nothing outside can shrink or
  // stretch it. The shell used to hand in a region built from the SHAPE'S SIZE, which read as the
  // shape defining the world -- and did nothing at all, since every reachable size is under the
  // block's own floor. Inert and misleading at once.
  const layout = layoutField(spec, { x: 0, y: 0, w: 0, h: 0 }, panMM)

  // THE CAMERA. Screen maths, and the only thing zoom is allowed to touch.
  const view = viewBox(layout.padded, zoom, box.w / box.h)

  const { cols, rows, spanXMM, spanYMM } = describeRegion(spec, layout, view)
  useEffect(() => {
    onView?.({ cols, rows, spanXMM, spanYMM })
  }, [onView, cols, rows, spanXMM, spanYMM])

  // the rule is a pattern, not lines — a 1mm graticule across a metre would be thousands of nodes
  const pxPerMM = box.w / view.w
  const hair = RULE_HAIRLINE_PX / pxPerMM
  const levels = [
    // THE ATOM, from the unit — Dan: "notepad grid of 12mm not 24mm to match the atomic laws". It was
    // the literal 12 in this file, a released law value owned by a drawing surface, so changing the
    // padding moved the magnets and left the rule behind. This canvas owns PIXEL thresholds, never
    // millimetres. The notepad is the canvas's own base and sits at the origin.
    { id: 'fine', mm: atomSpan(spec), stroke: RULE_FINE_STROKE, anchor: [0, 0] as [number, number] },
    // the lattice rule is anchored where the unit says the lattice is, so its intersections are the
    // magnet centres — drawn at the origin instead, it misses them by exactly the registration
    { id: 'pitch', mm: spec.grid.basePitchMM, stroke: PITCH_RULE_STROKE, anchor: layout.anchorMM },
  ].filter((l) => l.mm * pxPerMM >= RULE_MIN_PX)

  return (
    <div ref={frame} className={styles.frame}>
      <svg
        className={styles.svg}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {levels.map((l) => (
            <pattern
              key={l.id}
              id={`rule-${l.id}`}
              width={l.mm}
              height={l.mm}
              patternUnits="userSpaceOnUse"
              x={l.anchor[0]}
              y={l.anchor[1]}
            >
              <path d={`M ${l.mm} 0 L 0 0 0 ${l.mm}`} fill="none" stroke={l.stroke} strokeWidth={hair} />
            </pattern>
          ))}
        </defs>

        {levels.map((l) => (
          <rect
            key={l.id}
            x={view.x}
            y={view.y}
            width={view.w}
            height={view.h}
            fill={`url(#rule-${l.id})`}
          />
        ))}

        {layout.magnets.map(([x, y]) => (
          <circle
            key={`${x},${y}`}
            cx={x}
            cy={y}
            r={layout.cellMM / 2}
            fill={CELL_FILL}
            stroke={CELL_STROKE}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {children}
      </svg>
    </div>
  )
}
