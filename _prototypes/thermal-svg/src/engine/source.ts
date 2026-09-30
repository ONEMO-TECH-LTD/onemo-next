// Turns the config's source (text, SVG markup or an image) into SVG content placed inside the
// output box. Pure string work — no DOM — so it runs anywhere.

import type { ImageSource, Source, SvgSource, TextSource } from './types'

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

/**
 * Strips anything executable or external from user SVG and returns its viewBox and inner markup.
 * Only the shapes' coverage matters to the effect, so colours are left alone.
 */
export function sanitizeSvg(markup: string): { viewBox: string; inner: string } | null {
  const open = markup.match(/<svg\b[^>]*>/i)
  const close = markup.toLowerCase().lastIndexOf('</svg>')
  if (!open || close < 0) return null
  const attrs = open[0]
  let viewBox = attrs.match(/viewBox\s*=\s*["']([^"']+)["']/i)?.[1]
  if (!viewBox) {
    const w = parseFloat(attrs.match(/\bwidth\s*=\s*["']([\d.]+)/i)?.[1] ?? '')
    const h = parseFloat(attrs.match(/\bheight\s*=\s*["']([\d.]+)/i)?.[1] ?? '')
    if (!(w > 0 && h > 0)) return null
    viewBox = `0 0 ${w} ${h}`
  }
  let inner = markup.slice((open.index ?? 0) + open[0].length, close)
  inner = inner
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject\s*>/gi, '')
    .replace(/<(script|foreignObject)\b[^>]*\/>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href\s*=\s*["'])\s*(javascript:|https?:)[^"']*(["'])/gi, '$1#$3')
  if (!/^[-\d.eE\s,]+$/.test(viewBox)) return null
  return { viewBox: viewBox.trim(), inner }
}

function safeHref(href: string): string | null {
  return /^(data:image\/[a-z+.-]+;base64,[a-z0-9+/=\s]+|https?:\/\/[^\s"'<>]+)$/i.test(href) ? href : null
}

function textContent(src: TextSource, box: Box): string {
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  // Without a DOM the text can't be measured, so fitWidth estimates the size from an average bold glyph
  // (~0.66 em). Letters are never stretched; a host that can measure (the admin) sets fontSize exactly.
  const glyphs = Math.max(1, [...src.text].length)
  const size = src.fitWidth ? Math.min(box.height, box.width / (glyphs * 0.66)) : src.fontSize
  return (
    `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central"` +
    ` font-family="${escapeXml(src.fontFamily)}" font-weight="${src.fontWeight}" font-size="${size}"` +
    ` letter-spacing="${src.letterSpacing}">${escapeXml(src.text)}</text>`
  )
}

function svgContent(src: SvgSource, box: Box): string {
  const clean = sanitizeSvg(src.markup)
  if (!clean) return ''
  return `<svg x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" viewBox="${clean.viewBox}" preserveAspectRatio="xMidYMid meet" overflow="visible">${clean.inner}</svg>`
}

function imageContent(src: ImageSource, box: Box): string {
  const href = safeHref(src.href)
  if (!href) return ''
  return `<image href="${escapeXml(href)}" x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" preserveAspectRatio="xMidYMid meet"/>`
}

/** The source as SVG content fitted into the box. Empty string when the source has nothing to draw. */
export function sourceContent(src: Source, box: Box): string {
  switch (src.kind) {
    case 'text':
      return src.text.trim() ? textContent(src, box) : ''
    case 'svg':
      return svgContent(src, box)
    case 'image':
      return imageContent(src, box)
  }
}
