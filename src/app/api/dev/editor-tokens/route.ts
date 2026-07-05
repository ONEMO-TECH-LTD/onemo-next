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

const TOKENS_DIR = join(process.cwd(), 'src', 'app', 'tokens')
const TOKENS_CSS = join(TOKENS_DIR, 'tokens.css')
const TOKENS_TS = join(TOKENS_DIR, 'tokens.ts')

export type TokenKind = 'color' | 'dimension' | 'other'
export type Token = { cssVar: string; value: string; dark?: string; group: string; kind: TokenKind; path?: string; scopes?: string[]; original?: Record<string, string> }

const FIGMA_EXPORT = join(process.cwd(), 'storybook', 'design-system', 'variables', 'figma-export.json')
/** E6.13 — join Figma's OWN `$scopes` + original values from the SSOT export (variables2json shape:
 *  `[{ "<coll>": { modes: { "<Mode>": { <group…>: { <leaf>: {$type,$value,$scopes} } } } } }]`).
 *  Path key matches the converter's structural path: collection "1.0-Prim-Col" → "primCol". */
const collCamel = (n: string) => n.replace(/^[\d.]+-/, '').split(/[-_\s]+/).filter(Boolean)
  .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())).join('')
async function figmaMeta(): Promise<Record<string, { scopes?: string[]; original: Record<string, string> }>> {
  try {
    const raw = JSON.parse(await readFile(FIGMA_EXPORT, 'utf8')) as Record<string, { modes?: Record<string, unknown> }>[]
    if (!Array.isArray(raw)) return {}
    const out: Record<string, { scopes?: string[]; original: Record<string, string> }> = {}
    for (const item of raw) {
      const coll = Object.keys(item)[0]
      if (!coll) continue
      const modes = item[coll]?.modes ?? {}
      for (const [mode, tree] of Object.entries(modes)) {
        const walk = (node: unknown, path: string[]) => {
          if (!node || typeof node !== 'object') return
          const rec = node as Record<string, unknown> & { $value?: unknown; $scopes?: string[] }
          if ('$value' in rec) {
            const key = [collCamel(coll), ...path].join(' / ')
            const entry = (out[key] ??= { original: {} })
            entry.original[mode] = String(rec.$value)
            if (Array.isArray(rec.$scopes)) entry.scopes = rec.$scopes as string[]
            return
          }
          for (const [k, v] of Object.entries(rec)) if (!k.startsWith('$')) walk(v, path.concat(k))
        }
        walk(tree, [])
      }
    }
    return out
  } catch { return {} } // export missing/unparseable → tokens still serve without scopes
}

/** Build cssVar → structural path from the converter's own tokens.ts (authoritative, 100% coverage).
 *  The nested path (e.g. primCol.base.white) is the design-system name; the css var is the CSS name —
 *  showing both = full traceability. Returns {} if tokens.ts is missing/unparseable (degrade gracefully). */
async function pathByCssVar(): Promise<Record<string, string>> {
  try {
    const ts = await readFile(TOKENS_TS, 'utf8')
    const body = ts.replace(/^[\s\S]*?export const tokens\s*=\s*/, '').replace(/(;|\s+as const\s*;?)\s*$/, '').trim()
    const obj = JSON.parse(body) as Record<string, unknown>
    const out: Record<string, string> = {}
    const walk = (node: Record<string, unknown>, path: string[]) => {
      for (const [k, v] of Object.entries(node)) {
        if (typeof v === 'string') {
          const m = v.match(/var\((--[a-z0-9-]+)\)/i)
          if (m) out[m[1]] = path.concat(k).join(' / ')
        } else if (v && typeof v === 'object') walk(v as Record<string, unknown>, path.concat(k))
      }
    }
    walk(obj, [])
    return out
  } catch {
    return {}
  }
}

function classify(name: string, value: string): TokenKind {
  if (/^(oklch|oklab|rgb|hsl|lab|lch|hwb|#)/i.test(value) || /-col(-|$)|color/.test(name)) return 'color'
  if (/(px|rem|em|%)\s*$/.test(value) || /^-?\d/.test(value) || /-(dim|space|spacing|size|radius|gap|width|height)(-|$)/.test(name)) return 'dimension'
  return 'other'
}

export async function GET(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'dev-only' }, { status: 403 })
  }
  try {
    // E6.7 — ?figma=1 serves the raw SSOT export so the Variables library renders the figma side verbatim.
    if (new URL(req.url).searchParams.get('figma') === '1') {
      return NextResponse.json({ file: 'storybook/design-system/variables/figma-export.json', data: JSON.parse(await readFile(FIGMA_EXPORT, 'utf8')) as unknown })
    }
    const [css, paths, meta] = await Promise.all([readFile(TOKENS_CSS, 'utf8'), pathByCssVar(), figmaMeta()])
    // Two theme modes: :root (Light) and [data-theme="dark"] (Dark override). Split so Light is the
    // primary value and Dark is captured where a token overrides it (else it's identical to Light).
    const declRe = (s: string) => {
      const out: Record<string, string> = {}
      const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi
      let m: RegExpExecArray | null
      while ((m = re.exec(s))) if (!(m[1] in out)) out[m[1]] = m[2].trim() // first occurrence wins
      return out
    }
    const darkIdx = css.indexOf('[data-theme="dark"]')
    const light = declRe(darkIdx >= 0 ? css.slice(0, darkIdx) : css)
    const dark = darkIdx >= 0 ? declRe(css.slice(darkIdx)) : {}
    const tokens: Token[] = Object.entries(light).map(([cssVar, value]) => {
      const segs = cssVar.replace(/^--/, '').split('-')
      const group = segs.slice(0, 2).join('-') || 'other'
      const darkVal = dark[cssVar]
      const m = paths[cssVar] ? meta[paths[cssVar]] : undefined
      return { cssVar, value, ...(darkVal && darkVal !== value ? { dark: darkVal } : {}), group, kind: classify(cssVar, value), path: paths[cssVar], ...(m?.scopes ? { scopes: m.scopes } : {}), ...(m?.original ? { original: m.original } : {}) }
    })
    return NextResponse.json({ tokens, count: tokens.length })
  } catch (e) {
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
