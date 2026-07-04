/**
 * react-figma engine · E3.3 — DS token source for the variable (⬡) picker.
 * GET → the real design-system tokens emitted by the converter (src/app/tokens/tokens.css),
 * parsed into { cssVar, value, group, kind }. The var NAME is the token path (DEC-locked
 * structural naming), so it doubles as the Figma-style token label. `kind` lets the picker
 * filter to the field's type (a padding field shows dimension tokens, a fill shows colors).
 * Dev-only, read-only. No converter logic here — just reads its output.
 */
import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const TOKENS_CSS = join(process.cwd(), 'src', 'app', 'tokens', 'tokens.css')

export type TokenKind = 'color' | 'dimension' | 'other'
export type Token = { cssVar: string; value: string; group: string; kind: TokenKind }

function classify(name: string, value: string): TokenKind {
  if (/^(oklch|oklab|rgb|hsl|lab|lch|hwb|#)/i.test(value) || /-col(-|$)|color/.test(name)) return 'color'
  if (/(px|rem|em|%)\s*$/.test(value) || /^-?\d/.test(value) || /-(dim|space|spacing|size|radius|gap|width|height)(-|$)/.test(name)) return 'dimension'
  return 'other'
}

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'dev-only' }, { status: 403 })
  }
  try {
    const css = await readFile(TOKENS_CSS, 'utf8')
    const seen = new Set<string>()
    const tokens: Token[] = []
    // match `--name: value;` declarations (top-level custom properties)
    const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(css))) {
      const cssVar = m[1], value = m[2].trim()
      if (seen.has(cssVar)) continue // first occurrence (:root default) wins
      seen.add(cssVar)
      const segs = cssVar.replace(/^--/, '').split('-')
      const group = segs.slice(0, 2).join('-') || 'other'
      tokens.push({ cssVar, value, group, kind: classify(cssVar, value) })
    }
    return NextResponse.json({ tokens, count: tokens.length })
  } catch (e) {
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
