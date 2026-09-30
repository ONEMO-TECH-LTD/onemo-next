// The whole effect is described by one JSON-serialisable config. Everything the engine renders is a
// pure function of it, so the same config gives the same SVG in the browser, a worker or a server.

export interface ColorStop {
  /** 0 = the cold end (outside the shape), 1 = the hottest point inside. */
  offset: number
  /** Any 3- or 6-digit hex colour, e.g. "#0a1a6b". */
  color: string
}

export interface TextSource {
  kind: 'text'
  text: string
  fontFamily: string
  fontWeight: number
  /** Font size in output units. Ignored when fitWidth is on. */
  fontSize: number
  letterSpacing: number
  /** Estimate a size that fits the width (no DOM, so approximate; letters are never stretched). */
  fitWidth: boolean
}

export interface SvgSource {
  kind: 'svg'
  /** Raw SVG markup. Only its shapes' coverage (alpha) is used; its own colours are ignored. */
  markup: string
}

export interface ImageSource {
  kind: 'image'
  /** data: URL or http(s) URL. */
  href: string
  /**
   * 'alpha'     — the image is a cut-out: only its transparency is used, like a shape.
   * 'luminance' — the image's own light and dark become the heat, under the stripe.
   */
  mode: 'alpha' | 'luminance'
}

export type Source = TextSource | SvgSource | ImageSource

export interface ThermalConfig {
  source: Source
  output: {
    width: number
    height: number
    /** Space kept free around the content, in output units. */
    padding: number
    /**
     * 'palette'     — the background is the palette's cold end
     * 'transparent' — only the shape and its glow, nothing behind
     * 'color'       — the shape and glow over backgroundColor
     */
    background: 'palette' | 'transparent' | 'color'
    backgroundColor: string
    /**
     * Moves the content inside the output, in output units. Text is laid out by its font box and dropped
     * files can carry empty margins, so a host that can measure the visible outline (see the runtime's
     * measureInk) sets these to centre it exactly.
     */
    offsetX: number
    offsetY: number
  }
  /** The inner shadow that makes the shape look inflated. */
  material: {
    /** Blur radius of the inner edge, in output units. 0 turns the bevel off. */
    depth: number
    /** How much of the height comes from the inner edge vs the base fill. 0..2 */
    edgeStrength: number
    /** Base heat of the shape's inside before the stripe. 0..1 */
    baseLevel: number
  }
  /** The repeating light band that sweeps across the shape. */
  stripe: {
    enabled: boolean
    /** Light–dark difference of the band. 0..1 */
    contrast: number
    /** Distance between two bands, in output units. */
    period: number
    /** Direction of the sweep, degrees. */
    angle: number
    /** Seconds for one band to travel one period. */
    duration: number
    /** false renders a still frame (no animation element at all). */
    playing: boolean
  }
  /** Grey-to-colour lookup: every heat level maps to a colour along these stops. */
  palette: {
    stops: ColorStop[]
    /** Lookup-table resolution. More = smoother bands, bigger SVG. 2..256 */
    steps: number
  }
  finish: {
    /** Overall softness and the size of the outer glow, in output units. */
    blur: number
    /** Film grain strength, in the blurred zone around the edge only. 0..1 */
    grain: number
    /** Size of one grain speck, in output units. Bigger = coarser grain. */
    grainSize: number
    seed: number
  }
}

type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T
export type ThermalConfigInput = DeepPartial<Omit<ThermalConfig, 'source'>> & { source?: Partial<Source> & { kind?: Source['kind'] } }

export interface RenderOptions {
  /** Prefix for every internal id, so several renders can share one page. */
  id?: string
  /**
   * 'final' (default) — the finished effect.
   * 'field' — the still data a GPU view animates: R = heat without the stripe, G = where the stripe
   *   applies (shape coverage, softened like the heat), B = the blurred coverage a (glow = min(1, 2.5a), grain band = 4a(1 − a)). No palette, no grain.
   * 'grain' — the film-grain noise alone (grey, opaque), for a GPU view to overlay.
   * 'mask'  — the content alone, white on transparent, with no offset — for measuring its outline.
   */
  layer?: 'final' | 'field' | 'grain' | 'mask'
  /** Pixel size written on the root <svg> (the drawing size). Defaults to the output size. */
  pixelWidth?: number
  pixelHeight?: number
  /** @font-face rules placed inside the SVG, so text uses the real font wherever the file goes. */
  fontCss?: string
}

export interface RenderResult {
  svg: string
  width: number
  height: number
  /** The config actually rendered, after defaults and limits were applied. */
  config: ThermalConfig
}
