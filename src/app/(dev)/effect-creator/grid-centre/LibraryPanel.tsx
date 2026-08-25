'use client'

// LibraryPanel — the layout-library AUTHORING panel (admin). Renders and edits library
// selection state ONLY: pure library data in, stable-ID selection out. No engine imports, no
// solver policy — the bridge is the only place library records meet engine types, and the
// page owns the one canvas this selection feeds.

import {
  LAYOUT_LIBRARY, LIBRARY_SHAPES, UNIVERSAL_PRIMITIVES, FAMILY_APPLICABILITY_DRAFT,
  frameKeyOf, kindOf, orientationOf, selectedRecords,
  type LibrarySelection,
} from '@/lib/effect/grid-magnet-library'

export default function LibraryPanel({ sel, setSel }: {
  sel: LibrarySelection
  setSel: (next: LibrarySelection) => void
}) {
  const { shape, frame } = selectedRecords(sel)
  const draft = FAMILY_APPLICABILITY_DRAFT[shape.family]
  return (
    <div className="gl-card" style={{ padding: 14 }}>
      <div className="gl-field"><span>Shape · the ruled classification set · family from the shape</span>
        <div className="gl-steps">
          {LIBRARY_SHAPES.map((s) => (
            <button key={s.id} aria-pressed={s.id === shape.id} onClick={() => setSel({ ...sel, shapeId: s.id })}>
              <b>{s.id}</b><span>{s.family}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="gl-field"><span>Frame · cols × rows · kind</span>
        <div className="gl-steps">
          {LAYOUT_LIBRARY.map((f) => (
            <button key={frameKeyOf(f)} aria-pressed={frameKeyOf(f) === frameKeyOf(frame)}
              onClick={() => setSel({ ...sel, frameKey: frameKeyOf(f), layoutId: f.layouts[0].name })}>
              <b>{f.cols}×{f.rows}</b><span>{orientationOf(f.cols, f.rows)} {kindOf(f.cols, f.rows)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="gl-field"><span>Layouts · {frame.layouts.length} presets</span>
        <div className="gl-steps">
          {frame.layouts.map((l) => (
            <button key={l.name} aria-pressed={sel.layoutId === l.name} onClick={() => setSel({ ...sel, layoutId: l.name })}>
              <b>{l.name}</b>
              <span>{l.nodes.length}⌾{l.note ? ' · Full-grid only' : ''}{draft.includes(l.name) ? '' : ' · outside family draft'}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="gl-field"><span>Universal primitives · tried in every band (ruled)</span>
        <div className="gl-steps">
          {UNIVERSAL_PRIMITIVES.map((l) => (
            <button key={l.name} aria-pressed={sel.layoutId === 'prim:' + l.name} onClick={() => setSel({ ...sel, layoutId: 'prim:' + l.name })}>
              <b>{l.name}</b><span>{l.nodes.length}⌾</span>
            </button>
          ))}
        </div>
      </div>
      <div className="gl-field"><span>View</span>
        <div className="gl-seg">
          <button aria-pressed={sel.view.transpose} onClick={() => setSel({ ...sel, view: { ...sel.view, transpose: !sel.view.transpose } })}>transpose</button>
          <button aria-pressed={sel.view.flipX} onClick={() => setSel({ ...sel, view: { ...sel.view, flipX: !sel.view.flipX } })}>flip ↔</button>
          <button aria-pressed={sel.view.flipY} onClick={() => setSel({ ...sel, view: { ...sel.view, flipY: !sel.view.flipY } })}>flip ↕</button>
        </div>
      </div>
      <div className="gl-magic-note">Family → layout applicability is a DRAFT for review — shown as tags, never applied as engine policy.</div>
    </div>
  )
}
