/**
 * Icon Catalogs — every free icon by its REAL vendor export name, sorted A–Z, with a name filter.
 * No concept-mapping, no curation: the raw full sets so you match names yourself.
 * Vendors: Phosphor (regular weight; 6 weights exist via prop), Iconoir, and all 5 free Nucleo styles.
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

type Item = { name: string; tokens: string[]; node: React.ReactNode }
const STOP = new Set(['', '2', '3', '01', '18', '24'])
const tokenize = (name: string): string[] =>
  name.replace(/^Icon/, '').replace(/(Outline|Fill)(18|24)$/i, '').replace(/Icon$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[0-9]+/g, ' ').toLowerCase().split(/\s+/).filter(t => !STOP.has(t))
const ICON_CSS = '.icon-thin svg path,.icon-thin svg line,.icon-thin svg polyline,.icon-thin svg polygon,.icon-thin svg circle,.icon-thin svg rect,.icon-thin svg ellipse{stroke-width:1.25px;vector-effect:non-scaling-stroke}'
const CATS: { label: string; toks: string[] }[] = [
  { label: 'UI / Controls', toks: ['arrow', 'arrows', 'chevron', 'check', 'close', 'cross', 'plus', 'minus', 'menu', 'dots', 'more', 'settings', 'gear', 'cog', 'toggle', 'switch', 'search', 'magnifier', 'filter', 'sort', 'refresh', 'sync', 'rotate', 'reload', 'lock', 'unlock', 'eye', 'grid', 'list', 'dial', 'slider', 'sliders', 'crosshairs', 'button', 'tab', 'tabs', 'window', 'progress', 'bell', 'gauge', 'adjustments'] },
  { label: 'Media / Editor', toks: ['image', 'images', 'photo', 'camera', 'video', 'play', 'pause', 'crop', 'pen', 'pencil', 'edit', 'brush', 'paint', 'color', 'colour', 'palette', 'layer', 'layers', 'frame', 'magic', 'wand', 'sparkle', 'sparkles', 'adjust', 'contrast', 'bright', 'brightness', 'sticker', 'eraser', 'shape', 'shapes', 'ruler', 'feather', 'film', 'depth', 'perspective', 'vector', 'bezier', 'curve', 'droplet', 'sun'] },
  { label: 'Files', toks: ['file', 'files', 'folder', 'folders', 'doc', 'document', 'download', 'upload', 'cloud', 'save', 'archive', 'box', 'copy', 'copies', 'duplicate', 'clipboard', 'paste'] },
  { label: 'Comms', toks: ['mail', 'envelope', 'message', 'msg', 'msgs', 'chat', 'comment', 'notification', 'phone', 'send', 'paperplane', 'plane', 'inbox', 'headphones', 'share'] },
  { label: 'Commerce', toks: ['cart', 'bag', 'shop', 'shopping', 'card', 'cards', 'coin', 'money', 'wallet', 'tag', 'credit', 'bill', 'basket'] },
]
const catMatch = (toks: string[], cat: string) =>
  cat === 'All' ? true
    : cat === 'Other' ? !CATS.some(c => toks.some(t => c.toks.includes(t)))
      : toks.some(t => (CATS.find(c => c.label === cat)?.toks ?? []).includes(t))

function collect(mod: Record<string, unknown>, opts: {
  filter: (k: string) => boolean
  label?: (k: string) => string
  make: (C: React.ComponentType<Record<string, unknown>>) => React.ReactNode
}): Item[] {
  return Object.keys(mod)
    .filter(opts.filter)
    .map(k => { const name = opts.label ? opts.label(k) : k; return { name, tokens: tokenize(name), node: opts.make(mod[k] as React.ComponentType<Record<string, unknown>>) } })
    .sort((a, b) => a.name.localeCompare(b.name))
}

const isPascal = (k: string) => /^[A-Z]/.test(k)

const SETS: { title: string; items: Item[] }[] = [
  { title: 'Phosphor (light)', items: collect(Phosphor, {
      filter: k => k.endsWith('Icon') && k !== 'IconContext' && k !== 'IconBase',
      label: k => k.replace(/Icon$/, ''),
      make: C => <C size={24} weight="light" /> }) },
  { title: 'Iconoir', items: collect(Iconoir, {
      filter: k => isPascal(k) && !/(Provider|Context)$/.test(k),
      make: C => <C width={24} height={24} /> }) },
  { title: 'Nucleo Glass', items: collect(NucGlass, {
      filter: k => isPascal(k) && !['Icon', 'IconNames', 'Icons', 'createIcon', 'createReactIconFactory'].includes(k),
      make: C => <C size={24} /> }) },
  { title: 'Nucleo UI Outline', items: collect(NucUIOut, { filter: k => /^Icon[A-Z]/.test(k), make: C => <C width={24} height={24} /> }) },
  { title: 'Nucleo UI Fill', items: collect(NucUIFill, { filter: k => /^Icon[A-Z]/.test(k), make: C => <C width={24} height={24} /> }) },
  { title: 'Nucleo Core Outline', items: collect(NucCoreOut, { filter: k => /^Icon[A-Z]/.test(k), make: C => <C width={24} height={24} /> }) },
  { title: 'Nucleo Core Fill', items: collect(NucCoreFill, { filter: k => /^Icon[A-Z]/.test(k), make: C => <C width={24} height={24} /> }) },
]

function Gallery({ title, items }: { title: string; items: Item[] }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('UI / Controls')
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return items.filter(i => (!s || i.name.toLowerCase().includes(s)) && catMatch(i.tokens, cat))
  }, [q, cat, items])
  const fg = '#2C3A4A', sub = '#888'
  const tabs = ['All', ...CATS.map(c => c.label), 'Other']
  return (
    <div className="icon-thin" style={{ background: '#E8E8E8', color: fg, minHeight: '100vh', fontFamily: 'ui-sans-serif, system-ui' }}>
      <style>{ICON_CSS}</style>
      <div style={{ position: 'sticky', top: 0, zIndex: 1, background: '#E8E8E8', padding: '12px 16px', borderBottom: '1px solid #d2d2d2' }}>
        <strong>{title}</strong> <span style={{ color: sub, fontSize: 12 }}>— {shown.length}/{items.length} · {cat} · strokes 1.25px</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0 4px' }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setCat(t)} style={{ padding: '4px 12px', borderRadius: 999, border: '1px solid #ccc', cursor: 'pointer', fontSize: 12, background: cat === t ? '#2C3A4A' : '#fff', color: cat === t ? '#fff' : '#444' }}>{t}</button>
          ))}
        </div>
        <input
          value={q} onChange={e => setQ(e.target.value)} placeholder="filter by name…"
          style={{ display: 'block', marginTop: 6, width: 280, padding: '6px 10px', borderRadius: 8, border: '1px solid #ccc', background: '#fff', color: fg, fontSize: 13 }}
        />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, padding: 12 }}>
        {shown.map(i => (
          <div key={i.name} title={i.name}
            style={{ width: 88, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '10px 4px', color: fg }}>
            <span style={{ height: 24, display: 'flex', alignItems: 'center' }}>{i.node}</span>
            <span style={{ fontSize: 8, color: sub, textAlign: 'center', wordBreak: 'break-word', lineHeight: 1.2 }}>{i.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const meta: Meta<typeof Gallery> = { title: 'Icons/Catalogs', component: Gallery, parameters: { layout: 'fullscreen' } }
export default meta
type S = StoryObj<typeof Gallery>

export const Phosphor_Light: S = { name: 'Phosphor (light)', render: () => <Gallery {...SETS[0]} /> }
export const Iconoir_All: S = { name: 'Iconoir', render: () => <Gallery {...SETS[1]} /> }
export const Nucleo_Glass: S = { name: 'Nucleo Glass', render: () => <Gallery {...SETS[2]} /> }
export const Nucleo_UI_Outline: S = { name: 'Nucleo UI Outline', render: () => <Gallery {...SETS[3]} /> }
export const Nucleo_UI_Fill: S = { name: 'Nucleo UI Fill', render: () => <Gallery {...SETS[4]} /> }
export const Nucleo_Core_Outline: S = { name: 'Nucleo Core Outline', render: () => <Gallery {...SETS[5]} /> }
export const Nucleo_Core_Fill: S = { name: 'Nucleo Core Fill', render: () => <Gallery {...SETS[6]} /> }
