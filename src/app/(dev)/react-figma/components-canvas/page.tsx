/**
 * react-figma components canvas host — E7.3 (KAI-9377, architecture v4.1 §1/§2/§4).
 * The SECOND canvas: renders the component gallery for the editor iframe — every
 * component from BOTH roots, grouped by category, each variant (named export) in its
 * own labeled frame. Same-origin like /react-figma/canvas, so tagging, selection,
 * overrides and writes all work unchanged on library source.
 *
 * Discovery (QA R1-proven split): PROJECT via webpack require.context (watched, new
 * files hot-appear) · GLOBAL via the generated package barrel (server-regenerated on
 * create — new exports arrive through barrel recompile).
 * F4 hardening (lead): react-is isValidElementType filters non-component exports
 * (memo/forwardRef are objects, hooks would crash); every frame renders inside an
 * ErrorBoundary so one throwing module can't blank the gallery.
 */
'use client'
import * as React from 'react'
import { isValidElementType } from 'react-is'
import * as Library from 'onemo-component-library'

import {
  createGhostFrame,
  createVariantCommandFromGhost,
  moveVariantFrameCommandFromDrag,
  nextAutoVariantName,
  renameVariantCommandFromDraft,
  translateVariantFrame,
  undoCommandFromKeyboard,
  type VariantFrameGeometry,
} from './component-canvas-gestures'
import { selectCanvasGroupsForMode } from './component-canvas-groups'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const projectCtx = (require as any).context('../../react-figma-components', true, /\.tsx$/)

type Root = 'global' | 'project'
type Axis = { axis: string; values: string[]; defaultValue: string }
type InventoryEntry = { name: string; category: string; importPath: string; root: Root; file: string; exports: string[]; variantAxes?: Axis[] }
// I2 §7: `props` carries the axis-value prop for a variant frame (`<Comp size=lg/>`); undefined → base render.
// I5 (§I5/D1): `axis` = which variant axis a value-frame belongs to (undefined = base/named-export/state ghost),
// so the board renders one labeled sub-group PER axis (the Framer axis-grouped layout). `state` = the interaction/
// semantic state a ghost frame previews (undefined = a normal frame).
type Frame = { key: string; label: string; category: string; root: Root; file?: string; Comp: React.ElementType; props?: Record<string, string>; axis?: string; state?: string }
type ComponentGroup = { key: string; name: string; category: string; root: Root; file?: string; variants: Frame[] }
type AuthoringCanvasState = {
  revision: number
  sourceHashes: Record<string, string>
  canUndo: boolean
  component: {
    id: string
    displayName: string
    source: { file: string; exportName: string }
    variants: Array<{ id: string; displayName: string; frame: { x: number; y: number; width: number; height: number }; kind: string; primary: boolean }>
  } | null
}
type AuthoringCommand =
  | { kind: 'create-variant'; file: string; name: string }
  | { kind: 'rename-variant'; file: string; from: string; to: string }
  | { kind: 'move-variant-frame'; file: string; variantId: string; frame: { x: number; y: number; width: number; height: number } }
  | { kind: 'undo' }
const COMPONENT_TEXT = 'var(--sem-col-text-brand-primary)'
const COMPONENT_ACCENT = 'var(--sem-col-fg-brand-primary)'
const COMPONENT_BORDER = 'var(--sem-col-border-brand)'
const CANVAS_BG = 'var(--sem-col-bg-secondary)'
const SURFACE_BG = 'var(--sem-col-bg-active)'
const BRAND_WASH = 'color-mix(in oklch, var(--sem-col-bg-brand-solid) 3%, transparent)'
const FIELD_BORDER = 'var(--sem-col-border-secondary)'
const SUBTLE_BORDER = 'var(--sem-col-border-tertiary)'
const MUTED_TEXT = 'var(--sem-col-text-tertiary)'
const SUBTLE_TEXT = 'var(--sem-col-text-secondary)'
const DISABLED_TEXT = 'var(--sem-col-text-disabled)'
const ERROR_TEXT = 'var(--sem-col-text-error-primary)'
const ERROR_BORDER = 'var(--sem-col-border-error)'
const CANVAS_FONT = 'var(--al-type-family-primary)'
const dsFont = (spec: string): string => `${spec} ${CANVAS_FONT}`
// I5 (§I5 + §3.2/§7): the 6 states shown as GHOST SLOTS on the edited component's board. INTERACTION states
// preview via `data-fc-preview="<state>"` on the host frame (the editor-only dual-selector half, §3.2); SEMANTIC
// states preview via the boolean PROP (`<Comp loading/>`), which drives the component's own `data-<state>`.
const INTERACTION_STATES = ['hover', 'pressed', 'focus'] as const
const SEMANTIC_STATES = ['disabled', 'loading', 'error'] as const
const GHOST_STATES: readonly string[] = [...INTERACTION_STATES, ...SEMANTIC_STATES]
const isInteractionState = (s?: string): boolean => !!s && (INTERACTION_STATES as readonly string[]).includes(s)

// ─── I7 NODE SYSTEM (Framer ⚡ connector layer, s58-nodesystem-design.md) ────────────────
type Conn = { mode: 'state' | 'switch'; trigger?: string; to: { state?: string; axis?: string; value?: string }; transition?: { stiffness: number; damping: number; mass: number }; cycle?: boolean }
type Wire = { key: string; d: string; conn: Conn; mx: number; my: number }
const WIRE = COMPONENT_ACCENT
/** The ⚡ visual connector layer over the edited component's board (Framer clone). Draws a directional wire
 * from the base frame → each connector's target frame (state ghost or axis-value frame), a diamond drag-handle
 * on every frame's right edge (drag → drop on a target = set-connector, mode inferred from the target kind),
 * and a popover on wire-select (edit the spring / remove). All writes go through the shipped ops; the board
 * re-reads after every write (no optimistic wire state — the model is the truth). */
function NodeLayer({ file, connectors, boardRef, onWrite }: { file: string; connectors: Conn[]; boardRef: React.RefObject<HTMLDivElement | null>; onWrite: (body: object) => Promise<boolean> }) {
  const [wires, setWires] = React.useState<Wire[]>([])
  const [handles, setHandles] = React.useState<{ key: string; x: number; y: number; frame: HTMLElement }[]>([])
  const [drag, setDrag] = React.useState<{ x0: number; y0: number; x: number; y: number; overKey: string | null; overRect: { left: number; top: number; right: number; bottom: number } | null } | null>(null)
  const [sel, setSel] = React.useState<Wire | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [boardW, setBoardW] = React.useState(400) // board width tracked in state (no ref reads during render)

  const frameRect = (el: Element, board: HTMLElement) => {
    const r = el.getBoundingClientRect(), b = board.getBoundingClientRect()
    return { left: r.left - b.left, top: r.top - b.top, right: r.right - b.left, bottom: r.bottom - b.top, cx: (r.left + r.right) / 2 - b.left, cy: (r.top + r.bottom) / 2 - b.top }
  }
  const targetOf = (board: HTMLElement, c: Conn): HTMLElement | null =>
    c.mode === 'state'
      ? board.querySelector(`[data-component-state="${c.to.state}"]`)
      : board.querySelector(`[data-component-variant="${c.to.axis}=${c.to.value}"]`)
  // the base frame = a frame with no state and not inside an axis sub-group (the component's default render)
  const baseFrame = (board: HTMLElement): HTMLElement | null =>
    [...board.querySelectorAll('[data-component-frame]')].find((f) => !f.hasAttribute('data-component-state') && !f.closest('[data-axis-group]')) as HTMLElement ?? board.querySelector('[data-component-frame]')

  const measure = React.useCallback(() => {
    const board = boardRef.current; if (!board) return
    setBoardW(board.clientWidth)
    const src = baseFrame(board); if (!src) { setWires([]); setHandles([]); return }
    const sr = frameRect(src, board)
    // Route each wire so NO segment runs along a frame ROW (designer: a shared far-right gutter still crosses
    // the target row's siblings on final approach). Per-wire: drop down the NEAREST clear margin corridor to a
    // channel just ABOVE the target's row (an empty band between rows), then straight DOWN into the target's TOP
    // edge in its own column. Every segment is provably clear — corridor (margin) · channel (inter-row gap) ·
    // drop (target column, above target). Nearest-side corridor keeps wires short (no full-width loop).
    const allR = [...board.querySelectorAll('[data-component-frame]')].map((f) => frameRect(f, board))
    const leftC = Math.min(...allR.map((r) => r.left)) - 14
    const rightC = Math.max(...allR.map((r) => r.right)) + 14
    setWires(connectors.map((c, i) => {
      const t = targetOf(board, c); if (!t) return null
      const tr = frameRect(t, board)
      const useLeft = Math.abs(tr.cx - leftC) <= Math.abs(tr.cx - rightC)
      const cor = useLeft ? leftC : rightC
      const srcX = useLeft ? sr.left : sr.right // exit the source on the corridor side (shortest orthogonal path)
      const channelY = tr.top - 12 // the empty band just above the target's row
      const d = `M ${srcX} ${sr.cy} L ${cor} ${sr.cy} L ${cor} ${channelY} L ${tr.cx} ${channelY} L ${tr.cx} ${tr.top}`
      return { key: `${c.mode}-${c.to.state ?? ''}${c.to.axis ?? ''}-${i}`, d, conn: c, mx: (cor + tr.cx) / 2, my: channelY }
    }).filter(Boolean) as Wire[])
    // a drag handle on every real frame + state ghost (source of a new wire)
    setHandles([...board.querySelectorAll('[data-component-frame]')].map((f, i) => { const r = frameRect(f, board); return { key: `h${i}`, x: r.right, y: r.cy, frame: f as HTMLElement } }))
  }, [connectors, boardRef])

  React.useLayoutEffect(() => { measure() }, [measure])
  React.useEffect(() => {
    const board = boardRef.current; if (!board) return
    const ro = new ResizeObserver(() => measure()); ro.observe(board)
    window.addEventListener('resize', measure)
    const id = setTimeout(measure, 120) // after images/fonts settle
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); clearTimeout(id) }
  }, [measure, boardRef])

  // drag-to-wire: pointer-move tracks the rubber-band + hovered target; pointer-up fires set-connector.
  React.useEffect(() => {
    if (!drag) return
    const board = boardRef.current; if (!board) return
    const move = (e: PointerEvent) => {
      const b = board.getBoundingClientRect(); const x = e.clientX - b.left, y = e.clientY - b.top
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-component-frame]') as HTMLElement | null
      const overKey = el && (el.getAttribute('data-component-state') ? `state:${el.getAttribute('data-component-state')}` : el.getAttribute('data-component-variant')?.includes('=') ? `axis:${el.getAttribute('data-component-variant')}` : null)
      const overRect = el && overKey ? frameRect(el, board) : null // computed HERE (in the handler), not during render
      setDrag((d) => d && { ...d, x, y, overKey: overKey ?? null, overRect })
    }
    const up = async () => {
      const d = drag; setDrag(null)
      if (!d?.overKey || busy) return
      let body: object | null = null
      if (d.overKey.startsWith('state:')) { const st = d.overKey.slice(6); body = { kind: 'set-connector', file, mode: 'state', trigger: st, to: { state: st }, transition: { kind: 'spring', stiffness: 260, damping: 20, mass: 1 } } }
      else if (d.overKey.startsWith('axis:')) { const [axis, value] = d.overKey.slice(5).split('='); body = { kind: 'set-connector', file, mode: 'switch', trigger: 'tap', to: { axis, value }, cycle: true } }
      if (body) { setBusy(true); await onWrite(body); setBusy(false) }
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true })
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [drag, busy, file, onWrite, boardRef])

  const editSpring = async (c: Conn, s: number, d: number, m: number) => { setBusy(true); await onWrite({ kind: 'set-connector', file, mode: 'state', trigger: c.trigger ?? 'hover', to: c.to, transition: { kind: 'spring', stiffness: s, damping: d, mass: m } }); setBusy(false); setSel(null) }
  const removeWire = async (c: Conn) => { setBusy(true); await onWrite({ kind: 'remove-connector', file, mode: c.mode, to: { axis: c.to.axis } }); setBusy(false); setSel(null) }

  return (
    <>
      <svg data-node-layer style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 5 }}>
        <defs><marker id="fc-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill={WIRE} /></marker></defs>
        {wires.map((w) => (
          <g key={w.key} data-wire={`${w.conn.mode}:${w.conn.to.state ?? ''}${w.conn.to.axis ?? ''}`} style={{ pointerEvents: 'stroke', cursor: 'pointer' }} onClick={() => setSel(w)}>
            <path d={w.d} fill="none" stroke="transparent" strokeWidth={12} />
            <path d={w.d} fill="none" stroke={WIRE} strokeWidth={sel === w ? 2.5 : 1.5} markerEnd="url(#fc-arrow)" />
            {w.conn.mode === 'state' && <circle cx={w.mx} cy={w.my} r={7} fill={SURFACE_BG} stroke={WIRE} strokeWidth={1.5} />}
            {w.conn.mode === 'state' && <text x={w.mx} y={w.my + 2.5} textAnchor="middle" fontSize={8} fill={WIRE}>⚡</text>}
          </g>
        ))}
        {drag && <line x1={drag.x0} y1={drag.y0} x2={drag.x} y2={drag.y} stroke={WIRE} strokeWidth={1.5} strokeDasharray="4 3" markerEnd="url(#fc-arrow)" />}
      </svg>
      {/* drag handles — a diamond on each frame's right edge */}
      {handles.map((h) => (
        <div key={h.key} data-connect-handle title="Drag to a state or variant frame to wire an interaction"
          onPointerDown={(e) => { e.preventDefault(); const b = boardRef.current!.getBoundingClientRect(); setDrag({ x0: h.x, y0: h.y, x: e.clientX - b.left, y: e.clientY - b.top, overKey: null, overRect: null }) }}
          style={{ position: 'absolute', left: h.x - 5, top: h.y - 5, width: 10, height: 10, background: WIRE, border: `1.5px solid ${SURFACE_BG}`, borderRadius: 2, transform: 'rotate(45deg)', cursor: 'crosshair', zIndex: 6, boxShadow: '0 1px 3px var(--effects-shadow-sm-01)' }} />
      ))}
      {/* drop-target highlight — rect was computed in the pointer handler (no ref read during render) */}
      {drag?.overRect && <div style={{ position: 'absolute', left: drag.overRect.left - 3, top: drag.overRect.top - 3, width: drag.overRect.right - drag.overRect.left + 6, height: drag.overRect.bottom - drag.overRect.top + 6, border: `2px solid ${WIRE}`, borderRadius: 8, pointerEvents: 'none', zIndex: 6 }} />}
      {/* wire popover: edit spring / remove */}
      {sel && (
        <div style={{ position: 'absolute', left: Math.min(sel.mx + 10, boardW - 150), top: sel.my + 8, width: 140, background: SURFACE_BG, border: `1px solid ${COMPONENT_BORDER}`, borderRadius: 8, padding: 8, zIndex: 20, boxShadow: '0 4px 16px var(--effects-shadow-lg-01)', font: dsFont('500 10px/1.4') }} onClick={(e) => e.stopPropagation()}>
          <div style={{ font: dsFont('600 9px/1'), color: SUBTLE_TEXT, textTransform: 'uppercase', marginBottom: 6 }}>{sel.conn.mode === 'state' ? `Transition → ${sel.conn.to.state}` : `Tap-switch → ${sel.conn.to.axis}=${sel.conn.to.value}`}</div>
          {sel.conn.mode === 'state' && (
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              {(['stiffness', 'damping', 'mass'] as const).map((k, i) => { const def = [sel.conn.transition?.stiffness ?? 260, sel.conn.transition?.damping ?? 20, sel.conn.transition?.mass ?? 1][i]; return <label key={k} style={{ flex: 1, font: dsFont('8px'), color: SUBTLE_TEXT }}>{k[0].toUpperCase()}<input defaultValue={def} data-spring={k} style={{ width: '100%', font: dsFont('9px'), border: `1px solid ${FIELD_BORDER}`, borderRadius: 3, padding: '1px 3px' }} /></label> })}
            </div>
          )}
          <div style={{ display: 'flex', gap: 4 }}>
            {sel.conn.mode === 'state' && <button type="button" disabled={busy} onClick={(e) => { const pop = (e.currentTarget.closest('div')!.parentElement as HTMLElement); const g = (k: string) => Number((pop.querySelector(`[data-spring="${k}"]`) as HTMLInputElement).value); editSpring(sel.conn, g('stiffness'), g('damping'), g('mass')) }} style={{ flex: 1, font: dsFont('9px'), border: `1px solid ${COMPONENT_BORDER}`, background: SURFACE_BG, color: WIRE, borderRadius: 4, padding: '2px 4px', cursor: 'pointer' }}>Apply</button>}
            <button type="button" disabled={busy} onClick={() => removeWire(sel.conn)} style={{ flex: 1, font: dsFont('9px'), border: `1px solid ${ERROR_BORDER}`, background: SURFACE_BG, color: ERROR_TEXT, borderRadius: 4, padding: '2px 4px', cursor: 'pointer' }}>Remove</button>
          </div>
        </div>
      )}
    </>
  )
}

function collectFrames(): Frame[] {
  const frames: Frame[] = []
  // GLOBAL — barrel namespace; category is resolved by the editor shell via the
  // inventory API; here we group under the package for layout only.
  for (const [name, val] of Object.entries(Library)) {
    if (isValidElementType(val) && typeof val !== 'string') {
      frames.push({ key: `global:${name}`, label: name, category: 'Library', root: 'global', Comp: val as React.ElementType })
    }
  }
  // PROJECT — context modules; category = first-level folder of the context key.
  for (const key of projectCtx.keys() as string[]) {
    const mod = projectCtx(key) as Record<string, unknown>
    const parts = key.replace(/^\.\//, '').split('/')
    const category = parts.length > 1 ? parts[0] : 'ungrouped'
    const file = `src/app/(dev)/react-figma-components/${key.replace(/^\.\//, '')}`
    for (const [name, val] of Object.entries(mod)) {
      if (isValidElementType(val) && typeof val !== 'string') {
        frames.push({ key: `project:${key}:${name}`, label: name, category, root: 'project', file, Comp: val as React.ElementType })
      }
    }
  }
  return frames
}

function fallbackGroups(frames: Frame[]): ComponentGroup[] {
  return frames.map((f) => ({
    key: f.key,
    name: f.label,
    category: f.category,
    root: f.root,
    file: f.file,
    variants: [f],
  }))
}

function groupFrames(frames: Frame[], inventory: InventoryEntry[] | null, editFile?: string | null): ComponentGroup[] {
  if (!inventory?.length) return fallbackGroups(frames)
  const byRootLabel = new Map(frames.map((f) => [`${f.root}:${f.label}`, f]))
  const byProjectFileLabel = new Map(frames.filter((f) => f.file).map((f) => [`${f.file}:${f.label}`, f]))
  const used = new Set<string>()
  const groups: ComponentGroup[] = []
  for (const entry of inventory) {
    const exportNames = entry.exports?.length ? entry.exports : [entry.name]
    const baseFrames = exportNames.flatMap((name) => {
      const frame = entry.root === 'project'
        ? byProjectFileLabel.get(`${entry.file}:${name}`) ?? byRootLabel.get(`${entry.root}:${name}`)
        : byRootLabel.get(`${entry.root}:${name}`)
      if (!frame) return []
      used.add(frame.key)
      return [frame]
    })
    // I2 §7: a component with config-variant AXES renders a FRAME PER AXIS-VALUE (`<Comp axis=value/>`) so
    // the board shows every value; without axes it stays the named-export frame(s). I5/D1: each variant carries
    // its `axis` so the render lays out one labeled sub-group per axis (the Framer axis-grouped board).
    const axes = entry.variantAxes ?? []
    const variants: Frame[] = (axes.length && baseFrames.length)
      // F-N1 (Meta+designer converged): a multi-axis component gets a dedicated BASE frame (the default
      // `<Comp/>` render) FIRST, so the node-system wires source from a true base (Framer's Primary config
      // variant) instead of the arbitrary first axis-value frame — no more wires crossing unrelated frames.
      ? [{ key: `${entry.root}:${entry.file}:base`, label: `${entry.name} · Base`, category: entry.category ?? baseFrames[0].category, root: entry.root, file: entry.file, Comp: baseFrames[0].Comp },
         ...axes.flatMap((ax) => ax.values.map((value) => ({
          key: `${entry.root}:${entry.file}:${ax.axis}=${value}`,
          label: `${ax.axis}=${value}`,
          category: entry.category ?? baseFrames[0].category,
          root: entry.root,
          file: entry.file,
          Comp: baseFrames[0].Comp,
          props: { [ax.axis]: value },
          axis: ax.axis,
        })))]
      : baseFrames
    // I5 (§I5): the EDITED component's board also shows the 6 STATE GHOST slots (interaction + semantic),
    // so the author sees + edits every state from the board. Scoped to the edited component (via ?edit=) so the
    // browse gallery isn't cluttered with 6 ghosts per component. The render applies the §3.2 preview contract.
    if (editFile && entry.file === editFile && baseFrames.length) {
      for (const state of GHOST_STATES) variants.push({
        key: `${entry.root}:${entry.file}:state=${state}`,
        label: state,
        category: entry.category ?? baseFrames[0].category,
        root: entry.root,
        file: entry.file,
        Comp: baseFrames[0].Comp,
        state,
      })
    }
    if (variants.length) {
      groups.push({
        key: `${entry.root}:${entry.file}`,
        name: entry.name,
        category: entry.category ?? variants[0]?.category ?? 'ungrouped',
        root: entry.root,
        file: entry.file,
        variants,
      })
    }
  }
  for (const frame of frames) if (!used.has(frame.key)) groups.push(...fallbackGroups([frame]))
  return groups
}

class FrameBoundary extends React.Component<{ label: string; children: React.ReactNode }, { err: string | null }> {
  state = { err: null as string | null }
  static getDerivedStateFromError(e: Error) { return { err: e.message } }
  render() {
    if (this.state.err) {
      return <div data-frame-error={this.props.label} style={{ padding: 12, border: `1px dashed ${ERROR_BORDER}`, borderRadius: 8, color: ERROR_TEXT, font: dsFont('11px'), maxWidth: 240 }}>{this.props.label} failed: {this.state.err}</div>
    }
    return this.props.children
  }
}

type AuthoringVariantModel = NonNullable<AuthoringCanvasState['component']>['variants'][number]
type VariantDrag = {
  pointerId: number
  variantId: string
  startClientX: number
  startClientY: number
  originFrame: VariantFrameGeometry
  currentFrame: VariantFrameGeometry
  moved: boolean
}

function AuthoringVariantBoard({
  group,
  authoring,
  canUndo,
  onCommand,
}: {
  group: ComponentGroup
  authoring: NonNullable<AuthoringCanvasState['component']>
  canUndo: boolean
  onCommand: (command: AuthoringCommand) => Promise<boolean>
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(authoring.variants[0]?.id ?? null)
  const [renamingId, setRenamingId] = React.useState<string | null>(null)
  const [renameDraft, setRenameDraft] = React.useState('')
  const [dragMove, setDragMove] = React.useState<VariantDrag | null>(null)
  const dragMoveRef = React.useRef<VariantDrag | null>(null)
  const setActiveDrag = React.useCallback((next: VariantDrag | null) => {
    dragMoveRef.current = next
    setDragMove(next)
  }, [])
  React.useEffect(() => {
    if (!authoring.variants.some((variant) => variant.id === selectedId)) {
      setSelectedId(authoring.variants[0]?.id ?? null)
    }
  }, [authoring.variants, selectedId])
  React.useEffect(() => {
    if (renamingId && !authoring.variants.some((variant) => variant.id === renamingId)) {
      setRenamingId(null)
      setRenameDraft('')
    }
  }, [authoring.variants, renamingId])
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (renamingId) return
      const command = undoCommandFromKeyboard(event, canUndo)
      if (!command) return
      event.preventDefault()
      void onCommand(command)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canUndo, onCommand, renamingId])
  const selected = authoring.variants.find((variant) => variant.id === selectedId) ?? authoring.variants[0] ?? null
  const axis = group.variants.find((variant) => variant.axis)?.axis ?? 'variant'
  const componentFrame = group.variants.find((variant) => !variant.state)?.Comp ?? group.variants[0]?.Comp
  const ghostFrame = createGhostFrame(authoring.variants)
  const ghostName = nextAutoVariantName(authoring.variants)
  const boardFrames = [...authoring.variants.map((variant) => variant.frame), ghostFrame]
  const width = Math.max(420, ...boardFrames.map((frame) => frame.x + frame.width + 48))
  const height = Math.max(260, ...boardFrames.map((frame) => frame.y + frame.height + 48))
  const create = async () => {
    await onCommand(createVariantCommandFromGhost(authoring.source.file, authoring.variants))
  }
  const startRename = (variant: AuthoringVariantModel) => {
    setSelectedId(variant.id)
    setRenamingId(variant.id)
    setRenameDraft(variant.displayName)
  }
  const commitRename = async (variant: AuthoringVariantModel) => {
    const command = renameVariantCommandFromDraft(authoring.source.file, variant.displayName, renameDraft)
    setRenamingId(null)
    setRenameDraft('')
    if (command) await onCommand(command)
  }
  const beginVariantDrag = (event: React.PointerEvent<HTMLElement>, variant: AuthoringVariantModel) => {
    if (event.button !== 0 || renamingId) return
    event.preventDefault()
    setSelectedId(variant.id)
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setActiveDrag({
      pointerId: event.pointerId,
      variantId: variant.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originFrame: variant.frame,
      currentFrame: variant.frame,
      moved: false,
    })
  }
  const updateVariantDrag = (event: React.PointerEvent<HTMLElement>) => {
    const active = dragMoveRef.current
    if (!active || active.pointerId !== event.pointerId) return
    const deltaX = event.clientX - active.startClientX
    const deltaY = event.clientY - active.startClientY
    const next = {
      ...active,
      currentFrame: translateVariantFrame(active.originFrame, deltaX, deltaY),
      moved: active.moved || Math.abs(deltaX) >= 1 || Math.abs(deltaY) >= 1,
    }
    setActiveDrag(next)
  }
  const finishVariantDrag = async (event: React.PointerEvent<HTMLElement>) => {
    const active = dragMoveRef.current
    if (!active || active.pointerId !== event.pointerId) return
    const deltaX = event.clientX - active.startClientX
    const deltaY = event.clientY - active.startClientY
    const moved = active.moved || Math.abs(deltaX) >= 1 || Math.abs(deltaY) >= 1
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    }
    setActiveDrag(null)
    if (!moved) return
    await onCommand(moveVariantFrameCommandFromDrag(
      authoring.source.file,
      active.variantId,
      active.originFrame,
      deltaX,
      deltaY,
    ))
  }
  return (
    <div data-authoring-canvas data-authoring-component={authoring.id} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div data-authoring-breadcrumb style={{ display: 'flex', alignItems: 'center', gap: 8, font: dsFont('600 11px/1.2'), color: COMPONENT_TEXT }}>
        <span>Components</span><span style={{ color: MUTED_TEXT }}>/</span><span>{authoring.displayName}</span>
      </div>
      <div data-authoring-gesture-hints style={{ font: dsFont('500 10px/1.3'), color: canUndo ? SUBTLE_TEXT : DISABLED_TEXT }}>
        Click the ghost to create · click a label to rename · drag frames to move · ⌘Z to undo
      </div>
      <div style={{ position: 'relative', width, height, border: `1px dashed ${COMPONENT_BORDER}`, borderRadius: 12, background: BRAND_WASH }}>
        {componentFrame && authoring.variants.map((variant) => {
          const isSelected = variant.id === selected?.id
          const liveFrame = dragMove?.variantId === variant.id ? dragMove.currentFrame : variant.frame
          return (
            <figure
              key={variant.id}
              data-authoring-variant={variant.id}
              data-authoring-dragging={dragMove?.variantId === variant.id ? 'true' : undefined}
              data-component-frame={variant.displayName}
              data-component-source={authoring.source.file}
              onPointerDown={(event) => beginVariantDrag(event, variant)}
              onPointerMove={updateVariantDrag}
              onPointerUp={finishVariantDrag}
              onPointerCancel={() => setActiveDrag(null)}
              style={{ position: 'absolute', left: liveFrame.x, top: liveFrame.y, width: liveFrame.width, minHeight: liveFrame.height, margin: 0, display: 'flex', flexDirection: 'column', gap: 8, cursor: dragMove?.variantId === variant.id ? 'grabbing' : 'grab' }}
            >
              <figcaption style={{ display: 'flex', alignItems: 'center', gap: 6, font: dsFont('600 11px/1.2'), color: COMPONENT_TEXT }}>
                <span aria-hidden style={{ width: 8, height: 8, transform: 'rotate(45deg)', borderRadius: 2, background: variant.primary ? COMPONENT_ACCENT : SURFACE_BG, border: `1px solid ${COMPONENT_BORDER}` }} />
                {renamingId === variant.id ? (
                  <input
                    data-authoring-inline-rename
                    aria-label={`Rename ${variant.displayName}`}
                    autoFocus
                    value={renameDraft}
                    onPointerDown={(event) => event.stopPropagation()}
                    onChange={(event) => setRenameDraft(event.target.value)}
                    onBlur={() => { void commitRename(variant) }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur()
                      if (event.key === 'Escape') {
                        setRenamingId(null)
                        setRenameDraft('')
                      }
                    }}
                    style={{ width: Math.max(84, variant.displayName.length * 7), border: `1px solid ${COMPONENT_BORDER}`, borderRadius: 4, padding: '2px 4px', font: dsFont('600 11px/1.2'), color: COMPONENT_TEXT, background: SURFACE_BG }}
                  />
                ) : (
                  <span
                    data-authoring-variant-label
                    role="button"
                    tabIndex={0}
                    title="Click to rename"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => startRename(variant)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        startRename(variant)
                      }
                    }}
                    style={{ cursor: 'text' }}
                  >
                    {variant.displayName}
                  </span>
                )}
              </figcaption>
              <div style={{ minHeight: variant.frame.height - 24, padding: 24, background: SURFACE_BG, borderRadius: 12, outline: isSelected ? `2px solid ${COMPONENT_BORDER}` : `1px solid ${SUBTLE_BORDER}`, outlineOffset: isSelected ? 2 : 0 }}>
                <FrameBoundary label={variant.displayName}>{React.createElement(componentFrame, { [axis]: variant.displayName })}</FrameBoundary>
              </div>
            </figure>
          )
        })}
        {componentFrame && (
          <figure
            data-authoring-create-ghost
            role="button"
            tabIndex={0}
            aria-label={`Create ${ghostName}`}
            onClick={create}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                void create()
              }
            }}
            style={{ position: 'absolute', left: ghostFrame.x, top: ghostFrame.y, width: ghostFrame.width, minHeight: ghostFrame.height, margin: 0, display: 'flex', flexDirection: 'column', gap: 8, cursor: 'copy', opacity: 0.82 }}
          >
            <figcaption style={{ display: 'flex', alignItems: 'center', gap: 6, font: dsFont('600 11px/1.2'), color: COMPONENT_TEXT }}>
              <span aria-hidden style={{ width: 8, height: 8, transform: 'rotate(45deg)', borderRadius: 2, background: SURFACE_BG, border: `1px dashed ${COMPONENT_BORDER}` }} />
              {ghostName}
            </figcaption>
            <div style={{ minHeight: ghostFrame.height - 24, padding: 24, background: 'transparent', borderRadius: 12, outline: `1px dashed ${COMPONENT_BORDER}`, outlineOffset: -1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUBTLE_TEXT, font: dsFont('600 11px/1.2') }}>
              Click to create
            </div>
          </figure>
        )}
      </div>
    </div>
  )
}

export default function ComponentsCanvasHost() {
  // QA HIGH (E7 gate): component modules must NOT render during SSR — a throwing component
  // would 500 the whole route before any ErrorBoundary exists (boundaries only catch in the
  // client tree). SSR serves the shell; frames mount client-side where FrameBoundary isolates.
  const [mounted, setMounted] = React.useState(false)
  // I5 (§I5): the edited component (passed by the editor shell as ?edit=<rel-file>) gets the full board — axis
  // sub-groups + the 6 state ghost slots. Read client-side (this is an iframe route driven by the parent).
  const [editFile, setEditFile] = React.useState<string | null>(null)
  React.useEffect(() => { setMounted(true); setEditFile(new URLSearchParams(window.location.search).get('edit')) }, [])
  const frames = mounted ? collectFrames() : []
  // I7 node-system: the edited component's connectors (drives the wire overlay). Re-fetched on every board refresh.
  const boardRef = React.useRef<HTMLDivElement | null>(null)
  const [editConn, setEditConn] = React.useState<Conn[]>([])
  const [authoring, setAuthoring] = React.useState<AuthoringCanvasState | null>(null)
  const [authoringError, setAuthoringError] = React.useState<string | null>(null)
  const [inventory, setInventory] = React.useState<InventoryEntry[] | null>(null)
  const fetchInventory = React.useCallback(() => {
    fetch('/api/dev/editor-components').then((r) => (r.ok ? r.json() : { components: [] }))
      .then((d: { components?: InventoryEntry[] }) => setInventory(d.components ?? []))
      .catch(() => setInventory([]))
  }, [])
  const fetchConn = React.useCallback(() => {
    if (!editFile) { setEditConn([]); return }
    fetch(`/api/dev/editor-component-model?file=${encodeURIComponent(editFile)}`).then((r) => (r.ok ? r.json() : null)).then((m) => setEditConn(m?.connectors ?? [])).catch(() => setEditConn([]))
  }, [editFile])
  React.useEffect(() => { fetchConn() }, [fetchConn])
  const fetchAuthoring = React.useCallback(() => {
    if (!editFile) { setAuthoring(null); setAuthoringError(null); return }
    fetch(`/api/dev/editor-authoring?file=${encodeURIComponent(editFile)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => null)
        if (!r.ok) throw new Error(data?.error || `authoring load failed (${r.status})`)
        setAuthoring(data as AuthoringCanvasState)
        setAuthoringError(null)
      })
      .catch((error) => { setAuthoring(null); setAuthoringError((error as Error).message) })
  }, [editFile])
  React.useEffect(() => { fetchAuthoring() }, [fetchAuthoring])
  const authoringWrite = React.useCallback(async (command: AuthoringCommand): Promise<boolean> => {
    if (!authoring) return false
    const r = await fetch('/api/dev/editor-authoring', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        command,
        expectedRevision: authoring.revision,
        expectedSourceHashes: authoring.sourceHashes,
      }),
    })
    if (!r.ok) {
      const msg = await r.json().then((j) => j?.error).catch(() => null)
      window.parent?.postMessage({ type: 'fc-toast', kind: 'error', message: msg || `authoring write failed (${r.status})` }, '*')
      return false
    }
    fetchAuthoring()
    fetchInventory()
    window.parent?.postMessage({ type: 'fc-model-changed' }, '*')
    return true
  }, [authoring, fetchAuthoring, fetchInventory])
  // I7: fire a node-system write (set/remove-connector), then re-read (board + connectors) and tell the parent
  // shell to reload its own model (its inspector shows connectors too). No optimistic wire state — model is truth.
  const nodeWrite = React.useCallback(async (body: object): Promise<boolean> => {
    const r = await fetch('/api/dev/editor-write', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    if (!r.ok) {
      // QA-MED (F-A1 class): a failed connector write must SURFACE the server's named error, not fail silently.
      // This route is a separate iframe with no local Toaster — relay to the parent shell's toast.
      const msg = await r.json().then((j) => j?.error).catch(() => null)
      window.parent?.postMessage({ type: 'fc-toast', kind: 'error', message: msg || `connector write failed (${r.status})` }, '*')
      return false
    }
    setTimeout(() => { fetchConn() }, 60) // let the write settle, then re-read the wires from source
    window.parent?.postMessage({ type: 'fc-model-changed' }, '*') // parent reloadEditModel + will bounce fc-board-refresh
    return true
  }, [fetchConn])
  React.useEffect(() => { fetchInventory() }, [fetchInventory])
  // I5 (§I5): the editor shell posts `fc-board-refresh` after an authoring op (add axis/value/state) so the board
  // RE-FETCHES the inventory and shows the new frame live — "ALL authoring works FROM the board", not just renders
  // it. (Fast Refresh reloads the component module but never re-runs this mount-time fetch, so the axis-value
  // frames would otherwise stay stale until a manual reload.)
  React.useEffect(() => {
    const onMsg = (e: MessageEvent) => { if (e.data?.type === 'fc-board-refresh') { fetchInventory(); fetchConn(); fetchAuthoring() } }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [fetchInventory, fetchConn, fetchAuthoring])
  const loadingInventory = inventory === null
  const groups = loadingInventory ? [] : groupFrames(frames, inventory, editFile)
  const visibleGroups = selectCanvasGroupsForMode(groups, editFile)
  const byCategory = new Map<string, ComponentGroup[]>()
  for (const g of visibleGroups) {
    const cat = `${g.root === 'global' ? 'Global' : 'Project'} / ${g.category}`
    byCategory.set(cat, [...(byCategory.get(cat) ?? []), g])
  }
  return (
    <div data-components-canvas suppressHydrationWarning style={{ minWidth: 800, padding: 40, display: 'flex', flexDirection: 'column', gap: 48, background: CANVAS_BG }}>
      {mounted && frames.length === 0 && (
        <div style={{ font: dsFont('13px'), color: SUBTLE_TEXT }}>No components yet — create one from the Assets panel.</div>
      )}
      {frames.length > 0 && loadingInventory && (
        <div style={{ font: dsFont('13px'), color: SUBTLE_TEXT }}>Loading component inventory…</div>
      )}
      {[...byCategory.entries()].map(([cat, list]) => (
        <section key={cat} data-category={cat} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 style={{ margin: 0, font: dsFont('600 12px/1.2'), color: MUTED_TEXT, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{cat}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
            {list.map((group) => (
              <article key={group.key} data-component-group={group.name} data-frame-root={group.root} title={group.file} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span aria-hidden style={{ width: 10, height: 10, transform: 'rotate(45deg)', borderRadius: 2, background: COMPONENT_ACCENT, flex: 'none' }} />
                  <h3 style={{ margin: 0, font: dsFont('600 11px/1.2'), color: COMPONENT_TEXT }}>{group.name}</h3>
                  {group.variants.length > 1 && <span style={{ font: dsFont('500 10px/1.2'), color: MUTED_TEXT }}>{group.variants.length} variants</span>}
                </div>
                <div {...(group.file && group.file === editFile ? { ref: boardRef } : {})} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 16, padding: 24, borderRadius: 12, border: `1px ${group.variants.length > 1 ? 'dashed' : 'solid'} ${COMPONENT_BORDER}` }}>
                  {group.file && group.file === editFile && !authoring?.component && <NodeLayer file={group.file} connectors={editConn} boardRef={boardRef} onWrite={nodeWrite} />}
                  {group.file && group.file === editFile && authoringError && <div style={{ color: ERROR_TEXT, font: dsFont('11px') }}>{authoringError}</div>}
                  {group.file && group.file === editFile && authoring?.component ? (
                    <AuthoringVariantBoard group={group} authoring={authoring.component} canUndo={authoring.canUndo} onCommand={authoringWrite} />
                  ) : (() => {
                    // I5/D1: the axis-grouped board — base row, one labeled sub-group PER variant axis, then the
                    // state ghost slots. State ghosts apply the §3.2 preview contract: interaction → data-fc-preview
                    // on the host figure (the editor-only dual-selector half); semantic → the boolean prop.
                    const base = group.variants.filter((f) => !f.axis && !f.state)
                    const byAxis = new Map<string, Frame[]>()
                    for (const f of group.variants) if (f.axis) byAxis.set(f.axis, [...(byAxis.get(f.axis) ?? []), f])
                    const ghosts = group.variants.filter((f) => f.state)
                    const renderFrame = (f: Frame) => {
                      const semantic = !!f.state && !isInteractionState(f.state)
                      const props = semantic ? { ...(f.props ?? {}), [f.state as string]: true } : f.props
                      const preview = isInteractionState(f.state) ? { 'data-fc-preview': f.state } : {}
                      const showLabel = !!f.axis || !!f.state || base.length > 1
                      return (
                        <figure key={f.key} {...preview} data-component-frame={f.label} data-component-parent={group.name} data-component-variant={f.label} data-component-source={f.file ?? group.file} data-frame-root={f.root} {...(f.state ? { 'data-component-state': f.state } : {})} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 8, opacity: f.state ? 0.9 : 1 }}>
                          {showLabel && <figcaption style={{ font: dsFont('500 11px/1.2'), color: f.state ? SUBTLE_TEXT : COMPONENT_TEXT }}>{f.label}</figcaption>}
                          <div style={{ padding: 24, background: SURFACE_BG, borderRadius: 12, ...(f.state ? { outline: `1px dashed ${SUBTLE_BORDER}`, outlineOffset: -1 } : {}) }}>
                            <FrameBoundary label={f.label}>{React.createElement(f.Comp, props)}</FrameBoundary>
                          </div>
                        </figure>
                      )
                    }
                    const row = (fs: Frame[]) => <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>{fs.map(renderFrame)}</div>
                    const subLabel = (t: string) => <div style={{ font: dsFont('600 9px/1'), color: MUTED_TEXT, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t}</div>
                    return (
                      <>
                        {base.length > 0 && row(base)}
                        {[...byAxis.entries()].map(([axis, fs]) => (
                          <div key={axis} data-axis-group={axis} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{subLabel(axis)}{row(fs)}</div>
                        ))}
                        {ghosts.length > 0 && (
                          <div data-states-group style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{subLabel('States')}{row(ghosts)}</div>
                        )}
                      </>
                    )
                  })()}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
