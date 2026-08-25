'use client'

// LibraryView — THE LAYOUT LIBRARY tab of the Centre Lab. Every frame and every preset
// layout, rendered through the bench's OWN Stage canvas — same lattice, same magnets, same
// fit-to-view — for Dan's visual review and approval. Display only: no engine, no policy.
// Data: src/lib/effect/grid-magnet-library.ts (literal, awaiting approval).

import { useMemo, useState, type ComponentType } from 'react'
import { LAYOUT_LIBRARY } from '@/lib/effect/grid-magnet-library'
import { DEFAULT_PITCH_MM, MAGNET_DIA_SMALL_MM } from '@/lib/effect/grid-magnet-spec'
import type { Pt } from '@/lib/effect/types'

const PITCH = DEFAULT_PITCH_MM

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function LibraryView({ Stage }: { Stage: ComponentType<any> }) {
  const [fi, setFi] = useState(4)
  const [li, setLi] = useState(0)
  const [transpose, setTranspose] = useState(false)
  const [flipX, setFlipX] = useState(false)
  const [flipY, setFlipY] = useState(false)

  const frame = LAYOUT_LIBRARY[fi]
  const layout = frame.layouts[Math.min(li, frame.layouts.length - 1)]

  const model = useMemo(() => {
    let c = frame.cols, r = frame.rows
    let ns = layout.nodes.map(([x, y]) => [x, y] as [number, number])
    if (transpose) { ns = ns.map(([x, y]) => [y, x]); const t = c; c = r; r = t }
    if (flipX) ns = ns.map(([x, y]) => [c - 1 - x, y])
    if (flipY) ns = ns.map(([x, y]) => [x, r - 1 - y])
    // Engine space is y-up; library rows count downward from the top.
    const pts: Pt[] = ns.map(([ix, iy]) => [ix * PITCH, (r - 1 - iy) * PITCH])
    const m = PITCH * 0.75
    const x0 = -m, x1 = (c - 1) * PITCH + m, y0 = -m, y1 = (r - 1) * PITCH + m
    const outerPts: Pt[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
    const lattice: Pt[] = []
    for (let ix = -1; ix <= c; ix++) for (let iy = -1; iy <= r; iy++)
      lattice.push([ix * PITCH, iy * PITCH])
    return {
      c, r,
      contour: { outer: { pts: outerPts } },
      grid: {
        anchors: pts.map((p) => ({ p, dia: MAGNET_DIA_SMALL_MM })),
        pitchCentreMM: PITCH,
        lattice,
        phaseMM: [0, 0] as Pt,
        panMM: [0, 0] as Pt,
        spotRadiusMM: PITCH / 2,
        contactsMM: [] as Pt[],
        segments: [],
        centresMM: [] as Pt[],
        centreMainMM: [(c - 1) * PITCH / 2, (r - 1) * PITCH / 2] as Pt,
      },
    }
  }, [frame, layout, transpose, flipX, flipY])

  const noop = () => {}
  return (
    <div className="gl-body">
      <section className="gl-card gl-stage">
        <div className="gl-stage-head">
          <span className="gl-eye"><b>{layout.name}</b> · {model.c}×{model.r} frame · {layout.nodes.length}⌾ · {(model.c - 1) * PITCH || PITCH}×{(model.r - 1) * PITCH || PITCH} mm span</span>
          <span className="gl-eye">LIBRARY · DRAFT — awaiting approval</span>
        </div>
        <div className="gl-vp">
          <Stage contour={model.contour} grid={model.grid} lattice={true} box={false}
            segments={[]} segFill={false} onPan={noop} onZoom={noop} onReset={noop} />
        </div>
      </section>
      <aside className="gl-controls">
        <div className="gl-card" style={{ padding: 14 }}>
          <div className="gl-field"><span>Frame · cols × rows</span>
            <div className="gl-steps">
              {LAYOUT_LIBRARY.map((f, i) => (
                <button key={i} aria-pressed={i === fi} onClick={() => { setFi(i); setLi(0) }}><b>{f.cols}×{f.rows}</b></button>
              ))}
            </div>
          </div>
          <div className="gl-field"><span>Layouts · {frame.layouts.length} presets</span>
            <div className="gl-steps">
              {frame.layouts.map((l, i) => (
                <button key={i} aria-pressed={i === li} onClick={() => setLi(i)}>
                  <b>{l.name}</b><span>{l.nodes.length}⌾{l.note ? ' · Full-grid only' : ''}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="gl-field"><span>View</span>
            <div className="gl-seg">
              <button aria-pressed={transpose} onClick={() => setTranspose(!transpose)}>transpose</button>
              <button aria-pressed={flipX} onClick={() => setFlipX(!flipX)}>flip ↔</button>
              <button aria-pressed={flipY} onClick={() => setFlipY(!flipY)}>flip ↕</button>
            </div>
          </div>
          {layout.note && <div className="gl-magic-note">{layout.note}</div>}
        </div>
      </aside>
    </div>
  )
}
