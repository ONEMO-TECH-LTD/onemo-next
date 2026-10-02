// Control panel. Every control writes one setting; nothing here renders.

import { DEFAULTS, renderEffect } from '../engine'
import { EFFECTS, MATERIALS, STOCK, addUpload, available, type Asset } from './assets'
import { button, el, section, slider } from './controls'
import { resolvedInput } from './preview'
import { getConfig, getPicks, setConfig, setPick, subscribe, type Picks } from './state'

function picker(key: keyof Picks, label: string, list: () => Asset[], upload?: 'stock' | 'effect', status?: (m: string) => void): HTMLElement {
  const sel = el('select')
  const fill = async () => {
    const items = await available(list())
    sel.replaceChildren(...items.map((a) => new Option(a.label, a.id)))
    if (!items.some((a) => a.id === getPicks()[key]) && items[0]) setPick(key, items[0].id)
    sel.value = getPicks()[key]
  }
  sel.addEventListener('change', () => setPick(key, sel.value))
  void fill()
  setInterval(fill, 8000)                    // generated stock shows up as soon as it lands on disk
  const r = el('label', 'row')
  r.append(el('span', 'lbl', label), sel)
  if (!upload) return r
  const input = el('input'); input.type = 'file'; input.accept = 'image/png,image/jpeg,image/webp'; input.hidden = true
  input.addEventListener('change', async () => {
    const f = input.files?.[0]
    if (!f) return
    const a = await addUpload(upload, f); await fill(); setPick(key, a.id); status?.(`Loaded ${f.name}`)
    input.value = ''
  })
  const wrap = el('div', 'group')
  wrap.append(r, button(upload === 'stock' ? 'Upload a photo…' : 'Upload an Effect (cut-out PNG)…', () => input.click()), input)
  return wrap
}

async function exportPng(status: (m: string) => void): Promise<void> {
  const { svg, config } = renderEffect(await resolvedInput(), { id: 'export' })
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  const img = new Image(); img.src = url; await img.decode()
  const cv = document.createElement('canvas'); cv.width = config.base.width; cv.height = config.base.height
  cv.getContext('2d')!.drawImage(img, 0, 0)
  URL.revokeObjectURL(url)
  cv.toBlob((b) => {
    if (!b) return status('Export failed')
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'effect-render.png'; a.click()
    status('PNG exported')
  }, 'image/png')
}

function copyConfig(status: (m: string) => void): void {
  const c = getConfig()
  const clean = { ...c, base: { ...c.base, href: '' }, effect: { ...c.effect, href: '' }, texture: { ...c.texture, href: '' } }
  navigator.clipboard.writeText(JSON.stringify({ picks: getPicks(), config: clean }, null, 2)).then(() => status('Settings copied'), () => status('Clipboard blocked'))
}

export function panel(status: (m: string) => void): HTMLElement {
  const root = el('aside', 'panel')
  // centre the Effect on a new photo at a sensible default size
  let lastStock = getPicks().stock
  subscribe(() => {
    const p = getPicks()
    if (p.stock !== lastStock) {
      lastStock = p.stock
      setTimeout(() => {
        const c = getConfig()
        setConfig({ ...c, place: { ...c.place, x: c.base.width / 2, y: c.base.height * 0.4, size: Math.round(c.base.width * 0.25) } })
      }, 300)
    }
  })
  root.append(
    section('Images',
      picker('stock', 'Photo', () => STOCK, 'stock', status),
      picker('effect', 'Effect', () => EFFECTS, 'effect', status),
      picker('material', 'Material', () => MATERIALS),
    ),
    section('Placement — or drag on the photo',
      slider({ path: 'place.size', label: 'Size', min: 40, max: 1400, step: 1, unit: 'px' }),
      slider({ path: 'place.rotation', label: 'Rotation', min: -45, max: 45, step: 0.5, unit: '°' }),
      slider({ path: 'place.tiltX', label: 'Tilt ↔', min: -25, max: 25, step: 0.5, unit: '°' }),
      slider({ path: 'place.tiltY', label: 'Tilt ↕', min: -25, max: 25, step: 0.5, unit: '°' }),
    ),
    section('Light',
      slider({ path: 'light.angle', label: 'Direction', min: 0, max: 360, step: 1, unit: '°' }),
      slider({ path: 'light.elevation', label: 'Height', min: 10, max: 85, step: 1, unit: '°' }),
    ),
    section('Shadows',
      slider({ path: 'shadow.distance', label: 'Distance', min: 0, max: 120, step: 1 }),
      slider({ path: 'shadow.blur', label: 'Softness', min: 0, max: 80, step: 0.5 }),
      slider({ path: 'shadow.opacity', label: 'Strength', min: 0, max: 1, step: 0.01 }),
      slider({ path: 'contact.blur', label: 'Contact soft', min: 0, max: 20, step: 0.5 }),
      slider({ path: 'contact.opacity', label: 'Contact', min: 0, max: 1, step: 0.01 }),
    ),
    section('Thickness — fake 3D',
      slider({ path: 'thickness.depth', label: 'Depth', min: 0, max: 60, step: 0.5 }),
      slider({ path: 'thickness.shade', label: 'Side shade', min: 0, max: 1, step: 0.01 }),
      slider({ path: 'bevel.size', label: 'Edge round', min: 0, max: 40, step: 0.5 }),
      slider({ path: 'bevel.strength', label: 'Edge light', min: 0, max: 15, step: 0.1 }),
      slider({ path: 'bevel.shine', label: 'Shine', min: 0, max: 1, step: 0.01 }),
      slider({ path: 'bevel.gloss', label: 'Gloss', min: 1, max: 100, step: 1 }),
    ),
    section('Material texture',
      slider({ path: 'texture.strength', label: 'Strength', min: 0, max: 8, step: 0.1 }),
      slider({ path: 'texture.scale', label: 'Grain size', min: 0.1, max: 3, step: 0.05 }),
    ),
    section('Match the photo',
      slider({ path: 'tone.brightness', label: 'Brightness', min: -0.5, max: 0.5, step: 0.01 }),
      slider({ path: 'tone.contrast', label: 'Contrast', min: -0.5, max: 0.5, step: 0.01 }),
      slider({ path: 'tone.saturation', label: 'Saturation', min: -1, max: 1, step: 0.01 }),
      slider({ path: 'tone.warmth', label: 'Warmth', min: -1, max: 1, step: 0.01 }),
    ),
    section('Export',
      (() => {
        const w = el('div', 'actions')
        w.append(
          button('Download PNG', () => void exportPng(status), 'primary'),
          button('Copy settings', () => copyConfig(status)),
          button('Reset look', () => {
            const c = getConfig()
            setConfig({ ...DEFAULTS, base: c.base, effect: c.effect, place: c.place, texture: { ...DEFAULTS.texture, ...c.texture, strength: DEFAULTS.texture.strength, scale: DEFAULTS.texture.scale } })
          }, 'ghost'),
        )
        return w
      })(),
    ),
  )
  return root
}
