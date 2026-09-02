'use client'

// shape-rando — dev bench for the shape-randomizer lib. RENDER ONLY: family chips, a dice
// button, seed display, optional subject-box framing demo. All logic lives in the lib.

import { useState } from 'react'
import { FAMILY_NAMES, rollUntilBalanced, type Family } from '@/lib/shape-randomizer'

const VIEW = 480
const SUBJECT = { cx: VIEW / 2, cy: VIEW / 2, w: 200, h: 150 }
const SEED0 = 20260807

export default function ShapeRando() {
  const [family, setFamily] = useState<Family>('blob')
  const [seed, setSeed] = useState(SEED0)
  const [frame, setFrame] = useState(false)

  const r = rollUntilBalanced(
    frame
      ? { family, seed, subject: SUBJECT, marginFrac: 0.18 }
      : { family, seed },
  )
  const pts = frame ? r.ring : r.ring.map((p) => ({ x: p.x * VIEW, y: p.y * VIEW }))
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z'

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 20, fontFamily: 'ui-sans-serif, system-ui', color: '#0f172a' }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, textAlign: 'center' }}>Shape randomizer bench</h1>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', margin: '12px 0' }}>
        {FAMILY_NAMES.map((f) => (
          <button key={f} onClick={() => setFamily(f)}
            style={{ padding: '5px 11px', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1', background: family === f ? '#0f172a' : '#f1f5f9', color: family === f ? '#fff' : '#0f172a', fontWeight: 600 }}>
            {f}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 12, fontSize: 12 }}>
        <button onClick={() => setSeed((s) => (s * 1103515245 + 12345) >>> 0)}
          style={{ padding: '8px 16px', fontSize: 14, borderRadius: 8, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', fontWeight: 700 }}>
          🎲 Surprise me
        </button>
        <button onClick={() => setFrame((v) => !v)}
          style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1', background: frame ? '#0f172a' : '#f1f5f9', color: frame ? '#fff' : '#0f172a', fontWeight: 600 }}>
          {frame ? '▣ framing subject' : '▢ frame subject'}
        </button>
        <span style={{ color: '#64748b' }}>seed {r.seed} · score {r.score.toFixed(2)}</span>
      </div>
      <svg width={VIEW} height={VIEW} viewBox={`0 0 ${VIEW} ${VIEW}`} style={{ display: 'block', margin: '0 auto', border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff' }}>
        <path d={d} fill="#7c3aed22" stroke="#7c3aed" strokeWidth={2.5} />
        {frame && (
          <rect x={SUBJECT.cx - SUBJECT.w / 2} y={SUBJECT.cy - SUBJECT.h / 2} width={SUBJECT.w} height={SUBJECT.h}
            fill="none" stroke="#0ea5e9" strokeDasharray="6 4" strokeWidth={1.5} />
        )}
      </svg>
      <p style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 10 }}>
        Deterministic: the seed fully reproduces the shape. The blue box is a stand-in subject —
        framed loosely with ≥18% margin, containment enforced by the balance gate.
      </p>
    </div>
  )
}
