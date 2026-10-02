// Config → one SVG: the garment photo with the Effect layered on top as a convincing physical object.
//
//   1. drop shadow        — soft, offset away from the light
//   2. contact shadow     — tight and dark, where the Effect touches the fabric
//   3. side wall          — the Effect repeated a few pixels away from the light, darkened = thickness
//   4. face               — the artwork, tone-matched to the photo
//      + bevel light      — the edge rounded by lighting the blurred outline (diffuse shade + specular glint)
//      + material         — a texture height map lit by the same light, so suede/fabric reads as real
//
// Light is one direction for all layers, so everything agrees. Pure string output: rasterise it in a
// browser, a worker or a server (e.g. resvg) — no DOM needed here.

import { normalize } from './normalize'
import type { RenderConfig, RenderInput, RenderOptions } from './types'

const n = (v: number) => String(Math.round(v * 1000) / 1000)
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

function toneMatrix(t: RenderConfig['tone']): string {
  // saturation, then brightness/contrast and a warm/cool shift, as one colour matrix
  const s = 1 + t.saturation
  const lr = 0.2126, lg = 0.7152, lb = 0.0722
  const sat = [
    lr * (1 - s) + s, lg * (1 - s), lb * (1 - s),
    lr * (1 - s), lg * (1 - s) + s, lb * (1 - s),
    lr * (1 - s), lg * (1 - s), lb * (1 - s) + s,
  ]
  const c = 1 + t.contrast, off = (0.5 - 0.5 * c) + t.brightness * 0.5
  const warm = [1 + t.warmth * 0.12, 1, 1 - t.warmth * 0.12]
  const rows = [0, 1, 2].map((r) =>
    [sat[r * 3] * c * warm[r], sat[r * 3 + 1] * c * warm[r], sat[r * 3 + 2] * c * warm[r], 0, off].map(n).join(' '),
  )
  return rows.join(' ') + ' 0 0 0 1 0'
}

export function renderEffect(input: RenderInput = {}, options: RenderOptions = {}): { svg: string; config: RenderConfig } {
  const c = normalize(input)
  const id = (options.id ?? 'er').replace(/[^a-zA-Z0-9_-]/g, '') || 'er'
  const { base, effect, place, light, shadow, contact, thickness, bevel, texture, tone } = c
  const w = place.size, h = (place.size * effect.height) / effect.width
  // light direction in the Effect's own (rotated) frame
  const az = light.angle - place.rotation
  const ax = Math.cos((az * Math.PI) / 180), ay = Math.sin((az * Math.PI) / 180)
  const away = (d: number) => [-ax * d, -ay * d]                         // shadows fall away from the light
  const [sdx, sdy] = away(shadow.distance)
  const [cdx, cdy] = away(Math.min(2, shadow.distance * 0.15))
  const region = 'x="-60%" y="-60%" width="220%" height="220%"'
  const f = { shadow: `${id}-shadow`, contact: `${id}-contact`, side: `${id}-side`, face: `${id}-face` }

  const defs: string[] = []
  defs.push(
    `<filter id="${f.shadow}" ${region} color-interpolation-filters="sRGB">` +
      `<feGaussianBlur in="SourceAlpha" stdDeviation="${n(shadow.blur)}"/><feOffset dx="${n(sdx)}" dy="${n(sdy)}" result="s"/>` +
      `<feComponentTransfer in="s"><feFuncA type="linear" slope="${n(shadow.opacity)}"/></feComponentTransfer></filter>`,
    `<filter id="${f.contact}" ${region} color-interpolation-filters="sRGB">` +
      `<feGaussianBlur in="SourceAlpha" stdDeviation="${n(contact.blur)}"/><feOffset dx="${n(cdx)}" dy="${n(cdy)}" result="s"/>` +
      `<feComponentTransfer in="s"><feFuncA type="linear" slope="${n(contact.opacity)}"/></feComponentTransfer></filter>`,
  )
  // side wall: the Effect stacked a few times away from the light, darkened
  if (thickness.depth > 0) {
    const steps = Math.max(2, Math.min(24, Math.round(thickness.depth / 1.5)))
    const parts: string[] = []
    for (let k = 1; k <= steps; k++) {
      const [dx, dy] = away((thickness.depth * k) / steps)
      parts.push(`<feOffset in="SourceGraphic" dx="${n(dx)}" dy="${n(dy)}" result="o${k}"/>`)
    }
    const keep = 1 - thickness.shade
    defs.push(
      `<filter id="${f.side}" ${region} color-interpolation-filters="sRGB">` + parts.join('') +
        `<feMerge>${Array.from({ length: steps }, (_, k) => `<feMergeNode in="o${steps - k}"/>`).join('')}</feMerge>` +
        `<feColorMatrix type="matrix" values="${n(keep)} 0 0 0 0 0 ${n(keep)} 0 0 0 0 0 ${n(keep)} 0 0 0 0 0 1 0"/></filter>`,
    )
  }
  // face: tone match, bevel shading + glint, material bump — all lit by the same light
  const azDeg = n(az), el = n(light.elevation)
  const flat = n(1 / Math.sin((light.elevation * Math.PI) / 180))   // keeps flat areas at their own brightness
  const face: string[] = [`<feColorMatrix in="SourceGraphic" type="matrix" values="${toneMatrix(tone)}" result="art"/>`]
  let lit = 'art'
  if (bevel.size > 0 && bevel.strength > 0) {
    face.push(
      `<feGaussianBlur in="SourceAlpha" stdDeviation="${n(bevel.size)}" result="hgt"/>`,
      `<feDiffuseLighting in="hgt" surfaceScale="${n(bevel.strength)}" diffuseConstant="${flat}" lighting-color="#ffffff" result="diff"><feDistantLight azimuth="${azDeg}" elevation="${el}"/></feDiffuseLighting>`,
      `<feComposite in="${lit}" in2="diff" operator="arithmetic" k1="1" result="shaded"/>`,
      `<feSpecularLighting in="hgt" surfaceScale="${n(bevel.strength)}" specularConstant="${n(bevel.shine * 1.6)}" specularExponent="${n(bevel.gloss)}" lighting-color="#ffffff" result="spec"><feDistantLight azimuth="${azDeg}" elevation="${el}"/></feSpecularLighting>`,
      `<feComposite in="spec" in2="SourceAlpha" operator="in" result="glint"/>`,
      `<feComposite in="shaded" in2="glint" operator="arithmetic" k2="1" k3="1" result="bev"/>`,
    )
    lit = 'bev'
  }
  if (texture.href && texture.strength > 0) {
    const tw = w * texture.scale, th = (tw * texture.height) / texture.width
    face.push(
      `<feImage href="${esc(texture.href)}" x="${n(-w / 2)}" y="${n(-h / 2)}" width="${n(tw)}" height="${n(th)}" preserveAspectRatio="none" result="tex0"/>`,
      `<feTile in="tex0" result="tex"/>`,
      `<feColorMatrix in="tex" type="luminanceToAlpha" result="bump"/>`,
      `<feDiffuseLighting in="bump" surfaceScale="${n(texture.strength)}" diffuseConstant="${flat}" lighting-color="#ffffff" result="tlit"><feDistantLight azimuth="${azDeg}" elevation="${el}"/></feDiffuseLighting>`,
      `<feComposite in="${lit}" in2="tlit" operator="arithmetic" k1="1" result="textured"/>`,
    )
    lit = 'textured'
  }
  face.push(`<feComposite in="${lit}" in2="SourceAlpha" operator="in"/>`)
  defs.push(`<filter id="${f.face}" ${region} color-interpolation-filters="sRGB">${face.join('')}</filter>`)

  const img = (filter: string) =>
    `<image href="${esc(effect.href)}" x="${n(-w / 2)}" y="${n(-h / 2)}" width="${n(w)}" height="${n(h)}" preserveAspectRatio="none" filter="url(#${filter})"/>`
  const t = `translate(${n(place.x)} ${n(place.y)}) rotate(${n(place.rotation)}) skewX(${n(place.tiltX)}) skewY(${n(place.tiltY)})`
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${base.width} ${base.height}" width="${base.width}" height="${base.height}">` +
    `<defs>${defs.join('')}</defs>` +
    (base.href ? `<image href="${esc(base.href)}" width="${base.width}" height="${base.height}" preserveAspectRatio="xMidYMid slice"/>` : '') +
    (effect.href
      ? `<g transform="${t}">` +
        `<g style="mix-blend-mode:multiply">${img(f.shadow)}${img(f.contact)}</g>` +
        (thickness.depth > 0 ? img(f.side) : '') +
        img(f.face) +
        `</g>`
      : '') +
    `</svg>`
  return { svg, config: c }
}
