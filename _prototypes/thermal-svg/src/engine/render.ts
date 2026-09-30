// Config → one self-contained SVG. The look is a single filter over the shape:
//
//   heat  = base level (+ the moving stripe)            — the fill, inside the shape only
//         − inner edge × edge strength                   — the inflated, bevelled look
//   heat  → blurred                                      — softness and the outer glow
//   heat  → + grain                                      — film noise
//   heat  → palette lookup (grey level → colour)         — the heat-map colours
//
// No script, no canvas, no WebGL. The only motion is an SVG gradient animation.

import { normalizeConfig } from './normalize'
import { paletteTables } from './palette'
import { sourceContent, type Box } from './source'
import type { RenderOptions, RenderResult, ThermalConfig, ThermalConfigInput } from './types'

const n = (v: number) => String(Math.round(v * 1000) / 1000)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const grey = (v: number) => {
  const c = Math.round(clamp01(v) * 255).toString(16).padStart(2, '0')
  return `#${c}${c}${c}`
}

function stripeGradient(id: string, c: ThermalConfig, lo: string, hi: string): string {
  const { width, height } = c.output
  const s = c.stripe
  const animate = s.playing
    ? `<animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="${n(s.period)} 0" dur="${n(s.duration)}s" repeatCount="indefinite" additive="sum"/>`
    : ''
  return (
    `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${n(s.period)}" y2="0" spreadMethod="repeat"` +
    ` gradientTransform="rotate(${n(s.angle)} ${n(width / 2)} ${n(height / 2)})">` +
    `<stop offset="0" stop-color="${hi}"/><stop offset="0.5" stop-color="${lo}"/><stop offset="1" stop-color="${hi}"/>${animate}</linearGradient>`
  )
}

function heatFilter(id: string, c: ThermalConfig, layer: 'final' | 'field'): string {
  const { width, height, background } = c.output
  const { depth, edgeStrength } = c.material
  const { blur, grain, grainFrequency, seed } = c.finish
  const p: string[] = []
  // 1. The fill as grey on black, fully opaque, so the outside counts as "no heat".
  p.push(`<feColorMatrix in="SourceGraphic" type="saturate" values="0" result="fill"/>`)
  p.push(`<feFlood flood-color="#000" result="black"/>`)
  p.push(`<feComposite in="fill" in2="black" operator="over" result="heat0"/>`)
  let last = 'heat0'
  // 2. Inner edge: the shape minus a blurred copy of itself leaves only a band along the inside edge.
  //    feComposite arithmetic applies to alpha too, so the edge is carried inverted (1 − edge, opaque)
  //    and subtracted as  heat + s·(1 − edge) − s  — colour gets heat − s·edge, alpha stays 1.
  if (depth > 0 && edgeStrength > 0) {
    p.push(`<feGaussianBlur in="SourceAlpha" stdDeviation="${n(depth)}" result="soft"/>`)
    p.push(`<feComposite in="SourceAlpha" in2="soft" operator="arithmetic" k2="1" k3="-1" result="edgeA"/>`)
    p.push(`<feColorMatrix in="edgeA" type="matrix" values="0 0 0 -1 1 0 0 0 -1 1 0 0 0 -1 1 0 0 0 0 1" result="edgeInv"/>`)
    p.push(`<feComposite in="${last}" in2="edgeInv" operator="arithmetic" k2="1" k3="${n(edgeStrength)}" k4="${n(-edgeStrength)}" result="heat1"/>`)
    last = 'heat1'
  }
  // 3. Softness and the outer glow.
  if (blur > 0) {
    p.push(`<feGaussianBlur in="${last}" stdDeviation="${n(blur)}" result="heat2"/>`)
    last = 'heat2'
  }
  // 4. Grain, centred on zero so it does not shift the overall heat.
  if (grain > 0) {
    p.push(`<feTurbulence type="fractalNoise" baseFrequency="${n(grainFrequency)}" numOctaves="2" seed="${seed}" stitchTiles="stitch" result="noise"/>`)
    p.push(`<feColorMatrix in="noise" type="matrix" values="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0 0 1" result="noiseGrey"/>`)
    p.push(`<feComposite in="${last}" in2="noiseGrey" operator="arithmetic" k2="1" k3="${n(grain)}" k4="${n(-grain / 2)}" result="heat3"/>`)
    last = 'heat3'
  }
  if (layer === 'field') {
    // GPU field: pack heat, stripe coverage and glow into R, G, B (opaque). The GPU adds the moving
    // stripe and does the palette lookup per frame; everything expensive above is computed once.
    const soft = n(Math.max(blur, 0.5))
    p.push(`<feColorMatrix in="${last}" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1" result="fR"/>`)
    p.push(blur > 0 ? `<feGaussianBlur in="SourceAlpha" stdDeviation="${n(blur)}" result="cover"/>` : `<feOffset in="SourceAlpha" result="cover"/>`)
    p.push(`<feColorMatrix in="cover" type="matrix" values="0 0 0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 1" result="fG"/>`)
    p.push(`<feGaussianBlur in="SourceAlpha" stdDeviation="${soft}" result="glowSoft"/>`)
    p.push(`<feColorMatrix in="glowSoft" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 2.5 0 0 0 0 0 1" result="fB"/>`)
    p.push(`<feComposite in="fR" in2="fG" operator="arithmetic" k2="1" k3="1" result="fRG"/>`)
    p.push(`<feComposite in="fRG" in2="fB" operator="arithmetic" k2="1" k3="1"/>`)
  } else {
    // 5. Grey level → palette colour. With a palette background the result is forced opaque — the blur
    //    otherwise pulls transparency in from outside the frame and fades the edges.
    const t = paletteTables(c.palette.stops, c.palette.steps)
    const opaque = background === 'palette' ? `<feFuncA type="linear" slope="0" intercept="1"/>` : ''
    p.push(
      `<feComponentTransfer in="${last}" result="colour"><feFuncR type="table" tableValues="${t.r}"/>` +
        `<feFuncG type="table" tableValues="${t.g}"/><feFuncB type="table" tableValues="${t.b}"/>${opaque}</feComponentTransfer>`,
    )
    // 6. Transparent background: keep only the shape and its glow.
    if (background === 'transparent') {
      p.push(`<feGaussianBlur in="SourceAlpha" stdDeviation="${n(Math.max(blur, 0.5))}" result="glowSoft"/>`)
      p.push(`<feComponentTransfer in="glowSoft" result="glow"><feFuncA type="linear" slope="2.5"/></feComponentTransfer>`)
      p.push(`<feComposite in="colour" in2="glow" operator="in"/>`)
    }
  }
  return (
    `<filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}" color-interpolation-filters="sRGB">` +
    p.join('') +
    `</filter>`
  )
}

/** Render the effect. Accepts a partial config; missing values come from the defaults. */
export function renderThermal(input: ThermalConfigInput = {}, options: RenderOptions = {}): RenderResult {
  const c = normalizeConfig(input)
  const id = (options.id ?? 'thermal').replace(/[^a-zA-Z0-9_-]/g, '') || 'thermal'
  const { width, height, padding } = c.output
  const pad = Math.min(padding, width / 2 - 1, height / 2 - 1)
  const box: Box = { x: pad, y: pad, width: width - pad * 2, height: height - pad * 2 }
  const content = sourceContent(c.source, box)
  const ids = { white: `${id}-white`, shape: `${id}-shape`, stripe: `${id}-stripe`, heat: `${id}-heat` }

  const base = c.material.baseLevel
  const half = c.stripe.contrast / 2
  const luminance = c.source.kind === 'image' && c.source.mode === 'luminance'
  const layer = options.layer ?? 'final'
  // The field is the still frame without the stripe — the GPU view adds the stripe itself.
  const stripeOn = layer === 'final' && c.stripe.enabled && c.stripe.contrast > 0
  const defs: string[] = [
    ...(options.fontCss ? [`<style>${options.fontCss.replace(/<\/?style/gi, '')}</style>`] : []),
    // Everything drawn in the mask becomes white, so any source colour works as a shape.
    `<filter id="${ids.white}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter>`,
    `<mask id="${ids.shape}" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><g filter="url(#${ids.white})">${content}</g></mask>`,
    heatFilter(ids.heat, c, layer),
  ]
  let fill: string
  if (luminance) {
    // The image's own light and dark are the heat; the stripe rides on top of it.
    fill = content
    if (stripeOn) {
      defs.push(stripeGradient(ids.stripe, c, '#000000', '#ffffff'))
      fill += `<rect width="${width}" height="${height}" fill="url(#${ids.stripe})" opacity="${n(half)}"/>`
    }
  } else if (stripeOn) {
    defs.push(stripeGradient(ids.stripe, c, grey(base - half), grey(base + half)))
    fill = `<rect width="${width}" height="${height}" fill="url(#${ids.stripe})"/>`
  } else {
    fill = `<rect width="${width}" height="${height}" fill="${grey(base)}"/>`
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${n(options.pixelWidth ?? width)}" height="${n(options.pixelHeight ?? height)}"${layer === 'field' ? ' preserveAspectRatio="none"' : ''}>` +
    `<defs>${defs.join('')}</defs>` +
    `<g filter="url(#${ids.heat})"><g mask="url(#${ids.shape})">${fill}</g></g>` +
    `</svg>`
  return { svg, width, height, config: c }
}
