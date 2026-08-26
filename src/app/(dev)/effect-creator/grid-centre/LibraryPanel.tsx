'use client'

// LibraryPanel — the layout-library AUTHORING panel (admin). A PURE VIEW: it renders the
// options the library hands it and holds no class logic — no "is this a diamond", no box maths,
// no sub-type test, no layout filtering, no draft matching. Options in, chips out.
// Dan, 08-26: "no logic in UI shell and poage".

import type { ReactElement, ReactNode } from 'react'
import { panelOptions, type LibraryEdit, type LibraryDraft, type LibrarySelection, type PanelOption } from '@/lib/effect/library'

type FoldComponent = (p: { title: ReactNode; children: ReactNode }) => ReactElement

export default function LibraryPanel({
  sel, setSel, Fold, pitch, boxMM, showBox, setShowBox, editError,
  edit, setEdit, drafts, saveEdit, deleteEdit, startAdd, startEdit, isDraft,
}: {
  sel: LibrarySelection
  setSel: (next: LibrarySelection) => void
  Fold: FoldComponent
  pitch: number
  boxMM: { w: number; h: number }
  showBox: boolean
  setShowBox: (v: boolean) => void
  edit: LibraryEdit | null
  setEdit: (d: LibraryEdit | null) => void
  editError: string | null
  drafts: LibraryDraft[]
  /** The selection names a saved layout of the admin's own. */
  isDraft: boolean
  saveEdit: () => void
  deleteEdit: () => void
  startAdd: () => void
  startEdit: () => void
}) {
  const opts = panelOptions(sel, drafts, pitch)
  // the only state the view adds is whether the editor is open; everything else is an option
  const go = (o: PanelOption) => { setEdit(null); setSel(o.next) }
  const pressed = (o: PanelOption) => !edit && o.active
  return (
    <>
      <div className="gl-card gl-libsize">
        <b>{Math.round(boxMM.w)}×{Math.round(boxMM.h)}</b><span>mm</span>
        <button className="gl-libdim" aria-pressed={showBox} onClick={() => setShowBox(!showBox)}>dimensions</button>
      </div>
      <Fold title="Type">
        <div className={opts.types.length > 3 ? 'gl-lib' : 'gl-seg'}>
          {opts.types.map((o) => (
            <button key={o.id} aria-pressed={o.active} disabled={opts.types.length === 1}
              onClick={() => go(o)}><b>{o.label}</b></button>
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
          {opts.layouts.map((o) => (
            <button key={o.id} aria-pressed={pressed(o)} onClick={() => go(o)}>
              <b>{o.label}</b>{o.custom && <span>custom</span>}
            </button>
          ))}
          <button className="gl-libadd" onClick={startAdd}><b>+</b></button>
        </div>
        <div className="gl-field" style={{ marginTop: 9, opacity: (edit || opts.spacing.some((o) => o.active)) ? 1 : 0.45 }}><span>Spacing</span>
          <div className="gl-seg">
            {opts.spacing.map((o) => (
              <button key={o.id} aria-pressed={pressed(o)} disabled={o.disabled} onClick={() => go(o)}>{o.label}</button>
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
