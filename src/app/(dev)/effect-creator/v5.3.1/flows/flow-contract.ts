'use client'

// flows/flow-contract.ts — v53Flow's { state, actions } surface, NAMED as the Layer-3 seam
// (Creator v5.5 · blueprint §5/§6 · inv 18 · KAI-9205).
//
// DESCRIPTIVE, not prescriptive: `CreatorFlow` is v53Flow's CURRENT surface given a name — it is NOT a
// pre-designed "common contract every flow implements." inv 18 explicitly allows a second flow
// (`twoDFirstFlow`, Phase 5) to DIVERGE and carry its own surface; whether it conforms to or diverges from
// `CreatorFlow` is a Phase-5 FINDING, not a Phase-3 guarantee (same YAGNI as deferring the flow-selector).
//
// The seam: Layer-3 (the page/UI) binds ONLY to this `{ state, actions }` — never to a concrete flow module,
// an engine library, or a store directly (blueprint §5). A flow is a compose-function returning this shape;
// "a new pipeline is a new compose-function, not a socket rewrite" (inv 18). The flow-SELECTOR (choosing
// which flow the page mounts) is deferred to Phase 5, when a second flow actually exists.
//
// API ≠ CONTRACT (DEC-v5-09 / blueprint §0.3): the "API" is the engine's stateless PRIMITIVES
// (core/primitives.ts — the neutral connector). THIS file is the pipeline's CONTRACT (`{state, actions}`,
// composed from the primitives) — the flow/UI-side surface, NOT "the API." It is UX-semantic: generic
// session verbs by id, never UI panel names (the UI owns panel naming/visibility).

import type { PreparedEffect } from '@/lib/effect/prepare-effect'
import type { DesignState } from '../types'
import type { useSceneStore } from '../admin/sceneStore'

/** A SESSION id — UX-semantic, NOT a UI panel name (the UI owns panel names; DEC-v5-09). The CONTRACT owns
 *  this type; the flow service (`core/transactions` useSessions) imports it from here (deps point impl→contract). */
export type SessionId = 'editor' | 'trim' | 'filter'

/** UI-side notification sink — the flow emits, the UI binds it to toast() (blueprint §4 adapter). */
export type Notify = (kind: 'warn' | 'error' | 'info', message: string) => void

/** The adapters a flow needs injected — the concerns that straddle the Layer-2/3 seam (blueprint §4):
 *  the flow never imports toast, and never reads URL/route params itself. */
export interface CreatorAdapters {
  notify: Notify
  /** Injected URL/route param: ?seg present → skip the upload-time background cut-out (harness override).
   *  Product URLs carry no ?seg. Read by the UI from window.location, never inside the flow. */
  segPresent: boolean
}

type SceneColors = ReturnType<typeof useSceneStore.getState>['colors']

/** Everything the UI renders FROM (v53Flow's state surface). */
export interface CreatorFlowState {
  artworkUrl: string | undefined
  prepared: PreparedEffect | null          // prepared-for-editing (2D side)
  preparedFor3D: PreparedEffect | null     // prepared-for-3D (viewer side, inv 26)
  sessions: Record<SessionId, boolean>   // keyed active sessions (editor/trim/filter — independent, can co-exist)
  editorMode: 'shape' | 'image' | null   // editor payload (NOT a panel flag)
  autoOutline: boolean
  generating: boolean
  designState: DesignState
  colors: SceneColors
  canUndo: boolean
  canRedo: boolean
  dirty: boolean
  hasArtwork: boolean
}

/** Everything the UI DRIVES (v53Flow's actions surface). */
export interface CreatorFlowActions {
  upload: (file: File) => void
  magic: () => void
  cancelMagic: () => void
  undo: () => Promise<void>
  redo: () => Promise<void>
  reset: () => Promise<void>
  // generic SESSION verbs by id (DEC-v5-09) — begin/commit/revert; the UI maps its panels
  // (Editor / Trim / Filters) to these UX-semantic ids. editor's revert is the composer's onCancel.
  beginSession: (id: SessionId, mode?: 'shape' | 'image' | null) => void
  commitSession: (id: SessionId) => void
  revertSession: (id: SessionId) => void
  exportSvg: () => Promise<string | null>
  handleStatus: (s: 'idle' | 'building' | 'ready' | 'error', message?: string) => void
  setBackColor: (c: string) => void
}

/** v53Flow's surface, named — the Layer-3 seam (see header: descriptive, not a guaranteed shared contract). */
export interface CreatorFlow {
  state: CreatorFlowState
  actions: CreatorFlowActions
}
