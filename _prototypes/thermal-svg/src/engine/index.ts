// Public API of the thermal SVG engine. The admin shell (and any future API route) imports from here
// only. No DOM, no framework: config in, SVG string out.

export { renderThermal } from './render'
export { normalizeConfig } from './normalize'
export { DEFAULT_CONFIG, DEFAULT_SOURCES, LIMITS, PALETTES } from './defaults'
export { paletteTables, sampleStops } from './palette'
export { sanitizeSvg } from './source'
export type {
  ColorStop,
  ImageSource,
  RenderOptions,
  RenderResult,
  Source,
  SvgSource,
  TextSource,
  ThermalConfig,
  ThermalConfigInput,
} from './types'
