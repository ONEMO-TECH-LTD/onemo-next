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

export function jailComponent(rel: string): string {
  const abs = path.resolve(ROOT, rel)
  if (!abs.startsWith(path.join(ROOT, 'src') + path.sep) || !/\.(tsx|ts)$/.test(abs)) {
    throw Object.assign(new Error(`outside read jail: ${rel}`), { status: 403 })
  }
  return abs
}

// ─── shorthand slot logic (mirrors client engine.ts, server-side authority) ──

const BOX_SIDE_TO_INDEX: Record<string, (n: number) => number> = {
  // slot index for a side given the slot count (CSS box shorthand semantics)
  top: (n) => 0,
  right: (n) => (n === 1 ? 0 : 1),
  bottom: (n) => (n <= 2 ? (n === 1 ? 0 : 0) : 2),
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

export async function applyWrite(op: WriteOp): Promise<{ ok: true; file: string; newValueText: string }> {
  if (op.kind === 'set-token-value') return setTokenValue(op)
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
