'use client'

// LibraryPanel — the layout-library AUTHORING panel (admin). Layouts of the selected frame are
// the working list: pick one to view, Edit to change it, + to add one to the frame. Selection
// and edit state only; no engine imports — the bridge is where library records meet engine types.

import type { ReactElement, ReactNode } from 'react'
import { CLASS_FRAMES, LIBRARY_SHAPES, frameKeyOf, rectangleSubOf, selectedRecords, type LibrarySelection, type LibraryDraft } from '@/lib/effect/grid-magnet-library'

type FoldComponent = (p: { title: ReactNode; children: ReactNode }) => ReactElement

export default function LibraryPanel({
  sel, setSel, Fold, pitch, showBox, setShowBox,
  edit, setEdit, drafts, saveEdit, deleteEdit, startAdd, startEdit,
}: {
  sel: LibrarySelection
  setSel: (next: LibrarySelection) => void
  Fold: FoldComponent
  pitch: number
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
  const { shape, frame } = selectedRecords({ ...sel, layoutId: sel.layoutId.startsWith('draft:') ? frame0(sel) : sel.layoutId })
  const frames = CLASS_FRAMES[shape.family]
  const key = frameKeyOf(frame)
  const mine = drafts.filter((d) => d.frameKey === key && d.className === shape.family)
  const boxW = 24 + (frame.cols - 1) * pitch, boxH = 24 + (frame.rows - 1) * pitch
  const isDraft = sel.layoutId.startsWith('draft:')
  return (
    <>
      <div className="gl-card gl-libsize">
        <b>{boxW}×{boxH}</b><span>mm</span>
        <button className="gl-libdim" aria-pressed={showBox} onClick={() => setShowBox(!showBox)}>dimensions</button>
      </div>
      <Fold title="Shape">
        <div className="gl-lib">
          {LIBRARY_SHAPES.filter((s) => s.family === shape.family).map((s) => (
            <button key={s.id} aria-pressed={s.id === shape.id} onClick={() => setSel({ ...sel, shapeId: s.id })}><b>{s.id}</b></button>
          ))}
        </div>
      </Fold>
      {shape.family === 'rectangle' && (
        <Fold title="Type">
          <div className="gl-seg">
            {(['slim', 'standard'] as const).map((sub) => (
              <button key={sub} aria-pressed={rectangleSubOf(frame.cols, frame.rows) === sub}
                onClick={() => {
                  const f0 = frames.find((f) => rectangleSubOf(f.cols, f.rows) === sub)!
                  setEdit(null)
                  setSel({ ...sel, frameKey: frameKeyOf(f0), layoutId: f0.layouts[0].name })
                }}>{sub}</button>
            ))}
          </div>
        </Fold>
      )}
      <Fold title="Frame">
        <div className="gl-lib">
          {frames.filter((f) => shape.family !== 'rectangle' || rectangleSubOf(f.cols, f.rows) === rectangleSubOf(frame.cols, frame.rows)).map((f) => (
            <button key={frameKeyOf(f)} aria-pressed={frameKeyOf(f) === key}
              onClick={() => {
                const keep = f.layouts.some((l) => l.name === sel.layoutId)
                setEdit(null)
                setSel({ ...sel, frameKey: frameKeyOf(f), layoutId: keep ? sel.layoutId : f.layouts[0].name })
              }}><b>{f.cols}×{f.rows}</b></button>
          ))}
        </div>
      </Fold>
      <Fold title="Layouts">
        <div className="gl-lib">
          {frame.layouts.filter((l) => l.name !== 'perimeter-96').map((l) => (
            <button key={l.name} aria-pressed={!edit && (sel.layoutId === l.name || (l.name === 'perimeter' && sel.layoutId === 'perimeter-96'))}
              onClick={() => { setEdit(null); setSel({ ...sel, layoutId: l.name }) }}><b>{l.name}</b></button>
          ))}
          {mine.map((d) => (
            <button key={d.id} aria-pressed={!edit && sel.layoutId === 'draft:' + d.name}
              onClick={() => { setEdit(null); setSel({ ...sel, layoutId: 'draft:' + d.name }) }}>
              <b>{d.name}</b><span>mine</span>
            </button>
          ))}
          <button className="gl-libadd" onClick={startAdd}><b>+</b></button>
        </div>
        {(sel.layoutId === 'perimeter' || sel.layoutId === 'perimeter-96') && !edit && (
          <div className="gl-field" style={{ marginTop: 9 }}><span>Belt · magnet spacing</span>
            <div className="gl-seg">
              <button aria-pressed={sel.layoutId === 'perimeter'} onClick={() => setSel({ ...sel, layoutId: 'perimeter' })}>48 mm</button>
              <button aria-pressed={sel.layoutId === 'perimeter-96'} onClick={() => setSel({ ...sel, layoutId: 'perimeter-96' })}>96 mm</button>
            </div>
          </div>
        )}
        {edit ? (
          <div className="gl-libedit">
            <input value={edit.name} placeholder="name" onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <button onClick={saveEdit} disabled={!edit.name.trim() || !edit.nodes.length}>save</button>
            <button onClick={() => setEdit(null)}>cancel</button>
            {isDraft && <button onClick={deleteEdit}>delete</button>}
          </div>
        ) : (
          <div className="gl-libedit">
            <button onClick={startEdit}>edit</button>
            {isDraft && <button onClick={deleteEdit}>delete</button>}
          </div>
        )}
      </Fold>
    </>
  )
}

/** A draft selection still needs a real corpus layout to resolve the frame — take the first. */
function frame0(sel: LibrarySelection): string {
  const shape = LIBRARY_SHAPES.find((x) => x.id === sel.shapeId) ?? LIBRARY_SHAPES[0]
  const fs = CLASS_FRAMES[shape.family]
  const f = fs.find((x) => frameKeyOf(x) === sel.frameKey) ?? fs[0]
  return f.layouts[0].name
}
