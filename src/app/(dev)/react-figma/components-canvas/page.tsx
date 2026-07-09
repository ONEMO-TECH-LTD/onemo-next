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
const COMPONENT_TEXT = '#8638E5'
const COMPONENT_ACCENT = '#9747FF'
const CANVAS_BG = '#F5F5F5'
// I5 (§I5 + §3.2/§7): the 6 states shown as GHOST SLOTS on the edited component's board. INTERACTION states
// preview via `data-fc-preview="<state>"` on the host frame (the editor-only dual-selector half, §3.2); SEMANTIC
// states preview via the boolean PROP (`<Comp loading/>`), which drives the component's own `data-<state>`.
const INTERACTION_STATES = ['hover', 'pressed', 'focus'] as const
const SEMANTIC_STATES = ['disabled', 'loading', 'error'] as const
const GHOST_STATES: readonly string[] = [...INTERACTION_STATES, ...SEMANTIC_STATES]
const isInteractionState = (s?: string): boolean => !!s && (INTERACTION_STATES as readonly string[]).includes(s)

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
      ? axes.flatMap((ax) => ax.values.map((value) => ({
          key: `${entry.root}:${entry.file}:${ax.axis}=${value}`,
          label: `${ax.axis}=${value}`,
          category: entry.category ?? baseFrames[0].category,
          root: entry.root,
          file: entry.file,
          Comp: baseFrames[0].Comp,
          props: { [ax.axis]: value },
          axis: ax.axis,
        })))
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
      return <div data-frame-error={this.props.label} style={{ padding: 12, border: '1px dashed #f24822', borderRadius: 8, color: '#f24822', font: '11px system-ui', maxWidth: 240 }}>{this.props.label} failed: {this.state.err}</div>
    }
    return this.props.children
  }
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
  const [inventory, setInventory] = React.useState<InventoryEntry[] | null>(null)
  const fetchInventory = React.useCallback(() => {
    fetch('/api/dev/editor-components').then((r) => (r.ok ? r.json() : { components: [] }))
      .then((d: { components?: InventoryEntry[] }) => setInventory(d.components ?? []))
      .catch(() => setInventory([]))
  }, [])
  React.useEffect(() => { fetchInventory() }, [fetchInventory])
  // I5 (§I5): the editor shell posts `fc-board-refresh` after an authoring op (add axis/value/state) so the board
  // RE-FETCHES the inventory and shows the new frame live — "ALL authoring works FROM the board", not just renders
  // it. (Fast Refresh reloads the component module but never re-runs this mount-time fetch, so the axis-value
  // frames would otherwise stay stale until a manual reload.)
  React.useEffect(() => {
    const onMsg = (e: MessageEvent) => { if (e.data?.type === 'fc-board-refresh') fetchInventory() }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [fetchInventory])
  const loadingInventory = inventory === null
  const groups = loadingInventory ? [] : groupFrames(frames, inventory, editFile)
  const byCategory = new Map<string, ComponentGroup[]>()
  for (const g of groups) {
    const cat = `${g.root === 'global' ? 'Global' : 'Project'} / ${g.category}`
    byCategory.set(cat, [...(byCategory.get(cat) ?? []), g])
  }
  return (
    <div data-components-canvas suppressHydrationWarning style={{ minWidth: 800, padding: 40, display: 'flex', flexDirection: 'column', gap: 48, background: CANVAS_BG }}>
      {mounted && frames.length === 0 && (
        <div style={{ font: '13px system-ui', color: 'rgba(0,0,0,0.5)' }}>No components yet — create one from the Assets panel.</div>
      )}
      {frames.length > 0 && loadingInventory && (
        <div style={{ font: '13px system-ui', color: 'rgba(0,0,0,0.5)' }}>Loading component inventory…</div>
      )}
      {[...byCategory.entries()].map(([cat, list]) => (
        <section key={cat} data-category={cat} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 style={{ margin: 0, font: '600 12px/1.2 system-ui', color: 'rgba(0,0,0,0.45)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{cat}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
            {list.map((group) => (
              <article key={group.key} data-component-group={group.name} data-frame-root={group.root} title={group.file} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span aria-hidden style={{ width: 10, height: 10, transform: 'rotate(45deg)', borderRadius: 2, background: COMPONENT_ACCENT, flex: 'none' }} />
                  <h3 style={{ margin: 0, font: '600 11px/1.2 system-ui', color: COMPONENT_TEXT }}>{group.name}</h3>
                  {group.variants.length > 1 && <span style={{ font: '500 10px/1.2 system-ui', color: 'rgba(0,0,0,0.45)' }}>{group.variants.length} variants</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24, borderRadius: 12, border: `1px ${group.variants.length > 1 ? 'dashed' : 'solid'} ${COMPONENT_ACCENT}` }}>
                  {(() => {
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
                          {showLabel && <figcaption style={{ font: '500 11px/1.2 system-ui', color: f.state ? 'rgba(0,0,0,0.5)' : COMPONENT_TEXT }}>{f.label}</figcaption>}
                          <div style={{ padding: 24, background: '#fff', borderRadius: 12, ...(f.state ? { outline: '1px dashed rgba(0,0,0,0.15)', outlineOffset: -1 } : {}) }}>
                            <FrameBoundary label={f.label}>{React.createElement(f.Comp, props)}</FrameBoundary>
                          </div>
                        </figure>
                      )
                    }
                    const row = (fs: Frame[]) => <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>{fs.map(renderFrame)}</div>
                    const subLabel = (t: string) => <div style={{ font: '600 9px/1 system-ui', color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t}</div>
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
