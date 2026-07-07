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

type Frame = { key: string; label: string; category: string; root: 'global' | 'project'; Comp: React.ElementType }

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
    for (const [name, val] of Object.entries(mod)) {
      if (isValidElementType(val) && typeof val !== 'string') {
        frames.push({ key: `project:${key}:${name}`, label: name, category, root: 'project', Comp: val as React.ElementType })
      }
    }
  }
  return frames
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
  React.useEffect(() => setMounted(true), [])
  const frames = mounted ? collectFrames() : []
  const byCategory = new Map<string, Frame[]>()
  for (const f of frames) {
    const cat = `${f.root === 'global' ? 'Global' : 'Project'} / ${f.category}`
    byCategory.set(cat, [...(byCategory.get(cat) ?? []), f])
  }
  return (
    <div data-components-canvas style={{ minWidth: 800, padding: 40, display: 'flex', flexDirection: 'column', gap: 48, background: '#f5f5f5' }}>
      {mounted && frames.length === 0 && (
        <div style={{ font: '13px system-ui', color: 'rgba(0,0,0,0.5)' }}>No components yet — create one from the Assets panel.</div>
      )}
      {[...byCategory.entries()].map(([cat, list]) => (
        <section key={cat} data-category={cat} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 style={{ margin: 0, font: '600 12px/1.2 system-ui', color: 'rgba(0,0,0,0.45)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{cat}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
            {list.map((f) => (
              <figure key={f.key} data-component-frame={f.label} data-frame-root={f.root} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <figcaption style={{ font: '500 11px/1.2 system-ui', color: '#9747ff' }}>{f.label}</figcaption>
                <div style={{ padding: 24, background: '#fff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)' }}>
                  <FrameBoundary label={f.label}>{React.createElement(f.Comp)}</FrameBoundary>
                </div>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
