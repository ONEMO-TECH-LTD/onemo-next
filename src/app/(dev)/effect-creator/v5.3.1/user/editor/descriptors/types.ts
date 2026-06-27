// editor/descriptors/types.ts — the PER-TOOL descriptor contract (Phase 4 · blueprint §0/§4 + inv 30).
//
// A tool IS a DESCRIPTOR: a lightweight data+fn object declaring its UI-skeleton-fill (control) + its
// engine-binding (preview/commit → the inv-21 CommitResult) + availability/value-reflection. The composer
// (useEditor) is a thin filter/map over the present descriptors — it never contains tool logic. Removing a
// tool = delete its file + its one TOOL_REGISTRY line; disabling = a RUNTIME config flag (no code change).
// This is the LIGHTWEIGHT altitude (§0.7): a uniform object + a .filter, NOT a registry/plugin framework.

import type { OutlineAdjustments, OutlineSource } from '@/lib/effect/outline-resolve'
import type { VShape } from '@/lib/vector-core'
import type { EffectSpecDraft } from '@/lib/effect/types'
import type { OffsetJoin } from '@/lib/effect/offset'
import type { CommitResult } from '../../outlineStore'

export type { CommitResult }

/** The UI-skeleton-fill a descriptor declares — DATA the constant skeleton renders (no per-tool JSX). */
export type ToolControl =
  | { kind: 'slider'; min: number; max: number; step?: number; format: (v: number) => string }
  // a primary slider + a small enum selector (e.g. Offset's round/sharp/bevel join) — the tool's value is {pct,enum}.
  | { kind: 'slider-enum'; min: number; max: number; step?: number; format: (v: number) => string; options: { id: string; label: string }[] }
  | { kind: 'swatches'; options: { id: string; label: string; value: string | null }[] }
  | { kind: 'stepper'; min: number; max: number }
  | { kind: 'actions'; actions: { id: string; label: string }[] }

/** The current editor dock outlet a tool lives under. Phase 4 = today's editor modes; the full-loop
 *  Create Studio dock (Add·Shape·Effect·Adjust·Edit) is the Phase-6 client over the SAME descriptors. */
export type ToolOutlet = 'shape' | 'adjust' | 'image'

/** The engine-binding context the composer builds and passes to each descriptor's preview/commit. It is
 *  Layer-2 INTERNAL — the UI client never receives it (the UI binds only `state.tools` + `actions`, inv 14/16).
 *  The existing engine code (useEditorAdjustments / producers / composite) is re-homed behind these bindings.
 *  (Expanded as the descriptors land in steps 3–6; the composer owns construction.) */
export interface EditorCtx {
  /** current immutable source truth + its recipe (read-only access for descriptors). */
  getSource: () => OutlineSource | null
  getAdjustments: () => OutlineAdjustments
  getSpec: () => EffectSpecDraft | null
  /** the resolved display shape (the editor's working VShape). */
  getDisplay: () => VShape | null
  /** selection → the SOURCE anchor id a per-anchor (radius/curve) edit targets (null = whole-shape). */
  selVA: number | null
  sourceIdForSelection: () => string | null
  /** editing verbs (from useOutlineEditing, history-aware): preview = transient (no commit/history);
   *  commit = applies + returns the F8 CommitResult; the composer pushes history ONLY on {ok:true}. */
  preview: (adj: OutlineAdjustments | null) => void
  commitAdjustments: (adj: OutlineAdjustments) => CommitResult
  /** image-fx / blend / fill writers (the image-tool engine-binding). */
  setImageFx: (next: import('../../outlineStore').ImageFx) => void
  setBgBlur: (v: number | null) => void
  setWrapTile: (v: boolean) => void
  /** GENERATION (detail/offset) — the no-AI trace re-derive, SHARED by both descriptors (parameterized by
   *  detail+offset+join together). The gen-params live in the editor controller; `reDeriveTrace` merges the
   *  given slice, rebuilds the SOURCE from `spec.rawTracePx` (producers.traceSourceFromRaw), and previews
   *  (transient setSource, no history) or commits (one editor-local undo step), returning the inv-21 result.
   *  Removing the detail OR offset descriptor leaves this binding intact for the other (the bundling test). */
  getGenParams: () => { detail: number; offset: number; offsetJoin: OffsetJoin }
  reDeriveTrace: (params: { detail?: number; offset?: number; offsetJoin?: OffsetJoin }, commit: boolean) => CommitResult
  /** injected notification sink (the descriptor never imports toast — blueprint §4). */
  notify: (kind: 'warn' | 'error' | 'info', message: string) => void
}

/** A single tool, fully self-contained. `V` = its control value type. */
export interface ToolDescriptor<V = number> {
  id: string
  outlet: ToolOutlet
  label: string
  /** an icon KEY the skeleton maps to a glyph — keeps the descriptor UI-agnostic (no JSX here). */
  icon: string
  control: ToolControl
  /** greys when inapplicable (Dan's rule); default = always applies. */
  applies?: (ctx: EditorCtx) => boolean
  /** value-reflection — the control shows the tool's REAL current value (never a lying 0). */
  read?: (ctx: EditorCtx) => V
  /** transient preview (slider tick) — display re-resolves; NO commit, NO history. */
  preview: (v: V, ctx: EditorCtx) => void
  /** commit (slider release) — returns the inv-21 result; on {ok:false} the composer rolls the control
   *  back + notifies + pushes NO history/selection-clear (F8). */
  commit: (v: V, ctx: EditorCtx) => CommitResult
}

/** Runtime enable/disable (inv 30): the composer reads this to include/skip a descriptor LIVE. Sourced from
 *  a RUNTIME channel (URL flag / product config), NEVER an edited source const — disable = no code change. */
export type ToolEnabled = (id: string) => boolean

/** The registry is heterogeneous — each tool's value type differs (number, OffsetValue, …). The composer
 *  treats values opaquely (reads `state.tools[].value`, passes it back to `commit`), so the registry is typed
 *  over `any` value; the per-tool descriptor files keep their precise `V`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyToolDescriptor = ToolDescriptor<any>
