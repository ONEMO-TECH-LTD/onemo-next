'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isValidElementType } from 'react-is'

import type { AuthoringGraphV1, VariantFrame } from '@/app/api/dev/editor/authoring-types'
import type { SourceProjection } from '@/app/api/dev/editor/source-projection'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const projectComponents = (require as any).context('../../react-figma-components', true, /\.tsx$/)

type CanvasSnapshot = {
  graph: AuthoringGraphV1
  componentId: string
  projection: SourceProjection
  sourceHashes: Record<string, string>
}

const accent = 'var(--sem-col-border-brand)'

export function ComponentCanvas({ file }: { file: string }) {
  const [snapshot, setSnapshot] = useState<CanvasSnapshot | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const drag = useRef<{ id: string; x: number; y: number; frame: VariantFrame['frame'] } | null>(null)

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
    const variants = Object.values(snapshot.graph.variants).filter((variant) => variant.componentId === snapshot.componentId)
    const w = Math.max(800, ...variants.map((variant) => variant.frame.x + variant.frame.width + 80))
    const h = Math.max(600, ...variants.map((variant) => variant.frame.y + variant.frame.height + 80))
    window.parent.postMessage({ type: 'onemo-authoring-bounds', w, h }, '*')
  }, [snapshot])

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
      window.parent.postMessage({ type: 'onemo-authoring-changed' }, '*')
    } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }, [busy, load, snapshot])

  if (error) return <div role="alert" style={{ padding: 24, color: 'var(--sem-col-text-error-primary)' }}>{error}</div>
  if (!snapshot || !component) return <div style={{ padding: 24, color: 'var(--sem-col-text-secondary)' }}>Loading component…</div>
  const definition = snapshot.graph.components[snapshot.componentId]!
  const variants = Object.values(snapshot.graph.variants).filter((variant) => variant.componentId === snapshot.componentId)
  const props = new Map(snapshot.projection.nativeVariants.map((variant) => [variant.id, variant.props]))

  return (
    <div data-authoring-canvas data-component-id={definition.id} onPointerDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null) }}
      style={{ position: 'relative', width: '100%', height: '100%', minWidth: 800, minHeight: 600, background: 'var(--sem-col-bg-secondary)', fontFamily: 'var(--al-type-family-primary)' }}>
      {variants.map((variant) => {
        const selected = selectedId === variant.id
        return <figure key={variant.id} data-variant-id={variant.id} onPointerDown={(event) => {
          event.stopPropagation(); setSelectedId(variant.id)
          drag.current = { id: variant.id, x: event.clientX, y: event.clientY, frame: variant.frame }
          event.currentTarget.setPointerCapture(event.pointerId)
        }} onPointerUp={(event) => {
          const current = drag.current; drag.current = null
          if (!current) return
          const dx = event.clientX - current.x, dy = event.clientY - current.y
          if (Math.abs(dx) + Math.abs(dy) < 2) return
          void execute({ kind: 'move-variant', commandId: crypto.randomUUID(), componentId: definition.id, variantId: current.id, frame: { ...current.frame, x: current.frame.x + dx, y: current.frame.y + dy } })
        }} style={{ position: 'absolute', left: variant.frame.x, top: variant.frame.y, width: variant.frame.width, minHeight: variant.frame.height, margin: 0, padding: 12, boxSizing: 'border-box', background: 'var(--sem-col-bg-secondary)', border: `${selected ? 2 : 1}px ${selected ? 'solid' : 'dashed'} ${accent}`, borderRadius: 8 }}>
          <figcaption onClick={() => { if (selected) setRenamingId(variant.id) }} style={{ marginBottom: 8, color: accent, cursor: selected ? 'text' : 'default', fontSize: 12 }}>
            {renamingId === variant.id ? <input autoFocus defaultValue={variant.displayName} onBlur={(event) => { setRenamingId(null); const displayName = event.currentTarget.value.trim(); if (displayName && displayName !== variant.displayName) void execute({ kind: 'rename-variant', commandId: crypto.randomUUID(), componentId: definition.id, variantId: variant.id, displayName }) }} /> : variant.displayName}
            {variant.id === definition.primaryVariantId ? ' · Primary' : ''}
          </figcaption>
          {(() => { const Comp = component; return <Comp {...(props.get(variant.id) ?? {})} /> })()}
        </figure>
      })}
      {selectedId && <button type="button" disabled={busy} data-create-variant onClick={() => void execute({ kind: 'create-variant', commandId: crypto.randomUUID(), componentId: definition.id, displayName: `Variant ${variants.length + 1}` })}
        style={{ position: 'absolute', left: Math.max(...variants.map((variant) => variant.frame.x + variant.frame.width), 0) + 32, top: 0, border: `1px dashed ${accent}`, borderRadius: 999, padding: '8px 12px', color: 'var(--sem-col-text-brand-primary)', background: 'var(--sem-col-bg-secondary)', cursor: 'pointer' }}>+ Variant</button>}
    </div>
  )
}
