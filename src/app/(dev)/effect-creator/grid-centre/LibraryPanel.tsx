'use client'

// LibraryPanel — the layout-library AUTHORING panel (admin). Pure view: it asks CLASS_RULES
// what a class offers and renders it. No class logic lives here — no "is this a diamond",
// no box maths, no sub-type tests. Selection state in, chips out.

import type { ReactElement, ReactNode } from 'react'
import {
  CLASS_FRAMES, CLASS_RULES, SPACING_MODES, SPACING_BASE, isSpacingMode,
  frameKeyOf, pickLayout, resolveSelection, draftLayoutId,
  type LibrarySelection, type LibraryDraft,
} from '@/lib/effect/library'

type FoldComponent = (p: { title: ReactNode; children: ReactNode }) => ReactElement

export default function LibraryPanel({
  sel, setSel, Fold, pitch, padMM, showBox, setShowBox,
  edit, setEdit, drafts, saveEdit, deleteEdit, startAdd, startEdit,
}: {
  sel: LibrarySelection
  setSel: (next: LibrarySelection) => void
  Fold: FoldComponent
  pitch: number
  padMM: number
  showBox: boolean
  setShowBox: (v: boolean) => void
  edit: { name: string; nodes: Array<[number, number]> } | null
  setEdit: (d: { name: string; nodes: Array<[number, number]> } | null) => void
  drafts: LibraryDraft[]
  saveEdit: () => void
  deleteEdit: () => void
  startAdd: () => void
  startEdit: () => void
}) {
  const { shape, frame, draft } = resolveSelection(sel, drafts)
  const rules = CLASS_RULES[shape.family]
  const frames = CLASS_FRAMES[shape.family]
  const key = frameKeyOf(frame)
  const mine = drafts.filter((d) => d.frameKey === key && d.className === shape.family)
  const isDraft = !!draft
  const sub = rules.subOf(frame.cols, frame.rows)
  const shown = { c: sel.view.transpose ? frame.rows : frame.cols, r: sel.view.transpose ? frame.cols : frame.rows }
  const sameView = (v: typeof sel.view) => v.transpose === sel.view.transpose && v.flipX === sel.view.flipX && v.flipY === sel.view.flipY
  const box = rules.boxMM(shown.c, shown.r, pitch, padMM)
  const has = (n: string) => frame.layouts.some((l) => l.name === n)
  const jump = (f: typeof frame) => { setEdit(null); setSel({ ...sel, frameKey: frameKeyOf(f), layoutId: pickLayout(f, sel.layoutId) }) }
  return (
    <>
      <div className="gl-card gl-libsize">
        <b>{Math.round(box.w)}×{Math.round(box.h)}</b><span>mm</span>
        <button className="gl-libdim" aria-pressed={showBox} onClick={() => setShowBox(!showBox)}>dimensions</button>
      </div>
      <Fold title="Type">
        <div className="gl-seg">
          {rules.subs.map((s) => (
            <button key={s} aria-pressed={sub === s} disabled={rules.subs.length === 1}
              onClick={() => { const f0 = frames.find((f) => rules.subOf(f.cols, f.rows) === s); if (f0) jump(f0) }}>{s}</button>
          ))}
        </div>
      </Fold>
      {rules.orientations.length > 0 && (
        <Fold title="Orientation">
          <div className="gl-seg">
            {rules.orientations.map((o) => (
              <button key={o.id} aria-pressed={sameView(o.view)}
                onClick={() => setSel({ ...sel, view: { ...o.view } })}>{o.id}</button>
            ))}
          </div>
        </Fold>
      )}
      <Fold title="Frame">
        <div className="gl-lib">
          {frames.filter((f) => rules.subOf(f.cols, f.rows) === sub).map((f) => (
            <button key={frameKeyOf(f)} aria-pressed={frameKeyOf(f) === key} onClick={() => jump(f)}>
              <b>{rules.label(f.cols, f.rows)}</b>
            </button>
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
            <button onClick={saveEdit} disabled={!edit.name.trim() || !edit.nodes.length}>save</button>
            <button onClick={() => setEdit(null)}>cancel</button>
            {isDraft && <button onClick={deleteEdit}>delete</button>}
          </div>
        ) : isDraft ? (
          <div className="gl-libedit"><button onClick={deleteEdit}>delete</button></div>
        ) : null}
      </Fold>
    </>
  )
}
