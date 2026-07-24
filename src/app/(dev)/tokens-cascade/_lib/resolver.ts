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


// KAI-9686: editor/write/file-ingest half (phase-2 mutation model) removed — this route is read-only.
