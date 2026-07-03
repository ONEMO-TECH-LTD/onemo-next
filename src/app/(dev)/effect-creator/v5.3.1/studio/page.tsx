'use client'

// studio/page.tsx — the Create Studio ROUTE (Phase 6 · KAI-9217 / KAI-9301).
//
// The NEW production client path (build-plan §Phase 6), a third route shell alongside page.tsx (v53 3D-first
// baseline) + 2d/page.tsx (Phase-5 2D-first). Graduates to (store)/create when real.
//
// THIS IS A BARE CONNECTED PAGE — NO UI. It mounts the engine (useTwoDFirstFlow → { state, actions }) and
// injects the flow adapters (blueprint §4: the client owns toast/URL, the flow imports neither). Nothing is
// styled, no chrome, no zones, no dock — the layout + look are ASSEMBLED here from the real DS v2.3 components
// (storybook) + the golden screen, iteratively. This file only makes the engine live and hands { state,
// actions } to whatever gets assembled in. The one native <input> below is a raw functional engine tap so the
// connection is verifiable; it is temporary scaffolding, replaced by the real Add component.

import { Suspense, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { useTwoDFirstFlow } from '../flows/twoDFirstFlow'
import { toast } from '../ui/Toast'

const ToastSurface = dynamic(() => import('../ui/Toast'), { ssr: false })

function CreateStudioRoute() {
  const searchParams = useSearchParams()
  const segPresent = !!searchParams.get('seg') // harness override; product URLs carry none (inv 25)

  const notify = useCallback((kind: 'warn' | 'error' | 'info', message: string) => { toast(kind, message) }, [])
  const { actions } = useTwoDFirstFlow({ notify, segPresent })

  // The engine is live. The UI gets assembled below from real components — nothing invented here.
  return (
    <>
      {/* TEMP engine tap (unstyled, no design) — proves upload → flow works; the real Add component replaces it. */}
      <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) actions.upload(f) }} />
      <ToastSurface />
    </>
  )
}

export default function EffectCreatorV531StudioPage() {
  return (
    <Suspense fallback={null}>
      <CreateStudioRoute />
    </Suspense>
  )
}
