'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowClockwise, CaretLeft, CaretRight, Minus, Plus, UploadSimple } from '@phosphor-icons/react'
import type { Pt } from '@/lib/effect/types'
import {
  BAG_BANDS,
  DISK_DIAMETER_MM,
  bagBandLabel,
  buildBagView,
  fitBagMode,
  fitClassifiedLadder,
  LATTICE_PITCH_MM,
  MAX_BAG_DISKS,
  type BagBandResult,
  type BagFit,
  type BagMode,
  type PreparedBag,
  prepareBag,
} from '@/lib/lattice-bag'
import { outlineFromFile, outlineFromPath } from '@/lib/lattice-bag-image'
import styles from './lattice-bag.module.css'

const DEFAULT_CUTOUT_PATH = '/lattice-bag/cutouts/bot.png'
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

function pathFrom(points: ReadonlyArray<Pt>) {
  return `M ${points.map(([x, y]) => `${x.toFixed(3)} ${y.toFixed(3)}`).join(' L ')} Z`
}

export function LatticeBagPrototype() {
  const fileRef = useRef<HTMLInputElement>(null)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const bandWorkerRef = useRef<Worker | null>(null)
  const bandRequestRef = useRef(0)
  const [prepared, setPrepared] = useState<PreparedBag | null>(null)
  const [fit, setFit] = useState<BagFit | null>(null)
  const [options, setOptions] = useState<BagFit[]>([])
  const [classFits, setClassFits] = useState<BagFit[]>([])
  const [bandResults, setBandResults] = useState<BagBandResult[]>([])
  const [optionIndex, setOptionIndex] = useState(0)
  const [allowRotation, setAllowRotation] = useState(false)
  const [isFittingRotation, setIsFittingRotation] = useState(false)
  const [mode, setMode] = useState<BagMode>('classified')
  const [selectedCutout, setSelectedCutout] = useState(DEFAULT_CUTOUT_PATH)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [bandCompute, setBandCompute] = useState<{ completed: number; total: number; startedAt: number } | null>(null)
  const [bandElapsedMs, setBandElapsedMs] = useState(0)
  const [lastBandDurationMs, setLastBandDurationMs] = useState<number | null>(null)

  function stopBandCompute() {
    bandWorkerRef.current?.terminate()
    bandWorkerRef.current = null
    bandRequestRef.current += 1
    setBandCompute(null)
  }

  function computeBands(nextPrepared: PreparedBag, rotation: boolean) {
    stopBandCompute()
    setError('')
    const id = bandRequestRef.current
    const worker = new Worker(new URL('../../../../lib/lattice-bag.worker.ts', import.meta.url), { type: 'module' })
    bandWorkerRef.current = worker
    const startedAt = performance.now()
    setBandResults([])
    setBandElapsedMs(0)
    setLastBandDurationMs(null)
    setBandCompute({ completed: 0, total: BAG_BANDS.length, startedAt })
    worker.onmessage = (event: MessageEvent<
      | { id: number; type: 'progress'; completed: number; total: number; elapsedMs: number }
      | { id: number; type: 'complete'; result: BagBandResult[]; elapsedMs: number }
      | { id: number; type: 'error'; error: string }
    >) => {
      if (event.data.id !== id || worker !== bandWorkerRef.current) return
      if (event.data.type === 'progress') {
        setBandCompute({ completed: event.data.completed, total: event.data.total, startedAt })
        setBandElapsedMs(event.data.elapsedMs)
        return
      }
      worker.terminate()
      bandWorkerRef.current = null
      setBandCompute(null)
      if (event.data.type === 'error') {
        setError(event.data.error)
        return
      }
      setLastBandDurationMs(event.data.elapsedMs)
      setBandElapsedMs(event.data.elapsedMs)
      setBandResults(event.data.result)
      setFit(event.data.result.find((band) => band.candidates.length > 0)?.candidates[0] ?? null)
    }
    worker.onerror = () => {
      if (worker !== bandWorkerRef.current) return
      worker.terminate()
      bandWorkerRef.current = null
      setBandCompute(null)
      setError('The band solver could not finish')
    }
    worker.postMessage({ id, prepared: nextPrepared, allowRotation: rotation })
  }

  function fitsFor(
    nextPrepared: PreparedBag,
    count: number,
    rotation = allowRotation,
    nextMode: Exclude<BagMode, 'bands'> = mode === 'auto' ? 'auto' : 'classified',
  ) {
    return fitBagMode(nextPrepared, count, nextMode, rotation)
  }

  function showOutline(nextOutline: Pt[], name: string) {
    const nextPrepared = prepareBag(nextOutline)
    setPrepared(nextPrepared)
    const nextClassFits = fitClassifiedLadder(nextPrepared, allowRotation)
    const nextOptions = fitsFor(nextPrepared, nextClassFits[0].seats.length)
    setClassFits(nextClassFits)
    setOptions(nextOptions)
    setBandResults([])
    setOptionIndex(0)
    setFit(mode === 'classified'
      ? nextClassFits[0]
      : nextOptions[0])
    setFileName(name)
    if (mode === 'bands') computeBands(nextPrepared, allowRotation)
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
      showOutline(await outlineFromPath(path), cutout?.[0] ?? path)
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
    if (!prepared || mode === 'bands') return
    const nextOptions = fitsFor(prepared, count)
    if (nextOptions.length === 0) {
      setError(`No centred full-wrap layout exists for ${count} disks`)
      return
    }
    setError('')
    setOptions(nextOptions)
    setOptionIndex(0)
    setFit(nextOptions[0])
  }

  function selectClassFit(index: number) {
    if (!prepared) return
    const nextFit = fitBagMode(prepared, classFits[index].seats.length, 'classified', allowRotation)[0]
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
        const nextFit = fitBagMode(prepared, fit.seats.length, 'classified', nextRotation)[0]
        setClassFits((current) => current.map((candidate) => candidate.seats.length === nextFit.seats.length ? nextFit : candidate))
        setFit(nextFit)
      } else if (mode === 'auto') {
        const nextOptions = fitBagMode(prepared, fit.seats.length, 'auto', nextRotation)
        setOptions(nextOptions)
        setFit(nextOptions[0])
      } else {
        computeBands(prepared, nextRotation)
      }
      setIsFittingRotation(false)
    }))
  }

  function selectMode(nextMode: BagMode) {
    setMode(nextMode)
    if (!prepared || !fit) return
    if (nextMode === 'bands') {
      setOptionIndex(0)
      computeBands(prepared, allowRotation)
      return
    }
    stopBandCompute()
    const nextOptions = fitsFor(prepared, fit.seats.length, allowRotation, nextMode)
    setOptions(nextOptions)
    setOptionIndex(0)
    setFit(nextMode === 'classified'
      ? classFits.find((candidate) => candidate.seats.length === fit.seats.length) ?? classFits[0]
      : nextOptions[0])
  }

  const view = fit ? buildBagView(fit) : null
  const bounds = view?.bounds ?? null
  const gridRadius = view?.gridRadius ?? 0
  const gridAxis = view?.gridAxis ?? []
  const latticeOrigin = view?.latticeOrigin ?? [0, 0]
  const ghostSeats = view?.ghostSeats ?? []
  const bandEntries = bandResults.flatMap((band) => (
    band.candidates.map((candidate) => ({ band, candidate }))
  ))
  const navigationFits = mode === 'classified'
    ? classFits
    : mode === 'bands'
      ? bandEntries.map(({ candidate }) => candidate)
      : options
  const navigationIndex = fit
    ? mode === 'classified'
      ? navigationFits.findIndex((candidate) => candidate.seats.length === fit.seats.length)
      : mode === 'bands'
        ? navigationFits.indexOf(fit)
        : optionIndex
    : -1

  useEffect(() => {
    let active = true
    void outlineFromPath(DEFAULT_CUTOUT_PATH).then((outline) => {
      if (!active) return
      const nextPrepared = prepareBag(outline)
      const nextClassFits = fitClassifiedLadder(nextPrepared, false)
      const nextOptions = fitBagMode(nextPrepared, nextClassFits[0].seats.length, 'classified', false)
      setPrepared(nextPrepared)
      setClassFits(nextClassFits)
      setBandResults([])
      setOptions(nextOptions)
      setOptionIndex(0)
      setFit(nextClassFits[0])
      setFileName('Bot')
    }).catch((caught: unknown) => {
      if (active) setError(caught instanceof Error ? caught.message : 'The default cutout could not be loaded')
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!bandCompute) return
    const timer = window.setInterval(() => setBandElapsedMs(performance.now() - bandCompute.startedAt), 100)
    return () => window.clearInterval(timer)
  }, [bandCompute])

  useEffect(() => () => bandWorkerRef.current?.terminate(), [])

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
            <p>The rigid {LATTICE_PITCH_MM} mm lattice settles inside the uploaded shape while its outline scales without deforming.</p>
          </div>
          {fit && <div className={styles.count}><strong>{fit.seats.length}</strong><span>disks</span></div>}
        </header>

        <div className={styles.stage}>
          {bandCompute && (
            <div className={styles.computing} role="status" aria-live="polite">
              <span className={styles.spinner} aria-hidden />
              <strong>Computing wrap fits</strong>
              <span>Searching {bandCompute.completed} of {bandCompute.total} layouts · {(bandElapsedMs / 1000).toFixed(1)} s</span>
            </div>
          )}
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
              <g className={styles.holds}>
                {fit.seats.map(([x, y], index) => (
                  <circle cx={x} cy={y} key={`hold-${index}`} r={fit.holdRadiusMM} />
                ))}
              </g>
              <g className={styles.flaps} fillRule="evenodd">
                {fit.flaps.map((flap, index) => (
                  <g key={`flap-${index}`}>
                    <path d={[flap.outline, ...flap.holes].map(pathFrom).join(' ')} />
                    <circle cx={flap.centroid[0]} cy={flap.centroid[1]} r={1.5} />
                  </g>
                ))}
              </g>
              <g className={styles.unprotectedSeats}>
                {fit.unprotectedSeatCentres.map(([x, y], index) => (
                  <circle cx={x} cy={y} key={`unprotected-${index}`} r={2} />
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
            disabled={!fit || mode === 'bands' || fit.seats.length <= 1}
          >
            <Minus aria-hidden size={20} weight="bold" />
          </button>
          <button
            className={`${styles.iconButton} ${styles.primary}`}
            aria-label="Add disk"
            title="Add disk"
            onClick={add}
            disabled={!fit || mode === 'bands' || fit.seats.length >= MAX_BAG_DISKS}
          >
            <Plus aria-hidden size={20} weight="bold" />
          </button>
        </footer>

        {fit && (
          <nav className={styles.options} aria-label="Lattice arrangement options">
            <div className={styles.modes} aria-label="Layout solver mode">
              <button aria-pressed={mode === 'classified'} onClick={() => selectMode('classified')}>Class</button>
              <button aria-pressed={mode === 'auto'} onClick={() => selectMode('auto')}>Auto</button>
              <button aria-pressed={mode === 'bands'} onClick={() => selectMode('bands')}>Bands</button>
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
              {(mode === 'bands' ? bandEntries : navigationFits).map((entry, index) => {
                const candidate = mode === 'bands' ? bandEntries[index].candidate : entry as BagFit
                const band = mode === 'bands' ? bandEntries[index].band : null
                return (
                <button
                  className={styles.layoutTab}
                  key={band ? `${band.id}-${candidate.seats.length}-${candidate.option}-${index}` : `${candidate.option}-${index}`}
                  ref={(node) => { tabRefs.current[index] = node }}
                  aria-pressed={candidate === fit}
                  disabled={!candidate}
                  onClick={() => {
                    if (!candidate) return
                    if (mode === 'classified') selectClassFit(index)
                    else if (mode === 'bands') setFit(candidate)
                    else selectOption(index)
                  }}
                >
                  <strong>{band
                    ? `${band.id} · ${candidate.seats.length} · ${candidate.option}`
                    : mode === 'classified' ? `${candidate.seats.length} disks` : candidate.option}</strong>
                  <span>{`${bagBandLabel(candidate.sizeMM)} · ${candidate.sizeMM.toFixed(1)} mm`}</span>
                </button>
                )
              })}
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
              disabled={isFittingRotation || Boolean(bandCompute)}
            >
              <ArrowClockwise aria-hidden size={16} weight="bold" />
              <span>{allowRotation ? 'On' : 'Off'}</span>
            </button>
          </nav>
        )}
        <div className={styles.status} aria-live="polite">
          {error || (bandCompute
            ? `Searching ${bandCompute.completed} of ${bandCompute.total} layouts · ${(bandElapsedMs / 1000).toFixed(1)} s`
            : fit
              ? `${fileName} · ${fit.sizeMM.toFixed(1)} mm outline · snug wrap · ${fit.opposingContactPairs} opposing contact pair${fit.opposingContactPairs === 1 ? '' : 's'} · ${fit.flaps.length} unheld region${fit.flaps.length === 1 ? '' : 's'} / ${fit.unheldAreaMM2.toFixed(1)} mm²${lastBandDurationMs === null ? '' : ` · bands computed in ${(lastBandDurationMs / 1000).toFixed(1)} s`}`
              : 'No shape loaded')}
        </div>
      </section>
    </main>
  )
}
