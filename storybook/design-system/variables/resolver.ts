/**
 * Figma Variables export — parser + reference resolver.
 *
 * Mirrors the resolution logic in tools/ds-pipeline/build-scan.mjs
 * (parseCollections + resolveReference), adapted for in-browser inspection.
 *
 * Export format (verified against figma-variables-2026-03-10.json):
 *   - Top level is an ARRAY of { "<CollectionName>": { modes: { "<Mode>": tokenTree } } }.
 *   - A leaf token has a `$type` ("float" | "color" | "string") and a `$value`.
 *   - A literal token: `$value` is a number / hex string / plain string.
 *   - An alias token: `$value` is "{dot.path}" and `$collectionName` names the
 *     target collection. The dot-path is a NESTED object walk in the target tree
 *     (e.g. "{family.primary}" -> tree.family.primary). Group keys that contain
 *     "/" (e.g. "style/normal/extra-light") are literal flat keys, never split.
 *   - Groups are nested non-`$` objects.
 *
 * v1 = display + inspect only. No mutation helpers here by design.
 */

// ─── Raw export types ────────────────────────────────────────────────────────

export type TokenType = 'float' | 'color' | 'string'

export interface LeafToken {
  $type: TokenType
  $value: number | string
  $scopes?: string[]
  $description?: string
  $collectionName?: string
  $libraryName?: string
  $hiddenFromPublishing?: boolean
}

/** A node in the token tree is either a leaf token or a nested group. */
export type TokenNode = LeafToken | TokenTree
export interface TokenTree {
  [key: string]: TokenNode | undefined
}

export interface RawCollection {
  modes: Record<string, TokenTree>
}

/** Each array entry has exactly one key: the collection name. */
export type RawExport = Array<Record<string, RawCollection>>

// ─── Parsed model ────────────────────────────────────────────────────────────

export interface ParsedCollection {
  name: string
  modes: string[]
  raw: RawCollection
}

/** One flattened row in the Name | Value table for a given collection + mode. */
export interface TokenRow {
  /** Full path segments from the collection root, e.g. ["display", "2xl", "font"]. */
  path: string[]
  /** Joined path with "/", e.g. "display/2xl/font". */
  id: string
  /** Last segment — the short name shown in the table. */
  name: string
  /** Group header path (everything but the last segment), "" for top-level. */
  group: string
  type: TokenType
  /** True if `$value` is a "{...}" reference. */
  isAlias: boolean
  /** For an alias: the target ref dot-path (e.g. "family.primary"). */
  aliasRef?: string
  /** For an alias: the target collection name. */
  aliasCollection?: string
  /** Raw `$value` exactly as in the export. */
  rawValue: number | string
  $description?: string
  $scopes?: string[]
}

/** One hop in a resolution chain. */
export interface ChainStep {
  /** Collection this step lives in. */
  collection: string
  /** Mode used to resolve within that collection. */
  mode: string
  /** Path within the collection, joined with "/". */
  path: string
  type: TokenType
  /** Raw `$value` at this hop ("{ref}" for aliases, literal for the terminal). */
  rawValue: number | string
  isAlias: boolean
}

export interface Resolution {
  steps: ChainStep[]
  /** Final literal value at the end of the chain, or null if unresolved. */
  resolved: number | string | null
  /** True if any hop in the chain could not be followed. */
  broken: boolean
}

// ─── Parse ───────────────────────────────────────────────────────────────────

export function parseCollections(json: RawExport): ParsedCollection[] {
  return json.map((entry) => {
    const name = Object.keys(entry)[0]
    const raw = entry[name]
    return { name, modes: Object.keys(raw.modes ?? {}), raw }
  })
}

function isLeaf(node: TokenNode | undefined): node is LeafToken {
  return !!node && typeof node === 'object' && '$type' in node
}

function isAliasValue(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('{') && value.endsWith('}')
}

/** Strip the surrounding braces from an alias "{family.primary}" -> "family.primary". */
export function refPath(value: string): string {
  return value.slice(1, -1)
}

/**
 * Walk a dot-separated ref path through a nested token tree.
 * Returns the leaf token at that path, or null.
 */
function walkRef(tree: TokenTree, dotPath: string): LeafToken | null {
  let cur: TokenNode | undefined = tree
  for (const seg of dotPath.split('.')) {
    if (!cur || typeof cur !== 'object' || !(seg in cur)) return null
    cur = (cur as TokenTree)[seg]
  }
  return isLeaf(cur) ? cur : null
}

// ─── Flatten a collection+mode into table rows ───────────────────────────────

export function flattenCollection(raw: RawCollection, mode: string): TokenRow[] {
  const tree = raw.modes[mode]
  if (!tree) return []
  const rows: TokenRow[] = []

  const walk = (node: TokenTree, path: string[]) => {
    // Stable order = insertion order from the export (matches Figma panel order).
    for (const key of Object.keys(node)) {
      if (key.startsWith('$')) continue
      const child = node[key]
      if (isLeaf(child)) {
        const fullPath = [...path, key]
        const alias = isAliasValue(child.$value)
        rows.push({
          path: fullPath,
          id: fullPath.join('/'),
          name: key,
          group: path.join('/'),
          type: child.$type,
          isAlias: alias,
          aliasRef: alias ? refPath(child.$value as string) : undefined,
          aliasCollection: alias ? child.$collectionName : undefined,
          rawValue: child.$value,
          $description: child.$description,
          $scopes: child.$scopes,
        })
      } else if (child && typeof child === 'object') {
        walk(child as TokenTree, [...path, key])
      }
    }
  }

  walk(tree, [])
  return rows
}

export function countLeaves(raw: RawCollection, mode: string): number {
  return flattenCollection(raw, mode).length
}

/** Top-level group names within a collection+mode, with leaf counts. */
export interface GroupInfo {
  name: string
  count: number
}

/** A node in the nested group hierarchy (collapsible folder tree). */
export interface GroupNode {
  /** Segment name (the folder label). */
  name: string
  /** Full path from the collection root. */
  path: string[]
  /** `path.join('/')` — stable id + the filter prefix. */
  id: string
  /** Leaf tokens under this node (recursive). */
  count: number
  children: GroupNode[]
}

/**
 * Build the full nested group tree from a flat row list. Every path prefix
 * (everything but the leaf segment) becomes a folder; leaf counts roll up.
 */
export function buildGroupTree(rows: TokenRow[]): GroupNode[] {
  const root: GroupNode = { name: '', path: [], id: '', count: 0, children: [] }
  const childOf = (parent: GroupNode, seg: string): GroupNode => {
    let c = parent.children.find((x) => x.name === seg)
    if (!c) {
      const path = [...parent.path, seg]
      c = { name: seg, path, id: path.join('/'), count: 0, children: [] }
      parent.children.push(c)
    }
    return c
  }
  for (const r of rows) {
    const groupPath = r.path.slice(0, -1)
    let node = root
    for (const seg of groupPath) {
      node = childOf(node, seg)
      node.count++
    }
  }
  return root.children
}

export function topLevelGroups(raw: RawCollection, mode: string): GroupInfo[] {
  const rows = flattenCollection(raw, mode)
  const counts = new Map<string, number>()
  for (const r of rows) {
    const top = r.path.length > 1 ? r.path[0] : '(root)'
    counts.set(top, (counts.get(top) ?? 0) + 1)
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count }))
}

// ─── Resolve a reference chain ───────────────────────────────────────────────

/**
 * Resolve a token to its final literal, following alias hops.
 * `collections` is the full parsed set; resolution within a target collection
 * tries the same-named mode first, then falls back to any mode that contains
 * the path (mirrors how build-scan.mjs resolves across mode shapes).
 */
export function resolveChain(
  collections: ParsedCollection[],
  startCollection: string,
  startMode: string,
  startPath: string[],
): Resolution {
  const byName = new Map(collections.map((c) => [c.name, c]))
  const steps: ChainStep[] = []
  const seen = new Set<string>()

  // The requested THEME (Light / Dark / Value) is threaded through the whole
  // chain — a semantic colour is single-mode `Value` but resolves to a Light/Dark
  // primitive, so the theme must follow the chain, not be re-picked per step.
  // This mirrors build-scan.mjs (`target.modes[theme] ? theme : first`) so the
  // inspector + swatch show the SAME value the converter emits for that theme.
  const theme = startMode
  let collName = startCollection
  let path = startPath.join('.')

  for (let guard = 0; guard < 16; guard++) {
    const coll = byName.get(collName)
    if (!coll) return { steps, resolved: null, broken: true }

    // Theme-aware mode for THIS collection: prefer the requested theme when the
    // collection has it and the path resolves there; else the first mode that
    // contains the path (single-mode `Value` collections resolve there).
    const mode =
      coll.modes.includes(theme) && walkRef(coll.raw.modes[theme], path)
        ? theme
        : (coll.modes.find((m) => walkRef(coll.raw.modes[m], path)) ?? coll.modes[0])

    const tree = coll.raw.modes[mode] ?? coll.raw.modes[coll.modes[0]]
    if (!tree) return { steps, resolved: null, broken: true }

    const leaf = walkRef(tree, path)
    if (!leaf) {
      steps.push({
        collection: collName,
        mode,
        path: path.replace(/\./g, '/'),
        type: 'string',
        rawValue: '(unresolved)',
        isAlias: false,
      })
      return { steps, resolved: null, broken: true }
    }

    const alias = isAliasValue(leaf.$value)
    steps.push({
      collection: collName,
      mode,
      path: path.replace(/\./g, '/'),
      type: leaf.$type,
      rawValue: leaf.$value,
      isAlias: alias,
    })

    if (!alias) {
      return { steps, resolved: leaf.$value, broken: false }
    }

    // Follow the alias — the next collection's mode is recomputed from `theme`
    // at the top of the loop, so the theme is never lost.
    const fingerprint = `${collName}::${mode}::${path}`
    if (seen.has(fingerprint)) return { steps, resolved: null, broken: true }
    seen.add(fingerprint)

    const nextColl = leaf.$collectionName
    const nextRef = refPath(leaf.$value as string)
    if (!nextColl || !byName.has(nextColl)) return { steps, resolved: null, broken: true }

    collName = nextColl
    path = nextRef
  }

  return { steps, resolved: null, broken: true }
}

// ─── Display helpers ─────────────────────────────────────────────────────────

/** Short alias-chip label: dot-path rendered with "/" like the Figma chips. */
export function aliasChipLabel(ref: string): string {
  return ref.replace(/\./g, '/')
}

/** Pretty literal for the value cell. */
export function formatLiteral(value: number | string): string {
  if (typeof value === 'number') {
    // Trim trailing-zero noise without changing precision meaning.
    return String(value)
  }
  return value
}

// ─── Editing model (phase 2) ─────────────────────────────────────────────────
//
// Edits operate on an immutable copy of the RawExport. Each operation returns a
// new RawExport so React state updates cleanly and the source JSON can be saved
// back verbatim for the converter to re-consume.

/** Numeric tier prefix of a collection name, e.g. "2.1_Alias_Type" -> 2.1. */
export function collectionTier(name: string): number {
  const m = name.match(/^(\d+)(?:\.(\d+))?/)
  if (!m) return Number.POSITIVE_INFINITY
  return Number(`${m[1]}.${m[2] ?? 0}`)
}

/**
 * Collections that a token in `fromCollection` may reference. A token may alias
 * to any collection with a STRICTLY LOWER tier (primitives < aliases < semantic
 * < component). Mirrors the layering in build-scan.mjs: semantic -> alias ->
 * primitive, alias -> primitive.
 */
export function validTargetCollections(
  collections: ParsedCollection[],
  fromCollection: string,
): ParsedCollection[] {
  const fromTier = collectionTier(fromCollection)
  return collections.filter((c) => c.name !== fromCollection && collectionTier(c.name) < fromTier)
}

/** A selectable alias target — one leaf token in a candidate collection. */
export interface AliasTarget {
  collection: string
  /** Dot-path used in the `{ref}` (nested walk path). */
  ref: string
  /** "/"-joined display label. */
  label: string
  type: TokenType
}

/** All leaf tokens across the valid target collections, as alias candidates. */
export function aliasTargets(
  collections: ParsedCollection[],
  fromCollection: string,
  /** Optionally restrict to a single $type (so colours alias colours, etc.). */
  ofType?: TokenType,
): AliasTarget[] {
  const out: AliasTarget[] = []
  for (const c of validTargetCollections(collections, fromCollection)) {
    const mode = c.modes[0]
    for (const r of flattenCollection(c.raw, mode)) {
      if (ofType && r.type !== ofType) continue
      out.push({
        collection: c.name,
        ref: r.path.join('.'),
        label: r.path.join('/'),
        type: r.type,
      })
    }
  }
  return out
}

// ─── Immutable mutators ──────────────────────────────────────────────────────

function cloneExport(data: RawExport): RawExport {
  return structuredClone(data)
}

/** Locate the leaf token at a path within a collection+mode (mutable ref). */
function leafAt(tree: TokenTree, path: string[]): LeafToken | null {
  let cur: TokenNode | undefined = tree
  for (const seg of path) {
    if (!cur || typeof cur !== 'object') return null
    cur = (cur as TokenTree)[seg]
  }
  return isLeaf(cur) ? cur : null
}

function collectionEntry(data: RawExport, name: string): RawCollection | null {
  const entry = data.find((e) => Object.keys(e)[0] === name)
  return entry ? entry[name] : null
}

/** Set a literal value on an existing token. */
export function setLiteralValue(
  data: RawExport,
  collection: string,
  mode: string,
  path: string[],
  value: number | string,
): RawExport {
  const next = cloneExport(data)
  const coll = collectionEntry(next, collection)
  if (!coll) return data
  const leaf = leafAt(coll.modes[mode], path)
  if (!leaf) return data
  leaf.$value = value
  delete leaf.$collectionName
  return next
}

/** Set an alias reference on an existing token. */
export function setAliasValue(
  data: RawExport,
  collection: string,
  mode: string,
  path: string[],
  targetCollection: string,
  targetRef: string,
): RawExport {
  const next = cloneExport(data)
  const coll = collectionEntry(next, collection)
  if (!coll) return data
  const leaf = leafAt(coll.modes[mode], path)
  if (!leaf) return data
  leaf.$value = `{${targetRef}}`
  leaf.$collectionName = targetCollection
  return next
}

export interface NewVariableInput {
  /** "/"-or-"."-separated path under the collection; last segment is the name. */
  pathInput: string
  type: TokenType
  /** Initial literal value (applied to every mode). */
  value: number | string
}

/** Create a new variable in a collection (added to ALL modes). */
export function createVariable(
  data: RawExport,
  collection: string,
  input: NewVariableInput,
): { data: RawExport; ok: boolean; error?: string } {
  const segments = input.pathInput.split(/[./]/).map((s) => s.trim()).filter(Boolean)
  if (segments.length === 0) return { data, ok: false, error: 'Name is required.' }

  const next = cloneExport(data)
  const coll = collectionEntry(next, collection)
  if (!coll) return { data, ok: false, error: 'Collection not found.' }

  for (const mode of Object.keys(coll.modes)) {
    let cur: TokenTree = coll.modes[mode]
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i]
      const child = cur[seg]
      if (isLeaf(child)) return { data, ok: false, error: `Path collides with a token at "${seg}".` }
      if (!child) cur[seg] = {}
      cur = cur[seg] as TokenTree
    }
    const leafName = segments[segments.length - 1]
    if (cur[leafName]) return { data, ok: false, error: `"${input.pathInput}" already exists.` }
    cur[leafName] = {
      $type: input.type,
      $value: input.value,
      $scopes: ['ALL_SCOPES'],
    }
  }
  return { data: next, ok: true }
}

// ─── File ingest (read ANY token file → the editor model) ────────────────────
//
// The editor is a non-Figma SSOT: it loads whatever you feed it and shows the
// truth. Supported inputs:
//   - Figma Variables export JSON (the canonical array shape) — loaded as-is.
//   - CSS custom-property files (the converter's own OUTPUT, or any tokens.css)
//     — parsed back into a flat, inspectable collection so a round-trip
//     (Figma JSON → converter → CSS → reload) shows the same truth.

export interface LoadedFile {
  data: RawExport
  /** Detected format. */
  format: 'figma-json' | 'css'
  /** Human label for the source (usually the filename). */
  label: string
}

function detectCssType(value: string): TokenType {
  const v = value.trim()
  if (/^(oklch|oklab|color|rgb|rgba|hsl|hsla|lab|lch)\(/i.test(v) || /^#[0-9a-f]{3,8}$/i.test(v)) return 'color'
  if (/^-?\d*\.?\d/.test(v) && !/var\(/.test(v)) return 'float'
  return 'string'
}

/**
 * Parse a CSS custom-property file into a RawExport. Each `--name: value;`
 * becomes a leaf token; the `--` prefix is dropped and `-` segments become
 * nested groups so the table groups them like Figma (e.g.
 * `--primitive-color-grey-1` → primitive ▸ color ▸ grey ▸ 1).
 */
/** Insert one custom property into a tree, nesting by `-` segments, lossless. */
function insertProp(tree: TokenTree, name: string, leaf: LeafToken): void {
  const segs = name.split('-')
  let cur: TokenTree = tree
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i]
    const child = cur[seg]
    if (isLeaf(child)) {
      tree[name] = leaf // a leaf owns this path segment → flat key, no overwrite
      return
    }
    if (child === undefined) cur[seg] = {}
    cur = cur[seg] as TokenTree
  }
  const last = segs[segs.length - 1]
  const existing = cur[last]
  if (existing !== undefined && !isLeaf(existing)) {
    tree[name] = leaf // a group owns the leaf slot → flat key, no overwrite
  } else {
    cur[last] = leaf
  }
}

/** Parse all `--prop: value;` declarations in a CSS fragment into a tree. */
function parseProps(fragment: string): TokenTree {
  const tree: TokenTree = {}
  const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gim
  let m: RegExpExecArray | null
  while ((m = re.exec(fragment)) !== null) {
    const name = m[1].replace(/^--/, '')
    const raw = m[2].trim()
    const type = detectCssType(raw)
    const value: number | string = type === 'float' && /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw
    insertProp(tree, name, { $type: type, $value: value })
  }
  return tree
}

/** Slice the body of the first CSS block whose selector matches, balancing braces. */
function sliceBlock(css: string, selectorRe: RegExp): string | null {
  const m = selectorRe.exec(css)
  if (!m) return null
  let i = css.indexOf('{', m.index)
  if (i < 0) return null
  const start = i + 1
  let depth = 0
  for (; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}') {
      depth--
      if (depth === 0) return css.slice(start, i)
    }
  }
  return css.slice(start)
}

/** Deep-merge override tokens onto a base tree (base ⊕ overrides), immutably-ish. */
function mergeTrees(base: TokenTree, over: TokenTree): TokenTree {
  const out: TokenTree = { ...base }
  for (const k of Object.keys(over)) {
    const o = over[k]
    const b = out[k]
    out[k] = b && o && !isLeaf(b) && !isLeaf(o) ? mergeTrees(b as TokenTree, o as TokenTree) : o
  }
  return out
}

/**
 * Parse a CSS custom-property file into a RawExport. Selector blocks become
 * MODES so themed values are preserved as the truth, not flattened:
 *   - `:root { … }`              → Light  (base)
 *   - `[data-theme="dark"] { … }`→ Dark   (base ⊕ dark overrides)
 * A file with no dark block is a single `Value` mode. The `--` prefix is
 * dropped and `-` segments nest into groups (lossless — collisions fall back
 * to a flat key).
 */
export function cssToExport(css: string, label: string): RawExport {
  const rootBody = sliceBlock(css, /:root\s*\{/)
  const darkBody = sliceBlock(css, /\[data-theme=["']?dark["']?\]\s*\{/)
  const light = parseProps(rootBody ?? css)
  if (darkBody) {
    const dark = mergeTrees(light, parseProps(darkBody))
    return [{ [label]: { modes: { Light: light, Dark: dark } } }]
  }
  return [{ [label]: { modes: { Value: light } } }]
}

/** Detect format from filename/content and parse into the editor model. */
export function parseLoadedFile(text: string, filename: string): LoadedFile {
  const isCss = /\.css$/i.test(filename) || (!/\.json$/i.test(filename) && /(^|\n)\s*(:root|\/\*|--[a-z])/i.test(text))
  if (isCss) {
    return { data: cssToExport(text, `Loaded CSS — ${filename}`), format: 'css', label: filename }
  }
  const parsed = JSON.parse(text)
  if (!Array.isArray(parsed)) {
    throw new Error('Expected a Figma Variables export (a JSON array of collections).')
  }
  return { data: parsed as RawExport, format: 'figma-json', label: filename }
}

/** Add a new mode to a collection, deep-copying an existing mode's tree. */
export function addMode(
  data: RawExport,
  collection: string,
  newMode: string,
  copyFrom?: string,
): { data: RawExport; ok: boolean; error?: string } {
  const name = newMode.trim()
  if (!name) return { data, ok: false, error: 'Mode name is required.' }
  const next = cloneExport(data)
  const coll = collectionEntry(next, collection)
  if (!coll) return { data, ok: false, error: 'Collection not found.' }
  if (coll.modes[name]) return { data, ok: false, error: `Mode "${name}" already exists.` }
  const source = copyFrom && coll.modes[copyFrom] ? copyFrom : Object.keys(coll.modes)[0]
  coll.modes[name] = structuredClone(coll.modes[source])
  return { data: next, ok: true }
}
