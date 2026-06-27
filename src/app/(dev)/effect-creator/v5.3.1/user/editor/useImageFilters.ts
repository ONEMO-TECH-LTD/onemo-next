'use client'

// editor/useImageFilters.ts — the LIVE image composer for the hero FiltersSurface (Phase 4 · §0a: ONE image
// descriptor set drives BOTH the editor's Image mode AND the hero Filters). FiltersSurface is a CLIENT: it
// renders its own bespoke glass UI but DRIVES the SAME image descriptors (preview/commit BY ID) — so removing
// an image descriptor removes that tool from BOTH surfaces (the bundling test spans the hero too). The ctx
// stays here (Layer-2 internal); the surface never holds it. Live = preview = commit = straight to the store
// (the 3D recomposes immediately — FiltersSurface is over the LIVE scene, not the frozen editor).

import { useMemo } from 'react'
import { TOOL_REGISTRY, isPickerDescriptor } from './descriptors'
import type { EditorCtx, ToolEnabled, ToolControl, CommitResult } from './descriptors/types'
import { useOutlineStore, NEUTRAL_FX } from '../outlineStore'
import { ADJUSTMENTS_OFF } from '@/lib/effect/outline-resolve'
import { toast } from '../../ui/Toast'
import { toolEnabledFromSearch } from './tool-config'

/** Live image-fx EditorCtx for the hero FiltersSurface: image-fx + bgBlur + wrapTile are LIVE (preview =
 *  commit = setImageFx/setBgBlur/setWrapTile straight to the store → the 3D recomposes immediately). The
 *  SHAPE-side ctx methods are documented NO-OPS — the image descriptors (brightness/contrast/saturate/warmth/
 *  preset/tint/vignette/blend/fill) call ONLY getImageFx/previewImageFx/commitImageFx + getBgBlur/setBgBlur +
 *  getWrapTile/setWrapTile (grep-verified); they never touch a shape method, so these stubs are unreachable. */
function makeLiveImageCtx(): EditorCtx {
  const st = () => useOutlineStore.getState()
  return {
    getImageFx: () => st().imageFx ?? NEUTRAL_FX,
    previewImageFx: (n) => st().setImageFx(n),
    commitImageFx: (n) => st().setImageFx(n),
    getBgBlur: () => st().bgBlur,
    setBgBlur: (v) => st().setBgBlur(v),
    getWrapTile: () => st().wrapTile,
    setWrapTile: (v) => st().setWrapTile(v),
    notify: (k, m) => toast(k, m),
    // shape-side — NEVER reached by image descriptors (FiltersSurface is image-only):
    getSource: () => null,
    getAdjustments: () => ({ global: { ...ADJUSTMENTS_OFF.global }, local: {} }),
    getSpec: () => null,
    getDisplay: () => null,
    selVA: null,
    sourceIdForSelection: () => null,
    preview: () => {},
    commitAdjustments: () => ({ ok: true }),
    getGenParams: () => ({ detail: 100, offset: 0, offsetJoin: 'sharp' }),
    reDeriveTrace: () => ({ ok: true }),
    installSource: () => ({ ok: true }),
  }
}

export interface ImageToolRecord {
  id: string
  label: string
  icon: string
  control: ToolControl
  value: unknown
  available: boolean
}

/** A thin image-only composer: resolve any image tool's DATA record by id (value via read on the live ctx)
 *  + preview/commit BY ID. The surface (FiltersSurface) renders DATA + calls these; it never holds the ctx
 *  or a descriptor object (the Layer boundary, same as the editor's ToolSheet). */
export function useImageFilters() {
  const ctx = useMemo(() => makeLiveImageCtx(), [])
  const toolEnabled = useMemo<ToolEnabled>(
    () => toolEnabledFromSearch(typeof window !== 'undefined' ? window.location.search : ''),
    [],
  )
  // subscribe to the appearance slices so the CONSUMER re-renders on every live change — the descriptor reads
  // go through getState (fresh truth); these subscriptions just force the re-render, keeping the surface itself
  // store-free (§11.3: the FiltersSurface client binds only this composer's records/actions, never the store).
  useOutlineStore((s) => s.imageFx)
  useOutlineStore((s) => s.bgBlur)
  useOutlineStore((s) => s.wrapTile)

  /** Resolve the live record for an image tool id (null if absent or runtime-disabled — graceful: the
   *  surface region for that tool then renders nothing, so the bundling test holds for FiltersSurface). */
  const imageTool = (id: string): ImageToolRecord | null => {
    const d = TOOL_REGISTRY.find((x) => x.id === id)
    if (!d || isPickerDescriptor(d) || !toolEnabled(id)) return null
    return { id: d.id, label: d.label, icon: d.icon, control: d.control, value: d.read ? d.read(ctx) : undefined, available: d.applies ? d.applies(ctx) : true }
  }
  const previewTool = (id: string, v: unknown) => {
    const d = TOOL_REGISTRY.find((x) => x.id === id)
    if (d && !isPickerDescriptor(d)) d.preview(v, ctx)
  }
  const commitTool = (id: string, v: unknown): CommitResult => {
    const d = TOOL_REGISTRY.find((x) => x.id === id)
    return d && !isPickerDescriptor(d) ? d.commit(v, ctx) : { ok: false, reason: 'no-tool' }
  }

  return { imageTool, previewTool, commitTool }
}
