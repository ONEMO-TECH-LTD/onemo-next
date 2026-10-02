// One render = a garment photo with the user's Effect layered on it, made to read as a real object:
// shadow, contact shadow, thickness, bevel light and a material texture. Everything the engine draws
// is a pure function of this JSON config.

export interface ImageRef {
  /** URL or data: URL. Images must be embedded (data:) to rasterise the SVG outside a page. */
  href: string
  width: number
  height: number
}

export interface RenderConfig {
  /** The garment photo (stock or uploaded). Defines the output size. */
  base: ImageRef
  /** The Effect, already cut out (transparent background). */
  effect: ImageRef
  place: {
    /** Centre of the Effect, in base-photo pixels. */
    x: number
    y: number
    /** Width of the Effect on the photo, in pixels. */
    size: number
    /** Degrees, clockwise. */
    rotation: number
    /** Fake-perspective tilt, degrees (skew). */
    tiltX: number
    tiltY: number
  }
  light: {
    /** Where the light comes from, degrees clockwise from the right (225 = top-left). */
    angle: number
    /** Height of the light above the surface, degrees. Lower = longer, harder shading. */
    elevation: number
  }
  shadow: { distance: number; blur: number; opacity: number }
  contact: { blur: number; opacity: number }
  thickness: {
    /** Visible side wall, in pixels. 0 = flat sticker. */
    depth: number
    /** How much darker the side is than the face. 0..1 */
    shade: number
  }
  bevel: {
    /** Width of the rounded edge, in pixels. */
    size: number
    /** How strongly the edge catches light. */
    strength: number
    /** Highlight sharpness — higher is glossier. */
    gloss: number
    /** Highlight brightness. 0..1 */
    shine: number
  }
  texture: {
    /** Height map of the material (suede, velour, fabric…). Empty = none. */
    href: string
    width: number
    height: number
    /** Texture tile size relative to the Effect width. */
    scale: number
    /** Bump strength. 0 = off. */
    strength: number
  }
  tone: {
    /** Match the Effect to the photo's exposure and colour. */
    brightness: number
    contrast: number
    saturation: number
    warmth: number
  }
}

type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T
export type RenderInput = DeepPartial<RenderConfig>

export interface RenderOptions {
  id?: string
}
