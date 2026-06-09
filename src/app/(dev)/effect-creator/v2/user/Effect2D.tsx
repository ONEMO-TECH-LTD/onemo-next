// Effect2D — the Phase-A (creation) 2D hero. NO WebGL/R3F: this is what removes the always-mounted
// 3D perf trap during creation (lean-spec §4/§7). It renders the ONE magic-blend composite clipped to
// the current mm outline + a soft drop shadow, on the same grey backdrop as the empty state.
//
// 2D leads: subscribes to the outline store, so it follows the editor's live edits (editedContourMM)
// exactly like ShapedModel did for the 3D mesh. Silhouette parity — Effect2D clips to the SAME mm
// outline the 3D mesh extrudes and the cutline uses.
//
// Coordinate convention (mirrors OutlineEditor.docFromSpec): geometry is y-UP mm (the engine builds it
// y-up so the 3D renders upright). The composite canvas is y-up too (loadImageData flips for 3D-UV
// parity, flipY=false) — so for a 2D upright display we flip the composite to upright AND map the
// y-up-mm outline to y-down display px via [x/mmPerPx, maskH − y/mmPerPx] (the inverse of docFromSpec).

'use client'

import { useMemo } from 'react'
import { useOutlineStore } from './outlineStore'
import type { PreparedEffect } from '@/lib/effect/prepare-effect'
import type { Contour } from '@/lib/effect/types'
import styles from './effect-2d.module.css'

/**
 * The engine composite is y-up (row 0 = bottom, for 3D UV parity). For a 2D upright display, flip it
 * once into an upright data URL. Memoised by the caller on the source canvas (once per upload, never
 * per-render — so the toDataURL cost doesn't loop, unlike the V1 trap).
 */
function uprightDataUrl(canvas: HTMLCanvasElement): string {
  const c = document.createElement('canvas')
  c.width = canvas.width
  c.height = canvas.height
  const ctx = c.getContext('2d')!
  ctx.translate(0, canvas.height)
  ctx.scale(1, -1)
  ctx.drawImage(canvas, 0, 0)
  return c.toDataURL()
}

export default function Effect2D({ prepared }: { prepared: PreparedEffect }) {
  const editedContourMM = useOutlineStore((s) => s.editedContourMM)
  const { spec, composite } = prepared
  const cw = composite.width
  const ch = composite.height
  const { mmPerPx, maskWidthPx: maskW, maskHeightPx: maskH } = spec

  // upright composite (flip the y-up canvas) — once per composite (new upload).
  const compositeUrl = useMemo(() => uprightDataUrl(composite), [composite])

  // current outline: live editor edits if present, else the prepared geometry. y-up mm → y-down
  // display px (mirror docFromSpec: [x/mmPerPx, maskH − y/mmPerPx]), scaled mask-px → composite-px
  // (equal for the standard square; the scale generalises to the shaped path later).
  const pathD = useMemo(() => {
    const contour: Contour | null = editedContourMM ?? spec.geometryMM
    const ring = contour?.outer?.pts
    if (!ring || ring.length < 3) return ''
    const sx = cw / maskW
    const sy = ch / maskH
    const pts = ring.map(([xmm, ymm]) => {
      const xpx = (xmm / mmPerPx) * sx
      const ypx = (maskH - ymm / mmPerPx) * sy
      return `${xpx.toFixed(2)} ${ypx.toFixed(2)}`
    })
    return `M ${pts.join(' L ')} Z`
  }, [editedContourMM, spec.geometryMM, cw, ch, maskW, maskH, mmPerPx])

  return (
    <div className={styles.wrap}>
      <svg className={styles.svg} viewBox={`0 0 ${cw} ${ch}`} preserveAspectRatio="xMidYMid meet" aria-label="Your effect">
        <defs>
          <clipPath id="effect2d-clip">
            <path d={pathD} />
          </clipPath>
          <filter id="effect2d-shadow" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy={ch * 0.014} stdDeviation={ch * 0.022} floodColor="#141828" floodOpacity="0.22" />
          </filter>
        </defs>
        <g filter="url(#effect2d-shadow)">
          <image
            href={compositeUrl}
            x={0}
            y={0}
            width={cw}
            height={ch}
            preserveAspectRatio="none"
            clipPath={pathD ? 'url(#effect2d-clip)' : undefined}
          />
        </g>
      </svg>
    </div>
  )
}
