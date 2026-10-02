import type { ImageRef, RenderConfig, RenderInput } from './types'

export const DEFAULTS: RenderConfig = {
  base: { href: '', width: 2048, height: 2048 },
  effect: { href: '', width: 1024, height: 1024 },
  place: { x: 1024, y: 820, size: 520, rotation: -4, tiltX: 0, tiltY: 0 },
  light: { angle: 225, elevation: 48 },
  shadow: { distance: 18, blur: 16, opacity: 0.45 },
  contact: { blur: 3, opacity: 0.6 },
  thickness: { depth: 9, shade: 0.55 },
  bevel: { size: 7, strength: 4, gloss: 22, shine: 0.45 },
  texture: { href: '', width: 1024, height: 1024, scale: 0.6, strength: 1.2 },
  tone: { brightness: 0, contrast: 0, saturation: 0, warmth: 0 },
}

const LIMITS: Record<string, [number, number]> = {
  size: [8, 8192], rotation: [-360, 360], tilt: [-45, 45], angle: [-360, 720], elevation: [5, 89],
  distance: [0, 400], blur: [0, 200], unit: [0, 1], depth: [0, 120], bevelSize: [0, 120], strength: [0, 20],
  gloss: [1, 128], scale: [0.05, 8], tone: [-1, 1], dim: [1, 16384], coord: [-16384, 16384],
}

function num(v: unknown, lim: [number, number], d: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : d
  return Math.min(lim[1], Math.max(lim[0], n))
}

function image(v: Partial<ImageRef> | undefined, d: ImageRef): ImageRef {
  return {
    href: typeof v?.href === 'string' ? v.href : d.href,
    width: num(v?.width, LIMITS.dim, d.width),
    height: num(v?.height, LIMITS.dim, d.height),
  }
}

/** Fill missing values from the defaults and clamp every number — a bad request degrades, never breaks. */
export function normalize(i: RenderInput = {}): RenderConfig {
  const d = DEFAULTS
  const p = i.place ?? {}, l = i.light ?? {}, s = i.shadow ?? {}, c = i.contact ?? {}
  const t = i.thickness ?? {}, b = i.bevel ?? {}, x = i.texture ?? {}, o = i.tone ?? {}
  const base = image(i.base, d.base)
  return {
    base,
    effect: image(i.effect, d.effect),
    place: {
      x: num(p.x, LIMITS.coord, base.width / 2), y: num(p.y, LIMITS.coord, base.height * 0.4),
      size: num(p.size, LIMITS.size, d.place.size), rotation: num(p.rotation, LIMITS.rotation, d.place.rotation),
      tiltX: num(p.tiltX, LIMITS.tilt, d.place.tiltX), tiltY: num(p.tiltY, LIMITS.tilt, d.place.tiltY),
    },
    light: { angle: num(l.angle, LIMITS.angle, d.light.angle), elevation: num(l.elevation, LIMITS.elevation, d.light.elevation) },
    shadow: { distance: num(s.distance, LIMITS.distance, d.shadow.distance), blur: num(s.blur, LIMITS.blur, d.shadow.blur), opacity: num(s.opacity, LIMITS.unit, d.shadow.opacity) },
    contact: { blur: num(c.blur, LIMITS.blur, d.contact.blur), opacity: num(c.opacity, LIMITS.unit, d.contact.opacity) },
    thickness: { depth: num(t.depth, LIMITS.depth, d.thickness.depth), shade: num(t.shade, LIMITS.unit, d.thickness.shade) },
    bevel: {
      size: num(b.size, LIMITS.bevelSize, d.bevel.size), strength: num(b.strength, LIMITS.strength, d.bevel.strength),
      gloss: num(b.gloss, LIMITS.gloss, d.bevel.gloss), shine: num(b.shine, LIMITS.unit, d.bevel.shine),
    },
    texture: { ...image(x, d.texture), scale: num(x.scale, LIMITS.scale, d.texture.scale), strength: num(x.strength, LIMITS.strength, d.texture.strength) },
    tone: {
      brightness: num(o.brightness, LIMITS.tone, 0), contrast: num(o.contrast, LIMITS.tone, 0),
      saturation: num(o.saturation, LIMITS.tone, 0), warmth: num(o.warmth, LIMITS.tone, 0),
    },
  }
}
