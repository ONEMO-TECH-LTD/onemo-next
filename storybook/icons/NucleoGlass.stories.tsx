/**
 * Icons / Nucleo Glass — the ONEMO glass icon set, its own clean section.
 *
 * Source: `nucleo-glass-icons` (v0.2.1, latest installed) — gradient-native glass glyphs.
 * This is the icon set the Create Studio dock draws from. NOTE: this is the glass *icons*,
 * distinct from the glass *material effect* under Prototypes / Glass Tests.
 */
import type { Meta, StoryObj } from '@storybook/nextjs'
import React, { useMemo, useState } from 'react'
import * as NucGlass from 'nucleo-glass-icons/react'

const EXCLUDE = new Set(['Icon', 'IconNames', 'Icons', 'createIcon', 'createReactIconFactory', 'default'])
const NAMES = Object.keys(NucGlass).filter((k) => /^[A-Z]/.test(k) && !EXCLUDE.has(k)).sort()
const comp = (n: string) => (NucGlass as Record<string, React.ComponentType<{ size?: number }>>)[n]

function GlassGallery({ size = 40, bg = '#e8eaed' }: { size?: number; bg?: string }) {
  const [q, setQ] = useState('')
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return NAMES.filter((n) => !s || n.toLowerCase().includes(s))
  }, [q])
  return (
    <div style={{ background: bg, minHeight: '100vh', fontFamily: 'ui-sans-serif, system-ui', color: '#2C3A4A' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 1, background: bg, padding: '12px 16px', borderBottom: '1px solid #d2d2d2' }}>
        <strong>Nucleo Glass</strong>{' '}
        <span style={{ color: '#888', fontSize: 12 }}>— {shown.length}/{NAMES.length} · nucleo-glass-icons v0.2.1 (latest)</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="filter by name…"
          style={{ display: 'block', marginTop: 8, width: 280, padding: '6px 10px', borderRadius: 8, border: '1px solid #ccc', background: '#fff', color: '#2C3A4A', fontSize: 13 }}
        />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 16 }}>
        {shown.map((n) => {
          const C = comp(n)
          return (
            <div key={n} title={n} style={{ width: 104, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '14px 4px' }}>
              <span style={{ height: size, display: 'flex', alignItems: 'center' }}>{C ? <C size={size} /> : null}</span>
              <span style={{ fontSize: 9, color: '#888', textAlign: 'center', wordBreak: 'break-word', lineHeight: 1.2 }}>{n}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const meta: Meta<typeof GlassGallery> = { title: 'Icons/Nucleo Glass', component: GlassGallery, parameters: { layout: 'fullscreen' } }
export default meta
type S = StoryObj<typeof GlassGallery>

/** Every glass glyph in the set, A–Z, with a name filter. */
export const All: S = { name: 'All Glass Icons', render: () => <GlassGallery /> }
/** Large preview to read the glass gradients. */
export const Large: S = { name: 'Large', render: () => <GlassGallery size={64} /> }
