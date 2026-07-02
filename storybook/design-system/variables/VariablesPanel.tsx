/**
 * VariablesPanel — a Figma-Variables-panel analogue + editor for ONEMO tokens.
 *
 * Reads the REAL Figma Variables export (passed in as `data`; the story imports
 * the actual artifacts JSON — nothing is hardcoded). Display + inspect + search,
 * plus editing: inline literal edit, create-variable, add-mode, and alias
 * rewiring via a searchable lower-tier dropdown. Edits persist to the source
 * JSON through the dev-server endpoint (`/__variables-save`), with a
 * Download-JSON fallback for the static build.
 *
 * Layout mirrors the Figma panel:
 *   - Left rail: collections (with counts) + a Groups sub-list.
 *   - Main: Name | Value table, grouped headers, alias chips, "+ Create
 *     variable" row at the bottom, mode toggle / "+ mode" in the header.
 *   - Right rail (on row select): resolution chain + final literal.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  parseCollections,
  flattenCollection,
  countLeaves,
  buildGroupTree,
  resolveChain,
  aliasChipLabel,
  formatLiteral,
  aliasTargets,
  validTargetCollections,
  setLiteralValue,
  setAliasValue,
  createVariable,
  addMode,
  parseLoadedFile,
  type ParsedCollection,
  type RawExport,
  type TokenRow,
  type Resolution,
  type TokenType,
  type AliasTarget,
  type GroupNode,
} from './resolver'

// ─── Theme (Figma-like light) ────────────────────────────────────────────────

const C = {
  bg: '#ffffff',
  rail: '#fcfcfd',
  border: '#e6e6e9',
  borderStrong: '#d8d8dd',
  text: '#1c1c1e',
  textMuted: '#8a8a8f',
  textFaint: '#aeaeb2',
  selBg: '#e7f0fd',
  selText: '#0d62ff',
  chipBg: '#f5f5f7',
  chipBorder: '#dcdce1',
  groupBg: '#fafafb',
  ok: '#1f9d55',
  err: '#c0392b',
  mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  sans: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
}

const ALL_GROUPS = '__all__'

// ─── Small UI atoms ──────────────────────────────────────────────────────────

function TypeIcon({ type, swatch }: { type: TokenType; swatch?: string }) {
  const base: React.CSSProperties = {
    width: 13,
    height: 13,
    borderRadius: 3,
    flex: '0 0 auto',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 9,
    fontWeight: 600,
    color: C.textMuted,
  }
  if (type === 'color') {
    return <span title="color" style={{ ...base, background: swatch ?? 'transparent', border: `1px solid ${C.borderStrong}` }} />
  }
  return (
    <span title={type} style={{ ...base, background: C.chipBg, border: `1px solid ${C.chipBorder}` }}>
      {type === 'float' ? '#' : 'T'}
    </span>
  )
}

function AliasChip({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`{${label.replace(/\//g, '.')}}`}
      style={{
        font: `11px/1.4 ${C.mono}`,
        color: C.text,
        background: C.chipBg,
        border: `1px solid ${C.chipBorder}`,
        borderRadius: 5,
        padding: '1px 6px',
        cursor: onClick ? 'pointer' : 'default',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        maxWidth: '100%',
      }}
    >
      <span style={{ color: C.textFaint }}>◈</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  )
}

const btn = (primary = false): React.CSSProperties => ({
  border: `1px solid ${primary ? C.selText : C.borderStrong}`,
  background: primary ? C.selText : C.bg,
  color: primary ? '#fff' : C.text,
  borderRadius: 7,
  padding: '5px 11px',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: C.sans,
})

const fieldStyle: React.CSSProperties = {
  border: `1px solid ${C.borderStrong}`,
  borderRadius: 7,
  padding: '5px 10px',
  fontSize: 12,
  outline: 'none',
  background: C.bg,
  color: C.text,
  font: `12px ${C.mono}`,
}

// ─── Resizable panels ────────────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

interface Layout {
  railW: number
  groupsH: number
  inspectW: number
  namePct: number
}
const DEFAULT_LAYOUT: Layout = { railW: 244, groupsH: 200, inspectW: 320, namePct: 44 }
const LS_LAYOUT_KEY = 'onemo-variables-panel-layout'

function loadLayout(): Layout {
  try {
    const raw = typeof localStorage !== 'undefined' && localStorage.getItem(LS_LAYOUT_KEY)
    if (!raw) return DEFAULT_LAYOUT
    return { ...DEFAULT_LAYOUT, ...(JSON.parse(raw) as Partial<Layout>) }
  } catch {
    return DEFAULT_LAYOUT
  }
}

/**
 * A draggable divider. `axis: 'x'` resizes horizontal neighbours (col-resize),
 * `axis: 'y'` resizes vertical neighbours (row-resize). `onDelta` receives the
 * signed pixel movement since the last frame (positive = right / down).
 */
function ResizeHandle({ axis, onDelta, title }: { axis: 'x' | 'y'; onDelta: (d: number) => void; title?: string }) {
  const [active, setActive] = useState(false)
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    let last = axis === 'x' ? e.clientX : e.clientY
    setActive(true)
    const move = (ev: MouseEvent) => {
      const cur = axis === 'x' ? ev.clientX : ev.clientY
      onDelta(cur - last)
      last = cur
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setActive(false)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
  }
  return (
    <div
      role="separator"
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      title={title ?? 'Drag to resize'}
      onMouseDown={onMouseDown}
      style={{
        flex: '0 0 auto',
        position: 'relative',
        zIndex: 6,
        background: 'transparent',
        ...(axis === 'x'
          ? { width: 7, cursor: 'col-resize', alignSelf: 'stretch' }
          : { height: 7, cursor: 'row-resize', width: '100%' }),
      }}
    >
      {/* hairline that brightens while dragging */}
      <div
        style={{
          position: 'absolute',
          background: active ? C.selText : C.border,
          transition: active ? 'none' : 'background 120ms',
          ...(axis === 'x'
            ? { top: 0, bottom: 0, left: 3, width: active ? 2 : 1 }
            : { left: 0, right: 0, top: 3, height: active ? 2 : 1 }),
        }}
      />
    </div>
  )
}

// ─── Searchable alias-target dropdown ────────────────────────────────────────

function AliasPicker({
  targets,
  onPick,
  onClose,
}: {
  targets: AliasTarget[]
  onPick: (t: AliasTarget) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    const list = s ? targets.filter((t) => `${t.collection}/${t.label}`.toLowerCase().includes(s)) : targets
    return list.slice(0, 200)
  }, [q, targets])

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 20,
        top: '100%',
        left: 0,
        marginTop: 4,
        width: 320,
        maxHeight: 280,
        background: C.bg,
        border: `1px solid ${C.borderStrong}`,
        borderRadius: 9,
        boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: 8, borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 6 }}>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search targets…"
          style={{ ...fieldStyle, flex: 1, font: `12px ${C.sans}` }}
        />
        <button type="button" onClick={onClose} style={{ ...btn(), padding: '4px 9px' }}>
          ×
        </button>
      </div>
      <div style={{ overflow: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 14, fontSize: 12, color: C.textFaint }}>No targets.</div>
        ) : (
          filtered.map((t) => (
            <button
              key={`${t.collection}::${t.ref}`}
              type="button"
              onClick={() => onPick(t)}
              style={{
                width: '100%',
                textAlign: 'left',
                border: 'none',
                borderBottom: `1px solid ${C.border}`,
                background: 'transparent',
                padding: '6px 11px',
                cursor: 'pointer',
              }}
            >
              <div style={{ font: `12px/1.3 ${C.mono}`, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.label}
              </div>
              <div style={{ fontSize: 10, color: C.textFaint }}>
                {t.collection} · {t.type}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Value cell — display + inline edit ──────────────────────────────────────

function ValueCell({
  row,
  collections,
  collectionName,
  resolvedSwatch,
  onInspect,
  onSetLiteral,
  onSetAlias,
}: {
  row: TokenRow
  collections: ParsedCollection[]
  collectionName: string
  resolvedSwatch?: string
  onInspect: () => void
  onSetLiteral: (value: number | string) => void
  onSetAlias: (target: AliasTarget) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)

  const targets = useMemo(
    () => aliasTargets(collections, collectionName, row.type),
    [collections, collectionName, row.type],
  )
  const canAlias = validTargetCollections(collections, collectionName).length > 0

  const beginEdit = () => {
    setDraft(String(row.rawValue))
    setEditing(true)
  }
  const commit = () => {
    setEditing(false)
    if (draft === String(row.rawValue)) return
    const value = row.type === 'float' && draft.trim() !== '' && !Number.isNaN(Number(draft)) ? Number(draft) : draft
    onSetLiteral(value)
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setEditing(false)
        }}
        style={{ ...fieldStyle, width: '100%' }}
        onClick={(e) => e.stopPropagation()}
      />
    )
  }

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }} onClick={(e) => e.stopPropagation()}>
      {row.isAlias && row.aliasRef ? (
        <AliasChip label={aliasChipLabel(row.aliasRef)} onClick={onInspect} />
      ) : row.type === 'color' ? (
        <button type="button" onClick={beginEdit} style={{ ...editTrigger }}>
          <span style={{ width: 13, height: 13, borderRadius: 3, background: resolvedSwatch ?? String(row.rawValue), border: `1px solid ${C.borderStrong}` }} />
          <span style={{ font: `12px/1.4 ${C.mono}`, color: C.text }}>{formatLiteral(row.rawValue)}</span>
        </button>
      ) : (
        <button type="button" onClick={beginEdit} style={{ ...editTrigger }}>
          <span style={{ font: `12px/1.4 ${C.mono}`, color: C.text }}>{formatLiteral(row.rawValue)}</span>
        </button>
      )}

      {/* link affordance: rewire to / set an alias */}
      {canAlias ? (
        <button
          type="button"
          title="Set reference"
          onClick={() => setPickerOpen((v) => !v)}
          style={{ ...btn(), padding: '1px 6px', fontSize: 11, color: C.textMuted }}
        >
          ◈
        </button>
      ) : null}

      {pickerOpen ? (
        <AliasPicker
          targets={targets}
          onClose={() => setPickerOpen(false)}
          onPick={(t) => {
            setPickerOpen(false)
            onSetAlias(t)
          }}
        />
      ) : null}
    </div>
  )
}

const editTrigger: React.CSSProperties = {
  border: '1px dashed transparent',
  background: 'transparent',
  cursor: 'text',
  padding: '1px 4px',
  borderRadius: 5,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  textAlign: 'left',
}

// ─── Inspect panel ───────────────────────────────────────────────────────────

function InspectPanel({ row, resolution, onClose, width }: { row: TokenRow; resolution: Resolution; onClose: () => void; width: number }) {
  const last = resolution.steps.at(-1)
  const finalSwatch = !resolution.broken && typeof resolution.resolved === 'string' && last?.type === 'color' ? resolution.resolved : undefined

  return (
    <aside style={{ width, flex: `0 0 ${width}px`, borderLeft: `1px solid ${C.border}`, background: C.rail, padding: 16, overflow: 'auto', fontFamily: C.sans }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 13, color: C.text }}>Inspect</strong>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', color: C.textMuted, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ marginTop: 12, font: `12px/1.5 ${C.mono}`, color: C.text, wordBreak: 'break-all' }}>{row.id}</div>
      <div style={{ marginTop: 2, fontSize: 11, color: C.textMuted }}>
        {row.type}
        {row.$scopes?.length ? ` · ${row.$scopes.join(', ')}` : ''}
      </div>
      {row.$description ? <div style={{ marginTop: 8, fontSize: 11, color: C.textMuted, lineHeight: 1.5 }}>{row.$description}</div> : null}

      <div style={sectionLabel}>Resolution chain</div>
      <ol style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
        {resolution.steps.map((step, i) => (
          <li key={`${step.collection}-${step.path}-${i}`} style={{ padding: '7px 9px', border: `1px solid ${C.border}`, borderRadius: 6, background: C.bg, marginBottom: 6 }}>
            <div style={{ fontSize: 10, color: C.textFaint }}>{i === 0 ? 'source' : `→ ${i}`} · {step.collection} · {step.mode}</div>
            <div style={{ font: `12px/1.4 ${C.mono}`, color: C.text, marginTop: 2, wordBreak: 'break-all' }}>{step.path}</div>
            <div style={{ font: `11px/1.4 ${C.mono}`, color: step.isAlias ? C.selText : C.textMuted, marginTop: 2 }}>{String(step.rawValue)}</div>
          </li>
        ))}
      </ol>

      <div style={sectionLabel}>Resolved value</div>
      <div style={{ marginTop: 6, padding: '9px 11px', border: `1px solid ${resolution.broken ? '#f0c0c0' : C.border}`, borderRadius: 6, background: resolution.broken ? '#fff5f5' : C.bg, display: 'flex', alignItems: 'center', gap: 9 }}>
        {finalSwatch ? <span style={{ width: 18, height: 18, borderRadius: 4, background: finalSwatch, border: `1px solid ${C.borderStrong}`, flex: '0 0 auto' }} /> : null}
        <span style={{ font: `13px/1.4 ${C.mono}`, color: resolution.broken ? C.err : C.text }}>
          {resolution.broken ? 'unresolved' : formatLiteral(resolution.resolved as number | string)}
        </span>
      </div>
    </aside>
  )
}

const sectionLabel: React.CSSProperties = {
  marginTop: 16,
  fontSize: 11,
  fontWeight: 600,
  color: C.textMuted,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
}

// ─── Create-variable inline form ─────────────────────────────────────────────

function CreateVariableRow({
  groupPrefix,
  onCreate,
}: {
  groupPrefix: string
  onCreate: (pathInput: string, type: TokenType, value: string) => string | null
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<TokenType>('float')
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ width: '100%', textAlign: 'left', border: 'none', borderTop: `1px solid ${C.border}`, background: C.groupBg, padding: '9px 14px', cursor: 'pointer', color: C.selText, fontSize: 12, fontFamily: C.sans }}
      >
        + Create variable
      </button>
    )
  }

  const submit = () => {
    const full = groupPrefix ? `${groupPrefix}/${name}` : name
    const err = onCreate(full, type, value)
    if (err) {
      setError(err)
      return
    }
    setOpen(false)
    setName('')
    setValue('')
    setError(null)
  }

  return (
    <div style={{ borderTop: `1px solid ${C.border}`, background: C.groupBg, padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {groupPrefix ? <span style={{ font: `11px ${C.mono}`, color: C.textMuted }}>{groupPrefix}/</span> : null}
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="name or group/name" style={{ ...fieldStyle, width: 180 }} />
      <select value={type} onChange={(e) => setType(e.target.value as TokenType)} style={{ ...fieldStyle, font: `12px ${C.sans}` }}>
        <option value="float">float</option>
        <option value="color">color</option>
        <option value="string">string</option>
      </select>
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="value" style={{ ...fieldStyle, width: 120 }} />
      <button type="button" style={btn(true)} onClick={submit}>Add</button>
      <button type="button" style={btn()} onClick={() => { setOpen(false); setError(null) }}>Cancel</button>
      {error ? <span style={{ fontSize: 11, color: C.err }}>{error}</span> : null}
    </div>
  )
}

// ─── Converter build-output viewer ───────────────────────────────────────────

type BuildState =
  | { kind: 'idle' }
  | { kind: 'building' }
  | { kind: 'ok'; files: Record<string, string>; stdout?: string }
  | { kind: 'err'; error: string; stdout?: string }

function countVars(css: string) {
  return (css.match(/^\s*--[a-z]/gim) || []).length
}

/** Modal showing the converter's OUTPUT (generated CSS) — the built design system. */
function BuildOutputPanel({ state, tab, onTab, onClose }: { state: BuildState; tab: string; onTab: (t: string) => void; onClose: () => void }) {
  const files = state.kind === 'ok' ? state.files : {}
  const names = Object.keys(files)
  const activeTab = files[tab] != null ? tab : (names[0] ?? '')
  const css = files[activeTab] ?? ''
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: C.sans }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(920px, 92vw)', height: 'min(680px, 88vh)', background: C.bg, borderRadius: 12, border: `1px solid ${C.borderStrong}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,0.28)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
          <strong style={{ fontSize: 13, color: C.text }}>Converter output</strong>
          <span style={{ fontSize: 11, color: C.textMuted }}>tools/ds-pipeline/build-scan.mjs → CSS · Tailwind · React · Liquid · DTCG · isolated preview (consumers untouched)</span>
          <div style={{ flex: '1 1 auto' }} />
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18, color: C.textMuted, lineHeight: 1 }}>×</button>
        </div>

        {state.kind === 'building' ? (
          <div style={{ padding: 24, fontSize: 13, color: C.textMuted }}>Running the converter engine…</div>
        ) : state.kind === 'err' ? (
          <div style={{ padding: 16, overflow: 'auto' }}>
            <div style={{ fontSize: 12, color: C.err, fontWeight: 600, marginBottom: 8 }}>Build failed</div>
            <pre style={{ margin: 0, font: `12px/1.5 ${C.mono}`, color: C.err, whiteSpace: 'pre-wrap' }}>{state.error}</pre>
            {state.stdout ? <pre style={{ marginTop: 10, font: `11px/1.5 ${C.mono}`, color: C.textMuted, whiteSpace: 'pre-wrap' }}>{state.stdout}</pre> : null}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 4, padding: '8px 12px', borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
              {names.map((f) => {
                const active = f === activeTab
                const n = countVars(files[f] ?? '')
                return (
                  <button key={f} type="button" onClick={() => onTab(f)} style={{ border: `1px solid ${active ? C.selText : C.chipBorder}`, background: active ? C.selBg : C.bg, color: active ? C.selText : C.text, borderRadius: 7, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: C.mono }}>
                    {f} <span style={{ color: C.textFaint }}>{n}</span>
                  </button>
                )
              })}
            </div>
            <div style={{ flex: '1 1 auto', overflow: 'auto', background: '#0d1117' }}>
              <pre style={{ margin: 0, padding: 14, font: `12px/1.55 ${C.mono}`, color: '#c9d1d9', whiteSpace: 'pre' }}>
                {css || '/* (empty) */'}
              </pre>
            </div>
            <div style={{ padding: '6px 14px', borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.textMuted }}>
              {activeTab}: {css ? css.split('\n').length : 0} lines{countVars(css) ? ` · ${countVars(css)} custom properties` : ''}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main panel ──────────────────────────────────────────────────────────────

export interface VariablesPanelProps {
  /** The raw Figma Variables export (array of collections) — the real export. */
  data: RawExport
}

export function VariablesPanel({ data }: VariablesPanelProps) {
  // Editable working copy seeded from the real export. All edits replace this.
  const [doc, setDoc] = useState<RawExport>(data)
  useEffect(() => setDoc(data), [data])

  const collections = useMemo<ParsedCollection[]>(() => parseCollections(doc), [doc])

  const [selectedColl, setSelectedColl] = useState(0)
  const [selectedGroup, setSelectedGroup] = useState<string>(ALL_GROUPS)
  const [search, setSearch] = useState('')
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [modeByColl, setModeByColl] = useState<Record<number, string>>({})
  const [addingMode, setAddingMode] = useState(false)
  const [newModeName, setNewModeName] = useState('')
  const [saveState, setSaveState] = useState<{ kind: 'idle' | 'saving' | 'ok' | 'err'; msg?: string }>({ kind: 'idle' })

  // Resizable layout (persisted to localStorage).
  const [layout, setLayout] = useState<Layout>(loadLayout)
  useEffect(() => {
    try {
      localStorage.setItem(LS_LAYOUT_KEY, JSON.stringify(layout))
    } catch {
      /* storage unavailable — non-fatal */
    }
  }, [layout])
  const resetLayout = () => setLayout(DEFAULT_LAYOUT)
  const mainRef = useRef<HTMLDivElement>(null)

  // Converter build (engine output preview).
  const [build, setBuild] = useState<BuildState>({ kind: 'idle' })
  const [buildTab, setBuildTab] = useState<string>('tokens.css')

  // Loaded source — read ANY file (Figma JSON / CSS), switch, save into it.
  const [source, setSource] = useState<{ label: string; format: string; handle?: FileSystemFileHandle }>({ label: 'figma-export.json · default', format: 'figma-json' })
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Collapsed group-tree folders (by group id). Default = all expanded.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // Global resolution theme (Light/Dark). Used to resolve SINGLE-MODE collections
  // — e.g. semantic colours, which are mode `Value` but alias down to Light/Dark
  // primitives — so the swatch + inspector show the SAME value the converter emits
  // per theme. Collections with their own Light/Dark modes resolve under the
  // column's mode; only `Value`-mode tokens follow this global theme.
  const [theme, setTheme] = useState<'Light' | 'Dark'>('Light')
  const themeFor = (m: string) => (m === 'Light' || m === 'Dark' ? m : theme)

  const coll = collections[selectedColl]
  // `mode` = the ACTIVE mode (drives inspect + the highlighted column). All
  // modes render as side-by-side columns; this just marks the focused one.
  const mode = modeByColl[selectedColl] ?? coll.modes[0]

  const rows = useMemo(() => flattenCollection(coll.raw, mode), [coll, mode])
  // Per-mode value index (id → row) so each mode renders as its own column.
  const rowsByMode = useMemo(() => {
    const map: Record<string, Map<string, TokenRow>> = {}
    for (const m of coll.modes) {
      const idx = new Map<string, TokenRow>()
      for (const r of flattenCollection(coll.raw, m)) idx.set(r.id, r)
      map[m] = idx
    }
    return map
  }, [coll])
  // Group tree per collection — the unified Collections ▸ Groups hierarchy.
  // (Groups are mode-invariant, so the first mode defines the structure.)
  const collGroupTrees = useMemo(
    () => collections.map((c) => buildGroupTree(flattenCollection(c.raw, c.modes[0]))),
    [collections],
  )

  // resolved swatch per (id, mode) for colour tokens
  const swatchByIdMode = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of coll.modes) {
      for (const r of rowsByMode[m].values()) {
        if (r.type !== 'color') continue
        const res = resolveChain(collections, coll.name, themeFor(m), r.path)
        if (!res.broken && typeof res.resolved === 'string') map.set(`${r.id}::${m}`, res.resolved)
      }
    }
    return map
  }, [rowsByMode, collections, coll.name, coll.modes, theme])

  const q = search.trim().toLowerCase()
  const visibleRows = useMemo(
    () =>
      rows.filter((r) => {
        if (selectedGroup !== ALL_GROUPS) {
          // selectedGroup is a '/'-joined group path; match it or any descendant.
          const g = r.group
          if (g !== selectedGroup && !g.startsWith(selectedGroup + '/')) return false
        }
        if (q && !r.id.toLowerCase().includes(q)) return false
        return true
      }),
    [rows, selectedGroup, q],
  )

  const grouped = useMemo(() => {
    const out: { group: string; rows: TokenRow[] }[] = []
    const index = new Map<string, TokenRow[]>()
    for (const r of visibleRows) {
      if (!index.has(r.group)) {
        const bucket: TokenRow[] = []
        index.set(r.group, bucket)
        out.push({ group: r.group, rows: bucket })
      }
      index.get(r.group)!.push(r)
    }
    return out
  }, [visibleRows])

  const selectedRow = useMemo(() => (selectedRowId ? rows.find((r) => r.id === selectedRowId) ?? null : null), [rows, selectedRowId])
  const selectedResolution = useMemo(
    () => (selectedRow ? resolveChain(collections, coll.name, themeFor(mode), selectedRow.path) : null),
    [selectedRow, collections, coll.name, mode, theme],
  )

  const selectColl = (i: number) => {
    setSelectedColl(i)
    setSelectedGroup(ALL_GROUPS)
    setSelectedRowId(null)
    setAddingMode(false)
  }

  // ── Edit handlers (immutable; each returns a fresh export) — per mode ──
  const handleSetLiteral = (row: TokenRow, value: number | string, m: string) =>
    setDoc((d) => setLiteralValue(d, coll.name, m, row.path, value))
  const handleSetAlias = (row: TokenRow, t: AliasTarget, m: string) =>
    setDoc((d) => setAliasValue(d, coll.name, m, row.path, t.collection, t.ref))
  const handleCreate = (pathInput: string, type: TokenType, value: string): string | null => {
    const v = type === 'float' && value.trim() !== '' && !Number.isNaN(Number(value)) ? Number(value) : value
    const res = createVariable(doc, coll.name, { pathInput, type, value: v })
    if (!res.ok) return res.error ?? 'Failed.'
    setDoc(res.data)
    return null
  }
  const handleAddMode = () => {
    const res = addMode(doc, coll.name, newModeName, mode)
    if (!res.ok) {
      setSaveState({ kind: 'err', msg: res.error })
      return
    }
    setDoc(res.data)
    setModeByColl((p) => ({ ...p, [selectedColl]: newModeName.trim() }))
    setAddingMode(false)
    setNewModeName('')
  }

  // ── Persist: dev endpoint first, download fallback ──
  // JSON-ONLY (Dan scope lock): the editor is a Figma-JSON SSOT tool. A non-JSON
  // source (e.g. a loaded CSS file) is VIEW-ONLY — Save is blocked so we never
  // convert-in-place over a non-JSON file nor POST a non-JSON-derived doc to the
  // canonical artifact endpoint. Use Download to export JSON instead.
  const handleSave = async () => {
    if (source.format !== 'figma-json') {
      setSaveState({ kind: 'err', msg: 'View-only: Save is disabled for non-JSON sources. Use “Download JSON” to export, or open a Figma-JSON file to edit + save.' })
      return
    }
    setSaveState({ kind: 'saving' })
    // Save INTO the loaded file when one was opened via the file picker.
    if (source.handle) {
      try {
        const writable = await source.handle.createWritable()
        await writable.write(JSON.stringify(doc, null, 2) + '\n')
        await writable.close()
        setSaveState({ kind: 'ok', msg: `Saved into ${source.label}` })
      } catch (err) {
        setSaveState({ kind: 'err', msg: `Save into file failed (${String(err)}). Use Download.` })
      }
      return
    }
    try {
      const resp = await fetch('/__variables-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc),
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const json = (await resp.json()) as { ok: boolean; error?: string }
      if (!json.ok) throw new Error(json.error ?? 'save failed')
      setSaveState({ kind: 'ok', msg: 'Saved to source JSON.' })
    } catch (err) {
      setSaveState({ kind: 'err', msg: `Endpoint unavailable (${String(err)}). Use Download.` })
    }
  }
  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(doc, null, 2) + '\n'], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'DS-V2.1--22-JUNE-2026.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Build: run the converter engine on the CURRENT editor tokens ──
  // The tokens are POSTed straight to the build endpoint, which builds them via
  // an unwatched temp input (no figma-export.json write → no HMR remount → the
  // viewer stays open), so the loop is edit → build → view without a save step.
  const handleBuild = async () => {
    // JSON-ONLY: Build only runs on Figma-JSON sources. A CSS-loaded source is
    // wrapped into a synthetic collection with degraded scopes — building it
    // produces garbage names/treatments — so block it (the dash's job is the v2
    // JSON SSOT; non-JSON is view-only).
    if (source.format !== 'figma-json') {
      setBuild({ kind: 'err', error: 'View-only: Build only runs on Figma-JSON sources. Open the v2 export (or ↺ Default) to build.', stdout: '' })
      return
    }
    setBuild({ kind: 'building' })
    setBuildTab('tokens.css')
    try {
      const resp = await fetch('/__variables-build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc),
      })
      const json = (await resp.json()) as { ok: boolean; files?: Record<string, string>; stdout?: string; error?: string }
      if (!json.ok) {
        setBuild({ kind: 'err', error: json.error ?? 'build failed', stdout: json.stdout })
        return
      }
      setBuild({ kind: 'ok', files: json.files ?? {}, stdout: json.stdout })
    } catch (err) {
      setBuild({ kind: 'err', error: `Build endpoint unavailable (${String(err)}) — needs \`storybook dev\`.` })
    }
  }

  // ── Read any file: open (File System Access API, <input> fallback), switch ──
  const applyLoaded = (text: string, filename: string, handle?: FileSystemFileHandle) => {
    try {
      const res = parseLoadedFile(text, filename)
      setDoc(res.data)
      setSource({ label: filename, format: res.format, handle })
      setSelectedColl(0)
      setSelectedGroup(ALL_GROUPS)
      setSelectedRowId(null)
      setModeByColl({})
      setSearch('')
      setSaveState({ kind: 'ok', msg: `Loaded ${res.format} — ${filename}` })
    } catch (err) {
      setSaveState({ kind: 'err', msg: `Load failed: ${String(err)}` })
    }
  }

  const handleOpen = async () => {
    const picker = (window as unknown as { showOpenFilePicker?: (o: object) => Promise<FileSystemFileHandle[]> }).showOpenFilePicker
    if (picker) {
      try {
        const [handle] = await picker({
          types: [{ description: 'Token files', accept: { 'application/json': ['.json'], 'text/css': ['.css'] } }],
        })
        const file = await handle.getFile()
        applyLoaded(await file.text(), file.name, handle)
      } catch {
        /* user cancelled the picker */
      }
      return
    }
    fileInputRef.current?.click()
  }

  const handleInputFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) applyLoaded(await file.text(), file.name)
    e.target.value = ''
  }

  const loadDefault = () => {
    setDoc(data)
    setSource({ label: 'figma-export.json · default', format: 'figma-json' })
    setSelectedColl(0)
    setSelectedGroup(ALL_GROUPS)
    setSelectedRowId(null)
    setModeByColl({})
    setSaveState({ kind: 'idle' })
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: C.bg, fontFamily: C.sans, color: C.text }}>
      {/* Left rail — ONE Figma-style hierarchy: Collections ▸ Groups nested.
          JSON (many collections) and CSS (one collection) render identically. */}
      <div style={{ width: layout.railW, flex: `0 0 ${layout.railW}px`, background: C.rail, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={railLabel}>Hierarchy</div>
        <div style={{ overflow: 'auto', flex: '1 1 auto', minHeight: 40 }}>
          <HierarchyTree
            collections={collections}
            groupTrees={collGroupTrees}
            selectedColl={selectedColl}
            selectedGroup={selectedGroup}
            modeByColl={modeByColl}
            collapsed={collapsed}
            onToggle={(id) => setCollapsed((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })}
            onSelectColl={(i) => selectColl(i)}
            onSelectGroup={(i, gid) => { setSelectedColl(i); setSelectedGroup(gid); setSelectedRowId(null); setAddingMode(false) }}
          />
        </div>
      </div>

      {/* Sidebar resize */}
      <ResizeHandle axis="x" title="Drag to resize sidebar" onDelta={(d) => setLayout((L) => ({ ...L, railW: clamp(L.railW + d, 180, 560) }))} />

      {/* Main */}
      <div ref={mainRef} style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{coll.name}</div>

          {/* Modes render as side-by-side columns (Figma-style). Each column
              header is the switch (click to focus a mode); this just adds one. */}
          <span style={{ fontSize: 11, color: C.textFaint }}>{coll.modes.length} mode{coll.modes.length > 1 ? 's' : ''}</span>
          {addingMode ? (
            <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
              <input autoFocus value={newModeName} onChange={(e) => setNewModeName(e.target.value)} placeholder="new mode" onKeyDown={(e) => { if (e.key === 'Enter') handleAddMode(); if (e.key === 'Escape') setAddingMode(false) }} style={{ ...fieldStyle, width: 90, padding: '2px 6px' }} />
              <button type="button" style={{ ...btn(true), padding: '2px 7px' }} onClick={handleAddMode}>✓</button>
            </span>
          ) : (
            <button type="button" title="Add a mode (adds a value column)" onClick={() => setAddingMode(true)} style={{ border: `1px solid ${C.chipBorder}`, borderRadius: 7, padding: '3px 9px', fontSize: 11, cursor: 'pointer', background: 'transparent', color: C.selText }}>+ mode</button>
          )}

          <div style={{ flex: '1 1 auto' }} />

          <input ref={fileInputRef} type="file" accept=".json,.css,application/json,text/css" style={{ display: 'none' }} onChange={handleInputFile} />
          <button type="button" style={btn()} title="Open a token file — Figma JSON or CSS" onClick={handleOpen}>📂 Open</button>
          <span title={`Source: ${source.label}`} style={{ fontSize: 11, color: C.textMuted, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '3px 7px', background: C.chipBg, border: `1px solid ${C.chipBorder}`, borderRadius: 6 }}>{source.format === 'css' ? 'CSS' : 'JSON'} · {source.label}</span>
          {source.label !== 'figma-export.json · default' ? <button type="button" style={btn()} title="Back to the bundled default export" onClick={loadDefault}>↺ Default</button> : null}
          <span style={{ display: 'inline-flex', border: `1px solid ${C.chipBorder}`, borderRadius: 7, overflow: 'hidden' }} title="Global theme for resolving single-mode tokens (e.g. semantic colours) down to their Light/Dark primitive — matches the converter's per-theme output">
            {(['Light', 'Dark'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTheme(t)} style={{ border: 'none', padding: '3px 9px', fontSize: 11, cursor: 'pointer', background: theme === t ? C.selBg : 'transparent', color: theme === t ? C.selText : C.textMuted, fontWeight: theme === t ? 600 : 400 }}>{t === 'Light' ? '☀ Light' : '☾ Dark'}</button>
            ))}
          </span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search variables…" style={{ ...fieldStyle, width: 180, font: `12px ${C.sans}` }} />
          <button type="button" style={btn(true)} onClick={handleSave} disabled={saveState.kind === 'saving' || source.format !== 'figma-json'} title={source.format !== 'figma-json' ? 'View-only (non-JSON source) — use Download JSON to export' : 'Save into the source JSON'}>{saveState.kind === 'saving' ? 'Saving…' : 'Save'}</button>
          <button type="button" style={btn()} onClick={handleDownload}>Download JSON</button>
          <button type="button" style={btn()} title={source.format !== 'figma-json' ? 'View-only (non-JSON source) — Build runs on Figma-JSON only' : 'Run the converter on the current tokens and view the generated output'} onClick={handleBuild} disabled={build.kind === 'building' || source.format !== 'figma-json'}>{build.kind === 'building' ? 'Building…' : '⚙ Build'}</button>
          <button type="button" style={btn()} title="Reset panel sizes to default" onClick={resetLayout}>⤢ Reset</button>
        </div>

        {saveState.kind !== 'idle' && saveState.kind !== 'saving' ? (
          <div style={{ padding: '5px 14px', fontSize: 11, color: saveState.kind === 'ok' ? C.ok : C.err, background: saveState.kind === 'ok' ? '#f1faf4' : '#fff5f5', borderBottom: `1px solid ${C.border}` }}>{saveState.msg}</div>
        ) : null}

        {/* Column header — Name + one column per mode (Figma-style compare) */}
        <div style={{ display: 'flex', alignItems: 'stretch', padding: '6px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          <div style={{ flex: `0 0 ${layout.namePct}%`, minWidth: 0 }}>Name</div>
          <ResizeHandle
            axis="x"
            title="Drag to resize columns"
            onDelta={(d) => {
              const w = mainRef.current?.clientWidth ?? 800
              setLayout((L) => ({ ...L, namePct: clamp(L.namePct + (d / w) * 100, 20, 75) }))
            }}
          />
          {coll.modes.map((m) => {
            const multi = coll.modes.length > 1
            const active = m === mode && multi
            return (
              <div
                key={m}
                onClick={() => multi && setModeByColl((p) => ({ ...p, [selectedColl]: m }))}
                title={multi ? `Focus ${m}` : undefined}
                style={{ flex: '1 1 0', minWidth: 0, paddingLeft: 8, cursor: multi ? 'pointer' : 'default', color: active ? C.selText : C.textMuted, borderLeft: `1px solid ${C.border}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {multi ? m : 'Value'}
              </div>
            )
          })}
        </div>

        {/* Rows */}
        <div style={{ overflow: 'auto', flex: '1 1 auto' }}>
          {grouped.length === 0 ? (
            <div style={{ padding: 24, fontSize: 12, color: C.textFaint }}>No variables match.</div>
          ) : (
            grouped.map((bucket) => (
              <div key={bucket.group || '(root)'}>
                {bucket.group ? <div style={{ padding: '5px 14px', background: C.groupBg, borderBottom: `1px solid ${C.border}`, font: `11px/1.4 ${C.mono}`, color: C.textMuted }}>{bucket.group}</div> : null}
                {bucket.rows.map((r) => {
                  const selected = r.id === selectedRowId
                  return (
                    <div key={r.id} style={{ borderBottom: `1px solid ${C.border}`, background: selected ? C.selBg : 'transparent', padding: '6px 14px', display: 'flex', alignItems: 'center' }}>
                      <div onClick={() => setSelectedRowId(selected ? null : r.id)} style={{ flex: `0 0 ${layout.namePct}%`, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, cursor: 'pointer' }}>
                        <TypeIcon type={r.type} swatch={swatchByIdMode.get(`${r.id}::${mode}`)} />
                        <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.text }}>{r.name}</span>
                      </div>
                      <div style={{ flex: '0 0 7px' }} />
                      {coll.modes.map((m) => {
                        const mr = rowsByMode[m]?.get(r.id)
                        return (
                          <div key={m} style={{ flex: '1 1 0', minWidth: 0, paddingLeft: 8, borderLeft: `1px solid ${C.border}` }}>
                            {mr ? (
                              <ValueCell
                                row={mr}
                                collections={collections}
                                collectionName={coll.name}
                                resolvedSwatch={swatchByIdMode.get(`${r.id}::${m}`)}
                                onInspect={() => setSelectedRowId(r.id)}
                                onSetLiteral={(v) => handleSetLiteral(mr, v, m)}
                                onSetAlias={(t) => handleSetAlias(mr, t, m)}
                              />
                            ) : (
                              <span style={{ fontSize: 12, color: C.textFaint }}>—</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            ))
          )}
          <CreateVariableRow groupPrefix={selectedGroup === ALL_GROUPS ? '' : selectedGroup} onCreate={handleCreate} />
        </div>
      </div>

      {/* Right rail: inspect (resizable) */}
      {selectedRow && selectedResolution ? (
        <>
          <ResizeHandle axis="x" title="Drag to resize Inspect" onDelta={(d) => setLayout((L) => ({ ...L, inspectW: clamp(L.inspectW - d, 240, 620) }))} />
          <InspectPanel row={selectedRow} resolution={selectedResolution} onClose={() => setSelectedRowId(null)} width={layout.inspectW} />
        </>
      ) : null}

      {/* Converter output viewer (engine loop: edit → save → convert → view) */}
      {build.kind !== 'idle' ? (
        <BuildOutputPanel state={build} tab={buildTab} onTab={setBuildTab} onClose={() => setBuild({ kind: 'idle' })} />
      ) : null}
    </div>
  )
}

const railLabel: React.CSSProperties = {
  padding: '12px 14px 8px',
  fontSize: 11,
  fontWeight: 700,
  color: C.textMuted,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

function Chevron({ collapsed, onClick }: { collapsed: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button type="button" onClick={onClick} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: C.textMuted, fontSize: 9, width: 12, flex: '0 0 auto', padding: 0, lineHeight: 1 }}>
      {collapsed ? '▸' : '▾'}
    </button>
  )
}

/** Recursive group folders under a collection (Figma layers-style). */
function GroupNodes({
  nodes,
  collIndex,
  depth,
  cidPrefix,
  selectedColl,
  selectedGroup,
  collapsed,
  onToggle,
  onSelectGroup,
}: {
  nodes: GroupNode[]
  collIndex: number
  depth: number
  cidPrefix: string
  selectedColl: number
  selectedGroup: string
  collapsed: Set<string>
  onToggle: (id: string) => void
  onSelectGroup: (collIndex: number, groupId: string) => void
}) {
  return (
    <>
      {nodes.map((n) => {
        const key = `${cidPrefix}:${n.id}`
        const isCollapsed = collapsed.has(key)
        const hasChildren = n.children.length > 0
        const isSel = collIndex === selectedColl && selectedGroup === n.id
        return (
          <div key={n.id}>
            <div onClick={() => onSelectGroup(collIndex, n.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', paddingLeft: 8 + depth * 13, cursor: 'pointer', background: isSel ? C.selBg : 'transparent', borderLeft: `2px solid ${isSel ? C.selText : 'transparent'}` }}>
              {hasChildren ? <Chevron collapsed={isCollapsed} onClick={(e) => { e.stopPropagation(); onToggle(key) }} /> : <span style={{ width: 12, flex: '0 0 auto' }} />}
              <span style={{ font: `11px/1.4 ${C.mono}`, color: isSel ? C.selText : C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 auto' }}>{n.name}</span>
              <span style={{ fontSize: 10, color: C.textFaint, flex: '0 0 auto' }}>{n.count}</span>
            </div>
            {hasChildren && !isCollapsed ? (
              <GroupNodes nodes={n.children} collIndex={collIndex} depth={depth + 1} cidPrefix={cidPrefix} selectedColl={selectedColl} selectedGroup={selectedGroup} collapsed={collapsed} onToggle={onToggle} onSelectGroup={onSelectGroup} />
            ) : null}
          </div>
        )
      })}
    </>
  )
}

/** The unified left-rail hierarchy: each collection is a folder whose groups
 *  nest inside it. JSON (many collections) and CSS (one) render the same way. */
function HierarchyTree({
  collections,
  groupTrees,
  selectedColl,
  selectedGroup,
  modeByColl,
  collapsed,
  onToggle,
  onSelectColl,
  onSelectGroup,
}: {
  collections: ParsedCollection[]
  groupTrees: GroupNode[][]
  selectedColl: number
  selectedGroup: string
  modeByColl: Record<number, string>
  collapsed: Set<string>
  onToggle: (id: string) => void
  onSelectColl: (i: number) => void
  onSelectGroup: (collIndex: number, groupId: string) => void
}) {
  return (
    <>
      {collections.map((c, i) => {
        const cid = `c${i}`
        const isCollapsed = collapsed.has(cid)
        const tree = groupTrees[i] ?? []
        const hasGroups = tree.length > 0
        const total = countLeaves(c.raw, modeByColl[i] ?? c.modes[0])
        const isSel = i === selectedColl && selectedGroup === ALL_GROUPS
        return (
          <div key={c.name}>
            <div onClick={() => onSelectColl(i)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px', cursor: 'pointer', background: isSel ? C.selBg : 'transparent', borderLeft: `2px solid ${isSel ? C.selText : 'transparent'}` }}>
              {hasGroups ? <Chevron collapsed={isCollapsed} onClick={(e) => { e.stopPropagation(); onToggle(cid) }} /> : <span style={{ width: 12, flex: '0 0 auto' }} />}
              <span style={{ fontSize: 12, fontWeight: 600, color: isSel ? C.selText : C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 auto' }}>{c.name}</span>
              <span style={{ fontSize: 11, color: C.textFaint, flex: '0 0 auto' }}>{total}</span>
            </div>
            {hasGroups && !isCollapsed ? (
              <GroupNodes nodes={tree} collIndex={i} depth={1} cidPrefix={cid} selectedColl={selectedColl} selectedGroup={selectedGroup} collapsed={collapsed} onToggle={onToggle} onSelectGroup={onSelectGroup} />
            ) : null}
          </div>
        )
      })}
    </>
  )
}

export default VariablesPanel
