/**
 * react-figma engine · M2 read-bridge (KAI-9305) — client-side read path.
 *
 * Layer-tree walker + style reader over the same-origin canvas document.
 * Contracts: ENGINE-PLAN.md §4 — this is the client half of StyleReport
 * (computed truth + defined text with var() PRESERVED + inherited-owner
 * fill-ins). DeclRef resolution (postcss byte ranges) is server-side and
 * lands with the write engine (E1.4) that consumes it.
 */

export type LiveNode = { id: string; tag: string; name: string; depth: number; kids: boolean; srcFile?: string; parentId?: string }
export type DefEntry = { value: string; token?: string; inheritedFrom?: { tag: string; name: string } }
export type StyleReport = { computed: Record<string, string>; defined: Record<string, DefEntry> }

/** CSS-inheritable subset the panel surfaces (plan §5 — enumerated, not guessed). */
const INHERITABLE = [
  'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
  'letter-spacing', 'text-align', 'text-transform', 'visibility', 'cursor',
] as const

/** Computed props the panel sections read (Position / Auto layout / Appearance / Fill / Stroke / Effects). */
const PROPS = [
  'width', 'height', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'gap', 'row-gap', 'column-gap', 'display', 'flex-direction', 'flex-wrap', 'flex-grow',
  'align-items', 'justify-content', 'opacity', 'border-radius', 'mix-blend-mode',
  'background-color', 'color', 'font-family', 'font-size', 'font-weight', 'line-height',
  'position', 'top', 'left', 'z-index', 'overflow',
  'box-shadow', 'backdrop-filter', 'filter',
  'border-top-width', 'border-top-color', 'border-top-style',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius',
]

/** Split on a separator at paren depth 0 (shadow lists, font stacks…). */
export function splitTopLevel(value: string, sep: string): string[] {
  const out: string[] = []
  let depth = 0, cur = ''
  for (const ch of value) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (ch === sep && depth === 0) { out.push(cur.trim()); cur = '' } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

export type ShadowParams = { x: number; y: number; blur: number; spread: number; color: string; inset: boolean }

/** Parse one box-shadow → params (color may lead or trail). */
export function parseShadow(value: string): ShadowParams {
  const inset = /\binset\b/.test(value)
  let s = value.replace(/\binset\b/, '').trim()
  const colorM = s.match(/(rgba?\([^)]*\)|#[0-9a-f]{3,8})/i)
  const color = colorM ? colorM[0].trim() : 'rgba(0,0,0,0.25)'
  s = s.replace(color, '').trim()
  const nums = (s.match(/-?\d+(\.\d+)?px/g) ?? []).map((n) => parseFloat(n))
  return { x: nums[0] ?? 0, y: nums[1] ?? 0, blur: nums[2] ?? 0, spread: nums[3] ?? 0, color, inset }
}
export function formatShadow(p: ShadowParams): string {
  return `${p.inset ? 'inset ' : ''}${p.x}px ${p.y}px ${p.blur}px ${p.spread}px ${p.color}`
}

/** Effects rows from computed shadow/filter values (Figma vocabulary). */
export function parseEffects(c: Record<string, string>): { type: string; detail: string }[] {
  const out: { type: string; detail: string }[] = []
  if (c['box-shadow'] && c['box-shadow'] !== 'none') {
    for (const part of splitTopLevel(c['box-shadow'], ',')) {
      out.push({ type: part.includes('inset') ? 'Inner shadow' : 'Drop shadow', detail: part })
    }
  }
  if (c['backdrop-filter'] && c['backdrop-filter'] !== 'none') out.push({ type: 'Background blur', detail: c['backdrop-filter'] })
  if (c['filter'] && c['filter'] !== 'none' && c['filter'].includes('blur')) out.push({ type: 'Layer blur', detail: c['filter'] })
  return out
}

/** AlignGrid 3×3 row-major index ↔ (align-items, justify-content).
   The grid always reads visually — row = vertical position, col = horizontal position (Figma).
   In flexbox the axes that map to those depend on direction: row-flow puts the main axis
   (justify) horizontal + cross axis (align) vertical; column-flow swaps them. So the mapping
   is direction-aware — otherwise a column auto-layout transposes (top-row controls horizontal). */
const AXIS = ['flex-start', 'center', 'flex-end'] as const
export function alignToIndex(c: Record<string, string>, column = false): number {
  const norm = (v: string, dflt: number) => v.includes('start') ? 0 : v.includes('center') ? 1 : v.includes('end') ? 2 : dflt
  const ai = norm(c['align-items'] ?? '', 0)
  const jc = norm(c['justify-content'] ?? '', 0) // space-* families read as packed-start (v1 note)
  const row = column ? jc : ai // vertical visual = main(justify) in column, cross(align) in row
  const col = column ? ai : jc // horizontal visual = cross(align) in column, main(justify) in row
  return row * 3 + col
}
export function alignFromIndex(i: number, column = false): { alignItems: string; justifyContent: string } {
  const rowV = AXIS[Math.floor(i / 3)] ?? 'flex-start' // vertical visual intent
  const colV = AXIS[i % 3] ?? 'flex-start' // horizontal visual intent
  return column
    ? { alignItems: colV, justifyContent: rowV } // column-flow: cross=horizontal, main=vertical
    : { alignItems: rowV, justifyContent: colV } // row-flow: cross=vertical, main=horizontal
}

/** Aggregate unique colors used across the selected element's tagged subtree (Selection colors). */
/* 3.6 (Dan, spec measured from Figma 2026-07-08): selection colours = colours the selection
 * VISIBLY OWNS — not every inherited text colour / zero-width border across the subtree (the old
 * over-collection showed colours "not in the dial button"). Each entry carries the source element
 * ids (Figma's target-◎ "Select N using this color") and the bound variable when one declares it. */
export type SelectionColor = { hex: string; op: number; count: number; ids: string[]; varName?: string; props: string[] }
export function collectSelectionColors(el: HTMLElement, doc: Document, max = 24): SelectionColor[] {
  const byKey = new Map<string, SelectionColor>()
  const consider = (n: HTMLElement, prop: string, val: string) => {
    const p = colorToHex(val, doc)
    if (!p) return
    const key = `${p.hex}/${p.op}`
    let e = byKey.get(key)
    if (!e) { e = { hex: p.hex, op: p.op, count: 0, ids: [], props: [] }; byKey.set(key, e) }
    e.count++
    const id = ensureId(n)
    if (e.ids.length < 40 && !e.ids.includes(id)) e.ids.push(id)
    if (!e.props.includes(prop)) e.props.push(prop)
  }
  const nodes: HTMLElement[] = [el, ...(Array.from(el.querySelectorAll('[data-src]')) as HTMLElement[])]
  for (const n of nodes.slice(0, 120)) {
    const cs = doc.defaultView!.getComputedStyle(n)
    const r = n.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) continue // invisible boxes own nothing
    const bg = cs.getPropertyValue('background-color')
    if (bg && !/^rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/.test(bg.replace(/\s+/g, ' '))) consider(n, 'background-color', bg)
    // text colour counts only where the element actually RENDERS text (direct text node) —
    // inherited `color` on wrappers was the "colours not in the component" bug.
    const hasText = Array.from(n.childNodes).some((c) => c.nodeType === 3 && (c.textContent ?? '').trim())
    if (hasText) consider(n, 'color', cs.getPropertyValue('color'))
    if (parseFloat(cs.getPropertyValue('border-top-width')) > 0 && cs.getPropertyValue('border-top-style') !== 'none') consider(n, 'border-color', cs.getPropertyValue('border-top-color'))
    if (byKey.size >= max * 2) break
  }
  const out = [...byKey.values()].slice(0, max)
  // second pass: resolve a declared var() binding per colour (first source element only — cheap)
  for (const e of out) {
    const first = e.ids[0] ? engineElement(doc, e.ids[0]) : null
    if (!first) continue
    try {
      const rep = readStyles(first)
      for (const prop of e.props) {
        const tok = rep.defined[prop]?.token ?? (prop === 'border-color' ? rep.defined['border-top-color']?.token : undefined)
        if (tok) { e.varName = tok; break }
      }
    } catch { /* declared-style read is best-effort */ }
  }
  return out
}

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'TEMPLATE', 'NEXT-ROUTE-ANNOUNCER', 'NEXTJS-PORTAL'])

/** Shorthands whose var() text is invisible to CSSOM longhand iteration (probed directly). */
const SHORTHANDS = ['gap', 'padding', 'margin', 'border-radius', 'background', 'border', 'inset', 'font', 'flex']

let seq = 0
const runtimeIds = new WeakMap<HTMLElement, string>()
const runtimeElements = new WeakMap<Document, Map<string, WeakRef<HTMLElement>>>()

/** Runtime element address for layers↔canvas sync — kept outside SSR DOM until an override needs CSS. */
export function ensureId(el: HTMLElement): string {
  let id = el.getAttribute('data-eng-id') ?? runtimeIds.get(el)
  if (!id) id = `e${++seq}`
  runtimeIds.set(el, id)
  let elements = runtimeElements.get(el.ownerDocument)
  if (!elements) { elements = new Map(); runtimeElements.set(el.ownerDocument, elements) }
  elements.set(id, new WeakRef(el))
  return id
}

export function engineElement(doc: Document, id: string): HTMLElement | null {
  const attributed = doc.querySelector(`[data-eng-id="${id}"]`) as HTMLElement | null
  if (attributed) return attributed
  const elements = runtimeElements.get(doc)
  const runtime = elements?.get(id)?.deref()
  if (!runtime?.isConnected) {
    elements?.delete(id)
    return null
  }
  return runtime
}

/** Dev css-module class `file_local__hash` → `local`; '' when none.
 *  ⚠ COUPLED to Next's dev getCssModuleLocalIdent format (file_local__hash) —
 *  a css-loader localIdentName config change silently breaks layer labels
 *  (and the resolver's `_local__` matching in api/dev/editor/lib.ts). */
function localName(el: HTMLElement): string {
  for (const c of Array.from(el.classList)) {
    const m = c.match(/^[a-zA-Z0-9$-]+?_(.+?)__[a-zA-Z0-9_-]+$/)
    if (m?.[1]) return m[1]
  }
  return ''
}

function layerLabel(el: HTMLElement): string {
  // E6.8 — explicit layer name first (data-name, written by the rename op; the HTML-conventional
  // metadata slot), then CSS-module class, then tag.
  return el.getAttribute('data-name') || localName(el) || el.tagName.toLowerCase()
}

/** Flatten the canvas DOM into layer rows — data-src-tagged elements only; untagged wrappers pass through. */
export function buildLayerTree(doc: Document): LiveNode[] {
  const out: LiveNode[] = []
  const walk = (parent: Element, depth: number, parentId?: string) => {
    for (const child of Array.from(parent.children)) {
      if (SKIP_TAGS.has(child.tagName) || child.namespaceURI?.endsWith('/svg')) continue
      const el = child as HTMLElement
      const src = el.getAttribute('data-src')
      if (src) {
        const id = ensureId(el)
        out.push({
          id, tag: el.tagName.toLowerCase(), name: layerLabel(el),
          depth, kids: el.children.length > 0, srcFile: src.split(':')[0], parentId,
        })
        walk(el, depth + 1, id)
      } else {
        walk(el, depth, parentId) // untagged wrapper (3rd-party / portal) — children stay reachable
      }
    }
  }
  walk(doc.body, 0)
  return out
}

export const tokenOf = (value: string): string | undefined => value.match(/var\(\s*(--[a-zA-Z0-9-]+)/)?.[1]

/** Split a shorthand value into top-level slots — var()/calc() parens respected. */
function splitSlots(value: string): string[] {
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
 * Slot-preserving shorthand edit (plan §5): expand minimally (1→2→4), set the
 * edited side, re-minimize by TEXT equality — untouched slots keep their
 * original text verbatim (a var() slot is never converted to px).
 */
export function editSlot(shorthandProp: string, slots: string[], longhand: string, newVal: string): string[] {
  if (shorthandProp === 'gap') {
    const row = slots[0] ?? '0', col = slots[1] ?? slots[0] ?? '0'
    const next: [string, string] = longhand === 'row-gap' ? [newVal, col] : [row, newVal]
    return next[0] === next[1] ? [next[0]] : [next[0], next[1]]
  }
  const [a, b, c, d] = slots
  const four: string[] =
    slots.length === 1 ? [a!, a!, a!, a!]
    : slots.length === 2 ? [a!, b!, a!, b!]
    : slots.length === 3 ? [a!, b!, c!, b!]
    : [a!, b!, c!, d!]
  const SIDE: Record<string, number> = {
    'padding-top': 0, 'margin-top': 0, 'padding-right': 1, 'margin-right': 1,
    'padding-bottom': 2, 'margin-bottom': 2, 'padding-left': 3, 'margin-left': 3,
  }
  const idx = SIDE[longhand]
  if (idx === undefined) return slots
  four[idx] = newVal
  const [T, R, B, L] = four as [string, string, string, string]
  if (T === R && R === B && B === L) return [T]
  if (T === B && R === L) return [T, R]
  if (R === L) return [T, R, B]
  return [T, R, B, L]
}

/**
 * Selector specificity for provenance owner-resolution (a·1e6 + b·1e3 + c).
 * Spec-correct for functional pseudo-classes (s58-expert review finding 1):
 * `:where(…)` contributes 0; `:not(…)`/`:is(…)`/`:has(…)` contribute the
 * specificity of their MOST-specific argument (resolved recursively).
 * For grouped selectors the caller passes the single matching part.
 */
function specificity(sel: string): number {
  let total = 0
  // pseudo-ELEMENTS count as type (c) — take them out before scanning
  let s = sel.replace(/::[\w-]+/g, () => { total += 1; return ' ' })
  let rest = ''
  for (let i = 0; i < s.length; i++) {
    const m = /^:(not|is|has|where)\(/i.exec(s.slice(i))
    if (m) {
      let depth = 0, j = i + m[0].length - 1 // at '('
      for (; j < s.length; j++) {
        if (s[j] === '(') depth++
        else if (s[j] === ')') { depth--; if (depth === 0) break }
      }
      if (m[1]!.toLowerCase() !== 'where') {
        const inner = s.slice(i + m[0].length, j)
        total += Math.max(0, ...inner.split(',').map((x) => specificity(x.trim())))
      }
      i = j
      continue
    }
    rest += s[i]
  }
  total += (rest.match(/#[\w-]+/g) ?? []).length * 1e6
  total += ((rest.match(/(\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+)/g) ?? []).length) * 1e3
  total += (rest.match(/(^|[\s>+~(])[a-zA-Z][\w-]*/g) ?? []).length
  return total
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
      if (decls) {
        engineElement(doc, domId)?.setAttribute('data-eng-id', domId)
        css += `[data-eng-id="${domId}"] { ${decls} }\n`
      }
    }
    el.textContent = css
  }
}

/** #RRGGBB + opacity% → rgb()/rgba() (paint-opacity edits: alpha lives on the color, not the element). */
export function hexToRgba(hex: string, opPct: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  const a = Math.max(0, Math.min(100, opPct)) / 100
  return a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${+a.toFixed(3)})`
}

let _ctx: CanvasRenderingContext2D | null = null
/** Any CSS color (rgb/oklch/color()/named) → {hex, op%}; null for transparent/none. */
export function colorToHex(c: string, doc: Document): { hex: string; op: number } | null {
  if (!c || c === 'transparent' || c === 'none') return null
  _ctx ??= doc.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!_ctx) return null
  _ctx.fillStyle = '#000000'
  try { _ctx.fillStyle = c } catch { return null }
  const s = _ctx.fillStyle as string // normalized '#rrggbb' | 'rgba(r, g, b, a)' | 'color(...)' | 'oklch(...)'
  if (s.startsWith('#')) return { hex: s.slice(1).toUpperCase(), op: 100 }
  const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (m) {
    const a = m[4] !== undefined ? parseFloat(m[4]) : 1
    if (a === 0) return null
    const hex = [m[1], m[2], m[3]].map((n) => (+n!).toString(16).padStart(2, '0').toUpperCase()).join('')
    return { hex, op: Math.round(a * 100) }
  }
  // Modern color spaces (oklch / color() / lab / …) — the DS tokens use these, and the canvas
  // serializes them to color(srgb …) rather than rgba, so parsing the string fails. Render the
  // colour and read the pixel back — resolves any format the browser can paint.
  try {
    _ctx.clearRect(0, 0, 1, 1)
    _ctx.fillRect(0, 0, 1, 1)
    const p = _ctx.getImageData(0, 0, 1, 1).data
    if (p[3] === 0) return null
    const hex = [p[0]!, p[1]!, p[2]!].map((n) => n.toString(16).padStart(2, '0').toUpperCase()).join('')
    return { hex, op: Math.round((p[3]! / 255) * 100) }
  } catch { return null }
}
