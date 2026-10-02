// The stage: renders the current config with the picked images, and lets you drag the Effect into place.

import { renderEffect, type RenderInput } from '../engine'
import { EFFECTS, MATERIALS, STOCK, load } from './assets'
import { el } from './controls'
import { getConfig, getPicks, subscribe, update } from './state'

/** The full engine input: settings + the picked images as data URLs. */
export async function resolvedInput(): Promise<RenderInput> {
  const c = getConfig(), p = getPicks()
  const find = (list: typeof STOCK, id: string) => list.find((a) => a.id === id)?.url ?? ''
  const [base, effect, tex] = await Promise.all([load(find(STOCK, p.stock)), load(find(EFFECTS, p.effect)), load(find(MATERIALS, p.material))])
  return {
    ...c,
    base: base ?? c.base,
    effect: effect ?? { ...c.effect, href: '' },
    texture: { ...c.texture, ...(tex ?? { href: '' }) },
  }
}

export function preview(): HTMLElement {
  const stage = el('div', 'stage')
  const frame = el('div', 'frame')
  const meta = el('div', 'meta')
  stage.append(frame, meta)

  let seq = 0
  const draw = async () => {
    const mine = ++seq
    const input = await resolvedInput()
    if (mine !== seq) return
    const { svg, config } = renderEffect(input, { id: 'stage' })
    frame.innerHTML = svg
    const s = frame.querySelector('svg')
    if (s) s.style.cssText = 'display:block;width:100%;height:auto'
    frame.style.aspectRatio = `${config.base.width} / ${config.base.height}`
    meta.textContent = config.base.href
      ? `${config.base.width} × ${config.base.height} · drag the Effect to move it`
      : 'Pick a stock photo — generated T-shirts appear here as soon as they are saved'
  }
  let timer = 0
  subscribe(() => {
    clearTimeout(timer)
    timer = window.setTimeout(draw, 30)
  })
  void draw()

  // drag the Effect: screen pixels → photo pixels
  let drag: { x: number; y: number; px: number; py: number } | null = null
  frame.addEventListener('pointerdown', (e) => {
    const c = getConfig().place
    drag = { x: e.clientX, y: e.clientY, px: c.x, py: c.y }
    frame.setPointerCapture(e.pointerId)
  })
  frame.addEventListener('pointermove', (e) => {
    if (!drag) return
    const k = getConfig().base.width / frame.getBoundingClientRect().width
    update('place', { ...getConfig().place, x: Math.round(drag.px + (e.clientX - drag.x) * k), y: Math.round(drag.py + (e.clientY - drag.y) * k) })
  })
  const end = () => (drag = null)
  frame.addEventListener('pointerup', end)
  frame.addEventListener('pointercancel', end)
  // wheel / pinch to resize
  frame.addEventListener('wheel', (e) => {
    e.preventDefault()
    const p = getConfig().place
    update('place.size', Math.max(20, Math.round(p.size * (e.deltaY < 0 ? 1.04 : 0.96))))
  }, { passive: false })
  return stage
}
