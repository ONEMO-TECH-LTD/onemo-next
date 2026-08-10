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
import { describeRegion, layoutField, type FieldSummary, type RegionMM } from '@/lib/grid-engine/bridge'
import type { GridSystemSpec } from '@/lib/grid-engine/spec'
import { viewBox, ZOOM_FIT } from './camera'
import styles from './GridCanvas.module.css'

/** The Figma cell, read from the file: 20mm grey disc · 8mm blue · 6mm white. */
const CELL_FILL = '#808080'
const MAGNET_LARGE_FILL = '#58C2FF'
const MAGNET_SMALL_FILL = '#FFFFFF'

/**
 * The millimetre notepad under everything. Dan, 2026-08-10: "the lattice must be sitting on the
 * intersection of the notepad grid nodes — that is the point — and be faint almost invisible so it
 * gives geometric background and not invasive."
 *
 * Read out of the file, not chosen: the frame carries a GRID at sectionSize 10 units — ONE
 * MILLIMETRE — in #CFCFCF at 10% alpha, and COLUMNS + ROWS at 480 units — 48mm — in #858585 at 10%.
 * There is no 10mm level in the design; that one was mine, and it is the level that can never align
 * with a 48mm lattice.
 */
const RULE_FINE_MM = 1
const RULE_FINE_STROKE = 'rgba(0, 0, 0, 0.02)'
const PITCH_RULE_STROKE = 'rgba(0, 0, 0, 0.05)'
/** Hairline thickness in SCREEN pixels — Figma draws a layout grid at one device pixel, never scaled. */
const RULE_HAIRLINE_PX = 1
/**
 * A level draws only while its cell is at least this many pixels across. Below it the hairline is a
 * sizeable fraction of the cell and the rule floods to a solid wash instead of reading as a rule.
 */
const RULE_MIN_PX = 4

export interface GridCanvasProps {
  spec: GridSystemSpec
  /** The content's full extent in millimetres — the view covers it entirely. */
  extentMM?: RegionMM
  /** Plain view scale. 1 is fit. It changes what you look at and nothing about the field. */
  zoom?: number
  /** Told what is on screen, so the shell can label it without counting anything itself. */
  onView?: (summary: FieldSummary) => void
  /** Anything the unit produced, already in millimetres, drawn on top of the field. */
  children?: React.ReactNode
}

export function GridCanvas({ spec, extentMM, zoom = ZOOM_FIT, onView, children }: GridCanvasProps) {
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
  const content: RegionMM = extentMM ?? { x: -180, y: -180, w: 360, h: 360 }
  const layout = layoutField(spec, content)

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
    // the notepad is the canvas's own base and sits at the origin
    { id: 'fine', mm: RULE_FINE_MM, stroke: RULE_FINE_STROKE, anchor: 0 },
    // the lattice rule is anchored where the unit says the lattice is, so its intersections are the
    // magnet centres — drawn at the origin instead, it misses them by exactly the registration
    { id: 'pitch', mm: spec.grid.basePitchMM, stroke: PITCH_RULE_STROKE, anchor: layout.registrationMM },
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
              x={l.anchor}
              y={l.anchor}
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
          <g key={`${x},${y}`}>
            <circle cx={x} cy={y} r={layout.cellMM / 2} fill={CELL_FILL} />
            <circle cx={x} cy={y} r={spec.magnet.largeMM / 2} fill={MAGNET_LARGE_FILL} />
            <circle cx={x} cy={y} r={spec.magnet.smallMM / 2} fill={MAGNET_SMALL_FILL} />
          </g>
        ))}

        {children}
      </svg>
    </div>
  )
}
