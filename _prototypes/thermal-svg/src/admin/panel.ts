// The admin control panel. Every control writes one config path; nothing here renders.

import { DEFAULT_CONFIG, DEFAULT_SOURCES, PALETTES, type ColorStop, type Source } from '../engine'
import { button, el, section, select, slider, textInput, toggle } from './controls'
import { FONTS, familyOf, nearestWeight, weightsOf } from './fonts'
import { copy, downloadConfig, downloadSvg, loadFile } from './io'
import { getConfig, read, setConfig, subscribe, update } from './state'

function filePicker(label: string, accept: string, status: (m: string) => void): HTMLElement {
  const input = el('input')
  input.type = 'file'
  input.accept = accept
  input.hidden = true
  input.addEventListener('change', async () => {
    if (input.files?.[0]) status(await loadFile(input.files[0]))
    input.value = ''
  })
  const b = button(label, () => input.click())
  const wrap = el('div', 'inline')
  wrap.append(b, input)
  return wrap
}

/** Font family (brand fonts by token role) and the weights that family actually has. */
function fontControls(): HTMLElement {
  const wrap = el('div', 'group')
  const family = el('select')
  family.append(...FONTS.map((f) => new Option(f.label, f.css)))
  const weight = el('select')
  const sync = () => {
    const src = getConfig().source
    if (src.kind !== 'text') return
    // A family not in the catalogue (e.g. from an imported config) is shown as-is.
    if (!familyOf(src.fontFamily) && ![...family.options].some((o) => o.value === src.fontFamily)) family.append(new Option(src.fontFamily, src.fontFamily))
    family.value = src.fontFamily
    const ws = weightsOf(src.fontFamily)
    if (weight.options.length !== ws.length || [...weight.options].some((o, i) => Number(o.value) !== ws[i])) weight.replaceChildren(...ws.map((w) => new Option(String(w), String(w))))
    weight.value = String(src.fontWeight)
  }
  family.addEventListener('change', () => {
    const src = getConfig().source
    const w = src.kind === 'text' ? src.fontWeight : 700
    update('source', { ...src, fontFamily: family.value, fontWeight: nearestWeight(family.value, w) })
  })
  weight.addEventListener('change', () => update('source.fontWeight', Number(weight.value)))
  subscribe(sync)
  sync()
  const r1 = el('label', 'row')
  r1.append(el('span', 'lbl', 'Font'), family)
  const r2 = el('label', 'row')
  r2.append(el('span', 'lbl', 'Weight'), weight)
  wrap.append(r1, r2)
  return wrap
}

/** Only the fields of the current source kind are shown. */
function sourceSection(status: (m: string) => void): HTMLElement {
  // Changing the kind replaces the whole source with that kind's defaults.
  const kindSelect = el('select')
  kindSelect.append(new Option('Text', 'text'), new Option('SVG', 'svg'), new Option('Image', 'image'))
  kindSelect.addEventListener('change', () => update('source', { ...DEFAULT_SOURCES[kindSelect.value as Source['kind']] }))
  subscribe((c) => (kindSelect.value = c.source.kind))
  kindSelect.value = getConfig().source.kind
  const kind = el('label', 'row')
  kind.append(el('span', 'lbl', 'Type'), kindSelect)

  const text = el('div', 'group')
  text.append(
    textInput('source.text', 'Text'),
    fontControls(),
    toggle('source.fitWidth', 'Fit width'),
    slider({ path: 'source.fontSize', label: 'Size', min: 8, max: 600, step: 1 }),
    slider({ path: 'source.letterSpacing', label: 'Tracking', min: -40, max: 60, step: 1 }),
  )
  const svg = el('div', 'group')
  svg.append(textInput('source.markup', 'Markup', true), filePicker('Choose SVG…', '.svg,image/svg+xml', status))
  const image = el('div', 'group')
  image.append(
    select('source.mode', 'Use', [['alpha', 'Cut-out shape'], ['luminance', 'Image light & dark']]),
    filePicker('Choose image…', 'image/png,image/jpeg,image/webp', status),
  )
  const groups: Record<Source['kind'], HTMLElement> = { text, svg, image }
  const sync = () => {
    const k = getConfig().source.kind
    for (const [name, g] of Object.entries(groups)) g.hidden = name !== k
  }
  subscribe(sync)
  sync()
  return section('Source', kind, text, svg, image)
}

function paletteSection(): HTMLElement {
  const preset = el('select')
  preset.append(new Option('Custom', ''), ...Object.keys(PALETTES).map((k) => new Option(k[0].toUpperCase() + k.slice(1), k)))
  preset.addEventListener('change', () => preset.value && update('palette.stops', PALETTES[preset.value]))
  const presetRow = el('label', 'row')
  presetRow.append(el('span', 'lbl', 'Preset'), preset)

  const bar = el('div', 'gradient-bar')
  const list = el('div', 'stops')
  const stops = () => read('palette.stops') as ColorStop[]
  const setStops = (s: ColorStop[]) => update('palette.stops', s)

  const drawList = () => {
    const s = stops()
    bar.style.background = `linear-gradient(90deg, ${s.map((x) => `${x.color} ${x.offset * 100}%`).join(', ')})`
    const match = Object.entries(PALETTES).find(([, p]) => JSON.stringify(p) === JSON.stringify(s))
    preset.value = match ? match[0] : ''
    if (list.contains(document.activeElement)) return
    list.replaceChildren(
      ...s.map((stop, i) => {
        const r = el('div', 'stop')
        const color = el('input')
        color.type = 'color'
        color.value = stop.color.length === 4 ? `#${[...stop.color.slice(1)].map((c) => c + c).join('')}` : stop.color
        color.addEventListener('input', () => setStops(stops().map((x, j) => (j === i ? { ...x, color: color.value } : x))))
        const off = el('input')
        off.type = 'range'
        off.min = '0'
        off.max = '1'
        off.step = '0.01'
        off.value = String(stop.offset)
        off.addEventListener('input', () => setStops(stops().map((x, j) => (j === i ? { ...x, offset: Number(off.value) } : x))))
        off.addEventListener('change', () => (document.activeElement as HTMLElement)?.blur())
        const rm = button('×', () => setStops(stops().filter((_, j) => j !== i)), 'icon')
        rm.disabled = s.length <= 2
        r.append(color, off, rm)
        return r
      }),
    )
  }
  subscribe(drawList)
  drawList()
  const add = button('+ Add stop', () => {
    const s = stops()
    const a = s[Math.max(0, s.length - 2)]
    const b = s[s.length - 1]
    setStops([...s, { offset: (a.offset + b.offset) / 2, color: a.color }])
  })
  return section(
    'Palette — heat to colour',
    presetRow,
    bar,
    list,
    add,
    slider({ path: 'palette.steps', label: 'Smoothness', min: 2, max: 256, step: 1 }),
  )
}

function actionsSection(status: (m: string) => void): HTMLElement {
  const wrap = el('div', 'actions')
  wrap.append(
    button('Download SVG', downloadSvg, 'primary'),
    button('Copy SVG', async () => status(await copy('svg'))),
    button('Copy config', async () => status(await copy('config'))),
    button('Download config', downloadConfig),
    button('Reset all', () => setConfig(DEFAULT_CONFIG), 'ghost'),
  )
  return section('Export', wrap, el('p', 'note', 'Drop a config .json anywhere to load it back.'))
}

export function panel(status: (m: string) => void): HTMLElement {
  const root = el('aside', 'panel')
  const play = button('', () => update('stripe.playing', !getConfig().stripe.playing), 'primary wide')
  subscribe((c) => (play.textContent = c.stripe.playing ? 'Pause  ␣' : 'Play  ␣'))
  play.textContent = getConfig().stripe.playing ? 'Pause  ␣' : 'Play  ␣'

  root.append(
    sourceSection(status),
    section(
      'Output',
      slider({ path: 'output.width', label: 'Width', min: 64, max: 2048, step: 1 }),
      slider({ path: 'output.height', label: 'Height', min: 64, max: 2048, step: 1 }),
      slider({ path: 'output.padding', label: 'Padding', min: 0, max: 400, step: 1 }),
      select('output.background', 'Background', [['palette', 'Palette cold end'], ['transparent', 'Transparent']]),
    ),
    section(
      'Material — inflated edge',
      slider({ path: 'material.depth', label: 'Edge depth', min: 0, max: 60, step: 0.5 }),
      slider({ path: 'material.edgeStrength', label: 'Edge strength', min: 0, max: 2, step: 0.01 }),
      slider({ path: 'material.baseLevel', label: 'Core heat', min: 0, max: 1, step: 0.01 }),
    ),
    section(
      'Stripe — moving light band',
      play,
      toggle('stripe.enabled', 'On'),
      slider({ path: 'stripe.contrast', label: 'Contrast', min: 0, max: 1, step: 0.01 }),
      slider({ path: 'stripe.period', label: 'Spacing', min: 20, max: 2000, step: 1 }),
      slider({ path: 'stripe.angle', label: 'Angle', min: -180, max: 180, step: 1, unit: '°' }),
      slider({ path: 'stripe.duration', label: 'Cycle', min: 0.2, max: 20, step: 0.1, unit: 's' }),
    ),
    paletteSection(),
    section(
      'Finish',
      slider({ path: 'finish.blur', label: 'Blur / glow', min: 0, max: 60, step: 0.5 }),
      slider({ path: 'finish.grain', label: 'Grain', min: 0, max: 1, step: 0.01 }),
      slider({ path: 'finish.grainSize', label: 'Grain size', min: 0.1, max: 6, step: 0.05 }),
      slider({ path: 'finish.seed', label: 'Grain seed', min: 0, max: 999, step: 1 }),
    ),
    actionsSection(status),
  )
  return root
}
