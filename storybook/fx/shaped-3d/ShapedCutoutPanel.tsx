'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ShapePoint, ShapeProfile } from '../types'
import {
  DEFAULT_SHAPE_POINTS,
  createCutlineSvg,
  createRegistrationJson,
  createShapeMetrics,
  createShapeProfile,
  normalizeShapePoints,
} from '../core/shaped-geometry'

interface ShapedCutoutPanelProps {
  artworkUrl?: string
  profile: ShapeProfile
  onProfileChange: (profile: ShapeProfile) => void
}

const HANDLE_RADIUS = 2.4

export default function ShapedCutoutPanel({
  artworkUrl,
  profile,
  onProfileChange,
}: ShapedCutoutPanelProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [autoStatus, setAutoStatus] = useState<string>('Manual contour ready')
  const metrics = useMemo(() => createShapeMetrics(profile.points), [profile.points])
  const pathD = useMemo(() => createSvgPath(profile.points), [profile.points])

  useEffect(() => {
    if (!artworkUrl) {
      return
    }

    let cancelled = false
    sampleEdgeColors(artworkUrl, profile.points).then((edgeColors) => {
      if (cancelled) return
      onProfileChange({
        ...profile,
        edgeColors,
        updatedAt: new Date().toISOString(),
      })
    }).catch(() => {
      // Keep the UI interactive if browser image sampling fails.
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Edge colors follow artwork + contour only.
  }, [artworkUrl, profile.points])

  const updatePoint = (index: number, point: ShapePoint) => {
    const next = profile.points.map((existing, pointIndex) => (
      pointIndex === index ? point : existing
    ))
    onProfileChange({
      ...profile,
      points: normalizeShapePoints(next),
      source: 'manual',
      updatedAt: new Date().toISOString(),
    })
  }

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (activeIndex === null || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    updatePoint(activeIndex, {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    })
  }

  const runAutoCutout = async () => {
    if (!artworkUrl) {
      setAutoStatus('Upload image first')
      return
    }

    setAutoStatus('Tracing image...')
    try {
      const autoProfile = await createAutoProfile(artworkUrl)
      onProfileChange(autoProfile)
      setAutoStatus('Auto cutout proposed. Drag handles to correct it.')
    } catch {
      setAutoStatus('Auto trace failed; manual contour still available.')
    }
  }

  const resetManual = () => {
    onProfileChange(createShapeProfile(DEFAULT_SHAPE_POINTS, 'manual', profile.edgeColors))
    setAutoStatus('Manual contour reset')
  }

  const downloadSvg = () => {
    downloadText('shaped-effect-cutline.svg', 'image/svg+xml', createCutlineSvg(profile, metrics))
  }

  const downloadJson = () => {
    downloadText(
      'shaped-effect-registration.json',
      'application/json',
      JSON.stringify(createRegistrationJson(profile, metrics), null, 2)
    )
  }

  return (
    <aside style={panelStyle}>
      <div>
        <div style={eyebrowStyle}>Shaped Effect Lab</div>
        <h1 style={titleStyle}>Cutout to 3D Effect</h1>
        <p style={copyStyle}>
          Upload art, accept or edit the cutline, then preview a 1.6mm shaped object with front image, solid back, and edge colour bleed.
        </p>
      </div>

      <div style={stepStyle}>
        <strong>1. Cutline</strong>
        <span>{autoStatus}</span>
      </div>

      <div style={editorShellStyle}>
        {artworkUrl ? (
          <svg
            ref={svgRef}
            viewBox="0 0 100 100"
            style={editorSvgStyle}
            onPointerMove={handlePointerMove}
            onPointerUp={() => setActiveIndex(null)}
            onPointerLeave={() => setActiveIndex(null)}
          >
            <image href={artworkUrl} x="0" y="0" width="100" height="100" preserveAspectRatio="none" opacity="0.82" />
            <path d={pathD} fill="rgba(245, 207, 126, 0.2)" stroke="#f5cf7e" strokeWidth="0.9" />
            {profile.points.map((point, index) => (
              <circle
                key={`${point.x}-${point.y}-${index}`}
                cx={point.x * 100}
                cy={point.y * 100}
                r={HANDLE_RADIUS}
                fill={activeIndex === index ? '#ffffff' : '#f5cf7e'}
                stroke="#15130f"
                strokeWidth="0.8"
                style={{ cursor: 'grab' }}
                onPointerDown={(event) => {
                  event.preventDefault()
                  setActiveIndex(index)
                }}
              />
            ))}
          </svg>
        ) : (
          <div style={emptyEditorStyle}>Upload an image to trace a shaped Effect.</div>
        )}
      </div>

      <div style={buttonRowStyle}>
        <button type="button" style={primaryButtonStyle} onClick={runAutoCutout}>
          Auto cutout
        </button>
        <button type="button" style={secondaryButtonStyle} onClick={resetManual}>
          Reset handles
        </button>
      </div>

      <div style={metricGridStyle}>
        <Metric label="Outer width" value={`${metrics.widthMm.toFixed(1)}mm`} />
        <Metric label="Outer height" value={`${metrics.heightMm.toFixed(1)}mm`} />
        <Metric label="Thickness" value={`${metrics.thicknessMm.toFixed(1)}mm`} />
        <Metric label="-8mm inner" value={`${metrics.innerWidthMm.toFixed(1)} x ${metrics.innerHeightMm.toFixed(1)}mm`} />
      </div>

      <div style={{
        ...statusCardStyle,
        borderColor: metrics.attachmentPass ? 'rgba(86, 168, 107, 0.7)' : 'rgba(235, 160, 64, 0.85)',
      }}>
        <strong>{metrics.attachmentPass ? 'Attachment zone passes' : 'Attachment zone conflict'}</strong>
        <span>
          {metrics.attachmentPass
            ? 'Inset cutline can contain the 70 x 70mm reserved attachment square.'
            : 'Outer shape is 70mm-min, but the -8mm inset cannot contain 70 x 70mm. This is the rule Dan needs to resolve.'}
        </span>
      </div>

      <div style={buttonRowStyle}>
        <button type="button" style={secondaryButtonStyle} onClick={downloadSvg}>
          Export SVG
        </button>
        <button type="button" style={secondaryButtonStyle} onClick={downloadJson}>
          Export JSON
        </button>
      </div>
    </aside>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={metricStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function createSvgPath(points: ShapePoint[]) {
  return points.map((point, index) => {
    const command = index === 0 ? 'M' : 'L'
    return `${command} ${(point.x * 100).toFixed(2)} ${(point.y * 100).toFixed(2)}`
  }).join(' ') + ' Z'
}

async function createAutoProfile(artworkUrl: string): Promise<ShapeProfile> {
  const sample = await readImageSample(artworkUrl, 420)
  const mask = createMask(sample)
  const center = findMaskCenter(mask, sample.width, sample.height)
  const points = traceRadialContour(mask, sample.width, sample.height, center, 96)
  const edgeColors = sampleColors(sample, points)
  return createShapeProfile(points, 'auto', edgeColors)
}

async function sampleEdgeColors(artworkUrl: string, points: ShapePoint[]) {
  const sample = await readImageSample(artworkUrl, 360)
  return sampleColors(sample, points)
}

interface ImageSample {
  width: number
  height: number
  data: Uint8ClampedArray
}

async function readImageSample(artworkUrl: string, maxSize: number): Promise<ImageSample> {
  const image = await loadImage(artworkUrl)
  const ratio = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * ratio))
  const height = Math.max(1, Math.round(image.naturalHeight * ratio))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas 2D context unavailable')
  }
  context.drawImage(image, 0, 0, width, height)
  const data = context.getImageData(0, 0, width, height).data
  return { width, height, data }
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = url
  })
}

function createMask(sample: ImageSample) {
  const { width, height, data } = sample
  const mask = new Uint8Array(width * height)
  const cornerColor = averageCornerColor(sample)
  let visible = 0

  for (let index = 0; index < width * height; index += 1) {
    const dataIndex = index * 4
    const alpha = data[dataIndex + 3]
    const colorDistance = Math.sqrt(
      (data[dataIndex] - cornerColor.r) ** 2
      + (data[dataIndex + 1] - cornerColor.g) ** 2
      + (data[dataIndex + 2] - cornerColor.b) ** 2
    )
    const isVisible = alpha > 36 && (alpha < 250 || colorDistance > 34)
    if (isVisible) {
      mask[index] = 1
      visible += 1
    }
  }

  if (visible < width * height * 0.03) {
    mask.fill(1)
  }

  return mask
}

function averageCornerColor(sample: ImageSample) {
  const { width, height, data } = sample
  const points = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ]
  const total = points.reduce((acc, [x, y]) => {
    const i = (y * width + x) * 4
    return {
      r: acc.r + data[i],
      g: acc.g + data[i + 1],
      b: acc.b + data[i + 2],
    }
  }, { r: 0, g: 0, b: 0 })
  return { r: total.r / 4, g: total.g / 4, b: total.b / 4 }
}

function findMaskCenter(mask: Uint8Array, width: number, height: number) {
  let count = 0
  let xTotal = 0
  let yTotal = 0

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x]) {
        count += 1
        xTotal += x
        yTotal += y
      }
    }
  }

  if (count === 0) {
    return { x: width / 2, y: height / 2 }
  }

  return { x: xTotal / count, y: yTotal / count }
}

function traceRadialContour(
  mask: Uint8Array,
  width: number,
  height: number,
  center: { x: number; y: number },
  steps: number
) {
  const points: ShapePoint[] = []
  const maxRadius = Math.hypot(width, height)

  for (let step = 0; step < steps; step += 1) {
    const angle = (step / steps) * Math.PI * 2
    let last = { x: center.x, y: center.y }

    for (let radius = 0; radius < maxRadius; radius += 1) {
      const x = Math.round(center.x + Math.cos(angle) * radius)
      const y = Math.round(center.y + Math.sin(angle) * radius)
      if (x < 0 || y < 0 || x >= width || y >= height) break
      if (!mask[y * width + x] && radius > 4) break
      last = { x, y }
    }

    points.push({
      x: last.x / width,
      y: last.y / height,
    })
  }

  return normalizeShapePoints(points)
}

function sampleColors(sample: ImageSample, points: ShapePoint[]) {
  const { width, height, data } = sample
  return points.map((point) => {
    const x = Math.max(0, Math.min(width - 1, Math.round(point.x * (width - 1))))
    const y = Math.max(0, Math.min(height - 1, Math.round(point.y * (height - 1))))
    const index = (y * width + x) * 4
    return rgbToHex(data[index], data[index + 1], data[index + 2])
  })
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

function downloadText(filename: string, type: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 24,
  left: 24,
  bottom: 24,
  width: 360,
  padding: 20,
  zIndex: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  color: '#f6efe0',
  background: 'linear-gradient(180deg, rgba(23, 20, 14, 0.94), rgba(12, 12, 10, 0.88))',
  border: '1px solid rgba(245, 207, 126, 0.18)',
  borderRadius: 22,
  boxShadow: '0 24px 80px rgba(0, 0, 0, 0.42)',
  backdropFilter: 'blur(18px)',
  overflow: 'auto',
}

const eyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 1.8,
  textTransform: 'uppercase',
  color: '#f5cf7e',
}

const titleStyle: React.CSSProperties = {
  margin: '6px 0 8px',
  fontSize: 26,
  lineHeight: 1,
  letterSpacing: -0.6,
}

const copyStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.45,
  color: 'rgba(246, 239, 224, 0.72)',
}

const stepStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  fontSize: 12,
  color: 'rgba(246, 239, 224, 0.72)',
}

const editorShellStyle: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  aspectRatio: '1 / 1',
  borderRadius: 18,
  overflow: 'hidden',
  background: 'radial-gradient(circle at 50% 35%, #372f22, #15130f)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
}

const editorSvgStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'block',
  touchAction: 'none',
}

const emptyEditorStyle: React.CSSProperties = {
  height: '100%',
  display: 'grid',
  placeItems: 'center',
  padding: 24,
  textAlign: 'center',
  color: 'rgba(246, 239, 224, 0.55)',
}

const buttonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
}

const primaryButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px 12px',
  border: 0,
  borderRadius: 12,
  color: '#17140f',
  background: '#f5cf7e',
  fontWeight: 700,
  cursor: 'pointer',
}

const secondaryButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px 12px',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 12,
  color: '#f6efe0',
  background: 'rgba(255,255,255,0.07)',
  fontWeight: 650,
  cursor: 'pointer',
}

const metricGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
}

const metricStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: 12,
  borderRadius: 14,
  background: 'rgba(255,255,255,0.06)',
  fontSize: 11,
  color: 'rgba(246, 239, 224, 0.6)',
}

const statusCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: 14,
  border: '1px solid',
  borderRadius: 16,
  background: 'rgba(255,255,255,0.05)',
  fontSize: 12,
  lineHeight: 1.35,
  color: 'rgba(246, 239, 224, 0.8)',
}
