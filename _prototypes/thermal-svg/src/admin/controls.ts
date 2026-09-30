// Small DOM control builders bound to config paths. Each control reads its value on every state
// change, so the panel always shows the config actually rendered (after engine clamping).

import { read, subscribe, update } from './state'

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text) e.textContent = text
  return e
}

export { el }

export function section(title: string, ...children: HTMLElement[]): HTMLElement {
  const s = el('section', 'sec')
  s.append(el('h2', '', title), ...children)
  return s
}

function row(label: string, control: HTMLElement, readout?: HTMLElement): HTMLElement {
  const r = el('label', 'row')
  r.append(el('span', 'lbl', label), control)
  if (readout) r.append(readout)
  return r
}

export interface SliderSpec {
  path: string
  label: string
  min: number
  max: number
  step: number
  unit?: string
}

export function slider(s: SliderSpec): HTMLElement {
  const input = el('input')
  input.type = 'range'
  input.min = String(s.min)
  input.max = String(s.max)
  input.step = String(s.step)
  const out = el('output', 'val')
  const sync = () => {
    const v = Number(read(s.path))
    input.value = String(v)
    out.textContent = `${Math.round(v * 100) / 100}${s.unit ?? ''}`
  }
  input.addEventListener('input', () => update(s.path, Number(input.value)))
  subscribe(sync)
  sync()
  return row(s.label, input, out)
}

export function toggle(path: string, label: string): HTMLElement {
  const input = el('input')
  input.type = 'checkbox'
  const sync = () => (input.checked = Boolean(read(path)))
  input.addEventListener('change', () => update(path, input.checked))
  subscribe(sync)
  sync()
  return row(label, input)
}

export function select(path: string, label: string, options: [string, string][], parse: (v: string) => unknown = (v) => v): HTMLElement {
  const input = el('select')
  for (const [value, text] of options) {
    const o = el('option', '', text)
    o.value = value
    input.append(o)
  }
  const sync = () => (input.value = String(read(path)))
  input.addEventListener('change', () => update(path, parse(input.value)))
  subscribe(sync)
  sync()
  return row(label, input)
}

export function textInput(path: string, label: string, multiline = false): HTMLElement {
  const input = multiline ? el('textarea') : el('input')
  if (input instanceof HTMLTextAreaElement) input.rows = 4
  const sync = () => {
    if (document.activeElement !== input) input.value = String(read(path) ?? '')
  }
  input.addEventListener('input', () => update(path, input.value))
  subscribe(sync)
  sync()
  return row(label, input)
}

export function button(label: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = el('button', `btn ${cls}`.trim(), label)
  b.type = 'button'
  b.addEventListener('click', onClick)
  return b
}
