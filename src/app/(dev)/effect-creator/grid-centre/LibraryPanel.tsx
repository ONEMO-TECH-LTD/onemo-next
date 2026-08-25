'use client'

// LibraryPanel — the layout-library AUTHORING panel (admin). Renders and edits library
// selection state ONLY: pure library data in, selection out. No engine imports, no solver
// policy — the bridge (grid-magnet-library-bridge) is the only place library records meet
// engine types, and the page owns the one canvas this selection feeds.

import {
  LAYOUT_LIBRARY, LIBRARY_FAMILIES, FAMILY_APPLICABILITY_DRAFT, kindOf, orientationOf,
} from '@/lib/effect/grid-magnet-library'
import type { LibrarySelection } from '@/lib/effect/grid-magnet-library-bridge'

export default function LibraryPanel({ sel, setSel }: {
  sel: LibrarySelection
  setSel: (next: LibrarySelection) => void
}) {
  const frame = LAYOUT_LIBRARY[Math.max(0, Math.min(sel.frameIndex, LAYOUT_LIBRARY.length - 1))]
  const draft = FAMILY_APPLICABILITY_DRAFT[sel.family]
  return (
    <div className="gl-card" style={{ padding: 14 }}>
      <div className="gl-field"><span>Family · classifier taxonomy · demo shape</span>
        <div className="gl-seg">
          {LIBRARY_FAMILIES.map((f) => (
            <button key={f} aria-pressed={sel.family === f} onClick={() => setSel({ ...sel, family: f })}>{f}</button>
          ))}
        </div>
      </div>
      <div className="gl-field"><span>Frame · cols × rows · kind</span>
        <div className="gl-steps">
          {LAYOUT_LIBRARY.map((f, i) => (
            <button key={i} aria-pressed={i === sel.frameIndex}
              onClick={() => setSel({ ...sel, frameIndex: i, layoutIndex: 0 })}>
              <b>{f.cols}×{f.rows}</b><span>{orientationOf(f.cols, f.rows)} {kindOf(f.cols, f.rows)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="gl-field"><span>Layouts · {frame.layouts.length} presets</span>
        <div className="gl-steps">
          {frame.layouts.map((l, i) => (
            <button key={i} aria-pressed={i === sel.layoutIndex} onClick={() => setSel({ ...sel, layoutIndex: i })}>
              <b>{l.name}</b>
              <span>{l.nodes.length}⌾{l.note ? ' · Full-grid only' : ''}{draft.includes(l.name) ? '' : ' · outside family draft'}</span>
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
