'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowClockwise, CaretLeft, CaretRight, Minus, Plus, UploadSimple } from '@phosphor-icons/react'
import { maskFromImageData } from '@/lib/effect/image-shape'
import { traceContourRaw } from '@/lib/effect/contour'
import { pointInPolygon } from '@/lib/effect/polygon'
import type { Pt } from '@/lib/effect/types'
import {
  DISK_DIAMETER_MM,
  classifyBag,
  fitClassifiedBag,
  fitClassifiedOptions,
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
const CUTOUTS = [
  ['Batterfly', '/lattice-bag/cutouts/batterfly.png'],
  ['Batwoman', '/lattice-bag/cutouts/batwoman.png'],
  ['Bot 2', '/lattice-bag/cutouts/bot-2.png'],
  ['Bot', '/lattice-bag/cutouts/bot.png'],
  ['Duck', '/lattice-bag/cutouts/duck.png'],
  ['Pacman Pearl 2', '/lattice-bag/cutouts/pacman-pearl-2.png'],
  ['Pacman Pearl', '/lattice-bag/cutouts/pacman-pearl.png'],
  ['Pill', '/lattice-bag/cutouts/pill.png'],
  ['Snowqueen', '/lattice-bag/cutouts/snowqueen.png'],
  ['Superman', '/lattice-bag/cutouts/superman.png'],
] as const

function classifiedCounts(prepared: PreparedBag) {
  const shapeClass = classifyBag(prepared)
  return shapeClass === 'Portrait rectangle' || shapeClass === 'Landscape rectangle'
    ? [1, 2, 6, 8]
    : [1, 4, 9, 16]
}

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

async function imageFromPath(path: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.src = path
  await image.decode()
  return image
}

function outlineFromImage(image: HTMLImageElement): Pt[] {
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

async function outlineFromFile(file: File): Promise<Pt[]> {
  return outlineFromImage(await imageFromFile(file))
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

function bandForSize(sizeMM: number) {
  if (sizeMM < 72) return 'B1'
  if (sizeMM < 120) return 'B2'
  if (sizeMM < 168) return 'B3'
  if (sizeMM < 216) return 'B4'
  return 'B5+'
}

export function LatticeBagPrototype() {
  const fileRef = useRef<HTMLInputElement>(null)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [prepared, setPrepared] = useState<PreparedBag | null>(null)
  const [fit, setFit] = useState<BagFit | null>(null)
  const [options, setOptions] = useState<BagFit[]>([])
  const [classFits, setClassFits] = useState<BagFit[]>([])
  const [optionIndex, setOptionIndex] = useState(0)
  const [allowRotation, setAllowRotation] = useState(false)
  const [isFittingRotation, setIsFittingRotation] = useState(false)
  const [mode, setMode] = useState<'auto' | 'classified'>('classified')
  const [selectedCutout, setSelectedCutout] = useState('')
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')

  function fitsFor(nextPrepared: PreparedBag, count: number, rotation = allowRotation, nextMode = mode) {
    return nextMode === 'classified'
      ? fitClassifiedOptions(nextPrepared, count, rotation)
      : fitBagOptions(nextPrepared, count, rotation)
  }

  function showOutline(nextOutline: Pt[], name: string) {
    const nextPrepared = prepareBag(nextOutline)
    setPrepared(nextPrepared)
    const nextClassFits = classifiedCounts(nextPrepared).map((count) => fitClassifiedBag(nextPrepared, count, allowRotation))
    const nextOptions = fitsFor(nextPrepared, nextClassFits[0].seats.length)
    setClassFits(nextClassFits)
    setOptions(nextOptions)
    setOptionIndex(0)
    setFit(mode === 'classified' ? nextClassFits[0] : nextOptions[0])
    setFileName(name)
  }

  async function upload(file: File | undefined) {
    if (!file) return
    setError('')
    try {
      showOutline(await outlineFromFile(file), file.name)
      setSelectedCutout('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The shape could not be loaded')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function loadCutout(path: string) {
    setSelectedCutout(path)
    if (!path) return
    setError('')
    try {
      const cutout = CUTOUTS.find((candidate) => candidate[1] === path)
      showOutline(outlineFromImage(await imageFromPath(path)), cutout?.[0] ?? path)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The cutout could not be loaded')
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
    const nextOptions = fitsFor(prepared, count)
    setOptions(nextOptions)
    setOptionIndex(0)
    setFit(nextOptions[0])
  }

  function selectClassFit(index: number) {
    if (!prepared) return
    const nextFit = fitClassifiedBag(prepared, classFits[index].seats.length, allowRotation)
    setClassFits((current) => current.map((candidate, candidateIndex) => candidateIndex === index ? nextFit : candidate))
    setOptionIndex(0)
    setFit(nextFit)
  }

  function selectOption(index: number) {
    setOptionIndex(index)
    setFit(options[index])
  }

  function stepOption(direction: -1 | 1) {
    const navigation = mode === 'classified' ? classFits : options
    if (navigation.length < 2 || !fit) return
    const currentIndex = mode === 'classified'
      ? Math.max(0, navigation.findIndex((candidate) => candidate.seats.length === fit.seats.length))
      : optionIndex
    const nextIndex = (currentIndex + direction + navigation.length) % navigation.length
    if (mode === 'classified') selectClassFit(nextIndex)
    else selectOption(nextIndex)
  }

  function toggleRotation() {
    if (!prepared || !fit) return
    const nextRotation = !allowRotation
    setAllowRotation(nextRotation)
    setIsFittingRotation(true)
    setOptionIndex(0)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (mode === 'classified') {
        const nextFit = fitClassifiedBag(prepared, fit.seats.length, nextRotation)
        setClassFits((current) => current.map((candidate) => candidate.seats.length === nextFit.seats.length ? nextFit : candidate))
        setFit(nextFit)
      } else {
        const nextOptions = fitBagOptions(prepared, fit.seats.length, nextRotation)
        setOptions(nextOptions)
        setFit(nextOptions[0])
      }
      setIsFittingRotation(false)
    }))
  }

  function selectMode(nextMode: 'auto' | 'classified') {
    setMode(nextMode)
    if (!prepared || !fit) return
    const nextOptions = fitsFor(prepared, fit.seats.length, allowRotation, nextMode)
    setOptions(nextOptions)
    setOptionIndex(0)
    setFit(nextMode === 'classified'
      ? classFits.find((candidate) => candidate.seats.length === fit.seats.length) ?? classFits[0]
      : nextOptions[0])
  }

  const bounds = fit ? boundsFor(fit) : null
  const gridRadius = bounds ? Math.ceil(Math.max(bounds.width, bounds.height) / LATTICE_PITCH_MM) + 2 : 0
  const gridAxis = Array.from(
    { length: gridRadius * 2 + 1 },
    (_, index) => (index - gridRadius) * LATTICE_PITCH_MM,
  )
  const latticeOrigin = fit?.seats[0] ?? fit?.centre ?? [0, 0]
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
              latticeOrigin[0] + localX * cosine - localY * sine,
              latticeOrigin[1] + localX * sine + localY * cosine,
            ]
            if (point[0] < bounds.minX || point[0] > bounds.minX + bounds.width || point[1] < bounds.minY || point[1] > bounds.minY + bounds.height) continue
            points.push({ point, inside: pointInPolygon(point, fit.outline) })
          }
        }
        return points
      })()
    : []
  const navigationFits = mode === 'classified' ? classFits : options
  const navigationIndex = fit
    ? mode === 'classified'
      ? navigationFits.findIndex((candidate) => candidate.seats.length === fit.seats.length)
      : optionIndex
    : -1

  useEffect(() => {
    if (navigationIndex >= 0) tabRefs.current[navigationIndex]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [navigationIndex])

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
                transform={`translate(${latticeOrigin[0]} ${latticeOrigin[1]}) rotate(${fit.rotation * 180 / Math.PI})`}
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
                <circle
                  className={styles.contact}
                  cx={contact.outline[0]}
                  cy={contact.outline[1]}
                  key={`${contact.outline[0]},${contact.outline[1]},${index}`}
                  r={1.35}
                />
              ))}
              <circle className={styles.core} cx={fit.centre[0]} cy={fit.centre[1]} r={1.8} />
              <g className={styles.materialCentre} aria-label="Shape material centre">
                <line x1={fit.materialCentre[0] - 5} y1={fit.materialCentre[1]} x2={fit.materialCentre[0] + 5} y2={fit.materialCentre[1]} />
                <line x1={fit.materialCentre[0]} y1={fit.materialCentre[1] - 5} x2={fit.materialCentre[0]} y2={fit.materialCentre[1] + 5} />
              </g>
            </svg>
          ) : (
            <button className={styles.empty} onClick={() => fileRef.current?.click()}>
              <span>Upload a transparent or high-contrast image</span>
              <small>The outline becomes the rigid, uniformly scaling bag.</small>
            </button>
          )}
        </div>

        <footer className={styles.controls}>
          <input
            ref={fileRef}
            className={styles.hiddenInput}
            type="file"
            accept="image/*,.svg"
            onChange={(event) => void upload(event.target.files?.[0])}
          />
          <button className={styles.iconButton} aria-label="Upload shape" title="Upload shape" onClick={() => fileRef.current?.click()}>
            <UploadSimple aria-hidden size={20} weight="bold" />
          </button>
          <label className={styles.library}>
            <span className={styles.srOnly}>Cutout preset</span>
            <select aria-label="Cutout preset" value={selectedCutout} onChange={(event) => void loadCutout(event.target.value)}>
              <option value="">Presets</option>
              {CUTOUTS.map(([name, path]) => <option key={path} value={path}>{name}</option>)}
            </select>
          </label>
          <button
            className={styles.iconButton}
            aria-label="Remove disk"
            title="Remove disk"
            onClick={remove}
            disabled={!fit || fit.seats.length <= 1}
          >
            <Minus aria-hidden size={20} weight="bold" />
          </button>
          <button
            className={`${styles.iconButton} ${styles.primary}`}
            aria-label="Add disk"
            title="Add disk"
            onClick={add}
            disabled={!fit || fit.seats.length >= MAX_BAG_DISKS}
          >
            <Plus aria-hidden size={20} weight="bold" />
          </button>
        </footer>

        {fit && (
          <nav className={styles.options} aria-label="Lattice arrangement options">
            <div className={styles.modes} aria-label="Layout solver mode">
              <button aria-pressed={mode === 'classified'} onClick={() => selectMode('classified')}>Class</button>
              <button aria-pressed={mode === 'auto'} onClick={() => selectMode('auto')}>Auto</button>
            </div>
            {mode === 'auto' && (
              <button
                className={styles.cycleButton}
                aria-label="Previous layout"
                disabled={navigationFits.length < 2}
                onClick={() => stepOption(-1)}
              >
                <CaretLeft aria-hidden size={18} weight="bold" />
              </button>
            )}
            <div className={styles.optionTabs} aria-live="polite">
              {navigationFits.map((candidate, index) => (
                <button
                  className={styles.layoutTab}
                  key={`${candidate.option}-${index}`}
                  ref={(node) => { tabRefs.current[index] = node }}
                  aria-pressed={index === navigationIndex}
                  onClick={() => mode === 'classified' ? selectClassFit(index) : selectOption(index)}
                >
                  <strong>{mode === 'classified' ? `${candidate.seats.length} disks` : candidate.option}</strong>
                  <span>{bandForSize(candidate.sizeMM)} · {candidate.sizeMM.toFixed(1)} mm</span>
                </button>
              ))}
            </div>
            {mode === 'auto' && (
              <button
                className={styles.cycleButton}
                aria-label="Next layout"
                disabled={navigationFits.length < 2}
                onClick={() => stepOption(1)}
              >
                <CaretRight aria-hidden size={18} weight="bold" />
              </button>
            )}
            <button
              className={styles.rotationToggle}
              aria-label={`Rotation ${allowRotation ? 'on' : 'off'}`}
              aria-pressed={allowRotation}
              onClick={toggleRotation}
              disabled={isFittingRotation}
            >
              <ArrowClockwise aria-hidden size={16} weight="bold" />
              <span>{allowRotation ? 'On' : 'Off'}</span>
            </button>
          </nav>
        )}
        <div className={styles.status} aria-live="polite">
          {error || (fit ? `${fileName} · ${fit.sizeMM.toFixed(1)} mm outline · tangent at ${fit.contacts.length} edge point${fit.contacts.length === 1 ? '' : 's'}` : 'No shape loaded')}
        </div>
      </section>
    </main>
  )
}
