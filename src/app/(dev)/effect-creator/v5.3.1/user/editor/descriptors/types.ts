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
  // a swatch row: option `id` IS the value sent to commit; `swatch` (optional) is a colour dot to render (else a text chip).
  | { kind: 'swatches'; options: { id: string; label: string; swatch?: string | null }[] }
  | { kind: 'stepper'; min: number; max: number }
  | { kind: 'actions'; actions: { id: string; label: string }[] }
  | { kind: 'toggle'; onLabel: string; offLabel: string }

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
  /** image-fx engine-binding — surface-agnostic so ONE image descriptor set drives BOTH the editor's Image
   *  mode (preview → draft/CSS, commit → setImageFx baked on Done via the version-bridge) AND the hero
   *  FiltersSurface (preview = commit = live setImageFx). The surface wires these on its composer. */
  getImageFx: () => import('../../outlineStore').ImageFx
  previewImageFx: (next: import('../../outlineStore').ImageFx) => void
  commitImageFx: (next: import('../../outlineStore').ImageFx) => void
  /** blend (bgBlur) + fill (wrapTile) — reads for value-reflection + live writers (both surfaces). */
  getBgBlur: () => number | null
  setBgBlur: (v: number | null) => void
  getWrapTile: () => boolean
  setWrapTile: (v: boolean) => void
  /** GENERATION (detail/offset) — the no-AI trace re-derive, SHARED by both descriptors (parameterized by
   *  detail+offset+join together). The gen-params live in the editor controller; `reDeriveTrace` merges the
   *  given slice, rebuilds the SOURCE from `spec.rawTracePx` (producers.traceSourceFromRaw), and previews
   *  (transient setSource, no history) or commits (one editor-local undo step), returning the inv-21 result.
   *  Removing the detail OR offset descriptor leaves this binding intact for the other (the bundling test). */
  getGenParams: () => { detail: number; offset: number; offsetJoin: OffsetJoin }
  reDeriveTrace: (params: { detail?: number; offset?: number; offsetJoin?: OffsetJoin }, commit: boolean) => CommitResult
  /** SHARED source-install (shape-pick + upload/magic) — install a NEW source (+ optional default adjustments)
   *  and re-derive. commit=false = transient (no history); commit=true = one editor-local undo step. F8:
   *  history / selection-clear / control advance ONLY on {ok:true}; a refused install = no advance + rollback.
   *  Re-homed from useOutlineEditing.seedSource; the picker-SPECIFIC shape-build stays IN the descriptor. */
  installSource: (source: OutlineSource, adjustments: OutlineAdjustments | undefined, commit: boolean) => CommitResult
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
  /** when unavailable: HIDE the chip (generation tools — Detail/Offset on a non-Magic source) vs the default
   *  GREY (edit tools — Radius/Curve always show, the control greys). Preserves the editor's exact current UX. */
  hideWhenUnavailable?: boolean
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

// ── PICKER descriptor (shape-pick) — a DISTINCT kind: a source-PRODUCER + multi-action picker, not a
//    value+preview/commit slider (lead call 2026-06-27, design doc §10; expert+pixel cleared). Kept the
//    value ToolDescriptor pristine; the registry is a union narrowed via the isPickerDescriptor guard ('kind' in d).
//    Forward-compatible for the full-loop dock's Add/Effect outlets (also pickers). §0.7 lightweight: a
//    union + a narrow, no framework. The picker's SPECIFIC logic is self-contained here; only the SHARED
//    EditorCtx.installSource is the engine binding → drop the descriptor = the Shape outlet vanishes.

/** A picker param control (DATA the picker client renders), e.g. polygon Sides / star Spike. */
export interface PickerParamSpec {
  key: string
  label: string
  control: 'stepper' | 'slider'
  min: number
  max: number
}

export type PickerParams = Record<string, number>

export interface PickerDescriptor {
  kind: 'picker'
  id: string
  outlet: ToolOutlet
  label: string
  icon: string
  /** the chip lineup (DATA the Shape-outlet client renders). */
  chips: { id: string; label: string }[]
  /** per shape-kind parametric controls (DATA); absent/empty kinds show only the chip. */
  paramSpecs: (kind: string) => PickerParamSpec[]
  /** pick a chip — use the CURRENT session params (they persist across picks; blob → a FRESH seed merged in),
   *  install (one undo step), and RETURN the (possibly seed-updated) params so the client adopts them
   *  (descriptor-owned blob-on-pick seed + params-persistence preserved; pixel F2). */
  pick: (kind: string, params: PickerParams, ctx: EditorCtx) => { params: PickerParams; result: CommitResult }
  /** re-apply at the given params (steppers / ticks — keeps the seed). */
  apply: (kind: string, params: PickerParams, ctx: EditorCtx) => CommitResult
  /** transient generator preview ring `d` while a param tick drags (generator kinds only; else null). */
  previewRing: (kind: string, params: PickerParams, ctx: EditorCtx) => string | null
  /** blob dice — reroll the seed + re-apply. Returns the new params (the client updates its state) + result. */
  reroll: (kind: string, params: PickerParams, ctx: EditorCtx) => { params: PickerParams; result: CommitResult }
  /** upload an SVG/image as a shape (async; loud product-language failure via notify). */
  uploadShape: (file: File, ctx: EditorCtx) => Promise<CommitResult>
}

/** The heterogeneous registry: value tools + the picker. */
export type Descriptor = AnyToolDescriptor | PickerDescriptor

/** INTENTIONAL narrowing (NOT a direct discriminant — the 7 value ToolDescriptors carry NO `kind`, staying
 *  pristine; only PickerDescriptor has `kind`). `'kind' in d` narrows the union; the composer uses this guard
 *  and never forces picker fields onto the value tools. */
export const isPickerDescriptor = (d: Descriptor): d is PickerDescriptor => 'kind' in d
