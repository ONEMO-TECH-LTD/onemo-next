'use client'

// core/viewer-adapter.ts — Layer-2a VIEWER ADAPTER (Creator v5.5 · blueprint §4/§10 · inv 26 · F1/KAI-9221).
//
// The stateful seam between the engine output and the 3D viewer. It owns `prepared-for-3D` — the
// PreparedEffect the EffectViewer renders — kept SEPARATE from `prepared-for-editing` (the 2D editor's
// spec + frontSrc, held in v53Flow). 3D is built ON CALL via `publishToViewer`, never on the mere
// presence of an editing-prepared (inv 26: a flow may run a live 2D editor with NO 3D mounted — the
// twoDFirstFlow enabler). The split is in WHAT/ WHEN we hand the viewer, not in EffectViewer itself.
//
// Why a hook (not a pure primitive): it holds flow-timing STATE (the published 3D slot). The FLOW decides
// WHEN to publish — v53Flow publishes immediately on upload/magic (3D shows at once); twoDFirstFlow
// publishes only on editor SAVE (no 3D until then). (F1 — reclassified out of the pure-primitive set.)

import { useState, useCallback } from 'react'
import type { PreparedEffect } from '@/lib/effect/prepare-effect'

/** UI-side notification sink (same contract as v53Flow's injected adapter — blueprint §4). */
type Notify = (kind: 'warn' | 'error' | 'info', message: string) => void

export function useViewerAdapter(notify: Notify) {
  // prepared-for-3D — the ONLY thing the EffectViewer renders. Distinct from prepared-for-editing.
  const [preparedFor3D, setPreparedFor3D] = useState<PreparedEffect | null>(null)

  /** Hand a viewer-ready prepared to the 3D viewer — builds/shows 3D ON CALL (inv 26). null clears it. */
  const publishToViewer = useCallback((prepared: PreparedEffect | null) => {
    setPreparedFor3D(prepared)
  }, [])

  /** The viewer's 3D-build status/error channel (G4) — the flow binds it; notify stays the injected adapter. */
  const handleStatus = useCallback((s: 'idle' | 'building' | 'ready' | 'error', message?: string) => {
    if (s === 'error') notify('error', `3D build failed: ${message ?? 'unknown error'}`)
  }, [notify])

  return { preparedFor3D, publishToViewer, handleStatus }
}
