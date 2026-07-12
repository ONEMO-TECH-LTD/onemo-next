/**
 * react-figma engine · E1.4 write-engine server lib (KAI-9307).
 *
 * ONE postcss authority (ENGINE-PLAN.md §4): resolves an element's writable
 * declarations to byte-exact DeclRefs, and splices committed edits back into
 * the owning *.module.css. Surgical by construction — the write path can only
 * replace a verified byte range or insert one declaration line; it never
 * reformats, reorders, or regenerates a file.
 *
 * Dev-only: both routes hard-gate on NODE_ENV. Write jail: *.module.css under
 * src/ of THIS worktree (+ the SSOT token JSON via EDITOR_SSOT_WORKTREE for
 * set-token-value).
 */
import { execFile } from 'node:child_process'
import { promises as fs, realpathSync } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import postcss, { type Declaration, type Rule, type AtRule } from 'postcss'
import * as ts from 'typescript'

const execFileP = promisify(execFile)

const ROOT = process.cwd()

// ─── contracts (plan §4) ─────────────────────────────────────────────────────

export type DeclRef = {
  file: string            // repo-relative *.module.css
  localClass: string
  selector: string
  atContext: string[]
  ruleIndex: number
  prop: string
  valueRange: { start: number; end: number }  // FILE BYTE offsets of the value text
  valueText: string
  important: boolean
}

export type ResolvedProp = {
  prop: string                              // requested (longhand) prop
  decl?: DeclRef                            // owning declaration (may be a shorthand)
  shorthand?: { slots: string[]; slotIndex: number } // set when decl.prop is a shorthand
}

export type ResolveResult = {
  props: Record<string, ResolvedProp>
  /** insertion target for add-declaration: the element's own first plain rule */
  fallbackRule?: { file: string; localClass: string; selector: string; atContext: string[]; ruleIndex: number; insertOffset: number; indent: string }
}

// ─── jail ────────────────────────────────────────────────────────────────────

/* E7.2 (KAI-9376, lead F1/N1): THE central editor path resolver. Every jail dispatches through
 * it — repo-relative paths resolve against ROOT; package-prefixed paths (the stable identity
 * the tagging-loader emits for global-library files, "onemo-component-library/src/…") resolve
 * against the library's realpath. Never a hardcoded relative depth (checkout-independent). */
export const LIB_NAME = 'onemo-component-library'
export const LIB_ROOT: string | null = (() => {
  // pure-fs locate mirroring node's upward node_modules walk (F7: hoisting-robust — a dep
  // hoisted above ROOT still resolves, matching the loader's require.resolve semantics).
  // No module machinery — webpack rewrites require.resolve in bundled server code, which
  // silently broke the createRequire variant.
  let dir = ROOT
  for (let i = 0; i < 10; i++) {
    try { return realpathSync(path.join(dir, 'node_modules', LIB_NAME)) } catch { /* keep walking up */ }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null // library not installed — editor works, library paths 403
})()

export function resolveEditorPath(rel: string): string {
  // F8 (lead N1): traversal rejection lives IN the resolver — every caller inherits it.
  if (rel.split(/[\\/]/).includes('..')) {
    throw Object.assign(new Error(`path traversal rejected: ${rel}`), { status: 403 })
  }
  if (rel === LIB_NAME || rel.startsWith(LIB_NAME + '/')) {
    if (!LIB_ROOT) throw Object.assign(new Error('component library not installed'), { status: 403 })
    return path.resolve(LIB_ROOT, rel.slice(LIB_NAME.length + 1))
  }
  return path.resolve(ROOT, rel)
}

/* Allowed roots per surface — the library's editable surface is its src/ only. */
const LIB_SRC = LIB_ROOT ? path.join(LIB_ROOT, 'src') : null
const CSS_ROOTS = [path.join(ROOT, 'src'), ...(LIB_SRC ? [LIB_SRC] : [])]
// component jail = src/ (routes) + storybook/ (hosted canvas screens) + global library src
const COMPONENT_ROOTS = [path.join(ROOT, 'src'), path.join(ROOT, 'storybook'), ...(LIB_SRC ? [LIB_SRC] : [])]

export function jailModuleCss(rel: string): string {
  const abs = resolveEditorPath(rel)
  if (!CSS_ROOTS.some((r) => abs.startsWith(r + path.sep)) || !abs.endsWith('.module.css')) {
    throw Object.assign(new Error(`outside write jail: ${rel}`), { status: 403 })
  }
  return abs
}

export function jailComponent(rel: string): string {
  const abs = resolveEditorPath(rel)
  if (!COMPONENT_ROOTS.some((r) => abs.startsWith(r + path.sep)) || !/\.(tsx|ts)$/.test(abs)) {
    throw Object.assign(new Error(`outside read jail: ${rel}`), { status: 403 })
  }
  return abs
}

/** WRITE jail for JSX ops (F3, s58-lead): .tsx ONLY — never .ts (no JSX to write there anyway,
 *  and it keeps non-component sources like lib.ts unwritable even though they pass the read jail). */
function jailComponentWrite(rel: string): string {
  const abs = resolveEditorPath(rel)
  if (!COMPONENT_ROOTS.some((r) => abs.startsWith(r + path.sep)) || !abs.endsWith('.tsx')) {
    throw Object.assign(new Error(`outside JSX write jail (.tsx only): ${rel}`), { status: 403 })
  }
  return abs
}

// ─── shorthand slot logic (mirrors client engine.ts, server-side authority) ──

const BOX_SIDE_TO_INDEX: Record<string, (n: number) => number> = {
  // slot index for a side given the slot count (CSS box shorthand semantics)
  top: (n) => 0,
  right: (n) => (n === 1 ? 0 : 1),
  bottom: (n) => (n <= 2 ? 0 : 2),
  left: (n) => (n === 1 ? 0 : n === 4 ? 3 : 1),
}

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

/** Which shorthand covers a longhand, and the slot for it given the ACTUAL slot count. */
const LONGHAND_OWNER: Record<string, { shorthand: string; slot: (slots: string[]) => number }> = {
  'padding-top': { shorthand: 'padding', slot: (s) => BOX_SIDE_TO_INDEX.top(s.length) },
  'padding-right': { shorthand: 'padding', slot: (s) => BOX_SIDE_TO_INDEX.right(s.length) },
  'padding-bottom': { shorthand: 'padding', slot: (s) => BOX_SIDE_TO_INDEX.bottom(s.length) },
  'padding-left': { shorthand: 'padding', slot: (s) => BOX_SIDE_TO_INDEX.left(s.length) },
  'margin-top': { shorthand: 'margin', slot: (s) => BOX_SIDE_TO_INDEX.top(s.length) },
  'margin-right': { shorthand: 'margin', slot: (s) => BOX_SIDE_TO_INDEX.right(s.length) },
  'margin-bottom': { shorthand: 'margin', slot: (s) => BOX_SIDE_TO_INDEX.bottom(s.length) },
  'margin-left': { shorthand: 'margin', slot: (s) => BOX_SIDE_TO_INDEX.left(s.length) },
  'row-gap': { shorthand: 'gap', slot: () => 0 },
  'column-gap': { shorthand: 'gap', slot: (s) => (s.length >= 2 ? 1 : 0) },
}

// ─── resolve ─────────────────────────────────────────────────────────────────

const byteLen = (s: string) => Buffer.byteLength(s, 'utf8')

function atChain(node: Rule): string[] {
  const out: string[] = []
  let p = node.parent
  while (p && p.type === 'atrule') { out.unshift(`@${(p as AtRule).name} ${(p as AtRule).params}`); p = p.parent }
  return out
}

export async function resolveDeclRefs(componentFile: string, hashedClasses: string[], props: string[]): Promise<ResolveResult> {
  const compAbs = jailComponent(componentFile)
  const compSrc = await fs.readFile(compAbs, 'utf8')
  const cssRels: string[] = []
  for (const m of compSrc.matchAll(/import\s+\w+\s+from\s+['"]([^'"]+\.module\.css)['"]/g)) {
    cssRels.push(path.relative(ROOT, path.resolve(path.dirname(compAbs), m[1]!)))
  }

  type Cand = { ref: DeclRef; order: number }
  const best: Record<string, Cand> = {}
  let order = 0
  let fallbackRule: ResolveResult['fallbackRule']

  for (const cssRel of cssRels) {
    const cssAbs = jailModuleCss(cssRel)
    const source = await fs.readFile(cssAbs, 'utf8')
    const root = postcss.parse(source, { from: cssAbs })

    // locals present in this file
    const locals = new Set<string>()
    root.walkRules((r) => { for (const m of r.selector.matchAll(/\.([A-Za-z0-9_-]+)/g)) locals.add(m[1]!) })
    const matched = [...locals].filter((local) => hashedClasses.some((h) => h.includes(`_${local}__`)))
    if (matched.length === 0) continue

    const ruleCounter = new Map<string, number>()
    root.walkRules((rule) => {
      const at = atChain(rule)
      const key = at.join('|') + '::' + rule.selector
      const ruleIndex = ruleCounter.get(key) ?? 0
      ruleCounter.set(key, ruleIndex + 1)

      // plain own-class rule only (no pseudo/descendant beyond the class itself)
      const parts = rule.selector.split(',').map((s) => s.trim())
      const owning = matched.find((local) => parts.includes(`.${local}`))
      if (!owning) return
      order++

      // fallback insertion target = first plain rule of the first matched local (top-level preferred)
      if (!fallbackRule && at.length === 0) {
        const last = rule.last as Declaration | undefined
        const end = last?.source?.end?.offset
        if (typeof end === 'number') {
          const lineStart = source.lastIndexOf('\n', (last!.source!.start!.offset as number)) + 1
          const indent = source.slice(lineStart).match(/^[ \t]*/)?.[0] ?? '  '
          // insert AFTER the last declaration's terminating semicolon if present
          const after = source[end] === ';' ? end + 1 : end
          fallbackRule = { file: cssRel, localClass: owning, selector: rule.selector, atContext: at, ruleIndex, insertOffset: byteLen(source.slice(0, after)), indent }
        }
      }

      rule.walkDecls((decl) => {
        const declProp = decl.prop.toLowerCase()
        const startOff = decl.source?.start?.offset
        if (typeof startOff !== 'number') return
        const valueCharStart = startOff + decl.prop.length + (decl.raws.between ?? ': ').length
        const valueText = source.slice(valueCharStart, valueCharStart + decl.value.length)
        if (valueText !== decl.value) return // raws mismatch — refuse rather than guess
        const ref: DeclRef = {
          file: cssRel, localClass: owning, selector: rule.selector, atContext: at, ruleIndex,
          prop: declProp,
          valueRange: { start: byteLen(source.slice(0, valueCharStart)), end: byteLen(source.slice(0, valueCharStart + decl.value.length)) },
          valueText, important: !!decl.important,
        }
        for (const wanted of props) {
          const ownerInfo = LONGHAND_OWNER[wanted]
          const covers = declProp === wanted || (ownerInfo && declProp === ownerInfo.shorthand)
          if (!covers) continue
          const prev = best[wanted]
          // later in cascade wins; exact longhand beats shorthand at equal order progression
          if (!prev || order >= prev.order) best[wanted] = { ref, order }
        }
      })
    })
  }

  const out: ResolveResult = { props: {}, fallbackRule }
  for (const wanted of props) {
    const cand = best[wanted]
    if (!cand) { out.props[wanted] = { prop: wanted }; continue }
    const resolved: ResolvedProp = { prop: wanted, decl: cand.ref }
    const ownerInfo = LONGHAND_OWNER[wanted]
    if (ownerInfo && cand.ref.prop === ownerInfo.shorthand) {
      const slots = splitSlots(cand.ref.valueText)
      resolved.shorthand = { slots, slotIndex: ownerInfo.slot(slots) }
    }
    out.props[wanted] = resolved
  }
  return out
}

// ─── write ───────────────────────────────────────────────────────────────────

// I0 (blueprint §3.2): which rule a scoped write targets — base / a config variant / an interaction
// pseudo-state / a semantic prop-driven state class.
export type ScopedTarget =
  | { kind: 'base' }
  | { kind: 'state'; pseudo: 'hover' | 'active' | 'focus-visible' | 'disabled' }
  | { kind: 'state'; propClass: 'loading' | 'error' | 'disabled' }
  // I2/D2 (blueprint §3.2): the COMPOSITE target — 0..N config-axis selectors + 0..N semantic states +
  // 0..1 interaction pseudo, combined into ONE deterministic selector. Single-axis is just N=1.
  | { kind: 'composite'; axisValues?: { axis: string; value: string }[]; pseudo?: 'hover' | 'active' | 'focus-visible' | 'disabled'; semantic?: ('loading' | 'error' | 'disabled')[] }

export type WriteOp =
  | { kind: 'set-declaration'; decl: DeclRef; newValueText: string }
  | { kind: 'set-shorthand-slots'; decl: DeclRef; slots: string[] }
  | { kind: 'bind-token'; decl: DeclRef; token: string }
  | { kind: 'add-declaration'; file: string; insertOffset: number; indent: string; prop: string; valueText: string }
  | { kind: 'add-state-rule'; file: string; localClass: string; state: 'hover' | 'active'; decls: [string, string][] } // E8 item 9: Framer hover/tap → real CSS pseudo-state rules
  | { kind: 'promote-element'; file: string; line: number; col: number } // I0: lift inline style → .module.css class (blueprint §2)
  | { kind: 'write-scoped-declaration'; file: string; localClass: string; scope: ScopedTarget; prop: string; value: string } // I0: 4-scope CSS write (blueprint §3.2)
  | { kind: 'add-state'; file: string; state: 'hover' | 'pressed' | 'focus' | 'disabled' | 'loading' | 'error' } // I1: make a state authorable (blueprint §3.5)
  | { kind: 'add-variant-axis'; file: string; axis: string; values: string[]; defaultValue: string } // I2: a new config axis (blueprint §3.3a)
  | { kind: 'add-variant-value'; file: string; axis: string; value: string } // I2: extend an axis's union (blueprint §3.3b)
  | { kind: 'expose-as-prop'; file: string; propName: string; target?: 'text' | 'attr' | 'inline-style' | 'module-css'; line?: number; col?: number; attrName?: string; cssProp?: string; controlType?: string } // I3: fixed value → editable prop, routed BY TARGET LOCATION (blueprint §5): text/attr/inline-style = literal-swap; module-css = custom-property bridge
  | { kind: 'set-instance-prop'; file: string; line: number; col: number; propName: string; value: string } // I3: set a string prop on a component instance (blueprint §5)
  | { kind: 'set-connector'; file: string; mode: 'state' | 'switch'; trigger: 'hover' | 'pressed' | 'focus' | 'tap'; to: { state?: 'hover' | 'pressed' | 'focus' | 'disabled' | 'loading' | 'error'; axis?: string; value?: string }; transition?: { kind: 'spring'; stiffness: number; damping: number; mass: number } | { kind: 'tween'; duration: number; ease?: string }; cycle?: boolean } // I4: connectors (blueprint §3.6) — 'state'=base transition (spring→linear()) + @fc-transition side-channel; 'switch'=D3 controllable useState + onClick + @fc-connector side-channel (D4 read source-of-truth)
  | { kind: 'remove-connector'; file: string; mode: 'state' | 'switch'; to: { axis?: string } } // I7 node-system: delete a connector wire — reverse of set-connector (both modes); closes the F-M10 re-point gap
  | { kind: 'set-variant-structure'; file: string; axisValue: { axis: string; value: string }; edit:
      | { op: 'add'; anchor: { line: number; col: number }; position: 'before' | 'after' | 'firstChild' | 'lastChild'; jsx: string }
      | { op: 'remove'; target: { line: number; col: number } }
      | { op: 'swap'; target: { line: number; col: number }; jsx: string } } // I6: STRUCTURAL variants (blueprint §3.9) — per-axis-value LAYER divergence → FLAT conditional JSX (one guard per subtree, keyed on the bare axis prop, never nested); add/remove/swap addressed by source {line,col} via findJsxAt; different-axis-guard nesting + deep-reparenting walled with named 422s
  | { kind: 'set-token-value'; tokenPath: string; theme?: string; value: string | number }
  | { kind: 'set-jsx-style'; file: string; line: number; col: number; prop: string; value: string; expectRaw?: string }
  | { kind: 'set-jsx-text'; file: string; line: number; col: number; newText: string; expectRaw?: string }
  | { kind: 'insert-jsx-child'; file: string; line: number; col: number; snippet: string }
  | { kind: 'create-page'; slugBase?: string; width?: number; height?: number }
  | { kind: 'make-component'; file: string; line: number; col: number; name?: string }
  | { kind: 'delete-jsx'; file: string; line: number; col: number }
  | { kind: 'duplicate-jsx'; file: string; line: number; col: number }
  | { kind: 'insert-component'; file: string; line: number; col: number; name: string; importPath: string }
  | { kind: 'create-component'; name: string; category?: string; root?: 'project' | 'global' }
  | { kind: 'delete-page'; route: string }
  | { kind: 'duplicate-page'; route: string }
  | { kind: 'rename-page'; route: string; newSlug: string }
  | { kind: 'set-layer-name'; file: string; line: number; col: number; name: string }
  | { kind: 'rename-component'; name: string; newName: string }
  | { kind: 'wrap-jsx-link'; file: string; line: number; col: number; href: string; newTab?: boolean }

// ─── JSX inline-style write (E2.4, ENGINE-PLAN-E2.4.md) ──────────────────────

const cssToJsKey = (p: string) => p.replace(/-([a-z])/g, (_, c) => c.toUpperCase())

/** Find the JSX opening element whose 1-based start line/col matches the tag (data-src position). */
/**
 * F1 (s58-lead HIGH): structural ops (insert/delete/duplicate/make-component) splice raw text and
 * must not write invalid code. Re-parse the OUTPUT; if it has any parse diagnostics, refuse (422)
 * without writing — e.g. duplicate on a sole-return → adjacent JSX, delete of a returned root →
 * empty return(). The style/CSS ops are literal-guarded already; this covers the text-splice ops.
 */
function assertValidTsx(fileName: string, source: string): void {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
  const diags = (sf as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? []
  if (diags.length) {
    throw Object.assign(new Error(`refused — the edit would produce invalid code (${diags.length} parse error${diags.length > 1 ? 's' : ''}); select a different target`), { status: 422 })
  }
}

function findJsxAt(sf: ts.SourceFile, line: number, col: number): ts.JsxOpeningElement | ts.JsxSelfClosingElement | null {
  let found: ts.JsxOpeningElement | ts.JsxSelfClosingElement | null = null
  const visit = (node: ts.Node) => {
    if (found) return
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const lc = sf.getLineAndCharacterOfPosition(node.getStart(sf))
      if (lc.line + 1 === line && lc.character + 1 === col) { found = node; return }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

async function setJsxStyle(op: Extract<WriteOp, { kind: 'set-jsx-style' }>): Promise<{ ok: true; file: string; newValueText: string }> {
  const abs = jailComponentWrite(op.file) // F3: .tsx-only write jail
  // F2/F5 (s58-lead): ONE read — parse AND splice the SAME buffer (no TOCTOU re-read window).
  const buf = await fs.readFile(abs)
  const source = buf.toString('utf8')
  const sf = ts.createSourceFile(abs, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
  const el = findJsxAt(sf, op.line, op.col)
  if (!el) throw Object.assign(new Error(`no JSX element at ${op.line}:${op.col}`), { status: 404 })
  const styleAttr = el.attributes.properties.find(
    (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === 'style',
  )
  const init0 = styleAttr?.initializer
  if (!init0 || !ts.isJsxExpression(init0) || !init0.expression || !ts.isObjectLiteralExpression(init0.expression)) {
    throw Object.assign(new Error('element has no inline style object (attribute insertion out of v1 scope)'), { status: 422 })
  }
  const obj = init0.expression
  const key = cssToJsKey(op.prop)
  const isNumericPx = /^-?\d+(\.\d+)?px$/.test(op.value)
  const bareNum = op.value.replace(/px$/, '')

  // Shorthand alias: a color longhand should update an existing shorthand key when it holds a
  // plain color (background-color ↔ background). Prevents inserting a competing key next to it.
  // F1 (s58-lead): the value must be a WHOLE bare color — a hex or a single color-function call,
  // anchored ^…$. A gradient/url/multi-layer shorthand merely CONTAINS rgb()/hsl() and must NOT
  // match, or the alias would overwrite (destroy) the gradient. Strip wrapping quotes, then anchor.
  const isColorLiteral = (s: string) => {
    const t = s.trim().replace(/^['"]|['"]$/g, '').trim()
    return /^#[0-9a-f]{3,8}$/i.test(t) || /^(rgb|hsl|oklch|oklab|lab|lch|hwb|color)a?\([^)]*\)$/i.test(t)
  }
  const aliasKeys: Record<string, string> = { backgroundColor: 'background' }
  const nameOf = (p: ts.ObjectLiteralElementLike) => (ts.isPropertyAssignment(p) ? p.name.getText(sf).replace(/['"]/g, '') : '')
  const matches = obj.properties.filter(
    (p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && nameOf(p) === key,
  )
  if (matches.length > 1) throw Object.assign(new Error(`duplicate style key "${key}" — ambiguous (F6)`), { status: 422 })
  let existing = matches[0]
  // no direct match, but the aliased shorthand exists and currently holds a color → target it
  if (!existing && aliasKeys[key]) {
    const shorthand = obj.properties.find(
      (p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && nameOf(p) === aliasKeys[key] && isColorLiteral(p.initializer.getText(sf)),
    )
    if (shorthand) existing = shorthand
  }
  if (existing) {
    const init = existing.initializer
    // F1 (s58-lead): only replace a LITERAL initializer — never clobber a dynamic expression
    // (`{dyn}`, `T.full`, a call) which is a live binding, not a paintable value.
    if (!ts.isNumericLiteral(init) && !ts.isStringLiteral(init)) {
      throw Object.assign(new Error('style value is a dynamic expression, not a literal — refusing (would destroy a binding)'), { status: 422 })
    }
    const start = init.getStart(sf), end = init.getEnd()
    const currentRaw = source.slice(start, end)
    if (op.expectRaw !== undefined && currentRaw !== op.expectRaw) {
      throw Object.assign(new Error(`stale JSX value: expected ${JSON.stringify(op.expectRaw)}, found ${JSON.stringify(currentRaw)}`), { status: 409 })
    }
    const replacement = isNumericPx && ts.isNumericLiteral(init) ? bareNum : `'${op.value.replace(/'/g, "\\'")}'`
    const bStart = byteLen(source.slice(0, start)), bEnd = byteLen(source.slice(0, end))
    const next = Buffer.concat([buf.subarray(0, bStart), Buffer.from(replacement, 'utf8'), buf.subarray(bEnd)])
    await fs.writeFile(abs, next)
    return { ok: true, file: op.file, newValueText: replacement }
  }
  // insert `key: value,` right after the object's `{`
  const braceOffset = obj.getStart(sf) + 1
  const lineStart = source.lastIndexOf('\n', obj.getStart(sf)) + 1
  const indent = (source.slice(lineStart).match(/^[ \t]*/)?.[0] ?? '') + '  '
  const literal = isNumericPx ? bareNum : `'${op.value.replace(/'/g, "\\'")}'`
  const insert = `\n${indent}${key}: ${literal},`
  const bOff = byteLen(source.slice(0, braceOffset))
  const next = Buffer.concat([buf.subarray(0, bOff), Buffer.from(insert, 'utf8'), buf.subarray(bOff)])
  await fs.writeFile(abs, next)
  return { ok: true, file: op.file, newValueText: literal }
}

// ─── I0: component-engine substrate — style→CSS converter + promote-element ──────
// Blueprint §2.1 (F1): a NUMBER value is unitless on these props, else it gets 'px' — MIRRORING
// react-dom's own isUnitlessNumber set, so our lift equals EXACTLY what React rendered (anti-corruption
// core, not a px heuristic). Source: react-dom CSSProperty.js unitlessKeys.
const REACT_UNITLESS = new Set(['animationIterationCount', 'aspectRatio', 'borderImageOutset', 'borderImageSlice', 'borderImageWidth', 'boxFlex', 'boxFlexGroup', 'boxOrdinalGroup', 'columnCount', 'columns', 'flex', 'flexGrow', 'flexPositive', 'flexShrink', 'flexNegative', 'flexOrder', 'gridArea', 'gridRow', 'gridRowEnd', 'gridRowSpan', 'gridRowStart', 'gridColumn', 'gridColumnEnd', 'gridColumnSpan', 'gridColumnStart', 'fontWeight', 'lineClamp', 'lineHeight', 'opacity', 'order', 'orphans', 'scale', 'tabSize', 'widows', 'zIndex', 'zoom', 'fillOpacity', 'floodOpacity', 'stopOpacity', 'strokeDasharray', 'strokeDashoffset', 'strokeMiterlimit', 'strokeOpacity', 'strokeWidth'])
const camelToKebab = (k: string) => (k.startsWith('--') ? k : k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()))

/** Lift a React style-object literal → CSS declarations, mirroring React's render (blueprint §2.1).
 * Refuses (does NOT partial-write) on any non-literal member — a dynamic value can't be promoted. */
function styleObjectToCssDecls(obj: ts.ObjectLiteralExpression, sf: ts.SourceFile): { decls: [string, string][]; refusal?: string } {
  const decls: [string, string][] = []
  for (const p of obj.properties) {
    if (!ts.isPropertyAssignment(p)) return { decls, refusal: 'style object has a spread/shorthand/method member — cannot promote (v1 supports a plain literal style object)' }
    const rawKey = p.name.getText(sf).replace(/^['"]|['"]$/g, '')
    const cssKey = camelToKebab(rawKey)
    let init = p.initializer
    let neg = ''
    if (ts.isPrefixUnaryExpression(init) && init.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(init.operand)) { neg = '-'; init = init.operand }
    let val: string
    if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) val = init.text // verbatim: shorthands, var(), calc(), gradients (quote-stripped at the object boundary)
    else if (ts.isNumericLiteral(init)) val = neg + init.text + (REACT_UNITLESS.has(rawKey) ? '' : 'px')
    else return { decls, refusal: `style value for "${rawKey}" is a dynamic expression, not a literal — can't promote (would drop a live binding)` }
    decls.push([cssKey, val])
  }
  return { decls }
}

/** Is this JSX element the component's ROOT returned element? (→ localName 'base', else a generated name.) */
function isRootReturnElement(el: ts.Node): boolean {
  let n: ts.Node | undefined = el.parent
  while (n) {
    if (ts.isJsxElement(n) || ts.isJsxFragment(n)) return false // a JSX ancestor ⇒ this is a child
    if (ts.isReturnStatement(n) || ts.isArrowFunction(n) || ts.isParenthesizedExpression(n)) { n = n.parent; continue }
    if (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isSourceFile(n)) return true
    n = n.parent
  }
  return true
}

/** promote-element (blueprint §2/§2.1): lift ONE element's inline style → a class in <Name>.module.css.
 * Idempotent no-op if already promoted / converter-output (R3). Creates the module + import on first use. */
async function promoteElement(op: Extract<WriteOp, { kind: 'promote-element' }>): Promise<{ ok: true; file: string; newValueText: string; localClass: string; cssFile: string; noop?: boolean }> {
  const abs = jailComponentWrite(op.file)
  const buf = await fs.readFile(abs)
  const source = buf.toString('utf8')
  const sf = ts.createSourceFile(abs, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
  const el = findJsxAt(sf, op.line, op.col)
  if (!el) throw Object.assign(new Error(`no JSX element at ${op.line}:${op.col}`), { status: 404 })
  const attrs = el.attributes.properties
  const classAttr = attrs.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === 'className')
  const styleAttr = attrs.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === 'style')
  const hasStylesImport = sf.statements.some((s) => ts.isImportDeclaration(s) && /\.module\.css['"]$/.test(s.moduleSpecifier.getText(sf)) && s.importClause?.name?.text === 'styles')
  // R3 — idempotent no-op: already has a styles.* className + the module import (converter output / re-promote)
  const classText = classAttr?.initializer?.getText(sf) ?? ''
  const stylesClassMatch = /styles\.([A-Za-z_$][\w$]*)/.exec(classText)
  if (hasStylesImport && stylesClassMatch && !styleAttr) {
    return { ok: true, file: op.file, newValueText: stylesClassMatch[1], localClass: stylesClassMatch[1], cssFile: '', noop: true }
  }
  if (!styleAttr) throw Object.assign(new Error('element has no inline style to promote'), { status: 422 })
  const init0 = styleAttr.initializer
  if (!init0 || !ts.isJsxExpression(init0) || !init0.expression || !ts.isObjectLiteralExpression(init0.expression)) {
    throw Object.assign(new Error('style is not a plain object literal — cannot promote'), { status: 422 })
  }
  const { decls, refusal } = styleObjectToCssDecls(init0.expression, sf)
  if (refusal) throw Object.assign(new Error(refusal), { status: 422 })

  // isRootReturnElement walks from the ELEMENT node (a JsxElement's parent is the return/paren, an
  // opening element's parent is its own JsxElement) — pass the element, not the opening tag. localClass
  // must be a valid JS identifier (used as `styles.<localClass>`), so hyphen-free: root → 'base'.
  const elementNode: ts.Node = ts.isJsxSelfClosingElement(el) ? el : el.parent
  const tag = (el.tagName.getText(sf) || 'el').replace(/[^a-zA-Z0-9]/g, '')
  const localClass = isRootReturnElement(elementNode) ? 'base' : `${tag}${op.line}`
  const compName = path.basename(abs, '.tsx')
  const cssRel = op.file.replace(/[^/\\]+\.tsx$/, `${compName}.module.css`)
  const cssAbs = jailModuleCss(cssRel)

  // Build the CSS module content (create or append the rule).
  const ruleBody = decls.map(([k, v]) => `  ${k}: ${v};`).join('\n')
  const rule = `.${localClass} {\n${ruleBody}\n}\n`
  let cssNext: string
  try { const existing = (await fs.readFile(cssAbs)).toString('utf8'); cssNext = `${existing.replace(/\n*$/, '')}\n\n${rule}` }
  catch { cssNext = rule }
  await postcss.parse(cssNext, { from: cssAbs }) // parse-guard the CSS before ANY write

  // Rewrite the .tsx: remove the style attr, add className={styles.<localClass>} (merge if present), add import.
  const styleStart = byteLen(source.slice(0, styleAttr.getFullStart())), styleEnd = byteLen(source.slice(0, styleAttr.getEnd()))
  let tsx: string
  if (classAttr) {
    // merge: className={styles.x} exists → make it className={`${styles.x} ${styles.localClass}`}? keep simple: append via clsx-free template
    const ci = classAttr.initializer
    const ciStart = byteLen(source.slice(0, ci!.getStart(sf))), ciEnd = byteLen(source.slice(0, ci!.getEnd()))
    const inner = ci && ts.isJsxExpression(ci) && ci.expression ? ci.expression.getText(sf) : (ci ? ci.getText(sf).replace(/^['"]|['"]$/g, () => '') : '')
    const merged = `{[${inner || "''"}, styles.${localClass}].filter(Boolean).join(' ')}`
    // apply the higher-offset edit first (style removal) then the className (lower offset unaffected if class before style; guard by ordering)
    const edits = [{ s: styleStart, e: styleEnd, t: '' }, { s: ciStart, e: ciEnd, t: merged }].sort((a, b) => b.s - a.s)
    let b = buf
    for (const ed of edits) b = Buffer.concat([b.subarray(0, ed.s), Buffer.from(ed.t, 'utf8'), b.subarray(ed.e)])
    tsx = b.toString('utf8')
  } else {
    const repl = ` className={styles.${localClass}}`
    tsx = Buffer.concat([buf.subarray(0, styleStart), Buffer.from(repl, 'utf8'), buf.subarray(styleEnd)]).toString('utf8')
  }
  if (!hasStylesImport) tsx = `import styles from './${compName}.module.css'\n${tsx}`
  assertValidTsx(abs, tsx) // parse-guard the rewritten component BEFORE writing either file

  await fs.writeFile(cssAbs, cssNext, 'utf8')
  await fs.writeFile(abs, tsx, 'utf8')
  return { ok: true, file: op.file, newValueText: `.${localClass} (${decls.length} decls)`, localClass, cssFile: cssRel }
}

/** The CSS selector a scoped write targets (signed blueprint §3.2). Interaction pseudo-states emit the F3
 * DUAL selector `.base:hover, :global([data-fc-preview="hover"]) .base` — the ANCESTOR half lets the gallery
 * force-preview a state by setting `data-fc-preview` on the WRAPPER around the component (the pseudo can't
 * be forced on .base itself); it is editor-only and stripped on export so shipped CSS is pure `.base:hover`. */
// The full 6-state order (§6.2) — used to sort semantic `[data-*]` selectors deterministically so WRITE
// and READ always compose the same combinatorial rule.
const STATE_ORDER = ['hover', 'pressed', 'focus', 'disabled', 'loading', 'error']
function scopedSelector(localClass: string, scope: ScopedTarget): string {
  const c = `.${localClass}`
  if (scope.kind === 'base') return c
  if (scope.kind === 'composite') {
    // §3.2 deterministic order: axis classes `.<axis>_<value>` (caller sends them in variantAxes-index
    // order) → semantic `[data-*]` sorted by the 6-state order → the single `:pseudo` LAST. So
    // {axisValues:[{size,lg}], semantic:[loading], pseudo:hover} → `.base.size_lg[data-loading]:hover`.
    const axisPart = (scope.axisValues ?? []).map((av) => `.${av.axis}_${av.value}`).join('')
    const semPart = [...(scope.semantic ?? [])].sort((a, b) => STATE_ORDER.indexOf(a) - STATE_ORDER.indexOf(b)).map((s) => `[data-${s}]`).join('')
    const core = `${c}${axisPart}${semPart}`
    // A pseudo can't be forced statically in the gallery → emit the F3 DUAL selector (the ancestor-preview
    // half is editor-only, stripped on export so shipped CSS is pure `…:hover`).
    return scope.pseudo ? `${core}:${scope.pseudo}, :global([data-fc-preview="${scope.pseudo}"]) ${core}` : core
  }
  if ('pseudo' in scope) return `${c}:${scope.pseudo}, :global([data-fc-preview="${scope.pseudo}"]) ${c}`
  return `${c}[data-${scope.propClass}]`
}

/** write-scoped-declaration (blueprint §3.2): write ONE declaration into the base / variant / pseudo-state /
 * prop-state rule of a component's .module.css, creating the rule if absent. DELTA discipline: caller only
 * sends props that differ from base. postcss-manipulated + parse-guarded + jailed like every css write. */
async function writeScopedDeclaration(op: Extract<WriteOp, { kind: 'write-scoped-declaration' }>): Promise<{ ok: true; file: string; newValueText: string }> {
  if (!/^[a-zA-Z_][\w-]*$/.test(op.localClass)) throw Object.assign(new Error('invalid class name'), { status: 422 })
  if (op.scope.kind === 'composite') for (const av of op.scope.axisValues ?? []) {
    // axis is a prop identifier → NO underscore (the READ splits on the FIRST `_` → axis, rest → value)
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(av.axis)) throw Object.assign(new Error(`invalid axis name: ${av.axis}`), { status: 422 })
    if (!/^[a-zA-Z0-9][\w-]*$/.test(av.value)) throw Object.assign(new Error(`invalid axis value: ${av.value}`), { status: 422 })
  }
  if (!/^(--)?[a-zA-Z][\w-]*$/.test(op.prop)) throw Object.assign(new Error(`invalid CSS property: ${op.prop}`), { status: 422 })
  if (/[{};]/.test(op.value) || op.value.trim() === '') throw Object.assign(new Error(`invalid CSS value: ${op.value}`), { status: 422 })
  const abs = jailModuleCss(op.file)
  const source = (await fs.readFile(abs)).toString('utf8')
  // Determinism is a property of the COMPOSER, not a caller convention (blueprint §3.2): sort the composite
  // axisValues by the component's actual `variantAxes` index (read from the .tsx sibling), regardless of the
  // order the caller sent them — so any two edits to the same target always compose the SAME rule. Only
  // matters for ≥2 axes; single-axis / non-composite need no sort.
  let scope: ScopedTarget = op.scope
  if (op.scope.kind === 'composite' && (op.scope.axisValues?.length ?? 0) >= 2) {
    try {
      const order = (await parseComponentModel(op.file.replace(/\.module\.css$/, '.tsx'))).variantAxes.map((a) => a.axis)
      const rank = (axis: string) => { const i = order.indexOf(axis); return i === -1 ? Number.MAX_SAFE_INTEGER : i }
      scope = { ...op.scope, axisValues: [...op.scope.axisValues!].sort((a, b) => rank(a.axis) - rank(b.axis)) }
    } catch { /* model unreadable → keep caller order (still deterministic per this write) */ }
  }
  const selector = scopedSelector(op.localClass, scope)
  const root = postcss.parse(source, { from: abs })
  let rule = root.nodes.find((n): n is Rule => n.type === 'rule' && n.selector === selector)
  if (!rule) { rule = postcss.rule({ selector }); root.append(rule) }
  const decl = rule.nodes.find((n): n is Declaration => n.type === 'decl' && n.prop === op.prop)
  if (decl) decl.value = op.value
  else rule.append({ prop: op.prop, value: op.value })
  const next = root.toString()
  await postcss.parse(next, { from: abs }) // parse-guard: refuse rather than corrupt
  await fs.writeFile(abs, next, 'utf8')
  return { ok: true, file: op.file, newValueText: `${selector} { ${op.prop}: ${op.value} }` }
}

// ─── I1: states — add-state op (blueprint §3.5, §6.2 two-kind) ────────────────────
/** The root JSX element a component's function returns (unwrapping parens). */
function findRootReturnedElement(fn: ts.FunctionLikeDeclaration, sf: ts.SourceFile): ts.JsxElement | ts.JsxSelfClosingElement | null {
  let found: ts.JsxElement | ts.JsxSelfClosingElement | null = null
  const visit = (n: ts.Node) => {
    if (found) return
    if (ts.isReturnStatement(n) && n.expression) {
      let e: ts.Node = n.expression
      while (ts.isParenthesizedExpression(e)) e = e.expression
      if (ts.isJsxElement(e) || ts.isJsxSelfClosingElement(e)) { found = e; return }
    }
    ts.forEachChild(n, visit)
  }
  visit(fn)
  return found
}

/** Add a `<prop>?: boolean` (default false) to a component's destructured params + type literal, plus a
 * `data-<attr>={<prop> || undefined}` toggle on its root element. Returns the rewritten source (string-
 * spliced with char offsets; the caller assertValidTsx's it). Reused by add-state (semantic) + later
 * expose-as-prop's boolean path. Refuses (409) if the prop already exists. */
function addBooleanPropToComponent(source: string, sf: ts.SourceFile, propName: string, dataAttr: string): string {
  const fn = findComponentFn(sf) // D-4: shared finder (was an inlined duplicate of findComponentFn's loop)
  if (!fn) throw Object.assign(new Error('no exported component function found'), { status: 422 })
  const root = findRootReturnedElement(fn, sf)
  if (!root) throw Object.assign(new Error('no root JSX element returned by the component'), { status: 422 })

  const edits: { s: number; t: string }[] = []
  const param = fn.parameters[0]
  if (!param) {
    const openParen = source.indexOf('(', fn.getStart(sf))
    edits.push({ s: openParen + 1, t: `{ ${propName} = false }: { ${propName}?: boolean }` })
  } else if (ts.isObjectBindingPattern(param.name)) {
    // F-I5-1 class: match the PUBLIC prop name so an aliased binding `{ size: sizeProp }` (I4 switch) is DETECTED
    // (409), not missed → duplicate-binding corrupt write. propertyName when present, else the local name.
    if (param.name.elements.some((e) => (e.propertyName && ts.isIdentifier(e.propertyName) ? e.propertyName.text : (ts.isIdentifier(e.name) ? e.name.text : undefined)) === propName)) throw Object.assign(new Error(`prop "${propName}" already exists`), { status: 409 })
    const hasElems = param.name.elements.length > 0
    edits.push({ s: param.name.getEnd() - 1, t: `${hasElems ? ', ' : ' '}${propName} = false ` })
    if (param.type && ts.isTypeLiteralNode(param.type)) {
      const hasMembers = param.type.members.length > 0
      edits.push({ s: param.type.getEnd() - 1, t: `${hasMembers ? '; ' : ' '}${propName}?: boolean ` })
    } else throw Object.assign(new Error('component params have no inline type literal — cannot type the new prop (v1 scope)'), { status: 422 })
  } else throw Object.assign(new Error('component param is not a destructured object — out of v1 scope'), { status: 422 })

  const opening = ts.isJsxElement(root) ? root.openingElement : root
  edits.push({ s: opening.tagName.getEnd(), t: ` data-${dataAttr}={${propName} || undefined}` })

  edits.sort((a, b) => b.s - a.s) // apply high→low so earlier offsets stay valid
  let out = source
  for (const e of edits) out = out.slice(0, e.s) + e.t + out.slice(e.s)
  return out
}

const STATE_PSEUDO: Record<string, 'hover' | 'active' | 'focus-visible' | 'disabled'> = { hover: 'hover', pressed: 'active', focus: 'focus-visible', disabled: 'disabled' }
/** Form-associated elements — the only tags CSS `:disabled` can match. A `disabled` state on any other root
 * (e.g. mother-v2's `<div>`) must use the semantic `[data-disabled]` path instead (blueprint §6.2), or the
 * pseudo rule is dead CSS (F-M2). */
const FORM_CONTROLS = new Set(['button', 'input', 'select', 'textarea', 'fieldset', 'option', 'optgroup'])
/** F-M1: is a `transition` already declared on `.base`? Used to keep the base-transition write IDEMPOTENT. */
async function baseHasTransition(cssModule: string, rootClass: string): Promise<boolean> {
  const abs = jailModuleCss(cssModule)
  const source = (await fs.readFile(abs)).toString('utf8')
  const root = postcss.parse(source, { from: abs })
  const rule = root.nodes.find((n): n is Rule => n.type === 'rule' && n.selector === `.${rootClass}`)
  return !!rule?.nodes.some((n): n is Declaration => n.type === 'decl' && n.prop === 'transition')
}
/** Ensure a base `transition` (the `all` superset) so states animate BOTH directions — a transition only on
 * a state rule (`:hover`) snaps back on exit, not Framer parity (blueprint §6.3, corrected). IDEMPOTENT: never
 * overwrite an existing base transition, so interaction + semantic add-state can't clobber each other (F-M1 —
 * was last-write-wins). */
async function ensureBaseTransition(model: ComponentModel): Promise<void> {
  if (await baseHasTransition(model.cssModule!, model.rootClass!)) return
  await writeScopedDeclaration({ kind: 'write-scoped-declaration', file: model.cssModule!, localClass: model.rootClass!, scope: { kind: 'base' }, prop: 'transition', value: 'all .15s ease' })
}
/** add-state (blueprint §3.5): make a state authorable. INTERACTION (hover/pressed/focus, + `disabled` on a
 * FORM-associated root) → ensure the base `transition`; the `.base:<pseudo>` rule is created on the first
 * scoped edit. SEMANTIC (loading/error, + `disabled` on a NON-form root per §6.2/F-M2) → add a real boolean
 * prop + `data-<state>` toggle on the root, driven by app state, plus the base transition. Promote first. */
async function addState(op: Extract<WriteOp, { kind: 'add-state' }>): Promise<{ ok: true; file: string; newValueText: string }> {
  const model = await parseComponentModel(op.file)
  if (!model.cssModule || !model.rootClass) throw Object.assign(new Error('promote the component to a CSS module first (no base class)'), { status: 422 })
  // F-M2: `disabled` on a non-form root (e.g. mother-v2's <div>) can't use `:disabled` (CSS matches
  // form-associated elements only) → route it through the SEMANTIC path (boolean prop + [data-disabled]).
  const disabledSemantic = op.state === 'disabled' && !FORM_CONTROLS.has(model.structure?.tag ?? '')
  const isSemantic = op.state === 'loading' || op.state === 'error' || disabledSemantic
  if (isSemantic) {
    // F-I5-2 (HIGH): the idempotency check must match the SEMANTIC BOOLEAN state, not just the name. A prop
    // that shares the name but is NOT boolean — e.g. a config AXIS named `loading` (quoted-union tsType) — is a
    // NAME COLLISION, not the state; axes and states are orthogonal (§D2). Name-only matching would misread it
    // as "state already present" and silently re-target the axis (200 fake-success). Match name AND
    // `tsType === 'boolean'` for idempotency; a same-name non-boolean prop is a genuine collision → refuse (422).
    const sameName = model.props.find((p) => p.name === op.state)
    if (sameName && sameName.tsType !== 'boolean') throw Object.assign(new Error(`prop "${op.state}" already exists as a config axis — variant axes and states are orthogonal (§D2); it can't also be a semantic state (rename the axis)`), { status: 422 })
    // IDEMPOTENT: if the boolean state prop already exists, skip the prop-add — re-selecting the chip must just
    // re-target, never re-add (the second half of the I1 add-state finding).
    const propExists = !!sameName
    if (!propExists) {
      const abs = jailComponentWrite(op.file)
      const source = (await fs.readFile(abs)).toString('utf8')
      const sf = ts.createSourceFile(abs, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
      const tsx = addBooleanPropToComponent(source, sf, op.state, op.state)
      assertValidTsx(abs, tsx)
      await fs.writeFile(abs, tsx, 'utf8')
    }
    await ensureBaseTransition(model)
    return { ok: true, file: op.file, newValueText: propExists ? `semantic state "${op.state}" already present (re-targeted)` : `semantic state "${op.state}": boolean prop + [data-${op.state}] toggle` }
  }
  const pseudo = STATE_PSEUDO[op.state]
  if (!pseudo) throw Object.assign(new Error(`unknown state: ${op.state}`), { status: 422 })
  await ensureBaseTransition(model)
  return { ok: true, file: op.file, newValueText: `interaction state "${op.state}" (:${pseudo}) — edit it to create the rule` }
}

// ─── I2: config variants — multi-axis (blueprint §3.3, §6.1) ──────────────────────
/** Find the exported component function in a source file (same walker as parseComponentModel/addState). */
function findComponentFn(sf: ts.SourceFile): ts.FunctionDeclaration | ts.ArrowFunction | undefined {
  let fn: ts.FunctionDeclaration | ts.ArrowFunction | undefined
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name && /^[A-Z]/.test(st.name.text)) { fn = st; break }
    if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations)
      if (ts.isIdentifier(d.name) && /^[A-Z]/.test(d.name.text) && d.initializer && ts.isArrowFunction(d.initializer)) fn = d.initializer
  }
  return fn
}
/** Pull the string-literal members out of a (possibly union) type node. */
function extractUnionValues(type: ts.TypeNode): string[] {
  const out: string[] = []
  const collect = (t: ts.TypeNode) => {
    if (ts.isUnionTypeNode(t)) t.types.forEach(collect)
    else if (ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)) out.push(t.literal.text)
  }
  collect(type)
  return out
}
/** mint-union-prop (blueprint §3.3): add or extend a string-union prop on the component's destructured
 * params + inline type literal. Generalizes addBooleanPropToComponent (boolean → a `'a'|'b'|…` union with a
 * default). CREATE if absent; EXTEND (merge new values into the union) if present; idempotent no-op if all
 * values already there. NO data-attr — a config axis drives `className`, not a toggle. Caller assertValidTsx's. */
// React-reserved / special prop names that a component NEVER receives as a plain prop (React intercepts them)
// — minting one as a variant axis or exposed prop is a SILENT runtime trap (tsc 0, but the axis never switches
// / the prop shadows React's own). Reject at the mint (F-M5, expert's adversarial catch). Shared by
// add-variant-axis (I2) AND expose-as-prop (I3, user-typed names → collisions likely).
const RESERVED_PROP_NAMES = new Set(['key', 'ref', 'children', 'className', 'style', 'dangerouslySetInnerHTML', 'defaultValue', 'defaultChecked'])
function mintUnionProp(source: string, sf: ts.SourceFile, propName: string, values: string[], defaultValue: string): string {
  if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(propName)) throw Object.assign(new Error(`invalid axis/prop name: ${propName}`), { status: 422 })
  if (RESERVED_PROP_NAMES.has(propName)) throw Object.assign(new Error(`"${propName}" is a React-reserved prop name — it can't be a variant axis or exposed prop (React never passes it through, so it would silently never work)`), { status: 422 })
  if (!values.length) throw Object.assign(new Error('no values'), { status: 422 })
  for (const v of values) if (!/^[a-zA-Z0-9][\w-]*$/.test(v)) throw Object.assign(new Error(`invalid value: ${v}`), { status: 422 })
  if (!values.includes(defaultValue)) throw Object.assign(new Error(`default "${defaultValue}" not in values`), { status: 422 })
  const union = values.map((v) => `'${v}'`).join(' | ')
  const fn = findComponentFn(sf)
  if (!fn) throw Object.assign(new Error('no exported component function found'), { status: 422 })

  const edits: { s: number; e?: number; t: string }[] = []
  const param = fn.parameters[0]
  if (!param) {
    const openParen = source.indexOf('(', fn.getStart(sf))
    edits.push({ s: openParen + 1, t: `{ ${propName} = '${defaultValue}' }: { ${propName}?: ${union} }` })
  } else if (ts.isObjectBindingPattern(param.name)) {
    // F-I5-1 (BLOCKING): match the PUBLIC prop name, not the local binding. After an I4 switch connector the
    // axis binding is aliased `{ size: sizeProp }` — `el.name` is the local (`sizeProp`), the public prop is
    // `el.propertyName` (`size`). Keying on `el.name` missed the existing prop → the CREATE branch inserted a
    // SECOND `size` binding + type member (TS2300/TS2717, app 500). Mirror lib.ts:1252 / parseComponentModel.
    // The EXTEND branch below only edits `param.type.members` (public name), so the aliased binding stays intact.
    const existing = param.name.elements.find((el) => {
      const pub = el.propertyName && ts.isIdentifier(el.propertyName) ? el.propertyName.text : (ts.isIdentifier(el.name) ? el.name.text : undefined)
      return pub === propName
    })
    if (existing) {
      // EXTEND — merge new values into the existing union (leave the destructured default as-is).
      if (!(param.type && ts.isTypeLiteralNode(param.type))) throw Object.assign(new Error('no inline type literal to extend'), { status: 422 })
      const member = param.type.members.find((m) => ts.isPropertySignature(m) && m.name && m.name.getText(sf) === propName) as ts.PropertySignature | undefined
      if (!member?.type) throw Object.assign(new Error(`prop "${propName}" has no type to extend`), { status: 422 })
      // F-M11 (BLOCKING, mirror of F-I5-2): the existing prop must be a config AXIS — a pure string-literal
      // union. A boolean SEMANTIC-STATE prop (addBooleanPropToComponent emits `?: boolean`) that shares the name
      // would be overwritten `boolean` → `'x'|'y'` here while its `= false` binding + `data-<state>` toggle stay
      // → tsc TS2322 corrupt write (§8). Axes and states are orthogonal (§D2) — refuse. Check every leaf is a
      // string-literal type (matches what extractUnionValues actually consumes); boolean/anything-else → 422.
      const isStrLit = (t: ts.TypeNode): boolean => ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)
      const isStringUnion = ts.isUnionTypeNode(member.type) ? member.type.types.every(isStrLit) : isStrLit(member.type)
      if (!isStringUnion) throw Object.assign(new Error(`prop "${propName}" already exists as a semantic state — variant axes and states are orthogonal (§D2); it can't also be a config axis (rename one)`), { status: 422 })
      const existingVals = extractUnionValues(member.type)
      const merged = [...new Set([...existingVals, ...values])]
      if (merged.length === existingVals.length) return source // idempotent — all values already present
      edits.push({ s: member.type.getStart(sf), e: member.type.getEnd(), t: merged.map((v) => `'${v}'`).join(' | ') })
    } else {
      const hasElems = param.name.elements.length > 0
      edits.push({ s: param.name.getEnd() - 1, t: `${hasElems ? ', ' : ' '}${propName} = '${defaultValue}' ` })
      if (param.type && ts.isTypeLiteralNode(param.type)) {
        const hasMembers = param.type.members.length > 0
        edits.push({ s: param.type.getEnd() - 1, t: `${hasMembers ? '; ' : ' '}${propName}?: ${union} ` })
      } else throw Object.assign(new Error('component params have no inline type literal — cannot type the new prop'), { status: 422 })
    }
  } else throw Object.assign(new Error('component param is not a destructured object — out of scope'), { status: 422 })

  edits.sort((a, b) => b.s - a.s) // apply high→low so earlier offsets stay valid
  let out = source
  for (const ed of edits) out = out.slice(0, ed.s) + ed.t + out.slice(ed.e ?? ed.s)
  return out
}
/** Ensure the root's `className` composes an axis's delta class: `styles[`<axis>_${<axis>}`]` (the prop is
 * defaulted so `props[axis] ?? default` is just the destructured var). Idempotent. Handles both the simple
 * `className={styles.base}` form and the already-composed array form. */
function ensureAxisInClassName(source: string, sf: ts.SourceFile, rootClass: string, axis: string): string {
  const fn = findComponentFn(sf)
  if (!fn) throw Object.assign(new Error('no exported component function found'), { status: 422 })
  const root = findRootReturnedElement(fn, sf)
  if (!root) throw Object.assign(new Error('no root JSX element'), { status: 422 })
  const opening = ts.isJsxElement(root) ? root.openingElement : root
  const attr = opening.attributes.properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === 'className')
  if (!attr?.initializer || !ts.isJsxExpression(attr.initializer) || !attr.initializer.expression) throw Object.assign(new Error('root has no className={…} expression to compose'), { status: 422 })
  const expr = attr.initializer.expression
  const term = `styles[\`${axis}_\${${axis}}\`]`
  if (expr.getText(sf).includes(term)) return source // idempotent
  let replacement: string
  if (ts.isPropertyAccessExpression(expr) || ts.isElementAccessExpression(expr)) {
    // simple `styles.base` → compose an array
    replacement = `[${expr.getText(sf)}, ${term}].filter(Boolean).join(' ')`
  } else if (ts.isCallExpression(expr) && expr.getText(sf).includes('.filter(Boolean)')) {
    // already composed: `[styles.base, …].filter(Boolean).join(' ')` — insert the new term into the array
    const arr = ((): ts.ArrayLiteralExpression | undefined => {
      let e: ts.Expression = expr
      // unwrap .join('') → .filter(Boolean) → the array
      while (ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression)) e = e.expression.expression
      return ts.isArrayLiteralExpression(e) ? e : undefined
    })()
    if (!arr) throw Object.assign(new Error('cannot locate the className array to extend'), { status: 422 })
    const lastEl = arr.elements[arr.elements.length - 1]
    const insertAt = lastEl ? lastEl.getEnd() : arr.getStart(sf) + 1
    return source.slice(0, insertAt) + `, ${term}` + source.slice(insertAt)
  } else throw Object.assign(new Error('unrecognised className expression shape'), { status: 422 })
  return source.slice(0, expr.getStart(sf)) + replacement + source.slice(expr.getEnd())
}
/** add-variant-axis (blueprint §3.3a): a NEW config axis — mint its `<axis>` union prop + compose it into
 * `className`. The `.base.<axis>_<value>` delta rules are created lazily on the first scoped edit (the union
 * prop is the source of truth for the axis, like a semantic state's boolean prop). Requires promotion. */
async function addVariantAxis(op: Extract<WriteOp, { kind: 'add-variant-axis' }>): Promise<{ ok: true; file: string; newValueText: string }> {
  const model = await parseComponentModel(op.file)
  if (!model.cssModule || !model.rootClass) throw Object.assign(new Error('promote the component to a CSS module first'), { status: 422 })
  const abs = jailComponentWrite(op.file)
  let source = (await fs.readFile(abs)).toString('utf8')
  let sf = ts.createSourceFile(abs, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
  source = mintUnionProp(source, sf, op.axis, op.values, op.defaultValue)
  sf = ts.createSourceFile(abs, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
  source = ensureAxisInClassName(source, sf, model.rootClass, op.axis)
  assertValidTsx(abs, source)
  await fs.writeFile(abs, source, 'utf8')
  return { ok: true, file: op.file, newValueText: `variant axis "${op.axis}": ${op.values.join(' | ')} (default ${op.defaultValue})` }
}
/** add-variant-value (blueprint §3.3b): extend ONE existing axis's union with a new value (mint-union-prop
 * EXTEND). The `.base.<axis>_<value>` rule is created on the first scoped edit. */
async function addVariantValue(op: Extract<WriteOp, { kind: 'add-variant-value' }>): Promise<{ ok: true; file: string; newValueText: string }> {
  const model = await parseComponentModel(op.file)
  const axis = model.variantAxes.find((a) => a.axis === op.axis)
  if (!axis) throw Object.assign(new Error(`no variant axis "${op.axis}"`), { status: 422 })
  const abs = jailComponentWrite(op.file)
  const source = (await fs.readFile(abs)).toString('utf8')
  const sf = ts.createSourceFile(abs, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
  const allValues = [...axis.values, op.value]
  let next = mintUnionProp(source, sf, op.axis, allValues, axis.defaultValue)
  // F-I5-1 follow-on: if this axis carries a CYCLE switch connector (I4), its generated updater baked
  // `const vals: (<union>)[] = [<list>]` with the AUTHORING-TIME values. Once the axis union widens, that stale
  // `vals` (a) omits the new value from the cycle and (b) makes `vals.indexOf(v)` fail tsc (TS2345) against the
  // widened setter. Sync the baked vals to ALL current values so the new value joins the cycle AND it typechecks.
  const { setter } = switchNames(op.axis)
  const cycleRe = new RegExp(`(${setter}\\(\\(v\\) => \\{ const vals: )\\([^)]*\\)(\\[\\] = )\\[[^\\]]*\\]`)
  if (cycleRe.test(next)) {
    const union = allValues.map((x) => `'${x}'`).join(' | ')
    const list = allValues.map((x) => `'${x}'`).join(', ')
    next = next.replace(cycleRe, `$1(${union})$2[${list}]`)
  }
  assertValidTsx(abs, next)
  await fs.writeFile(abs, next, 'utf8')
  return { ok: true, file: op.file, newValueText: `variant value "${op.axis}=${op.value}" added` }
}

// ─── I3: props — expose-as-prop + the custom-property bridge (blueprint §5) ────────
/** Shared: add a `<prop>?: string` to the component's destructured params + inline type literal (OPTIONAL,
 * default undefined). Returns the edit list (not applied) so callers can combine it with a swap/root edit in
 * one splice pass. Refuses 409 if the prop already exists. Used by every expose-as-prop route. */
function addStringParam(source: string, sf: ts.SourceFile, propName: string, defaultLiteral?: string): { s: number; e?: number; t: string }[] {
  const fn = findComponentFn(sf)
  if (!fn) throw Object.assign(new Error('no exported component function found'), { status: 422 })
  // F-M7: the literal-swap routes pass the swapped-out literal as the prop's DEFAULT so a prop-less render
  // stays byte-identical (exposing is representation-only). The module-css bridge passes no default — its
  // CSS var() fallback holds the literal and the undefined default is what lets variants win (do NOT default).
  const decl = defaultLiteral !== undefined ? `${propName} = ${defaultLiteral}` : propName
  const edits: { s: number; e?: number; t: string }[] = []
  const param = fn.parameters[0]
  if (!param) {
    const openParen = source.indexOf('(', fn.getStart(sf))
    edits.push({ s: openParen + 1, t: `{ ${decl} }: { ${propName}?: string }` })
  } else if (ts.isObjectBindingPattern(param.name)) {
    // F-I5-1 class: match the PUBLIC prop name so an aliased binding `{ size: sizeProp }` (I4 switch) is DETECTED
    // (409), not missed → duplicate-binding corrupt write. propertyName when present, else the local name.
    if (param.name.elements.some((el) => (el.propertyName && ts.isIdentifier(el.propertyName) ? el.propertyName.text : (ts.isIdentifier(el.name) ? el.name.text : undefined)) === propName)) throw Object.assign(new Error(`prop "${propName}" already exists`), { status: 409 })
    const hasElems = param.name.elements.length > 0
    edits.push({ s: param.name.getEnd() - 1, t: `${hasElems ? ', ' : ' '}${decl} ` })
    if (param.type && ts.isTypeLiteralNode(param.type)) {
      const hasMembers = param.type.members.length > 0
      edits.push({ s: param.type.getEnd() - 1, t: `${hasMembers ? '; ' : ' '}${propName}?: string ` })
    } else throw Object.assign(new Error('component params have no inline type literal — cannot type the new prop'), { status: 422 })
  } else throw Object.assign(new Error('component param is not a destructured object — out of scope'), { status: 422 })
  return edits
}
/** The tsx half of the module-css bridge (§5): `addStringParam` PLUS a `style={{ '--<prop>': <prop> }}`
 * custom property on the ROOT (merged into an existing style object, or a new style attr). React's
 * `CSSProperties` type rejects arbitrary `--x` keys, so the generated style object carries an `as
 * CSSProperties` cast (the standard React+TS custom-property pattern) — else the generated component fails
 * tsc (TS2353). The `CSSProperties` type is imported once (these generated files use the automatic JSX
 * runtime, so `React` is not in scope). A second expose merges into the existing `{…} as CSSProperties`
 * without double-casting or re-importing. */
function exposeStringPropOnRoot(source: string, sf: ts.SourceFile, propName: string): string {
  const edits = addStringParam(source, sf, propName)
  const fn = findComponentFn(sf)!
  const root = findRootReturnedElement(fn, sf)
  if (!root) throw Object.assign(new Error('no root JSX element'), { status: 422 })
  const opening = ts.isJsxElement(root) ? root.openingElement : root
  const styleAttr = opening.attributes.properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === 'style')
  const cssVar = `'--${propName}': ${propName}`
  let castEmitted = false
  if (!styleAttr) {
    edits.push({ s: opening.tagName.getEnd(), t: ` style={{ ${cssVar} } as CSSProperties}` })
    castEmitted = true
  } else {
    const init = styleAttr.initializer
    if (!init || !ts.isJsxExpression(init) || !init.expression) throw Object.assign(new Error('root style is not an inline object literal — cannot merge the custom property'), { status: 422 })
    const expr = init.expression
    if (ts.isAsExpression(expr) && ts.isObjectLiteralExpression(expr.expression)) {
      // already `{…} as CSSProperties` (prior expose) → prepend into the inner object; cast + import already present
      edits.push({ s: expr.expression.getStart(sf) + 1, t: ` ${cssVar},` })
    } else if (ts.isObjectLiteralExpression(expr)) {
      // plain object literal → prepend the custom property AND wrap the whole object with the cast
      edits.push({ s: expr.getStart(sf) + 1, t: ` ${cssVar},` })
      edits.push({ s: expr.getEnd(), t: ` as CSSProperties` })
      castEmitted = true
    } else throw Object.assign(new Error('root style is not an inline object literal — cannot merge the custom property'), { status: 422 })
  }
  // import the cast type once (idempotent — a prior expose may have added it)
  if (castEmitted && !/import\s+type\s*\{[^}]*\bCSSProperties\b[^}]*\}\s*from\s*['"]react['"]/.test(source)) {
    edits.push({ s: 0, t: `import type { CSSProperties } from 'react'\n` })
  }
  edits.sort((a, b) => b.s - a.s)
  let out = source
  for (const ed of edits) out = out.slice(0, ed.s) + ed.t + out.slice(ed.e ?? ed.s)
  return out
}
/** module-css route (blueprint §5, the custom-property bridge): turn a fixed CSS value into an editable prop.
 * Rewrites EVERY rule of this component that declares `cssProp` (base + variant/state deltas) →
 * `var(--<prop>, <that-rule's-literal>)` (keeping each literal as the fallback), then adds the `<prop>?:
 * string` prop + the `style={{'--<prop>': prop}}` root custom property. Precedence falls out clean —
 * explicit prop > variant > base (§5): prop set → the root var cascades into every rule and wins; prop
 * unset → each rule falls to its own literal, so the higher-specificity variant/state beats base. */
async function exposeModuleCssBridge(op: Extract<WriteOp, { kind: 'expose-as-prop' }>): Promise<{ ok: true; file: string; newValueText: string }> {
  if (!op.cssProp || !/^[a-z][a-z-]*$/.test(op.cssProp)) throw Object.assign(new Error(`module-css route needs a valid cssProp: ${op.cssProp ?? '(missing)'}`), { status: 422 })
  const model = await parseComponentModel(op.file)
  if (!model.cssModule || !model.rootClass) throw Object.assign(new Error('promote the component to a CSS module first'), { status: 422 })
  const cssAbs = jailModuleCss(model.cssModule)
  const cssRoot = postcss.parse((await fs.readFile(cssAbs)).toString('utf8'), { from: cssAbs })
  let rewrites = 0
  cssRoot.walkRules((rule) => {
    // F-M6: this component's rules only — with a CLASS-BOUNDARY check. A bare startsWith false-matches a
    // sibling class (`.base` ⊂ `.baseline`); the char after the `.<rootClass>` prefix must be a
    // non-identifier char (`.`/`:`/`[`/combinator/whitespace/end), not another `[\w-]` (a different class).
    const sel = rule.selector.split(',')[0].trim()
    const prefix = `.${model.rootClass}`
    if (!sel.startsWith(prefix)) return
    const next = sel[prefix.length]
    if (next !== undefined && /[\w-]/.test(next)) return // `.baseline` / `.base-x` / `.base2` → foreign class
    rule.walkDecls(op.cssProp!, (decl) => {
      if (/^var\(/.test(decl.value.trim())) return // already bridged
      decl.value = `var(--${op.propName}, ${decl.value})`
      rewrites++
    })
  })
  if (!rewrites) throw Object.assign(new Error(`no "${op.cssProp}" declaration on this component to expose`), { status: 422 })
  const cssNext = cssRoot.toString()
  await postcss.parse(cssNext, { from: cssAbs }) // parse-guard: refuse rather than corrupt
  const abs = jailComponentWrite(op.file)
  const sf = ts.createSourceFile(abs, (await fs.readFile(abs)).toString('utf8'), ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
  const tsxNext = exposeStringPropOnRoot(sf.getFullText(), sf, op.propName)
  assertValidTsx(abs, tsxNext)
  await fs.writeFile(cssAbs, cssNext, 'utf8')
  await fs.writeFile(abs, tsxNext, 'utf8')
  return { ok: true, file: op.file, newValueText: `exposed ${op.cssProp} as prop "${op.propName}" (${rewrites} rule${rewrites > 1 ? 's' : ''} bridged)` }
}
/** expose-as-prop (blueprint §5) — turn a fixed value into an editable prop, ROUTED BY TARGET LOCATION.
 * Four routes (§5): text/attr/inline-style are pure JSX literal-swaps (`>{prop}<` / `x={prop}` /
 * `color: prop`) + a `prop?: string` param; module-css is the custom-property bridge. `target` defaults to
 * 'module-css' for back-compat with the color-value call site. Refusal taxonomy (§5): not-a-literal→422,
 * propName collision→409, ambiguous/no-target→422. */
async function exposeAsProp(op: Extract<WriteOp, { kind: 'expose-as-prop' }>): Promise<{ ok: true; file: string; newValueText: string }> {
  if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(op.propName)) throw Object.assign(new Error(`invalid prop name: ${op.propName}`), { status: 422 })
  if (RESERVED_PROP_NAMES.has(op.propName)) throw Object.assign(new Error(`"${op.propName}" is a React-reserved prop name — it can't be exposed as a prop`), { status: 422 })
  const target = op.target ?? 'module-css'
  if (target === 'module-css') return exposeModuleCssBridge(op)
  // ── literal-swap routes: text / attr / inline-style (§5) — the value lives in the JSX, no CSS parse ──
  if (op.line == null || op.col == null) throw Object.assign(new Error(`the ${target} route needs a JSX line+col`), { status: 422 })
  const abs = jailComponentWrite(op.file)
  const source = (await fs.readFile(abs)).toString('utf8')
  const sf = ts.createSourceFile(abs, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
  const el = findJsxAt(sf, op.line, op.col)
  if (!el) throw Object.assign(new Error(`no JSX element at ${op.line}:${op.col}`), { status: 404 })
  let swap: { s: number; e: number; t: string }
  let defaultLiteral: string
  if (target === 'text') {
    const parent = el.parent
    if (!parent || !ts.isJsxElement(parent)) throw Object.assign(new Error('element has no text body to expose (self-closing?)'), { status: 422 })
    if (parent.children.some((c) => ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c) || (ts.isJsxExpression(c) && !!c.expression))) throw Object.assign(new Error('element has non-text children — not a single static text literal (ambiguous)'), { status: 422 })
    const texts = parent.children.filter((c): c is ts.JsxText => ts.isJsxText(c) && c.getText(sf).trim().length > 0)
    if (texts.length !== 1) throw Object.assign(new Error('not a single static text literal to expose — refusing (ambiguous)'), { status: 422 })
    const raw = texts[0].getText(sf) // preserve surrounding JSX whitespace; swap only the trimmed literal
    const lead = raw.length - raw.trimStart().length, trail = raw.length - raw.trimEnd().length
    swap = { s: texts[0].getStart(sf) + lead, e: texts[0].getEnd() - trail, t: `{${op.propName}}` }
    defaultLiteral = JSON.stringify(raw.trim()) // F-M7: prop default = the original text so a prop-less render is byte-identical
  } else if (target === 'attr') {
    if (!op.attrName) throw Object.assign(new Error('the attr route needs an attrName'), { status: 422 })
    const attr = el.attributes.properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === op.attrName)
    if (!attr?.initializer || !ts.isStringLiteral(attr.initializer)) throw Object.assign(new Error(`attribute "${op.attrName}" is not a string literal — refusing (would clobber a binding)`), { status: 422 })
    swap = { s: attr.initializer.getStart(sf), e: attr.initializer.getEnd(), t: `{${op.propName}}` }
    defaultLiteral = JSON.stringify(attr.initializer.text) // F-M7: prop default = the original attr value
  } else { // inline-style
    if (!op.cssProp) throw Object.assign(new Error('the inline-style route needs a cssProp'), { status: 422 })
    const styleAttr = el.attributes.properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === 'style')
    const init = styleAttr?.initializer
    if (!init || !ts.isJsxExpression(init) || !init.expression || !ts.isObjectLiteralExpression(init.expression)) throw Object.assign(new Error('element has no inline style object to expose'), { status: 422 })
    const key = cssToJsKey(op.cssProp)
    const prop = init.expression.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && p.name.getText(sf).replace(/['"]/g, '') === key)
    if (!prop) throw Object.assign(new Error(`no inline "${op.cssProp}" on this element to expose`), { status: 422 })
    if (!ts.isStringLiteral(prop.initializer) && !ts.isNumericLiteral(prop.initializer)) throw Object.assign(new Error('inline style value is a dynamic expression, not a literal — refusing (would destroy a binding)'), { status: 422 })
    swap = { s: prop.initializer.getStart(sf), e: prop.initializer.getEnd(), t: op.propName }
    // F-M7: prop default = the original value, rendered identically. A numeric literal serializes per §2.1's
    // unitless/length law ('13px' for length props, raw for unitless) since the prop is string-typed.
    defaultLiteral = ts.isStringLiteral(prop.initializer)
      ? JSON.stringify(prop.initializer.text)
      : JSON.stringify(prop.initializer.text + (REACT_UNITLESS.has(key) ? '' : 'px'))
  }
  const edits = [...addStringParam(source, sf, op.propName, defaultLiteral), { s: swap.s, e: swap.e, t: swap.t }].sort((a, b) => b.s - a.s)
  let out = source
  for (const ed of edits) out = out.slice(0, ed.s) + ed.t + out.slice(ed.e ?? ed.s)
  assertValidTsx(abs, out)
  await fs.writeFile(abs, out, 'utf8')
  return { ok: true, file: op.file, newValueText: `exposed ${target} as prop "${op.propName}"` }
}
/** set-instance-prop (blueprint §5, I3): set/update a string prop on a component INSTANCE (`<Comp bg="#f00"/>`)
 * — the per-instance override. Refuses on a host element (only components take props) and on a
 * value needing an expression (v1 = string props). */
async function setInstanceProp(op: Extract<WriteOp, { kind: 'set-instance-prop' }>): Promise<{ ok: true; file: string; newValueText: string }> {
  if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(op.propName)) throw Object.assign(new Error(`invalid prop name: ${op.propName}`), { status: 422 })
  if (RESERVED_PROP_NAMES.has(op.propName)) throw Object.assign(new Error(`"${op.propName}" is a React-reserved prop name`), { status: 422 })
  if (/[{}<>"]/.test(op.value)) throw Object.assign(new Error('value needs an expression — out of v1 scope (string props only)'), { status: 422 })
  const abs = jailComponentWrite(op.file)
  const source = (await fs.readFile(abs)).toString('utf8')
  const sf = ts.createSourceFile(abs, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
  const el = findJsxAt(sf, op.line, op.col)
  if (!el) throw Object.assign(new Error(`no JSX element at ${op.line}:${op.col}`), { status: 404 })
  const tag = el.tagName.getText(sf)
  if (!/^[A-Z]/.test(tag)) throw Object.assign(new Error(`"${tag}" is a host element, not a component instance — props only set on components`), { status: 422 })
  const existing = el.attributes.properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === op.propName)
  const [start, end, text] = existing
    ? [existing.getStart(sf), existing.getEnd(), `${op.propName}="${op.value}"`]
    : [el.tagName.getEnd(), el.tagName.getEnd(), ` ${op.propName}="${op.value}"`]
  const next = source.slice(0, start) + text + source.slice(end)
  assertValidTsx(abs, next)
  await fs.writeFile(abs, next, 'utf8')
  return { ok: true, file: op.file, newValueText: `${tag} ${op.propName}="${op.value}"` }
}

// ─── I4: connectors (blueprint §3.6 / §6.3 / D3 / D4) ────────────────────────────
/** §6.3: a spring{stiffness,damping,mass} → a CSS `linear()` easing (spring→linear is IRREVERSIBLE, so the
 * params live in the `@fc-transition` side-channel; this is the OUTPUT). Numerically integrates the damped
 * spring m·x'' = -k(x-1) - c·x' from x=0,v=0, samples the normalized position → `linear(…)` + settle seconds. */
function springToLinear(stiffness: number, damping: number, mass: number): { easing: string; durationS: number } {
  const k = stiffness, c = damping, m = mass > 0 ? mass : 1
  const dt = 1 / 240
  let x = 0, v = 0, t = 0
  const xs: number[] = [0]
  const maxT = 4
  while (t < maxT) {
    const a = (-k * (x - 1) - c * v) / m
    v += a * dt
    x += v * dt
    t += dt
    xs.push(x)
    if (Math.abs(x - 1) < 0.001 && Math.abs(v) < 0.001) break
  }
  const durationS = Math.min(maxT, Math.max(0.05, t))
  const N = 24, last = xs.length - 1
  const pts = Array.from({ length: N + 1 }, (_, i) => xs[Math.round((i / N) * last)])
  pts[0] = 0; pts[N] = 1 // clamp endpoints (overshoot between is valid + wanted for bounce)
  return { easing: `linear(${pts.map((p) => Number(p.toFixed(4))).join(', ')})`, durationS: Number(durationS.toFixed(3)) }
}
/** The derived identifier names for a switch-connector axis (the D3 controllable hook + its guard) — shared
 * by set-connector, remove-connector, and add-variant-value's cycle-sync so the naming stays in ONE place. */
function switchNames(axis: string): { cap: string; propLocal: string; internal: string; setter: string } {
  const cap = axis.charAt(0).toUpperCase() + axis.slice(1)
  return { cap, propLocal: `${axis}Prop`, internal: `${axis}Internal`, setter: `set${cap}Internal` }
}
/** set-connector (blueprint §3.6) — TWO connector KINDS (F2, never collapse tap→:active):
 * - `state` (momentary, pure CSS): set the BASE rule's transition (spring→linear() / tween) so a state
 *   animates BOTH directions (§6.3), + the `@fc-transition` side-channel that IS the read source of truth (D4).
 * - `switch` (persistent, the one allowed JS): tap → a CONFIG axis value → the D3 controllable-state idiom
 *   (`useState(default)` + `value = prop ?? internal`; onClick sets internal only when uncontrolled, so a
 *   controlled parent always wins — no desync), + the mandatory `@fc-connector` side-channel the READ parses. */
async function setConnector(op: Extract<WriteOp, { kind: 'set-connector' }>): Promise<{ ok: true; file: string; newValueText: string }> {
  const model = await parseComponentModel(op.file)
  if (!model.cssModule || !model.rootClass) throw Object.assign(new Error('promote the component to a CSS module first'), { status: 422 })
  if (op.mode === 'state') {
    // momentary interaction transition on the BASE rule (bidirectional, §6.3) + @fc-transition comment
    let transCss = 'all .15s ease', comment: string | null = null
    if (op.transition?.kind === 'spring') {
      const { easing, durationS } = springToLinear(op.transition.stiffness, op.transition.damping, op.transition.mass)
      transCss = `all ${durationS}s ${easing}`
      // F2 (D4): the side-channel encodes trigger + to.state (mirrors `@fc-connector: tap axis→to`) so the
      // READ round-trips the full connector shape, not just the spring (write→read→write no drift, §10-I4).
      comment = `@fc-transition: ${op.trigger} ${op.to.state ?? op.trigger} spring ${op.transition.stiffness} ${op.transition.damping} ${op.transition.mass}`
    } else if (op.transition?.kind === 'tween') {
      transCss = `all ${op.transition.duration}s ${op.transition.ease ?? 'ease'}`
    }
    const cssAbs = jailModuleCss(model.cssModule)
    const cssRoot = postcss.parse((await fs.readFile(cssAbs)).toString('utf8'), { from: cssAbs })
    const baseRule = cssRoot.nodes.find((n): n is Rule => n.type === 'rule' && n.selector === `.${model.rootClass}`)
    if (!baseRule) throw Object.assign(new Error('no base rule to attach the transition'), { status: 422 })
    const existing = baseRule.nodes.find((n): n is Declaration => n.type === 'decl' && n.prop === 'transition')
    if (existing) existing.value = transCss
    else baseRule.append({ prop: 'transition', value: transCss })
    const prev = baseRule.prev() // drop a stale @fc-transition comment, then re-add if spring (idempotent)
    if (prev && prev.type === 'comment' && /@fc-transition:/.test((prev as unknown as { text: string }).text)) prev.remove()
    if (comment) baseRule.before(`/* ${comment} */\n`)
    const cssNext = cssRoot.toString()
    await postcss.parse(cssNext, { from: cssAbs }) // parse-guard
    await fs.writeFile(cssAbs, cssNext, 'utf8')
    return { ok: true, file: model.cssModule, newValueText: `state connector: ${op.trigger} → transition ${transCss}` }
  }
  // ── switch mode: tap → a config axis value → the D3 controllable idiom + @fc-connector side-channel ──
  const axis = op.to.axis
  const toVal = op.to.value
  if (!axis || !toVal) throw Object.assign(new Error('switch connector needs to.axis and to.value'), { status: 422 })
  const ax = model.variantAxes.find((a) => a.axis === axis)
  if (!ax) throw Object.assign(new Error(`no config axis "${axis}" to switch`), { status: 422 })
  if (!ax.values.includes(toVal)) throw Object.assign(new Error(`"${toVal}" is not a value of axis "${axis}"`), { status: 422 })
  const abs = jailComponentWrite(op.file)
  const source = (await fs.readFile(abs)).toString('utf8')
  const sf = ts.createSourceFile(abs, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
  const fn = findComponentFn(sf)
  if (!fn || !fn.body || !ts.isBlock(fn.body)) throw Object.assign(new Error('component has no block body — cannot add the switch hook'), { status: 422 })
  const param = fn.parameters[0]
  if (!param || !ts.isObjectBindingPattern(param.name)) throw Object.assign(new Error('component params are not a destructured object — out of scope'), { status: 422 })
  // D-1: match the PUBLIC prop name (propertyName ?? name) — an already-switch-connected axis is aliased
  // `{ size: sizeProp }`, so keying on the LOCAL `el.name` would miss it and throw the wrong "not a
  // destructured prop" 422 instead of reaching the intended 409 idempotency refusal below.
  const bind = param.name.elements.find((el) => (el.propertyName && ts.isIdentifier(el.propertyName) ? el.propertyName.text : (ts.isIdentifier(el.name) ? el.name.text : undefined)) === axis)
  if (!bind) throw Object.assign(new Error(`axis "${axis}" is not a destructured prop`), { status: 422 })
  if (bind.propertyName) throw Object.assign(new Error(`axis "${axis}" is already a switch connector (already controllable)`), { status: 409 }) // idempotency: already renamed (aliased binding)
  const ret = fn.body.statements.find(ts.isReturnStatement)
  if (!ret) throw Object.assign(new Error('component has no return statement'), { status: 422 })
  const { propLocal, internal, setter } = switchNames(axis)
  // F1 (HIGH): type the cycle array as the axis union — TS infers a bare `string[]` otherwise, so the indexed
  // access is `string` and fails against the setter's `Dispatch<SetStateAction<'a'|'b'>>` (generated-tsc bug).
  const unionType = ax.values.map((x) => `'${x}'`).join(' | ')
  const setExpr = op.cycle
    ? `${setter}((v) => { const vals: (${unionType})[] = [${ax.values.map((x) => `'${x}'`).join(', ')}]; return vals[(vals.indexOf(v) + 1) % vals.length] })`
    : `${setter}('${toVal}')`
  const edits: { s: number; e?: number; t: string }[] = []
  // 1) rename the destructured axis binding `axis = 'x'` → `axis: axisProp` (drop the default; the derived const carries it)
  edits.push({ s: bind.getStart(sf), e: bind.getEnd(), t: `${axis}: ${propLocal}` })
  // 2) inject the controllable hook + connector side-channel just before the return
  const indent = ' '.repeat(ret.getStart(sf) - source.lastIndexOf('\n', ret.getStart(sf)) - 1)
  // F-M9 (MED): the rename below drops the binding's `= '<default>'` literal (D3 requires it), so a later
  // parseComponentModel has no source default to read for this axis and falls back to values[0] — real drift
  // (e.g. 'lg'→'sm'). Encode the real default in the side-channel (D4 source-of-truth) so the READ recovers it.
  edits.push({ s: ret.getStart(sf), t: `/* @fc-connector: tap ${axis}→${toVal}${op.cycle ? ' cycle' : ''} default=${ax.defaultValue} */\n${indent}const [${internal}, ${setter}] = useState(${propLocal} ?? '${ax.defaultValue}')\n${indent}const ${axis} = ${propLocal} ?? ${internal}\n${indent}` })
  // 3) onClick on the root (uncontrolled-only — a controlled parent always wins, D3)
  const root = findRootReturnedElement(fn, sf)
  if (!root) throw Object.assign(new Error('no root JSX element for the tap handler'), { status: 422 })
  const opening = ts.isJsxElement(root) ? root.openingElement : root
  // F-M8 (BLOCKING): a root already carrying an onClick (a prior tap-switch, or hand-authored) would get a
  // DUPLICATE `onClick` attr — valid TSX syntax but a tsc TS17001 error, and assertValidTsx is syntax-only so it
  // would WRITE corrupt code (§8 "refuse rather than corrupt"). If the existing onClick is an inline block arrow,
  // MERGE the new guard into it — each guard checks its OWN prop, so both switches stay correct with no desync
  // (two interactions per component is legit Framer surface). Otherwise REFUSE with a named 422 (never corrupt).
  const existingOnClick = opening.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === 'onClick')
  if (existingOnClick && ts.isJsxAttribute(existingOnClick)) {
    const inner = existingOnClick.initializer && ts.isJsxExpression(existingOnClick.initializer) ? existingOnClick.initializer.expression : undefined
    if (inner && ts.isArrowFunction(inner) && ts.isBlock(inner.body)) {
      edits.push({ s: inner.body.getEnd() - 1, t: `; if (${propLocal} == null) ${setExpr} ` }) // splice the guard in before the block's closing brace
    } else {
      throw Object.assign(new Error('component root already has an onClick that is not an inline block handler — compose the tap-switch manually (cannot safely merge)'), { status: 422 })
    }
  } else {
    edits.push({ s: opening.tagName.getEnd(), t: ` onClick={() => { if (${propLocal} == null) ${setExpr} }}` })
  }
  // 4) ensure `import { useState } from 'react'`
  if (!/import\s*\{[^}]*\buseState\b[^}]*\}\s*from\s*['"]react['"]/.test(source)) edits.push({ s: 0, t: `import { useState } from 'react'\n` })
  edits.sort((a, b) => b.s - a.s)
  let out = source
  for (const ed of edits) out = out.slice(0, ed.s) + ed.t + out.slice(ed.e ?? ed.s)
  assertValidTsx(abs, out)
  await fs.writeFile(abs, out, 'utf8')
  return { ok: true, file: op.file, newValueText: `switch connector: tap ${axis} → ${toVal}${op.cycle ? ' (cycle)' : ''}` }
}

const escapeReg = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** remove-connector (I7 node-system) — delete a connector wire, the REVERSE of set-connector (both modes).
 * state: drop the `@fc-transition` side-channel + reset the base transition to the default. switch: undo the
 * D3 controllable injection for THIS axis only (revert the aliased binding → defaulted destructure, remove the
 * `@fc-connector` comment + the useState/derived-const, remove this axis's onClick guard — dropping the whole
 * onClick if it was the only guard, else just this axis's clause). Never corrupts: assertValidTsx before write,
 * refuse 422 on any shape it doesn't recognise (connectors are machine-authored, so the shape is known). */
async function removeConnector(op: Extract<WriteOp, { kind: 'remove-connector' }>): Promise<{ ok: true; file: string; newValueText: string }> {
  const model = await parseComponentModel(op.file)
  if (op.mode === 'state') {
    if (!model.cssModule || !model.rootClass) throw Object.assign(new Error('component is not promoted — no state connector to remove'), { status: 422 })
    const cssAbs = jailModuleCss(model.cssModule)
    const cssRoot = postcss.parse((await fs.readFile(cssAbs)).toString('utf8'), { from: cssAbs })
    const baseRule = cssRoot.nodes.find((n): n is Rule => n.type === 'rule' && n.selector === `.${model.rootClass}`)
    if (!baseRule) throw Object.assign(new Error('no base rule — no state connector to remove'), { status: 422 })
    const prev = baseRule.prev()
    if (prev && prev.type === 'comment' && /@fc-transition:/.test((prev as unknown as { text: string }).text)) prev.remove()
    const trans = baseRule.nodes.find((n): n is Declaration => n.type === 'decl' && n.prop === 'transition')
    if (trans) trans.value = 'all .15s ease' // reset to the idempotent default (states still animate; the spring is gone)
    const next = cssRoot.toString()
    await postcss.parse(next, { from: cssAbs }) // parse-guard
    await fs.writeFile(cssAbs, next, 'utf8')
    return { ok: true, file: model.cssModule, newValueText: 'state connector removed (transition reset to default)' }
  }
  // switch mode — undo the D3 injection for op.to.axis only
  const axis = op.to.axis
  if (!axis) throw Object.assign(new Error('remove switch connector needs to.axis'), { status: 422 })
  const abs = jailComponentWrite(op.file)
  let source = (await fs.readFile(abs)).toString('utf8')
  const sf = ts.createSourceFile(abs, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
  const fn = findComponentFn(sf)
  if (!fn || !fn.body || !ts.isBlock(fn.body)) throw Object.assign(new Error('component has no block body'), { status: 422 })
  const param = fn.parameters[0]
  if (!param || !ts.isObjectBindingPattern(param.name)) throw Object.assign(new Error('component params are not a destructured object'), { status: 422 })
  const bind = param.name.elements.find((el) => (el.propertyName && ts.isIdentifier(el.propertyName) ? el.propertyName.text : (ts.isIdentifier(el.name) ? el.name.text : undefined)) === axis)
  if (!bind) throw Object.assign(new Error(`axis "${axis}" is not a prop on this component`), { status: 422 })
  if (!bind.propertyName) throw Object.assign(new Error(`axis "${axis}" is not a switch connector (nothing to remove)`), { status: 422 }) // not aliased → no switch
  const { propLocal, internal, setter } = switchNames(axis)
  const axDef = model.variantAxes.find((a) => a.axis === axis)
  const dflt = axDef?.defaultValue ?? axDef?.values[0] ?? 'default' // #5 harden: never fall back to the alias identifier text
  // ── QA-HIGH FIX: VALIDATE EVERYTHING on the ORIGINAL source FIRST, mutate NOTHING until every piece is
  //    recognized. The old code reverted the binding + removed the blob UNCONDITIONALLY, then bailed if the
  //    onClick shape was unrecognized → a dangling `${propLocal}` reference (TS2304) written to disk (§8
  //    corrupt write, F-M8/F-M11 class; assertValidTsx is syntax-only so it wouldn't catch it). Validate all → refuse → then apply all edits offset-safe.
  // (a) the injected blob (comment + useState + derived const), this axis only
  const blobMatch = new RegExp(
    `\\n?[ \\t]*/\\* @fc-connector: tap ${escapeReg(axis)}→[^*]*\\*/` +
    `\\n[ \\t]*const \\[${escapeReg(internal)}, ${escapeReg(setter)}\\] = useState\\([^\\n]*\\)` +
    `\\n[ \\t]*const ${escapeReg(axis)} = ${escapeReg(propLocal)} \\?\\? ${escapeReg(internal)}[ \\t]*`).exec(source)
  if (!blobMatch) throw Object.assign(new Error(`could not locate the "${axis}" switch hook (hand-edited?) — refusing`), { status: 422 })
  // (b) the onClick guard — recognized block-arrow shape + this axis's guard present
  const root = findRootReturnedElement(fn, sf)
  if (!root) throw Object.assign(new Error('no root JSX element'), { status: 422 })
  const opening = ts.isJsxElement(root) ? root.openingElement : root
  const onClick = opening.attributes.properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === 'onClick')
  const inner = onClick?.initializer && ts.isJsxExpression(onClick.initializer) ? onClick.initializer.expression : undefined
  if (!onClick || !inner || !ts.isArrowFunction(inner) || !ts.isBlock(inner.body)) throw Object.assign(new Error(`onClick has an unrecognized shape — can't safely remove the "${axis}" tap-switch guard (hand-edited?)`), { status: 422 })
  const mine = inner.body.statements.filter((st) => ts.isIfStatement(st) && new RegExp(`\\bif \\(${escapeReg(propLocal)} == null\\)`).test(st.getText(sf)))
  if (!mine.length) throw Object.assign(new Error(`no "${axis}" tap guard in the onClick (hand-edited?) — refusing`), { status: 422 })
  const onlyMine = inner.body.statements.length === mine.length // this axis's guard(s) are the only content
  // ── all recognized → compute EVERY edit on the original source, apply high→low (offset-safe, single pass) ──
  const edits: { s: number; e: number }[] = []
  const bindEdit = { s: bind.getStart(sf), e: bind.getEnd(), t: `${axis} = '${dflt}'` } // 1) revert aliased binding → defaulted destructure
  edits.push({ s: blobMatch.index, e: blobMatch.index + blobMatch[0].length }) // 2) remove the blob
  if (onlyMine) { let s = onClick.getStart(sf); if (source[s - 1] === ' ') s -= 1; edits.push({ s, e: onClick.getEnd() }) } // 3a) drop the whole onClick
  else for (const st of mine) { let e = st.getEnd(); while (source[e] === ';' || source[e] === ' ') e++; edits.push({ s: st.getStart(sf), e }) } // 3b) remove only this axis's guard
  const all = [{ ...bindEdit }, ...edits.map((x) => ({ ...x, t: '' }))].sort((a, b) => b.s - a.s)
  for (const ed of all) source = source.slice(0, ed.s) + ed.t + source.slice(ed.e)
  // drop the now-unused `import { useState }` if no switch connector remains (kept it clean, no dead import)
  if (!/\buseState\s*\(/.test(source)) source = source.replace(/import \{ useState \} from 'react'\n/, '')
  assertValidTsx(abs, source) // refuse-not-corrupt
  await fs.writeFile(abs, source, 'utf8')
  return { ok: true, file: op.file, newValueText: `switch connector removed: ${axis}` }
}

// ─── I0: ComponentModel READ (blueprint §1) — source IS the model ────────────────
export type ComponentModel = {
  name: string
  file: string
  cssModule: string | null    // relative path, null = not yet promoted (inline-styled)
  rootClass: string | null    // the base local class, null pre-promotion
  root: { line: number; col: number } | null // 1-based position of the root returned element (for auto-promote)
  props: { name: string; tsType: string; optional: boolean; default?: string }[]
  variantAxes: { axis: string; values: string[]; defaultValue: string }[]  // D1: config variants = N INDEPENDENT axes (§6.1); each = one string-union prop
  nativeVariants: { id: string; props: Record<string, string | number | boolean | null> }[]
  // §0/§1 UNIFIED: EVERY scoped .module.css rule — single-part OR combinatorial — decomposed into one shape
  // in ONE list, so re-read reflects truth (no rule silently dropped). axisValues=[] + pseudo = a plain
  // interaction rule; a single axis-value = one axisValues entry; legacyName = a pre-axes single-variant class.
  rules: { selector: string; axisValues: { axis: string; value: string }[]; semantic: string[]; pseudo?: string; legacyName?: string; decls: Record<string, string> }[]
  structure: StructureNode | null  // D6: recursive JSX tree of the component (server mirror of engine.ts buildLayerTree)
  // I4 (§3.6/D4): connectors read back from the SIDE-CHANNEL comments (never inferred from JSX/CSS shape).
  // `state` = the base transition's `@fc-transition: spring …`; `switch` = the `@fc-connector: tap axis→to`.
  connectors: { mode: 'state' | 'switch'; trigger: string; to: { axis?: string; value?: string; state?: string }; transition?: { kind: 'spring'; stiffness: number; damping: number; mass: number }; cycle?: boolean }[]
}
// I6/§1 (line 60): each node carries the source {line,col} that set-variant-structure addresses AND the
// condVariant guard it sits under (which axis-value the guarded subtree diverges on), so re-read is lossless.
export type StructureNode = { tag: string; class?: string; name?: string; line?: number; col?: number; condVariant?: { axis: string; value: string; negated?: boolean }; children: StructureNode[] }

// ─── I6 (§3.9/D5): structural-variant guard parsing (shared by the WRITE op + the READ mirror) ──────────
type CondGuard = { axis: string; value: string; negated?: boolean }
/** Parse an equality guard `<ident> === '<lit>'` / `<ident> !== '<lit>'` → its axis+value (negated for !==). */
function parseEqGuard(e: ts.Expression): CondGuard | null {
  if (!ts.isBinaryExpression(e) || !ts.isIdentifier(e.left) || !ts.isStringLiteral(e.right)) return null
  if (e.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken) return { axis: e.left.text, value: e.right.text }
  if (e.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken) return { axis: e.left.text, value: e.right.text, negated: true }
  return null
}
/** Unwrap parentheses to a single JSX element (a structural-variant subtree is ONE element, never a fragment). */
function unwrapJsxElement(e: ts.Expression): ts.JsxElement | ts.JsxSelfClosingElement | null {
  let x: ts.Expression = e
  while (ts.isParenthesizedExpression(x)) x = x.expression
  return ts.isJsxElement(x) || ts.isJsxSelfClosingElement(x) ? x : null
}
/** The axis a `{ … }` JSX-expression child guards on, if it's a structural-variant guard (`&&` or ternary). */
function guardAxisOf(expr: ts.Expression): string | null {
  if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return parseEqGuard(expr.left)?.axis ?? null
  if (ts.isConditionalExpression(expr)) return parseEqGuard(expr.condition)?.axis ?? null
  return null
}
/** Guarded structural subtrees inside a `{ … }` JSX-expression child — the READ mirror of set-variant-structure:
 * `{c && <el/>}` → [el@cond]; `{c ? <a/> : <b/>}` → [a@cond, b@¬cond]. */
function structuralGuards(expr: ts.Expression): { el: ts.JsxElement | ts.JsxSelfClosingElement; cond: CondGuard }[] {
  if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
    const cond = parseEqGuard(expr.left); const el = unwrapJsxElement(expr.right)
    return cond && el ? [{ el, cond }] : []
  }
  if (ts.isConditionalExpression(expr)) {
    const cond = parseEqGuard(expr.condition); const a = unwrapJsxElement(expr.whenTrue); const b = unwrapJsxElement(expr.whenFalse)
    const out: { el: ts.JsxElement | ts.JsxSelfClosingElement; cond: CondGuard }[] = []
    if (cond && a) out.push({ el: a, cond })
    if (cond && b) out.push({ el: b, cond: { axis: cond.axis, value: cond.value, negated: !cond.negated } })
    return out
  }
  return []
}

/** I6 (blueprint §3.9): STRUCTURAL variants — a per-axis-value LAYER divergence compiled to FLAT conditional
 * JSX (one guard per subtree, keyed on the bare axis prop — never nested ternaries). Target = source {line,col}
 * via findJsxAt (same as promote-element/set-instance-prop). add = show-in-value `{axis === 'v' && (…)}`;
 * remove = hide-in-value `{axis !== 'v' && (<target/>)}` (the node STAYS in source, guarded — other values
 * keep it); swap = the ONE allowed single-level ternary `{axis === 'v' ? (<jsx/>) : (<target/>)}`. assertValidTsx
 * before write (never silent corruption). Refuses 422: target under a DIFFERENT axis's guard (ambiguous nesting);
 * DEEP REPARENTING (add-child into a void element / sibling where the parent isn't a JSX children list) — the
 * explicit walled edge: "add/remove/swap within a subtree only". */
async function setVariantStructure(op: Extract<WriteOp, { kind: 'set-variant-structure' }>): Promise<{ ok: true; file: string; newValueText: string }> {
  const abs = jailComponentWrite(op.file)
  const source = (await fs.readFile(abs)).toString('utf8')
  const sf = ts.createSourceFile(abs, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
  const { axis, value } = op.axisValue

  // F-I6-1/F-I6-2 (§8/§D2, lead's verify): the guard emits `{${axis} === 'v'}` by the PUBLIC axis name and
  // compares to a union member. A bogus axis → `{notAProp === 'v'}` (TS2304), a value outside the union →
  // `{shape === 'triangle'}` (TS2367), and an ALIASED binding `{ size: sizeProp }` with no resolved `const size`
  // → `{size === 'v'}` where `size` isn't in scope (TS2304) all compile to type-invalid code the syntax-only
  // assertValidTsx can't catch. Validate here (refuse rather than corrupt) so `${axis}` is always a real,
  // in-scope, string-union axis before any write.
  {
    let fn: ts.FunctionDeclaration | ts.ArrowFunction | undefined
    for (const st of sf.statements) {
      if (ts.isFunctionDeclaration(st) && st.name && /^[A-Z]/.test(st.name.text)) { fn = st; break }
      if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations)
        if (ts.isIdentifier(d.name) && /^[A-Z]/.test(d.name.text) && d.initializer && ts.isArrowFunction(d.initializer)) fn = d.initializer
    }
    const param = fn?.parameters[0]
    const bindingEl = param && ts.isObjectBindingPattern(param.name) ? param.name.elements.find((el) => {
      const pub = el.propertyName && ts.isIdentifier(el.propertyName) ? el.propertyName.text : (ts.isIdentifier(el.name) ? el.name.text : undefined)
      return pub === axis
    }) : undefined
    if (!bindingEl) throw Object.assign(new Error(`axis "${axis}" is not a prop on this component`), { status: 422 })
    const member = param && param.type && ts.isTypeLiteralNode(param.type)
      ? param.type.members.find((m): m is ts.PropertySignature => ts.isPropertySignature(m) && !!m.name && m.name.getText(sf) === axis)
      : undefined
    const isStrLit = (t: ts.TypeNode): boolean => ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)
    const isStringUnion = member?.type ? (ts.isUnionTypeNode(member.type) ? member.type.types.every(isStrLit) : isStrLit(member.type)) : false
    if (!isStringUnion) throw Object.assign(new Error(`prop "${axis}" isn't a config variant axis (not a string-literal union) — can't be used as a structural-variant guard`), { status: 422 })
    const vals = extractUnionValues(member!.type!)
    if (!vals.includes(value)) throw Object.assign(new Error(`value "${value}" is not one of prop "${axis}"'s declared values: [${vals.join(', ')}]`), { status: 422 })
    // F-I6-2 (QA/lead, option A): `${axis}` (the public name) is in scope as a runtime value for a plain
    // `{ size }` binding OR a switch-connector-resolved `const size = sizeProp ?? sizeInternal`. An ALIASED
    // binding `{ size: sizeProp }` with NO resolved const leaves only the local name in scope. setConnector's
    // rename + const-injection are ONE atomic edit (the only `propertyName`-setting site in lib.ts), so an
    // aliased binding without that const is unreachable via any real op — only hand-authorable. Refuse it (§8)
    // so `${axis}` stays valid and the READ stays on the public axis for every reachable state (no reverse-map).
    const localName = ts.isIdentifier(bindingEl.name) ? bindingEl.name.text : axis
    if (localName !== axis) {
      const body = fn && ts.isFunctionDeclaration(fn) ? fn.body : (fn && ts.isArrowFunction(fn) && fn.body && ts.isBlock(fn.body) ? fn.body : undefined)
      let hasResolvedConst = false
      body?.statements.forEach((st) => { if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name) && d.name.text === axis) hasResolvedConst = true })
      if (!hasResolvedConst) throw Object.assign(new Error(`axis "${axis}" is aliased ({ ${axis}: ${localName} }) without a resolved value — not a supported structural-variant target (§8)`), { status: 422 })
    }
  }

  const loc = op.edit.op === 'add' ? op.edit.anchor : op.edit.target
  const opening = findJsxAt(sf, loc.line, loc.col)
  if (!opening) throw Object.assign(new Error(`no JSX element at ${loc.line}:${loc.col}`), { status: 404 })
  // full subtree = the JsxElement (opening's parent) or the self-closing element itself
  const node: ts.JsxElement | ts.JsxSelfClosingElement = ts.isJsxOpeningElement(opening) ? (opening.parent as ts.JsxElement) : opening

  // Refusal — target already under ANY structural guard. §3.9 is FLAT: "one guard per subtree, never nested."
  // A DIFFERENT-axis guard nests ambiguously; a SAME-axis guard nests a contradiction (diff value) or a
  // redundant always-true guard (same value) — either way a nested guard the flat model can't represent, and
  // (F-M-I6, expert's Meta edge) silently mis-renders. This also covers editing inside a swap ternary's branch
  // (the ternary IS a guard). Refuse both — the divergence must be authored at the OUTER guard.
  for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
    if (ts.isJsxExpression(p) && p.expression) {
      const ax = guardAxisOf(p.expression)
      if (ax) throw Object.assign(new Error(`target is already inside the "${ax}" axis's structural guard — edit at the outer guard (§3.9 keeps structural guards flat, never nested)`), { status: 422 })
    }
  }

  const REPARENT = `deep reparenting unsupported: add/remove/swap within a subtree only`
  const nodeText = source.slice(node.getStart(sf), node.getEnd())
  const lineStart = source.lastIndexOf('\n', node.getStart(sf)) + 1
  const indent = source.slice(lineStart, node.getStart(sf)).match(/^[ \t]*/)?.[0] ?? ''

  let start: number, end: number, replacement: string
  if (op.edit.op === 'add') {
    const guarded = `{${axis} === '${value}' && (\n${indent}  ${op.edit.jsx}\n${indent})}`
    if (op.edit.position === 'firstChild' || op.edit.position === 'lastChild') {
      // a subtree to add WITHIN requires a paired element; a void (self-closing) node has none → walled edge.
      if (!ts.isJsxElement(node)) throw Object.assign(new Error(REPARENT), { status: 422 })
      if (op.edit.position === 'firstChild') { start = end = node.openingElement.getEnd(); replacement = `\n${indent}  ${guarded}` }
      else { start = end = node.closingElement.getStart(sf); replacement = `${guarded}\n${indent}` }
    } else {
      // a sibling requires the anchor's parent to BE a JSX children list; otherwise placing it reparents → walled.
      const par = node.parent
      if (!(ts.isJsxElement(par) || ts.isJsxFragment(par))) throw Object.assign(new Error(REPARENT), { status: 422 })
      if (op.edit.position === 'before') { start = end = node.getStart(sf); replacement = `${guarded}\n${indent}` }
      else { start = end = node.getEnd(); replacement = `\n${indent}${guarded}` }
    }
  } else if (op.edit.op === 'remove') {
    start = node.getStart(sf); end = node.getEnd()
    replacement = `{${axis} !== '${value}' && (\n${indent}  ${nodeText}\n${indent})}`
  } else { // swap — the one allowed single-level ternary, at the swap site only
    start = node.getStart(sf); end = node.getEnd()
    replacement = `{${axis} === '${value}' ? (\n${indent}  ${op.edit.jsx}\n${indent}) : (\n${indent}  ${nodeText}\n${indent})}`
  }

  const next = source.slice(0, start) + replacement + source.slice(end)
  assertValidTsx(abs, next) // F1: re-parse the OUTPUT; any structurally-invalid result (e.g. wrapping the root return) → clean 422, never a corrupt write
  await fs.writeFile(abs, next)
  return { ok: true, file: op.file, newValueText: replacement }
}

/** D6: build the recursive JSX-element tree of a component (server-side mirror of the runtime
 * engine.ts buildLayerTree). Static JSX children only; name = data-name ‖ styles class ‖ (omit). */
function buildStructure(el: ts.JsxElement | ts.JsxSelfClosingElement, sf: ts.SourceFile): StructureNode {
  const opening = ts.isJsxElement(el) ? el.openingElement : el
  const tag = opening.tagName.getText(sf)
  const attr = (nm: string): string | undefined => {
    const a = opening.attributes.properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === nm)
    if (!a?.initializer) return undefined
    return ts.isStringLiteral(a.initializer) ? a.initializer.text : ts.isJsxExpression(a.initializer) ? (a.initializer.expression?.getText(sf) ?? undefined) : a.initializer.getText(sf)
  }
  const cls = /styles\.([\w$]+)/.exec(attr('className') ?? '')?.[1]
  const name = attr('data-name') ?? cls
  const lc = sf.getLineAndCharacterOfPosition(opening.getStart(sf)) // I6/§3.9: the address set-variant-structure uses
  const children: StructureNode[] = []
  if (ts.isJsxElement(el)) for (const c of el.children) {
    if (ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c)) children.push(buildStructure(c, sf))
    // I6/D5: recurse into structural-variant guards `{axis === 'v' && <el/>}` / `{axis === 'v' ? … : …}` —
    // the I0 gap where guarded subtrees were dropped from the tree. Tag each with the condVariant it sits under.
    else if (ts.isJsxExpression(c) && c.expression) {
      for (const g of structuralGuards(c.expression)) children.push({ ...buildStructure(g.el, sf), condVariant: g.cond })
    }
  }
  return { tag, ...(cls ? { class: cls } : {}), ...(name ? { name } : {}), line: lc.line + 1, col: lc.character + 1, children }
}

type DecomposedRule = { axisValues: { axis: string; value: string }[]; semantic: string[]; pseudo?: string; legacyName?: string } // D-5: internal only (no external refs)
/** Decompose a .module.css scoped selector into the UNIFIED shape (blueprint §1/§3.2) — the READ mirror of
 * the WRITE composer, so EVERY scoped rule (single-part OR combinatorial like
 * `.base.size_lg.variant_primary[data-loading]:hover`) decomposes into one shape and NONE is dropped (§0
 * re-read reflects truth). `axisNames` (the component's variantAxes) distinguishes an axis token `size_lg`
 * from a legacy single-variant class `.secondary`. Returns 'base' for the base rule, null for non-`.base`. */
function decomposeRule(sel: string, base: string, axisNames: string[]): 'base' | DecomposedRule | null {
  const first = sel.split(',')[0].trim() // dual pseudo selectors: `.base:hover, :global([data-fc-preview])…`
  const b = `.${base}`
  if (first === b) return 'base'
  if (!first.startsWith(b)) return null
  let rest = first.slice(b.length)
  const classNames: string[] = []; const semantic: string[] = []; let pseudo: string | undefined
  const tok = /^\.([\w-]+)|^\[data-([\w-]+)\]|^:([\w-]+)/
  while (rest.length) {
    const m = tok.exec(rest)
    if (!m) return null // unrecognized remainder → not a clean scoped selector
    if (m[1] !== undefined) classNames.push(m[1])
    else if (m[2] !== undefined) semantic.push(m[2])
    else pseudo = m[3]
    rest = rest.slice(m[0].length)
  }
  const axisValues: { axis: string; value: string }[] = []; let legacyName: string | undefined
  for (const cn of classNames) {
    const us = cn.indexOf('_')
    if (us > 0 && axisNames.includes(cn.slice(0, us))) axisValues.push({ axis: cn.slice(0, us), value: cn.slice(us + 1) })
    else legacyName = cn // a legacy single-variant class (`.secondary`) — no matching axis
  }
  return { axisValues, semantic, ...(pseudo ? { pseudo } : {}), ...(legacyName ? { legacyName } : {}) }
}

/** Parse a component .tsx (+ its .module.css) → the structured ComponentModel. READ layer of the
 * bidirectional compiler: after every write the editor re-reads this so nothing drifts from source. */
export async function parseComponentModel(file: string): Promise<ComponentModel> {
  const abs = jailComponent(file)
  const source = (await fs.readFile(abs)).toString('utf8')
  return parseComponentModelSnapshot({
    file,
    fileName: abs,
    source,
    strictDependencies: false,
    readCss: async (cssFile) => {
      const cssAbs = jailModuleCss(cssFile)
      return { fileName: cssAbs, source: (await fs.readFile(cssAbs)).toString('utf8') }
    },
  })
}

export async function parseComponentModelFromSource(input: {
  file: string
  source: string
  fileName?: string
  cssSources?: Record<string, string>
}): Promise<ComponentModel> {
  return parseComponentModelSnapshot({
    file: input.file,
    fileName: input.fileName ?? input.file,
    source: input.source,
    strictDependencies: true,
    readCss: async (cssFile) => {
      const source = input.cssSources?.[cssFile]
      if (source === undefined) {
        throw Object.assign(new Error(`exact source dependency required: ${cssFile}`), {
          code: 'SOURCE_DEPENDENCY_REQUIRED',
          status: 422,
          dependency: cssFile,
        })
      }
      return { fileName: cssFile, source }
    },
  })
}

async function parseComponentModelSnapshot(input: {
  file: string
  fileName: string
  source: string
  strictDependencies: boolean
  readCss: (file: string) => Promise<{ fileName: string; source: string }>
}): Promise<ComponentModel> {
  const { file, fileName: abs, source } = input
  const sf = ts.createSourceFile(abs, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
  const name = path.basename(abs, path.extname(abs))

  // props ← the exported component function's first (destructured) param + its type literal.
  const props: ComponentModel['props'] = []
  let fn: ts.FunctionDeclaration | ts.ArrowFunction | undefined
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name && /^[A-Z]/.test(st.name.text)) { fn = st; break }
    if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && /^[A-Z]/.test(d.name.text) && d.initializer && ts.isArrowFunction(d.initializer)) { fn = d.initializer }
    }
  }
  // root returned element position (for auto-promote on edit-entry) + the recursive structure (D6)
  let root: { line: number; col: number } | null = null
  let structure: StructureNode | null = null
  if (fn) {
    const rootEl = findRootReturnedElement(fn, sf)
    if (rootEl) {
      const opening = ts.isJsxElement(rootEl) ? rootEl.openingElement : rootEl
      const lc = sf.getLineAndCharacterOfPosition(opening.getStart(sf))
      root = { line: lc.line + 1, col: lc.character + 1 }
      structure = buildStructure(rootEl, sf)
    }
  }
  const param = fn?.parameters[0]
  if (param && ts.isObjectBindingPattern(param.name)) {
    const typeMembers = new Map<string, { type: string; optional: boolean }>()
    if (param.type && ts.isTypeLiteralNode(param.type)) for (const m of param.type.members) {
      if (ts.isPropertySignature(m) && m.name) typeMembers.set(m.name.getText(sf), { type: m.type?.getText(sf) ?? 'unknown', optional: !!m.questionToken })
    }
    for (const e of param.name.elements) {
      if (!ts.isIdentifier(e.name)) continue
      // PUBLIC prop name = the property name (matches the type member + what consumers pass), not the local
      // binding — a switch connector renames `{ size }` → `{ size: sizeProp }` (D3 controllable), and the axis
      // must still read as `size` (I4 connectors). Unaliased bindings have no propertyName → the local name is the public name.
      const pn = e.propertyName && ts.isIdentifier(e.propertyName) ? e.propertyName.text : e.name.text
      const t = typeMembers.get(pn)
      props.push({ name: pn, tsType: t?.type ?? 'unknown', optional: t?.optional ?? false, default: e.initializer?.getText(sf) })
    }
  }
  // variantAxes (D1, §6.1) — each STRING-UNION prop is a config axis; the union prop is the source of truth
  // (values + default), so an axis lists in the model the moment add-variant-axis runs, before any
  // `.base.<axis>_<value>` CSS rule exists (mirrors the semantic-state derive-from-prop pattern).
  const variantAxes: ComponentModel['variantAxes'] = []
  for (const p of props) {
    const vals = [...p.tsType.matchAll(/'([^']*)'/g)].map((m) => m[1])
    if (!vals.length) continue // not a string-literal union → not a config axis (boolean/string/number props)
    const def = p.default ? p.default.replace(/^['"]|['"]$/g, '') : vals[0]
    variantAxes.push({ axis: p.name, values: vals, defaultValue: vals.includes(def) ? def : vals[0] })
  }
  const nativeVariants = parseNativeVariantRegistry(sf)

  // cssModule ← the `import styles from './X.module.css'` specifier.
  let cssModule: string | null = null
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st) && st.importClause?.name?.text === 'styles') {
      const spec = st.moduleSpecifier.getText(sf).replace(/^['"]|['"]$/g, '')
      if (spec.endsWith('.module.css')) cssModule = file.replace(/[^/\\]+$/, spec.replace(/^\.\//, ''))
    }
  }

  const rules: ComponentModel['rules'] = []
  const connectors: ComponentModel['connectors'] = []
  let rootClass: string | null = null
  if (cssModule) {
    try {
      const { fileName: cssAbs, source: css } = await input.readCss(cssModule)
      const root = postcss.parse(css, { from: cssAbs })
      // base class = the first bare `.<ident>` rule (convention: `.base`).
      const baseRule = root.nodes.find((n): n is Rule => n.type === 'rule' && /^\.[\w-]+$/.test(n.selector.split(',')[0].trim()))
      rootClass = baseRule ? baseRule.selector.split(',')[0].trim().slice(1) : null
      const axisNames = variantAxes.map((a) => a.axis)
      if (rootClass) for (const node of root.nodes) {
        if (node.type !== 'rule') continue
        const d = decomposeRule((node as Rule).selector, rootClass, axisNames)
        if (!d || d === 'base') continue // base rule + non-scoped rules aren't deltas
        const decls: Record<string, string> = {}
        for (const dd of (node as Rule).nodes) if (dd.type === 'decl') decls[(dd as Declaration).prop] = (dd as Declaration).value
        rules.push({ selector: (node as Rule).selector, axisValues: d.axisValues, semantic: d.semantic, ...(d.pseudo ? { pseudo: d.pseudo } : {}), ...(d.legacyName ? { legacyName: d.legacyName } : {}), decls })
      }
      // I4/D4: STATE connector read — from the `@fc-transition: <trigger> <to.state> spring <s> <d> <m>`
      // side-channel (the base transition's motion), NOT inferred from the CSS shape (spring→linear() is
      // irreversible). F2: parse the encoded trigger + to.state (back-compat: an old spring-only comment
      // reads with the placeholders) so write→read→write preserves the full connector shape (§10-I4/D4).
      const mt = /@fc-transition:(?:\s+(\w+)\s+([\w-]+))?\s+spring\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(css)
      if (mt) connectors.push({ mode: 'state', trigger: mt[1] ?? 'state', to: mt[2] ? { state: mt[2] } : {}, transition: { kind: 'spring', stiffness: Number(mt[3]), damping: Number(mt[4]), mass: Number(mt[5]) } })
    } catch (error) {
      if (input.strictDependencies) throw error
      /* module unreadable → treat as unpromoted */ cssModule = cssModule
    }
  }
  // I4/D4: SWITCH connector read — from the mandatory `@fc-connector: tap <axis>→<to> [cycle]` side-channel
  // in the .tsx, NOT by pattern-matching the useState/onClick JSX shape (fragile across formattings).
  for (const m of source.matchAll(/@fc-connector:\s*tap\s+([A-Za-z][\w-]*)→([\w-]+)(\s+cycle)?(?:\s+default=([\w-]+))?/g)) {
    connectors.push({ mode: 'switch', trigger: 'tap', to: { axis: m[1], value: m[2] }, ...(m[3] ? { cycle: true } : {}) })
    // F-M9: the D3 rename dropped the axis's destructure default, so the variantAxes read above fell back to
    // values[0]; the side-channel carries the real default (D4 source-of-truth) — prefer it for the switched axis.
    if (m[4]) { const va = variantAxes.find((a) => a.axis === m[1]); if (va) va.defaultValue = m[4] }
  }
  // NOTE: which STATES exist (a semantic state exists from its boolean PROP even before any `.base[data-*]`
  // rule — §6.2/I1 drift fix; disabled is semantic only on a non-form root — F-M2) is DERIVED by the consumer
  // from `props` + `rules` + `structure`, not stored as a second array — the model keeps ONE rule list (§0).
  return { name, file, cssModule, rootClass, root, props, variantAxes, nativeVariants, rules, structure, connectors }
}

function parseNativeVariantRegistry(sf: ts.SourceFile): ComponentModel['nativeVariants'] {
  const declarations: Array<{ declaration: ts.VariableDeclaration; statement: ts.VariableStatement }> = []
  for (const statement of sf.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === '__onemoVariantRegistry') {
        declarations.push({ declaration, statement })
      }
    }
  }
  if (declarations.length === 0) return []
  if (declarations.length !== 1) throw projectionError('NATIVE_VARIANT_REGISTRY_INVALID', 'native variant registry must be declared exactly once')
  const { declaration, statement } = declarations[0]!
  const exported = ts.getModifiers(statement)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
  const constant = (statement.declarationList.flags & ts.NodeFlags.Const) !== 0
  if (!exported || !constant || statement.declarationList.declarations.length !== 1) {
    throw projectionError('NATIVE_VARIANT_REGISTRY_INVALID', 'native variant registry must be one exported const declaration')
  }
  let expression = declaration.initializer
  while (expression && (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression) || ts.isParenthesizedExpression(expression))) {
    expression = expression.expression
  }
  if (!expression || !ts.isObjectLiteralExpression(expression)) {
    throw projectionError('NATIVE_VARIANT_REGISTRY_INVALID', 'native variant registry must be a static object literal')
  }
  const variants: ComponentModel['nativeVariants'] = []
  const ids = new Set<string>()
  for (const property of expression.properties) {
    if (!ts.isPropertyAssignment(property) || !ts.isStringLiteralLike(property.name)) {
      throw projectionError('NATIVE_VARIANT_REGISTRY_INVALID', 'native variant registry keys must be string literals')
    }
    const id = property.name.text
    if (!/^variant_[a-f0-9]{16}$/.test(id) || ids.has(id)) {
      throw projectionError('NATIVE_VARIANT_REGISTRY_INVALID', `invalid or duplicate native variant id: ${id}`)
    }
    ids.add(id)
    let value = property.initializer
    while (ts.isAsExpression(value) || ts.isSatisfiesExpression(value) || ts.isParenthesizedExpression(value)) value = value.expression
    if (!ts.isObjectLiteralExpression(value)) {
      throw projectionError('NATIVE_VARIANT_REGISTRY_INVALID', `native variant ${id} props must be a static object literal`)
    }
    const props: Record<string, string | number | boolean | null> = {}
    for (const prop of value.properties) {
      if (!ts.isPropertyAssignment(prop) || !(ts.isIdentifier(prop.name) || ts.isStringLiteralLike(prop.name))) {
        throw projectionError('NATIVE_VARIANT_REGISTRY_INVALID', `native variant ${id} contains a non-static prop`)
      }
      const propName = ts.isIdentifier(prop.name) ? prop.name.text : prop.name.text
      if (Object.hasOwn(props, propName)) {
        throw projectionError('NATIVE_VARIANT_REGISTRY_INVALID', `native variant ${id} contains duplicate prop ${propName}`)
      }
      const initializer = prop.initializer
      if (ts.isStringLiteralLike(initializer)) props[propName] = initializer.text
      else if (ts.isNumericLiteral(initializer)) props[propName] = Number(initializer.text)
      else if (initializer.kind === ts.SyntaxKind.TrueKeyword) props[propName] = true
      else if (initializer.kind === ts.SyntaxKind.FalseKeyword) props[propName] = false
      else if (initializer.kind === ts.SyntaxKind.NullKeyword) props[propName] = null
      else throw projectionError('NATIVE_VARIANT_REGISTRY_INVALID', `native variant ${id} prop ${propName} must be a static literal`)
    }
    variants.push({ id, props })
  }
  if (variants.length === 0) throw projectionError('NATIVE_VARIANT_REGISTRY_INVALID', 'native variant registry cannot be empty')
  return variants
}

function projectionError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code, status: 422 })
}

/**
 * Token value edit — the OWNED converter loop (plan §4, tokens.config.mjs verified):
 * edit the canonical figma-var JSON in the SSOT worktree → run build-scan.mjs with
 * --consumer-root (shim dir whose onemo-next/ symlinks THIS app worktree) → tokens
 * fan out; no converter logic here. tokenPath = "<Collection>/<seg>/<seg>…".
 */
async function setTokenValue(op: Extract<WriteOp, { kind: 'set-token-value' }>): Promise<{ ok: true; file: string; newValueText: string }> {
  const ssot = process.env.EDITOR_SSOT_WORKTREE
  const consumerRoot = process.env.EDITOR_CONSUMER_ROOT
  if (!ssot || !consumerRoot) {
    throw Object.assign(new Error('EDITOR_SSOT_WORKTREE / EDITOR_CONSUMER_ROOT env unset'), { status: 501 })
  }
  const jsonPath = path.join(ssot, '11-design-system/figma-var/DS-V2.3.12--1-JULY-2026.json')
  const raw = await fs.readFile(jsonPath, 'utf8')
  const data = JSON.parse(raw) as Array<Record<string, { modes: Record<string, unknown> }>>
  const [coll, ...segs] = op.tokenPath.split('/')
  const entry = data.find((e) => Object.keys(e)[0] === coll)
  if (!entry || segs.length === 0) throw Object.assign(new Error(`token not found: ${op.tokenPath}`), { status: 404 })
  const modes = entry[coll!]!.modes
  const mode = op.theme && modes[op.theme] ? op.theme : Object.keys(modes)[0]!
  let cur = modes[mode] as Record<string, unknown>
  for (const seg of segs.slice(0, -1)) {
    cur = cur?.[seg] as Record<string, unknown>
    if (!cur) throw Object.assign(new Error(`token not found: ${op.tokenPath}`), { status: 404 })
  }
  const leaf = cur?.[segs[segs.length - 1]!] as { $type?: string; $value?: unknown; $collectionName?: string } | undefined
  if (!leaf || leaf.$type === undefined) throw Object.assign(new Error(`token not found: ${op.tokenPath}`), { status: 404 })
  leaf.$value = op.value
  delete leaf.$collectionName // literal now (mirrors resolver.ts setLiteralValue)
  await fs.writeFile(jsonPath, JSON.stringify(data, null, 2) + '\n', 'utf8')
  const { stdout } = await execFileP('node', ['build-scan.mjs', '--input', jsonPath, '--consumer-root', consumerRoot], {
    cwd: path.join(ssot, 'tools/ds-pipeline'),
  })
  return { ok: true, file: `${op.tokenPath} → converter: ${stdout.trim().split('\n').slice(-3).join(' · ')}`, newValueText: String(op.value) }
}

/** Text-content edit (E2.4): splice the single JSXText child of the element at line:col. */
async function setJsxText(op: Extract<WriteOp, { kind: 'set-jsx-text' }>): Promise<{ ok: true; file: string; newValueText: string }> {
  const abs = jailComponentWrite(op.file) // F3
  const buf = await fs.readFile(abs) // F5: one buffer, parse + splice
  const source = buf.toString('utf8')
  const sf = ts.createSourceFile(abs, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
  const opening = findJsxAt(sf, op.line, op.col)
  if (!opening) throw Object.assign(new Error(`no JSX element at ${op.line}:${op.col}`), { status: 404 })
  // opening element → its parent JsxElement → children
  const parent = opening.parent
  if (!ts.isJsxElement(parent)) throw Object.assign(new Error('self-closing or non-container element has no text child'), { status: 422 })
  const textKids = parent.children.filter(ts.isJsxText).filter((t) => t.getText(sf).trim().length > 0)
  if (textKids.length !== 1) throw Object.assign(new Error(`element has ${textKids.length} text children (need exactly 1 for v1)`), { status: 422 })
  const node = textKids[0]!
  // preserve the node's surrounding whitespace; replace only the trimmed content span
  const raw = node.getText(sf)
  const lead = raw.length - raw.trimStart().length
  const trail = raw.length - raw.trimEnd().length
  const start = node.getStart(sf) + lead, end = node.getEnd() - trail
  const current = source.slice(start, end)
  if (op.expectRaw !== undefined && current !== op.expectRaw) {
    throw Object.assign(new Error(`stale text: expected ${JSON.stringify(op.expectRaw)}, found ${JSON.stringify(current)}`), { status: 409 })
  }
  // JSX text can't contain raw { } < > — reject rather than corrupt (expression-child edits are later scope)
  if (/[{}<>]/.test(op.newText)) throw Object.assign(new Error('text contains JSX-reserved characters ({ } < >) — not a plain-text child'), { status: 422 })
  const bStart = byteLen(source.slice(0, start)), bEnd = byteLen(source.slice(0, end))
  const next = Buffer.concat([buf.subarray(0, bStart), Buffer.from(op.newText, 'utf8'), buf.subarray(bEnd)])
  await fs.writeFile(abs, next)
  return { ok: true, file: op.file, newValueText: op.newText }
}

/** Insert a JSX child (E3.5 creation): splice `snippet` before the element's closing tag. */
async function insertJsxChild(op: Extract<WriteOp, { kind: 'insert-jsx-child' }>): Promise<{ ok: true; file: string; newValueText: string }> {
  const abs = jailComponentWrite(op.file)
  const buf = await fs.readFile(abs)
  const source = buf.toString('utf8')
  const sf = ts.createSourceFile(abs, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
  const opening = findJsxAt(sf, op.line, op.col)
  if (!opening) throw Object.assign(new Error(`no JSX element at ${op.line}:${op.col}`), { status: 404 })
  const parent = opening.parent
  if (!ts.isJsxElement(parent)) throw Object.assign(new Error('self-closing element cannot hold children — select a container'), { status: 422 })
  // F2 (s58-lead): refuse a text-bearing container — inserting an element beside a text child
  // produces invalid mixed content (`<span>text <div/></span>`). Mirror setJsxText's detector.
  const hasText = parent.children.filter(ts.isJsxText).some((t) => t.getText(sf).trim().length > 0)
  if (hasText) throw Object.assign(new Error('container holds text content — insert into an element-only container'), { status: 422 })
  const closeStart = parent.closingElement!.getStart(sf) // '<' of </tag>
  const lineStart = source.lastIndexOf('\n', parent.getStart(sf)) + 1
  const parentIndent = source.slice(lineStart).match(/^[ \t]*/)?.[0] ?? ''
  // the source already has `\n<parentIndent>` before the closing tag; add 2 to reach child indent,
  // then re-establish parentIndent for the closing tag → clean, aligned diff.
  const insert = `  ${op.snippet}\n${parentIndent}`
  const bOff = byteLen(source.slice(0, closeStart))
  const next = Buffer.concat([buf.subarray(0, bOff), Buffer.from(insert, 'utf8'), buf.subarray(bOff)])
  assertValidTsx(abs, next.toString('utf8'))
  await fs.writeFile(abs, next)
  return { ok: true, file: op.file, newValueText: op.snippet }
}

/** Create a new page route (E3.5): src/app/(dev)/react-figma-pages/<slug>/page.tsx scaffold. */
async function createPage(op: Extract<WriteOp, { kind: 'create-page' }>): Promise<{ ok: true; file: string; newValueText: string; route: string }> {
  // E9: creating a page is a TRUE action in the loaded build — a new top-level route in ITS app
  // dir (Framer's New Page analog), not a write into a hardcoded editor sandbox.
  // F-E9c (lead LOW): trim leading/trailing/collapsed dashes like rename does (no /------etc)
  const base = ((op.slugBase ?? 'new-page').replace(/[^a-z0-9-]/gi, '-').toLowerCase().replace(/-+/g, '-').replace(/^-+|-+$/g, '')) || 'new-page'
  const parent = await buildAppDir()
  let slug = base, n = 1
  // unique in BOTH the sibling dir space AND the route space (groups collapse — expert #2)
  while (true) {
    let dirExists = false
    try { await fs.access(path.join(parent, slug)); dirExists = true } catch { /* free */ }
    if (!dirExists && !(await routeTaken(`/${slug}`))) break
    slug = `${base}-${++n}`
  }
  const w = op.width ?? 402, h = op.height ?? 871
  const dir = path.join(parent, slug)
  await fs.mkdir(dir, { recursive: true })
  // 3.0 fix (Dan "Plus does nothing"): the old /(^|-)([a-z])/ missed digit-led segments, so
  // slug `new-page-2` produced the INVALID identifier `PageNewPage-2` → build-500 on the 2nd
  // page and the whole editor died. Uppercase the first char of EVERY [a-z0-9] segment.
  const componentName = 'Page' + slug.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase())
  const scaffold = `export default function ${componentName}() {
  return (
    <div style={{ width: ${w}, height: ${h}, display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>
    </div>
  )
}
`
  await fs.writeFile(path.join(dir, 'page.tsx'), scaffold, 'utf8')
  return { ok: true, file: path.relative(ROOT, path.join(dir, 'page.tsx')), newValueText: slug, route: `/${slug}` }
}

/* E6.8 — layer rename for plain elements: write/update a `data-name` attribute (the HTML-standard
   metadata slot — same convention as data-testid; inert to layout/behavior). The layer tree reads
   it back as the display name, so names persist in source like Figma layer names persist in the
   .fig file. Components get TRUE renames via a separate op. */
async function setLayerName(op: Extract<WriteOp, { kind: 'set-layer-name' }>): Promise<{ ok: true; file: string; newValueText: string }> {
  const name = op.name.trim()
  if (!name || name.length > 60 || /["<>{}\\]/.test(name)) throw Object.assign(new Error('invalid layer name (max 60 chars, no quotes/brackets)'), { status: 422 })
  const abs = jailComponentWrite(op.file)
  const buf = await fs.readFile(abs)
  const source = buf.toString('utf8')
  const sf = ts.createSourceFile(abs, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
  const el = findJsxAt(sf, op.line, op.col)
  if (!el) throw Object.assign(new Error(`no JSX element at ${op.line}:${op.col}`), { status: 404 })
  const attr = el.attributes.properties.find(
    (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === 'data-name',
  )
  const [start, end, text] = attr
    ? [attr.getStart(sf), attr.getEnd(), `data-name="${name}"`]
    : [el.tagName.getEnd(), el.tagName.getEnd(), ` data-name="${name}"`]
  const bs = byteLen(source.slice(0, start)), be = byteLen(source.slice(0, end))
  const next = Buffer.concat([buf.subarray(0, bs), Buffer.from(text, 'utf8'), buf.subarray(be)])
  assertValidTsx(abs, next.toString('utf8'))
  await fs.writeFile(abs, next)
  return { ok: true, file: op.file, newValueText: name }
}

/* E6.10 — link application (engineer contract, Framer-equivalent behavior):
   · element already an <a>/<Link>: update/insert href (+ target/rel for new-tab) in place;
   · anything else: wrap the subtree in <a href … style={{ display: 'contents' }}> — display:contents
     removes the wrapper from layout, so linking never shifts geometry (real CSS, no invention).
   href sanitized (http/https//-relative/#/mailto/tel only — no javascript: injection). Parse-guarded. */
async function wrapJsxLink(op: Extract<WriteOp, { kind: 'wrap-jsx-link' }>): Promise<{ ok: true; file: string; newValueText: string }> {
  const href = op.href.trim()
  if (!href || href.length > 500 || !/^(https?:\/\/|\/|#|mailto:|tel:)/i.test(href) || /["<>]/.test(href)) {
    throw Object.assign(new Error('invalid href (http(s)://, /route, #anchor, mailto:, tel: only)'), { status: 422 })
  }
  const abs = jailComponentWrite(op.file)
  const buf = await fs.readFile(abs)
  const source = buf.toString('utf8')
  const sf = ts.createSourceFile(abs, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
  const opening = findJsxAt(sf, op.line, op.col)
  if (!opening) throw Object.assign(new Error(`no JSX element at ${op.line}:${op.col}`), { status: 404 })
  const tabAttrs = op.newTab ? ` target="_blank" rel="noreferrer"` : ''
  const tagName = opening.tagName.getText(sf)
  let next: Buffer
  if (tagName === 'a' || tagName === 'Link') {
    // update-in-place: replace existing href/target/rel attrs, or insert after the tag name
    const drop = opening.attributes.properties.filter(
      (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && ['href', 'target', 'rel'].includes(p.name.getText(sf)),
    ).sort((a, b) => b.getStart(sf) - a.getStart(sf))
    let text = source
    for (const a of drop) text = text.slice(0, a.getStart(sf)).replace(/\s+$/, '') + text.slice(a.getEnd())
    // attrs removed bottom-up (desc offsets stay valid); re-parse the edited string to find the
    // shifted tag position, then insert the fresh href/target/rel after the tag name
    const sf2 = ts.createSourceFile(abs, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
    const opening2 = findJsxAt(sf2, op.line, op.col)
    if (!opening2) throw Object.assign(new Error('element lost during attr rewrite'), { status: 422 })
    const at = opening2.tagName.getEnd()
    const out = text.slice(0, at) + ` href="${href}"${tabAttrs}` + text.slice(at)
    next = Buffer.from(out, 'utf8')
  } else {
    const el: ts.Node = ts.isJsxSelfClosingElement(opening) ? opening : opening.parent
    if (!ts.isJsxElement(el) && !ts.isJsxSelfClosingElement(el)) throw Object.assign(new Error('could not resolve the element subtree'), { status: 422 })
    const s = el.getStart(sf), e = el.getEnd()
    const bs = byteLen(source.slice(0, s)), be = byteLen(source.slice(0, e))
    const openTxt = `<a href="${href}"${tabAttrs} style={{ display: 'contents' }}>`
    next = Buffer.concat([buf.subarray(0, bs), Buffer.from(openTxt, 'utf8'), buf.subarray(bs, be), Buffer.from('</a>', 'utf8'), buf.subarray(be)])
  }
  assertValidTsx(abs, next.toString('utf8'))
  await fs.writeFile(abs, next)
  return { ok: true, file: op.file, newValueText: href }
}

/* E6.8 — TRUE component rename (Dan-approved analog for component layers): rename the component
   file + the export function + every consumer's import specifier, import binding and JSX tags.
   AST-exact (only nodes bound to THIS import are touched — no string collisions), and ALL outputs
   are parse-validated BEFORE ANY file is written (the makeComponent F1 discipline). */
async function renameComponentOp(op: Extract<WriteOp, { kind: 'rename-component' }>): Promise<{ ok: true; file: string; newValueText: string; updatedFiles: string[] }> {
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(op.name) || !/^[A-Za-z][A-Za-z0-9]*$/.test(op.newName)) {
    throw Object.assign(new Error('component names must be PascalCase identifiers'), { status: 422 })
  }
  const newName = op.newName[0].toUpperCase() + op.newName.slice(1)
  const compDir = path.join(ROOT, 'src/app/(dev)/react-figma-components')
  const fromAbs = path.join(compDir, `${op.name}.tsx`)
  const toAbs = path.join(compDir, `${newName}.tsx`)
  try { await fs.access(fromAbs) } catch { throw Object.assign(new Error(`component "${op.name}" not found`), { status: 404 }) }
  try { await fs.access(toAbs); throw Object.assign(new Error(`"${newName}" already exists`), { status: 409 }) } catch (e) { if ((e as { status?: number }).status === 409) throw e }

  const oldSpec = `@/app/(dev)/react-figma-components/${op.name}`
  const newSpec = `@/app/(dev)/react-figma-components/${newName}`
  const pending: { abs: string; rel: string; next: string }[] = []

  // 1) the component file itself — rename the exported function identifier(s)
  {
    const source = await fs.readFile(fromAbs, 'utf8')
    const sf = ts.createSourceFile(fromAbs, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
    const edits: [number, number][] = []
    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name?.text === op.name) edits.push([node.name.getStart(sf), node.name.getEnd()])
      ts.forEachChild(node, visit)
    }
    visit(sf)
    if (!edits.length) throw Object.assign(new Error(`no exported function ${op.name} in the component file`), { status: 422 })
    let next = source
    for (const [s, e] of edits.sort((a, b) => b[0] - a[0])) next = next.slice(0, s) + newName + next.slice(e)
    pending.push({ abs: toAbs, rel: `src/app/(dev)/react-figma-components/${newName}.tsx`, next })
  }

  // 2) consumers — bounded walk over src/ .tsx files containing the import specifier
  const consumers: string[] = []
  const walkDir = async (dir: string): Promise<void> => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      const p = path.join(dir, entry.name)
      if (entry.isDirectory()) await walkDir(p)
      else if (entry.name.endsWith('.tsx') && p !== fromAbs) {
        const s = await fs.readFile(p, 'utf8')
        if (s.includes(oldSpec)) consumers.push(p)
      }
    }
  }
  await walkDir(path.join(ROOT, 'src'))
  for (const abs of consumers) {
    const source = await fs.readFile(abs, 'utf8')
    const sf = ts.createSourceFile(abs, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
    const edits: { s: number; e: number; text: string }[] = []
    let localName: string | null = null
    for (const st of sf.statements) {
      if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier) || st.moduleSpecifier.text !== oldSpec) continue
      edits.push({ s: st.moduleSpecifier.getStart(sf) + 1, e: st.moduleSpecifier.getEnd() - 1, text: newSpec })
      const named = st.importClause?.namedBindings
      if (named && ts.isNamedImports(named)) for (const spec of named.elements) {
        if ((spec.propertyName ?? spec.name).text === op.name) {
          edits.push({ s: (spec.propertyName ?? spec.name).getStart(sf), e: (spec.propertyName ?? spec.name).getEnd(), text: newName })
          if (!spec.propertyName) localName = spec.name.text // unaliased → JSX tags use the same name
        }
      }
    }
    if (localName) {
      const tagVisit = (node: ts.Node) => {
        const tag = ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxClosingElement(node) ? node.tagName : null
        if (tag && ts.isIdentifier(tag) && tag.text === localName) edits.push({ s: tag.getStart(sf), e: tag.getEnd(), text: newName })
        ts.forEachChild(node, tagVisit)
      }
      tagVisit(sf)
    }
    let next = source
    for (const ed of edits.sort((a, b) => b.s - a.s)) next = next.slice(0, ed.s) + ed.text + next.slice(ed.e)
    pending.push({ abs, rel: path.relative(ROOT, abs), next })
  }

  // validate EVERY output before writing ANY (no half-renamed state)
  for (const p of pending) assertValidTsx(p.abs, p.next)
  for (const p of pending) if (p.abs !== toAbs) await fs.writeFile(p.abs, p.next, 'utf8')
  await fs.writeFile(toAbs, pending[0].next, 'utf8')
  await fs.rm(fromAbs)
  // (component stubs live elsewhere and regenerate — no page-type-stub cleanup needed here)
  return { ok: true, file: `src/app/(dev)/react-figma-components/${newName}.tsx`, newValueText: newName, updatedFiles: pending.map((p) => p.rel) }
}

/* E9 pages model (expert design s58-e9-pages-model-answer.md): pages ops are TRUE actions on the
   loaded build's app tree. Jail = DERIVED (the build's app dir), never a hardcoded folder.
   Safety = STRUCTURAL guards (leaf-only delete, page-owned files only, never home), not location
   guards. Dev-only + worktree — git is the undo. */
async function buildAppDir(): Promise<string> {
  for (const c of ['src/app', 'app']) { const p = path.join(ROOT, c); try { await fs.access(p); return p } catch { /* next candidate */ } }
  throw Object.assign(new Error('loaded build has no app dir'), { status: 422 })
}
function routeOfDir(appDir: string, absDir: string): string | undefined {
  const segs = path.relative(appDir, absDir).split(path.sep).filter(Boolean)
  if (segs.some((s) => s.startsWith('['))) return undefined
  if (segs[0] === 'api') return undefined
  const url = '/' + segs.filter((s) => !(s.startsWith('(') && s.endsWith(')'))).join('/')
  return url === '' ? '/' : url
}
const PAGE_SCAN_SKIP = new Set(['node_modules', '.git', '.next', '.turbo', 'dist', 'coverage'])
/** Editor-own routes are never page-op targets — the editor must not edit/delete its own host
 *  (expert meta finding: without this, delete-page could remove the editor's canvas). */
function assertNotEditorSelf(route: string): void {
  if (/^\/react-figma(\/|$)/.test(route)) throw Object.assign(new Error('editor-own route — not editable as a page'), { status: 422 })
}
/** Map a route back to its page dir — via the same scan the pages API uses (the fs is the registry).
 *  Symlink-safe: tracks visited realpaths so a cycle can't hang the walk (expert #6). */
async function dirForRoute(route: string): Promise<{ appDir: string; dir: string }> {
  const appDir = await buildAppDir()
  let found: string | null = null
  const seen = new Set<string>()
  const walk = async (dir: string): Promise<void> => {
    if (found) return
    let real: string
    try { real = await fs.realpath(dir) } catch { return }
    if (seen.has(real)) return
    seen.add(real)
    let entries
    try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return }
    if (entries.some((e) => e.isFile() && /^page\.(t|j)sx?$/.test(e.name)) && routeOfDir(appDir, dir) === route) { found = dir; return }
    for (const e of entries) if ((e.isDirectory() || e.isSymbolicLink()) && !e.name.startsWith('.') && !PAGE_SCAN_SKIP.has(e.name)) await walk(path.join(dir, e.name))
  }
  await walk(appDir)
  if (!found) throw Object.assign(new Error(`no page at route ${route}`), { status: 404 })
  // F-E9a (lead MED): realpath-confine before returning — fs.rm/rename would otherwise operate
  // THROUGH a mid-path symlink and escape the app tree (this repo uses symlinks). The structural
  // jail silently dropped the guarantee the old location jail gave; restore it.
  const realFound = await fs.realpath(found)
  const realApp = await fs.realpath(appDir)
  if (realFound !== realApp && !realFound.startsWith(realApp + path.sep)) throw Object.assign(new Error('resolved page dir escapes the build (symlink)'), { status: 403 })
  return { appDir, dir: found }
}
/** Route-space uniqueness (expert #2 — same failure class as the digit-slug 500): sibling-dir checks
 *  miss collisions ACROSS route groups (creating `community` beside `(store)/community` → Next
 *  parallel-route conflict → whole app 500s). The route space is the registry — check it. */
async function routeTaken(route: string): Promise<boolean> {
  try { await dirForRoute(route); return true } catch { return false }
}
/* Next dev generates type stubs per route (.next/dev/types/app/…); they linger after the source
   dir is removed and turn the typecheck gate red (meta-qa E6 batch-2 HIGH). Clearing the GENERATED
   stub is safe — it's cache, regenerated on demand. Generalized to any page dir (E9). */
async function dropPageTypeStubs(appDir: string, absDir: string): Promise<void> {
  const rel = path.relative(appDir, absDir)
  if (!rel || rel.startsWith('..')) return
  for (const p of [
    path.join(ROOT, '.next', 'dev', 'types', 'app', rel),
    path.join(ROOT, '.next', 'types', 'app', rel),
  ]) { try { await fs.rm(p, { recursive: true, force: true }) } catch { /* cache layout differs — fine */ } }
}
/** Structural delete guards — what makes a dir safely deletable AS A PAGE, wherever it lives. */
async function assertDeletablePage(appDir: string, dir: string): Promise<void> {
  if (path.resolve(dir) === path.resolve(appDir)) throw Object.assign(new Error('cannot delete the home page'), { status: 422 })
  let entries
  try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { throw Object.assign(new Error('page not found'), { status: 404 }) }
  // guard 2: only page-owned files (page.tsx + styles + static assets) — layout/route/other code = refuse
  const OWNED = /^page\.(t|j)sx?$|\.module\.css$|\.(png|jpe?g|svg|webp|gif|ico)$/
  for (const e of entries) {
    // F-E9b (lead LOW): a symlink Dirent is neither isFile nor isDirectory → it slips both guards
    // and is the subdir vector for the F-E9a follow-escape. Refuse any symlink outright.
    if (e.isSymbolicLink()) throw Object.assign(new Error(`dir contains a symlink ${e.name} — not deletable as a page`), { status: 422 })
    if (e.isFile() && !OWNED.test(e.name)) throw Object.assign(new Error(`dir contains non-page file ${e.name} — not deletable as a page`), { status: 422 })
    // guard 1: leaf only — any descendant page.tsx means child pages would be nuked
    if (e.isDirectory()) {
      const sub = path.join(dir, e.name)
      let hasChildPage = false
      const check = async (d: string): Promise<void> => {
        if (hasChildPage) return
        let es; try { es = await fs.readdir(d, { withFileTypes: true }) } catch { return }
        if (es.some((x) => x.isFile() && /^page\.(t|j)sx?$/.test(x.name))) { hasChildPage = true; return }
        for (const x of es) if (x.isDirectory()) await check(path.join(d, x.name))
      }
      await check(sub)
      if (hasChildPage) throw Object.assign(new Error('page has child pages — delete them first'), { status: 422 })
      throw Object.assign(new Error(`dir contains subdirectory ${e.name} — not deletable as a page`), { status: 422 })
    }
  }
}
async function deletePage(op: Extract<WriteOp, { kind: 'delete-page' }>): Promise<{ ok: true; file: string; newValueText: string }> {
  assertNotEditorSelf(op.route)
  // home guard by ROUTE, not dir identity — a grouped home ((group)/page.tsx) must not escape (expert #5)
  if (op.route === '/') throw Object.assign(new Error('cannot delete the home page'), { status: 422 })
  const { appDir, dir } = await dirForRoute(op.route)
  await assertDeletablePage(appDir, dir)
  await fs.rm(dir, { recursive: true })
  await dropPageTypeStubs(appDir, dir)
  return { ok: true, file: path.relative(ROOT, dir), newValueText: '(deleted)' }
}
/* 3.0/E9 (Dan): duplicate a page — a sibling dir next to the original, wherever it lives. */
async function duplicatePage(op: Extract<WriteOp, { kind: 'duplicate-page' }>): Promise<{ ok: true; file: string; newValueText: string; route: string }> {
  assertNotEditorSelf(op.route)
  const { appDir, dir } = await dirForRoute(op.route)
  const srcFile = path.join(dir, 'page.tsx')
  let source: string
  try { source = (await fs.readFile(srcFile)).toString('utf8') } catch { throw Object.assign(new Error('page not found (only page.tsx pages duplicable)'), { status: 404 }) }
  const parent = op.route === '/' ? appDir : path.dirname(dir)
  const base = `${op.route === '/' ? 'home' : path.basename(dir)}-copy`
  let slug = base, n = 1
  while (true) {
    let dirExists = false
    try { await fs.access(path.join(parent, slug)); dirExists = true } catch { /* free */ }
    const candidate = routeOfDir(appDir, path.join(parent, slug))
    if (!dirExists && (candidate === undefined || !(await routeTaken(candidate)))) break
    slug = `${base}-${++n}`
  }
  const componentName = 'Page' + slug.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase())
  const next = source.replace(/export default function\s+\w+/, `export default function ${componentName}`)
  assertValidTsx(srcFile, next)
  const target = path.join(parent, slug)
  await fs.mkdir(target, { recursive: true })
  await fs.writeFile(path.join(target, 'page.tsx'), next, 'utf8')
  return { ok: true, file: path.relative(ROOT, path.join(target, 'page.tsx')), newValueText: slug, route: routeOfDir(appDir, target) ?? `/${slug}` }
}
async function renamePage(op: Extract<WriteOp, { kind: 'rename-page' }>): Promise<{ ok: true; file: string; newValueText: string; route: string }> {
  assertNotEditorSelf(op.route)
  if (op.route === '/') throw Object.assign(new Error('cannot rename the home page'), { status: 422 })
  const { appDir, dir } = await dirForRoute(op.route)
  const base = op.newSlug.replace(/[^a-z0-9-]/gi, '-').toLowerCase().replace(/^-+|-+$/g, '')
  if (!base) throw Object.assign(new Error('invalid new name'), { status: 422 })
  const parent = path.dirname(dir)
  let slug = base, n = 1
  while (slug !== path.basename(dir)) {
    let dirExists = false
    try { await fs.access(path.join(parent, slug)); dirExists = true } catch { /* free */ }
    const candidate = routeOfDir(appDir, path.join(parent, slug))
    if (!dirExists && (candidate === undefined || !(await routeTaken(candidate)))) break
    slug = `${base}-${++n}`
  }
  const target = path.join(parent, slug)
  await fs.rename(dir, target)
  await dropPageTypeStubs(appDir, dir) // the OLD dir's generated type stub would go stale
  return { ok: true, file: path.relative(ROOT, path.join(target, 'page.tsx')), newValueText: slug, route: routeOfDir(appDir, target) ?? `/${slug}` }
}

/**
 * Extract the selected JSX subtree into its own component file + replace it with an instance (E3.5).
 * SAFE v1: only proceeds when every FREE identifier the subtree references is a top-level import of
 * the source file (those imports are copied into the new file). Any reference to local scope
 * (props/state/local const) → refuse 422. Guarantees the extracted component compiles; errs toward
 * refusal, never toward broken output. Zero-prop extraction — the subtree is inlined verbatim.
 */
/* #6 — "create a component in code" (Framer-style): scaffold a fresh, editable component file from a
   name. Same validated write as make-component (PascalCase name, collision-safe, assertValidTsx),
   but a blank starter instead of an extracted subtree. Appears in Assets + editable via Code mode. */
/* Named exports of a component file = the component + its variants (v4.1 §4). Shared by the
 * inventory route (variants metadata) and the barrel regenerator. */
export function exportedTsxNames(abs: string, source: string): string[] {
  const sf = ts.createSourceFile(abs, source, ts.ScriptTarget.ESNext, false, ts.ScriptKind.TSX)
  const names: string[] = []
  for (const st of sf.statements) {
    const isExported = (st as { modifiers?: ts.NodeArray<ts.ModifierLike> }).modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    if (!isExported) continue
    if (ts.isFunctionDeclaration(st) && st.name) names.push(st.name.text)
    else if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) names.push(d.name.text)
  }
  return names
}

/* E7.4 (KAI-9378, v4.1 N2): the library barrel is NEVER a client-write surface — the server
 * REGENERATES src/index.ts from an fs walk of the package src/ tree. Client inputs reach this
 * only as already-validated filenames; the .tsx-only write jail law is untouched. */
export async function regenerateLibraryBarrel(): Promise<void> {
  if (!LIB_ROOT) throw Object.assign(new Error('component library not installed'), { status: 403 })
  const libSrc = path.join(LIB_ROOT, 'src')
  const files: string[] = []
  const walk = async (dir: string) => {
    let entries: import('node:fs').Dirent[] = []
    try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) await walk(p)
      else if (e.isFile() && e.name.endsWith('.tsx')) files.push(p)
    }
  }
  await walk(libSrc)
  files.sort()
  const lines = ['// GENERATED barrel — server-regenerated from an fs walk of src/ (v4.1 N2). Do not hand-edit in builds.']
  for (const abs of files) {
    const names = exportedTsxNames(abs, await fs.readFile(abs, 'utf8'))
    if (names.length) {
      const spec = './' + path.relative(libSrc, abs).replace(/\.tsx$/, '').split(path.sep).join('/')
      lines.push(`export { ${names.join(', ')} } from '${spec}'`)
    }
  }
  await fs.writeFile(path.join(libSrc, 'index.ts'), lines.join('\n') + '\n', 'utf8')
}

async function createComponent(op: Extract<WriteOp, { kind: 'create-component' }>): Promise<{ ok: true; file: string; newValueText: string; componentFile: string; name: string }> {
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(op.name)) throw Object.assign(new Error('name must be a PascalCase identifier'), { status: 422 })
  const root = op.root ?? 'project'
  if (root !== 'project' && root !== 'global') throw Object.assign(new Error('root must be project|global'), { status: 422 })
  const category = op.category?.trim() ?? ''
  if (category && !/^[a-z0-9][a-z0-9-]{0,40}$/.test(category)) throw Object.assign(new Error('invalid category slug (a-z, 0-9, dashes)'), { status: 422 })
  const nameBase = op.name[0].toUpperCase() + op.name.slice(1)
  let compDir: string, relBase: string
  if (root === 'global') {
    if (!LIB_ROOT) throw Object.assign(new Error('component library not installed'), { status: 403 })
    compDir = path.join(LIB_ROOT, 'src', category || 'ungrouped')
    relBase = `${LIB_NAME}/src/${category || 'ungrouped'}` // F1 package-prefixed identity
  } else {
    compDir = path.join(ROOT, 'src/app/(dev)/react-figma-components', category)
    relBase = `src/app/(dev)/react-figma-components${category ? `/${category}` : ''}`
  }
  await fs.mkdir(compDir, { recursive: true })
  let name = nameBase, i = 1
  while (true) { try { await fs.access(path.join(compDir, `${name}.tsx`)); name = `${nameBase}${++i}` } catch { break } }
  const compAbs = path.join(compDir, `${name}.tsx`)
  const compSource = `export function ${name}() {\n  return (\n    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16, minWidth: 120, minHeight: 80, background: '#fff', borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)' }}>\n      <span style={{ font: '600 13px/1.4 system-ui' }}>${name}</span>\n    </div>\n  )\n}\n`
  assertValidTsx(compAbs, compSource)
  await fs.writeFile(compAbs, compSource, 'utf8')
  if (root === 'global') await regenerateLibraryBarrel() // new export reaches builds via barrel recompile
  const rel = `${relBase}/${name}.tsx`
  return { ok: true, file: rel, newValueText: name, componentFile: rel, name }
}
async function makeComponent(op: Extract<WriteOp, { kind: 'make-component' }>): Promise<{ ok: true; file: string; newValueText: string; componentFile: string }> {
  const abs = jailComponentWrite(op.file)
  const buf = await fs.readFile(abs)
  const source = buf.toString('utf8')
  const sf = ts.createSourceFile(abs, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
  const opening = findJsxAt(sf, op.line, op.col)
  if (!opening) throw Object.assign(new Error(`no JSX element at ${op.line}:${op.col}`), { status: 404 })
  const el: ts.Node = ts.isJsxSelfClosingElement(opening) ? opening : opening.parent
  if (!ts.isJsxElement(el) && !ts.isJsxSelfClosingElement(el)) {
    throw Object.assign(new Error('could not resolve the full element subtree'), { status: 422 })
  }

  // top-level imports: imported name → full import statement text
  const importByName = new Map<string, string>()
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause) continue
    const text = st.getText(sf), clause = st.importClause
    if (clause.name) importByName.set(clause.name.text, text)
    const nb = clause.namedBindings
    if (nb && ts.isNamedImports(nb)) for (const e of nb.elements) importByName.set(e.name.text, text)
    if (nb && ts.isNamespaceImport(nb)) importByName.set(nb.name.text, text)
  }

  // free-identifier analysis over the subtree — references NOT bound inside it, excluding JSX prop
  // names, object keys, member names, and lowercase intrinsic tag names (host strings like div/span).
  const bound = new Set<string>(), free = new Set<string>()
  const collectBinding = (n: ts.BindingName) => {
    if (ts.isIdentifier(n)) bound.add(n.text)
    else n.elements.forEach((e) => { if (ts.isBindingElement(e)) collectBinding(e.name) })
  }
  const walk = (node: ts.Node) => {
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) node.parameters.forEach((p) => collectBinding(p.name))
    if (ts.isVariableDeclaration(node)) collectBinding(node.name)
    if (ts.isIdentifier(node)) {
      const p = node.parent
      const isPropKey = ts.isPropertyAssignment(p) && p.name === node
      const isMember = ts.isPropertyAccessExpression(p) && p.name === node
      const isJsxAttrName = ts.isJsxAttribute(p) && p.name === node
      const isBindingDecl = (ts.isParameter(p) || ts.isBindingElement(p) || ts.isVariableDeclaration(p)) && (p as { name?: ts.Node }).name === node
      const isJsxTag = (ts.isJsxOpeningElement(p) || ts.isJsxSelfClosingElement(p) || ts.isJsxClosingElement(p)) && p.tagName === node
      const isIntrinsicTag = isJsxTag && /^[a-z]/.test(node.text)
      if (!isPropKey && !isMember && !isJsxAttrName && !isBindingDecl && !isIntrinsicTag) free.add(node.text)
    }
    ts.forEachChild(node, walk)
  }
  walk(el)
  const trulyFree = [...free].filter((n) => !bound.has(n))
  const missing = trulyFree.filter((n) => !importByName.has(n))
  if (missing.length) {
    throw Object.assign(new Error(`selection references local scope (${missing.join(', ')}) — extract a self-contained subtree (v1 supports only imported components/values)`), { status: 422 })
  }
  const neededImports = [...new Set(trulyFree.map((n) => importByName.get(n)!))]

  // create the component file (collision-safe), inlining the subtree verbatim.
  // Name must be a VALID JS identifier: strip non-alphanumerics, and a JS identifier cannot start
  // with a digit — prefix a letter if it would (e.g. "123box" → "C123box"), else `export function
  // 123box()` is a syntax error (peer-review finding).
  let rawBase = (op.name ?? 'Component').replace(/[^a-z0-9]/gi, '') || 'Component'
  if (!/^[a-z]/i.test(rawBase)) rawBase = 'C' + rawBase
  const nameBase = rawBase[0].toUpperCase() + rawBase.slice(1)
  const compDir = path.join(ROOT, 'src/app/(dev)/react-figma-components')
  await fs.mkdir(compDir, { recursive: true })
  let name = nameBase, i = 1
  while (true) { try { await fs.access(path.join(compDir, `${name}.tsx`)); name = `${nameBase}${++i}` } catch { break } }
  const subtree = el.getText(sf)
  // Rewrite RELATIVE import specifiers so they resolve from the new component's directory — the
  // extracted file sits at a different depth than the source, so a verbatim `../…` breaks the build
  // (module-not-found; the parse-guard only checks syntax, not resolution). Absolute/@-alias/package
  // specifiers are left untouched.
  const srcDir = path.dirname(abs)
  const rewriteImport = (text: string): string => {
    const m = text.match(/from\s+(['"])(\.[^'"]*)\1/)
    if (!m) return text
    let rel = path.relative(compDir, path.resolve(srcDir, m[2])).replace(/\\/g, '/')
    if (!rel.startsWith('.')) rel = './' + rel
    return text.replace(m[0], `from ${m[1]}${rel}${m[1]}`)
  }
  const fixedImports = neededImports.map(rewriteImport)
  const compSource = `${fixedImports.length ? fixedImports.join('\n') + '\n\n' : ''}export function ${name}() {\n  return (\n    ${subtree}\n  )\n}\n`
  const compAbs = path.join(compDir, `${name}.tsx`)

  // replace subtree with <Name /> and add the import — bottom-up splice (subtree offset > import offset)
  const elStart = el.getStart(sf), elEnd = el.getEnd()
  const lastImport = [...sf.statements].reverse().find(ts.isImportDeclaration)
  const importPos = lastImport ? lastImport.getEnd() : 0
  const importText = `import { ${name} } from '@/app/(dev)/react-figma-components/${name}'`
  const bElStart = byteLen(source.slice(0, elStart)), bElEnd = byteLen(source.slice(0, elEnd))
  const bImp = byteLen(source.slice(0, importPos))
  let next = Buffer.concat([buf.subarray(0, bElStart), Buffer.from(`<${name} />`, 'utf8'), buf.subarray(bElEnd)])
  const importInsert = importPos === 0 ? `${importText}\n` : `\n${importText}`
  next = Buffer.concat([next.subarray(0, bImp), Buffer.from(importInsert, 'utf8'), next.subarray(bImp)])
  // F1: validate BOTH outputs before writing EITHER — no half-written state on refusal
  assertValidTsx(compAbs, compSource)
  assertValidTsx(abs, next.toString('utf8'))
  await fs.writeFile(compAbs, compSource, 'utf8')
  await fs.writeFile(abs, next)
  return { ok: true, file: op.file, newValueText: `<${name} />`, componentFile: `src/app/(dev)/react-figma-components/${name}.tsx` }
}

/** Resolve the full element node (self-closing, or the opening's parent JsxElement) at line:col. */
function elementAt(sf: ts.SourceFile, line: number, col: number): ts.JsxElement | ts.JsxSelfClosingElement {
  const opening = findJsxAt(sf, line, col)
  if (!opening) throw Object.assign(new Error(`no JSX element at ${line}:${col}`), { status: 404 })
  const el = ts.isJsxSelfClosingElement(opening) ? opening : opening.parent
  if (!ts.isJsxElement(el) && !ts.isJsxSelfClosingElement(el)) {
    throw Object.assign(new Error('could not resolve the full element subtree'), { status: 422 })
  }
  return el
}

/** Delete the selected element (E3.6 More-actions): remove its whole line-span, leaving no blank line. */
async function deleteJsx(op: Extract<WriteOp, { kind: 'delete-jsx' }>): Promise<{ ok: true; file: string; newValueText: string }> {
  const abs = jailComponentWrite(op.file)
  const buf = await fs.readFile(abs)
  const source = buf.toString('utf8')
  const sf = ts.createSourceFile(abs, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
  const el = elementAt(sf, op.line, op.col)
  const lineStart = source.lastIndexOf('\n', el.getStart(sf)) // the newline before the element's line
  const cut = lineStart >= 0 ? lineStart : el.getStart(sf) // eat the leading newline+indent, else from element start
  const bStart = byteLen(source.slice(0, cut)), bEnd = byteLen(source.slice(0, el.getEnd()))
  const next = Buffer.concat([buf.subarray(0, bStart), buf.subarray(bEnd)])
  assertValidTsx(abs, next.toString('utf8'))
  await fs.writeFile(abs, next)
  return { ok: true, file: op.file, newValueText: '' }
}

/** Duplicate the selected element (E3.6 More-actions): insert a verbatim copy right after it. */
async function duplicateJsx(op: Extract<WriteOp, { kind: 'duplicate-jsx' }>): Promise<{ ok: true; file: string; newValueText: string }> {
  const abs = jailComponentWrite(op.file)
  const buf = await fs.readFile(abs)
  const source = buf.toString('utf8')
  const sf = ts.createSourceFile(abs, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
  const el = elementAt(sf, op.line, op.col)
  const lineStart = source.lastIndexOf('\n', el.getStart(sf)) + 1
  const indent = source.slice(lineStart).match(/^[ \t]*/)?.[0] ?? ''
  const subtree = el.getText(sf)
  const insert = `\n${indent}${subtree}`
  const bOff = byteLen(source.slice(0, el.getEnd()))
  const next = Buffer.concat([buf.subarray(0, bOff), Buffer.from(insert, 'utf8'), buf.subarray(bOff)])
  assertValidTsx(abs, next.toString('utf8'))
  await fs.writeFile(abs, next)
  return { ok: true, file: op.file, newValueText: subtree }
}

/** Insert a component instance (E4-G4 Assets): splice `<Name />` into the selected container +
 *  add its import if absent. Same guards as insert-jsx-child + parse-check on the output. */
async function insertComponent(op: Extract<WriteOp, { kind: 'insert-component' }>): Promise<{ ok: true; file: string; newValueText: string }> {
  // F1 (s58-lead HIGH): name/importPath are spliced RAW into a JSX tag + import statement, and
  // assertValidTsx validates SYNTAX not intent — a comment-terminated payload (e.g. importPath
  // `x'; export const X=1 //`) is syntactically valid and injects executable code. Validate both
  // as strict identifiers/paths (no quotes/semicolons/whitespace) → refuse 422 before any splice.
  if (!/^[A-Z][A-Za-z0-9]*$/.test(op.name)) {
    throw Object.assign(new Error('invalid component name — must be a PascalCase identifier'), { status: 422 })
  }
  if (!/^[@\w./()-]+$/.test(op.importPath)) {
    throw Object.assign(new Error('invalid import path — only @ word / . ( ) - characters allowed'), { status: 422 })
  }
  const abs = jailComponentWrite(op.file)
  const buf = await fs.readFile(abs)
  const source = buf.toString('utf8')
  const sf = ts.createSourceFile(abs, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
  const opening = findJsxAt(sf, op.line, op.col)
  if (!opening) throw Object.assign(new Error(`no JSX element at ${op.line}:${op.col}`), { status: 404 })
  const parent = opening.parent
  if (!ts.isJsxElement(parent)) throw Object.assign(new Error('self-closing element cannot hold children — select a container'), { status: 422 })
  const hasText = parent.children.filter(ts.isJsxText).some((t) => t.getText(sf).trim().length > 0)
  if (hasText) throw Object.assign(new Error('container holds text content — insert into an element-only container'), { status: 422 })
  const closeStart = parent.closingElement!.getStart(sf)
  const lineStart = source.lastIndexOf('\n', parent.getStart(sf)) + 1
  const parentIndent = source.slice(lineStart).match(/^[ \t]*/)?.[0] ?? ''
  const childInsert = `  <${op.name} />\n${parentIndent}`
  const alreadyImported = sf.statements.some((st) => ts.isImportDeclaration(st) && st.getText(sf).includes(op.importPath))
  const lastImport = [...sf.statements].reverse().find(ts.isImportDeclaration)
  const importPos = lastImport ? lastImport.getEnd() : 0
  const importText = `import { ${op.name} } from '${op.importPath}'`
  const bClose = byteLen(source.slice(0, closeStart))
  let next = Buffer.concat([buf.subarray(0, bClose), Buffer.from(childInsert, 'utf8'), buf.subarray(bClose)])
  if (!alreadyImported) {
    const bImp = byteLen(source.slice(0, importPos))
    const importInsert = importPos === 0 ? `${importText}\n` : `\n${importText}`
    next = Buffer.concat([next.subarray(0, bImp), Buffer.from(importInsert, 'utf8'), next.subarray(bImp)])
  }
  assertValidTsx(abs, next.toString('utf8'))
  await fs.writeFile(abs, next)
  return { ok: true, file: op.file, newValueText: `<${op.name} />` }
}

// I0 gate (LOW): writes are read-modify-write on shared files; the variant board can fire several
// scoped writes to one .module.css back-to-back. Serialize ALL writes through one queue so no concurrent
// write loses another (the transient 404 under 3 rapid writes was this race).
let writeQueue: Promise<unknown> = Promise.resolve()
export function applyWrite(op: WriteOp): Promise<{ ok: true; file: string; newValueText: string; route?: string; componentFile?: string; name?: string }> {
  const run = writeQueue.then(() => applyWriteInner(op), () => applyWriteInner(op))
  writeQueue = run.catch(() => undefined)
  return run
}
async function applyWriteInner(op: WriteOp): Promise<{ ok: true; file: string; newValueText: string; route?: string; componentFile?: string; name?: string }> {
  if (op.kind === 'insert-component') return insertComponent(op)
  if (op.kind === 'delete-jsx') return deleteJsx(op)
  if (op.kind === 'duplicate-jsx') return duplicateJsx(op)
  if (op.kind === 'create-component') return createComponent(op)
  if (op.kind === 'delete-page') return deletePage(op)
  if (op.kind === 'duplicate-page') return duplicatePage(op)
  if (op.kind === 'rename-page') return renamePage(op)
  if (op.kind === 'set-layer-name') return setLayerName(op)
  if (op.kind === 'rename-component') return renameComponentOp(op)
  if (op.kind === 'wrap-jsx-link') return wrapJsxLink(op)
  if (op.kind === 'make-component') return makeComponent(op)
  if (op.kind === 'promote-element') return promoteElement(op)
  if (op.kind === 'write-scoped-declaration') return writeScopedDeclaration(op)
  if (op.kind === 'add-state') return addState(op)
  if (op.kind === 'add-variant-axis') return addVariantAxis(op)
  if (op.kind === 'add-variant-value') return addVariantValue(op)
  if (op.kind === 'expose-as-prop') return exposeAsProp(op)
  if (op.kind === 'set-instance-prop') return setInstanceProp(op)
  if (op.kind === 'set-connector') return setConnector(op)
  if (op.kind === 'remove-connector') return removeConnector(op)
  if (op.kind === 'set-variant-structure') return setVariantStructure(op)
  if (op.kind === 'create-page') return createPage(op)
  if (op.kind === 'set-token-value') return setTokenValue(op)
  if (op.kind === 'set-jsx-style') return setJsxStyle(op)
  if (op.kind === 'set-jsx-text') return setJsxText(op)
  if (op.kind === 'insert-jsx-child') return insertJsxChild(op)
  if (op.kind === 'add-state-rule') {
    // E8 item 9 (hover/tap): append `.cls:hover { ... }` to the element's OWN module.css —
    // real shippable CSS (Framer semantics), parse-guarded, jailed like every css write.
    if (op.state !== 'hover' && op.state !== 'active') throw Object.assign(new Error('state must be hover|active'), { status: 422 })
    if (!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(op.localClass)) throw Object.assign(new Error('invalid class name'), { status: 422 })
    if (!Array.isArray(op.decls) || op.decls.length === 0) throw Object.assign(new Error('decls required'), { status: 422 })
    for (const [prop, value] of op.decls) {
      if (!/^[a-z-]+$/.test(prop) || /[{};]/.test(value)) throw Object.assign(new Error(`invalid decl: ${prop}`), { status: 422 })
    }
    const abs = jailModuleCss(op.file)
    const source = (await fs.readFile(abs)).toString('utf8')
    const selector = `.${op.localClass}:${op.state}`
    const body = op.decls.map(([prop, value]) => `  ${prop}: ${value};`).join('\n')
    // one rule per class+state: replace the existing block if we wrote one before, else append
    const marker = new RegExp(`\\n?${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{[^}]*\\}`, 'm')
    const next = marker.test(source)
      ? source.replace(marker, `\n${selector} {\n${body}\n}`)
      : `${source.replace(/\n*$/, '')}\n\n${selector} {\n${body}\n}\n`
    await postcss.parse(next, { from: abs }) // parse-guard: refuse rather than corrupt
    await fs.writeFile(abs, next, 'utf8')
    return { ok: true, file: op.file, newValueText: `${selector} (${op.decls.length} decls)` }
  }
  if (op.kind === 'add-declaration') {
    const abs = jailModuleCss(op.file)
    const buf = await fs.readFile(abs)
    const insert = Buffer.from(`\n${op.indent}${op.prop}: ${op.valueText};`, 'utf8')
    await fs.writeFile(abs, Buffer.concat([buf.subarray(0, op.insertOffset), insert, buf.subarray(op.insertOffset)]))
    return { ok: true, file: op.file, newValueText: op.valueText }
  }
  const { decl } = op
  const abs = jailModuleCss(decl.file)
  const buf = await fs.readFile(abs)
  const current = buf.subarray(decl.valueRange.start, decl.valueRange.end)
  if (!current.equals(Buffer.from(decl.valueText, 'utf8'))) {
    throw Object.assign(new Error(`stale DeclRef: expected "${decl.valueText}", found "${current.toString('utf8')}"`), { status: 409 })
  }
  const newValueText =
    op.kind === 'set-declaration' ? op.newValueText
    : op.kind === 'set-shorthand-slots' ? op.slots.join(' ')
    : `var(${op.token})`
  const next = Buffer.concat([buf.subarray(0, decl.valueRange.start), Buffer.from(newValueText, 'utf8'), buf.subarray(decl.valueRange.end)])
  await fs.writeFile(abs, next)
  return { ok: true, file: decl.file, newValueText }
}
