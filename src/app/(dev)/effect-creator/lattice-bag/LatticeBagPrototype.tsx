'use client'

import { useRef, useState } from 'react'
import { maskFromImageData } from '@/lib/effect/image-shape'
import { traceContourRaw } from '@/lib/effect/contour'
import { pointInPolygon } from '@/lib/effect/polygon'
import type { Pt } from '@/lib/effect/types'
import {
  DISK_DIAMETER_MM,
  fitBagOptions,
  LATTICE_PITCH_MM,
  MAX_BAG_DISKS,
  normalizeBagOutline,
  type BagFit,
  type PreparedBag,
  prepareBag,
} from '@/lib/lattice-bag'
import styles from './lattice-bag.module.css'

const MAX_TRACE_POINTS = 180

function pathFrom(points: ReadonlyArray<Pt>) {
  return `M ${points.map(([x, y]) => `${x.toFixed(3)} ${y.toFixed(3)}`).join(' L ')} Z`
}

async function imageFromFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function outlineFromFile(file: File): Promise<Pt[]> {
  const image = await imageFromFile(file)
  const longest = Math.max(image.naturalWidth, image.naturalHeight)
  const ratio = Math.min(1, 512 / longest)
  const width = Math.max(1, Math.round(image.naturalWidth * ratio))
  const height = Math.max(1, Math.round(image.naturalHeight * ratio))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('This browser cannot read the uploaded shape')
  context.drawImage(image, 0, 0, width, height)
  const imageData = context.getImageData(0, 0, width, height)
  const traced = traceContourRaw(maskFromImageData(imageData).mask, width, height)
  if (!traced) throw new Error('No closed shape was found in that image')
  const stride = Math.max(1, Math.ceil(traced.length / MAX_TRACE_POINTS))
  return normalizeBagOutline(traced.filter((_, index) => index % stride === 0))
}

function boundsFor(fit: BagFit) {
  const xs = [...fit.outline.map((point) => point[0]), ...fit.seats.map((point) => point[0])]
  const ys = [...fit.outline.map((point) => point[1]), ...fit.seats.map((point) => point[1])]
  const minX = Math.min(...xs) - 42
  const minY = Math.min(...ys) - 42
  const maxX = Math.max(...xs) + 42
  const maxY = Math.max(...ys) + 42
  return { minX, minY, width: maxX - minX, height: maxY - minY }
}

export function LatticeBagPrototype() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [prepared, setPrepared] = useState<PreparedBag | null>(null)
  const [fit, setFit] = useState<BagFit | null>(null)
  const [options, setOptions] = useState<BagFit[]>([])
  const [optionIndex, setOptionIndex] = useState(0)
  const [allowRotation, setAllowRotation] = useState(false)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')

  async function upload(file: File | undefined) {
    if (!file) return
    setError('')
    try {
      const nextOutline = await outlineFromFile(file)
      const nextPrepared = prepareBag(nextOutline)
      setPrepared(nextPrepared)
      const nextOptions = fitBagOptions(nextPrepared, 1, allowRotation)
      setOptions(nextOptions)
      setOptionIndex(0)
      setFit(nextOptions[0])
      setFileName(file.name)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The shape could not be loaded')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function add() {
    if (!prepared || !fit || fit.seats.length >= MAX_BAG_DISKS) return
    selectCount(fit.seats.length + 1)
  }

  function remove() {
    if (!prepared || !fit || fit.seats.length <= 1) return
    selectCount(fit.seats.length - 1)
  }

  function selectCount(count: number) {
    if (!prepared) return
    const nextOptions = fitBagOptions(prepared, count, allowRotation)
    setOptions(nextOptions)
    setOptionIndex(0)
    setFit(nextOptions[0])
  }

  function selectOption(index: number) {
    setOptionIndex(index)
    setFit(options[index])
  }

  function toggleRotation() {
    if (!prepared || !fit) return
    const nextRotation = !allowRotation
    const nextOptions = fitBagOptions(prepared, fit.seats.length, nextRotation)
    setAllowRotation(nextRotation)
    setOptions(nextOptions)
    setOptionIndex(0)
    setFit(nextOptions[0])
  }

  const bounds = fit ? boundsFor(fit) : null
  const gridRadius = bounds ? Math.ceil(Math.max(bounds.width, bounds.height) / LATTICE_PITCH_MM) + 2 : 0
  const gridAxis = Array.from(
    { length: gridRadius * 2 + 1 },
    (_, index) => (index - gridRadius) * LATTICE_PITCH_MM,
  )
  const ghostSeats = fit && bounds
    ? (() => {
        const cosine = Math.cos(fit.rotation)
        const sine = Math.sin(fit.rotation)
        const points: Array<{ point: Pt; inside: boolean }> = []
        for (let y = -gridRadius; y <= gridRadius; y++) {
          for (let x = -gridRadius; x <= gridRadius; x++) {
            const localX = x * LATTICE_PITCH_MM
            const localY = y * LATTICE_PITCH_MM
            const point: Pt = [
              fit.centre[0] + localX * cosine - localY * sine,
              fit.centre[1] + localX * sine + localY * cosine,
            ]
            if (point[0] < bounds.minX || point[0] > bounds.minX + bounds.width || point[1] < bounds.minY || point[1] > bounds.minY + bounds.height) continue
            points.push({ point, inside: pointInPolygon(point, fit.outline) })
          }
        }
        return points
      })()
    : []

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Rigid lattice · fluid wrap prototype</p>
            <h1>Lattice bag</h1>
            <p>The rigid 48 mm lattice settles inside the uploaded shape while its outline scales without deforming.</p>
          </div>
          {fit && <div className={styles.count}><strong>{fit.seats.length}</strong><span>disks</span></div>}
        </header>

        <div className={styles.stage}>
          {fit && bounds ? (
            <svg
              aria-label={`${fit.seats.length} rigid disks wrapped by the uploaded shape`}
              viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
              preserveAspectRatio="xMidYMid meet"
            >
              <g
                className={styles.grid}
                transform={`translate(${fit.centre[0]} ${fit.centre[1]}) rotate(${fit.rotation * 180 / Math.PI})`}
              >
                {gridAxis.map((x) => <line key={`x${x}`} x1={x} y1={-gridRadius * LATTICE_PITCH_MM} x2={x} y2={gridRadius * LATTICE_PITCH_MM} />)}
                {gridAxis.map((y) => <line key={`y${y}`} x1={-gridRadius * LATTICE_PITCH_MM} y1={y} x2={gridRadius * LATTICE_PITCH_MM} y2={y} />)}
              </g>
              <path className={styles.shape} d={pathFrom(fit.outline)} />
              <g className={styles.ghostSeats}>
                {ghostSeats.map(({ point, inside }) => (
                  <circle
                    className={inside ? styles.ghostInside : styles.ghostOutside}
                    cx={point[0]}
                    cy={point[1]}
                    key={`${point[0]},${point[1]}`}
                    r={DISK_DIAMETER_MM / 2}
                  />
                ))}
              </g>
              {fit.seats.map(([x, y], index) => (
                <g key={`${x},${y}`} className={styles.disk}>
                  <circle cx={x} cy={y} r={DISK_DIAMETER_MM / 2} />
                  <text x={x} y={y + 2.6}>{index + 1}</text>
                </g>
              ))}
              {fit.contacts.map((contact, index) => (
                <g key={`${contact.disk[0]},${contact.disk[1]},${index}`} className={styles.contact}>
                  <line x1={contact.disk[0]} y1={contact.disk[1]} x2={contact.outline[0]} y2={contact.outline[1]} />
                  <circle cx={contact.outline[0]} cy={contact.outline[1]} r={2.8} />
                </g>
              ))}
              <circle className={styles.core} cx={fit.centre[0]} cy={fit.centre[1]} r={3.2} />
            </svg>
          ) : (
            <button className={styles.empty} onClick={() => fileRef.current?.click()}>
              <span>Upload a transparent or high-contrast image</span>
              <small>The outline becomes the rigid, uniformly scaling bag.</small>
            </button>
          )}
        </div>

        {options.length > 1 && (
          <nav className={styles.options} aria-label="Lattice arrangement options">
            {options.map((candidate, index) => (
              <button
                key={candidate.option}
                aria-pressed={index === optionIndex}
                onClick={() => selectOption(index)}
              >
                {candidate.option}
              </button>
            ))}
            <button aria-pressed={allowRotation} onClick={toggleRotation}>
              Rotation {allowRotation ? 'on' : 'off'}
            </button>
          </nav>
        )}

        <footer className={styles.controls}>
          <input
            ref={fileRef}
            className={styles.hiddenInput}
            type="file"
            accept="image/*,.svg"
            onChange={(event) => void upload(event.target.files?.[0])}
          />
          <button onClick={() => fileRef.current?.click()}>Upload shape</button>
          <button onClick={remove} disabled={!fit || fit.seats.length <= 1}>Remove disk</button>
          <button className={styles.primary} onClick={add} disabled={!fit || fit.seats.length >= MAX_BAG_DISKS}>Add disk</button>
        </footer>
        <div className={styles.status} aria-live="polite">
          {error || (fit ? `${fileName} · ${fit.sizeMM.toFixed(1)} mm outline · tangent at ${fit.contacts.length} edge point${fit.contacts.length === 1 ? '' : 's'}` : 'No shape loaded')}
        </div>
      </section>
    </main>
  )
}
