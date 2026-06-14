'use client'
// TEMPORARY dev trigger — replay the particle effect on the object on demand (the test cycle).
// REMOVE once the effect is pinned: delete the import/mount in page.tsx. The Magic transition fires
// the effect on its own; this button is just for auditioning the look without re-running Magic.
import { useRevealStore } from './revealStore'

export default function RevealFxPicker() {
  const start = useRevealStore((s) => s.start)
  return (
    <div style={{ position: 'fixed', top: 70, left: 14, zIndex: 50, display: 'flex', gap: 6, alignItems: 'center' }}>
      <button type="button" onClick={() => start()} style={{ font: '600 12px inherit', border: 0, borderRadius: 999, padding: '6px 14px', background: '#1c2030', color: '#fff', cursor: 'pointer', boxShadow: '0 4px 16px rgba(20,24,40,.18)' }}>▶ play on object</button>
    </div>
  )
}
