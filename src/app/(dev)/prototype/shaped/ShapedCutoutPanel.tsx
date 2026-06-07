'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyBrushEdit, imageToMaskFromAlphaOrLuma, loadImageElement, maskCoverage } from './mask-utils'
import { createShapeSpecDraft, type BinaryMask, type MaskEditTool, type ShapeMaskEdit, type ShapeMeshStats } from './shape-spec'

interface ShapedCutoutPanelProps {
  artworkUrl: string
  seedMaskUrl?: string
  meshStats: ShapeMeshStats | null
  onMaskChange: (mask: BinaryMask | null) => void
}

const PANEL_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 18,
  left: 18,
  zIndex: 20,
  width: 340,
  padding: 14,
  borderRadius: 18,
  background: 'rgba(10, 12, 14, 0.82)',
  color: '#fff',
  fontFamily: 'Avenir Next, Helvetica Neue, sans-serif',
  boxShadow: '0 18px 70px rgba(0, 0, 0, 0.28)',
  backdropFilter: 'blur(14px)',
}

export default function ShapedCutoutPanel({
  artworkUrl,
  seedMaskUrl,
  meshStats,
  onMaskChange,
}: ShapedCutoutPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [mask, setMask] = useState<BinaryMask | null>(null)
  const [tool, setTool] = useState<MaskEditTool>('erase')
  const [brushRadius, setBrushRadius] = useState(24)
  const [edits, setEdits] = useState<ShapeMaskEdit[]>([])
  const [adapterStatus, setAdapterStatus] = useState('Loading approved mask...')
  const pointerDownRef = useRef(false)

  const shapeSpec = useMemo(() => {
    return createShapeSpecDraft({
      sourceRef: artworkUrl,
      approvedMaskRef: seedMaskUrl ?? 'local-proposal-mask',
      editOps: edits,
      adapterId: seedMaskUrl ? 'approved-seed-mask' : 'local-border-proposal',
      modelVersion: seedMaskUrl ? 'manual-polished-seed-v1' : 'no-ml-local-proposal-v1',
    })
  }, [artworkUrl, edits, seedMaskUrl])

  useEffect(() => {
    let cancelled = false
    async function loadMask() {
      setAdapterStatus(seedMaskUrl ? 'Loading approved seed mask...' : 'Creating local proposal...')
      const artworkImage = await loadImageElement(artworkUrl)
      const sourceMaskImage = seedMaskUrl ? await loadImageElement(seedMaskUrl) : artworkImage
      if (cancelled) return
      imageRef.current = artworkImage
      const nextMask = imageToMaskFromAlphaOrLuma(sourceMaskImage, 900)
      setMask(nextMask)
      setEdits([])
      setAdapterStatus(seedMaskUrl
        ? 'Seed mask loaded. Brush edits are live before mesh approval.'
        : 'Local proposal loaded. This is not BEN2; polish before approval.'
      )
      onMaskChange(nextMask)
    }

    loadMask().catch((error) => {
      setAdapterStatus(error instanceof Error ? error.message : 'Mask load failed')
      onMaskChange(null)
    })

    return () => {
      cancelled = true
    }
  }, [artworkUrl, onMaskChange, seedMaskUrl])

  useEffect(() => {
    const canvas = canvasRef.current
    const image = imageRef.current
    if (!canvas || !image || !mask) return
    canvas.width = mask.width
    canvas.height = mask.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, mask.width, mask.height)
    const overlay = ctx.createImageData(mask.width, mask.height)
    for (let i = 0; i < mask.data.length; i += 1) {
      overlay.data[i * 4] = 0
      overlay.data[i * 4 + 1] = mask.data[i] > 127 ? 210 : 0
      overlay.data[i * 4 + 2] = mask.data[i] > 127 ? 255 : 0
      overlay.data[i * 4 + 3] = mask.data[i] > 127 ? 58 : 96
    }
    ctx.putImageData(overlay, 0, 0)
  }, [mask])

  const editAtEvent = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const currentMask = mask
    const canvas = canvasRef.current
    if (!currentMask || !canvas) return
    const bounds = canvas.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / bounds.width) * currentMask.width
    const y = ((event.clientY - bounds.top) / bounds.height) * currentMask.height
    const nextMask = applyBrushEdit(currentMask, x, y, brushRadius, tool)
    const edit: ShapeMaskEdit = {
      id: `${Date.now()}-${edits.length}`,
      tool,
      x,
      y,
      radius: brushRadius,
      at: Date.now(),
    }
    setMask(nextMask)
    setEdits((prev) => [...prev, edit])
    onMaskChange(nextMask)
  }, [brushRadius, edits.length, mask, onMaskChange, tool])

  const resetMask = useCallback(async () => {
    const sourceMaskImage = seedMaskUrl ? await loadImageElement(seedMaskUrl) : imageRef.current
    if (!sourceMaskImage) return
    const nextMask = imageToMaskFromAlphaOrLuma(sourceMaskImage, 900)
    setMask(nextMask)
    setEdits([])
    onMaskChange(nextMask)
  }, [onMaskChange, seedMaskUrl])

  return (
    <div style={PANEL_STYLE}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, opacity: 0.68, letterSpacing: 1.2, textTransform: 'uppercase' }}>Shaped effect</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>Approved cut-out mask</div>
        </div>
        <div style={{ fontSize: 11, color: '#9ee7d0' }}>{Math.round((mask ? maskCoverage(mask) : 0) * 100)}%</div>
      </div>

      <canvas
        ref={canvasRef}
        onPointerDown={(event) => { pointerDownRef.current = true; editAtEvent(event) }}
        onPointerMove={(event) => { if (pointerDownRef.current) editAtEvent(event) }}
        onPointerUp={() => { pointerDownRef.current = false }}
        onPointerLeave={() => { pointerDownRef.current = false }}
        style={{
          display: 'block',
          width: '100%',
          height: 260,
          marginTop: 12,
          borderRadius: 14,
          background: '#fff',
          objectFit: 'contain',
          cursor: 'crosshair',
        }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
        <button onClick={() => setTool('erase')} style={buttonStyle(tool === 'erase')}>Erase</button>
        <button onClick={() => setTool('restore')} style={buttonStyle(tool === 'restore')}>Restore</button>
        <button onClick={() => { void resetMask() }} style={buttonStyle(false)}>Reset</button>
      </div>

      <label style={{ display: 'block', fontSize: 12, marginTop: 12, opacity: 0.8 }}>
        Brush {brushRadius}px
        <input
          type="range"
          min={8}
          max={80}
          value={brushRadius}
          onChange={(event) => setBrushRadius(Number(event.target.value))}
          style={{ width: '100%' }}
        />
      </label>

      <div style={{ fontSize: 11, lineHeight: 1.4, opacity: 0.76, marginTop: 10 }}>
        {adapterStatus}
      </div>
      <div style={{ fontSize: 11, lineHeight: 1.45, opacity: 0.76, marginTop: 8 }}>
        Spec: {shapeSpec.dimensionsMm.bodyThicknessMm}mm body, rounded {shapeSpec.dimensionsMm.edgeRadiusMm}mm edge, 70mm min dimension.
        {meshStats ? ` Mesh: ${meshStats.contourPoints} pts, ${Math.round(meshStats.widthMm)}x${Math.round(meshStats.heightMm)}mm.` : ' Mesh pending.'}
      </div>
    </div>
  )
}

function buttonStyle(active: boolean): React.CSSProperties {
  return {
    border: 'none',
    borderRadius: 10,
    padding: '10px 8px',
    color: '#fff',
    background: active ? '#087f5b' : 'rgba(255,255,255,0.16)',
    fontWeight: 700,
    cursor: 'pointer',
  }
}
