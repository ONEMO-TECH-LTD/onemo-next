import { describe, expect, it } from 'vitest'
import { DEFAULTS, normalize, renderEffect } from '../index'

const base = { href: 'data:image/png;base64,AA', width: 2000, height: 1600 }
const effect = { href: 'data:image/png;base64,BB', width: 1000, height: 500 }

describe('normalize', () => {
  it('a bare request gets the defaults, centred on the photo', () => {
    const c = normalize({ base })
    expect(c.place.x).toBe(1000)
    expect(c.shadow).toEqual(DEFAULTS.shadow)
  })
  it('clamps impossible values instead of failing', () => {
    const c = normalize({ shadow: { opacity: 5 }, light: { elevation: 0 }, thickness: { depth: -3 } })
    expect(c.shadow.opacity).toBe(1)
    expect(c.light.elevation).toBe(5)
    expect(c.thickness.depth).toBe(0)
  })
})

describe('renderEffect', () => {
  it('outputs the photo at its own size with the Effect layered on top', () => {
    const { svg } = renderEffect({ base, effect })
    expect(svg).toContain('viewBox="0 0 2000 1600"')
    expect(svg.indexOf('base64,AA')).toBeLessThan(svg.indexOf('base64,BB'))
  })
  it('keeps the Effect’s own proportions at the chosen size', () => {
    const { svg } = renderEffect({ base, effect, place: { size: 400 } })
    expect(svg).toContain('width="400" height="200"')
  })
  it('casts the shadow away from the light (light from top-left → shadow down-right)', () => {
    const { svg } = renderEffect({ base, effect, light: { angle: 225 }, place: { rotation: 0 }, shadow: { distance: 10 } })
    const m = svg.match(/id="er-shadow"[^>]*>.*?<feOffset dx="([-\d.]+)" dy="([-\d.]+)"/)
    expect(Number(m?.[1])).toBeGreaterThan(0)
    expect(Number(m?.[2])).toBeGreaterThan(0)
  })
  it('a flat sticker has no side wall, and no material means no texture lookup', () => {
    const { svg } = renderEffect({ base, effect, thickness: { depth: 0 }, texture: { href: '' } })
    expect(svg).not.toContain('-side')
    expect(svg).not.toContain('feImage')
  })
  it('the same settings always give the same render', () => {
    expect(renderEffect({ base, effect }).svg).toBe(renderEffect({ base, effect }).svg)
  })
})
