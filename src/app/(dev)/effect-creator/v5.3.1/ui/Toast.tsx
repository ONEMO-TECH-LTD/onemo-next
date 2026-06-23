// Toast — G4 error/notice surface (blueprint §7 G4): no user-reachable failure may be swallowed.
// Worker errors, feasibility rejections, save failures, and commit self-heals all speak here.
// Module-level `toast()` so engine/editor code can report without prop-threading; <ToastSurface/>
// renders the queue. Pure DOM, no portal dependency, auto-dismiss.

'use client'

import { useEffect, useState } from 'react'

export type ToastKind = 'info' | 'success' | 'warn' | 'error'
interface ToastEntry { id: number; kind: ToastKind; text: string }

let seq = 0
let queue: ToastEntry[] = []
let listeners: ((q: ToastEntry[]) => void)[] = []

export function toast(kind: ToastKind, text: string, ttlMs = 4200) {
  const entry = { id: ++seq, kind, text }
  queue = [...queue.slice(-3), entry]
  for (const l of listeners) l(queue)
  setTimeout(() => {
    queue = queue.filter((t) => t.id !== entry.id)
    for (const l of listeners) l(queue)
  }, ttlMs)
}

const KIND_BG: Record<ToastKind, string> = {
  info: 'rgba(20,24,40,0.92)',
  success: 'rgba(22,68,40,0.94)',
  warn: 'rgba(96,72,16,0.94)',
  error: 'rgba(96,24,28,0.94)',
}

export default function ToastSurface() {
  const [items, setItems] = useState<ToastEntry[]>([])
  useEffect(() => {
    const l = (q: ToastEntry[]) => setItems([...q])
    listeners.push(l)
    return () => { listeners = listeners.filter((x) => x !== l) }
  }, [])
  if (!items.length) return null
  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed', top: 'calc(14px + env(safe-area-inset-top))', left: '50%', transform: 'translateX(-50%)',
        zIndex: 95, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', pointerEvents: 'none',
      }}
    >
      {items.map((t) => (
        <div
          key={t.id}
          style={{
            background: KIND_BG[t.kind], color: '#f2f4f9', borderRadius: 12, padding: '9px 16px',
            fontSize: 13, fontWeight: 500, maxWidth: 'min(86vw, 480px)', textAlign: 'center',
            boxShadow: '0 8px 28px rgba(0,0,0,0.32)',
          }}
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}
