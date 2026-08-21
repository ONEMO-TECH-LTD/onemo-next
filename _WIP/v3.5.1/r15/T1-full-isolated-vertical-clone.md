# Magnetic Grid v3.5.1 — portable three-rule engine and live comparison tab build contract

Status: DRAFT FOR DAN REVIEW
Contract revision: R15 — full vertical Centre-rules clone in T1
Source baseline: `session62-task/grid-v3.5` at `8d17780c`
Scope: code reconstruction of the portable engine and live comparison tab only.

## 10. Engine and live-tab build sequence

Every semantic code change is one rollback commit and compiles/runs before the next code change. T1-T4 build the working code first. The optional §9 proof/audit work may follow after the build and does not authorize extra engine infrastructure. No push/merge/publication is implied.

### T1 — Full isolated vertical clone of Centre-rules

- Materialize the existing third **Law** selection as a full isolated vertical clone from the embedded `8d17780c` source: cloned visible bench/tab UI, controls, local state/defaults, request builder/newest-only queue, worker execution/caches/band/replay/prefetch path, rendered Stage/evidence surface, `positioning===1` branch and its complete dependency closure. The clone uses `LawPanel.tsx`, isolated `law.worker.ts`, isolated `src/lib/magnetic-grid/` runtime files and `magnetic-grid.compare.v1.*`; it never sends a request to or imports the current worker or current `grid-origin*` runtime.
- Use the existing three-way selector as the only page-level dispatch and add only the isolated `LawPanel` mount boundary. Voting and Centre-rules keep their original page subtree, state, request path, worker and modules byte-untouched. Selecting Centre-rules runs the frozen original; selecting Law runs the complete isolated clone. No new selector, fourth option or second page exists.
- Build and run the full vertical clone before structural moves. Confirm the Centre-rules and Law selections both load, the Law selection uses only its isolated request/worker/runtime, and the original still runs unchanged. The minimum frozen-snapshot equivalence in the build completion is mandatory; the broader matrix/pixel suite belongs to optional §9. No Voting-only or existing `positioning===2` body is copied.
- The cloned contour adapter accepts the shell's same already-loaded normalized contour and returns it unchanged with a content identity. Do not add Studio integration or alter current shape loaders.
- Label the isolated selection `Law · Centre clone`. Its description names Centre only; it must not claim Wrap or scaling.

#### T1 selector and state ownership

| Owner | Exact responsibility |
|---|---|
| existing `page.tsx` shell | owns only `selection: 0 | 1 | 2`, persists it under `magnetic-grid.compare.v1.surface`, and mounts one panel at a time; first initialization may map frozen `grid-origin.positioning` 0/1 to the same selection and maps legacy 2 to Centre-rules 1. It owns no shape, contour, size, engine control, worker or result state |
| legacy comparator component inside `page.tsx` | receives `positioning: 0 | 1`, owns every other original `grid-origin.*` persisted state, Voting/Centre-rules controls, original request queue/worker and original rendered model; all bodies remain donor-identical except the named positioning prop/selector callback extraction |
| `LawPanel.tsx` | owns an independent copy of shape/source selection, size/band/manual/display state, Centre controls, defaults, request queue, model and Stage rendering; persistence uses only `magnetic-grid.compare.v1.*` and never reads `grid-origin.*` after initialization from donor defaults |
| `law.worker.ts` | owns only the isolated clone's request execution, caches, band replay and prefetch until T4 replaces them |
| temporary Law runtime | owns the extracted `positioning===1` engine path and complete reached dependency closure; it accepts no `positioning` or `votingOrder` field |

The comparison is selector-based, not simultaneous: only one panel/worker is mounted at a time. The shell passes only `{ positioning: 0 | 1, onSelect(positioning: 0 | 1 | 2): void }` to the legacy panel and `{ onSelect(positioning: 0 | 1 | 2): void }` to `LawPanel`; no contour, engine control, request, result or cache object crosses that boundary.

#### T1 closed ADAPT-EXTRACT map

| Frozen source region | T1 destination | Disposition |
|---|---|---|
| `page.tsx:1-34` | `LawPanel.tsx` imports/constants/types | `ADAPT-EXTRACT`: substitute isolated imports and component name only |
| `page.tsx:35-44` | `LawPanel.tsx` persisted helper | `ADAPT-EXTRACT`: substitute `magnetic-grid.compare.v1.*` prefix only |
| `page.tsx:46-273` | `LawPanel.tsx` complete local state, shape/source preparation, model, queue and request builder | copy all reached bodies; remove `positioning`/`votingOrder` state and fields; set isolated Centre-clone engine identity; change worker URL only |
| `page.tsx:274-537` | `LawPanel.tsx` complete visible bench/control rendering | copy all reached JSX; `474-489` becomes selector callback + truthful Centre-clone label; exclude Voting-only `522-532` |
| `page.tsx:539-879` | `LawPanel.tsx` Stage, evidence rendering, helpers and CSS | `MOVE-VERBATIM` |
| `page.tsx:46-537` | existing `page.tsx` legacy component + new mount shell | move `positioning` selection to the shell prop, replace the three selector handlers with `onSelect`, and add the one-panel mount; every other legacy state/request/render body remains unchanged |
| `solve.worker.ts:1-150` | isolated `law.worker.ts` | copy request/caches/band/replay/prefetch/onmessage; substitute imports and engine identity; preserve positioning-1 branches at `78-80` and `126-128`, including `seatMarginMM`; exclude positioning-2 alternatives |
| `grid-origin.ts:1-143` | temporary Law runtime types/shared helpers | copy reached imports/types plus `parityHolds`; exclude Voting-only imports/fields |
| `grid-origin.ts:145-220` + `329-352` | temporary Centre-clone `computeGrid` | `ADAPT-EXTRACT`: preserve prelude, analytic-circle predicate, `seatMarginMM`, `safeSegments`, governed centre, manual branch, full `positioning===1` branch, coverage/result assembly; remove the mode switch and set Centre-clone identity |
| `grid-origin.ts:221-328` | no destination | `EXCLUDE`: existing Law and Voting branches |
| `grid-origin.ts:354-483` | temporary Centre-clone band/Auto path | copy reached Centre-rules behavior, including sampled walk/tolerance and seat inflation, unchanged through T2 |
| `grid-origin-spec.ts:1-98` | temporary Law spec | copy reached constants/types; exclude Voting weights/order and `POSITIONING`; preserve circle, flap, phase, mass, governor, band and seat-margin dependencies used by the clone |
| `grid-origin-compute.ts:1-585` | temporary Law compute | copy complete file because the reached Centre-rules page/engine/bridge closure uses its seat, circle, lattice, ruler, contact, belt and contour helpers; no helper is repaired in T1/T2 |
| `grid-origin-logic.ts:1-15` | temporary Law logic imports | `ADAPT-EXTRACT`: retain only imports reached by the copied logic ranges; exclude Voting weights/order |
| `grid-origin-logic.ts:17-26`, `43-105`, `126-149` | temporary Law logic | copy `bandOf`, types, `governMass`, `centeringAnchors`, coverage and sizing; exclude Voting `28-40` score bodies and unused `centeringRef:107-124` |
| `grid-origin-bridge.ts:1-108` | temporary Law bridge | `MOVE-VERBATIM` except isolated import paths |

This extraction map is closed before T1 starts. No new source row, state owner, request field, helper or result field may be discovered or added during implementation without revising R15 first.

Build completion: the full isolated Law clone compiles and runs in the existing third selection; Centre-rules still compiles and runs in its original selection; the clone has its own request/worker/cache/runtime and no legacy runtime edge; the same frozen input/config snapshot returns the same Centre-rules result record and rendered Centre evidence in both selections; no re-room, ruler repair, Wrap or scaling code exists yet. Commit this working state before T2.

#### T1 frozen vertical donor snapshot — `8d17780c`

The Centre-rules donor is `src/app/(dev)/effect-creator/grid-origin/**` plus `src/lib/effect/grid-origin*`. The separate Session 59 `src/app/(dev)/effect-creator/grid-lab/**` workbench has no Voting/Centre-rules/Law positioning switch and is not a donor for this clone.

The files below are copied byte-for-byte from `8d17780cb0efb5db896f9ac62d03b01d6bbed89b`. They are the complete source available to execute the T1 full vertical clone without hunting elsewhere. The disposition table controls which bodies enter Law: Voting-only and existing `positioning===2` bodies remain excluded even though their surrounding source file is reproduced for exact context.

| Frozen donor file | SHA-256 |
|---|---|
| `src/app/(dev)/effect-creator/grid-origin/page.tsx` | `515603b5ca2a4e13df24b24789e2f7828556bd9038d846aed9274b1cf3bcf1cf` |
| `src/app/(dev)/effect-creator/grid-origin/solve.worker.ts` | `0352f320cfeeb89cea7634b3d186cba4c5d50cf7329d6d49a0bf628d3fa17e0c` |
| `src/lib/effect/grid-origin.ts` | `4afa144c7be468f94a9e6efc2f4b5c64c3ee1430c0963dac5a24c3afdea06fe7` |
| `src/lib/effect/grid-origin-spec.ts` | `bc8df2bc297f76a7e1f4dd4964b0582f5dd1cb9e0e45bd989870d11eb00fe9e6` |
| `src/lib/effect/grid-origin-compute.ts` | `44b5144fb493284d28be3fff6c82c1be93ff8be90bad052ba6fa0569f6ab90fc` |
| `src/lib/effect/grid-origin-logic.ts` | `bc317ef497bbcf19d0fdd9ae56431bd9ab5aab4ded470b363008e010de54659e` |
| `src/lib/effect/grid-origin-bridge.ts` | `4878c9934c31f8ba54fd4c7cad7b7ac4a3552eb34da268321f6906db97a14eb0` |

##### `src/app/(dev)/effect-creator/grid-origin/page.tsx`

```tsx
'use client'

// grid-origin — the v3.5 magnetic-grid bench (2D vector).
// ALL engine shape sources through contourFromShape → computeGrid, rendered true-to-scale:
//   • Presets    — shape-library getShape() (baked vector data)
//   • Generators — generateShapeRing() (blob / clover / daisy / pinwheel)
//   • AI Magic   — image upload → prepareShaped() → u2netp lightweight cut-out → outline

import { useEffect, useMemo, useRef, useState } from 'react'
import { getShape, hasVectorDef, type VectorShapeKind } from '@/lib/shape-library'
import { type VShape } from '@/lib/vector-core'
import { generateShapeRing, type ShapeKind } from '../v5.3.1/user/shapes'
import { loadImage, prepareShaped } from '../v5.3.1/core/primitives'
import type { Contour, Pt } from '@/lib/effect/types'
import { DEFAULT_PITCH_MM, type BandSnapPoint, type GridResult, type MagnetPlan, type SafeSegment } from '@/lib/effect/grid-origin'
import { BANDS, CENTRE_MODE, FLAP_CEIL_MM, FLAP_FLOOR_MM, FLAP_MM, GOVERNOR, MASS_DEPTH_CEIL_MM, MASS_DEPTH_FLOOR_MM, MASS_DEPTH_MM, MIN_EFFECT_MM, PADDING_CEIL_MM, PADDING_FLOOR_MM, PHASE_STEP_FLOOR_MM, PHASE_STEP_MM, POSITIONING, RELEASED_PADDING_MM, RELEASED_PITCHES_MM, SNAP_STEP_MM, VOTING_ORDER } from '@/lib/effect/grid-origin-spec'
import { fieldSpots, normBaseContour, normGeneratedRing, normMaskContour, seatedSpots, sizeRange, type FieldSpot } from '@/lib/effect/grid-origin-bridge'

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
    const raw = localStorage.getItem('grid-origin.' + key)
    if (raw !== null && Number.isFinite(+raw)) setV(+raw)
  }, [key])
  const set = (n: number) => { setV(n); try { localStorage.setItem('grid-origin.' + key, String(n)) } catch { } }
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
  const [sizeMM, setSizeMM] = useState(BANDS[1].minMM)
  /** Free-slider limits — typed, persisted across reloads. */
  const [sizeMin, setSizeMin] = usePersisted('sizeMin', MIN_EFFECT_MM)
  const [sizeMax, setSizeMax] = usePersisted('sizeMax', sizeRange(RELEASED_PADDING_MM).maxMM)
  const [pitch, setPitch] = useState(DEFAULT_PITCH_MM)
  const [pad, setPad] = usePersisted('pad', RELEASED_PADDING_MM)
  /** Flap allowance dial — how far material may reach past a spot's edge; 0 = edge-to-edge wrap. */
  const [flap, setFlap] = usePersisted('flap', FLAP_MM)
  /** Auto flap micro-module — the flap dial becomes the RANGE: auto works within it. */
  const [autoFlapN, setAutoFlapN] = usePersisted('autoFlap', 0)
  /** Placement step dial — how finely the lattice slides under the shape; 1 = continuous panning. */
  const [phaseStep, setPhaseStep] = usePersisted('phaseStep', PHASE_STEP_MM)
  /** Mass depth dial — clearance a region must survive to count as a mass for centring. */
  const [massDepth, setMassDepth] = usePersisted('massDepth', MASS_DEPTH_MM)
  /** Centre-mode switch — which centre drives anchoring and balance. */
  const [centreMode, setCentreMode] = usePersisted('centreMode', CENTRE_MODE)
  /** Positioning law — voting vs centre-rules (parity-locked, no voting). */
  const [positioning, setPositioning] = usePersisted('positioning', POSITIONING)
  /** Governor — which mass rules in Masses mode. */
  const [governor, setGovernor] = usePersisted('governor', GOVERNOR)
  /** Voting dominance order — which force rules the placement vote. */
  const [votingOrder, setVotingOrder] = usePersisted('votingOrder', VOTING_ORDER)
  const [offsetMM, setOffsetMM] = useState(0)
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
  const [mode, setMode] = useState<number | 'free'>('free')
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
  const [enFlapN, setEnFlapN] = usePersisted('en.flap', 1)
  const [enPhaseN, setEnPhaseN] = usePersisted('en.phaseStep', 1)

  /** Baseline handling: "save" stamps the current dials as the working default; "reset" restores
   *  the saved baseline, or spec defaults when none was saved. */
  const saveDefaults = () => {
    try { localStorage.setItem('grid-origin.defaults', JSON.stringify({ pad, flap, phaseStep, massDepth, centreMode, positioning, governor, votingOrder, snapStep, sizeMin, sizeMax })) } catch { }
  }
  const resetDefaults = () => {
    let d = {
      pad: RELEASED_PADDING_MM, flap: FLAP_MM, phaseStep: PHASE_STEP_MM, massDepth: MASS_DEPTH_MM, centreMode: CENTRE_MODE, positioning: POSITIONING, governor: GOVERNOR, votingOrder: VOTING_ORDER, snapStep: SNAP_STEP_MM,
      sizeMin: MIN_EFFECT_MM, sizeMax: sizeRange(RELEASED_PADDING_MM).maxMM,
    }
    try { const raw = localStorage.getItem('grid-origin.defaults'); if (raw) d = { ...d, ...JSON.parse(raw) } } catch { }
    setPad(d.pad); setFlap(d.flap); setPhaseStep(d.phaseStep); setMassDepth(d.massDepth); setCentreMode(d.centreMode); setPositioning(d.positioning); setGovernor(d.governor); setVotingOrder(d.votingOrder); setSnapStep(d.snapStep); setSizeMin(d.sizeMin); setSizeMax(d.sizeMax)
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
    fetch('/effect-creator/grid-origin/asset-lib?dir=raw').then((r) => r.json()).then((f) => Array.isArray(f) && setLibRaw(f)).catch(() => { })
    fetch('/effect-creator/grid-origin/asset-lib?dir=cut').then((r) => r.json()).then((f) => Array.isArray(f) && setLibCut(f)).catch(() => { })
  }, [])
  async function loadLib(name: string) {
    setSrc('magic'); setMagStatus('cutting')
    try {
      const res = await fetch('/effect-creator/grid-origin/asset-lib/' + encodeURIComponent(name) + '?dir=raw')
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
      const res = await fetch('/effect-creator/grid-origin/asset-lib/' + encodeURIComponent(name) + '?dir=cut')
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
  type Model = { contour: Contour; grid: GridResult; effSize: number; ladder: BandSnapPoint[]; idx: number; segments: SafeSegment[]; autoFlapMM?: number | null }
  const [model, setModel] = useState<Model | null>(null)
  const [solving, setSolving] = useState(false)
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
    const cfg = { pitchMM: pitch, paddingMM: pad, ...(enFlapN ? { flapMM: flap } : {}), ...(enPhaseN ? { phaseStepMM: phaseStep } : {}), massDepthMM: massDepth, centreMode, positioning, governor, votingOrder, forcePhaseMM: manual ? [manual.x, manual.y] as Pt : undefined, plan, perimeterOnly: coverage === 'perimeter', circle: src === 'preset' && preset === 'circle' && offsetMM === 0 }
    // Manual in a band (forced registration OR manual band scale): the walk is meaningless —
    // solve that size directly, exactly like free mode, band chip stays active.
    const manualBand = mode !== 'free' && (manual !== null || bandScale !== null)
    const id = ++seqRef.current
    const msg = {
      id, base, offsetMM, cfg,
      mode: manualBand ? 'free' : mode,
      sizeMM: manualBand ? (bandScale ?? effSizeRef.current ?? sizeMM) : sizeMM,
      snapStep, stepSel,
      autoFlapMaxMM: autoFlapN ? (enFlapN ? flap : FLAP_MM) : null,
    }
    if (busyRef.current) { queuedRef.current = msg; setSolving(true); return }
    busyRef.current = true
    setSolving(true)
    solveSentAt.current = performance.now()
    w.postMessage(msg)
  }, [base, src, preset, sizeMM, pitch, pad, flap, phaseStep, massDepth, centreMode, positioning, governor, votingOrder, manual, bandScale, enFlapN, enPhaseN, autoFlapN, plan, mode, stepSel, snapStep, coverage, offsetMM])

  const scale = model ? (VP * FIT) / Math.max(dim(model.contour, 0), dim(model.contour, 1)) : 0
  const genDef = GENS.find((g) => g.k === gen) ?? GENS[0]

  return (
    <div className="gl">
      <style>{CSS}</style>
      <header className="gl-head">
        <h1>Magnetic Grid Lab <span className="gl-tag">v3.5</span></h1>
      </header>

      <div className="gl-body">
        <section className="gl-card gl-stage">
          <div className="gl-stage-head">
            <span className="gl-eye gl-perf">
              load <Sec ms={perf.loadMs} />
              {' · '}gen <Sec ms={perf.genMs} />
              {perf.cutMs != null ? <> · cut <Sec ms={perf.cutMs} /></> : null}
              {' · '}solve <Sec ms={perf.solveMs} />
            </span>
            <span className="gl-eye">{model ? `1mm = ${scale.toFixed(2)} px` : '—'}</span>
          </div>
          <div className="gl-vp">
            {solving && <div className="gl-solving"><span className="gl-spin" />solving…</div>}
            {model ? <Stage contour={model.contour} grid={model.grid} lattice={showLattice} box={showBox}
              segments={showSegs ? model.segments : []} segFill={segFillN !== 0}
              marginMM={model.autoFlapMM ?? (enFlapN ? flap : FLAP_MM)}
              onPan={(dx, dy) => setManual((m) => { const bx = m ? m.x : model.grid.phaseMM[0], by = m ? m.y : model.grid.phaseMM[1]; return { x: bx + dx, y: by + dy } })}
              onZoom={(f) => {
                // Pinch = manual scaling. In a band it scales WITHIN the band's range.
                if (mode === 'free') setSizeMM((s) => Math.min(sizeMax, Math.max(sizeMin, s * f)))
                else {
                  const b = BANDS.find((x) => x.id === mode)!
                  setBandScale((s) => Math.min(b.maxMM, Math.max(b.minMM, (s ?? effSizeRef.current ?? b.minMM) * f)))
                }
              }}
              onReset={() => setManual(null)} />
              : src === 'magic'
                ? <Empty text={magStatus.startsWith('error') ? magStatus.slice(6) : magStatus === 'downloading-model' ? 'Downloading the cut-out model…' : magStatus.startsWith('cutting') ? 'Cutting out the shape…' : 'Upload an image to cut its outline'} spin={magStatus === 'downloading-model' || magStatus.startsWith('cutting')} />
                : src === 'cut'
                  ? <Empty text={cutStatus.startsWith('error') ? cutStatus.slice(6) : cutStatus === 'tracing' ? 'Tracing the outline…' : 'Pick a cutout from the library'} spin={cutStatus === 'tracing'} />
                  : <Empty text="shape unavailable" />}
          </div>
        </section>

        <aside className="gl-controls">
          <Fold title="Shape source">
            <div className="gl-seg gl-seg3">
              <button aria-pressed={src === 'preset'} onClick={() => setSrc('preset')}>Presets</button>
              <button aria-pressed={src === 'gen'} onClick={() => setSrc('gen')}>Generators</button>
              <button aria-pressed={src === 'magic'} onClick={() => setSrc('magic')}>AI Magic</button>
              <button aria-pressed={src === 'cut'} onClick={() => setSrc('cut')}>Cutouts</button>
            </div>

            {src === 'preset' && <>
              <label className="gl-field"><span>Preset shape</span>
                <select value={preset} onChange={e => setPreset(e.target.value as VectorShapeKind)}>
                  {PRESETS.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </label>
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
              <label className="gl-field"><span>Cutout library · no AI, traced directly</span>
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

          <Fold title="Grid settings">
            <div className="gl-field"><span>Band · snap ladder</span>
              <div className="gl-seg">
                {BANDS.map((b) =>
                  <button key={b.id} aria-pressed={mode === b.id} onClick={() => { setMode(b.id); setStepSel(null); setManual(null); setBandScale(null) }}>B{b.id}</button>)}
                <button aria-pressed={mode === 'free'} onClick={() => { setMode('free'); setStepSel(null); setManual(null); setBandScale(null) }}>Free</button>
              </div>
            </div>
            {mode !== 'free' && <>
              <div className="gl-snap">
                {manual
                  ? 'manual calibration · double-click the canvas to return to auto'
                  : bandScale !== null
                    ? `manual scale · ${Math.round(bandScale)} mm — tap a step or the band chip to return${model && (model.grid.pressMM ?? 0) > 0.05 ? ` · wrap conceded ${model.grid.pressMM!.toFixed(1)}mm` : ''}`
                    : model
                    ? model.ladder.length
                      ? `Fit B${mode}-${model.idx + 1} · ${Math.round(model.effSize)} mm · ${model.grid.anchors.length}⌾ · ${model.ladder.length} holding layouts in band${(model.grid.pressMM ?? 0) > 0.05 ? ` · wrap conceded ${model.grid.pressMM!.toFixed(1)}mm` : ''}`
                      : 'nothing fully fits at this flap — best seated shown'
                    : '—'}
              </div>
              {model && model.ladder.length > 0 && <div className="gl-steps">
                {model.ladder.map((pt, i) =>
                  <button key={pt.sizeMM} aria-pressed={bandScale === null && i === model.idx} onClick={() => { setStepSel(i); setBandScale(null) }}>
                    <b>B{mode}-{i + 1}</b><span>{Math.round(pt.sizeMM)} mm · {pt.count}⌾</span>
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
            {mode === 'free' && <Slider label="Effect size · longest side" unit="mm" v={Math.round(sizeMM)} set={setSizeMM} min={sizeMin} max={sizeMax} />}
            {mode === 'free' && <div className="gl-field"><span>Slider limits</span>
              <div className="gl-limits">
                <span className="gl-num"><i>min</i>
                  <input key={'mn' + sizeMin} type="number" defaultValue={sizeMin}
                    onBlur={(e) => { const n = Math.round(+e.currentTarget.value); if (Number.isFinite(n) && n > 0 && n < sizeMax) { setSizeMin(n); if (sizeMM < n) setSizeMM(n) } }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} /></span>
                <span className="gl-num"><i>max</i>
                  <input key={'mx' + sizeMax} type="number" defaultValue={sizeMax}
                    onBlur={(e) => { const n = Math.round(+e.currentTarget.value); if (Number.isFinite(n) && n > sizeMin) { setSizeMax(n); if (sizeMM > n) setSizeMM(n) } }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} /></span>
              </div>
            </div>}
            <div className="gl-field"><span>Grid pitch · released tiers</span>
              <div className="gl-seg">
                {RELEASED_PITCHES_MM.map(({ mm, label }) =>
                  <button key={mm} aria-pressed={pitch === mm} onClick={() => setPitch(mm)}>{label}</button>)}
              </div>
            </div>
            <Slider label="Magnet padding · per spot" unit="mm" v={pad} set={setPad} min={PADDING_FLOOR_MM} max={PADDING_CEIL_MM} />
            <LabRow on={enFlapN !== 0} set={(b) => setEnFlapN(b ? 1 : 0)}>
              <Slider label={autoFlapN ? 'Flap allowance · auto works within this' : 'Flap allowance · past spot edge'} unit="mm" v={flap} set={setFlap} min={FLAP_FLOOR_MM} max={FLAP_CEIL_MM} />
            </LabRow>
            <label className="gl-toggle"><span>Auto flap <small style={{ color: 'var(--ink-3)' }}>· {mode === 'free' ? 'shows what this size implies' : 'band grants only what it needs'}{autoFlapN && model?.autoFlapMM != null ? ` — ${mode === 'free' ? 'implies' : 'chose'} ${model.autoFlapMM}mm` : ''}</small></span>
              <input type="checkbox" checked={autoFlapN !== 0} onChange={(e) => setAutoFlapN(e.target.checked ? 1 : 0)} />
            </label>
            <div className={positioning !== 0 ? 'gl-lab-off' : undefined}
              title={positioning !== 0 ? 'inactive — nothing slides in a derived mode' : undefined}>
              <LabRow on={enPhaseN !== 0} set={(b) => setEnPhaseN(b ? 1 : 0)}>
                <Slider label="Placement step · grid slide" unit="mm" v={phaseStep} set={setPhaseStep} min={PHASE_STEP_FLOOR_MM} max={MIN_EFFECT_MM} />
              </LabRow>
            </div>
            <Slider label="Outline offset · grow / shrink" unit="mm" v={offsetMM} set={setOffsetMM} min={-15} max={15} />
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
        </aside>

        <aside className="gl-centercol">
          <Fold title="Centering">
            <div className="gl-field"><span>Positioning · how the centre is applied</span>
              <div className="gl-seg">
                <button aria-pressed={positioning === 0} onClick={() => setPositioning(0)}>Voting</button>
                <button aria-pressed={positioning === 1} onClick={() => setPositioning(1)}>Centre rules</button>
                <button aria-pressed={positioning === 2} onClick={() => setPositioning(2)}>Law</button>
              </div>
            </div>
            <div className="gl-magic-note">
              {positioning === 0
                ? 'Voting — magnets, coverage and centring compete across every grid slide.'
                : positioning === 1
                  ? 'Centre rules — the grid locks onto the centre by parity (node or gap ON it); magnets only pick among the 4 parity slides. No voting.'
                  : 'LAW — three equal rigid rules, no scoring: centre held by parity, every belt disc pressed within the flap tolerance, size snaps only where another magnet joins. Vertical beats horizontal.'}
            </div>
            <div className="gl-field"><span>Centre mode · what the grid aims at</span>
              <div className="gl-seg gl-wrap">
                {([[0, 'Box'], [1, 'Core'], [2, 'Masses'], [3, 'Weight'], [4, 'Deep'], [5, 'Top']] as [number, string][]).map(([m, l]) =>
                  <button key={m} aria-pressed={centreMode === m} onClick={() => setCentreMode(m)}>{l}</button>)}
              </div>
            </div>
            <div className="gl-magic-note">
              {centreMode === 0 ? 'Box — the bounding box centre; ignores where the material is.'
                : centreMode === 1 ? 'Core — the centre of the whole 12mm legal area, area-weighted.'
                  : centreMode === 2 ? 'Masses — adaptive: every mass centre anchors; the smallest mass holding a magnet governs.'
                    : centreMode === 3 ? 'Weight — the material centroid of the silhouette.'
                      : centreMode === 4 ? 'Deep — the single most buried point of the shape.'
                        : 'Top — the highest mass governs (gravity rule).'}
            </div>
            {centreMode === 2 && <div className="gl-field"><span>Governor · which mass rules</span>
              <div className="gl-seg gl-wrap">
                {([[0, 'Smallest'], [1, 'Deepest'], [2, 'Top'], [3, 'Top-small']] as [number, string][]).map(([g, l]) =>
                  <button key={g} aria-pressed={governor === g} onClick={() => setGovernor(g)}>{l}</button>)}
              </div>
            </div>}
            {(centreMode === 2 || centreMode === 5) &&
              <Slider label="Mass depth · clearance to count" unit="mm" v={massDepth} set={setMassDepth} min={MASS_DEPTH_FLOOR_MM} max={MASS_DEPTH_CEIL_MM} />}
            <div className="gl-legend">
              <div><i className="gl-sw gl-sw-main" /><span><b>Main centre</b> · governs the winning layout</span></div>
              <div><i className="gl-sw" style={{ borderColor: SEG_HUES[0], background: SEG_HUES[0] + '22' }} /><span><b>Island S1</b> · smallest legal area</span></div>
              <div><i className="gl-sw" style={{ borderColor: SEG_HUES[1], background: SEG_HUES[1] + '22' }} /><span><b>Island S2</b> · next larger, per colour</span></div>
              <div><i className="gl-sw gl-sw-dash" style={{ borderColor: SEG_HUES[0] }} /><span><b>Mass at depth</b> · the island&apos;s solid core</span></div>
            </div>
            <label className="gl-toggle"><span>Fill islands <small style={{ color: 'var(--ink-3)' }}>· coloured inner area</small></span>
              <input type="checkbox" checked={segFillN !== 0} onChange={(e) => setSegFillN(e.target.checked ? 1 : 0)} />
            </label>
          </Fold>
          {positioning === 0 && <Fold title="Voting law">
            <div className="gl-magic-note">
              Magnet count always governs. Between equal counts the order decides: Wrap presses every disc against the edge; Centring holds the centre. The flap dial is the rigid law — a layout with a disc floating past it is not shown (Auto adapts instead).
            </div>
            <div className="gl-field"><span>Priority · which force rules</span>
              <select value={votingOrder} onChange={(e) => setVotingOrder(+e.target.value)}>
                <option value={0}>Magnets &gt; Wrap &gt; Centring (default)</option>
                <option value={1}>Magnets &gt; Centring &gt; Wrap</option>
              </select>
            </div>
          </Fold>}
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

function Stage({ contour, grid, lattice, box, segments, segFill, marginMM, onPan, onZoom, onReset }: {
  contour: Contour; grid: GridResult; lattice: boolean; box: boolean; segments: SafeSegment[]; segFill: boolean
  marginMM: number
  onPan: (dxMM: number, dyMM: number) => void; onZoom: (f: number) => void; onReset: () => void
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
      if (e.ctrlKey) { onZoom(Math.exp(-e.deltaY * 0.01)); return }
      setPend((p) => ({ x: p.x - e.deltaX / k, y: p.y + e.deltaY / k }))
      if (wheelTimer.current) clearTimeout(wheelTimer.current)
      wheelTimer.current = setTimeout(commit, 250)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  // Widen the viewBox to the frame at the same scale — the shape keeps its 86% size.
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
  const spanMM = VP / S
  const vx = cx - spanMM / 2, vy = cy - spanMM / 2

  // Spots come from the bridge; the toggle picks field vs seated. This file draws circles.
  const spots: readonly FieldSpot[] = lattice
    ? fieldSpots(grid, { minX: vx, minY: -(vy + spanMM), maxX: vx + spanMM, maxY: -vy })
    : seatedSpots(grid)
  // Rule anchor: any spot is on the lattice, so lines cross at the centres.
  const A0 = spots[0]
  const Afy: [number, number] = A0 ? [A0.x, -A0.y] : [0, 0]

  return (
    <svg ref={svgRef} width={VP} height={VP} viewBox={`${vx} ${vy} ${spanMM} ${spanMM}`}
      style={{ cursor: dragAt.current ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none' }}
      onPointerDown={(e) => { dragAt.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture?.(e.pointerId) }}
      onPointerMove={(e) => {
        if (!dragAt.current) return
        const k = pxPerMM(e.currentTarget)
        const mx = (e.clientX - dragAt.current.x) / k, my = (e.clientY - dragAt.current.y) / k
        dragAt.current = { x: e.clientX, y: e.clientY }
        setPend((p) => ({ x: p.x + mx, y: p.y - my }))
      }}
      onPointerUp={() => { dragAt.current = null; commit() }}
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
      <rect x={vx} y={vy} width={spanMM} height={spanMM} fill="var(--panel)" />
      {/* Grid-anchored layers shift as one rigid body while a manual gesture is live. */}
      <g transform={pend.x || pend.y ? `translate(${pend.x} ${-pend.y})` : undefined}>
        <rect x={vx - Math.abs(pend.x)} y={vy - Math.abs(pend.y)} width={spanMM + 2 * Math.abs(pend.x)} height={spanMM + 2 * Math.abs(pend.y)} fill="url(#gl-fine)" />
        <rect x={vx - Math.abs(pend.x)} y={vy - Math.abs(pend.y)} width={spanMM + 2 * Math.abs(pend.x)} height={spanMM + 2 * Math.abs(pend.y)} fill="url(#gl-pitch)" />
        <rect x={vx - Math.abs(pend.x)} y={vy - Math.abs(pend.y)} width={spanMM + 2 * Math.abs(pend.x)} height={spanMM + 2 * Math.abs(pend.y)} fill="url(#gl-dots)" />
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
        const fs = 11 * spanMM / VP
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
          {/* The allowance made visible — the invisible margin every disc wears under the
              contact law. The edge pressing against THIS ring is what the engine calls fit. */}
          {sp.held && marginMM > 0 &&
            <circle cx={sp.x} cy={-sp.y} r={sp.r + marginMM} fill="var(--mag8)" fillOpacity={0.05}
              stroke="var(--mag8)" strokeOpacity={0.55} strokeWidth={0.4} strokeDasharray="2.4 1.8" />}
        </g>
      })}
      {grid.anchors.map((a, i) => {
        const p = fy(a.p)
        return <g key={'a' + i} opacity={0.5}>
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
.gl-steps{display:flex;flex-wrap:wrap;gap:5px}
.gl-steps button{display:flex;flex-direction:column;align-items:flex-start;gap:1px;font:550 11px var(--sans);color:var(--ink-2);
  background:var(--panel-2);border:1px solid var(--line);border-radius:8px;padding:6px 9px;cursor:pointer;transition:.12s}
.gl-steps button b{font:700 10.5px var(--mono);letter-spacing:.04em}
.gl-steps button span{font:600 11px var(--mono);font-variant-numeric:tabular-nums}
.gl-steps button:hover{color:var(--ink)}
.gl-steps button[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:#fff}
`
```

##### `src/app/(dev)/effect-creator/grid-origin/solve.worker.ts`

```ts
// solve.worker.ts — runs the grid solve off the main thread. Pure dispatch: the same
// bridge/engine calls the page used to make inline, nothing computed here.

import { autoFlapInBand, BANDS, computeGrid, FLAP_MM, fitSizeInBand, impliedFlapMM, type GridConfig, type GridResult } from '@/lib/effect/grid-origin'
import { makeSizer } from '@/lib/effect/grid-origin-bridge'
import type { Contour } from '@/lib/effect/types'

interface SolveRequest {
  id: number
  base: Contour
  offsetMM: number
  cfg: GridConfig
  mode: number | 'free'
  sizeMM: number
  snapStep: number
  stepSel: number | null
  /** Auto-flap micro-module: when set, bands scan the allowance from 0 up to this max. */
  autoFlapMaxMM?: number | null
}

const ctx = self as unknown as Worker

// Computed once = computed. Per-size solves are keyed by shape + config and reused across
// free-slider moves, manual band scaling, re-walks and the idle prefetcher; a new shape
// clears everything.
let shapeSig = ''
const freeCache = new Map<string, { contour: Contour; grid: GridResult }>()
const walkCaches = new Map<string, Map<number, GridResult>>()
const walkFits = new Map<string, { fit: ReturnType<typeof fitSizeInBand>; autoFlapMM: number | null }>()
const FREE_CAP = 400
const WALK_CAP = 10
const FITS_CAP = 12

function sizeCacheOf(sig: string): Map<number, GridResult> {
  let m = walkCaches.get(sig)
  if (!m) {
    m = new Map()
    walkCaches.set(sig, m)
    if (walkCaches.size > WALK_CAP) walkCaches.delete(walkCaches.keys().next().value!)
  }
  return m
}

/** The one band-solve routine — the click path and the prefetcher share it byte for byte. */
function bandFit(
  sized: (mm: number) => Contour, cfg: GridConfig, cfgSig: string,
  bandId: number, snapStep: number, autoFlapMaxMM: number | null,
): { fit: ReturnType<typeof fitSizeInBand>; autoFlapMM: number | null } {
  const key = JSON.stringify([cfgSig, bandId, snapStep, autoFlapMaxMM])
  const hit = walkFits.get(key)
  if (hit) return hit
  const band = BANDS.find((b) => b.id === bandId) ?? BANDS[0]
  let out: { fit: ReturnType<typeof fitSizeInBand>; autoFlapMM: number | null }
  if (autoFlapMaxMM != null) {
    const cacheFor = (f: number) => sizeCacheOf(JSON.stringify({ ...cfg, flapMM: f }))
    const auto = autoFlapInBand(sized, cfg, band.minMM, snapStep, autoFlapMaxMM, cacheFor)
    out = { fit: auto.fit, autoFlapMM: auto.flapMM }
  } else {
    out = { fit: fitSizeInBand(sized, { ...cfg, solveCache: sizeCacheOf(cfgSig) }, band.minMM, snapStep), autoFlapMM: null }
  }
  walkFits.set(key, out)
  if (walkFits.size > FITS_CAP) walkFits.delete(walkFits.keys().next().value!)
  return out
}

// Idle prefetch — between interactions the worker warms every band for the current shape and
// dials, one size per macrotask so a real request always interrupts within one solve.
let gen = 0
function schedulePrefetch(
  myGen: number, sized: (mm: number) => Contour, cfg: GridConfig, cfgSig: string,
  snapStep: number, autoFlapMaxMM: number | null,
): void {
  const walkFlap = autoFlapMaxMM != null ? 0 : Math.max(0, cfg.flapMM ?? FLAP_MM)
  const walkBase: GridConfig = autoFlapMaxMM != null ? { ...cfg, flapMM: 0 } : cfg
  const walkSig = autoFlapMaxMM != null ? JSON.stringify(walkBase) : cfgSig
  // Must mirror bandWalk's construction EXACTLY — a prefetched solve with the wrong margin
  // poisons the shared cache (LAW mode carries no seat inflation; wrap law alone gates).
  const walkCfg: GridConfig = (cfg.positioning ?? 0) === 2
    ? { ...walkBase, segmentsDetail: 'light' }
    : { ...walkBase, segmentsDetail: 'light', seatMarginMM: walkFlap }
  const cache = sizeCacheOf(walkSig)
  const sizes: number[] = []
  for (const b of BANDS) for (let mm = b.minMM; mm <= b.maxMM; mm += Math.max(1, snapStep)) if (!cache.has(mm)) sizes.push(mm)
  let i = 0
  const bandsLeft = BANDS.map((b) => b.id)
  const step = () => {
    if (myGen !== gen) return
    if (i < sizes.length) {
      const mm = sizes[i++]
      if (!cache.has(mm)) cache.set(mm, computeGrid(sized(mm), walkCfg))
      setTimeout(step, 0)
      return
    }
    const bandId = bandsLeft.shift()
    if (bandId === undefined) return
    bandFit(sized, cfg, cfgSig, bandId, snapStep, autoFlapMaxMM)
    setTimeout(step, 0)
  }
  setTimeout(step, 0)
}

ctx.onmessage = (e: MessageEvent<SolveRequest>) => {
  const { id, base, offsetMM, cfg, mode, sizeMM, snapStep, stepSel, autoFlapMaxMM } = e.data
  gen++
  try {
    const sized = makeSizer(base, offsetMM)
    const pts = base.outer.pts
    // Full-content hash — sampling (length + two points) collided across shapes (F2, Meta QA).
    let h = 0
    for (let i = 0; i < pts.length; i++) {
      h = (Math.imul(h, 31) + Math.round(pts[i][0] * 1000)) | 0
      h = (Math.imul(h, 31) + Math.round(pts[i][1] * 1000)) | 0
    }
    const sig = JSON.stringify([offsetMM, pts.length, h])
    if (sig !== shapeSig) { shapeSig = sig; freeCache.clear(); walkCaches.clear(); walkFits.clear() }
    const cfgSig = JSON.stringify(cfg)
    if (mode !== 'free') {
      const { fit, autoFlapMM } = bandFit(sized, cfg, cfgSig, mode, snapStep, autoFlapMaxMM ?? null)
      const idx = fit.ladder.length ? Math.min(stepSel ?? fit.pickIdx, fit.ladder.length - 1) : 0
      const eff = fit.ladder.length ? fit.ladder[idx].sizeMM : fit.sizeMM
      // A stepped rung renders the layout that QUALIFIED it: reach AND margin at the
      // auto-chosen allowance, never the dial (F1 — Meta QA, verified).
      const effFlap = Math.max(0, autoFlapMM ?? cfg.flapMM ?? 0)
      // LAW carries no seat inflation anywhere (Meta F3) — a clicked rung must render the
      // exact layout that qualified it.
      const grid = eff === fit.sizeMM ? fit.grid : computeGrid(sized(eff), (cfg.positioning ?? 0) === 2
        ? { ...cfg, flapMM: effFlap }
        : { ...cfg, flapMM: effFlap, seatMarginMM: effFlap })
      const contour = sized(eff)
      ctx.postMessage({ id, model: { contour, grid, effSize: eff, ladder: fit.ladder, idx, segments: grid.segments, autoFlapMM } })
    } else {
      const k = cfgSig + '|' + sizeMM
      let hit = freeCache.get(k)
      if (!hit) {
        const contour = sized(sizeMM)
        hit = { contour, grid: computeGrid(contour, cfg) }
        freeCache.set(k, hit)
        if (freeCache.size > FREE_CAP) freeCache.delete(freeCache.keys().next().value!)
      }
      // Free-mode auto flap: report the allowance THIS size implies — the binding disc gap.
      const freeAuto = autoFlapMaxMM != null
        ? Math.min(autoFlapMaxMM, Math.round(impliedFlapMM(hit.contour.outer.pts, hit.grid.anchors.map((a) => a.p), hit.grid.spotRadiusMM)))
        : null
      ctx.postMessage({ id, model: { contour: hit.contour, grid: hit.grid, effSize: sizeMM, ladder: [], idx: 0, segments: hit.grid.segments, autoFlapMM: freeAuto } })
    }
    schedulePrefetch(gen, sized, cfg, cfgSig, snapStep, autoFlapMaxMM ?? null)
  } catch (err) {
    ctx.postMessage({ id, model: null, error: String((err as Error)?.message ?? err) })
  }
}
```

##### `src/lib/effect/grid-origin.ts`

```ts
// grid-origin.ts — the engine bridge: computeGrid and the band snap, wiring spec + compute + logic.
// One import door for consumers; the modules stay behind it.

import type { Contour, Pt } from './types'
import {
  BANDS,
  CENTRE_MODE,
  DEFAULT_PITCH_MM,
  FLAP_MM,
  GOVERNOR,
  AUTO_FLAP_STEP_MM,
  MASS_DEPTH_MM,
  MIN_EFFECT_MM,
  PADDING_FLOOR_MM,
  RELEASED_PADDING_MM,
  PHASE_STEP_MM,
  POSITIONING,
  CONTACT_TOLERANCE_MM,
  SNAP_STEP_MM,
  VOTING_ORDER,
} from './grid-origin-spec'
import {
  bbox,
  type BBox,
  centroidOf,
  fieldSpanMM,
  contactPointsMM,
  maxPressMM,
  pressExcessMM,
  latticeAt,
  makeCircleSeatPredicate,
  makeSeatPredicate,
  pointInMass,
  safeSegments,
  spotRadiusOf,
  TANGENT_GUARD_MM,
  type SafeSegment,
} from './grid-origin-compute'
import {
  applyCoverage,
  assignSizes,
  bandOf,
  centeringAnchors,
  centeringRef,
  governMass,
  registrationScore,
  type VotingOrder,
  type Anchor,
  type CentreMode,
  type Governor,
  type MagnetPlan,
} from './grid-origin-logic'

export * from './grid-origin-spec'
export {
  fieldSpanMM,
  impliedFlapMM,
  latticeOver,
  safeSegments,
  scaleContour,
  spotRadiusOf,
  type SafeMass,
  type SafeSegment,
} from './grid-origin-compute'
export { bandOf, type Anchor, type MagnetDia, type MagnetPlan } from './grid-origin-logic'

export interface GridConfig {
  pitchMM?: number
  paddingMM?: number
  /** How far material may extend past a spot's edge before it counts as a flap. 0 = edge-to-edge. */
  flapMM?: number
  /** How finely the lattice slides under the shape when searching registrations. */
  phaseStepMM?: number
  /** Manual calibration: force this registration (mm phase) instead of searching. */
  forcePhaseMM?: Pt
  /** Clearance a region must survive to count as a mass for centring. */
  massDepthMM?: number
  /** Centre mode — 0 box · 1 core · 2 masses · 3 weight · 4 deep · 5 top. */
  centreMode?: number
  /** Positioning law — 0 voting · 1 centre rules (parity-locked, no voting). */
  positioning?: number
  /** Which mass rules in Masses mode — 0 smallest · 1 deepest · 2 top. */
  governor?: number
  /** 'light' skips island outlines (display-only work) — used by walk-internal solves. */
  segmentsDetail?: 'full' | 'light'
  /** CONTACT LAW margin (Dan, 2026-08-19): the flap allowance is an invisible margin worn by
   *  every disc — seats must clear spot + margin from the edge, and a band option is the size
   *  where the shape's edge presses against the margined disc. */
  seatMarginMM?: number
  /** Voting dominance order — which force rules, admin-picked; spec default when absent. */
  votingOrder?: number
  /** Per-size solve reuse for band walks — owned by the caller (the worker). */
  solveCache?: Map<number, GridResult>
  plan?: MagnetPlan
  perimeterOnly?: boolean // default true — perimeter belt drops surrounded interior nodes
  /** The outline is a true circle: judge against the analytic curve, not its flattened chords. */
  circle?: boolean
}

export interface GridResult {
  anchors: Anchor[]
  pitchCentreMM: number
  /** Every lattice position at the chosen phase, seated or not. */
  lattice: Pt[]
  /** The phase the search chose, mm. */
  phaseMM: Pt
  /** Registration offset from the canonical phase, mm per axis — the pan class. */
  panMM: Pt
  /** The spot radius the erosion used — the padding, centre-measured. */
  spotRadiusMM: number
  /** Outline points where a disc touches (within one snap step of its margined edge). */
  contactsMM: Pt[]
  /** LAW mode: the worst belt disc's gap beyond the allowance — 0 when the wrap law holds. */
  pressMM?: number
  /** LAW mode: false when no parity-lawful candidate seated — the centre law is conceded. */
  parityTrue?: boolean
  /** The legal area's islands with depth masses — what centring anchored on. */
  segments: SafeSegment[]
  /** The active centre-mode's candidate target(s) — drawn so the aim is visible. */
  centresMM: Pt[]
  /** THE centre that governed the winning layout — the main point of the centring system. */
  centreMainMM: Pt
}

/** Sweep the lattice phase at the placement step (ruled 1mm), seat exactly, score, apply coverage, report. */
/** Phase-dedupe key quantum — micron identity for slide phases, not a law value. */
const QUANTUM_KEY_MM = 0.001

const mod = (v: number, m: number) => ((v % m) + m) % m

/** THE CENTRE LAW as a predicate: per axis, an odd count of seated lines must put a NODE on
 *  the governed centre, an even count must put the GAP on it. Used to rank lawful placements
 *  and to MEASURE the truth of a hand-forced registration. */
function parityHolds(seat: ReadonlyArray<Pt>, target: Pt, bb: BBox, pitch: number): boolean {
  if (!seat.length) return false
  const lines = (axis: 0 | 1) => new Set(seat.map((s) => Math.round(s[axis] / QUANTUM_KEY_MM))).size
  const onNode = (axis: 0 | 1) => {
    const off = mod(seat[0][axis] - target[axis], pitch)
    return off < pitch / 4 || off > pitch * 3 / 4
  }
  void bb
  return (lines(0) % 2 === 1) === onNode(0) && (lines(1) % 2 === 1) === onNode(1)
}

export function computeGrid(contourMM: Contour, cfg: GridConfig = {}): GridResult {
  const pitch = cfg.pitchMM ?? DEFAULT_PITCH_MM
  const pad = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? RELEASED_PADDING_MM)
  // Coverage reach from a magnet centre: the spot plus the dialled flap allowance.
  const reach = spotRadiusOf(pad) + Math.max(0, cfg.flapMM ?? FLAP_MM)
  const phaseStep = Math.max(1, cfg.phaseStepMM ?? PHASE_STEP_MM)
  const plan = cfg.plan ?? 'all6'
  const perimeterOnly = cfg.perimeterOnly ?? true
  const outer = contourMM.outer.pts
  const bb = bbox(outer)
  const cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2

  const fits = cfg.circle
    ? makeCircleSeatPredicate(cx, cy, Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY) / 2, spotRadiusOf(pad) + Math.max(0, cfg.seatMarginMM ?? 0))
    : makeSeatPredicate(outer, spotRadiusOf(pad) + Math.max(0, cfg.seatMarginMM ?? 0))

  const massDepth = Math.max(spotRadiusOf(pad), cfg.massDepthMM ?? MASS_DEPTH_MM)
  const segments = safeSegments(outer, spotRadiusOf(pad), massDepth, cfg.segmentsDetail ?? 'full')

  // THE shape's centres — chosen by the centre-mode switch (logic's table). Every returned
  // point anchors the slide walk; single-target modes also fix the balance target.
  const mode = (cfg.centreMode ?? CENTRE_MODE) as CentreMode
  const positioning = cfg.positioning ?? POSITIONING
  const governor = (cfg.governor ?? GOVERNOR) as Governor
  const centres = centeringAnchors(mode, segments, [cx, cy], centroidOf(outer))
  // Under CENTRE RULES one point rules outright; Masses names it via the governor switch.
  const allMasses = segments.flatMap((s) => (s.masses.length ? s.masses : [s]))
  const midY = (bb.minY + bb.maxY) / 2
  const ruleTarget: Pt = mode === 2 ? (governMass(allMasses, governor, midY)?.centreMM ?? centres[0]) : centres[0]

  let bestSeated: Pt[] = []
  let bestOx = 0, bestOy = 0, bestKx = 0, bestKy = 0
  let mainCentre: Pt = centres[0]
  let parityTrue = true
  if (fits && cfg.forcePhaseMM) {
    // Manual calibration: seat exactly at the given registration, no search. The centre law
    // is NOT satisfied by construction here — a hand-placed grid may sit anywhere — so its
    // truth is MEASURED and reported (pixel full-eval F1: silence read as compliance).
    bestOx = mod(cfg.forcePhaseMM[0], pitch)
    bestOy = mod(cfg.forcePhaseMM[1], pitch)
    bestKx = mod(bestOx - (bb.maxX - bb.minX) / 2, pitch)
    bestKy = mod(bestOy - (bb.maxY - bb.minY) / 2, pitch)
    bestSeated = latticeAt(bb, pitch, bestOx, bestOy).filter(fits)
    mainCentre = ruleTarget
    parityTrue = parityHolds(bestSeated, ruleTarget, bb, pitch)
  } else if (fits && positioning === 1) {
    // CENTRE RULES — no voting. Parity is DERIVED from the bbox axis classes (canon §4/§6):
    // each axis's class fixes its magnet-line count, odd count puts a NODE on the centre,
    // even count puts the GAP on it — so a 108x91 (class 2x2) shape is judged as a 2x2 frame
    // whose centre IS the governed centre. Magnets still govern first: a parity seating more
    // wins; at EQUAL seats the canonical frame parity always beats the rest, and coverage
    // only sorts the non-canonical remainder. Centring is exact by construction.
    const bxc = ruleTarget[0] - bb.minX, byc = ruleTarget[1] - bb.minY
    const half = pitch / 2
    const clsOf = (side: number) => bandOf(side)?.id ?? BANDS[BANDS.length - 1].id
    const canX = clsOf(bb.maxX - bb.minX) % 2 === 1 ? bxc : bxc + half
    const canY = clsOf(bb.maxY - bb.minY) % 2 === 1 ? byc : byc + half
    const otherX = canX === bxc ? bxc + half : bxc
    const otherY = canY === byc ? byc + half : byc
    // canon = how many axes carry their class-derived parity (2 = the full canonical frame).
    const cands: Array<[number, number, number]> = [
      [canX, canY, 2], [otherX, canY, 1], [canX, otherY, 1], [otherX, otherY, 0],
    ]
    let best: { seats: number; canon: number; excess: number } | null = null
    for (const [px, py, canon] of cands) {
      const ox = mod(px, pitch), oy = mod(py, pitch)
      const seat = latticeAt(bb, pitch, ox, oy).filter(fits)
      if (!seat.length) continue
      const excess = pressExcessMM(outer, seat, reach)
      const wins = !best
        || seat.length > best.seats
        || (seat.length === best.seats && canon > best.canon)
        || (seat.length === best.seats && canon === best.canon && excess < best.excess)
      if (wins) { best = { seats: seat.length, canon, excess }; bestSeated = seat; bestOx = ox; bestOy = oy }
    }
    mainCentre = ruleTarget
  } else if (fits && positioning === 2) {
    // THE LAW MODE (Dan, 2026-08-20) — Centre rules' rigid centring plus its two equal
    // siblings. No scoring anywhere: the grid is placed ON the governed centre by parity
    // (centre law, by construction); among the four lawful placements the ranking is pure
    // lexicographic law — magnet count (post-belt, the band's step axis) → wrap (the worst
    // belt disc's gap beyond the allowance, smaller is truer) → gravity (vertical beats
    // horizontal between otherwise-equal arrangements). Size is the reconciler: the band
    // walk only rungs sizes where count, wrap and centre hold together.
    const bxc = ruleTarget[0] - bb.minX, byc = ruleTarget[1] - bb.minY
    const half = pitch / 2
    const clsOf = (side: number) => bandOf(side)?.id ?? BANDS[BANDS.length - 1].id
    const canX = clsOf(bb.maxX - bb.minX) % 2 === 1 ? bxc : bxc + half
    const canY = clsOf(bb.maxY - bb.minY) % 2 === 1 ? byc : byc + half
    const otherX = canX === bxc ? bxc + half : bxc
    const otherY = canY === byc ? byc + half : byc
    const cands: Array<[boolean, number, number]> = [
      [true, canX, canY], [false, otherX, canY], [false, canX, otherY], [false, otherX, otherY],
    ]
    // THE CENTRE LAW IS A LAW (Meta F2): a candidate is lawful only when each axis's seated
    // line-count parity matches its placement — odd lines → the node IS on the centre, even →
    // the gap IS on it. Lawful candidates outrank everything; wrap can never trade the centre
    // away. An unlawful winner is a CONCESSION (parityTrue=false) — free-mode display only;
    // the band walk refuses it and lets size reconcile.
    let bl: { lawful: boolean; count: number; pressQ: number; vertical: boolean } | null = null
    let bestLawful = false
    for (const [isCanX, px, py] of cands) {
      const ox = mod(px, pitch), oy = mod(py, pitch)
      const seat = latticeAt(bb, pitch, ox, oy).filter(fits)
      if (!seat.length) continue
      const lawful = parityHolds(seat, ruleTarget, bb, pitch)
      void isCanX
      const belt = applyCoverage(seat, perimeterOnly, pitch).seated
      const pressQ = Math.round(Math.max(0, maxPressMM(outer, belt, reach)) / QUANTUM_KEY_MM)
      const sb = bbox(seat)
      const vertical = sb.maxY - sb.minY >= sb.maxX - sb.minX
      const wins = !bl
        || (lawful && !bl.lawful)
        || (lawful === bl.lawful && belt.length > bl.count)
        || (lawful === bl.lawful && belt.length === bl.count && pressQ < bl.pressQ)
        || (lawful === bl.lawful && belt.length === bl.count && pressQ === bl.pressQ && vertical && !bl.vertical)
      if (wins) { bl = { lawful, count: belt.length, pressQ, vertical }; bestSeated = seat; bestOx = ox; bestOy = oy; bestLawful = lawful }
    }
    parityTrue = bestLawful
    mainCentre = ruleTarget
  } else if (fits) {
    // Phases: ONE full ladder swept from the first centre, plus each further mass centre's
    // EXACT slide (k=0) — the only slide of a second base the ladder doesn't already cover.
    // Every mass-centred registration is sampled at ANY step size without multiplying the walk.
    const phases = (bases: number[]): { p: number; k: number }[] => {
      const out: { p: number; k: number }[] = []
      const seen = new Set<number>()
      const push = (p: number, k: number) => {
        const id = Math.round(p / QUANTUM_KEY_MM)
        if (!seen.has(id)) { seen.add(id); out.push({ p, k }) }
      }
      for (let k = 0; k < pitch; k += phaseStep) push(mod(bases[0] + k, pitch), k)
      for (let i = 1; i < bases.length; i++) push(mod(bases[i], pitch), 0)
      return out
    }
    // TWO-PASS SWEEP — same winner, a fraction of the work. Seat count sits on the top
    // dominance tier for every voting order that begins with magnets, so a slide below the
    // maximum count can never win: pass 1 counts seats per slide (cheap); pass 2 runs the
    // full scoring ONLY over the max-count slides, in the same iteration order, so winner
    // and tie-breaks are identical to the single-pass sweep. Orders that put another force
    // on top take the exact single-pass road instead.
    const pyList = phases(centres.map((a) => a[1] - bb.minY))
    const pxList = phases(centres.map((a) => a[0] - bb.minX))
    // Legality memo — every grid point is judged once; pass 2 re-reads, never re-measures.
    const memo = new Map<number, boolean>()
    const fitsM = (p: Pt): boolean => {
      // Micron identity — exact for any phase source, fractional mass centres included.
      const k = Math.round((p[0] - bb.minX) / QUANTUM_KEY_MM) * 2097152 + Math.round((p[1] - bb.minY) / QUANTUM_KEY_MM)
      const hit = memo.get(k)
      if (hit !== undefined) return hit
      const v = fits(p)
      memo.set(k, v)
      return v
    }
    let maxCount = 0
    const counts = new Int32Array(pyList.length * pxList.length)
    for (let yi = 0; yi < pyList.length; yi++) for (let xi = 0; xi < pxList.length; xi++) {
      let n = 0
      for (const p of latticeAt(bb, pitch, pxList[xi].p, pyList[yi].p)) if (fitsM(p)) n++
      counts[yi * pxList.length + xi] = n
      if (n > maxCount) maxCount = n
    }
    let bestScore = -Infinity
    for (let yi = 0; yi < pyList.length; yi++) {
      const py = pyList[yi]
      for (let xi = 0; xi < pxList.length; xi++) {
        if (counts[yi * pxList.length + xi] !== maxCount) continue
        const px = pxList[xi]
        const seat = latticeAt(bb, pitch, px.p, py.p).filter(fitsM)
        if (!seat.length) continue
        const excess = pressExcessMM(outer, seat, reach)
        // Balance target: mode 2 → the smallest mass that holds a seat governs (logic's rule),
        // containment against the mass's real outline; other modes → the mode's single centre.
        const ref = mode === 2 ? centeringRef(segments, seat, pointInMass, governor, midY) : null
        const inRef = ref ? seat.filter((p) => pointInMass(p, ref)) : seat
        const [tx, ty] = ref ? ref.centreMM : centres[0]
        let sx = 0, sy = 0; for (const p of inRef) { sx += p[0]; sy += p[1] }
        const balance = Math.hypot(sx / inRef.length - tx, sy / inRef.length - ty)
        const score = registrationScore(seat.length, excess, balance, cfg.votingOrder as VotingOrder | undefined)
        if (score > bestScore) { bestScore = score; bestSeated = seat; bestOx = px.p; bestOy = py.p; bestKx = px.k; bestKy = py.k; mainCentre = [tx, ty] }
      }
    }
  }

  const lattice = latticeAt(bb, pitch, bestOx, bestOy)

  const coverage = applyCoverage(bestSeated, perimeterOnly, pitch)
  const anchors = assignSizes(coverage.seated, plan)


  return {
    anchors,
    // THE TRUTH DOT (Dan: "the dot shows touch but lies"): a dot means the DISC touches the
    // edge — spot radius only, exact-tangency slack. The amber ring tells the allowance story.
    contactsMM: contactPointsMM(outer, coverage.seated, spotRadiusOf(pad), TANGENT_GUARD_MM),
    ...(positioning === 2 && coverage.seated.length
      ? { pressMM: Math.max(0, maxPressMM(outer, applyCoverage(coverage.seated, true, pitch).seated, reach)), parityTrue }
      : {}),
    pitchCentreMM: pitch,
    lattice,
    phaseMM: [bestOx, bestOy],
    panMM: [bestKx, bestKy],
    spotRadiusMM: spotRadiusOf(pad),
    segments,
    centresMM: positioning >= 1 ? [ruleTarget] : centres,
    centreMainMM: mainCentre,
  }
}

/** One holding rung in a band: the size and its seat count. */
export interface BandSnapPoint { sizeMM: number; count: number }

/** The walk range: the band as a RANGE; above the last band, up to the derived field span. */
function snapRange(cfg: GridConfig, fromMM: number): [number, number] {
  const band = bandOf(fromMM)
  if (band) return [band.minMM, band.maxMM]
  return [fromMM, fieldSpanMM(Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? RELEASED_PADDING_MM))]
}

/**
 * THE CONTACT LAW (Dan, 2026-08-19): "the scale must be scaling up and down until edges touch
 * the disc — this is zero flap." Every disc wears the allowance as an invisible margin, and a
 * band option is a magnet COUNT at its CONTACT size — the smallest size where that count still
 * seats against the margined discs. No wrap test: the seat geometry IS the law. A count whose
 * contact lies below the band belongs to the band below, not here worn loose.
 */
export function bandSnapPoints(
  sized: (mm: number) => Contour, cfg: GridConfig, fromMM: number, stepMM: number,
): BandSnapPoint[] {
  return bandWalk(sized, cfg, fromMM, stepMM).points
}

/** One pass over the band: the per-count contact sizes AND the best-seated rung (fallback). */
function bandWalk(
  sized: (mm: number) => Contour, cfg: GridConfig, fromMM: number, stepMM: number,
): { points: BandSnapPoint[]; bestSeatedMM: number } {
  const [lo, hi] = snapRange(cfg, fromMM)
  const margin = Math.max(0, cfg.flapMM ?? FLAP_MM)
  // LAW mode: the wrap law alone rules the gate — inflating the seat predicate too (the
  // contact-law margin) would demand gap ≥ allowance AND ≤ allowance at once, a knife edge.
  const law = (cfg.positioning ?? POSITIONING) === 2
  const walkCfg: GridConfig = law
    ? { ...cfg, segmentsDetail: 'light' }
    : { ...cfg, segmentsDetail: 'light', seatMarginMM: margin }
  const solve = (mm: number): GridResult => {
    let g = cfg.solveCache?.get(mm)
    if (!g) { g = computeGrid(sized(mm), walkCfg); cfg.solveCache?.set(mm, g) }
    return g
  }
  // Counts already seating just below the band reached contact earlier — loose here, not rungs.
  const below = lo - stepMM >= MIN_EFFECT_MM ? solve(lo - stepMM).anchors.length : 0
  const points: BandSnapPoint[] = []
  const seen = new Set<number>()
  for (let c = 1; c <= below; c++) seen.add(c)
  const reach = spotRadiusOf(Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? RELEASED_PADDING_MM)) + margin
  let bestSeatedMM = lo, bestSeats = -1
  for (let mm = lo; mm <= hi; mm += stepMM) {
    const grid = solve(mm)
    const count = grid.anchors.length
    if (count > bestSeats) { bestSeats = count; bestSeatedMM = mm }
    // THE RIGID GATE (Dan): every disc must touch within the allowance — 0 = touch,
    // 1 = 1mm space — measured with one size-step of slack (the walk's own resolution).
    // A count whose layout leaves a disc floating past that is NOT an option here;
    // Auto mode adapts the allowance instead.
    const contour = sized(mm)
    // Wrap is BELT-scoped (interior discs can never touch) and the centre law must be TRUE —
    // a parity-conceded layout is never a rung; size reconciles (the keystone).
    // THE GATE IS THE LAW'S OWN TOLERANCE (pixel full-eval F2): `<= stepMM` granted the walk's
    // resolution as hidden slack, so flap 0 admitted non-touching layouts. A count's rung is
    // the SMALLEST size where it seats lawfully — refined below the walk step so true contact
    // is found, not approximated.
    const pressAt = (c: Contour, g: GridResult) =>
      maxPressMM(c.outer.pts, applyCoverage(g.anchors.map((a) => a.p), true, cfg.pitchMM ?? DEFAULT_PITCH_MM).seated, reach)
    if (count >= 1 && (grid.parityTrue ?? true) && !seen.has(count)) {
      // Bisect (mm - stepMM, mm] for the smallest lawful size holding this count — its gap is
      // minimal by construction; the law then judges THAT size.
      let lo2 = Math.max(MIN_EFFECT_MM, mm - stepMM), hi2 = mm
      for (let it = 0; it < 8 && hi2 - lo2 > CONTACT_TOLERANCE_MM / 2; it++) {
        const midMM = (lo2 + hi2) / 2
        const gm = computeGrid(sized(midMM), walkCfg)
        if (gm.anchors.length >= count && (gm.parityTrue ?? true)) hi2 = midMM; else lo2 = midMM
      }
      // Keep the refined size exact — rounding it back to a coarse grid re-introduces the
      // very slack the bisection removed (display rounds, the law does not).
      const rungMM = hi2
      const gr = computeGrid(sized(rungMM), walkCfg)
      const ok = gr.anchors.length === count && (gr.parityTrue ?? true)
        && pressAt(sized(rungMM), gr) <= CONTACT_TOLERANCE_MM
      if (ok) { seen.add(count); points.push({ sizeMM: rungMM, count }) }
    }
    void contour
  }
  return { points, bestSeatedMM }
}

/**
 * Band snap under the contact law. `ladder` = one rung per magnet count at its contact size;
 * the landing pick is the smallest size at the band's maximum count. When no count reaches
 * contact inside the band, the best-seated size shows as an explicit fallback, never a fit.
 */
export function fitSizeInBand(
  sized: (mm: number) => Contour, cfg: GridConfig, fromMM: number, stepMM: number,
): { sizeMM: number; grid: GridResult; ladder: BandSnapPoint[]; pickIdx: number } {
  const { points, bestSeatedMM } = bandWalk(sized, cfg, fromMM, stepMM)
  const margin = Math.max(0, cfg.flapMM ?? FLAP_MM)
  const dispCfg: GridConfig = (cfg.positioning ?? POSITIONING) === 2
    ? { ...cfg }
    : { ...cfg, seatMarginMM: margin }
  if (points.length) {
    const maxCount = Math.max(...points.map((p) => p.count))
    const pickIdx = points.findIndex((p) => p.count === maxCount)
    return { sizeMM: points[pickIdx].sizeMM, grid: computeGrid(sized(points[pickIdx].sizeMM), dispCfg), ladder: points, pickIdx }
  }
  return { sizeMM: bestSeatedMM, grid: computeGrid(sized(bestSeatedMM), dispCfg), ladder: [], pickIdx: 0 }
}

/**
 * AUTO FLAP (micro-module, Dan 2026-08-19): a band tries the snuggest law first — allowance 0 —
 * and grants itself only as much margin as it needs to produce a contact variant, scanning up
 * in AUTO_FLAP_STEP_MM steps to the dialled max. Reuses the band walk untouched; the chosen
 * allowance is reported so the panel and margin rings can show it.
 */
export function autoFlapInBand(
  sized: (mm: number) => Contour, cfg: GridConfig, fromMM: number, stepMM: number, maxFlapMM: number,
  cacheFor?: (flapMM: number) => Map<number, GridResult> | undefined,
): { flapMM: number; fit: ReturnType<typeof fitSizeInBand> } {
  const cap = Math.max(0, maxFlapMM)
  let last: ReturnType<typeof fitSizeInBand> | null = null
  for (let f = 0; f <= cap; f += AUTO_FLAP_STEP_MM) {
    last = fitSizeInBand(sized, { ...cfg, flapMM: f, solveCache: cacheFor?.(f) }, fromMM, stepMM)
    if (last.ladder.length) return { flapMM: f, fit: last }
  }
  if (cap % AUTO_FLAP_STEP_MM !== 0) {
    const fit = fitSizeInBand(sized, { ...cfg, flapMM: cap, solveCache: cacheFor?.(cap) }, fromMM, stepMM)
    if (fit.ladder.length) return { flapMM: cap, fit }
    last = fit
  }
  return { flapMM: cap, fit: last! }
}
```

##### `src/lib/effect/grid-origin-spec.ts`

```ts
// grid-origin-spec.ts — SPEC: values only. No arithmetic, no policy.

/** The lattice, centre to centre. */
export const DEFAULT_PITCH_MM = 48

/** Released pitches. 96 = the 48 lattice thinned (every second point); 24 = fine bench tier. */
export const RELEASED_PITCHES_MM: ReadonlyArray<{ mm: number; label: string }> = Object.freeze([
  Object.freeze({ mm: 24, label: '24 mm' }),
  Object.freeze({ mm: 48, label: '48 mm' }),
  Object.freeze({ mm: 96, label: '96 mm' }),
])

/** Padding slider range — admin test bounds around the locked 12. */
export const PADDING_FLOOR_MM = 10
export const PADDING_CEIL_MM = 30

/** Released padding — locked 12mm, measured from the magnet centre. */
export const RELEASED_PADDING_MM = 12

/** Smallest effect — one 24mm cell. */
export const MIN_EFFECT_MM = 24

/** Field positions per axis (9×9). */
export const FIELD_POSITIONS_PER_AXIS = 9

/** Extra size past the board's span so a shape can pad past the outermost spots (408 → 420). */
export const SIZE_CEIL_MARGIN_MM = 12

/** Magnet body diameters. */
export const MAGNET_DIA_SMALL_MM = 6
export const MAGNET_DIA_LARGE_MM = 8

/** Fewest seated magnets the perimeter belt may thin down to. */
export const MIN_ANCHORS = 2

/** Size bands, ends 1mm shy so no size lives in two bands. B5 keeps its ceiling. */
export interface Band { readonly id: 1 | 2 | 3 | 4 | 5; readonly minMM: number; readonly maxMM: number }
export const BANDS: ReadonlyArray<Band> = Object.freeze([
  Object.freeze({ id: 1 as const, minMM: 24, maxMM: 71 }),
  Object.freeze({ id: 2 as const, minMM: 72, maxMM: 119 }),
  Object.freeze({ id: 3 as const, minMM: 120, maxMM: 167 }),
  Object.freeze({ id: 4 as const, minMM: 168, maxMM: 215 }),
  Object.freeze({ id: 5 as const, minMM: 216, maxMM: 264 }),
])

/** Registration search phase step — how finely the lattice slides under the shape.
 *  RULED 2026-08-18: continuous 1mm registration — Dan tested the dial and locked 1mm; the
 *  per-band selection is correct for the first time with it. 12 (the cell increment) remains
 *  an admin test value, not the law. */
export const PHASE_STEP_MM = 1
export const PHASE_STEP_FLOOR_MM = 1

/** Flap allowance — the invisible margin every disc wears (Dan's contact law): band options
 *  are the sizes where the edge presses against spot + allowance. RULED 2026-08-19: the
 *  factory default is 0 — edge-to-edge tangency; any margin is an explicit admin grant. */
export const FLAP_MM = 0
export const FLAP_FLOOR_MM = 0
export const FLAP_CEIL_MM = 48

/** Snap scan size step. */
export const SNAP_STEP_MM = 1

/** CONTACT TOLERANCE — how exactly "touch" is judged. It is the OUTLINE'S OWN accuracy (a
 *  traced/flattened silhouette is faithful to ~0.1mm at product sizes), never the walk's step:
 *  gating on the step granted a whole millimetre of hidden air at flap 0 (pixel full-eval F2).
 *  A rung's discs touch within the accuracy of the shape they are touching. */
export const CONTACT_TOLERANCE_MM = 0.1

/** Auto flap — the micro-module's scan: allowance tried from 0 up in this step, granting only
 *  what the band needs to produce a contact variant, capped by the flap dial. 1mm = minimal
 *  grant at the dial's own resolution (pixel full-eval F3: a 2mm scan overgranted). */
export const AUTO_FLAP_STEP_MM = 1

/** Voting dominance tiers — strict: the top force always beats the next, never blends.
 *  VOTING_ORDER picks which force sits on which tier (0 = magnets > wrap > centring). */
export const SEAT_WEIGHT = 100000
export const FLAP_WEIGHT = 100
export const BALANCE_WEIGHT = 1
export const VOTING_ORDER = 0

/** Mass depth — clearance a region must survive to count as a MASS (limbs and slivers die
 *  shallow, true masses survive deep). Admin-dialled; 12 = every legal point counts. */
export const MASS_DEPTH_MM = 16
export const MASS_DEPTH_FLOOR_MM = 12
export const MASS_DEPTH_CEIL_MM = 24

/** Positioning law — 0 voting (count/centring/coverage compete across swept slides) ·
 *  1 centre rules (grid locked to the centre by parity; seats pick among 4 parity slides). */
export const POSITIONING = 0

/** Governor — which mass rules in Masses mode: 0 smallest · 1 deepest · 2 top (gravity) ·
 *  3 top-small (upper-half smallest, else topmost). */
export const GOVERNOR = 0

/** Centre mode — which centre drives anchoring and balance. Test switch:
 *  0 box · 1 core (erosion mean) · 2 masses (adaptive, default) · 3 weight (material
 *  centroid) · 4 deep (deepest point) · 5 top (highest mass). */
export const CENTRE_MODE = 2
```

##### `src/lib/effect/grid-origin-compute.ts`

```ts
// grid-origin-compute.ts — COMPUTE: geometry and arithmetic. Values come from spec or the caller.

import type { Contour, Pt } from './types'
import { pointInPolygon } from './attachment'
import { holds, prepare } from '@/lib/grid-engine/compute/geometry'
import { DEFAULT_PITCH_MM, FIELD_POSITIONS_PER_AXIS } from './grid-origin-spec'

/** Exact-tangency band — the same tolerance the seat predicate treats as "at the edge". */
export const TANGENT_GUARD_MM = 0.05

/** Point-identity key quantum — 0.01mm hash resolution, not a law value. */
const KEY_QUANTUM_MM = 0.01

export type BBox = { minX: number; minY: number; maxX: number; maxY: number }

export function bbox(pts: ReadonlyArray<Pt>): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  return { minX, minY, maxX, maxY }
}

export function dist(a: Pt, b: Pt): number { return Math.hypot(a[0] - b[0], a[1] - b[1]) }

/** Spot radius = the padding, measured from the magnet centre. */
export function spotRadiusOf(padMM: number): number {
  return padMM
}

/** Full field span: the fixed 9×9 board on the base 48 grid, plus one spot either side — 408 at
 *  12 padding. Pitch never changes the board: 96 skips points on it, 24 adds points within it. */
export function fieldSpanMM(padMM: number): number {
  return (FIELD_POSITIONS_PER_AXIS - 1) * DEFAULT_PITCH_MM + 2 * spotRadiusOf(padMM)
}

/** Axis positions at `step` with a phase offset, spanning [min, max]. */
function axisFrom(min: number, max: number, step: number, phase: number): number[] {
  if (step <= 0 || max <= min) return [(min + max) / 2]
  const res: number[] = []
  let x = min + (((phase % step) + step) % step)
  while (x - step >= min - 1e-6) x -= step
  for (; x <= max + 1e-6; x += step) if (x >= min - 1e-6) res.push(x)
  return res
}

/** Lattice across a region at phase (ox, oy). */
export function latticeAt(bb: BBox, pitch: number, ox: number, oy: number): Pt[] {
  const out: Pt[] = []
  for (const x of axisFrom(bb.minX, bb.maxX, pitch, ox))
    for (const y of axisFrom(bb.minY, bb.maxY, pitch, oy)) out.push([x, y])
  return out
}

/** The same lattice generator over an arbitrary region. */
export function latticeOver(region: BBox, pitch: number, phase: Pt): Pt[] {
  return latticeAt(region, pitch, phase[0], phase[1])
}

/**
 * Bucketed edge index — accelerates nearest-edge distance and ray parity. Results are
 * BIT-IDENTICAL to the full scans: every edge that could be nearest is examined with the same
 * arithmetic, and edges a query skips contribute no ray crossing by construction. Built once
 * per outline array (WeakMap) — a solve reuses it across its thousands of queries.
 */
interface EdgeIdx {
  cell: number; ox: number; oy: number; cols: number; rows: number
  buckets: number[][]
  yBands: number[][]
  /** Chebyshev ring distance from each cell to the nearest edge-holding cell (BFS). */
  ring: Int16Array
  stamp: Int32Array
  tick: number
}
const EDGE_IDX = new WeakMap<object, EdgeIdx>()
function edgeIdxOf(outer: ReadonlyArray<Pt>): EdgeIdx {
  let idx = EDGE_IDX.get(outer as object)
  if (idx) return idx
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of outer) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  const cell = Math.max(4, Math.max(maxX - minX, maxY - minY) / 32)
  const cols = Math.max(1, Math.ceil((maxX - minX) / cell) + 1)
  const rows = Math.max(1, Math.ceil((maxY - minY) / cell) + 1)
  const buckets: number[][] = Array.from({ length: cols * rows }, () => [])
  const yBands: number[][] = Array.from({ length: rows }, () => [])
  for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
    const [ax, ay] = outer[j], [bx, by] = outer[i]
    const c0 = Math.max(0, Math.min(cols - 1, Math.floor((Math.min(ax, bx) - minX) / cell)))
    const c1 = Math.max(0, Math.min(cols - 1, Math.floor((Math.max(ax, bx) - minX) / cell)))
    const r0 = Math.max(0, Math.min(rows - 1, Math.floor((Math.min(ay, by) - minY) / cell)))
    const r1 = Math.max(0, Math.min(rows - 1, Math.floor((Math.max(ay, by) - minY) / cell)))
    for (let r = r0; r <= r1; r++) { for (let c = c0; c <= c1; c++) buckets[r * cols + c].push(i); yBands[r].push(i) }
  }
  // dedupe band lists (an edge may span several columns of the same row)
  for (let r = 0; r < rows; r++) yBands[r] = [...new Set(yBands[r])]
  // Ring field: multi-source BFS from edge cells — a deep query starts its scan at the ring
  // that can actually hold the nearest edge instead of expanding through empty space.
  const ring = new Int16Array(cols * rows).fill(-1)
  let frontier: number[] = []
  for (let i = 0; i < cols * rows; i++) if (buckets[i].length) { ring[i] = 0; frontier.push(i) }
  for (let d = 1; frontier.length; d++) {
    const next: number[] = []
    for (const cellIdx of frontier) {
      const cr0 = Math.floor(cellIdx / cols), cc0 = cellIdx % cols
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = cr0 + dr, c = cc0 + dc
        if (rr < 0 || rr >= rows || c < 0 || c >= cols) continue
        const k = rr * cols + c
        if (ring[k] === -1) { ring[k] = d; next.push(k) }
      }
    }
    frontier = next
  }
  idx = { cell, ox: minX, oy: minY, cols, rows, buckets, yBands, ring, stamp: new Int32Array(outer.length), tick: 0 }
  EDGE_IDX.set(outer as object, idx)
  return idx
}

function segDist2(outer: ReadonlyArray<Pt>, i: number, px: number, py: number): number {
  const j = i === 0 ? outer.length - 1 : i - 1
  const [ax, ay] = outer[j], [bx, by] = outer[i]
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0
  if (t < 0) t = 0; else if (t > 1) t = 1
  const ex = px - (ax + t * dx), ey = py - (ay + t * dy)
  return ex * ex + ey * ey
}

/** Float distance from a point to the outline's nearest edge — the prescreen metric. */
function edgeDistMM(outer: ReadonlyArray<Pt>, pt: Pt): number {
  const idx = edgeIdxOf(outer)
  const [px, py] = pt
  const cc = Math.max(0, Math.min(idx.cols - 1, Math.floor((px - idx.ox) / idx.cell)))
  const cr = Math.max(0, Math.min(idx.rows - 1, Math.floor((py - idx.oy) / idx.cell)))
  const tick = ++idx.tick
  let best = Infinity
  const maxR = Math.max(idx.cols, idx.rows)
  const r0 = Math.max(0, idx.ring[cr * idx.cols + cc] - 1)
  for (let r = r0; ; r++) {
    // Once every unexamined edge is provably farther than the best, stop.
    if (r > r0) { const lb = (r - 1) * idx.cell; if (lb * lb > best || r > maxR + r0) break }
    for (let dr = -r; dr <= r; dr++) {
      const rr = cr + dr
      if (rr < 0 || rr >= idx.rows) continue
      for (let dc = -r; dc <= r; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== r) continue
        const c = cc + dc
        if (c < 0 || c >= idx.cols) continue
        for (const e of idx.buckets[rr * idx.cols + c]) {
          if (idx.stamp[e] === tick) continue
          idx.stamp[e] = tick
          const d2 = segDist2(outer, e, px, py)
          if (d2 < best) best = d2
        }
      }
    }
  }
  return Math.sqrt(best)
}

/** Even-odd ray parity via the y-band index — identical crossings to the full scan. */
function pointInOuter(pt: Pt, outer: ReadonlyArray<Pt>): boolean {
  const idx = edgeIdxOf(outer)
  const band = Math.max(0, Math.min(idx.rows - 1, Math.floor((pt[1] - idx.oy) / idx.cell)))
  let inside = false
  for (const i of idx.yBands[band]) {
    const j = i === 0 ? outer.length - 1 : i - 1
    const [xi, yi] = outer[i]
    const [xj, yj] = outer[j]
    const crosses = (yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi
    if (crosses) inside = !inside
  }
  return inside
}

/**
 * Seat predicate for one outline: centre at least `spotRadiusMM` from every boundary point,
 * tangency passing by equality (exact integer arithmetic, micron quantum).
 * A float prescreen answers the clear cases; only points within a guard band of the exact
 * threshold fall through to the integer test — the answer never changes, only the cost.
 * Null for a degenerate outline.
 */
export function makeSeatPredicate(
  outer: ReadonlyArray<Pt>,
  spotRadiusMM: number,
): ((pt: Pt) => boolean) | null {
  const QUANTUM = 0.001
  const GUARD = 0.05
  let prep: ReturnType<typeof prepare>
  try { prep = prepare(outer, QUANTUM) } catch { return null }
  const rQ = Math.round(spotRadiusMM / QUANTUM)
  return (pt: Pt) => {
    // Ring-field lower bound: a point provably farther than the threshold from every edge
    // skips the distance query entirely — parity alone decides. Same answer, no scan.
    const idx = edgeIdxOf(outer)
    const cc = Math.max(0, Math.min(idx.cols - 1, Math.floor((pt[0] - idx.ox) / idx.cell)))
    const cr = Math.max(0, Math.min(idx.rows - 1, Math.floor((pt[1] - idx.oy) / idx.cell)))
    if ((idx.ring[cr * idx.cols + cc] - 1) * idx.cell > spotRadiusMM + GUARD) return pointInOuter(pt, outer)
    const d = edgeDistMM(outer, pt)
    if (d > spotRadiusMM + GUARD) return pointInOuter(pt, outer)
    if (d < spotRadiusMM - GUARD) return false
    return holds(prep, [Math.round(pt[0] / QUANTUM), Math.round(pt[1] / QUANTUM)], rQ)
  }
}

/**
 * Seat predicate for a TRUE CIRCLE (centre c, radius R): the disc of radius r fits iff
 * |p−c|² ≤ (R−r)² — integer microns, tangency by equality. A flattened polygon's chords sit
 * microns inside the curve and wrongly refuse the zero-margin case; the analytic form cannot.
 */
export function makeCircleSeatPredicate(
  cx: number, cy: number, R: number, spotRadiusMM: number,
): ((pt: Pt) => boolean) | null {
  const QUANTUM = 0.001
  const q = (v: number) => Math.round(v / QUANTUM)
  const slack = q(R) - q(spotRadiusMM)
  if (slack < 0) return null
  const cqx = q(cx), cqy = q(cy), s2 = slack * slack
  return (pt: Pt) => {
    const dx = q(pt[0]) - cqx, dy = q(pt[1]) - cqy
    return dx * dx + dy * dy <= s2
  }
}

/** Distance from a point to the segment ab. */
function distToSeg(v: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  let t = len2 > 0 ? ((v[0] - a[0]) * dx + (v[1] - a[1]) * dy) / len2 : 0
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(v[0] - a[0] - t * dx, v[1] - a[1] - t * dy)
}

/** THE WRAP LAW (Dan, 2026-08-20: "0 flap means magnets and edges touch"): wrap is each
 *  disc PRESSED against the outline. The force is the mean of every seated disc's own gap
 *  past its margined edge (spot + allowance) — zero when every disc that can touch does.
 *  Enforced through the dominance tiers, not preferred. */
export function pressExcessMM(outer: ReadonlyArray<Pt>, seated: ReadonlyArray<Pt>, reach: number): number {
  if (!seated.length) return 0
  let sum = 0
  for (const s of seated) sum += Math.max(0, edgeDistMM(outer, s) - reach)
  return sum / seated.length
}

/** THE RIGID GATE (Dan, 2026-08-20): the worst disc's gap past its margined edge. A layout
 *  qualifies only when EVERY disc touches within the allowance — 0 = touch, 1 = 1mm space.
 *  Normal mode enforces this; Auto mode adapts the allowance instead. */
export function maxPressMM(outer: ReadonlyArray<Pt>, seated: ReadonlyArray<Pt>, reach: number): number {
  let m = 0
  for (const s of seated) { const g = edgeDistMM(outer, s) - reach; if (g > m) m = g }
  return m
}

/** Where discs actually touch: for each seated disc within `slackMM` of its margined edge,
 *  the nearest point on the outline — drawn so tangency is visible, never guessed. */
export function contactPointsMM(
  outer: ReadonlyArray<Pt>, seated: ReadonlyArray<Pt>, reach: number, slackMM: number,
): Pt[] {
  const out: Pt[] = []
  for (const s of seated) {
    if (edgeDistMM(outer, s) - reach > slackMM) continue
    // nearest outline point: brute over segments (few contacts per solve — cost immaterial)
    let best: Pt = outer[0], bd = Infinity
    for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
      const [ax, ay] = outer[j], [bx, by] = outer[i]
      const dx = bx - ax, dy = by - ay
      const len2 = dx * dx + dy * dy
      let t = len2 > 0 ? ((s[0] - ax) * dx + (s[1] - ay) * dy) / len2 : 0
      t = Math.max(0, Math.min(1, t))
      const px = ax + t * dx, py = ay + t * dy
      const d = Math.hypot(s[0] - px, s[1] - py)
      if (d < bd) { bd = d; best = [px, py] }
    }
    out.push(best)
  }
  return out
}

/** The allowance a solved layout IMPLIES at its size — the margin needed to HOLD EVERY disc
 *  (the worst gap, matching the wrap law), not merely the first one to touch. Free mode's Auto
 *  readout and the band's granting law therefore speak the same language (pixel full-eval F3).
 *  0 = every disc already tangent. */
export function impliedFlapMM(outer: ReadonlyArray<Pt>, seated: ReadonlyArray<Pt>, spotRadiusMM: number): number {
  if (!seated.length) return 0
  let g = 0
  for (const a of seated) { const d = edgeDistMM(outer, a) - spotRadiusMM; if (d > g) g = d }
  return Math.max(0, g)
}

/** A mass inside an island — the region surviving the depth probe, with its outline. */
export interface SafeMass {
  areaMM2: number
  /** The deepest point of the mass — always inside the material. */
  centreMM: Pt
  /** The mass's peak clearance, mm. */
  peakClearMM: number
  bbox: BBox
  rings: Pt[][]
}

/** One connected island of the legal magnet-centre area, measured on a mesh. */
export interface SafeSegment {
  areaMM2: number
  /** The island's deepest point — max clearance, never a concave void. */
  centreMM: Pt
  /** The island's area-average point — can sit in a concave void; a test-mode reference. */
  meanMM: Pt
  /** The island's peak clearance, mm — how deep its most buried point sits. */
  peakClearMM: number
  bbox: BBox
  /** The island's edge-offset outline(s) — smooth closed rings, mm, engine y-up. */
  rings: Pt[][]
  /** Sub-masses at the depth probe: limbs and slivers die shallow, true masses survive. */
  masses: SafeMass[]
}

/** Marching-squares topology: per corner-sign mask (array position), the cell-edge pairs a
 *  contour crosses. Edges 0=top 1=right 2=bottom 3=left. */
const MS_CASES: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [], [[3, 0]], [[0, 1]], [[3, 1]],
  [[1, 2]], [[3, 0], [1, 2]], [[0, 2]], [[3, 2]],
  [[2, 3]], [[0, 2]], [[0, 1], [2, 3]], [[1, 2]],
  [[1, 3]], [[0, 1]], [[0, 3]], [],
]

/**
 * The legal area's separate islands with smooth offset outlines and depth masses. Signed
 * clearance (distance to the cut line minus the spot radius, negative outside) is sampled on
 * a mesh once; islands are its regions above zero, masses its regions above the depth probe,
 * and every outline is the level crossing traced between samples (marching squares with
 * linear interpolation), so drawn edges follow the true offset curves, not mesh cells.
 * Centres are DEEPEST POINTS, so a crescent's centre sits in its arc, never the void.
 * A MEASUREMENT for display and scoring — magnet legality stays the exact per-point test.
 */
export function safeSegments(
  outer: ReadonlyArray<Pt>, spotRadiusMM: number, massDepthMM: number,
  detail: 'full' | 'light' = 'full',
): SafeSegment[] {
  if (outer.length < 3) return []
  // Dense traced outlines are decimated for this measurement — display grain, not legality.
  const MAXV = 800
  const k = Math.max(1, Math.ceil(outer.length / MAXV))
  const ring: Pt[] = []
  for (let i = 0; i < outer.length; i += k) ring.push(outer[i])
  const r = spotRadiusMM
  const signed = (p: Pt): number => {
    const d = edgeDistMM(ring, p)
    return pointInOuter(p, ring) ? d - r : -(d + r)
  }
  const step = 2 // mesh grain, mm
  const bb = bbox(ring)
  // One sample beyond the box on every side so outlines always close.
  const x0 = bb.minX - step, y0 = bb.minY - step
  const nx = Math.max(2, Math.round((bb.maxX - bb.minX) / step) + 3)
  const ny = Math.max(2, Math.round((bb.maxY - bb.minY) / step) + 3)
  const S = new Float64Array(nx * ny)
  for (let iy = 0; iy < ny; iy++)
    for (let ix = 0; ix < nx; ix++)
      S[iy * nx + ix] = signed([x0 + ix * step, y0 + iy * step])

  const key = (p: Pt) => (Math.round(p[0] / KEY_QUANTUM_MM) + ',' + Math.round(p[1] / KEY_QUANTUM_MM))
  const lerp = (pa: Pt, sa: number, pb: Pt, sb: number): Pt => {
    const t = sa / (sa - sb)
    return [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t]
  }

  /** Pull a ring point onto the exact offset curve (Newton on the signed field), so drawn
   *  outlines follow the true edge offset instead of the mesh's facets. */
  const snapToIso = (p: Pt, thr: number): Pt => {
    let q = p
    for (let it = 0; it < 2; it++) {
      const s = signed(q) - thr
      if (Math.abs(s) < 0.02) break
      const e = 0.5
      const gx = (signed([q[0] + e, q[1]]) - signed([q[0] - e, q[1]])) / (2 * e)
      const gy = (signed([q[0], q[1] + e]) - signed([q[0], q[1] - e])) / (2 * e)
      const g2 = gx * gx + gy * gy
      if (g2 < 1e-9) break
      q = [q[0] - s * gx / g2, q[1] - s * gy / g2]
    }
    return q
  }
  /** One midpoint per edge, then every point snapped to the exact curve. */
  const smoothLoop = (loop: Pt[], thr: number): Pt[] => {
    const dense: Pt[] = []
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i], b = loop[(i + 1) % loop.length]
      dense.push(a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])
    }
    return dense.map((p) => snapToIso(p, thr))
  }

  interface LevelItem { areaMM2: number; centreMM: Pt; meanMM: Pt; peakClearMM: number; bbox: BBox; rings: Pt[][]; deepIdx: number }
  /** Regions of S ≥ thr: connectivity, deepest point, bbox and traced outlines. */
  const level = (thr: number): { comp: Int32Array; items: LevelItem[] } => {
    const comp = new Int32Array(nx * ny).fill(-1)
    type Acc = { n: number; sx: number; sy: number; minX: number; minY: number; maxX: number; maxY: number; deepIdx: number; deepS: number }
    const accs: Acc[] = []
    for (let seed = 0; seed < nx * ny; seed++) {
      if (S[seed] < thr || comp[seed] >= 0) continue
      const id = accs.length
      const acc: Acc = { n: 0, sx: 0, sy: 0, minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, deepIdx: seed, deepS: -Infinity }
      accs.push(acc)
      const stack = [seed]
      comp[seed] = id
      while (stack.length) {
        const i = stack.pop()!
        const ix = i % nx, iy = (i / nx) | 0
        const px = x0 + ix * step, py = y0 + iy * step
        acc.n++
        acc.sx += px; acc.sy += py
        if (S[i] > acc.deepS) { acc.deepS = S[i]; acc.deepIdx = i }
        if (px < acc.minX) acc.minX = px; if (px > acc.maxX) acc.maxX = px
        if (py < acc.minY) acc.minY = py; if (py > acc.maxY) acc.maxY = py
        for (const j of [i - 1, i + 1, i - nx, i + nx]) {
          if (j < 0 || j >= nx * ny || comp[j] >= 0 || S[j] < thr) continue
          if (Math.abs((j % nx) - ix) > 1) continue // row wrap
          comp[j] = id
          stack.push(j)
        }
      }
    }
    // Level-crossing segments per mesh cell, lerped; chained into closed rings.
    // 'light' skips outlines entirely — scoring needs centres/areas/boxes, only display needs rings.
    const segs: Array<[Pt, Pt]> = []
    if (detail === 'light') {
      const at0 = (i: number): Pt => [x0 + (i % nx) * step, y0 + ((i / nx) | 0) * step]
      return {
        comp,
        items: accs.map((a) => ({
          areaMM2: a.n * step * step,
          centreMM: at0(a.deepIdx),
          meanMM: [a.sx / a.n, a.sy / a.n] as Pt,
          peakClearMM: a.deepS + r + thr,
          bbox: { minX: a.minX, minY: a.minY, maxX: a.maxX, maxY: a.maxY },
          rings: [],
          deepIdx: a.deepIdx,
        })),
      }
    }
    for (let iy = 0; iy < ny - 1; iy++) {
      for (let ix = 0; ix < nx - 1; ix++) {
        const i00 = iy * nx + ix, i10 = i00 + 1, i01 = i00 + nx, i11 = i01 + 1
        const s00 = S[i00] - thr, s10 = S[i10] - thr, s01 = S[i01] - thr, s11 = S[i11] - thr
        const m = (s00 >= 0 ? 1 : 0) | (s10 >= 0 ? 2 : 0) | (s11 >= 0 ? 4 : 0) | (s01 >= 0 ? 8 : 0)
        if (m === 0 || m === MS_CASES.length - 1) continue
        const ax = x0 + ix * step, ay = y0 + iy * step
        const P00: Pt = [ax, ay], P10: Pt = [ax + step, ay], P01: Pt = [ax, ay + step], P11: Pt = [ax + step, ay + step]
        // Crossing point on each cell edge: 0=top 1=right 2=bottom 3=left.
        const edge = (e: number): Pt =>
          e === 0 ? lerp(P00, s00, P10, s10)
            : e === 1 ? lerp(P10, s10, P11, s11)
              : e === 2 ? lerp(P01, s01, P11, s11)
                : lerp(P00, s00, P01, s01)
        for (const [ea, eb] of MS_CASES[m]) segs.push([edge(ea), edge(eb)])
      }
    }
    const byEnd = new Map<string, Array<[Pt, Pt]>>()
    for (const s of segs) {
      for (const p of [s[0], s[1]]) {
        const kk = key(p)
        const list = byEnd.get(kk)
        if (list) list.push(s); else byEnd.set(kk, [s])
      }
    }
    const used = new Set<[Pt, Pt]>()
    const loops: Pt[][] = []
    for (const s of segs) {
      if (used.has(s)) continue
      used.add(s)
      const loop: Pt[] = [s[0], s[1]]
      for (; ;) {
        const tail = loop[loop.length - 1]
        const cands = byEnd.get(key(tail)) ?? []
        const next = cands.find((c) => !used.has(c))
        if (!next) break
        used.add(next)
        loop.push(key(next[0]) === key(tail) ? next[1] : next[0])
        if (key(loop[loop.length - 1]) === key(loop[0])) break
      }
      if (loop.length > 3) loops.push(loop)
    }
    // Attach each ring to the region of the nearest qualifying sample.
    const compAt = (p: Pt): number => {
      let best = -1, bd = Infinity
      const ix0 = Math.max(0, Math.min(nx - 1, Math.round((p[0] - x0) / step)))
      const iy0 = Math.max(0, Math.min(ny - 1, Math.round((p[1] - y0) / step)))
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const ix = ix0 + dx, iy = iy0 + dy
        if (ix < 0 || ix >= nx || iy < 0 || iy >= ny) continue
        const i = iy * nx + ix
        if (comp[i] < 0) continue
        const d = (ix * step + x0 - p[0]) ** 2 + (iy * step + y0 - p[1]) ** 2
        if (d < bd) { bd = d; best = comp[i] }
      }
      return best
    }
    const ringsByComp: Pt[][][] = accs.map(() => [])
    for (const loop of loops) {
      const id = compAt(loop[0])
      if (id >= 0) ringsByComp[id].push(smoothLoop(loop, thr))
    }
    const at = (i: number): Pt => [x0 + (i % nx) * step, y0 + ((i / nx) | 0) * step]
    return {
      comp,
      items: accs.map((a, id) => ({
        areaMM2: a.n * step * step,
        centreMM: at(a.deepIdx),
        meanMM: [a.sx / a.n, a.sy / a.n] as Pt,
        peakClearMM: a.deepS + r + thr,
        bbox: { minX: a.minX, minY: a.minY, maxX: a.maxX, maxY: a.maxY },
        rings: ringsByComp[id],
        deepIdx: a.deepIdx,
      })),
    }
  }

  const iso0 = level(0)
  if (!iso0.items.length) return []
  const depthOff = Math.max(0, massDepthMM - r)
  const isoD = depthOff > 0 ? level(depthOff) : iso0
  const massesByIsland: SafeMass[][] = iso0.items.map(() => [])
  for (const m of isoD.items) {
    const islandId = iso0.comp[m.deepIdx]
    if (islandId >= 0) massesByIsland[islandId].push({ areaMM2: m.areaMM2, centreMM: m.centreMM, peakClearMM: m.peakClearMM, bbox: m.bbox, rings: m.rings })
  }
  const out: SafeSegment[] = iso0.items.map((it, id) => ({
    areaMM2: it.areaMM2,
    centreMM: it.centreMM,
    meanMM: it.meanMM,
    peakClearMM: it.peakClearMM,
    bbox: it.bbox,
    rings: it.rings,
    masses: massesByIsland[id].sort((a, b) => a.areaMM2 - b.areaMM2),
  }))
  out.sort((a, b) => a.areaMM2 - b.areaMM2)
  return out
}

/** Area centroid of a polygon (shoelace) — the material's weight centre. */
export function centroidOf(pts: ReadonlyArray<Pt>): Pt {
  let a2 = 0, sx = 0, sy = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const cross = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]
    a2 += cross
    sx += (pts[j][0] + pts[i][0]) * cross
    sy += (pts[j][1] + pts[i][1]) * cross
  }
  if (Math.abs(a2) < 1e-9) {
    let mx = 0, my = 0
    for (const p of pts) { mx += p[0]; my += p[1] }
    return [mx / pts.length, my / pts.length]
  }
  return [sx / (3 * a2), sy / (3 * a2)]
}

/** Is a point inside a mass's real outline? Box prescreen, then the traced ring. */
export function pointInMass(p: Pt, mass: { bbox: BBox; rings: Pt[][] }): boolean {
  if (p[0] < mass.bbox.minX || p[0] > mass.bbox.maxX || p[1] < mass.bbox.minY || p[1] > mass.bbox.maxY) return false
  if (!mass.rings.length) return true
  return mass.rings.some((ring) => pointInPolygon(p, ring as Pt[]))
}

/** Split seated nodes into perimeter belt and fully-surrounded interior. */
export function splitPerimeter(seated: ReadonlyArray<Pt>, step: number): { belt: Pt[]; interior: Pt[] } {
  const R = step * 1.45
  const belt: Pt[] = [], interior: Pt[] = []
  for (let i = 0; i < seated.length; i++) {
    const p = seated[i]
    let l = false, r = false, u = false, d = false
    for (let j = 0; j < seated.length; j++) {
      if (j === i) continue
      const dx = seated[j][0] - p[0], dy = seated[j][1] - p[1]
      if (Math.hypot(dx, dy) > R) continue
      if (dx > 1) r = true; else if (dx < -1) l = true
      if (dy > 1) u = true; else if (dy < -1) d = true
    }
    if (l && r && u && d) interior.push(p); else belt.push(p)
  }
  return { belt, interior }
}

/** Scale a normalized contour (longest side = 1mm) to a real longest side in mm. */
export function scaleContour(base: Contour, longestMM: number): Contour {
  return { outer: { pts: base.outer.pts.map(([x, y]) => [x * longestMM, y * longestMM] as Pt) }, holes: [] }
}
```

##### `src/lib/effect/grid-origin-logic.ts`

```ts
// grid-origin-logic.ts — LOGIC: policies. Reads what compute measured; weighs with spec's values.

import type { Pt } from './types'
import {
  BALANCE_WEIGHT,
  BANDS,
  FLAP_WEIGHT,
  MAGNET_DIA_LARGE_MM,
  MAGNET_DIA_SMALL_MM,
  MIN_ANCHORS,
  SEAT_WEIGHT,
  VOTING_ORDER,
} from './grid-origin-spec'
import { bbox, splitPerimeter, type SafeSegment } from './grid-origin-compute'
import type { Band } from './grid-origin-spec'

/** Which band a size falls in — dominant side against the band ranges. Null above the last. */
export function bandOf(sizeMM: number): Band | null {
  for (const b of BANDS) if (sizeMM >= b.minMM && sizeMM <= b.maxMM) return b
  return null
}

export type MagnetPlan = 'all6' | 'all8' | 'corners8'
export type MagnetDia = typeof MAGNET_DIA_SMALL_MM | typeof MAGNET_DIA_LARGE_MM

export interface Anchor { p: Pt; dia: MagnetDia }

/** Magnet count always governs — it is the band's step axis (Dan). The order only decides
 *  which force places the layout among equal counts: press-the-discs first, or centre first. */
export type VotingOrder = 0 | 1
const ORDERS: ReadonlyArray<readonly [number, number]> = [
  [FLAP_WEIGHT, BALANCE_WEIGHT], // magnets > wrap (press) > centring — default
  [BALANCE_WEIGHT, FLAP_WEIGHT], // magnets > centring > wrap (press)
]
export function registrationScore(
  seats: number, pressMM: number, balanceMM: number, order?: VotingOrder,
): number {
  const [pw, bw] = ORDERS[order ?? (VOTING_ORDER as VotingOrder)] ?? ORDERS[0]
  return seats * SEAT_WEIGHT - pressMM * pw - balanceMM * bw
}


export type CentreMode = 0 | 1 | 2 | 3 | 4 | 5
export type Governor = 0 | 1 | 2 | 3

/** Which mass rules — the switchable governor: 0 smallest area · 1 deepest · 2 top (gravity) ·
 *  3 top-small — RULED 2026-08-19: among masses in the shape's upper half the smallest governs;
 *  if nothing lives in the upper half, the topmost governs. The small mass needs the precision,
 *  the upper mass needs the anchor; a bottom sliver can never rule, and the governor stays
 *  stable across the size ladder. */
export function governMass<M extends { areaMM2: number; centreMM: Pt; peakClearMM?: number }>(
  masses: ReadonlyArray<M>, governor: Governor, midY?: number,
): M | null {
  if (!masses.length) return null
  if (governor === 3) {
    const mid = midY ?? Math.min(...masses.map((m) => m.centreMM[1]))
    const upper = masses.filter((m) => m.centreMM[1] >= mid)
    if (upper.length) return governMass(upper, 0)
    return governMass(masses, 2)
  }
  let best = masses[0]
  for (const m of masses) {
    if (governor === 0 && m.areaMM2 < best.areaMM2) best = m
    if (governor === 1 && (m.peakClearMM ?? 0) > (best.peakClearMM ?? 0)) best = m
    if (governor === 2 && m.centreMM[1] > best.centreMM[1]) best = m
  }
  return best
}

/**
 * The centres a mode aims at — the switchable test system. Every returned point both anchors
 * the slide walk and (for single-target modes) is the balance target. Mode 2 returns every
 * mass centre; its balance target is then the governing mass via centeringRef.
 */
export function centeringAnchors(
  mode: CentreMode,
  segments: ReadonlyArray<SafeSegment>,
  boxCentre: Pt,
  weightCentre: Pt,
): Pt[] {
  if (mode === 0) return [boxCentre]
  if (mode === 3) return [weightCentre]
  if (!segments.length) return [boxCentre]
  if (mode === 1) {
    // The whole erosion area's centre — area-weighted mean of the islands' means.
    let n = 0, sx = 0, sy = 0
    for (const seg of segments) { n += seg.areaMM2; sx += seg.meanMM[0] * seg.areaMM2; sy += seg.meanMM[1] * seg.areaMM2 }
    return [[sx / n, sy / n]]
  }
  if (mode === 4) {
    // The single most buried point of the shape.
    let best = segments[0]
    for (const seg of segments) if (seg.peakClearMM > best.peakClearMM) best = seg
    return [best.centreMM]
  }
  const masses = segments.flatMap((seg) => (seg.masses.length ? seg.masses : [seg]))
  if (mode === 5) {
    // Gravity: the highest mass governs.
    let top = masses[0]
    for (const m of masses) if (m.centreMM[1] > top.centreMM[1]) top = m
    return [top.centreMM]
  }
  // Mode 2 — adaptive: every mass centre anchors; scoring chooses between them.
  return masses.map((m) => m.centreMM)
}

/**
 * The centring target — Dan's rule: THE SMALLEST MASS THAT HOLDS A MAGNET GOVERNS; the grid
 * centres on its deepest point. The roomy masses adapt; an unused sliver can never hijack.
 * Null when no seated magnet lands in any mass — the caller falls back to the box centre.
 */
export function centeringRef(
  segments: ReadonlyArray<SafeSegment>, seated: ReadonlyArray<Pt>,
  inMass: (p: Pt, mass: { bbox: SafeSegment['bbox']; rings: Pt[][] }) => boolean,
  governor: Governor,
  midY?: number,
): { centreMM: Pt; bbox: SafeSegment['bbox']; rings: Pt[][] } | null {
  const holding: Array<{ areaMM2: number; centreMM: Pt; peakClearMM: number; bbox: SafeSegment['bbox']; rings: Pt[][] }> = []
  for (const seg of segments) {
    const masses = seg.masses.length ? seg.masses : [seg]
    for (const m of masses) if (seated.some((p) => inMass(p, m))) holding.push(m)
  }
  return governMass(holding, governor, midY)
}

/** Perimeter belt: with >4 seated, drop fully-surrounded interior nodes, never below the minimum. */
export function applyCoverage(
  seated: Pt[],
  perimeterOnly: boolean,
  pitch: number,
): { seated: Pt[]; interior: Pt[] } {
  if (!perimeterOnly || seated.length <= 4) return { seated, interior: [] }
  const split = splitPerimeter(seated, pitch)
  if (split.belt.length >= MIN_ANCHORS) return { seated: split.belt, interior: split.interior }
  return { seated, interior: [] }
}


/** Per-anchor magnet size. corners8 → the large body on the extreme corners, small elsewhere. */
export function assignSizes(seated: Pt[], plan: MagnetPlan): Anchor[] {
  if (plan === 'all8') return seated.map((p) => ({ p, dia: MAGNET_DIA_LARGE_MM }))
  if (plan === 'all6') return seated.map((p) => ({ p, dia: MAGNET_DIA_SMALL_MM }))
  const bb = bbox(seated)
  return seated.map((p) => {
    const ex = Math.abs(p[0] - bb.minX) < 0.6 || Math.abs(p[0] - bb.maxX) < 0.6
    const ey = Math.abs(p[1] - bb.minY) < 0.6 || Math.abs(p[1] - bb.maxY) < 0.6
    return { p, dia: ex && ey ? MAGNET_DIA_LARGE_MM : MAGNET_DIA_SMALL_MM }
  })
}


```

##### `src/lib/effect/grid-origin-bridge.ts`

```ts
// grid-origin-bridge.ts — UI bridge: shape preparation and display lists for the bench shell.
// Wiring only — values from spec, geometry from compute, answers from the engine.

import { contourFromShape } from './geometry-truth'
import { traceContourRaw } from './contour'
import { insetRingMM } from './offset'
import { scaleContour } from './grid-origin-compute'
import { flattenShape, type VShape } from '@/lib/vector-core'
import type { Contour, Pt } from './types'
import {
  fieldSpanMM,
  latticeOver,
  MIN_EFFECT_MM,
  SIZE_CEIL_MARGIN_MM,
  type GridResult,
} from './grid-origin'

/** Flatten reference: curves are flattened as if cut at this size, THEN normalized, so the 0.05mm
 *  manufacturing tolerance holds at every slider size. */
const FLATTEN_REF_MM = 250

function bboxOf(pts: ReadonlyArray<{ x: number; y: number }>) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity
  for (const p of pts) { if (p.x < a) a = p.x; if (p.x > c) c = p.x; if (p.y < b) b = p.y; if (p.y > d) d = p.y }
  return { w: c - a, h: d - b }
}

/** VShape → mm contour normalized so its longest side = 1mm, flattened at manufacturing scale. */
export function normBaseContour(vs: VShape, maskHeightPx: number): Contour | null {
  const rings = flattenShape(vs, 1)
  const bb = bboxOf(rings[0] ?? [])
  const L = Math.max(bb.w, bb.h, 1)
  const c = contourFromShape(vs, { mmPerPx: FLATTEN_REF_MM / L, maskHeightPx })
  if (!c) return null
  return { outer: { pts: c.outer.pts.map(([x, y]) => [x / FLATTEN_REF_MM, y / FLATTEN_REF_MM] as Pt) }, holes: [] }
}

/** Sizer for one base contour: real-mm contour at any longest side, outline offset applied. */
export function makeSizer(base: Contour, offsetMM: number): (mm: number) => Contour {
  return (mm: number): Contour => {
    const c = scaleContour(base, mm)
    if (!offsetMM) return c
    const o = insetRingMM(c.outer.pts, offsetMM, 'round')
    return o && o.length >= 3 ? { outer: { pts: o }, holes: [] } : c
  }
}

/** Finished-cutout path: alpha mask (image px, y-down) → traced outline → base contour
 *  normalized to longest side = 1mm, y-up. No AI — the outline IS the mask's edge. */
export function normMaskContour(mask: Uint8Array, w: number, h: number): Contour | null {
  const raw = traceContourRaw(mask, w, h)
  if (!raw || raw.length < 3) return null
  // A raw half-pixel trace carries thousands of points; the engine's cost scales with them.
  // Decimate to the same order the AI path's flatten produces — sub-0.2mm fidelity at product
  // sizes, ~10x cheaper solves.
  const MAXV = 600
  const k = Math.max(1, Math.ceil(raw.length / MAXV))
  const ring: typeof raw = []
  for (let i = 0; i < raw.length; i += k) ring.push(raw[i])
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of ring) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  const L = Math.max(maxX - minX, maxY - minY, 1)
  return { outer: { pts: ring.map(([x, y]) => [(x - minX) / L, (maxY - y) / L] as Pt) }, holes: [] }
}

/** Generated polygon ring (image px, y-down) → mm contour normalized to 1mm, y-up. */
export function normGeneratedRing(ring: ReadonlyArray<readonly [number, number]>, imgH: number): Contour | null {
  if (ring.length < 3) return null
  const bb = bboxOf(ring.map(([x, y]) => ({ x, y })))
  const L = Math.max(bb.w, bb.h, 1)
  return { outer: { pts: ring.map(([x, y]) => [x / L, (imgH - y) / L] as Pt) }, holes: [] }
}

/** The size range a surface may offer — the fixed board plus a margin so shapes can pad past it. */
export function sizeRange(padMM: number): { minMM: number; maxMM: number } {
  return { minMM: MIN_EFFECT_MM, maxMM: fieldSpanMM(padMM) + SIZE_CEIL_MARGIN_MM }
}
/** One drawable spot: engine-space centre, radius, and whether a magnet seats there. */
export interface FieldSpot {
  readonly x: number
  readonly y: number
  readonly r: number
  readonly held: boolean
}

/** Every lattice position over a region as a display list, on the engine's own phase.
 *  Phase is re-anchored on a real answer point: the generator's phase is relative to the region's
 *  min, so the same phase over a different region would be a different absolute lattice. */
export function fieldSpots(
  grid: GridResult,
  view: { minX: number; minY: number; maxX: number; maxY: number },
): FieldSpot[] {
  const anchorAt = new Map(grid.anchors.map((a) => [a.p[0].toFixed(2) + ',' + a.p[1].toFixed(2), a]))
  const A = grid.anchors[0]?.p ?? grid.lattice[0]
  if (!A) return []
  const pad = grid.spotRadiusMM
  const rgn = { minX: view.minX - pad, minY: view.minY - pad, maxX: view.maxX + pad, maxY: view.maxY + pad }
  return latticeOver(rgn, grid.pitchCentreMM, [A[0] - rgn.minX, A[1] - rgn.minY]).map((n) => {
    const a = anchorAt.get(n[0].toFixed(2) + ',' + n[1].toFixed(2))
    return { x: n[0], y: n[1], r: grid.spotRadiusMM, held: Boolean(a) }
  })
}

/** The seated spots alone — what a surface draws when the full field is off. */
export function seatedSpots(grid: GridResult): FieldSpot[] {
  return grid.anchors.map((a) => ({ x: a.p[0], y: a.p[1], r: grid.spotRadiusMM, held: true }))
}

```
## 1. Product goal

The engine is one portable three-rule driver:

1. **CENTRE** — at each candidate physical scale, derive one governed centre from that scaled shape alone, before magnets exist. Place the lattice rigidly on that centre: odd line count puts a node on it; even line count puts the gap/centering line on it. The centre may change with physical scale because the safe core/masses change; it may never change because magnets landed somewhere.
2. **WRAP** — every perimeter-belt disc touches the outline within the configured flap allowance. `0` means exact spot-edge tangency on the ruled source geometry; neither outline-source uncertainty nor size-walk quantum becomes hidden wrap tolerance. Auto flap returns the smallest allowance that makes the layout lawful.
3. **MAGNET-QUANTITY SCALING** — within each band, expose every new magnet count at its first exact contact-event scale where that count is simultaneously centred and wrapped. Scale is solved from the contact equation, never searched on a millimetre grid. Counts are unique and strictly increasing. A count first lawful in a lower band never reappears above worn loose.

There is no score, weight, blended preference, silent fallback, or “best attempt” in the production driver. When no lawful layout exists, the engine returns a typed refusal. Fixed-size/manual inspection returns measured concessions; it does not invent a product winner.

Dan's separate gravity ruling is a mechanical invariant, not a hidden fourth driver: among candidates identical on centre, wrap, count, and required allowance, vertical eliminates horizontal. If multiple candidates remain equal after gravity, the engine returns all of them; it never manufactures a winner from coordinate order.

## 2. Governing directive set

The contract must deliver all of these together:

- Build v3.5.1 as a separately selectable comparison path first.
- Treat Voting/scoring as untrusted visual comparator evidence only. Treat accepted Centre-rules centering outputs as the trusted behavioral baseline while its shared door/worker and named 2mm-ruler defects remain untrusted infrastructure. Do not modify either current path during proof.
- Use the proved centering-tab enforcement as the behavioral base: preserve/re-room its accepted centre-rule/governor/parity canon, replace only its documented corrupt measurements/shared infrastructure, prove centre equivalence first, then add Wrap and Magnet-quantity scaling.
- Enforce the three laws as code invariants, not UI descriptions.
- Make every exposed control true to its label.
- Make every concession explicit.
- Split the implementation into portable `spec → compute → logic → engine API`; UI reaches it only through a bridge.
- End R15 with one isolated working Law runtime beside the frozen Voting/Centre-rules comparators.
- Product cut-over, deletion and any one-engine migration require a separate later contract if and when Dan authorizes that work; they are not R15 build tasks.

## 3. Necessity baseline — the smallest complete rebuild

### Required additions

One canonical portable package and one product/bench bridge:

```text
src/lib/magnetic-grid/
  spec.ts
  compute.ts
  compute/
    seat.ts
    centre-evidence.ts
    exact-real.ts      # only if Support A is invoked
    regimes.ts         # only if Support B is invoked
    contact-root.ts    # only if Support A/B is invoked
    identity.ts        # only when a live result/cache consumer requires it
  logic.ts
  engine.ts

src/lib/effect/magnetic-grid-bridge.ts
src/app/(dev)/effect-creator/grid-origin/law.worker.ts
src/app/(dev)/effect-creator/grid-origin/LawPanel.tsx
```

This is the approved maximum root, not a command to create empty or speculative modules. T1 creates only the files needed for the full isolated clone. T2 creates only the owners needed to re-room bodies that already exist. T3 creates a new module only when a live Centre/Wrap/scaling consumer or conditional Support A/B requires it. No stub, unused public surface or foundation-only file enters the build.

The existing `grid-origin` page is the shared comparison shell. Its three positioning labels are currently one persisted `positioning` switch inside one shared page model, Stage, request builder and worker—not three isolated tab components. T1 materializes the existing third **Law** selection as a complete isolated vertical clone of Centre-rules: full visible tab UI, controls, local state, request assembly, worker execution/cache branch, rendered evidence surface, `positioning===1` engine branch and its dependency closure. Voting, Centre-rules, their page state, current worker and current modules remain untouched; the existing selector gains only the mount dispatch that opens the isolated `LawPanel`. The old in-place `positioning===2` branch becomes dormant evidence outside the new runtime. T2 re-rooms the cloned engine beneath that live surface; T3 repairs Centre then adds Wrap and scaling; T4 replaces the cloned worker/request/UI internals with final bridge-owned orchestration and view models without changing the already-live Law behavior. No fourth tab or second page is required.

### Required reuse

**Baseline rule:** the isolated Law package starts from the embedded `8d17780c` Centre-rules (`positioning===1`) dependency closure. No body reachable only from Voting (`positioning===0`), `registrationScore`, scoring weights/orders, phase sweep or `centeringRef` may be moved or adapted into Law. Voting is comparison evidence only. Independently proven Wrap/scaling behavior from the old in-place Law branch may be adapted later, but that branch is not the structural baseline.

**Clone-then-re-room order:** first clone the Centre-rules behavioral slice and prove it still produces the accepted centre outputs. Then re-room those same bodies into spec/compute/logic/engine under the dispositions below. Only after the re-roomed centre gate passes may the faulty centre ruler be adapted, then Wrap added, then Magnet-quantity scaling added. This is not bottom-up replacement followed by an equivalence test; the preserved implementation is the starting material.

**Full vertical clone boundary:** the T1 clone begins at the current `grid-origin/page.tsx` Centre-rules experience and ends at the bodies that produce and render its result. It includes the shared visible bench surface needed to operate Centre-rules, its Centering controls and evidence display, its local state/defaults, newest-only request queue, request/config assembly, the relevant `solve.worker.ts` cache/band/replay/prefetch execution, `grid-origin.ts positioning===1`, and every reachable body in `grid-origin-spec.ts`, `grid-origin-compute.ts`, `grid-origin-logic.ts` and `grid-origin-bridge.ts`. The isolated clone substitutes only file/import names, request identity and persisted namespace; every cloned function body and JSX subtree is copied from the embedded donor snapshot before re-rooming. It imports or calls no current `grid-origin*` runtime or current worker. Voting-only bodies and the existing `positioning===2` branch are excluded. The original Centre-rules tab and isolated Law clone remain separately selectable throughout T1-T4 so every code change is immediately observable against the frozen baseline.

**What centering is preserved versus repaired:** preserve `governMass` branch semantics, the governor set, centre-rule branch meanings, node/gap parity canon and all four centred placements. T1 clones the current governor body verbatim; T2 re-rooms it without behavioral change. T3 adapts only the measurement bodies proved wrong. If the live repair needs exact comparison, Support A supplies only that minimum. The known ruler defect is current `safeSegments`: it samples clearance on a fixed 2mm mesh anchored to each scaled bbox, so its argmax jumps between samples as scale changes. Measured result: mesh centre left ~0.069mm contact residue; an exactly computed centre reduced it to ~0.000055mm reporting noise. Because erosion/mass depth is a fixed physical millimetre value while the shape scales, the mass map genuinely changes per scale; computing one normalized centre and scaling it is not equivalent.

Clone a current function body only when the embedded source and disposition table classify it for the current phase; do not alter its current consumers. The clone is temporary. Initial donor candidates are the exact segment-seat kernel, pure bbox traversal and contour scaling. The current mesh-derived centre evidence, `splitPerimeter`, float tangency/gap helpers, scoring helpers and shape adapters are source evidence—not pre-approved reuse.

Every cloned body receives exactly one disposition while T1 is built: `MOVE-VERBATIM` (function text copied from the embedded donor), `ADAPT` (only the named file/import/request-identity/persisted-namespace substitution), or `EXCLUDE` (Voting-only, old-Law-only or outside the Centre-rules closure). “Where possible”, silent rewrite and unclassified code are forbidden.

### Untangle map — current source to Law owner

| Current body | Disposition | Law destination and proof |
|---|---|---|
| `grid-origin.ts parityHolds` | MOVE-VERBATIM in T1; ADAPT only during a named T3 repair | `logic.ts parityIsLawful`; preserve donor behavior until the repair step |
| `grid-origin.ts` Centre-rules four parity placements | MOVE-VERBATIM in T1; RE-ROOM without behavior change in T2 | neutral placement measurements in compute; centre-law acceptance in logic; no ruler/Wrap/scaling change during the move |
| `grid-origin.ts` Law ranking (`lawful → count → press → gravity`) | ADAPT only when T3 adds Wrap/scaling | `logic.ts chooseLawfulCandidate`; existing `positioning===2` is not a T1/T2 donor |
| `grid-origin.ts bandWalk` gate/refinement/no-repeat | MOVE reached Centre-rules behavior through T1/T2; ADAPT only when T3 adds scaling | T1/T2 preserve the sampled walk and `seatMarginMM`; T3 replaces only behavior required by the live first-lawful-size implementation |
| `grid-origin.ts autoFlapInBand` | MOVE reached Centre-rules behavior through T1/T2; ADAPT only when T3 adds Wrap | T1/T2 preserve the allowance scan; T3 replaces only behavior required by the live Wrap implementation |
| `grid-origin-logic.ts centeringAnchors` | MOVE-VERBATIM in T1; RE-ROOM without behavior change in T2; repair only named measurement defects in T3 | arithmetic owner `compute/centre-evidence.ts`; `logic.ts evaluateCentreLaw` owns the same ruled branch |
| `grid-origin-logic.ts governMass` | MOVE-VERBATIM in T1; RE-ROOM representation only in T2 | preserve identical governor branches/decisions; no new comparator unless live T3 code invokes Support A |
| `grid-origin-logic.ts assignSizes` | ADAPT only when a live T3 result consumes it | extrema/corner measurements in `compute/seat.ts`; magnet-plan policy in `logic.ts` |
| `grid-origin-compute.ts splitPerimeter` | ADAPT only when live Coverage/Wrap code consumes it | neighbour measurements in `compute/seat.ts`; belt classification in `logic.ts`; no speculative reach value |
| `solve.worker.ts` request queue/cache/band/replay/prefetch execution reachable from Centre-rules | MOVE-VERBATIM into isolated T1 `law.worker.ts` clone, then REPLACE at T4 | T4 bridge service becomes the one Law orchestration owner and final `law.worker.ts` transports only. Voting-only and `positioning===2` worker branches never enter the clone |
| `page.tsx circle:` + `makeCircleSeatPredicate` | MOVE reached Centre-rules behavior through T1/T2 | preserve analytic-circle seating for clone/re-room equivalence; T3 may replace it only as a named boundary-law change |
| `seatMarginMM` in page/worker/`computeGrid`/band walk | MOVE reached Centre-rules behavior through T1/T2 | preserve the worker's positioning-1 seat-inflation path; T3 may replace it only when live Centre/Wrap code supplies the replacement |
| exact segment-seat kernel, pure bbox traversal, contour scaling | candidate MOVE-VERBATIM when reached by the live clone/build | destination follows the import law; donor/copy function text remains equal |
| `registrationScore`, `ORDERS`, weights, `centeringRef`, placement sweep, voting state | EXCLUDE from the new Law runtime | no Law destination; they belong only to the frozen comparator source |

The untangle table plus T1 ADAPT-EXTRACT map is closed. No body, state owner, request/result field or dependency row may be added during T1/T2 without revising R15 first.

### Elements explicitly preserved

- Perimeter-belt coverage: native product behavior, not slop.
- Magnet plan/diameters: product output configuration, not a ranking force.
- Shape-source and cutout-library bench adapters.
- Legal-area/mass visualization needed to verify centre selection.
- Full-grid visualization as diagnostics; wrap is always belt-scoped.

### Canonical-root decision

`src/lib/magnetic-grid/` is the engine build root. `src/lib/grid-engine/` is neither a destination nor an allowed dependency of the portable package. Reuse is **kernel reuse only**: a body enters only when the clone-authority gate classifies it and the current build phase has a live consumer. The old spec values, bridge contract, candidate/offer result shapes, registration doctrine, package manifests and unrelated active-lane work are outside this engine build.

## 4. Non-goals

- No template catalogue driving search.
- No semantic shape names inside compute.
- No scoring or configurable weights.
- No continuous placement sweep.
- No unruled default layout recommendation inside a band.
- No non-semantic geometry-key winner. Co-lawful layouts are returned with stable identities; deterministic ordering is not product selection.
- No fulfilment, manufacturing-order, or cutout-engine migration in this increment.
- No production publication, cut-over or deletion in this engine build contract.

## 5. Final architecture

```text
UI (React / admin bench)
  ↓ display actions only
magnetic-grid-bridge.ts
  - contour adapters
  - worker request service + cache identity
  - maps engine results to drawable view models
  ↓ one public engine API
magnetic-grid/engine.ts
  - orchestrates centre → parity candidates → laws → band ladder
  ↓                 ↓
logic.ts          compute.ts
  policy only       geometry only
  ↑                 ↑
          spec.ts
          values + data contracts only
```

### Import law

| File | May import |
|---|---|
| `spec.ts` | nothing |
| `compute.ts` | `spec.ts` and `compute/*` public barrels only; no implementation |
| `compute/exact-real.ts` | `spec.ts` only |
| `compute/seat.ts` | `spec.ts`, `compute/exact-real.ts` |
| `compute/centre-evidence.ts` | `spec.ts`, `compute/exact-real.ts`, `compute/seat.ts` |
| `compute/regimes.ts` | `spec.ts`, `compute/exact-real.ts`, `compute/seat.ts`, `compute/centre-evidence.ts` |
| `compute/contact-root.ts` | `spec.ts`, `compute/exact-real.ts`, `compute/seat.ts`, `compute/centre-evidence.ts`, `compute/regimes.ts` |
| `compute/identity.ts` | `spec.ts`, `compute/exact-real.ts` |
| `logic.ts` | `spec.ts` types/measured records plus only `compareExact` from `compute.ts`; no geometry functions or other compute import |
| `engine.ts` | `spec.ts`, `compute.ts`, `logic.ts` |
| `magnetic-grid-bridge.ts` | public `engine.ts`, shape/vector adapters |
| `law.worker.ts` | T1-T3: isolated clone of the Centre-rules worker execution/cache branch; T4 onward: Law bridge service only. The current worker is outside the new package and unchanged during proof |
| `LawPanel.tsx` | T1-T3: isolated full UI/state/request/render clone used as the live equivalence harness; T4 onward: Law bridge view model, actions and control metadata only; never imports current `grid-origin*` runtime |
| existing page | existing comparator imports plus `LawPanel`; its existing three-way selector owns only the selection/mount dispatch. Its pre-existing Voting/Centre-rules source regions, state and worker remain unchanged |

The separation guard parses imports and ASTs. A convention comment is not enforcement. Its phase profile is explicit: T1 first proves the isolated vertical clone and forbids any runtime edge back to current `grid-origin*`; T2 makes the portable package obey the final import DAG as its bodies are re-roomed; T4 makes `law.worker.ts` transport-only and `LawPanel.tsx` bridge-only. A later profile may tighten an earlier profile but never waive comparator immutability or portable-package separation.

## 8. Control truth contract

| Control | Engine meaning | Required proof |
|---|---|---|
| Band B1-B4 | restrict exact contact-event scale range | every user-selectable band exercised; no cross-band repeat or boundary double-owner |
| Flap fixed | exact maximum worst-belt gap | 0 admits only a certified contact witness; no guard |
| Flap Auto | smallest exact required allowance, capped | 1mm need returns 1mm, never 2mm |
| Centre rule (comparison only) | chooses centre from shape evidence before seats | seat changes cannot change centre |
| Coverage | changes output population only; wrap stays belt-scoped | full/perimeter share wrap truth |
| Magnet plan | changes body diameters only | positions/counts unchanged |
| Manual drag | diagnostic forced phase | concessions measured and visible |
| Outline offset | changes input contour before solve | cache identity and result change |
| Source accuracy readout | evidence about how the contour was produced | never changes wrap law unless Dan separately rules a product allowance |

The comparison tab exposes only controls that map truthfully to the live engine build.
