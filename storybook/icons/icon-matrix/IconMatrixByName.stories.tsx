/**
 * Matrix by NAME — Glass is the baseline (rows = glass icon names). Every other set is matched
 * purely by NAME-token overlap (no concept judgement). Several matches per cell are shown where the
 * vendor names several similar icons; blank = that vendor names nothing matching. Hover any icon for
 * its real export name. Filter box searches the glass baseline names.
 */
import type { Meta, StoryObj } from '@storybook/nextjs'
import React, { useMemo, useState } from 'react'
import * as Phosphor from '@phosphor-icons/react'
import * as Iconoir from 'iconoir-react'
import * as NucGlass from 'nucleo-glass-icons/react'
import * as NucUIOut from 'nucleo-ui-essential-outline-18'
import * as NucUIFill from 'nucleo-ui-essential-fill-18'
import * as NucCoreOut from 'nucleo-core-essential-outline-24'
import * as NucCoreFill from 'nucleo-core-essential-fill-24'

type Cmp = React.ComponentType<Record<string, unknown>>
type Ic = { name: string; tokens: string[]; el: React.ReactNode }
const LG = '#E8E8E8' // uniform light-grey background behind every icon
const INK = '#2C3A4A'
// Force every stroke-based icon to 1.25px, non-scaling so it's exactly 1.25px regardless of viewBox.
// (Fill/glass icons have no stroke — unaffected, stay solid.)
const ICON_CSS = '.icon-thin svg path,.icon-thin svg line,.icon-thin svg polyline,.icon-thin svg polygon,.icon-thin svg circle,.icon-thin svg rect,.icon-thin svg ellipse{stroke-width:1.25px;vector-effect:non-scaling-stroke}'

const STOP = new Set(['','the','a','of','and','2','3','01','02','18','24'])
function tokenize(name: string): string[] {
  const s = name.replace(/^Icon/, '').replace(/(Outline|Fill)(18|24)$/i, '').replace(/Icon$/, '')
  return s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[0-9]+/g, ' ').toLowerCase().split(/\s+/).filter(t => !STOP.has(t))
}
function build(mod: Record<string, unknown>, filter: (k: string) => boolean, make: (C: Cmp) => React.ReactNode, label?: (k: string) => string): Ic[] {
  return Object.keys(mod).filter(filter).map(k => {
    const name = label ? label(k) : k
    return { name, tokens: tokenize(name), el: make(mod[k] as Cmp) }
  }).sort((a, b) => a.name.localeCompare(b.name))
}
const pascal = (k: string) => /^[A-Z]/.test(k)

const GLASS = build(NucGlass, k => pascal(k) && !['Icon', 'IconNames', 'Icons', 'createIcon', 'createReactIconFactory'].includes(k), C => <C size={24} />)
const COLS: { label: string; baseline?: boolean; items: Ic[] }[] = [
  { label: 'Glass (baseline)', baseline: true, items: GLASS },
  { label: 'Phosphor', items: build(Phosphor, k => k.endsWith('Icon') && k !== 'IconContext' && k !== 'IconBase', C => <C size={24} weight="light" />, k => k.replace(/Icon$/, '')) },
  { label: 'Iconoir', items: build(Iconoir, k => pascal(k) && !/(Provider|Context)$/.test(k), C => <C width={24} height={24} />) },
  { label: 'Nucleo UI out', items: build(NucUIOut, k => /^Icon[A-Z]/.test(k), C => <C width={24} height={24} />) },
  { label: 'Nucleo UI fill', items: build(NucUIFill, k => /^Icon[A-Z]/.test(k), C => <C width={24} height={24} />) },
  { label: 'Nucleo Core out', items: build(NucCoreOut, k => /^Icon[A-Z]/.test(k), C => <C width={24} height={24} />) },
  { label: 'Nucleo Core fill', items: build(NucCoreFill, k => /^Icon[A-Z]/.test(k), C => <C width={24} height={24} />) },
]
const CAP = 6
function matches(glassTokens: string[], items: Ic[]): Ic[] {
  const gt = new Set(glassTokens)
  return items.map(i => ({ i, score: i.tokens.reduce((n, t) => n + (gt.has(t) ? 1 : 0), 0) }))
    .filter(x => x.score > 0).sort((a, b) => b.score - a.score || a.i.tokens.length - b.i.tokens.length || a.i.name.localeCompare(b.i.name))
    .slice(0, CAP).map(x => x.i)
}

function Cell({ items }: { items: Ic[] }) {
  if (!items.length) return <span style={{ color: '#bbb' }}>—</span>
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
      {items.map(i => (
        <span key={i.name} title={i.name} style={{ display: 'inline-flex', color: INK }}>{i.el}</span>
      ))}
    </div>
  )
}

const CATS: { label: string; toks: string[] }[] = [
  { label: 'UI / Controls', toks: ['arrow', 'arrows', 'chevron', 'check', 'close', 'cross', 'plus', 'minus', 'menu', 'dots', 'more', 'settings', 'gear', 'toggle', 'switch', 'search', 'magnifier', 'filter', 'sort', 'refresh', 'sync', 'rotate', 'lock', 'unlock', 'eye', 'grid', 'list', 'dial', 'slider', 'crosshairs', 'button', 'tab', 'tabs', 'window', 'progress', 'bell', 'gauge'] },
  { label: 'Media / Editor', toks: ['image', 'photo', 'camera', 'video', 'play', 'pause', 'crop', 'pen', 'pencil', 'edit', 'brush', 'paint', 'color', 'palette', 'layer', 'layers', 'frame', 'magic', 'wand', 'sparkle', 'adjust', 'contrast', 'bright', 'brightness', 'sticker', 'eraser', 'shape', 'shapes', 'ruler', 'feather', 'film', 'depth', 'perspective'] },
  { label: 'Files', toks: ['file', 'files', 'folder', 'folders', 'doc', 'document', 'download', 'upload', 'cloud', 'save', 'archive', 'box', 'copies', 'duplicate', 'clipboard'] },
  { label: 'Comms', toks: ['mail', 'envelope', 'message', 'msg', 'msgs', 'chat', 'notification', 'phone', 'send', 'paperplane', 'inbox', 'headphones'] },
  { label: 'Commerce', toks: ['cart', 'bag', 'shop', 'shopping', 'card', 'cards', 'coin', 'money', 'wallet', 'tag', 'credit', 'bill'] },
]
const catMatch = (g: Ic, cat: string) =>
  cat === 'All' ? true
    : cat === 'Other' ? !CATS.some(c => g.tokens.some(t => c.toks.includes(t)))
      : g.tokens.some(t => (CATS.find(c => c.label === cat)?.toks ?? []).includes(t))

function MatrixByName() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('UI / Controls')
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return GLASS.filter(g => (!s || g.name.toLowerCase().includes(s)) && catMatch(g, cat))
  }, [q, cat])
  const tabs = ['All', ...CATS.map(c => c.label), 'Other']
  return (
    <div className="icon-thin" style={{ fontFamily: 'ui-sans-serif, system-ui', color: '#1a1a1a' }}>
      <style>{ICON_CSS}</style>
      <div style={{ position: 'sticky', top: 0, zIndex: 2, background: '#fff', padding: '12px 16px', borderBottom: '1px solid #eee' }}>
        <strong>Matrix by name</strong> <span style={{ color: '#888', fontSize: 12 }}>— {rows.length}/{GLASS.length} glass rows · {cat} · matched by name, up to {CAP}/cell · all strokes 1.25px</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0 4px' }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setCat(t)}
              style={{ padding: '4px 12px', borderRadius: 999, border: '1px solid #ccc', cursor: 'pointer', fontSize: 12,
                background: cat === t ? '#2C3A4A' : '#fff', color: cat === t ? '#fff' : '#444' }}>{t}</button>
          ))}
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="filter glass names…"
          style={{ display: 'block', marginTop: 6, width: 280, padding: '6px 10px', borderRadius: 8, border: '1px solid #ccc', fontSize: 13 }} />
      </div>
      <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left', background: '#dcdcdc' }}>glass name</th>
            {COLS.map(c => <th key={c.label} style={{ ...th, background: '#dcdcdc', color: '#333' }}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(g => (
            <tr key={g.name} style={{ borderTop: '1px solid #dadada' }}>
              <td style={{ ...td, fontWeight: 600, whiteSpace: 'nowrap', background: LG }}>{g.name}</td>
              {COLS.map(c => (
                <td key={c.label} style={{ ...td, textAlign: 'center', background: LG, minWidth: 96 }}>
                  {c.baseline ? <Cell items={[g]} /> : <Cell items={matches(g.tokens, c.items)} />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
const th: React.CSSProperties = { padding: '8px 10px', fontSize: 11, position: 'sticky', top: 64 }
const td: React.CSSProperties = { padding: '8px 10px', verticalAlign: 'middle' }

const meta: Meta<typeof MatrixByName> = { title: 'Icons/Matrix by Name', component: MatrixByName, parameters: { layout: 'fullscreen' } }
export default meta
export const ByName: StoryObj<typeof MatrixByName> = {}
