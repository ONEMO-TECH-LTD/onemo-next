// The stage: a live GPU view of the current config, play/pause, and file drop.

import { createThermalView } from '../runtime/view'
import { el } from './controls'
import { fontCss } from './fonts'
import { loadFile } from './io'
import { getConfig, subscribe, update } from './state'

export function preview(status: (msg: string) => void): HTMLElement {
  const stage = el('div', 'stage')
  const frame = el('div', 'frame')
  const hint = el('div', 'drop-hint', 'Drop an SVG, image, text or config file')
  const meta = el('div', 'meta')
  stage.append(frame, hint, meta)

  const view = createThermalView(frame)
  let fontReq = 0
  const draw = async () => {
    const c = getConfig()
    frame.style.aspectRatio = `${c.output.width} / ${c.output.height}`
    const mine = ++fontReq
    const css = c.source.kind === 'text' ? await fontCss(c.source.fontFamily, c.source.fontWeight) : ''
    if (mine === fontReq) view.update(getConfig(), css)
  }
  subscribe(() => void draw())
  void draw()

  const showMeta = () => {
    const c = getConfig()
    const state = c.stripe.playing && c.stripe.enabled ? `${view.fps} fps` : 'paused'
    meta.textContent = `${c.output.width} × ${c.output.height} · ${view.gpu ? 'GPU' : 'SVG'} · ${state}`
  }
  setInterval(showMeta, 500)
  showMeta()

  // Space toggles play/pause, unless typing in a field.
  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement
    if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT/.test(t.tagName)) {
      e.preventDefault()
      update('stripe.playing', !getConfig().stripe.playing)
    }
  })

  const over = (on: boolean) => stage.classList.toggle('dragging', on)
  window.addEventListener('dragover', (e) => {
    e.preventDefault()
    over(true)
  })
  window.addEventListener('dragleave', (e) => {
    if (!e.relatedTarget) over(false)
  })
  window.addEventListener('drop', async (e) => {
    e.preventDefault()
    over(false)
    const dt = e.dataTransfer
    if (!dt) return
    const file = dt.files[0]
    if (file) return status(await loadFile(file))
    const text = dt.getData('text/plain').trim()
    if (text.startsWith('<svg') || text.startsWith('<?xml')) {
      update('source', { kind: 'svg', markup: text })
      status('SVG markup dropped')
    } else if (text) {
      update('source', { ...getConfig().source, kind: 'text', text })
      status('Text dropped')
    }
  })
  window.addEventListener('paste', (e) => {
    const t = e.target as HTMLElement
    if (/INPUT|TEXTAREA/.test(t.tagName)) return
    const text = e.clipboardData?.getData('text/plain').trim()
    if (text?.startsWith('<svg')) {
      update('source', { kind: 'svg', markup: text })
      status('SVG markup pasted')
    }
  })
  return stage
}
