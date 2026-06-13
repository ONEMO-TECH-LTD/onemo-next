'use client'
// TEMPORARY audition surface — pick the reveal transition + replay it on the real object.
// REMOVE THIS FILE once Dan chooses: delete the import/mount in page.tsx and pin revealStore.fx
// to the chosen name. The composer + Magic wiring stay; only this picker goes.
import { useEffect, useState } from 'react'
import { useRevealStore } from './revealStore'

export default function RevealFxPicker({ fromUrl }: { fromUrl?: string }) {
  const fx = useRevealStore((s) => s.fx)
  const setFx = useRevealStore((s) => s.setFx)
  const start = useRevealStore((s) => s.start)
  const names = useRevealStore((s) => s.validFx) // only transitions that compiled on this driver

  useEffect(() => {
    const q = new URLSearchParams(location.search).get('fx')
    if (q && names.includes(q)) setFx(q)
  }, [names, setFx])

  return (
    <div style={{ position: 'fixed', top: 70, left: 14, zIndex: 50, display: 'flex', gap: 6, alignItems: 'center', background: 'rgba(255,255,255,.92)', borderRadius: 12, padding: '6px 10px', boxShadow: '0 4px 16px rgba(20,24,40,.14)', fontSize: 12, fontFamily: 'inherit' }}>
      <span style={{ opacity: .55 }}>reveal</span>
      <select value={fx} onChange={(e) => setFx(e.target.value)} style={{ font: 'inherit', maxWidth: 230 }}>
        {names.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      <button type="button" onClick={() => start(fromUrl)} style={{ font: '600 12px inherit', border: 0, borderRadius: 999, padding: '5px 12px', background: '#1c2030', color: '#fff', cursor: 'pointer' }}>▶ play on object</button>
    </div>
  )
}
