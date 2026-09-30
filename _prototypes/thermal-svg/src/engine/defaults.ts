import type { ColorStop, Source, ThermalConfig } from './types'

/** Named palettes. The first is the look from the reference video. */
export const PALETTES: Record<string, ColorStop[]> = {
  thermal: [
    { offset: 0, color: '#ffffff' },
    { offset: 0.12, color: '#ff4fd8' },
    { offset: 0.26, color: '#ff5a1f' },
    { offset: 0.42, color: '#ffd23a' },
    { offset: 0.56, color: '#7fe3ff' },
    { offset: 0.72, color: '#1e6bff' },
    { offset: 1, color: '#050a3a' },
  ],
  infrared: [
    { offset: 0, color: '#0b0014' },
    { offset: 0.3, color: '#5a0b8c' },
    { offset: 0.55, color: '#e0245e' },
    { offset: 0.8, color: '#ffb000' },
    { offset: 1, color: '#fffbe6' },
  ],
  chrome: [
    { offset: 0, color: '#f4f4f4' },
    { offset: 0.35, color: '#8a8f99' },
    { offset: 0.55, color: '#ffffff' },
    { offset: 0.75, color: '#3a3d44' },
    { offset: 1, color: '#d9dde3' },
  ],
  mono: [
    { offset: 0, color: '#ffffff' },
    { offset: 1, color: '#111111' },
  ],
}

export const DEFAULT_SOURCES: { [K in Source['kind']]: Extract<Source, { kind: K }> } = {
  text: { kind: 'text', text: 'PRO', fontFamily: 'Arial Black, Helvetica Neue, Arial, sans-serif', fontWeight: 900, fontSize: 120, letterSpacing: -4, fitWidth: true },
  svg: { kind: 'svg', markup: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>' },
  image: { kind: 'image', href: '', mode: 'alpha' },
}

export const DEFAULT_CONFIG: ThermalConfig = {
  source: DEFAULT_SOURCES.text,
  output: { width: 640, height: 360, padding: 48, background: 'palette' },
  material: { depth: 10, edgeStrength: 0.9, baseLevel: 0.9 },
  stripe: { enabled: true, contrast: 0.3, period: 480, angle: 20, duration: 4, playing: true },
  palette: { stops: PALETTES.thermal, steps: 64 },
  finish: { blur: 6, grain: 0.05, grainFrequency: 2.2, seed: 3 },
}

/** Hard limits. Values outside are clamped, never rejected, so a bad API call still renders. */
export const LIMITS = {
  size: [16, 4096],
  padding: [0, 2048],
  depth: [0, 200],
  edgeStrength: [0, 2],
  unit: [0, 1],
  period: [4, 8192],
  angle: [-360, 360],
  duration: [0.1, 120],
  steps: [2, 256],
  blur: [0, 200],
  grainFrequency: [0.01, 20],
  seed: [0, 99999],
  fontSize: [1, 4096],
  fontWeight: [100, 900],
  letterSpacing: [-500, 500],
} as const
