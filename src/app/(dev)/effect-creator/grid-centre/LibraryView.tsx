'use client'

// LibraryView — THE LAYOUT LIBRARY tab of the Centre Lab. Every frame and every preset layout,
// drawn on the real 48mm lattice, for Dan's visual review and approval. Display only:
// no engine, no wrap, no policy — the data is src/lib/effect/grid-magnet-library.ts.

import { useMemo, useState } from 'react'
import { LAYOUT_LIBRARY } from '@/lib/effect/grid-magnet-library'

const PITCH = 48
const PX = 3.4                        // px per mm
const SPOT = 24                       // lattice ghost radius (half pitch), as the bench draws it
const HOLD = 24                       // hold ring
const MAG = 6.5                      // magnet disc

export default function LibraryView() {
  const [fi, setFi] = useState(4)     // default 2×3 — the first interesting frame
  const [li, setLi] = useState(0)
  const [transpose, setTranspose] = useState(false)
  const [flipX, setFlipX] = useState(false)
  const [flipY, setFlipY] = useState(false)

  const frame = LAYOUT_LIBRARY[fi]
  const layout = frame.layouts[Math.min(li, frame.layouts.length - 1)]

  const view = useMemo(() => {
    let c = frame.cols, r = frame.rows
    let pts = layout.nodes.map(([x, y]) => [x, y] as [number, number])
    if (transpose) { pts = pts.map(([x, y]) => [y, x]); const t = c; c = r; r = t }
    if (flipX) pts = pts.map(([x, y]) => [c - 1 - x, y])
    if (flipY) pts = pts.map(([x, y]) => [x, r - 1 - y])
    return { c, r, pts }
  }, [frame, layout, transpose, flipX, flipY])

  const { c, r, pts } = view
  const wMM = (c + 1) * PITCH, hMM = (r + 1) * PITCH
  const ox = PITCH, oy = PITCH
  const key = (x: number, y: number) => `${x},${y}`
  const on = new Set(pts.map(([x, y]) => key(x, y)))

  return (
    <div style={{ padding: 4 }}>
      <div style={{ fontSize: 12, color: '#667', margin: '2px 0 14px' }}>THE LAYOUT LIBRARY · DRAFT — awaiting approval · every preset per frame on the 48mm lattice · canonical tall orientation · transpose/mirrors derived</div>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <aside style={{ width: 270, background: '#fff', borderRadius: 12, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
          <div style={{ fontSize: 11, letterSpacing: 1, color: '#889', marginBottom: 8 }}>FRAME</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {LAYOUT_LIBRARY.map((f, i) => (
              <button key={i} onClick={() => { setFi(i); setLi(0) }}
                style={{ padding: '5px 9px', borderRadius: 7, border: '1px solid ' + (i === fi ? '#3b6ef6' : '#ccd'), background: i === fi ? '#3b6ef6' : '#fff', color: i === fi ? '#fff' : '#334', fontSize: 12, cursor: 'pointer' }}>
                {f.cols}×{f.rows}</button>
            ))}
          </div>
          <div style={{ fontSize: 11, letterSpacing: 1, color: '#889', marginBottom: 8 }}>LAYOUTS · {frame.layouts.length}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {frame.layouts.map((l, i) => (
              <button key={i} onClick={() => setLi(i)}
                style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 7, border: '1px solid ' + (i === li ? '#3b6ef6' : '#dde'), background: i === li ? '#eef3ff' : '#fff', color: '#223', fontSize: 12.5, cursor: 'pointer' }}>
                <b>{l.name}</b><span style={{ color: '#889' }}>{l.nodes.length}⌾{l.note ? ' · !' : ''}</span></button>
            ))}
          </div>
          <div style={{ fontSize: 11, letterSpacing: 1, color: '#889', margin: '14px 0 8px' }}>VIEW</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {([['transpose', transpose, setTranspose], ['flip ↔', flipX, setFlipX], ['flip ↕', flipY, setFlipY]] as const).map(([label, v, set]) => (
              <button key={label} onClick={() => set(!v)}
                style={{ padding: '5px 9px', borderRadius: 7, border: '1px solid ' + (v ? '#3b6ef6' : '#ccd'), background: v ? '#3b6ef6' : '#fff', color: v ? '#fff' : '#334', fontSize: 12, cursor: 'pointer' }}>{label}</button>
            ))}
          </div>
          {layout.note && <div style={{ marginTop: 12, fontSize: 12, color: '#b25a00', background: '#fff6ec', borderRadius: 7, padding: '7px 9px' }}>{layout.note}</div>}
        </aside>
        <section style={{ background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
          <div style={{ fontSize: 13, marginBottom: 10 }}>
            <b>{layout.name}</b> · {c}×{r} frame · {pts.length} magnets · {(c - 1) * PITCH || PITCH}×{(r - 1) * PITCH || PITCH} mm span
          </div>
          <svg width={wMM * PX} height={hMM * PX} viewBox={`0 0 ${wMM} ${hMM}`} style={{ background: '#fbfbfc', borderRadius: 8 }}>
            {/* lattice ghosts, one ring beyond the frame */}
            {Array.from({ length: c + 2 }, (_, gx) => Array.from({ length: r + 2 }, (_, gy) => {
              const x = ox + (gx - 0.5) * PITCH, y = oy + (gy - 0.5) * PITCH
              return <circle key={`g${gx}-${gy}`} cx={x} cy={y} r={SPOT} fill="#000" opacity={0.035} stroke="#889" strokeOpacity={0.25} strokeWidth={0.6} />
            }))}
            {/* frame nodes */}
            {Array.from({ length: c }, (_, x) => Array.from({ length: r }, (_, y) => {
              const cx2 = ox + x * PITCH, cy2 = oy + y * PITCH
              return on.has(key(x, y)) ? null :
                <circle key={`f${x}-${y}`} cx={cx2} cy={cy2} r={3} fill="none" stroke="#99a" strokeDasharray="2 2" strokeWidth={0.9} />
            }))}
            {/* layout magnets */}
            {pts.map(([x, y], i) => {
              const cx2 = ox + x * PITCH, cy2 = oy + y * PITCH
              return <g key={i}>
                <circle cx={cx2} cy={cy2} r={HOLD} fill="#3b6ef6" opacity={0.13} stroke="#3b6ef6" strokeWidth={1.4} />
                <circle cx={cx2} cy={cy2} r={MAG} fill="#3c3f45" />
                <circle cx={cx2} cy={cy2} r={1.8} fill="#2fa463" />
              </g>
            })}
          </svg>
        </section>
      </div>
    </div>
  )
}
