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

export const tokenOf = (value: string): string | undefined => value.match(/var\(\s*(--[a-zA-Z0-9-]+)/)?.[1]

/** Split a shorthand value into top-level slots — var()/calc() parens respected. */
export function splitSlots(value: string): string[] {
  const slots: string[] = []
  let depth = 0, cur = ''
  for (const ch of value) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (/\s/.test(ch) && depth === 0) { if (cur) { slots.push(cur); cur = '' } }
    else cur += ch
  }
  if (cur) slots.push(cur)
  return slots
}

/** CSS box shorthand slot mapping (padding/margin): 1→all · 2→[Y,X] · 3→[T,X,B] · 4→[T,R,B,L]. */
export function boxSlots(value: string): { top: string; right: string; bottom: string; left: string } | null {
  const s = splitSlots(value)
  if (s.length === 1) return { top: s[0]!, right: s[0]!, bottom: s[0]!, left: s[0]! }
  if (s.length === 2) return { top: s[0]!, right: s[1]!, bottom: s[0]!, left: s[1]! }
  if (s.length === 3) return { top: s[0]!, right: s[1]!, bottom: s[2]!, left: s[1]! }
  if (s.length === 4) return { top: s[0]!, right: s[1]!, bottom: s[2]!, left: s[3]! }
  return null
}

/** gap shorthand: [row, column] (single slot = both). */
export function gapSlots(value: string): { row: string; column: string } {
  const s = splitSlots(value)
  return { row: s[0] ?? value, column: s[1] ?? s[0] ?? value }
}

/**
 * Selector specificity for provenance owner-resolution (a·1e6 + b·1e3 + c).
 * For grouped selectors the caller passes the single matching part.
 */
function specificity(sel: string): number {
  const ids = (sel.match(/#[\w-]+/g) ?? []).length
  const classes = (sel.match(/(\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+(\([^)]*\))?)/g) ?? []).length
  const types = (sel.match(/(^|[\s>+~])[a-zA-Z][\w-]*/g) ?? []).length + (sel.match(/::[\w-]+/g) ?? []).length
  return ids * 1e6 + classes * 1e3 + types
}

/**
 * Matched declarations for el across the doc's stylesheets, cascade-ordered by
 * source order (media-condition aware), inline style last. Declaration TEXT is
 * kept as written — `var(--…)` stays unresolved; that pair with `computed` IS
 * the token/raw provenance (plan §3 M2).
 */
function collectDefined(el: HTMLElement, doc: Document): Record<string, DefEntry> {
  // True cascade owner-resolution (plan §3 M2 pin): importance → specificity → source order.
  type Cand = DefEntry & { imp: boolean; spec: number; order: number }
  const best: Record<string, Cand> = {}
  const win = doc.defaultView
  if (!win) return {}
  let order = 0
  const offer = (prop: string, c: Cand) => {
    const b = best[prop]
    if (!b) { best[prop] = c; return }
    if (c.imp !== b.imp) { if (c.imp) best[prop] = c; return }
    if (c.spec !== b.spec) { if (c.spec > b.spec) best[prop] = c; return }
    if (c.order >= b.order) best[prop] = c
  }
  const takeRule = (rule: CSSStyleRule, spec: number) => {
    order++
    for (const prop of Array.from(rule.style)) {
      const value = rule.style.getPropertyValue(prop).trim()
      if (!value) continue // Chrome iterates var() shorthands as EMPTY longhands — skip
      offer(prop, { value, token: tokenOf(value), imp: rule.style.getPropertyPriority(prop) === 'important', spec, order })
    }
    // pending-substitution var() text lives on the SHORTHAND — probe directly.
    for (const sh of SHORTHANDS) {
      const value = rule.style.getPropertyValue(sh).trim()
      if (value) offer(sh, { value, token: tokenOf(value), imp: rule.style.getPropertyPriority(sh) === 'important', spec, order })
    }
  }
  const visit = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof win.CSSMediaRule) {
        if (win.matchMedia(rule.conditionText).matches) visit(rule.cssRules)
      } else if (rule instanceof win.CSSSupportsRule) {
        visit(rule.cssRules)
      } else if (rule instanceof win.CSSStyleRule) {
        // grouped selectors: specificity of the MOST specific part that actually matches
        let spec = -1
        for (const part of rule.selectorText.split(',')) {
          try { if (el.matches(part.trim())) spec = Math.max(spec, specificity(part)) } catch { /* skip */ }
        }
        if (spec >= 0) takeRule(rule, spec)
      }
    }
  }
  for (const sheet of Array.from(doc.styleSheets)) {
    try { if (sheet.cssRules) visit(sheet.cssRules) } catch { /* cross-origin sheet */ }
  }
  // inline style: beats any non-important rule; important inline beats all.
  order++
  const offerInline = (prop: string) => {
    const value = el.style.getPropertyValue(prop).trim()
    if (value) offer(prop, { value, token: tokenOf(value), imp: el.style.getPropertyPriority(prop) === 'important', spec: Number.MAX_SAFE_INTEGER, order })
  }
  for (const prop of Array.from(el.style)) offerInline(prop)
  for (const sh of SHORTHANDS) offerInline(sh)

  const into: Record<string, DefEntry> = {}
  for (const [prop, { value, token, inheritedFrom }] of Object.entries(best)) into[prop] = { value, token, inheritedFrom }
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

// ─── M3 override-engine (KAI-9306) ──────────────────────────────────────────
// Instant preview staging: ONE <style> element in the canvas doc, one rule per
// element (runtime data-eng-id address). Every declaration carries !important —
// the staging layer must beat any specificity incl. inline (plan §3 M3).
// Zero disk writes by construction; HMR doc swap drops the sheet (build truth
// wins) while the ledger persists parent-side for dirty re-report.

export type OverrideOp = { domId: string; prop: string; value: string; original: string; stale?: boolean }

const OV_STYLE_ID = 'engine-overrides'

export class Overrides {
  private doc: Document | null = null
  private map = new Map<string, Map<string, OverrideOp>>() // domId → prop → op

  attach(doc: Document): void {
    this.doc = doc
    // fresh doc after HMR/reload: overrides are NOT re-applied (truth wins);
    // surviving ledger entries become stale until discarded or re-edited.
    if (this.map.size) for (const props of this.map.values()) for (const op of props.values()) op.stale = true
    this.render()
  }

  set(domId: string, prop: string, value: string, original: string): void {
    let props = this.map.get(domId)
    if (!props) { props = new Map(); this.map.set(domId, props) }
    const existing = props.get(prop)
    // keep the FIRST original (true pre-edit value), refresh the value
    props.set(prop, { domId, prop, value, original: existing?.original ?? original, stale: false })
    this.render()
  }

  discard(domId: string, prop?: string): void {
    if (prop) { this.map.get(domId)?.delete(prop); if (this.map.get(domId)?.size === 0) this.map.delete(domId) }
    else this.map.delete(domId)
    this.render()
  }

  clear(): void { this.map.clear(); this.render() }

  dirty(): OverrideOp[] {
    const out: OverrideOp[] = []
    for (const props of this.map.values()) out.push(...props.values())
    return out
  }

  private render(): void {
    const doc = this.doc
    if (!doc) return
    let el = doc.getElementById(OV_STYLE_ID) as HTMLStyleElement | null
    if (!el) { el = doc.createElement('style'); el.id = OV_STYLE_ID; doc.head.appendChild(el) }
    let css = ''
    for (const [domId, props] of this.map) {
      const decls = [...props.values()].filter((op) => !op.stale)
        .map((op) => `${op.prop}: ${op.value} !important;`).join(' ')
      if (decls) css += `[data-eng-id="${domId}"] { ${decls} }\n`
    }
    el.textContent = css
  }
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
