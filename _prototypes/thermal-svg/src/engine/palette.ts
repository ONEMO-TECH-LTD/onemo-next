import type { ColorStop } from './types'

type RGB = [number, number, number]

export function hexToRgb(hex: string): RGB {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/** Colour of the gradient at t (0..1), interpolated linearly between the surrounding stops. */
export function sampleStops(stops: ColorStop[], t: number): RGB {
  if (t <= stops[0].offset) return hexToRgb(stops[0].color)
  const last = stops[stops.length - 1]
  if (t >= last.offset) return hexToRgb(last.color)
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1]
    const b = stops[i]
    if (t <= b.offset) {
      const span = b.offset - a.offset || 1
      const k = (t - a.offset) / span
      const ca = hexToRgb(a.color)
      const cb = hexToRgb(b.color)
      return [ca[0] + (cb[0] - ca[0]) * k, ca[1] + (cb[1] - ca[1]) * k, ca[2] + (cb[2] - ca[2]) * k]
    }
  }
  return hexToRgb(last.color)
}

/**
 * The three feComponentTransfer tables (red, green, blue) that turn a grey level into the palette
 * colour. SVG interpolates linearly between table entries, so `steps` entries are enough.
 */
export function paletteTables(stops: ColorStop[], steps: number): { r: string; g: string; b: string } {
  const r: string[] = []
  const g: string[] = []
  const b: string[] = []
  for (let i = 0; i < steps; i++) {
    const [cr, cg, cb] = sampleStops(stops, i / (steps - 1))
    r.push(round(cr))
    g.push(round(cg))
    b.push(round(cb))
  }
  return { r: r.join(' '), g: g.join(' '), b: b.join(' ') }
}

function round(v: number): string {
  return String(Math.round(v * 1000) / 1000)
}
