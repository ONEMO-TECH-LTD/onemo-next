'use client'

// cutout-lab/flow-bindings.ts — the FLOW LAYER of the v2 lab (Meta F1): thin hooks that COMPOSE the
// pool's modules over the v5.3.1 bridge and expose { state, actions } to the shell. BINDING only —
// every law lives in the pool (bridge-compose-policy, bridge-paint-flow, bridge-tool-commit,
// bridge-tool-queue), every pixel in the engine (composeEffectArtwork, prepareAI). The page stays
// render + gesture. Structure: engine < tool modules < bridge flow (THIS file) < shell.

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { VShape } from '@/lib/vector-core'
import { solidShapeMask, PAINT_DEFAULTS, type PaintConfig } from '@/lib/tool-paint-math'
import type { Mask } from '@/lib/tool-paint-math/types'
import { paintPlan, shapeTruthNormalize, eraseWouldDestroy } from '@/lib/bridge-paint-flow'
import { prepareAI } from '@/lib/engine-matte-input'
import { ToolCommitSeam } from '@/lib/bridge-tool-commit'
import { ToolQueue, withTimeout, T_COMPUTE_MS } from '@/lib/bridge-tool-queue'
import {
  BLEND_POLICY_DEFAULTS, neutralNoComposite, outgrown, ComposeScheduler, type Bounds,
} from '@/lib/bridge-compose-policy'
import type { PreparedEffect } from '@/lib/effect/prepare-effect'
import { useOutlineStore } from '../effect-creator/v5.3.1/user/outlineStore'

type SpecDraft = PreparedEffect['spec']

export type LabNotify = (kind: 'warn' | 'error' | 'info', message: string) => void

// ── PAINT binding: stroke → plan → guards → engine seam → committed into the bridge session ──────
export interface PaintBinding {
  state: {
    mask: Mask | null
    baseMask: Mask | null            // explicit tool mask, else derived from the outline (mask ≡ shape)
    paintPrepared: PreparedEffect | null
    paintCfg: PaintConfig
  }
  actions: {
    strokeCommit: (stroke: { x: number; y: number }[], erase: boolean, brushPx: number) => void
    /** node/frame edits: an edited VShape through the SAME seam — mask ≡ shape (safe by geometry),
     *  matte re-prepared by the engine, committed into the bridge session (nodeCommitPlan semantics). */
    shapeCommit: (next: VShape, okMsg?: string) => void
    invalidate: () => void
  }
}

export function usePaintBinding(args: {
  artworkUrl: string | undefined
  spec: SpecDraft | null | undefined
  display: VShape | null
  traced: boolean
  imgW: number
  imgH: number
  notify: LabNotify
}): PaintBinding {
  const { artworkUrl, spec, display, traced, imgW, imgH, notify } = args
  const [mask, setMask] = useState<Mask | null>(null)
  const [paintPrepared, setPaintPrepared] = useState<PreparedEffect | null>(null)
  const urlRef = useRef<string | undefined>(undefined)
  const lastPaintSpecRef = useRef<unknown>(null)
  // stable sink: a plain holder (not a ref) so the queue/seam callbacks read the CURRENT notify at
  // call time without touching a ref during render.
  const [sink] = useState<{ notify: LabNotify }>(() => ({ notify }))
  useEffect(() => { urlRef.current = artworkUrl }, [artworkUrl])
  useEffect(() => { sink.notify = notify }, [sink, notify])

  const paintCfg = PAINT_DEFAULTS
  const baseMask = useMemo(
    () => mask ?? (traced && display ? solidShapeMask(display, imgW, imgH) : null),
    [mask, traced, display, imgW, imgH],
  )
  const baseMaskRef = useRef(baseMask)
  useEffect(() => { baseMaskRef.current = baseMask }, [baseMask])

  // lazy singletons (useState initializer — created once, no ref reads in render)
  const [seam] = useState(() => new ToolCommitSeam<PreparedEffect>((m) =>
    withTimeout(prepareAI(urlRef.current!, m), T_COMPUTE_MS, 'paint prepare')))
  const [queue] = useState(() => new ToolQueue(
    () => sink.notify('info', '⏳ your stroke is queued'),
    (e) => sink.notify('error', `tool failed: ${(e as Error)?.message ?? e}`),
  ))

  const invalidate = useCallback(() => {
    setMask(null); setPaintPrepared(null); seam.invalidate()
  }, [seam])

  // a spec change NOT born from a paint commit (Detect / new upload) invalidates the tool state
  useEffect(() => {
    if (spec === lastPaintSpecRef.current) return
    invalidate()
  }, [spec, invalidate])

  const strokeCommit = useCallback((stroke: { x: number; y: number }[], erase: boolean, brushPx: number) => {
    queue.run(async () => {
      const base = baseMaskRef.current
      const out = paintPlan(base, stroke, brushPx, erase, imgW, imgH, paintCfg)
      if (out.kind === 'nothing-to-erase') { sink.notify('warn', 'nothing to erase yet — paint a shape first'); return }
      if (erase && base && eraseWouldDestroy(base, out.mask)) { sink.notify('warn', 'that erase would remove almost everything — kept your shape'); return }
      const res = await seam.commit(out.mask)
      if (res.kind === 'stale') return
      if (res.kind === 'kept') { sink.notify('warn', `kept your selection — ${res.reason}`); return }
      const { prepared: p } = res
      // SHAPE-IS-TRUTH (paint sources only): the resolved outline is the one truth; islands drop loudly
      const truth = shapeTruthNormalize(res.mask, p.spec.vectorShape, imgW, imgH)
      if (truth.separateRegionDropped) sink.notify('warn', 'a SEPARATE region was dropped — bridge it to the main shape')
      setMask(truth.mask)
      setPaintPrepared(p)
      lastPaintSpecRef.current = p.spec
      // committed state enters the BRIDGE's session: setSpec → the editor composer re-seeds source
      // (its own history push) — ONE history, the bridge's. Matte published for the flow's blend latch.
      const st = useOutlineStore.getState()
      st.setSpec(p.spec)
      try { st.setSubjMatteUrl(p.frontSrc.subjCanvas.toDataURL()) } catch { /* matte stays unset */ }
      sink.notify('info', erase ? 'erased — outline updated' : 'painted — outline updated')
    })
  }, [imgW, imgH, paintCfg, queue, seam])

  // shared tail for shape-sourced edits (nodes/frame): mask ≡ shape, then the same seam pipeline
  const shapeCommit = useCallback((next: VShape, okMsg = 'shape updated') => {
    queue.run(async () => {
      const m = solidShapeMask(next, imgW, imgH)
      const res = await seam.commit(m)
      if (res.kind === 'stale') return
      if (res.kind === 'kept') { sink.notify('warn', `kept your shape — ${res.reason}`); return }
      const { prepared: p } = res
      setMask({ data: m.data, w: m.w, h: m.h })
      setPaintPrepared(p)
      lastPaintSpecRef.current = p.spec
      const st = useOutlineStore.getState()
      st.setSpec(p.spec)
      try { st.setSubjMatteUrl(p.frontSrc.subjCanvas.toDataURL()) } catch { /* matte stays unset */ }
      sink.notify('info', okMsg)
    })
  }, [imgW, imgH, queue, seam])

  return {
    state: { mask, baseMask, paintPrepared, paintCfg },
    actions: { strokeCommit, shapeCommit, invalidate },
  }
}

// ── COMPOSE binding: the pool's laws + scheduler over the ENGINE's own compose op ────────────────
export interface ComposedFrame { url: string; x: number; y: number; w: number; h: number }

export function useComposeBinding(args: {
  traced: boolean
  display: VShape | null
  prepared: PreparedEffect | null
  blendVal: number
  fillTile: boolean
  imgW: number
  imgH: number
  bounds: Bounds | null
}): { composed: ComposedFrame | null; setDragging: (on: boolean) => void } {
  const [composed, setComposed] = useState<ComposedFrame | null>(null)
  const inputs = useRef(args)
  useEffect(() => { inputs.current = args })
  const [sched] = useState(() =>
    new ComposeScheduler(async (cancelled) => {
      const { traced, display, prepared, blendVal, fillTile, imgW, imgH, bounds } = inputs.current
      if (!traced || !display || !prepared || !bounds) { setComposed(null); return }
      const matteless = prepared.spec.generator.adapter === 'alpha' || prepared.spec.generator.adapter === 'bg-flood'
      const blend = matteless ? 0 : blendVal
      // the pool's laws: blend-0 = no compositor UNLESS the outline outgrew the frame
      if (neutralNoComposite({ ...BLEND_POLICY_DEFAULTS, blend }) && !outgrown(bounds, imgW, imgH)) { setComposed(null); return }
      const { origCanvas, subjCanvas } = prepared.frontSrc
      const k = origCanvas.width / imgW
      const texH = origCanvas.height
      const bUp = { minX: bounds.minX * k, minY: texH - bounds.maxY * k, maxX: bounds.maxX * k, maxY: texH - bounds.minY * k }
      const { composeEffectArtwork } = await import('@/lib/effect/composite')
      if (cancelled()) return
      const { canvas, frame } = await composeEffectArtwork({
        originalCanvas: origCanvas,
        subjectCanvas: subjCanvas,
        outputBoundsPx: bUp,
        blendPercent: blend,
        fillMode: fillTile ? 'tile' : 'clamp',
      })
      if (cancelled()) return
      // F2 note: toDataURL churns big base64 on phones — object URLs / direct canvas refs are the
      // upgrade when the render path can consume them.
      setComposed({
        url: canvas.toDataURL(),
        x: frame.originX / k,
        y: (texH - (frame.originY + frame.height)) / k, // y-up frame → y-down mask space
        w: frame.width / k,
        h: frame.height / k,
      })
    }))
  const { traced, display, prepared, blendVal, fillTile, imgW, imgH, bounds } = args
  useEffect(() => { sched.schedule() }, [sched, traced, display, prepared, blendVal, fillTile, imgW, imgH, bounds])
  useEffect(() => () => sched.cancel(), [sched])
  const setDragging = useCallback((on: boolean) => sched.setDragging(on), [sched])
  return { composed, setDragging }
}

// ── CONTROL BEHAVIORS binding: bridge-control-surface's rulings over the descriptor session ─────
// AUTO_KNOBS (Dan 2026-08-06: default config for ANY shape — offset 3, the rest 10, detail
// UI-inverted) applied ONCE per upload's first cut; auto-blend-on-outgrowth (value-true: the knob
// SHOWS the engaged blend; a user's re-zero stands until the next transition into outgrowth).
import { AUTO_KNOBS, detailKnobToEngine, autoBlendOnOutgrowth } from '@/lib/bridge-control-surface'
import { BLEND_POLICY_DEFAULTS as BPD } from '@/lib/bridge-compose-policy'

export function useControlBehaviors(args: {
  traced: boolean
  artworkUrl: string | undefined
  bounds: Bounds | null
  imgW: number
  imgH: number
  blendVal: number
  engineDefaultBlend: number
  commitTool: (id: string, v: unknown) => unknown
  notify: LabNotify
}): void {
  const { traced, artworkUrl, bounds, imgW, imgH, blendVal, engineDefaultBlend, commitTool, notify } = args
  const appliedForUrl = useRef<string | undefined>(undefined)
  const wasOutgrownRef = useRef(false)
  const [cb] = useState<{ commitTool: (id: string, v: unknown) => unknown; notify: LabNotify }>(() => ({ commitTool, notify }))
  useEffect(() => { cb.commitTool = commitTool; cb.notify = notify }, [cb, commitTool, notify])

  // AUTO_KNOBS — once per upload's FIRST cut (later paint/node commits keep the user's tuning)
  useEffect(() => {
    if (!traced || !artworkUrl || appliedForUrl.current === artworkUrl) return
    appliedForUrl.current = artworkUrl
    const c = cb.commitTool
    c('offset', { pct: AUTO_KNOBS.offset, join: 'sharp' })
    c('simplify', AUTO_KNOBS.simplify)
    c('smooth', AUTO_KNOBS.smooth)
    c('radius', AUTO_KNOBS.radius) // refused harmlessly when the shape carries no corner
    // detail + offset are BOTH generation params behind one gen record; committing them in the same
    // tick makes the second clobber the first through the stale gen ref — detail lands a tick later.
    const t = setTimeout(() => cb.commitTool('detail', detailKnobToEngine(AUTO_KNOBS.detail)), 120)
    return () => clearTimeout(t)
  }, [traced, artworkUrl])

  // AUTO-BLEND on frame exit — the module's pure decision; the knob reflects what is applied
  useEffect(() => {
    const { nowOutgrown, setBlendTo } = autoBlendOnOutgrowth(
      bounds, imgW, imgH, wasOutgrownRef.current, { ...BPD, blend: blendVal }, engineDefaultBlend,
    )
    wasOutgrownRef.current = nowOutgrown
    if (setBlendTo != null && setBlendTo > 0) {
      cb.commitTool('blend', setBlendTo)
      cb.notify('info', 'blend engaged — the outgrown band gets its fill')
    }
  }, [bounds, imgW, imgH, blendVal, engineDefaultBlend])
}
