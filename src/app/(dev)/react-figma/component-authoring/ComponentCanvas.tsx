'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isValidElementType } from 'react-is'

import type { AuthoringGraphV1, VariantFrame } from '@/app/api/dev/editor/authoring-types'
import type { SourceProjection } from '@/app/api/dev/editor/source-projection'
import { componentCanvasGeometry, movedVariantFrame } from './gestures'
import { AUTHORING_RESUME_KEY } from './resume'

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
type ImportPreview = {
  action: 'import' | 'revalidate'
  projection: SourceProjection
  sourceHashes: Record<string, string>
  expectedRevision?: number
  changedPaths?: string[]
}

const accent = 'var(--sem-col-border-brand)'

export function ComponentCanvas({ file, undoNonce, onBounds, onChanged }: {
  file: string
  undoNonce: number
  onBounds: (width: number, height: number) => void
  onChanged: () => void
}) {
  const [snapshot, setSnapshot] = useState<CanvasSnapshot | null>(null)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const drag = useRef<{ id: string; x: number; y: number; frame: VariantFrame['frame'] } | null>(null)
  const cancelRename = useRef(false)
  const handledUndoNonce = useRef(undoNonce)
  const [dragPreview, setDragPreview] = useState<{ id: string; frame: VariantFrame['frame'] } | null>(null)

  const load = useCallback(async () => {
    const response = await fetch(`/api/dev/editor-authoring?mode=component-status&file=${encodeURIComponent(file)}`)
    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? `Authoring load failed (${response.status})`)
    if (data.authoringState === 'import-preview') {
      setSnapshot(null)
      setImportPreview({ ...data, action: 'import' })
      return
    }
    if (data.authoringState === 'source-stale') {
      setSnapshot(null)
      setImportPreview({ ...data, action: 'revalidate' })
      return
    }
    if (data.authoringState !== 'loaded') throw new Error('Authoring load returned an invalid state')
    setImportPreview(null)
    setSnapshot(data)
    if (sessionStorage.getItem(AUTHORING_RESUME_KEY) === file) sessionStorage.removeItem(AUTHORING_RESUME_KEY)
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
    sessionStorage.setItem(AUTHORING_RESUME_KEY, file)
    try {
      const response = await fetch('/api/dev/editor-authoring', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'execute-command', command, expectedRevision: snapshot.graph.revision, expectedSourceHashes: snapshot.sourceHashes }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? `Authoring command failed (${response.status})`)
      await load()
      onChanged()
    } catch (cause) {
      sessionStorage.removeItem(AUTHORING_RESUME_KEY)
      setError((cause as Error).message)
    } finally { setBusy(false) }
  }, [busy, file, load, onChanged, snapshot])

  const prepareSource = useCallback(async () => {
    if (!importPreview || busy) return
    setBusy(true); setError(null)
    sessionStorage.setItem(AUTHORING_RESUME_KEY, file)
    try {
      const response = await fetch('/api/dev/editor-authoring', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(importPreview.action === 'import'
          ? { kind: 'import-source', file, expectedSourceHashes: importPreview.sourceHashes }
          : { kind: 'revalidate-source', file, expectedRevision: importPreview.expectedRevision, expectedSourceHashes: importPreview.sourceHashes }),
      })
      const data = await response.json()
      if (!response.ok && data.code === 'SOURCE_HASH_STALE') {
        await load()
        setError(data.error ?? 'Source changed again; review the refreshed source state.')
        return
      }
      if (!response.ok) throw new Error(data.error ?? `Source preparation failed (${response.status})`)
      const expectedKind = importPreview.action === 'import' ? 'imported' : 'revalidated'
      if (data.kind !== expectedKind) throw new Error(data.reason ?? `Source preparation refused (${data.kind ?? 'unknown'})`)
      await load()
      onChanged()
    } catch (cause) {
      sessionStorage.removeItem(AUTHORING_RESUME_KEY)
      setError((cause as Error).message)
    } finally { setBusy(false) }
  }, [busy, file, importPreview, load, onChanged])

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

  if (importPreview) {
    const { projection } = importPreview
    const importable = projection.compatibility === 'native-v1' || projection.compatibility === 'legacy-single-axis'
    const variantCount = projection.compatibility === 'legacy-single-axis' ? projection.variantAxes[0]?.values.length ?? 0 : 1
    return <section data-authoring-import style={{ width: 360, margin: 24, padding: 20, border: '1px solid var(--sem-col-border-secondary)', borderRadius: 'var(--sem-radii-md)', background: 'var(--sem-col-bg-primary)', color: 'var(--sem-col-text-primary)', fontFamily: 'var(--al-type-family-primary)' }}>
      <h2 style={{ margin: 0, fontSize: 16 }}>{importPreview.action === 'import' ? 'Import component source' : 'Source changed'}</h2>
      <p style={{ margin: '8px 0 16px', color: 'var(--sem-col-text-secondary)' }}>{projection.exportName} · {projection.compatibility} · {variantCount} variant{variantCount === 1 ? '' : 's'}</p>
      {importPreview.action === 'revalidate' && <p style={{ margin: '0 0 16px', color: 'var(--sem-col-text-secondary)' }}>Revalidate the component against the current source before editing{importPreview.changedPaths?.length ? `: ${importPreview.changedPaths.join(', ')}` : '.'}</p>}
      {error && <div role="alert" style={{ marginBottom: 16, color: 'var(--sem-col-text-error-primary)' }}>{error}</div>}
      {importable
        ? <button type="button" disabled={busy} onClick={() => void prepareSource()} style={{ minHeight: 32, padding: '0 12px', border: 0, borderRadius: 'var(--sem-radii-full)', background: 'var(--sem-col-bg-brand-primary)', color: 'var(--sem-col-text-brand-primary)', cursor: busy ? 'default' : 'pointer', font: 'inherit' }}>{busy ? 'Working…' : importPreview.action === 'import' ? 'Import source' : 'Revalidate source'}</button>
        : <div role="alert" style={{ color: 'var(--sem-col-text-error-primary)' }}>{projection.unsupportedReason ?? 'This source requires an explicit conversion preview.'}</div>}
    </section>
  }
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
        }} onPointerCancel={() => { drag.current = null; setDragPreview(null) }} style={{ position: 'absolute', left: frame.x, top: frame.y, width: frame.width, minHeight: frame.height, margin: 0, padding: 12, boxSizing: 'border-box', background: selected ? 'var(--sem-col-bg-brand-primary)' : 'var(--sem-col-bg-primary)', border: `${selected ? 2 : 1}px ${selected ? 'solid' : 'dashed'} ${accent}`, borderRadius: 'var(--sem-radii-md)' }}>
          <figcaption onClick={() => { if (selected) { cancelRename.current = false; setRenamingId(variant.id) } }} style={{ marginBottom: 8, color: 'var(--sem-col-text-brand-primary)', cursor: selected ? 'text' : 'default', fontFamily: 'var(--sem-type-fluid-label-s-font)', fontSize: 'var(--sem-type-fluid-label-s-size)', lineHeight: 'var(--sem-type-fluid-label-s-line-height)', letterSpacing: 'var(--sem-type-fluid-label-s-letter-spacing)' }}>
            {renamingId === variant.id ? <input aria-label={`Rename ${variant.displayName}`} autoFocus defaultValue={variant.displayName} onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => {
              if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() }
              if (event.key === 'Escape') { event.preventDefault(); cancelRename.current = true; event.currentTarget.blur() }
            }} onBlur={(event) => {
              setRenamingId(null)
              if (cancelRename.current) { cancelRename.current = false; return }
              const displayName = event.currentTarget.value.trim()
              if (displayName && displayName !== variant.displayName) void execute({ kind: 'rename-variant', commandId: crypto.randomUUID(), componentId: definition.id, variantId: variant.id, displayName })
            }} /> : variant.displayName}
            {variant.id === definition.primaryVariantId ? ' · Primary' : ''}
          </figcaption>
          {(() => { const Comp = component; return <Comp {...(props.get(variant.id) ?? {})} /> })()}
        </figure>
      })}
      {selectedId && <button type="button" disabled={busy} data-create-variant data-ghost-label="+ Variant" aria-label="Create variant" onClick={() => void execute({ kind: 'create-variant', commandId: crypto.randomUUID(), componentId: definition.id, displayName: `Variant ${variants.length + 1}` })}
        style={{ position: 'absolute', left: ghost.x, top: ghost.y, width: ghost.width, height: ghost.height, border: `1px dashed ${accent}`, borderRadius: 'var(--sem-radii-md)', color: 'var(--sem-col-text-brand-primary)', background: 'var(--sem-col-bg-brand-primary)', cursor: 'pointer', fontFamily: 'var(--sem-type-fluid-label-s-font)', fontSize: 'var(--sem-type-fluid-label-s-size)', lineHeight: 'var(--sem-type-fluid-label-s-line-height)', letterSpacing: 'var(--sem-type-fluid-label-s-letter-spacing)' }}>+ Variant</button>}
    </div>
  )
}
