'use client'

// LibraryPanel — the layout-library AUTHORING panel (admin). Structured per Dan's direction:
// FAMILY tabs -> that family's SHAPE chips -> FRAME -> LAYOUTS (count varieties) -> primitives
// -> view. Renders/edits selection state only; no engine imports, no solver policy. The bridge
// is the only place library records meet engine types; the page owns the one canvas.

import type { ComponentProps, ReactElement, ReactNode } from 'react'
import {
  LAYOUT_LIBRARY, LIBRARY_SHAPES, LIBRARY_FAMILIES, UNIVERSAL_PRIMITIVES,
  FAMILY_APPLICABILITY_DRAFT, frameKeyOf, kindOf, orientationOf, selectedRecords,
  draftIntegrity, draftId,
  type LibrarySelection, type LibraryDraft,
} from '@/lib/effect/grid-magnet-library'

type FoldComponent = (p: { title: ReactNode; children: ReactNode }) => ReactElement

export default function LibraryPanel({ sel, setSel, Fold, draft, setDraft, drafts, saveDraft, deleteDraft, openDraft, newDraft, exportDrafts }: {
  sel: LibrarySelection
  setSel: (next: LibrarySelection) => void
  Fold: FoldComponent
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
  const applicable = FAMILY_APPLICABILITY_DRAFT[shape.family]
  const layouts = [...frame.layouts].sort((a, b) => a.nodes.length - b.nodes.length)
  return (
    <>
      <div className="gl-card" style={{ padding: 12 }}>
        <div className="gl-seg">
          {LIBRARY_FAMILIES.map((fam) => (
            <button key={fam} aria-pressed={shape.family === fam}
              onClick={() => {
                const first = LIBRARY_SHAPES.find((s) => s.family === fam)!
                setSel({ ...sel, shapeId: first.id })
              }}>{fam}</button>
          ))}
        </div>
      </div>
      <Fold title="Shape · this family's ruled set">
        <div className="gl-seg" style={{ flexWrap: 'wrap' }}>
          {LIBRARY_SHAPES.filter((s) => s.family === shape.family).map((s) => (
            <button key={s.id} aria-pressed={s.id === shape.id} onClick={() => setSel({ ...sel, shapeId: s.id })}>{s.id}</button>
          ))}
        </div>
      </Fold>
      <Fold title="Frame · size class · cols × rows">
        <div className="gl-steps">
          {LAYOUT_LIBRARY.map((f) => (
            <button key={frameKeyOf(f)} aria-pressed={frameKeyOf(f) === frameKeyOf(frame)}
              onClick={() => {
                // The variety stays selected across a size change — same layout name in the new
                // frame when it exists (Dan: varieties must stay applied on the size change).
                const keep = sel.layoutId.startsWith('prim:') || f.layouts.some((l) => l.name === sel.layoutId)
                setSel({ ...sel, frameKey: frameKeyOf(f), layoutId: keep ? sel.layoutId : f.layouts[0].name })
              }}>
              <b>{f.cols}×{f.rows}</b><span>{orientationOf(f.cols, f.rows)} {kindOf(f.cols, f.rows)}</span>
            </button>
          ))}
        </div>
      </Fold>
      <Fold title={`Layouts · ${frame.layouts.length} varieties in ${frameKeyOf(frame)}`}>
        <div className="gl-steps">
          {layouts.map((l) => (
            <button key={l.name} aria-pressed={sel.layoutId === l.name} onClick={() => setSel({ ...sel, layoutId: l.name })}>
              <b>{l.name}</b><span>{l.nodes.length}⌾{l.note ? ' · Full-grid only' : ''}{applicable.includes(l.name) ? '' : ' · draft: other family'}</span>
            </button>
          ))}
        </div>
        <div className="gl-field" style={{ marginTop: 10 }}><span>Universal · tried in every band (ruled)</span>
          <div className="gl-seg" style={{ flexWrap: 'wrap' }}>
            {UNIVERSAL_PRIMITIVES.map((l) => (
              <button key={l.name} aria-pressed={sel.layoutId === 'prim:' + l.name} onClick={() => setSel({ ...sel, layoutId: 'prim:' + l.name })}>{l.name} · {l.nodes.length}⌾</button>
            ))}
          </div>
        </div>
      </Fold>
      <Fold title={draft ? `Authoring · ${draft.nodes.length}⌾ · click lattice spots to toggle` : 'Authoring · sandbox drafts'}>
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
          <div className="gl-steps">
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
      <Fold title="View">
        <div className="gl-seg">
          <button aria-pressed={sel.view.transpose} onClick={() => setSel({ ...sel, view: { ...sel.view, transpose: !sel.view.transpose } })}>transpose</button>
          <button aria-pressed={sel.view.flipX} onClick={() => setSel({ ...sel, view: { ...sel.view, flipX: !sel.view.flipX } })}>flip ↔</button>
          <button aria-pressed={sel.view.flipY} onClick={() => setSel({ ...sel, view: { ...sel.view, flipY: !sel.view.flipY } })}>flip ↕</button>
        </div>
        <div className="gl-magic-note">Family → layout applicability is a DRAFT for review — tags only, never engine policy.</div>
      </Fold>
    </>
  )
}
