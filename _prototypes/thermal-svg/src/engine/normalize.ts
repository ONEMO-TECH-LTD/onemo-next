import { DEFAULT_CONFIG, DEFAULT_SOURCES, LIMITS } from './defaults'
import type { ColorStop, Source, ThermalConfig, ThermalConfigInput } from './types'

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

function clamp(v: unknown, [lo, hi]: readonly [number, number], fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback
  return Math.min(hi, Math.max(lo, n))
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback
}

function normalizeStops(stops: unknown, fallback: ColorStop[]): ColorStop[] {
  if (!Array.isArray(stops)) return fallback
  const clean = stops
    .filter((s): s is ColorStop => !!s && typeof s.color === 'string' && HEX.test(s.color) && typeof s.offset === 'number' && Number.isFinite(s.offset))
    .map((s) => ({ offset: Math.min(1, Math.max(0, s.offset)), color: s.color.toLowerCase() }))
    .sort((a, b) => a.offset - b.offset)
  return clean.length >= 2 ? clean : fallback
}

function normalizeSource(input: ThermalConfigInput['source']): Source {
  const kind = input?.kind ?? DEFAULT_CONFIG.source.kind
  const i = (input ?? {}) as Record<string, unknown>
  switch (kind) {
    case 'text': {
      const d = DEFAULT_SOURCES.text
      return {
        kind,
        text: str(i.text, d.text),
        fontFamily: str(i.fontFamily, d.fontFamily),
        fontWeight: clamp(i.fontWeight, LIMITS.fontWeight, d.fontWeight),
        fontSize: clamp(i.fontSize, LIMITS.fontSize, d.fontSize),
        letterSpacing: clamp(i.letterSpacing, LIMITS.letterSpacing, d.letterSpacing),
        fitWidth: bool(i.fitWidth, d.fitWidth),
      }
    }
    case 'svg':
      return { kind, markup: str(i.markup, DEFAULT_SOURCES.svg.markup) }
    case 'image':
      return { kind, href: str(i.href, ''), mode: i.mode === 'luminance' ? 'luminance' : 'alpha' }
    default:
      return DEFAULT_CONFIG.source
  }
}

/** Fill every missing value from the defaults and clamp every number into its limits. */
export function normalizeConfig(input: ThermalConfigInput = {}): ThermalConfig {
  const d = DEFAULT_CONFIG
  const o = input.output ?? {}
  const m = input.material ?? {}
  const s = input.stripe ?? {}
  const p = input.palette ?? {}
  const f = input.finish ?? {}
  return {
    source: normalizeSource(input.source),
    output: {
      width: clamp(o.width, LIMITS.size, d.output.width),
      height: clamp(o.height, LIMITS.size, d.output.height),
      padding: clamp(o.padding, LIMITS.padding, d.output.padding),
      background: o.background === 'transparent' || o.background === 'color' ? o.background : 'palette',
      backgroundColor: typeof o.backgroundColor === 'string' && HEX.test(o.backgroundColor) ? o.backgroundColor.toLowerCase() : d.output.backgroundColor,
      offsetX: clamp(o.offsetX, LIMITS.offset, d.output.offsetX),
      offsetY: clamp(o.offsetY, LIMITS.offset, d.output.offsetY),
    },
    material: {
      depth: clamp(m.depth, LIMITS.depth, d.material.depth),
      edgeStrength: clamp(m.edgeStrength, LIMITS.edgeStrength, d.material.edgeStrength),
      baseLevel: clamp(m.baseLevel, LIMITS.unit, d.material.baseLevel),
    },
    stripe: {
      enabled: bool(s.enabled, d.stripe.enabled),
      contrast: clamp(s.contrast, LIMITS.unit, d.stripe.contrast),
      period: clamp(s.period, LIMITS.period, d.stripe.period),
      angle: clamp(s.angle, LIMITS.angle, d.stripe.angle),
      duration: clamp(s.duration, LIMITS.duration, d.stripe.duration),
      playing: bool(s.playing, d.stripe.playing),
    },
    palette: {
      stops: normalizeStops(p.stops, d.palette.stops),
      steps: Math.round(clamp(p.steps, LIMITS.steps, d.palette.steps)),
    },
    finish: {
      blur: clamp(f.blur, LIMITS.blur, d.finish.blur),
      grain: clamp(f.grain, LIMITS.unit, d.finish.grain),
      // Older configs stored a noise frequency; a speck's size is its inverse.
      grainSize: clamp(f.grainSize ?? (typeof (f as { grainFrequency?: unknown }).grainFrequency === 'number' ? 1 / (f as { grainFrequency: number }).grainFrequency : undefined), LIMITS.grainSize, d.finish.grainSize),
      seed: Math.round(clamp(f.seed, LIMITS.seed, d.finish.seed)),
    },
  }
}
