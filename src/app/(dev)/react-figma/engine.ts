/**
 * react-figma engine · M2 read-bridge (KAI-9305) — client-side read path.
 *
 * Layer-tree walker + style reader over the same-origin canvas document.
 * Contracts: ENGINE-PLAN.md §4 — this is the client half of StyleReport
 * (computed truth + defined text with var() PRESERVED + inherited-owner
 * fill-ins). DeclRef resolution (postcss byte ranges) is server-side and
 * lands with the write engine (E1.4) that consumes it.
 */

export type LiveNode = { id: string; tag: string; name: string; depth: number; kids: boolean; srcFile?: string }
export type DefEntry = { value: string; token?: string; inheritedFrom?: { tag: string; name: string } }
export type StyleReport = { computed: Record<string, string>; defined: Record<string, DefEntry> }

/** CSS-inheritable subset the panel surfaces (plan §5 — enumerated, not guessed). */
export const INHERITABLE = [
  'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
  'letter-spacing', 'text-align', 'text-transform', 'visibility', 'cursor',
] as const

/** Computed props the panel sections read (Position / Auto layout / Appearance / Fill). */
const PROPS = [
  'width', 'height', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'gap', 'row-gap', 'column-gap', 'display', 'flex-direction', 'flex-wrap',
  'align-items', 'justify-content', 'opacity', 'border-radius', 'mix-blend-mode',
  'background-color', 'color', 'font-family', 'font-size', 'font-weight', 'line-height',
  'position', 'top', 'left', 'z-index', 'overflow',
  'box-shadow', 'border-top-width', 'border-top-color', 'border-top-style',
]

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'TEMPLATE', 'NEXT-ROUTE-ANNOUNCER', 'NEXTJS-PORTAL'])

/** Shorthands whose var() text is invisible to CSSOM longhand iteration (probed directly). */
const SHORTHANDS = ['gap', 'padding', 'margin', 'border-radius', 'background', 'border', 'inset', 'font', 'flex']

let seq = 0
/** Runtime element address for layers↔canvas sync — DOM attribute only, never source. */
export function ensureId(el: HTMLElement): string {
  let id = el.getAttribute('data-eng-id')
  if (!id) { id = `e${++seq}`; el.setAttribute('data-eng-id', id) }
  return id
}

/** Dev css-module class `file_local__hash` → `local`; '' when none. */
function localName(el: HTMLElement): string {
  for (const c of Array.from(el.classList)) {
    const m = c.match(/^[a-zA-Z0-9$-]+?_(.+?)__[a-zA-Z0-9_-]+$/)
    if (m?.[1]) return m[1]
  }
  return ''
}

export function layerLabel(el: HTMLElement): string {
  return localName(el) || el.tagName.toLowerCase()
}

/** Flatten the canvas DOM into layer rows — data-src-tagged elements only; untagged wrappers pass through. */
export function buildLayerTree(doc: Document): LiveNode[] {
  const out: LiveNode[] = []
  const walk = (parent: Element, depth: number) => {
    for (const child of Array.from(parent.children)) {
      if (SKIP_TAGS.has(child.tagName) || child.namespaceURI?.endsWith('/svg')) continue
      const el = child as HTMLElement
      const src = el.getAttribute('data-src')
      if (src) {
        out.push({
          id: ensureId(el), tag: el.tagName.toLowerCase(), name: layerLabel(el),
          depth, kids: el.children.length > 0, srcFile: src.split(':')[0],
        })
        walk(el, depth + 1)
      } else {
        walk(el, depth) // untagged wrapper (3rd-party / portal) — children stay reachable
      }
    }
  }
  walk(doc.body, 0)
  return out
}

const tokenOf = (value: string): string | undefined => value.match(/var\(\s*(--[a-zA-Z0-9-]+)/)?.[1]

/**
 * Matched declarations for el across the doc's stylesheets, cascade-ordered by
 * source order (media-condition aware), inline style last. Declaration TEXT is
 * kept as written — `var(--…)` stays unresolved; that pair with `computed` IS
 * the token/raw provenance (plan §3 M2).
 */
function collectDefined(el: HTMLElement, doc: Document): Record<string, DefEntry> {
  const into: Record<string, DefEntry> = {}
  const win = doc.defaultView
  if (!win) return into
  const visit = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof win.CSSMediaRule) {
        if (win.matchMedia(rule.conditionText).matches) visit(rule.cssRules)
      } else if (rule instanceof win.CSSSupportsRule) {
        visit(rule.cssRules)
      } else if (rule instanceof win.CSSStyleRule) {
        let matches = false
        try { matches = el.matches(rule.selectorText) } catch { /* :has()/vendor selector — skip */ }
        if (!matches) continue
        for (const prop of Array.from(rule.style)) {
          const value = rule.style.getPropertyValue(prop).trim()
          if (value) into[prop] = { value, token: tokenOf(value) } // later match wins (source order)
        }
        // Chrome iterates var() SHORTHANDS as empty longhands (pending substitution
        // lives on the shorthand) — probe shorthands directly for the var() text.
        for (const sh of SHORTHANDS) {
          const value = rule.style.getPropertyValue(sh).trim()
          if (value) into[sh] = { value, token: tokenOf(value) }
        }
      }
    }
  }
  for (const sheet of Array.from(doc.styleSheets)) {
    try { if (sheet.cssRules) visit(sheet.cssRules) } catch { /* cross-origin sheet */ }
  }
  for (const prop of Array.from(el.style)) { // inline wins the cascade
    const value = el.style.getPropertyValue(prop).trim()
    if (value) into[prop] = { value, token: tokenOf(value) }
  }
  for (const sh of SHORTHANDS) {
    const value = el.style.getPropertyValue(sh).trim()
    if (value) into[sh] = { value, token: tokenOf(value) }
  }
  return into
}

/** StyleReport: computed truth + defined text + ancestor-owner fill-ins for inheritable props. */
export function readStyles(el: HTMLElement): StyleReport {
  const doc = el.ownerDocument
  const cs = doc.defaultView!.getComputedStyle(el)
  const computed: Record<string, string> = {}
  for (const p of PROPS) computed[p] = cs.getPropertyValue(p)

  const defined = collectDefined(el, doc)
  for (const p of INHERITABLE) {
    if (defined[p]) continue
    let a = el.parentElement
    while (a && a !== doc.documentElement) {
      const anc = collectDefined(a, doc)
      if (anc[p]) {
        defined[p] = { ...anc[p], inheritedFrom: { tag: a.tagName.toLowerCase(), name: layerLabel(a) } }
        break
      }
      a = a.parentElement
    }
  }
  return { computed, defined }
}

let _ctx: CanvasRenderingContext2D | null = null
/** Any CSS color (rgb/oklch/color()/named) → {hex, op%}; null for transparent/none. */
export function colorToHex(c: string, doc: Document): { hex: string; op: number } | null {
  if (!c || c === 'transparent' || c === 'none') return null
  _ctx ??= doc.createElement('canvas').getContext('2d')
  if (!_ctx) return null
  _ctx.fillStyle = '#000000'
  try { _ctx.fillStyle = c } catch { return null }
  const s = _ctx.fillStyle as string // normalized '#rrggbb' | 'rgba(r, g, b, a)' | 'color(...)'
  if (s.startsWith('#')) return { hex: s.slice(1).toUpperCase(), op: 100 }
  const m = s.match(/rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/)
  if (!m) return null
  const a = parseFloat(m[4]!)
  if (a === 0) return null
  const hex = [m[1], m[2], m[3]].map((n) => (+n!).toString(16).padStart(2, '0').toUpperCase()).join('')
  return { hex, op: Math.round(a * 100) }
}
