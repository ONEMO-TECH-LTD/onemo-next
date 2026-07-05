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
import { promises as fs } from 'node:fs'
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

export function jailModuleCss(rel: string): string {
  const abs = path.resolve(ROOT, rel)
  if (!abs.startsWith(path.join(ROOT, 'src') + path.sep) || !abs.endsWith('.module.css')) {
    throw Object.assign(new Error(`outside write jail: ${rel}`), { status: 403 })
  }
  return abs
}

// component jail = src/ (routes) + storybook/ (hosted canvas screens, e.g. Editor402)
const COMPONENT_ROOTS = [path.join(ROOT, 'src'), path.join(ROOT, 'storybook')]
export function jailComponent(rel: string): string {
  const abs = path.resolve(ROOT, rel)
  if (!COMPONENT_ROOTS.some((r) => abs.startsWith(r + path.sep)) || !/\.(tsx|ts)$/.test(abs)) {
    throw Object.assign(new Error(`outside read jail: ${rel}`), { status: 403 })
  }
  return abs
}

/** WRITE jail for JSX ops (F3, s58-lead): .tsx ONLY — never .ts (no JSX to write there anyway,
 *  and it keeps non-component sources like lib.ts unwritable even though they pass the read jail). */
function jailComponentWrite(rel: string): string {
  const abs = path.resolve(ROOT, rel)
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

export type WriteOp =
  | { kind: 'set-declaration'; decl: DeclRef; newValueText: string }
  | { kind: 'set-shorthand-slots'; decl: DeclRef; slots: string[] }
  | { kind: 'bind-token'; decl: DeclRef; token: string }
  | { kind: 'add-declaration'; file: string; insertOffset: number; indent: string; prop: string; valueText: string }
  | { kind: 'set-token-value'; tokenPath: string; theme?: string; value: string | number }
  | { kind: 'set-jsx-style'; file: string; line: number; col: number; prop: string; value: string; expectRaw?: string }
  | { kind: 'set-jsx-text'; file: string; line: number; col: number; newText: string; expectRaw?: string }
  | { kind: 'insert-jsx-child'; file: string; line: number; col: number; snippet: string }
  | { kind: 'create-page'; slugBase?: string; width?: number; height?: number }
  | { kind: 'make-component'; file: string; line: number; col: number; name?: string }
  | { kind: 'delete-jsx'; file: string; line: number; col: number }
  | { kind: 'duplicate-jsx'; file: string; line: number; col: number }
  | { kind: 'insert-component'; file: string; line: number; col: number; name: string; importPath: string }
  | { kind: 'create-component'; name: string }
  | { kind: 'delete-page'; slug: string }
  | { kind: 'rename-page'; slug: string; newSlug: string }
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
  const base = (op.slugBase ?? 'new-page').replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  const parent = path.join(ROOT, 'src/app/(dev)/react-figma-pages')
  await fs.mkdir(parent, { recursive: true })
  let slug = base, n = 1
  while (true) {
    try { await fs.access(path.join(parent, slug)); slug = `${base}-${++n}` } catch { break }
  }
  const w = op.width ?? 402, h = op.height ?? 871
  const dir = path.join(parent, slug)
  await fs.mkdir(dir, { recursive: true })
  const componentName = 'Page' + slug.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase())
  const scaffold = `export default function ${componentName}() {
  return (
    <div style={{ width: ${w}, height: ${h}, display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>
    </div>
  )
}
`
  await fs.writeFile(path.join(dir, 'page.tsx'), scaffold, 'utf8')
  return { ok: true, file: `src/app/(dev)/react-figma-pages/${slug}/page.tsx`, newValueText: slug, route: `/react-figma-pages/${slug}` }
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
  await dropPageTypeStubs('') // no-op guard for pages; component stubs live elsewhere and regenerate
  return { ok: true, file: `src/app/(dev)/react-figma-components/${newName}.tsx`, newValueText: newName, updatedFiles: pending.map((p) => p.rel) }
}

/* E6.8 — page delete/rename. HARD JAIL: only simple slugs, only direct children of the editor's own
   react-figma-pages sandbox (the dir create-page writes) — nothing else in the tree is deletable. */
const PAGES_DIR = path.join(ROOT, 'src/app/(dev)/react-figma-pages')
function jailPageSlug(slug: string): string {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw Object.assign(new Error('invalid page slug'), { status: 422 })
  return path.join(PAGES_DIR, slug)
}
/* Next dev generates type stubs per route (.next/dev/types/app/…); they linger after the source
   dir is removed and turn the typecheck gate red (meta-qa E6 batch-2 HIGH). Clearing the GENERATED
   stub is safe — it's cache, regenerated on demand. */
async function dropPageTypeStubs(slug: string): Promise<void> {
  for (const p of [
    path.join(ROOT, '.next', 'dev', 'types', 'app', '(dev)', 'react-figma-pages', slug),
    path.join(ROOT, '.next', 'types', 'app', '(dev)', 'react-figma-pages', slug),
  ]) { try { await fs.rm(p, { recursive: true, force: true }) } catch { /* cache layout differs — fine */ } }
}
async function deletePage(op: Extract<WriteOp, { kind: 'delete-page' }>): Promise<{ ok: true; file: string; newValueText: string }> {
  const dir = jailPageSlug(op.slug)
  try { await fs.access(path.join(dir, 'page.tsx')) } catch { throw Object.assign(new Error('page not found'), { status: 404 }) }
  await fs.rm(dir, { recursive: true })
  await dropPageTypeStubs(op.slug)
  return { ok: true, file: `src/app/(dev)/react-figma-pages/${op.slug}`, newValueText: '(deleted)' }
}
async function renamePage(op: Extract<WriteOp, { kind: 'rename-page' }>): Promise<{ ok: true; file: string; newValueText: string; route: string }> {
  const from = jailPageSlug(op.slug)
  const base = op.newSlug.replace(/[^a-z0-9-]/gi, '-').toLowerCase().replace(/^-+|-+$/g, '')
  if (!base) throw Object.assign(new Error('invalid new name'), { status: 422 })
  let slug = base, n = 1
  while (slug !== op.slug) { try { await fs.access(path.join(PAGES_DIR, slug)); slug = `${base}-${++n}` } catch { break } }
  await fs.rename(from, path.join(PAGES_DIR, slug))
  await dropPageTypeStubs(op.slug) // the OLD slug's generated type stub would go stale
  return { ok: true, file: `src/app/(dev)/react-figma-pages/${slug}/page.tsx`, newValueText: slug, route: `/react-figma-pages/${slug}` }
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
async function createComponent(op: Extract<WriteOp, { kind: 'create-component' }>): Promise<{ ok: true; file: string; newValueText: string; componentFile: string; name: string }> {
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(op.name)) throw Object.assign(new Error('name must be a PascalCase identifier'), { status: 422 })
  const nameBase = op.name[0].toUpperCase() + op.name.slice(1)
  const compDir = path.join(ROOT, 'src/app/(dev)/react-figma-components')
  await fs.mkdir(compDir, { recursive: true })
  let name = nameBase, i = 1
  while (true) { try { await fs.access(path.join(compDir, `${name}.tsx`)); name = `${nameBase}${++i}` } catch { break } }
  const compAbs = path.join(compDir, `${name}.tsx`)
  const compSource = `export function ${name}() {\n  return (\n    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16, minWidth: 120, minHeight: 80, background: '#fff', borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)' }}>\n      <span style={{ font: '600 13px/1.4 system-ui' }}>${name}</span>\n    </div>\n  )\n}\n`
  assertValidTsx(compAbs, compSource)
  await fs.writeFile(compAbs, compSource, 'utf8')
  const rel = `src/app/(dev)/react-figma-components/${name}.tsx`
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

export async function applyWrite(op: WriteOp): Promise<{ ok: true; file: string; newValueText: string; route?: string; componentFile?: string; name?: string }> {
  if (op.kind === 'insert-component') return insertComponent(op)
  if (op.kind === 'delete-jsx') return deleteJsx(op)
  if (op.kind === 'duplicate-jsx') return duplicateJsx(op)
  if (op.kind === 'create-component') return createComponent(op)
  if (op.kind === 'delete-page') return deletePage(op)
  if (op.kind === 'rename-page') return renamePage(op)
  if (op.kind === 'set-layer-name') return setLayerName(op)
  if (op.kind === 'rename-component') return renameComponentOp(op)
  if (op.kind === 'wrap-jsx-link') return wrapJsxLink(op)
  if (op.kind === 'make-component') return makeComponent(op)
  if (op.kind === 'create-page') return createPage(op)
  if (op.kind === 'set-token-value') return setTokenValue(op)
  if (op.kind === 'set-jsx-style') return setJsxStyle(op)
  if (op.kind === 'set-jsx-text') return setJsxText(op)
  if (op.kind === 'insert-jsx-child') return insertJsxChild(op)
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
