'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isValidElementType } from 'react-is'

import type { AuthoringGraphV1, VariantFrame } from '@/app/api/dev/editor/authoring-types'
import type { SourceProjection } from '@/app/api/dev/editor/source-projection'
import { componentCanvasGeometry, movedVariantFrame } from './gestures'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const projectComponents = (require as any).context('../../react-figma-components', true, /\.tsx$/)

type CanvasSnapshot = {
  graph: AuthoringGraphV1
  componentId: string
  projection: SourceProjection
  sourceHashes: Record<string, string>
  variantProps: Record<string, Record<string, string | number | boolean | null>>
  canUndo: boolean
}

const accent = 'var(--sem-col-border-brand)'

export function ComponentCanvas({ file, undoNonce, onBounds, onChanged }: {
  file: string
  undoNonce: number
  onBounds: (width: number, height: number) => void
  onChanged: () => void
}) {
  const [snapshot, setSnapshot] = useState<CanvasSnapshot | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const drag = useRef<{ id: string; x: number; y: number; frame: VariantFrame['frame'] } | null>(null)
  const handledUndoNonce = useRef(undoNonce)
  const [dragPreview, setDragPreview] = useState<{ id: string; frame: VariantFrame['frame'] } | null>(null)

  const load = useCallback(async () => {
    const response = await fetch(`/api/dev/editor-authoring?mode=component&file=${encodeURIComponent(file)}`)
    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? `Authoring load failed (${response.status})`)
    setSnapshot(data)
    setSelectedId((current) => current && data.graph.variants[current] ? current : data.graph.components[data.componentId]?.primaryVariantId ?? null)
  }, [file])

  useEffect(() => {
    let live = true
    setError(null)
    load().catch((cause) => { if (live) setError((cause as Error).message) })
    return () => { live = false }
  }, [load])

  useEffect(() => {
    if (!snapshot) return
    const definition = snapshot.graph.components[snapshot.componentId]!
    const variants = Object.values(snapshot.graph.variants).filter((variant) => variant.componentId === snapshot.componentId)
    const primary = snapshot.graph.variants[definition.primaryVariantId]!
    const { bounds } = componentCanvasGeometry(variants.map((variant) => variant.frame), primary.frame)
    onBounds(bounds.width, bounds.height)
  }, [onBounds, snapshot])

  const component = useMemo(() => {
    if (!snapshot) return null
    const key = `./${file.replace('src/app/(dev)/react-figma-components/', '')}`
    if (!projectComponents.keys().includes(key)) return null
    const candidate = projectComponents(key)?.[snapshot.projection.exportName]
    return isValidElementType(candidate) ? candidate : null
  }, [file, snapshot])

  const execute = useCallback(async (command: object) => {
    if (!snapshot || busy) return
    setBusy(true); setError(null)
    try {
      const response = await fetch('/api/dev/editor-authoring', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'execute-command', command, expectedRevision: snapshot.graph.revision, expectedSourceHashes: snapshot.sourceHashes }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? `Authoring command failed (${response.status})`)
      await load()
      onChanged()
    } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }, [busy, load, onChanged, snapshot])

  const undo = useCallback(async () => {
    if (!snapshot?.canUndo || busy) return
    setBusy(true); setError(null)
    try {
      const response = await fetch('/api/dev/editor-authoring', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'undo', expectedRevision: snapshot.graph.revision, expectedSourceHashes: snapshot.sourceHashes }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? `Authoring undo failed (${response.status})`)
      await load()
      onChanged()
    } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }, [busy, load, onChanged, snapshot])

  useEffect(() => {
    if (undoNonce === handledUndoNonce.current) return
    handledUndoNonce.current = undoNonce
    void undo()
  }, [undo, undoNonce])

  if (error) return <div role="alert" style={{ padding: 24, color: 'var(--sem-col-text-error-primary)' }}>{error}</div>
  if (!snapshot || !component) return <div style={{ padding: 24, color: 'var(--sem-col-text-secondary)' }}>Loading component…</div>
  const definition = snapshot.graph.components[snapshot.componentId]!
  const variants = Object.values(snapshot.graph.variants).filter((variant) => variant.componentId === snapshot.componentId)
  const props = new Map(Object.entries(snapshot.variantProps))
  const primary = snapshot.graph.variants[definition.primaryVariantId]!
  const { ghost } = componentCanvasGeometry(variants.map((variant) => variant.frame), primary.frame)

  return (
    <div data-authoring-canvas data-component-id={definition.id} onPointerDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null) }}
      style={{ position: 'relative', width: '100%', height: '100%', minWidth: 800, minHeight: 600, background: 'var(--sem-col-bg-secondary)', fontFamily: 'var(--al-type-family-primary)' }}>
      {variants.map((variant) => {
        const selected = selectedId === variant.id
        const frame = dragPreview?.id === variant.id ? dragPreview.frame : variant.frame
        return <figure key={variant.id} data-variant-id={variant.id} onPointerDown={(event) => {
          event.stopPropagation(); setSelectedId(variant.id)
          drag.current = { id: variant.id, x: event.clientX, y: event.clientY, frame: variant.frame }
          setDragPreview({ id: variant.id, frame: variant.frame })
        }} onPointerMove={(event) => {
          const current = drag.current
          if (!current || current.id !== variant.id) return
          if (Math.abs(event.clientX - current.x) + Math.abs(event.clientY - current.y) >= 2 && !event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.setPointerCapture(event.pointerId)
          }
          setDragPreview({ id: current.id, frame: { ...current.frame, x: current.frame.x + event.clientX - current.x, y: current.frame.y + event.clientY - current.y } })
        }} onPointerUp={(event) => {
          const current = drag.current; drag.current = null; setDragPreview(null)
          if (!current) return
          const dx = event.clientX - current.x, dy = event.clientY - current.y
          const moved = movedVariantFrame(current.frame, dx, dy)
          if (!moved) return
          void execute({ kind: 'move-variant', commandId: crypto.randomUUID(), componentId: definition.id, variantId: current.id, frame: moved })
        }} onPointerCancel={() => { drag.current = null; setDragPreview(null) }} style={{ position: 'absolute', left: frame.x, top: frame.y, width: frame.width, minHeight: frame.height, margin: 0, padding: 12, boxSizing: 'border-box', background: 'var(--sem-col-bg-secondary)', border: `${selected ? 2 : 1}px ${selected ? 'solid' : 'dashed'} ${accent}`, borderRadius: 8 }}>
          <figcaption onClick={() => { if (selected) setRenamingId(variant.id) }} style={{ marginBottom: 8, color: accent, cursor: selected ? 'text' : 'default', fontSize: 12 }}>
            {renamingId === variant.id ? <input autoFocus defaultValue={variant.displayName} onPointerDown={(event) => event.stopPropagation()} onBlur={(event) => { setRenamingId(null); const displayName = event.currentTarget.value.trim(); if (displayName && displayName !== variant.displayName) void execute({ kind: 'rename-variant', commandId: crypto.randomUUID(), componentId: definition.id, variantId: variant.id, displayName }) }} /> : variant.displayName}
            {variant.id === definition.primaryVariantId ? ' · Primary' : ''}
          </figcaption>
          {(() => { const Comp = component; return <Comp {...(props.get(variant.id) ?? {})} /> })()}
        </figure>
      })}
      {selectedId && <button type="button" disabled={busy} data-create-variant data-ghost-label="+ Variant" aria-label="Create variant" onClick={() => void execute({ kind: 'create-variant', commandId: crypto.randomUUID(), componentId: definition.id, displayName: `Variant ${variants.length + 1}` })}
        style={{ position: 'absolute', left: ghost.x, top: ghost.y, width: ghost.width, height: ghost.height, border: `1px dashed ${accent}`, borderRadius: 8, color: 'var(--sem-col-text-brand-primary)', background: 'color-mix(in srgb, var(--sem-col-bg-secondary) 88%, transparent)', cursor: 'pointer', font: 'inherit' }}>+ Variant</button>}
    </div>
  )
}
