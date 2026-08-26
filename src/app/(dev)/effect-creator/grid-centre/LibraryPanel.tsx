'use client'

// LibraryPanel — the layout-library AUTHORING panel (admin). Pure view: it asks CLASS_RULES
// what a class offers and renders it. No class logic lives here — no "is this a diamond",
// no box maths, no sub-type tests. Selection state in, chips out.

import type { ReactElement, ReactNode } from 'react'
import {
 SPACING_MODES, SPACING_BASE, isSpacingMode,
  frameKeyOf, resolveSelection, panelOptions, draftLayoutId,
  type LibrarySelection, type LibraryDraft,
} from '@/lib/effect/library'

type FoldComponent = (p: { title: ReactNode; children: ReactNode }) => ReactElement

export default function LibraryPanel({
  sel, setSel, Fold, pitch, boxMM, showBox, setShowBox, editError,
  edit, setEdit, drafts, saveEdit, deleteEdit, startAdd, startEdit,
}: {
  sel: LibrarySelection
  setSel: (next: LibrarySelection) => void
  Fold: FoldComponent
  pitch: number
  boxMM: { w: number; h: number }
  showBox: boolean
  setShowBox: (v: boolean) => void
  edit: { name: string; nodes: Array<[number, number]> } | null
  setEdit: (d: { name: string; nodes: Array<[number, number]> } | null) => void
  editError: string | null
  drafts: LibraryDraft[]
  saveEdit: () => void
  deleteEdit: () => void
  startAdd: () => void
  startEdit: () => void
}) {
  const { shape, frame, draft } = resolveSelection(sel, drafts, pitch)
  const opts = panelOptions(sel, drafts, pitch)
  const key = frameKeyOf(frame)
  const mine = drafts.filter((d) => d.frameKey === key && d.className === shape.family
    && (d.geometryId ?? '') === (sel.geometryId ?? ''))
  const isDraft = !!draft
  const has = (n: string) => frame.layouts.some((l) => l.name === n)
  const go = (o: { next: typeof sel }) => { setEdit(null); setSel(o.next) }
  return (
    <>
      <div className="gl-card gl-libsize">
        <b>{Math.round(boxMM.w)}×{Math.round(boxMM.h)}</b><span>mm</span>
        <button className="gl-libdim" aria-pressed={showBox} onClick={() => setShowBox(!showBox)}>dimensions</button>
      </div>
      <Fold title="Type">
        <div className="gl-seg">
          {opts.types.map((o) => (
            <button key={o.id} aria-pressed={o.active} disabled={opts.types.length === 1}
              onClick={() => go(o)}>{o.label}</button>
          ))}
        </div>
      </Fold>
      {opts.orientations.length > 1 && (
        <Fold title="Orientation">
          <div className="gl-seg gl-liborient">
            {opts.orientations.map((o) => (
              <button key={o.id} aria-pressed={o.active} onClick={() => setSel(o.next)}>{o.label}</button>
            ))}
          </div>
        </Fold>
      )}
      <Fold title="Frame">
        <div className="gl-lib">
          {opts.frames.map((o) => (
            <button key={o.id} aria-pressed={o.active} onClick={() => go(o)}
              aria-label={o.accessibleLabel} title={o.accessibleLabel}><b>{o.label}</b></button>
          ))}
        </div>
      </Fold>

      <Fold title="Layouts">
        <div className="gl-lib">
          {frame.layouts.filter((l) => !isSpacingMode(l.name) || l.name === SPACING_BASE).map((l) => (
            <button key={l.name} aria-pressed={!edit && (sel.layoutId === l.name || (l.name === SPACING_BASE && isSpacingMode(sel.layoutId)))}
              onClick={() => { setEdit(null); setSel({ ...sel, layoutId: l.name }) }}><b>{l.name}</b></button>
          ))}
          {mine.map((d) => (
            <button key={d.id} aria-pressed={!edit && sel.layoutId === draftLayoutId(d.name)}
              onClick={() => { setEdit(null); setSel({ ...sel, layoutId: draftLayoutId(d.name) }) }}>
              <b>{d.name}</b><span>custom</span>
            </button>
          ))}
          <button className="gl-libadd" onClick={startAdd}><b>+</b></button>
        </div>
        <div className="gl-field" style={{ marginTop: 9, opacity: (edit || isSpacingMode(sel.layoutId)) ? 1 : 0.45 }}><span>Spacing</span>
          <div className="gl-seg">
            {SPACING_MODES.map((m) => (
              <button key={m.layoutId} aria-pressed={!edit && sel.layoutId === m.layoutId} disabled={!has(m.layoutId)}
                onClick={() => { setEdit(null); setSel({ ...sel, layoutId: m.layoutId }) }}>{m.label}</button>
            ))}
            <button aria-pressed={!!edit} onClick={startEdit}>custom</button>
          </div>
        </div>
        {edit ? (
          <div className="gl-libedit">
            <input value={edit.name} placeholder="custom name" onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <button onClick={saveEdit} disabled={!edit.name.trim() || !edit.nodes.length || !!editError}>save</button>
            <button onClick={() => setEdit(null)}>cancel</button>
            {isDraft && <button onClick={deleteEdit}>delete</button>}
            {editError && <em className="gl-liberr">{editError}</em>}
          </div>
        ) : isDraft ? (
          <div className="gl-libedit"><button onClick={deleteEdit}>delete</button></div>
        ) : null}
      </Fold>
    </>
  )
}
