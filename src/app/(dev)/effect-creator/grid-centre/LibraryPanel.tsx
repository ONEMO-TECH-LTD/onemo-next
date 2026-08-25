'use client'

// LibraryPanel — the layout-library AUTHORING panel (admin). Structured per Dan's direction:
// FAMILY tabs -> that family's SHAPE chips -> FRAME -> LAYOUTS (count varieties) -> primitives
// -> view. Renders/edits selection state only; no engine imports, no solver policy. The bridge
// is the only place library records meet engine types; the page owns the one canvas.

import type { ComponentProps, ReactElement, ReactNode } from 'react'
import {
  LAYOUT_LIBRARY, LIBRARY_SHAPES,
  frameKeyOf, selectedRecords,
  draftIntegrity, draftId,
  type LibrarySelection, type LibraryDraft,
} from '@/lib/effect/grid-magnet-library'

type FoldComponent = (p: { title: ReactNode; children: ReactNode }) => ReactElement

export default function LibraryPanel({ sel, setSel, Fold, pitch, draft, setDraft, drafts, saveDraft, deleteDraft, openDraft, newDraft, exportDrafts }: {
  sel: LibrarySelection
  setSel: (next: LibrarySelection) => void
  Fold: FoldComponent
  pitch: number
  draft: { name: string; nodes: Array<[number, number]> } | null
  setDraft: (d: { name: string; nodes: Array<[number, number]> } | null) => void
  drafts: LibraryDraft[]
  saveDraft: () => void
  deleteDraft: (id: string) => void
  openDraft: (d: LibraryDraft) => void
  newDraft: () => void
  exportDrafts: () => void
}) {
  const { shape, frame } = selectedRecords(sel)
  const layouts = [...frame.layouts].sort((a, b) => a.nodes.length - b.nodes.length)
  return (
    <>
      <Fold title="Shape">
        <div className="gl-lib">
          {LIBRARY_SHAPES.filter((s) => s.family === shape.family).map((s) => (
            <button key={s.id} aria-pressed={s.id === shape.id} onClick={() => setSel({ ...sel, shapeId: s.id })}><b>{s.id}</b></button>
          ))}
        </div>
      </Fold>
      <Fold title="Frame">
        <div className="gl-lib">
          {LAYOUT_LIBRARY.map((f) => (
            <button key={frameKeyOf(f)} aria-pressed={frameKeyOf(f) === frameKeyOf(frame)}
              onClick={() => {
                // The variety stays selected across a size change — same layout name in the new
                // frame when it exists (Dan: varieties must stay applied on the size change).
                const keep = sel.layoutId.startsWith('prim:') || f.layouts.some((l) => l.name === sel.layoutId)
                setSel({ ...sel, frameKey: frameKeyOf(f), layoutId: keep ? sel.layoutId : f.layouts[0].name })
              }}>
              <b>{f.cols}×{f.rows}</b><span>{24 + (f.cols - 1) * pitch}×{24 + (f.rows - 1) * pitch} mm</span>
            </button>
          ))}
        </div>
      </Fold>
      <Fold title="Layouts">
        <div className="gl-lib">
          {layouts.map((l) => (
            <button key={l.name} aria-pressed={sel.layoutId === l.name} onClick={() => setSel({ ...sel, layoutId: l.name })}>
              <b>{l.name}</b>
            </button>
          ))}
        </div>
      </Fold>
      <Fold title={draft ? `Authoring · ${draft.nodes.length}⌾ · click spots` : 'Authoring'}>
        {draft ? <>
          <div className="gl-limits">
            <span className="gl-num" style={{ flex: 1 }}><i>name</i>
              <input value={draft.name} placeholder="layout name"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></span>
          </div>
          <div className="gl-seg" style={{ marginTop: 8 }}>
            <button onClick={saveDraft}>Save to {shape.family} · {frameKeyOf(frame)}</button>
            <button onClick={() => setDraft({ ...draft, nodes: [] })}>Clear</button>
            <button onClick={() => setDraft(null)}>Close</button>
          </div>
          {(() => {
            const errs = draftIntegrity({ id: draftId(shape.family, frameKeyOf(frame), draft.name), className: shape.family, frameKey: frameKeyOf(frame), name: draft.name, nodes: draft.nodes }, frame)
            return errs.length ? <div className="gl-magic-note">{errs.join(' · ')}</div> : null
          })()}
        </> : <div className="gl-seg"><button onClick={newDraft}>New layout</button></div>}
        {drafts.length > 0 && <div className="gl-field" style={{ marginTop: 10 }}><span>Saved drafts · {drafts.length}</span>
          <div className="gl-lib">
            {drafts.map((d) => (
              <button key={d.id} onClick={() => openDraft(d)}>
                <b>{d.name}</b><span>{d.className} · {d.frameKey} · {d.nodes.length}⌾</span>
              </button>
            ))}
          </div>
          <div className="gl-seg" style={{ marginTop: 8 }}>
            <button onClick={exportDrafts}>Export all</button>
            {draft !== null && <button onClick={() => deleteDraft(draftId(shape.family, frameKeyOf(frame), draft!.name))}>Delete this</button>}
          </div>
        </div>}
      </Fold>
    </>
  )
}
