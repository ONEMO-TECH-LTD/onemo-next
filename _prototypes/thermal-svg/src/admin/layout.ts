// Auto layout, measured on the real rendered outline:
//   Fit    — text font size so the letters fill the frame (inside the padding), never stretched
//   Centre — output offsets so the visible outline sits exactly in the middle
// Admin preferences, not config — but the values they write (font size, offsets) are config, so
// exports come out identical to the preview.

import { normalizeConfig, type ThermalConfig } from '../engine'
import { centreOffset, inkBounds } from '../runtime/measure'
import { fontCss } from './fonts'
import { getConfig, subscribe, update } from './state'

type Pref = 'fit' | 'centre'
const listeners = new Set<() => void>()

export function isOn(p: Pref): boolean {
  try {
    return localStorage.getItem(`thermal-svg:auto-${p}`) !== 'off'
  } catch {
    return true
  }
}

export function setOn(p: Pref, on: boolean): void {
  try {
    localStorage.setItem(`thermal-svg:auto-${p}`, on ? 'on' : 'off')
  } catch {
    /* preference only */
  }
  lastKey = ''
  listeners.forEach((l) => l())
  void run()
}

export function onPrefChange(l: () => void): void {
  listeners.add(l)
}

let lastKey = ''
let seq = 0

async function run(): Promise<void> {
  const fit = isOn('fit')
  const centre = isOn('centre')
  if (!fit && !centre) return
  const c = getConfig()
  const src = c.source
  const { offsetX: _x, offsetY: _y, background: _b, backgroundColor: _bc, ...frame } = c.output
  const measuredSource = src.kind === 'text' && fit ? { ...src, fontSize: 0, fitWidth: false } : src
  const key = JSON.stringify([measuredSource, frame, fit, centre])
  if (key === lastKey) return
  lastKey = key
  const mine = ++seq
  const css = src.kind === 'text' ? await fontCss(src.fontFamily, src.fontWeight) : ''
  const at = (patch: Partial<ThermalConfig['source']>): ThermalConfig =>
    normalizeConfig({ ...c, source: { ...src, ...patch } as ThermalConfig['source'], output: { ...c.output, offsetX: 0, offsetY: 0 } })

  let next = c
  if (fit && src.kind === 'text') {
    // Ink scales linearly with font size: measure at 100 and scale to the frame.
    const b = await inkBounds(at({ fitWidth: false, fontSize: 100 }), css).catch(() => null)
    if (mine !== seq || !b) return
    const pad = Math.min(c.output.padding, c.output.width / 2 - 1, c.output.height / 2 - 1)
    const boxW = c.output.width - 2 * pad
    const boxH = c.output.height - 2 * pad
    const k = Math.min(boxW / (b.x1 - b.x0), boxH / (b.y1 - b.y0))
    let size = 100 * k
    // Letter spacing doesn't scale with the font, so check at the new size and correct once.
    const b2 = await inkBounds(at({ fitWidth: false, fontSize: size }), css).catch(() => null)
    if (mine !== seq) return
    if (b2) size *= Math.min(boxW / (b2.x1 - b2.x0), boxH / (b2.y1 - b2.y0))
    next = at({ fitWidth: false, fontSize: Math.round(size * 10) / 10 })
  }
  let offset = { x: c.output.offsetX, y: c.output.offsetY }
  if (centre) {
    const b = await inkBounds(next.source === c.source ? at({}) : next, css).catch(() => null)
    if (mine !== seq || !b) return
    offset = centreOffset(next, b)
  }
  const now = getConfig()
  const same =
    JSON.stringify(now.source) === JSON.stringify(next.source) &&
    Math.abs(now.output.offsetX - offset.x) < 0.05 &&
    Math.abs(now.output.offsetY - offset.y) < 0.05
  if (!same) update('', { ...now, source: next.source, output: { ...now.output, offsetX: offset.x, offsetY: offset.y } })
}

export function startAutoLayout(): void {
  subscribe(() => void run())
  void run()
}
