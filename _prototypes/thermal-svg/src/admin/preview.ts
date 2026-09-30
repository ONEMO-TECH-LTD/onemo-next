// The stage: shows the engine's SVG, pauses/plays its animation, and accepts dropped files.

import { renderThermal } from '../engine'
import { el } from './controls'
import { getConfig, subscribe, update } from './state'
import { loadFile } from './io'

export function preview(status: (msg: string) => void): HTMLElement {
  const stage = el('div', 'stage')
  const frame = el('div', 'frame')
  const hint = el('div', 'drop-hint', 'Drop an SVG, image, text or config file')
  const meta = el('div', 'meta')
  stage.append(frame, hint, meta)

  const draw = () => {
    const c = getConfig()
    const { svg } = renderThermal(c, { id: 'stage' })
    frame.innerHTML = svg
    frame.style.aspectRatio = `${c.output.width} / ${c.output.height}`
    meta.textContent = `${c.output.width} × ${c.output.height} · ${(svg.length / 1024).toFixed(1)} KB · ${c.stripe.playing ? 'playing' : 'paused'}`
  }
  subscribe(draw)
  draw()

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
