'use client'

// grid-magnet — the v3.5 magnetic-grid bench (2D vector).
// ALL engine shape sources through contourFromShape → computeGrid, rendered true-to-scale:
//   • Presets    — shape-library getShape() (baked vector data)
//   • Generators — generateShapeRing() (blob / clover / daisy / pinwheel)
//   • AI Magic   — image upload → prepareShaped() → u2netp lightweight cut-out → outline

import { useEffect, useMemo, useRef, useState } from 'react'
import LibraryPanel from './LibraryPanel'
import { libraryStageModel, draftStageModel, nodeAtMM, canonicalNode, type LibrarySelection } from '@/lib/effect/grid-magnet-library-bridge'
import { CLASS_FRAMES, LIBRARY_FAMILIES, LIBRARY_SHAPES, pickLayout, resolveSelection, draftLayoutId, draftNameOf, draftIntegrity, layoutAtPitch, frameKeyOf, draftId, DRAFT_STORE_KEY, type LibraryDraft } from '@/lib/effect/library'
import { getShape, hasVectorDef, type VectorShapeKind } from '@/lib/shape-library'
import { type VShape } from '@/lib/vector-core'
import { generateShapeRing, type ShapeKind } from '../v5.3.1/user/shapes'
import { loadImage, prepareShaped } from '../v5.3.1/core/primitives'
import type { Contour, Pt } from '@/lib/effect/types'
import { DEFAULT_PITCH_MM, type BandSnapPoint, type GridResult, type MagnetPlan, type SafeSegment } from '@/lib/effect/grid-magnet'
import { BANDS, CENTRE_MODE, GOVERNOR, MASS_DEPTH_CEIL_MM, MASS_DEPTH_FLOOR_MM, MASS_DEPTH_MM, MIN_EFFECT_MM, PADDING_CEIL_MM, PADDING_FLOOR_MM, PHASE_STEP_FLOOR_MM, PHASE_STEP_MM, RELEASED_PADDING_MM, RELEASED_PITCHES_MM, SNAP_STEP_MM } from '@/lib/effect/grid-magnet-spec'
import { fieldSpots, normBaseContour, normGeneratedRing, normMaskContour, seatedSpots, sizeRange, type FieldSpot } from '@/lib/effect/grid-magnet-bridge'

/** Bench test libraries — static assets, listed by a committed manifest. */
const LIB_MANIFEST = '/grid-engine/library.json'

/** THE CAMERA — one contract for both boards (Dan, 08-25: the library zoom must not be the
 *  narrower one). 100% sits the subject at half the board; the range is the union of what the
 *  two boards carried separately, so neither lost reach. Steps are 5%. */
const CAM_BASE = 0.5
const CAM_MIN = 0.2, CAM_MAX = 12
const camClamp = (z: number) => Math.min(CAM_MAX, Math.max(CAM_MIN, +z.toFixed(2)))
const camStep = (z: number, dir: 1 | -1) => camClamp(z + dir * 0.05)
const LIB_RAW = '/grid-engine/asset-lib/'
const LIB_CUT = '/grid-engine/cutouts/'

const IMG = 1024
/** Stage pixel size — element, px/mm scale and header label all derive from it. */
const VP = 640
const FIT = 0.86

const PRESETS: VectorShapeKind[] = ['squircle', 'square', 'circle', 'pill', 'heart', 'star', 'polygon', 'diamond', 'plus', 'teardrop', 'leaf', 'lens', 'bolt', 'sparkle', 'pinched', 'asterisk', 'bowtie']
const GENS: { k: ShapeKind; label: string; p1: [string, string]; p2: [string, string]; p2min: number; p2max: number; p2start: number }[] = [
  { k: 'blob', label: 'Blob', p1: ['Waviness', '%'], p2: ['Seed', ''], p2min: 1, p2max: 40, p2start: 7 },
  { k: 'form', label: 'Clover', p1: ['Pinch', '%'], p2: ['Lobes', ''], p2min: 1, p2max: 8, p2start: 4 },
  { k: 'daisy', label: 'Daisy', p1: ['Depth', '%'], p2: ['Petals', ''], p2min: 5, p2max: 12, p2start: 8 },
  { k: 'pinwheel', label: 'Pinwheel', p1: ['Swirl', '%'], p2: ['Blades', ''], p2min: 3, p2max: 8, p2start: 5 },
]

type Src = 'preset' | 'gen' | 'magic' | 'cut'
type MagicState = { vshape: VShape; maskH: number; adapter: string; imgUrl: string } | null

/** Admin dial that survives reloads — browser-stored, initialized from the spec default. */
function usePersisted(key: string, initial: number): [number, (n: number) => void] {
  const [v, setV] = useState(initial)
  useEffect(() => {
    const raw = localStorage.getItem('grid-centre.' + key)
    if (raw !== null && Number.isFinite(+raw)) setV(+raw)
  }, [key])
  const set = (n: number) => { setV(n); try { localStorage.setItem('grid-centre.' + key, String(n)) } catch { } }
  return [v, set]
}

export default function GridLab() {
  const [src, setSrc] = useState<Src>('preset')
  const [preset, setPreset] = useState<VectorShapeKind>('squircle')
  const [gen, setGen] = useState<ShapeKind>('blob')
  const [p1, setP1] = useState(55) // waviness / pinch / depth / swirl
  const [p2, setP2] = useState(7)  // seed / lobes / petals / blades
  const [sides, setSides] = useState(6)
  const [points, setPoints] = useState(5)
  // Opens on the B2 floor — the 72mm square standard (2×2), from spec.
  /** Free-slider limits — typed, persisted across reloads. */
  const [pitch, setPitch] = useState(DEFAULT_PITCH_MM)
  const [pad, setPad] = usePersisted('pad', RELEASED_PADDING_MM)
  const [padLock, setPadLock] = usePersisted('padLock', 1)
  /** Placement step dial — how finely the lattice slides under the shape; 1 = continuous panning. */
  const [phaseStep, setPhaseStep] = usePersisted('phaseStep', PHASE_STEP_MM)
  /** Mass depth dial — clearance a region must survive to count as a mass for centring. */
  const [massDepth, setMassDepth] = usePersisted('massDepth', MASS_DEPTH_MM)
  /** Centre-mode switch — which centre drives anchoring and balance. */
  /** Engine mode — 1 wrap ladder (band offers) · 2 free + snap (continuous). */
  const [centreMode, setCentreMode] = usePersisted('centreMode', CENTRE_MODE)
  /** Positioning law — voting vs centre-rules (parity-locked, no voting). */
  /** Governor — which mass rules in Masses mode. */
  const [governor, setGovernor] = usePersisted('governor', GOVERNOR)
  /** Voting dominance order — which force rules the placement vote. */
  const [plan, setPlan] = useState<MagnetPlan>('all6')
  /** Off: seated spots only. On: every position the shape was judged against. */
  const [showLattice, setShowLattice] = useState(true)
  /** Faint bounding box with per-side dimensions. */
  const [showBox, setShowBox] = useState(true)
  /** Legal-area islands, coloured + boxed + centre-marked. */
  const [showSegs, setShowSegs] = useState(true)
  /** Coloured fills of the inner (legal) area — off leaves outlines only. */
  const [segFillN, setSegFillN] = usePersisted('segFill', 1)
  /** A band id snaps to that band's fit ladder; 'free' is the continuous slider. */
  const [mode, setMode] = useState<number>(1)
  /** Top-level view — the bench, or the layout-library review tab. */
  const [tab, setTab] = useState<'bench' | 'library'>('bench')
  /** Library authoring selection — the bridge turns it into the ONE canvas's model. */
  const [librarySel, setLibrarySel] = useState<LibrarySelection>({ shapeId: 'square', frameKey: '3x3', layoutId: 'perimeter', view: { transpose: false, flipX: false, flipY: false } })
  /** Authoring — browser-local; the canonical corpus is never mutated. */
  const [edit, setEdit] = useState<{ name: string; nodes: Array<[number, number]> } | null>(null)
  /** Library canvas view — pan in mm, camera zoom. Same camera contract as the bench:
   *  100% sits the subject at half the board, and both boards share one range. */
  const [libView, setLibView] = useState<{ panMM: Pt; zoom: number }>({ panMM: [0, 0], zoom: 1 })
  /** BENCH CAMERA — a view-level zoom over the finished render. The solve, the gestures and
   *  every readout are untouched; only what the eye sees is scaled. */
  const [camZoom, setCamZoom] = useState(1)
  const [drafts, setDrafts] = useState<LibraryDraft[]>([])
  useEffect(() => {
    try { const raw = localStorage.getItem(DRAFT_STORE_KEY); if (raw) setDrafts(JSON.parse(raw)) } catch { }
  }, [])
  const writeDrafts = (next: LibraryDraft[]) => {
    setDrafts(next)
    try { localStorage.setItem(DRAFT_STORE_KEY, JSON.stringify(next)) } catch { }
  }
  const libraryModel = useMemo(() => {
    if (tab !== 'library') return null
    const { frame, safeSel, draft } = resolveSelection(librarySel, drafts)
    const nodes = edit ? edit.nodes : draft?.nodes
    return nodes
      ? draftStageModel(safeSel, nodes, pitch, pad, frame.cols, frame.rows, '')
      : libraryStageModel(safeSel, pitch, pad)
  }, [tab, librarySel, pitch, pad, edit, drafts])
  /** Selected step on the band's ladder; null = the band's own pick (smallest size at max count). */
  const [stepSel, setStepSel] = useState<number | null>(null)
  /** Manual scale inside the band's range; null = the ladder rules. */
  const [bandScale, setBandScale] = useState<number | null>(null)
  /** Snap scan step — admin-tunable for testing; default from spec. */
  const [snapStep, setSnapStep] = usePersisted('snapStep', SNAP_STEP_MM)
  /** Manual grid calibration — a forced registration (mm), or null for the engine's auto pick. */
  const [manual, setManual] = useState<{ x: number; y: number } | null>(null)
  const [coverage, setCoverage] = useState<'full' | 'perimeter'>('perimeter')
  /** Per-control enables — off sends that control's field not at all, so spec default rules it. */
  const [enPhaseN, setEnPhaseN] = usePersisted('en.phaseStep', 1)

  // On load the bench opens on B1 or the last band you pushed (Dan, 08-25). usePersisted loads
  // in a post-mount effect, so read storage directly for the one decision that must be right on
  // first paint.
  useEffect(() => {
    try {
      const bs = +(localStorage.getItem('grid-centre.band') ?? '1') || 1
      const b = BANDS.find((x) => x.id === bs) ?? BANDS[0]
      setMode(b.id)
    } catch { }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Baseline handling: "save" stamps the current dials as the working default; "reset" restores
   *  the saved baseline, or spec defaults when none was saved. */
  const saveDefaults = () => {
    try { localStorage.setItem('grid-centre.defaults', JSON.stringify({ pad, phaseStep, massDepth, centreMode, governor, snapStep })) } catch { }
  }
  const resetDefaults = () => {
    let d = {
      pad: RELEASED_PADDING_MM, phaseStep: PHASE_STEP_MM, massDepth: MASS_DEPTH_MM, centreMode: CENTRE_MODE, governor: GOVERNOR, snapStep: SNAP_STEP_MM,
    }
    try { const raw = localStorage.getItem('grid-centre.defaults'); if (raw) d = { ...d, ...JSON.parse(raw) } } catch { }
    setPad(d.pad); setPadLock(1); setPhaseStep(d.phaseStep); setMassDepth(d.massDepth); setCentreMode(d.centreMode); setGovernor(d.governor); setSnapStep(d.snapStep)
  }

  const [magic, setMagic] = useState<MagicState>(null)
  const [magStatus, setMagStatus] = useState<string>('')   // '', 'downloading-model', 'cutting', 'error:...'
  const fileRef = useRef<HTMLInputElement>(null)

  /** Perf dash — screen instrumentation only: page load, shape generation, AI cut, solve. */
  const [perf, setPerf] = useState<{ loadMs?: number; genMs?: number; cutMs?: number; solveMs?: number }>({})
  const genMsRef = useRef<number | undefined>(undefined)
  const solveSentAt = useRef(0)
  useEffect(() => {
    const report = () => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
      if (nav?.duration) setPerf((x) => ({ ...x, loadMs: nav.duration }))
    }
    if (document.readyState === 'complete') report()
    else { window.addEventListener('load', report, { once: true }); return () => window.removeEventListener('load', report) }
  }, [])

  function cutFile(f: File) {
    const loaded = loadImage(f, magic?.imgUrl)
    if (!loaded) { setMagStatus('error:that file is not an image'); return }
    setSrc('magic'); setMagStatus('cutting')
    const t0 = performance.now()
    prepareShaped(loaded.url, undefined, (s) => setMagStatus(s === 'fallback' ? 'cutting (simple fallback)' : s))
      .then((p) => {
        setPerf((x) => ({ ...x, cutMs: performance.now() - t0 }))
        setMagic({ vshape: p.spec.vectorShape, maskH: p.spec.maskHeightPx, adapter: p.spec.generator?.adapter ?? 'cut', imgUrl: loaded.url })
        setMagStatus('')
      })
      .catch((err) => { console.error('[grid-lab] magic failed', err); setMagStatus('error:' + ((err as Error)?.message ?? 'cut failed')) })
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (f) cutFile(f)
  }

  /** Test libraries — raw images (go through the AI cut) and finished cutouts (traced directly). */
  const [libRaw, setLibRaw] = useState<string[]>([])
  const [libCut, setLibCut] = useState<string[]>([])
  const [libSel, setLibSel] = useState('')
  const [cutSel, setCutSel] = useState('')
  const [cutC, setCutC] = useState<Contour | null>(null)
  const [cutStatus, setCutStatus] = useState('')
  useEffect(() => {
    // The bench libraries are static files under public/grid-engine, listed by a committed
    // manifest — no server route, so they work identically on localhost and a deployment.
    fetch(LIB_MANIFEST).then((r) => r.json()).then((m) => {
      if (Array.isArray(m?.raw)) setLibRaw(m.raw)
      if (Array.isArray(m?.cut)) setLibCut(m.cut)
    }).catch(() => { })
  }, [])
  async function loadLib(name: string) {
    setSrc('magic'); setMagStatus('cutting')
    try {
      const res = await fetch(LIB_RAW + encodeURIComponent(name))
      if (!res.ok) throw new Error('not found')
      const blob = await res.blob()
      cutFile(new File([blob], name, { type: blob.type || 'image/png' }))
    } catch { setMagStatus('error:could not load the library image') }
  }
  /** Cutout path: no AI — decode (browser IO), hand the alpha mask to the bridge to trace. */
  async function loadCut(name: string) {
    setSrc('cut'); setCutStatus('tracing')
    const t0 = performance.now()
    try {
      const res = await fetch(LIB_CUT + encodeURIComponent(name))
      if (!res.ok) throw new Error('not found')
      const bmp = await createImageBitmap(await res.blob())
      const cnv = document.createElement('canvas')
      cnv.width = bmp.width; cnv.height = bmp.height
      const ctx = cnv.getContext('2d', { willReadFrequently: true })
      if (!ctx) throw new Error('no canvas')
      ctx.drawImage(bmp, 0, 0)
      bmp.close()
      const data = ctx.getImageData(0, 0, cnv.width, cnv.height).data
      const mask = new Uint8Array(cnv.width * cnv.height)
      for (let i = 0; i < mask.length; i++) if (data[i * 4 + 3] > 128) mask[i] = 1
      const c = normMaskContour(mask, cnv.width, cnv.height)
      genMsRef.current = performance.now() - t0
      if (!c) throw new Error('no outline in this image')
      setCutC(c); setCutStatus('')
    } catch (err) { setCutC(null); setCutStatus('error:' + ((err as Error)?.message ?? 'trace failed')) }
  }

  // base contour normalized so longest side = 1mm (scale-free) — cheap, main thread.
  const base = useMemo<Contour | null>(() => {
    const t0 = performance.now()
    try {
      if (src === 'cut') return cutC
      if (src === 'magic') {
        if (!magic) return null
        return normBaseContour(magic.vshape, magic.maskH)
      }
      if (src === 'preset' && hasVectorDef(preset)) {
        return normBaseContour(getShape(preset, IMG, IMG, { sides, points }), IMG)
      }
      const params = gen === 'blob' ? { kind: gen, waviness: p1, seed: p2 }
        : gen === 'form' ? { kind: gen, pinch: p1, lobes: p2 }
          : gen === 'daisy' ? { kind: gen, depth: p1, petals: p2 }
            : { kind: gen, swirl: p1, blades: p2 }
      const ring = generateShapeRing(params as Parameters<typeof generateShapeRing>[0], IMG, IMG)
      return normGeneratedRing(ring, IMG)
    } catch (e) { console.error('[grid-lab] shape build failed', e); return null }
    finally { genMsRef.current = performance.now() - t0 }
  }, [src, preset, gen, p1, p2, sides, points, magic, cutC])

  // The solve runs in a worker so the page never freezes; the last result stays up while solving.
  type Model = { contour: Contour; grid: GridResult; effSize: number; ladder: BandSnapPoint[]; idx: number; segments: SafeSegment[]; stops?: Array<{ press: number; reveal: number }>; offMM?: number; recog?: { family: string; cols: number; rows: number; segWmm: number; segHmm: number } }
  const [model, setModel] = useState<Model | null>(null)
  const [solving, setSolving] = useState(false)
  // The overlay earns its place only on a REAL wait: it appears after a grace period, so the
  // fast solves that follow every slider step never blink it.
  const [showSolving, setShowSolving] = useState(false)
  useEffect(() => {
    if (!solving) { setShowSolving(false); return }
    const t = setTimeout(() => setShowSolving(true), 250)
    return () => clearTimeout(t)
  }, [solving])
  const workerRef = useRef<Worker | null>(null)
  const seqRef = useRef(0)
  /** Newest-only dispatch: one solve in flight, at most one (the latest) queued — a burst of
   *  control changes never builds a backlog the worker has to grind through. */
  const busyRef = useRef(false)
  const queuedRef = useRef<object | null>(null)
  const effSizeRef = useRef(0)
  useEffect(() => {
    const w = new Worker(new URL('./solve.worker.ts', import.meta.url))
    workerRef.current = w
    w.onmessage = (e) => {
      if (queuedRef.current) {
        const next = queuedRef.current
        queuedRef.current = null
        solveSentAt.current = performance.now()
        w.postMessage(next)
      } else {
        busyRef.current = false
        setSolving(false)
      }
      if (e.data.id !== seqRef.current) return
      if (e.data.error) console.error('[grid-lab] solve failed', e.data.error)
      setPerf((x) => ({ ...x, solveMs: performance.now() - solveSentAt.current, genMs: genMsRef.current }))
      if (e.data.model) effSizeRef.current = e.data.model.effSize
      setModel(e.data.model)
    }
    return () => { workerRef.current = null; w.terminate() }
  }, [])
  useEffect(() => {
    const w = workerRef.current
    if (!w) return
    if (!base || base.outer.pts.length < 3) { setModel(null); return }
    const cfg = { pitchMM: pitch, paddingMM: pad, ...(enPhaseN ? { phaseStepMM: phaseStep } : {}), massDepthMM: massDepth, centreMode, positioning: 1, governor, forcePhaseMM: manual ? [manual.x, manual.y] as Pt : undefined, plan, perimeterOnly: coverage === 'perimeter', circle: src === 'preset' && preset === 'circle' }
    // Manual in a band (forced registration OR manual band scale): the walk is meaningless —
    // solve that size directly, exactly like free mode, band chip stays active.
    const manualBand = manual !== null || bandScale !== null   // manual scale/pan: solved directly at the requested size
    const id = ++seqRef.current
    const msg = {
      id, base, offsetMM: 0, cfg,
      mode,
      manualBand,
      sizeMM: manualBand ? (bandScale ?? effSizeRef.current ?? BANDS[0].minMM) : 0,
      snapStep, stepSel,
    }
    if (busyRef.current) { queuedRef.current = msg; setSolving(true); return }
    busyRef.current = true
    setSolving(true)
    solveSentAt.current = performance.now()
    w.postMessage(msg)
  }, [base, src, preset, pitch, pad, phaseStep, massDepth, centreMode, governor, manual, bandScale, enPhaseN, plan, mode, stepSel, snapStep, coverage])

  const scale = model ? (VP * FIT) / Math.max(dim(model.contour, 0), dim(model.contour, 1)) : 0
  const genDef = GENS.find((g) => g.k === gen) ?? GENS[0]

  return (
    <div className="gl">
      <style>{CSS}</style>
      {tab === 'library' && (
        <div className="gl-libbar">
          <div className="gl-seg gl-libbar-mode">
            <button aria-pressed={false} onClick={() => setTab('bench')}>Bench</button>
            <button aria-pressed onClick={() => setTab('library')}>Library</button>
          </div>
          <div className="gl-seg gl-libbar-tabs">
            {LIBRARY_FAMILIES.map((fam) => {
              const cur = resolveSelection(librarySel, drafts).shape.family
              return <button key={fam} aria-pressed={cur === fam} onClick={() => {
                const first = LIBRARY_SHAPES.find((x) => x.family === fam)!
                const f0 = CLASS_FRAMES[fam][0]
                setEdit(null)
                setLibrarySel({ ...librarySel, shapeId: first.id, frameKey: frameKeyOf(f0), layoutId: pickLayout(f0, 'perimeter') })
              }}>{fam}</button>
            })}
          </div>
        </div>
      )}
      {tab === 'library' ? null : (
        <div className="gl-libbar">
          <div className="gl-seg gl-libbar-mode">
            <button aria-pressed onClick={() => setTab('bench')}>Bench</button>
            <button aria-pressed={false} onClick={() => setTab('library')}>Library</button>
          </div>
          <div className="gl-seg gl-libbar-tabs">
            <button aria-pressed={src === 'preset'} onClick={() => setSrc('preset')}>Presets</button>
            <button aria-pressed={src === 'gen'} onClick={() => setSrc('gen')}>Generators</button>
            <button aria-pressed={src === 'magic'} onClick={() => setSrc('magic')}>AI Magic</button>
            <button aria-pressed={src === 'cut'} onClick={() => setSrc('cut')}>Cutouts</button>
          </div>
        </div>
      )}

      <div className={tab === 'library' ? 'gl-body gl-libtab' : 'gl-body gl-benchtab'}>
        <section className="gl-card gl-stage">
          <div className="gl-stage-head">
            <span className="gl-eye gl-perf" style={tab === 'library' ? { display: 'none' } : undefined}>
              load <Sec ms={perf.loadMs} />
              {' · '}gen <Sec ms={perf.genMs} />
              {perf.cutMs != null ? <> · cut <Sec ms={perf.cutMs} /></> : null}
              {' · '}solve <Sec ms={perf.solveMs} />
            </span>
            <span className="gl-eye">{libraryModel ? '' : model ? `1mm = ${scale.toFixed(2)} px` : '—'}</span>
          </div>
          <div className="gl-vp">
            {showSolving && <div className="gl-solving"><span className="gl-spin" />solving…</div>}
            {(() => {
              const src2 = libraryModel ?? model
              if (!src2) return null
              const stageProps = libraryModel
                ? { contour: libraryModel.contour, grid: libraryModel.grid, lattice: showLattice, box: showBox,
                    segments: [], segFill: false,
                    viewport: { panMM: libView.panMM, zoom: libView.zoom * CAM_BASE, wheelZoom: true },
                    onPan: (dx: number, dy: number) => setLibView((v) => ({ ...v, panMM: [v.panMM[0] - dx, v.panMM[1] - dy] })),
                    onZoom: (f: number) => setLibView((v) => ({ ...v, zoom: camClamp(v.zoom * f) })),
                    onReset: () => setLibView({ panMM: [0, 0], zoom: 1 }),
                    onPickNode: edit ? (pMM: Pt) => {
                      const { frame } = resolveSelection(librarySel, drafts)
                      const cols = librarySel.view.transpose ? frame.rows : frame.cols
                      const rows = librarySel.view.transpose ? frame.cols : frame.rows
                      const view = nodeAtMM(pMM, pitch, cols, rows)
                      if (!view) return
                      // The click lands in view space; drafts are canonical (QA F2).
                      const n = canonicalNode(frame, librarySel.view, view)
                      setEdit((d) => {
                        if (!d) return d
                        const k = n[0] + ',' + n[1]
                        const has = d.nodes.some(([x, y]) => x + ',' + y === k)
                        return { ...d, nodes: has ? d.nodes.filter(([x, y]) => x + ',' + y !== k) : [...d.nodes, n] }
                      })
                    } : undefined }
                : { contour: model!.contour, grid: model!.grid, lattice: showLattice, box: showBox,
                    // 100% = the shape at half the board, so there is room around it (Dan).
                    viewport: { panMM: [0, 0] as Pt, zoom: camZoom * CAM_BASE },
                    segments: showSegs ? model!.segments : [], segFill: segFillN !== 0,
                    onPan: (dx: number, dy: number) => setManual((m) => { const bx = m ? m.x : model!.grid.phaseMM[0], by = m ? m.y : model!.grid.phaseMM[1]; return { x: bx + dx, y: by + dy } }),
                    onZoom: (f: number) => {
                      // Pinch = manual scaling WITHIN the band's range.
                      const b = BANDS.find((x) => x.id === mode)!
                      setBandScale((s) => Math.min(b.maxMM, Math.max(b.minMM, (s ?? effSizeRef.current ?? b.minMM) * f)))
                    },
                    onReset: () => setManual(null) }
              return <Stage {...stageProps} />
            })()}
            {!libraryModel && !model && (src === 'magic'
              ? <Empty text={magStatus.startsWith('error') ? magStatus.slice(6) : magStatus === 'downloading-model' ? 'Downloading the cut-out model…' : magStatus.startsWith('cutting') ? 'Cutting out the shape…' : 'Upload an image to cut its outline'} spin={magStatus === 'downloading-model' || magStatus.startsWith('cutting')} />
              : src === 'cut'
                ? <Empty text={cutStatus.startsWith('error') ? cutStatus.slice(6) : cutStatus === 'tracing' ? 'Tracing the outline…' : 'Pick a cutout from the library'} spin={cutStatus === 'tracing'} />
                : <Empty text="shape unavailable" />)}
          </div>
        </section>

        <aside className="gl-controls">
          {tab === 'library' ? <>
          <div className="gl-card gl-libsize">
            <span className="gl-camnum">
              <input key={'libcam' + Math.round(libView.zoom * 100)} type="number" defaultValue={Math.round(libView.zoom * 100)}
                onBlur={(e) => { const n = +e.currentTarget.value; if (Number.isFinite(n) && n > 0) setLibView((v) => ({ ...v, zoom: camClamp(n / 100) })) }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} />
              <i>%</i>
            </span>
            <div className="gl-camzoom">
              <button aria-label="zoom out" onClick={() => setLibView((v) => ({ ...v, zoom: camStep(v.zoom, -1) }))}>−</button>
              <button aria-label="fit" onClick={() => setLibView({ panMM: [0, 0], zoom: 1 })}>fit</button>
              <button aria-label="zoom in" onClick={() => setLibView((v) => ({ ...v, zoom: camStep(v.zoom, +1) }))}>+</button>
            </div>
          </div>
          <LibraryPanel sel={librarySel} setSel={setLibrarySel} Fold={Fold} pitch={pitch} padMM={pad}
            showBox={showBox} setShowBox={setShowBox} edit={edit} setEdit={setEdit} drafts={drafts}
            startAdd={() => setEdit({ name: '', nodes: [] })}
            startEdit={() => {
              const { shape, frame, layout, draft } = resolveSelection(librarySel, drafts)
              // custom seeds from what is ON SCREEN at this pitch, not the canonical 48 set
              const source = draft?.nodes ?? layoutAtPitch(shape.family, frame, layout, pitch).nodes
              setEdit({
                name: draft ? draft.name : layout.name + '-custom',
                nodes: source.map(([x, y]) => [x, y] as [number, number]),
              })
            }}
            saveEdit={() => {
              if (!edit) return
              const { shape, frame, safeSel } = resolveSelection(librarySel, drafts)
              const rec: LibraryDraft = { id: draftId(shape.family, safeSel.frameKey, edit.name), className: shape.family, frameKey: safeSel.frameKey, name: edit.name, nodes: edit.nodes }
              // The corpus checks its own soundness; an authored layout gets the same gate
              // before it is persisted (QA F1) — never write a draft that breaks its frame.
              const bad = draftIntegrity(rec, frame)
              if (bad.length) { setMagStatus('error:' + bad[0]); return }
              writeDrafts([...drafts.filter((x) => x.id !== rec.id), rec])
              setEdit(null)
              setLibrarySel({ ...librarySel, layoutId: draftLayoutId(edit.name) })
            }}
            deleteEdit={() => {
              const nm = edit ? edit.name : draftNameOf(librarySel.layoutId)
              const { shape, frame, safeSel } = resolveSelection(librarySel, drafts)
              writeDrafts(drafts.filter((x) => !(x.className === shape.family && x.frameKey === safeSel.frameKey && x.name === nm)))
              setEdit(null)
              setLibrarySel({ ...librarySel, layoutId: frame.layouts[0].name })
            }} /></> : <>
          <Fold title="Grid settings">
            <div className="gl-field"><span>Band · the offer list</span>
              <div className="gl-seg">
                {BANDS.map((b) =>
                  <button key={b.id} aria-pressed={mode === b.id} onClick={() => { setMode(b.id); setStepSel(null); setManual(null); setBandScale(null); try { localStorage.setItem('grid-centre.band', String(b.id)) } catch { } }}>B{b.id}</button>)}
              </div>
            </div>
            {true && <>
              <div className="gl-snap">
                {manual
                  ? 'manual calibration · double-click the canvas to return to auto'
                  : bandScale !== null
                    ? `manual scale · ${Math.round(bandScale)} mm — tap a step or the band chip to return`
                    : model
                    ? model.ladder.length
                      ? `Fit B${mode}-${model.idx + 1} · ${Math.round(model.effSize)} mm · ${model.grid.anchors.length}⌾${model.offMM != null ? ` · off-centre ${model.offMM.toFixed(1)}mm` : ''} · ${model.ladder.length} holding layouts in band`
                      : 'nothing fully fits in this band — best seated shown'
                    : '—'}
              </div>
              {model && model.ladder.length > 0 && <div className="gl-steps">
                {model.ladder.map((pt, i) =>
                  <button key={i} aria-pressed={bandScale === null && i === model.idx} onClick={() => { setStepSel(i); setBandScale(null) }}>
                    <b>B{mode}-{i + 1}</b><span>{pt.sizeMM} mm · {pt.count}⌾</span>
                  </button>)}
              </div>}
              {(() => {
                const b = BANDS.find((x) => x.id === mode)!
                return <Slider label={`Band scale · manual within B${mode}`} unit="mm"
                  v={Math.round(bandScale ?? (effSizeRef.current || b.minMM))}
                  set={(n) => setBandScale(Math.min(b.maxMM, Math.max(b.minMM, n)))}
                  min={b.minMM} max={b.maxMM} />
              })()}
              <Slider label="Snap step" unit="mm" v={snapStep} set={setSnapStep} min={SNAP_STEP_MM} max={MIN_EFFECT_MM} />
            </>}
            <div className="gl-field"><span>Grid pitch · released tiers</span>
              <div className="gl-seg">
                {RELEASED_PITCHES_MM.map(({ mm, label }) =>
                  <button key={mm} aria-pressed={pitch === mm} onClick={() => setPitch(mm)}>{label}</button>)}
              </div>
            </div>
            <LockNum label="Magnet padding · per spot" unit="mm" v={pad} set={setPad}
              min={PADDING_FLOOR_MM} max={PADDING_CEIL_MM} locked={padLock} setLocked={setPadLock}
              released={RELEASED_PADDING_MM} />
            <div className="gl-lab-off" title="inactive under Centre rules — nothing slides">
              <LabRow on={enPhaseN !== 0} set={(b) => setEnPhaseN(b ? 1 : 0)}>
                <Slider label="Placement step · grid slide" unit="mm" v={phaseStep} set={setPhaseStep} min={PHASE_STEP_FLOOR_MM} max={MIN_EFFECT_MM} />
              </LabRow>
            </div>
            <div className="gl-field"><span>Coverage</span>
              <div className="gl-seg">
                {([['full', 'Full grid'], ['perimeter', 'Perimeter belt']] as ['full' | 'perimeter', string][]).map(([c, l]) =>
                  <button key={c} aria-pressed={coverage === c} onClick={() => setCoverage(c)}>{l}</button>)}
              </div>
            </div>
            <div className="gl-field"><span>Magnet plan</span>
              <div className="gl-seg">
                {([['all6', 'All 6mm'], ['all8', 'All 8mm'], ['corners8', 'Corners 8']] as [MagnetPlan, string][]).map(([p, l]) =>
                  <button key={p} aria-pressed={plan === p} onClick={() => setPlan(p)}>{l}</button>)}
              </div>
            </div>
            <label className="gl-toggle"><span>Show lattice <small style={{ color: 'var(--ink-3)' }}>· every position tried</small></span>
              <input type="checkbox" checked={showLattice} onChange={e => setShowLattice(e.target.checked)} />
            </label>
            <label className="gl-toggle"><span>Show bounding box <small style={{ color: 'var(--ink-3)' }}>· size on each side</small></span>
              <input type="checkbox" checked={showBox} onChange={e => setShowBox(e.target.checked)} />
            </label>
            <label className="gl-toggle"><span>Show segments <small style={{ color: 'var(--ink-3)' }}>· legal-area islands</small></span>
              <input type="checkbox" checked={showSegs} onChange={e => setShowSegs(e.target.checked)} />
            </label>
            <div className="gl-seg">
              <button onClick={saveDefaults}>Save as default</button>
              <button onClick={resetDefaults}>Reset to default</button>
            </div>
          </Fold>
          </>}
        </aside>

        <aside className="gl-centercol" style={tab === 'library' ? { display: 'none' } : undefined}>
          <div className="gl-card gl-libsize">
            <span className="gl-camnum">
              <input key={'cam' + Math.round(camZoom * 100)} type="number" defaultValue={Math.round(camZoom * 100)}
                onBlur={(e) => { const n = +e.currentTarget.value; if (Number.isFinite(n) && n > 0) setCamZoom(camClamp(n / 100)) }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} />
              <i>%</i>
            </span>
            <div className="gl-camzoom">
              <button aria-label="zoom out" onClick={() => setCamZoom((z) => camStep(z, -1))}>−</button>
              <button aria-label="fit" onClick={() => setCamZoom(1)}>fit</button>
              <button aria-label="zoom in" onClick={() => setCamZoom((z) => camStep(z, +1))}>+</button>
            </div>
          </div>
          <Fold title="Shape">
            {src === 'preset' && <>
              <div className="gl-lib">
                {PRESETS.map((k) => (
                  <button key={k} aria-pressed={preset === k} onClick={() => setPreset(k as VectorShapeKind)}><b>{k}</b></button>
                ))}
              </div>
              {preset === 'polygon' && <Slider label="Sides" v={sides} set={setSides} min={3} max={12} />}
              {preset === 'star' && <Slider label="Points" v={points} set={setPoints} min={3} max={12} />}
            </>}

            {src === 'gen' && <>
              <div className="gl-seg gl-wrap">
                {GENS.map(g => <button key={g.k} aria-pressed={gen === g.k} onClick={() => { setGen(g.k); setP1(50); setP2(g.p2start) }}>{g.label}</button>)}
              </div>
              <Slider label={genDef.p1[0]} unit={genDef.p1[1]} v={p1} set={setP1} min={0} max={100} />
              <Slider label={genDef.p2[0]} v={p2} set={setP2} min={genDef.p2min} max={genDef.p2max} />
            </>}

            {src === 'cut' && <>
              <div className="gl-lib">
                {libCut.map((f) => (
                  <button key={f} aria-pressed={cutSel === f} onClick={() => { setCutSel(f); loadCut(f) }}>
                    <b>{f.replace(/\.\w+$/, '')}</b>
                  </button>
                ))}
              </div>
              <label className="gl-field" style={{ display: 'none' }}><span>Cutout library</span>
                <select value={cutSel} onChange={(e) => { setCutSel(e.target.value); if (e.target.value) loadCut(e.target.value) }}>
                  <option value="">— pick a cutout —</option>
                  {libCut.map((f) => <option key={f} value={f}>{f.replace(/\.\w+$/, '')}</option>)}
                </select>
              </label>
              <div className="gl-magic-note">
                {cutStatus.startsWith('error') ? '⚠ ' + cutStatus.slice(6)
                  : cutStatus === 'tracing' ? 'tracing the outline…'
                    : cutC ? 'outline traced from the alpha edge · edit size below'
                      : 'finished cutouts — the outline is the image’s own edge, no AI pass.'}
              </div>
            </>}

            {src === 'magic' && <>
              {libRaw.length > 0 && <label className="gl-field"><span>Raw library · goes through the AI cut</span>
                <select value={libSel} onChange={(e) => { setLibSel(e.target.value); if (e.target.value) loadLib(e.target.value) }}>
                  <option value="">— pick an image —</option>
                  {libRaw.map((f) => <option key={f} value={f}>{f.replace(/\.\w+$/, '')}</option>)}
                </select>
              </label>}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
              <button className="gl-upload" onClick={() => fileRef.current?.click()}>
                {magic ? 'Replace image' : 'Upload an image'}
              </button>
              <div className="gl-magic-note">
                {magStatus === 'downloading-model' ? '↓ downloading cut-out model (one time)…'
                  : magStatus.startsWith('cutting') ? '✂ cutting out the subject…'
                    : magStatus.startsWith('error') ? '⚠ ' + magStatus.slice(6)
                      : magic ? `cut by ${magic.adapter} · edit size below`
                        : 'AI removes the background and traces the silhouette — that outline meets the grid.'}
              </div>
            </>}
          </Fold>


          <Fold title="Centering">
            <div className="gl-field"><span>Centre mode</span>
              <div className="gl-seg gl-wrap">
                {([[0, 'Box'], [1, 'Core'], [2, 'Masses'], [3, 'Weight'], [4, 'Deep'], [5, 'Top']] as [number, string][]).map(([m, l]) =>
                  <button key={m} aria-pressed={centreMode === m} onClick={() => setCentreMode(m)}>{l}</button>)}
              </div>
            </div>
            {centreMode === 2 && <div className="gl-field"><span>Governor</span>
              <div className="gl-seg gl-wrap">
                {([[0, 'Smallest'], [1, 'Deepest'], [2, 'Top'], [3, 'Top-small']] as [number, string][]).map(([g, l]) =>
                  <button key={g} aria-pressed={governor === g} onClick={() => setGovernor(g)}>{l}</button>)}
              </div>
            </div>}
            {(centreMode === 2 || centreMode === 5) &&
              <Slider label="Mass depth" unit="mm" v={massDepth} set={setMassDepth} min={MASS_DEPTH_FLOOR_MM} max={MASS_DEPTH_CEIL_MM} />}
          </Fold>
        </aside>
      </div>
    </div>
  )
}

function dim(c: Contour, axis: 0 | 1): number {
  let lo = Infinity, hi = -Infinity
  for (const p of c.outer.pts) { if (p[axis] < lo) lo = p[axis]; if (p[axis] > hi) hi = p[axis] }
  return hi - lo
}

/** Island tints — screen colours only, one hue per segment, smallest first. */
const SEG_HUES = ['#e0762f', '#7a4ae0', '#2fa864', '#e04a8f', '#2f9fe0']

function Stage({ contour, grid, lattice, box, segments, segFill, onPan, onZoom, onReset, onPickNode, viewport }: {
  contour: Contour; grid: GridResult; lattice: boolean; box: boolean; segments: SafeSegment[]; segFill: boolean
  onPan: (dxMM: number, dyMM: number) => void; onZoom: (f: number) => void; onReset: () => void
  /** Library authoring: a lattice spot was clicked (mm, engine y-up). Display layer only. */
  onPickNode?: (pMM: Pt) => void
  /** LIBRARY TAB ONLY — a free canvas: pan and zoom move the view itself and the lattice field
   *  regenerates over whatever is visible. Absent everywhere else, so the bench is untouched. */
  viewport?: { panMM: Pt; zoom: number; wheelZoom?: boolean }
}) {
  const pts = contour.outer.pts.map(([x, y]) => [x, -y] as Pt)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  const w = maxX - minX, h = maxY - minY, S = (VP * FIT) / Math.max(w, h)
  const d = 'M ' + pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ') + ' Z'
  const fy = (p: Pt): Pt => [p[0], -p[1]]
  const seat = new Set(grid.anchors.map(a => a.p[0].toFixed(2) + ',' + a.p[1].toFixed(2)))

  // Manual calibration gestures — the shape is FROZEN; drag pans the GRID under it (mm, engine
  // y-up), pinch scales the effect size, double-click hands registration back to the engine.
  // MANUAL MEANS NO COMPUTE (Dan's rule): while a gesture is live the grid layers shift as a
  // pure visual transform; ONE solve commits when the gesture ends.
  // px→mm uses the RENDERED size, so gestures stay true when the canvas shrinks on a phone.
  const svgRef = useRef<SVGSVGElement>(null)
  const dragAt = useRef<{ x: number; y: number } | null>(null)
  // Touch pinch: wheel+ctrlKey is the TRACKPAD pinch convention and iOS never sends it, so a
  // phone needs the two-pointer distance itself. Every live pointer is tracked; with two down
  // the frame-to-frame distance ratio drives the same onZoom the trackpad uses.
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchDist = useRef(0)
  const [pend, setPend] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const pendRef = useRef(pend)
  pendRef.current = pend
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const commit = () => {
    const p = pendRef.current
    if (p.x || p.y) onPan(p.x, p.y)
    setPend({ x: 0, y: 0 })
  }
  const pxPerMM = (el: Element) => el.getBoundingClientRect().width / (VP / S)
  useEffect(() => {
    // Listen on the viewport wrapper, not the svg — the solving overlay sits above the svg
    // and would otherwise swallow wheel events mid-gesture.
    const svg = svgRef.current
    const el = svg?.parentElement
    if (!svg || !el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const k = pxPerMM(svg)
      if (e.ctrlKey || viewport?.wheelZoom) { onZoom(Math.exp(-e.deltaY * (viewport?.wheelZoom ? 0.0025 : 0.01))); return }
      setPend((p) => ({ x: p.x - e.deltaX / k, y: p.y + e.deltaY / k }))
      if (wheelTimer.current) clearTimeout(wheelTimer.current)
      wheelTimer.current = setTimeout(commit, 250)
    }
    // iOS Safari also raises its own gesture events for a two-finger pinch and would zoom the
    // PAGE. Refusing them leaves the pointer handlers to scale the effect instead.
    const stop = (e: Event) => e.preventDefault()
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('gesturestart', stop, { passive: false })
    el.addEventListener('gesturechange', stop, { passive: false })
    el.addEventListener('gestureend', stop, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('gesturestart', stop)
      el.removeEventListener('gesturechange', stop)
      el.removeEventListener('gestureend', stop)
    }
  })

  // Widen the viewBox to the frame at the same scale — the shape keeps its 86% size.
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
  const zoom = viewport ? viewport.zoom : 1
  const spanMM = VP / S / zoom
  const vx = cx - spanMM / 2 + (viewport ? viewport.panMM[0] : 0)
  const vy = cy - spanMM / 2 - (viewport ? viewport.panMM[1] : 0)

  // Spots come from the bridge; the toggle picks field vs seated. This file draws circles.
  // On the free viewport the SVG slices to the element's aspect, so the field must be generated
  // well past the square viewBox — the lattice is infinite, never a window.
  const fp = viewport ? spanMM : 0
  const spots: readonly FieldSpot[] = lattice
    ? fieldSpots(grid, { minX: vx - fp, minY: -(vy + spanMM + fp), maxX: vx + spanMM + fp, maxY: -(vy - fp) })
    : seatedSpots(grid)
  // Rule anchor: any spot is on the lattice, so lines cross at the centres.
  const A0 = spots[0]
  const Afy: [number, number] = A0 ? [A0.x, -A0.y] : [0, 0]

  return (
    <svg ref={svgRef} width={VP} height={VP} viewBox={`${vx} ${vy} ${spanMM} ${spanMM}`}
      preserveAspectRatio={viewport ? 'xMidYMid slice' : undefined}
      style={{ cursor: dragAt.current ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none' }}
      onPointerDown={(e) => {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        e.currentTarget.setPointerCapture?.(e.pointerId)
        if (pointers.current.size === 2) {
          // Second finger down starts a pinch — the pan in progress commits first.
          const [a, b] = [...pointers.current.values()]
          pinchDist.current = Math.hypot(a.x - b.x, a.y - b.y)
          dragAt.current = null
          commit()
        } else if (pointers.current.size === 1) {
          dragAt.current = { x: e.clientX, y: e.clientY }
        }
      }}
      onPointerMove={(e) => {
        if (!pointers.current.has(e.pointerId)) return
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (pointers.current.size >= 2) {
          const [a, b] = [...pointers.current.values()]
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          if (pinchDist.current > 0 && d > 0) onZoom(d / pinchDist.current)
          pinchDist.current = d
          return
        }
        if (!dragAt.current) return
        const k = pxPerMM(e.currentTarget)
        const mx = (e.clientX - dragAt.current.x) / k, my = (e.clientY - dragAt.current.y) / k
        dragAt.current = { x: e.clientX, y: e.clientY }
        setPend((p) => ({ x: p.x + mx, y: p.y - my }))
      }}
      onPointerUp={(e) => {
        pointers.current.delete(e.pointerId)
        if (pointers.current.size < 2) pinchDist.current = 0
        // A finger lifted out of a pinch must not resume panning from a stale anchor.
        dragAt.current = pointers.current.size === 1
          ? { ...[...pointers.current.values()][0] }
          : null
        if (pointers.current.size === 0) commit()
      }}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId)
        if (pointers.current.size < 2) pinchDist.current = 0
        if (pointers.current.size === 0) { dragAt.current = null; commit() }
      }}
      onDoubleClick={() => { setPend({ x: 0, y: 0 }); onReset() }}>
      {/* The ground: two-level mm rule anchored on the lattice, so intersections are the centres. */}
      <defs>
        <pattern id="gl-fine" width={grid.pitchCentreMM / 2} height={grid.pitchCentreMM / 2}
          patternUnits="userSpaceOnUse" x={Afy[0]} y={Afy[1]}>
          <path d={`M ${grid.pitchCentreMM / 2} 0 L 0 0 0 ${grid.pitchCentreMM / 2}`}
            fill="none" stroke="var(--ink)" strokeOpacity={0.05} strokeWidth={0.4} />
        </pattern>
        <pattern id="gl-pitch" width={grid.pitchCentreMM} height={grid.pitchCentreMM}
          patternUnits="userSpaceOnUse" x={Afy[0]} y={Afy[1]}>
          <path d={`M ${grid.pitchCentreMM} 0 L 0 0 0 ${grid.pitchCentreMM}`}
            fill="none" stroke="var(--ink)" strokeOpacity={0.10} strokeWidth={0.5} />
        </pattern>
        {/* Registration dots on every 12mm cell corner — the board's atom, phase-locked to the
            lattice so 12mm steps and centres are always visible. Dot sits at tile centre; the
            pattern origin is shifted half a tile so dots land on the corners unclipped. */}
        <pattern id="gl-dots" width={DEFAULT_PITCH_MM / 4} height={DEFAULT_PITCH_MM / 4}
          patternUnits="userSpaceOnUse" x={Afy[0] - DEFAULT_PITCH_MM / 8} y={Afy[1] - DEFAULT_PITCH_MM / 8}>
          <circle cx={DEFAULT_PITCH_MM / 8} cy={DEFAULT_PITCH_MM / 8} r={0.05} fill="var(--ink)" fillOpacity={0.35} />
        </pattern>
      </defs>
      <rect x={vx - fp} y={vy - fp} width={spanMM + 2 * fp} height={spanMM + 2 * fp} fill="var(--panel)" />
      {/* Grid-anchored layers shift as one rigid body while a manual gesture is live. */}
      <g transform={pend.x || pend.y ? `translate(${pend.x} ${-pend.y})` : undefined}>
        <rect x={vx - fp - Math.abs(pend.x)} y={vy - fp - Math.abs(pend.y)} width={spanMM + 2 * fp + 2 * Math.abs(pend.x)} height={spanMM + 2 * fp + 2 * Math.abs(pend.y)} fill="url(#gl-fine)" />
        <rect x={vx - fp - Math.abs(pend.x)} y={vy - fp - Math.abs(pend.y)} width={spanMM + 2 * fp + 2 * Math.abs(pend.x)} height={spanMM + 2 * fp + 2 * Math.abs(pend.y)} fill="url(#gl-pitch)" />
        <rect x={vx - fp - Math.abs(pend.x)} y={vy - fp - Math.abs(pend.y)} width={spanMM + 2 * fp + 2 * Math.abs(pend.x)} height={spanMM + 2 * fp + 2 * Math.abs(pend.y)} fill="url(#gl-dots)" />
      </g>
      {/* THE SHAPE IS ITS OUTLINE — a wash and the cut line. */}
      <path d={d} fill="var(--suede)" fillOpacity={0.12} />
      <path d={d} fill="none" stroke="var(--suede-edge)"
        strokeOpacity={0.9} strokeWidth={1} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {/* Legal-area islands: coloured cells, dashed box, centre cross — engine y-up, drawn y-down. */}
      {segments.map((sg, si) => {
        const hue = SEG_HUES[si % SEG_HUES.length]
        const fs = 11 * spanMM / VP
        return <g key={'sg' + si} style={{ pointerEvents: 'none' }}>
          {sg.rings.map((ring, ri) => {
            const d = 'M ' + ring.map(([x, y]) => `${x.toFixed(2)} ${(-y).toFixed(2)}`).join(' L ') + ' Z'
            return <path key={ri} d={d} fill={hue} fillOpacity={segFill ? 0.12 : 0} stroke={hue} strokeOpacity={0.85}
              strokeWidth={1.2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          })}
          <rect x={sg.bbox.minX} y={-sg.bbox.maxY} width={sg.bbox.maxX - sg.bbox.minX} height={sg.bbox.maxY - sg.bbox.minY}
            fill="none" stroke={hue} strokeOpacity={0.75} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
          {/* Depth masses: the regions surviving the mass-depth probe, each with its own centre. */}
          {sg.masses.map((m, mi) => <g key={'m' + mi}>
            {m.rings.map((ring, ri) => {
              const d = 'M ' + ring.map(([x, y]) => `${x.toFixed(2)} ${(-y).toFixed(2)}`).join(' L ') + ' Z'
              return <path key={ri} d={d} fill={hue} fillOpacity={segFill ? 0.10 : 0} stroke={hue} strokeOpacity={0.6}
                strokeWidth={0.9} strokeDasharray="3 3" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            })}
            <circle cx={m.centreMM[0]} cy={-m.centreMM[1]} r={fs * 0.35} fill={hue} />
          </g>)}
        </g>
      })}
      {/* Centring targets. Secondary candidates: small bullseyes in their island's colour.
          THE MAIN CENTRE — the one that governed the winning layout — draws green on top. */}
      {grid.centresMM.map((c, ci) => {
        const isMain = c[0] === grid.centreMainMM[0] && c[1] === grid.centreMainMM[1]
        if (isMain) return null
        const si = segments.findIndex((sg) =>
          c[0] >= sg.bbox.minX && c[0] <= sg.bbox.maxX && c[1] >= sg.bbox.minY && c[1] <= sg.bbox.maxY)
        const hue = si >= 0 ? SEG_HUES[si % SEG_HUES.length] : 'var(--accent)'
        return <g key={'c' + ci} style={{ pointerEvents: 'none' }}>
          <circle cx={c[0]} cy={-c[1]} r={2} fill="none" stroke={hue} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <circle cx={c[0]} cy={-c[1]} r={0.5} fill={hue} />
        </g>
      })}
      <g style={{ pointerEvents: 'none' }}>
        <circle cx={grid.centreMainMM[0]} cy={-grid.centreMainMM[1]} r={3.2} fill="none" stroke="var(--pass)" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        <circle cx={grid.centreMainMM[0]} cy={-grid.centreMainMM[1]} r={0.8} fill="var(--pass)" />
      </g>
      {/* Faint bounding box, its dimension written on every side. */}
      {box && <rect x={minX} y={minY} width={w} height={h} fill="none" stroke="var(--ink)"
        strokeOpacity={0.22} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
      {box && (() => {
        // On the free board the viewBox grows with zoom-out, so a fixed mm-height label
        // balloons — scale it by the visible span instead.
        const fs = (viewport ? 7 : 11) * spanMM / VP
        const lbl = { fontSize: fs, fill: 'var(--ink)', fillOpacity: 0.55, fontFamily: 'var(--mono)', fontWeight: 600 } as const
        const wTxt = `${Math.round(w)} mm`, hTxt = `${Math.round(h)} mm`
        return (<g style={{ pointerEvents: 'none' }}>
          <text {...lbl} x={cx} y={minY - fs * 0.6} textAnchor="middle">{wTxt}</text>
          <text {...lbl} x={cx} y={maxY + fs * 1.5} textAnchor="middle">{wTxt}</text>
          <text {...lbl} x={minX - fs * 0.6} y={cy} textAnchor="middle" transform={`rotate(-90 ${minX - fs * 0.6} ${cy})`}>{hTxt}</text>
          <text {...lbl} x={maxX + fs * 0.6} y={cy} textAnchor="middle" transform={`rotate(90 ${maxX + fs * 0.6} ${cy})`}>{hTxt}</text>
        </g>)
      })()}
      {/* Every spot the bridge handed over: faint where empty, accent where a magnet seats. */}
      <g transform={pend.x || pend.y ? `translate(${pend.x} ${-pend.y})` : undefined}>
      {spots.map((sp, i) => {
        // INNER stroke: the line's outer edge sits exactly on the true spot radius, so a
        // tangent disc never reads past the cut line.
        const sw = sp.held ? 0.6 : 0.5
        return <g key={'f' + i}>
          <circle cx={sp.x} cy={-sp.y} r={sp.r - sw / 2}
            fill={sp.held ? 'var(--accent)' : 'var(--ink)'} fillOpacity={sp.held ? 0.10 : 0.04}
            stroke={sp.held ? 'var(--accent)' : 'var(--ink)'} strokeOpacity={sp.held ? 0.55 : 0.25}
            strokeWidth={sw} />
          {onPickNode && <circle cx={sp.x} cy={-sp.y} r={sp.r} fill="transparent" style={{ cursor: 'pointer' }}
            onPointerDown={(e) => { e.stopPropagation(); onPickNode([sp.x, sp.y]) }} />}
        </g>
      })}
      {grid.anchors.map((a, i) => {
        const p = fy(a.p)
        // While authoring, a placed magnet must not swallow its own spot's hit target —
        // otherwise a magnet can be added but never toggled off.
        return <g key={'a' + i} opacity={0.5} style={onPickNode ? { pointerEvents: 'none' } : undefined}>
          <circle cx={p[0]} cy={p[1]} r={a.dia / 2} fill={a.dia === 8 ? 'var(--mag8)' : 'var(--magnet)'} />
          <circle cx={p[0] - a.dia * 0.12} cy={p[1] - a.dia * 0.12} r={a.dia / 2 * 0.4} fill="var(--magnet-hi)" fillOpacity={0.5} />
        </g>
      })}
      {/* Tangency made visible: where a disc touches the outline within the allowance. */}
      {grid.contactsMM.map((c, i) => {
        const p = fy(c)
        return <circle key={'t' + i} cx={p[0]} cy={p[1]} r={0.9} fill="var(--pass)" stroke="var(--panel)" strokeWidth={0.3} />
      })}
      </g>
    </svg>
  )
}

function Empty({ text, spin }: { text: string; spin?: boolean }) {
  return <div className="gl-empty">{spin && <span className="gl-spin" />}{text}</div>
}
function Slider({ label, v, set, min, max, unit, wide }: { label: string; v: number; set: (n: number) => void; min: number; max: number; unit?: string; wide?: boolean }) {
  const commit = (raw: string) => {
    const n = +raw
    if (Number.isFinite(n)) set(Math.min(max, Math.max(min, Math.round(n))))
  }
  return (
    <label className="gl-slider">
      <div className="gl-slider-row"><span>{label}</span>
        <span className={wide ? 'gl-num gl-num-wide' : 'gl-num'}>
          <input key={v} type="number" defaultValue={v} min={min} max={max}
            onBlur={(e) => commit(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} />
          {unit ? <i>{unit}</i> : null}
        </span></div>
      <input type="range" min={min} max={max} value={v} onChange={e => set(+e.target.value)} />
    </label>
  )
}
/** Magnet stepper — chevrons either side of a typed count. Forwards the number, decides nothing. */
/** The wrap engine's stepper, over the snap stops: chevrons step stop-to-stop, typing jumps to
 *  the nearest stop. The value shown IS the pressed size. */
function Stepper({ label, v, set }: { label: string; v: number; set: (n: number) => void }) {
  const commit = (raw: string) => { const n = Math.round(+raw); if (Number.isFinite(n)) set(Math.max(1, n)) }
  return (
    <div className="gl-field"><span>{label}</span>
      <div className="gl-stepper">
        <button aria-label="one fewer magnet" onClick={() => set(v - 1)} disabled={v <= 1}>&#8249;</button>
        <input key={v} type="number" defaultValue={v} min={1}
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} />
        <button aria-label="one more magnet" onClick={() => set(v + 1)}>&#8250;</button>
      </div>
    </div>
  )
}
/** One lab control with its own enable — off drops the control's field, spec default rules. */
function LabRow({ on, set, children }: { on: boolean; set: (b: boolean) => void; children: React.ReactNode }) {
  return (
    <div className="gl-labrow">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
      <div className={`gl-labrow-body${on ? '' : ' gl-lab-off'}`}>{children}</div>
    </div>
  )
}
/** Perf value in seconds — green when fast, red past the 2s comfort line. */
function LockNum({ label, unit, v, set, min, max, locked, setLocked, released }: {
  label: string; unit?: string; v: number; set: (n: number) => void
  min: number; max: number; locked: number; setLocked: (n: number) => void; released: number
}) {
  return (
    <div className="gl-field"><span>{label}{locked ? ' · locked' : ' · unlocked for testing'}</span>
      <div className="gl-limits">
        <button className="gl-lock" aria-pressed={locked !== 0} title={locked ? 'locked to the released value' : 'unlocked — typed values allowed'}
          onClick={() => { const next = locked ? 0 : 1; setLocked(next); if (next) set(released) }}>
          {locked ? '🔒' : '🔓'}
        </button>
        <span className="gl-num"><i>{unit ?? ''}</i>
          <input key={String(locked) + v} type="number" defaultValue={v} disabled={locked !== 0}
            onBlur={(e) => { const n = +e.currentTarget.value; if (Number.isFinite(n) && n >= min && n <= max) set(n); else e.currentTarget.value = String(v) }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} />
        </span>
      </div>
    </div>
  )
}

function Sec({ ms }: { ms?: number }) {
  if (ms == null) return <b>—</b>
  return <b className={ms > 2000 ? 'gl-slow' : ''}>{(ms * 0.001).toFixed(2)}s</b>
}
/** Collapsible card — native details, open by default; collapse the unneeded on a phone. */
function Fold({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <details className="gl-card gl-fold" open>
      <summary>{title}</summary>
      <div className="gl-fold-body">{children}</div>
    </details>
  )
}

const CSS = `
.gl{--bg:#eef1f5;--panel:#fff;--panel-2:#f6f8fb;--line:#dbe1ea;--ink:#18202e;--ink-2:#5a6577;--ink-3:#93a0b3;
  --accent:#2f6bff;--accent-soft:#2f6bff18;--grid:#9fb0cc;--suede:#454952;--suede-edge:#2c2f36;--magnet:#20242c;
  --magnet-hi:#6b7280;--mag8:#c98a12;--pass:#1a9e4b;--fail:#e5484d;--shadow:0 1px 2px #18202e0d,0 10px 26px #18202e0f;
  --mono:ui-monospace,"SF Mono",Menlo,monospace;--sans:system-ui,-apple-system,"Segoe UI",sans-serif;
  background:var(--bg);color:var(--ink);font-family:var(--sans);min-height:100vh;padding:26px 20px 70px;-webkit-font-smoothing:antialiased}
@media (prefers-color-scheme:dark){.gl:not([data-theme]){--bg:#0f141b;--panel:#161c25;--panel-2:#12171f;--line:#232c3a;--ink:#e6edf3;--ink-2:#9aa6b6;--ink-3:#66717f;--accent:#4d84ff;--accent-soft:#4d84ff20;--grid:#3d4a60;--suede:#9aa6ba;--suede-edge:#c9d4e2;--magnet:#0b0e12;--magnet-hi:#4a515c;--shadow:0 1px 2px #0005,0 12px 30px #0006}}
.gl *{box-sizing:border-box}
.gl-head{max-width:1400px;margin:0 auto 20px;text-align:center}
.gl-head h1{font-size:20px;font-weight:640;letter-spacing:-.01em;margin:0 0 5px;display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;justify-content:center}
.gl-tag{font:600 11px var(--mono);color:var(--accent);background:var(--accent-soft);padding:3px 9px;border-radius:20px;letter-spacing:.02em}
.gl-head p{color:var(--ink-2);font-size:13.5px;margin:0;max-width:74ch;line-height:1.55}
.gl-body{max-width:1400px;margin:0 auto;display:grid;grid-template-columns:290px minmax(0,1fr) 336px;gap:20px;align-items:start}
.gl-centercol{grid-column:1;grid-row:1}
.gl-stage{grid-column:2;grid-row:1}
.gl-controls{grid-column:3;grid-row:1}
.gl-lab-off{opacity:.4;pointer-events:none}
.gl-labrow{display:flex;gap:9px;align-items:flex-start}
.gl-labrow>input{width:15px;height:15px;accent-color:var(--accent);margin-top:3px;flex:none}
.gl-labrow-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:12px}
.gl-fold summary{cursor:pointer;list-style:none;padding:14px 18px;font:600 10.5px var(--mono);letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3);display:flex;justify-content:space-between;align-items:center;user-select:none}
.gl-fold summary::-webkit-details-marker{display:none}
.gl-fold summary::after{content:'▾';font-size:11px;transition:transform .15s}
.gl-fold:not([open]) summary::after{transform:rotate(-90deg)}
.gl-fold-body{display:flex;flex-direction:column;gap:15px;padding:2px 18px 18px}
@media (max-width:1100px){.gl-body{grid-template-columns:minmax(0,1fr) 336px}
  .gl-stage{grid-column:1;grid-row:1}.gl-controls{grid-column:2;grid-row:1}.gl-centercol{grid-column:1/-1;grid-row:2}}
@media (max-width:840px){.gl-body{grid-template-columns:1fr}
  .gl-stage{grid-column:1;grid-row:auto}.gl-controls{grid-column:1;grid-row:auto}.gl-centercol{grid-column:1;grid-row:auto}}
.gl-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow)}
.gl-pad{padding:18px;display:flex;flex-direction:column;gap:15px}
.gl-stage{padding:20px;display:flex;flex-direction:column;gap:14px}
.gl-stage-head{display:flex;justify-content:space-between;gap:10px}
.gl-eye{font:600 10.5px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)}
.gl-vp{aspect-ratio:1;max-width:${VP}px;width:100%;margin:0 auto;display:flex;align-items:center;justify-content:center;
  background:var(--panel-2);position:relative;
  border:1px dashed var(--line);border-radius:12px;overflow:hidden}
.gl-vp svg{width:100%;height:auto;max-width:${VP}px}
@media (max-width:840px){
  .gl{padding:14px 10px 44px}
  .gl-stage{padding:12px}
  .gl-head h1{font-size:17px}
}
.gl-solving{position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;gap:8px;
  font:600 12px var(--mono);color:var(--ink-2);background:rgba(127,132,145,.14);backdrop-filter:blur(1px);pointer-events:none}
.gl-empty{display:flex;align-items:center;gap:9px;color:var(--ink-3);font:12.5px var(--mono);text-align:center;padding:20px;max-width:80%}
.gl-spin{width:14px;height:14px;border:2px solid var(--line);border-top-color:var(--accent);border-radius:50%;animation:gspin .8s linear infinite;flex:none}
@keyframes gspin{to{transform:rotate(360deg)}}
.gl-controls{display:flex;flex-direction:column;gap:16px}
.gl-glabel{font:600 10.5px var(--mono);letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3)}
.gl-seg{display:flex;gap:4px;background:var(--panel-2);border:1px solid var(--line);border-radius:10px;padding:3px}
.gl-seg3 button,.gl-seg button{flex:1;min-width:0;font:550 12px var(--sans);color:var(--ink-2);background:none;border:0;border-radius:7px;padding:8px 4px;cursor:pointer;transition:.12s;white-space:nowrap}
.gl-seg.gl-wrap{flex-wrap:wrap}.gl-seg.gl-wrap button{min-width:64px}
.gl-seg button:hover{color:var(--ink)}
.gl-seg button[aria-pressed=true]{background:var(--accent);color:#fff;box-shadow:0 1px 2px #0002}
.gl-field{display:flex;flex-direction:column;gap:8px;font:600 10.5px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3)}
.gl-field select{font:500 13px var(--sans);color:var(--ink);background:var(--panel-2);border:1px solid var(--line);border-radius:9px;padding:9px;cursor:pointer}
.gl-upload{font:600 13px var(--sans);color:#fff;background:var(--accent);border:0;border-radius:10px;padding:11px;cursor:pointer;width:100%}
.gl-upload:hover{filter:brightness(1.05)}
.gl-magic-note{font:11.5px var(--mono);color:var(--ink-2);line-height:1.5}
.gl-slider{display:flex;flex-direction:column;gap:6px}
.gl-slider-row{display:flex;justify-content:space-between;align-items:baseline;font-size:12.5px;color:var(--ink-2)}
.gl-slider-row b{font:600 12.5px var(--mono);color:var(--ink);font-variant-numeric:tabular-nums}
.gl-sizerow{display:flex;align-items:flex-end;gap:6px}.gl-sizerow-slider{flex:1;min-width:0}.gl-chev{width:26px;height:26px;margin-bottom:2px;display:grid;place-items:center;font-size:15px;line-height:1;color:var(--ink-2);background:var(--panel-2);border:1px solid var(--line);border-radius:7px;cursor:pointer}.gl-chev:active{background:var(--line)}
.gl-lock{width:30px;height:26px;display:grid;place-items:center;font-size:13px;line-height:1;background:var(--panel-2);border:1px solid var(--line);border-radius:6px;cursor:pointer}
.gl-num{display:inline-flex;align-items:center;gap:4px}
.gl-num input{width:54px;font:600 12.5px var(--mono);color:var(--ink);background:var(--panel-2);border:1px solid var(--line);border-radius:6px;padding:3px 6px;text-align:right;font-variant-numeric:tabular-nums}
.gl-num-wide input{width:84px}
.gl-num input:focus{outline:none;border-color:var(--accent)}
.gl-num i{font:600 11px var(--mono);font-style:normal;color:var(--ink-3)}
.gl-limits{display:flex;gap:6px}
.gl-limits select{flex:1;min-width:0}
.gl input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:4px;border-radius:4px;background:var(--line);outline:none}
.gl input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:17px;height:17px;border-radius:50%;background:var(--accent);border:2px solid var(--panel);box-shadow:0 1px 3px #0003;cursor:pointer}
.gl input[type=range]::-moz-range-thumb{width:17px;height:17px;border-radius:50%;background:var(--accent);border:2px solid var(--panel);cursor:pointer}
.gl-toggle{display:flex;justify-content:space-between;align-items:center;font-size:12.5px;color:var(--ink-2);cursor:pointer}
.gl-toggle input{width:17px;height:17px;accent-color:var(--accent)}
.gl-perf b{color:var(--pass);font-weight:700}
.gl-perf b.gl-slow{color:var(--fail)}
.gl-legend{display:flex;flex-direction:column;gap:7px;font:11.5px var(--sans);color:var(--ink-2);line-height:1.45}
.gl-legend div{display:flex;align-items:flex-start;gap:8px}
.gl-legend .gl-sw{margin-top:1px}
.gl-legend b{color:var(--ink);font-weight:700}
.gl-sw{flex:none;width:13px;height:13px;border-radius:50%;border:2px solid var(--ink-3);background:transparent}
.gl-sw-main{border-color:var(--pass);background:var(--pass)}
.gl-sw-dash{border-style:dashed;background:transparent!important}
.gl-snap{font:600 12px var(--mono);color:var(--ink-2);background:var(--panel-2);border:1px solid var(--line);border-radius:9px;padding:9px 11px}
.gl-stepper{display:flex;align-items:center;gap:4px;background:var(--panel-2);border:1px solid var(--line);border-radius:10px;padding:3px}
.gl-stepper button{flex:none;width:38px;height:34px;font:600 17px var(--sans);line-height:1;color:var(--ink-2);background:none;border:0;border-radius:7px;cursor:pointer;transition:.12s}
.gl-stepper button:hover:not(:disabled){background:var(--accent);color:#fff}
.gl-stepper button:disabled{opacity:.3;cursor:default}
.gl-stepper input{flex:1;min-width:0;text-align:center;font:700 15px var(--mono);color:var(--ink);background:none;border:0;padding:4px;font-variant-numeric:tabular-nums;-moz-appearance:textfield}
.gl-stepper input::-webkit-outer-spin-button,.gl-stepper input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.gl-stepper input:focus{outline:none}
.gl-steps{display:flex;flex-wrap:wrap;gap:5px}
.gl-steps button{display:flex;flex-direction:column;align-items:flex-start;gap:1px;font:550 11px var(--sans);color:var(--ink-2);
  background:var(--panel-2);border:1px solid var(--line);border-radius:8px;padding:6px 9px;cursor:pointer;transition:.12s}
.gl-steps button b{font:700 10.5px var(--mono);letter-spacing:.04em}
.gl-steps button span{font:600 11px var(--mono);font-variant-numeric:tabular-nums}
.gl-steps button:hover{color:var(--ink)}
.gl-steps button[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:#fff}
/* Library panel: equal-size chips that wrap into a grid, never a ragged strip. */
.gl-lib{display:grid;grid-template-columns:repeat(auto-fill,minmax(66px,1fr));gap:5px}
.gl-lib button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
  min-height:38px;padding:5px 4px;text-align:center;cursor:pointer;transition:.12s;
  background:var(--panel-2);border:1px solid var(--line);border-radius:9px;color:var(--ink-2)}
.gl-lib button b{font:700 12px var(--mono);letter-spacing:.02em;color:var(--ink)}
.gl-lib button span{font:600 9px var(--mono);font-variant-numeric:tabular-nums;color:var(--ink-3)}
.gl-lib button:hover{border-color:var(--ink-3)}
.gl-lib button[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:#fff}
.gl-lib button[aria-pressed=true] b,.gl-lib button[aria-pressed=true] span{color:#fff}
.gl-libsize{display:flex;align-items:center;gap:8px;padding:12px 14px;min-height:52px;flex-wrap:wrap}
.gl-libsize b{font:700 26px var(--mono);letter-spacing:.01em;color:var(--ink);font-variant-numeric:tabular-nums;line-height:1}
.gl-libsize span{font:600 11px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);line-height:1;align-self:center}
.gl-libdim{margin-left:auto;align-self:center;font:600 10px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);
  background:var(--panel-2);border:1px solid var(--line);border-radius:7px;padding:5px 8px;cursor:pointer;transition:.12s}
.gl-libdim[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:#fff}
.gl-camnum{display:inline-flex;align-items:baseline;gap:3px}
.gl-camnum input{width:86px;font:700 20px var(--mono);color:var(--ink);background:var(--panel-2);
  border:1px solid var(--line);border-radius:8px;padding:5px 8px;text-align:right;
  font-variant-numeric:tabular-nums;-moz-appearance:textfield}
.gl-camnum input::-webkit-outer-spin-button,.gl-camnum input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.gl-camnum i{font:600 12px var(--mono);color:var(--ink-3);font-style:normal}
.gl-camzoom{display:flex;gap:6px;margin-left:auto}
.gl-camzoom button{min-width:40px;height:36px;font:700 15px var(--mono);color:var(--ink-2);
  background:var(--panel-2);border:1px solid var(--line);border-radius:9px;cursor:pointer;transition:.12s}
.gl-camzoom button:hover{color:var(--ink);border-color:var(--ink-3)}
.gl-camzoom button:active{background:var(--accent);border-color:var(--accent);color:#fff}
.gl-libadd b{color:var(--ink-3);font-size:16px!important}
.gl-libedit{display:flex;align-items:center;gap:6px;margin-top:8px}
.gl-libedit input{flex:1;min-width:0;font:600 12px var(--mono);color:var(--ink);background:var(--panel-2);
  border:1px solid var(--line);border-radius:7px;padding:6px 8px}
.gl-libedit button{font:600 10px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2);
  background:var(--panel-2);border:1px solid var(--line);border-radius:7px;padding:6px 9px;cursor:pointer}
.gl-libedit button:disabled{opacity:.4;cursor:default}
.gl-libedit button:hover:not(:disabled){color:var(--ink)}
/* LIBRARY TAB ONLY — full-bleed canvas with the panel floating over it (scoped: .gl-libtab). */
.gl-libtab{max-width:none;display:block;position:relative;height:calc(100vh - 70px);
  width:100vw;margin-left:calc(50% - 50vw)}
.gl-libtab .gl-stage{height:100%;padding:0;border:0;background:none;box-shadow:none}
.gl-libtab .gl-vp{max-width:none;width:100%;height:100%;aspect-ratio:auto;border:0;border-radius:0;background:var(--panel)}
.gl-libtab .gl-vp svg{width:100%;height:100%;max-width:none;display:block}
.gl-libtab .gl-stage-head{position:absolute;inset:14px 14px auto;pointer-events:none;z-index:2}
.gl-libtab .gl-controls{position:absolute;top:14px;right:14px;width:300px;max-height:calc(100% - 28px);
  overflow:auto;display:flex;flex-direction:column;gap:10px;z-index:3}
.gl-libtab .gl-controls>*{backdrop-filter:blur(8px);background:color-mix(in srgb,var(--panel) 92%,transparent)}
.gl-libbar{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:12px;padding:8px 14px;
  width:100vw;margin-left:calc(50% - 50vw);background:color-mix(in srgb,var(--panel) 92%,transparent);
  backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.gl-libbar-mode{flex:none}
.gl-libbar-tabs{flex:1}
.gl-libbar .gl-seg button{padding:7px 14px}
/* BENCH TAB — the same full-bleed board with floating panels. Layout only: gestures,
   solver and readouts are untouched (scoped: .gl-benchtab). */
.gl-benchtab{max-width:none;display:block;position:relative;height:calc(100vh - 70px);
  width:100vw;margin-left:calc(50% - 50vw)}
.gl-benchtab .gl-stage{height:100%;padding:0;border:0;background:none;box-shadow:none}
.gl-benchtab .gl-vp{max-width:none;width:100%;height:100%;aspect-ratio:auto;border:0;border-radius:0;background:var(--panel)}
.gl-benchtab .gl-vp svg{width:100%;height:100%;max-width:none;display:block}
.gl-benchtab .gl-stage-head{position:absolute;inset:12px 12px auto;pointer-events:none;z-index:2}
.gl-benchtab .gl-controls{position:absolute;top:12px;right:12px;width:320px;max-height:calc(100% - 24px);
  overflow:auto;display:flex;flex-direction:column;gap:10px;z-index:3}
.gl-benchtab .gl-centercol{position:absolute;top:12px;left:12px;width:290px;max-height:calc(100% - 24px);
  overflow:auto;display:flex;flex-direction:column;gap:10px;z-index:3}
.gl-benchtab .gl-controls>*,.gl-benchtab .gl-centercol>*{backdrop-filter:blur(8px);
  background:color-mix(in srgb,var(--panel) 92%,transparent)}
`
