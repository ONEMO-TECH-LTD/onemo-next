'use client';
/**
 * KAI-9686 — per-screen token cascade EXPLORER (converter-adapted VariablesPanel).
 * A Figma-Variables-panel-faithful, read-only view: left-rail Collections ▸ Groups hierarchy
 * (collapsible, counts), a grouped Name | Figma(Light/Dark) | Generated | Verdict table, an
 * Inspect rail showing the FULL Figma→code resolution chain per mode, search, and a theme
 * focus toggle. Data is built server-side (explorer-data.ts) from the sealed run.
 */
import { useMemo, useState } from 'react';
import type { ExplorerData, ExplorerCollection, ExplorerToken, ExplorerStep } from './explorer-data';
import type { GroupNode } from './resolver';
import styles from './explorer.module.css';

// Theme-aware chrome — the CSS vars flip with the converter's light/dark computer theme
// (prefers-color-scheme + the app's data-theme); see explorer.module.css.
const C = {
  bg: 'var(--ui-bg)', rail: 'var(--ui-rail)', border: 'var(--ui-border)', borderStrong: 'var(--ui-border-strong)',
  text: 'var(--ui-text)', textMuted: 'var(--ui-text-muted)', textFaint: 'var(--ui-text-faint)',
  selBg: 'var(--ui-sel-bg)', selText: 'var(--ui-sel-text)', chipBg: 'var(--ui-chip-bg)', chipBorder: 'var(--ui-chip-border)', groupBg: 'var(--ui-group-bg)',
  mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  sans: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
};
const ALL_GROUPS = '__all__';
const V = {
  MATCH: { bg: 'var(--ui-ok-bg)', fg: 'var(--ui-ok-fg)', label: 'MATCH' },
  BOUNDED: { bg: 'var(--ui-bounded-bg)', fg: 'var(--ui-bounded-fg)', label: 'BOUNDED' },
  DIFF: { bg: 'var(--ui-err-bg)', fg: 'var(--ui-err-fg)', label: 'DIFF' },
  DERIVED: { bg: 'var(--ui-info-bg)', fg: 'var(--ui-info-fg)', label: 'DERIVED' },
  UNVERIFIED: { bg: 'var(--ui-warn-bg)', fg: 'var(--ui-warn-fg)', label: 'UNVERIFIED' },
} as const;
type Verdict = keyof typeof V;
const order: Verdict[] = ['DIFF', 'UNVERIFIED', 'BOUNDED', 'DERIVED', 'MATCH'];

function Chevron({ collapsed }: { collapsed: boolean }) {
  return <span style={{ color: C.textMuted, fontSize: 9, width: 12, flex: '0 0 auto', display: 'inline-block' }}>{collapsed ? '▸' : '▾'}</span>;
}

function TypeIcon({ type, swatch }: { type: string; swatch?: string }) {
  const base: React.CSSProperties = { width: 13, height: 13, borderRadius: 3, flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: C.textMuted };
  if (type === 'color') return <span title="color" style={{ ...base, background: swatch ?? 'transparent', border: `1px solid ${C.borderStrong}` }} />;
  return <span title={type} style={{ ...base, background: C.chipBg, border: `1px solid ${C.chipBorder}` }}>{type === 'float' ? '#' : 'T'}</span>;
}

function Swatch({ v, color }: { v: string; color?: string }) {
  return <span title={v} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
    {color ? <span style={{ width: 12, height: 12, borderRadius: 3, background: color, border: `1px solid ${C.borderStrong}`, flex: '0 0 auto' }} /> : null}
    <span style={{ font: `12px/1.4 ${C.mono}`, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
  </span>;
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const s = V[verdict];
  return <span style={{ background: s.bg, color: s.fg, padding: '1px 7px', borderRadius: 5, fontSize: 10, fontWeight: 600, fontFamily: C.sans, whiteSpace: 'nowrap' }}>{s.label}</span>;
}

// ── Left rail: Collections ▸ nested Groups ───────────────────────────────────
function GroupNodes({ nodes, coll, depth, sel, collapsed, onToggle, onSelectGroup }: {
  nodes: GroupNode[]; coll: number; depth: number; sel: { coll: number; group: string };
  collapsed: Set<string>; onToggle: (id: string) => void; onSelectGroup: (coll: number, gid: string) => void;
}) {
  return <>{nodes.map((n) => {
    const key = `c${coll}:${n.id}`;
    const isCollapsed = collapsed.has(key);
    const isSel = coll === sel.coll && sel.group === n.id;
    return (
      <div key={n.id}>
        <div onClick={() => onSelectGroup(coll, n.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', paddingLeft: 8 + depth * 13, cursor: 'pointer', background: isSel ? C.selBg : 'transparent', borderLeft: `2px solid ${isSel ? C.selText : 'transparent'}` }}>
          {n.children.length ? <span onClick={(e) => { e.stopPropagation(); onToggle(key); }} style={{ cursor: 'pointer' }}><Chevron collapsed={isCollapsed} /></span> : <span style={{ width: 12, flex: '0 0 auto' }} />}
          <span style={{ font: `11px/1.4 ${C.mono}`, color: isSel ? C.selText : C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 auto' }}>{n.name}</span>
          <span style={{ fontSize: 10, color: C.textFaint, flex: '0 0 auto' }}>{n.count}</span>
        </div>
        {n.children.length && !isCollapsed ? <GroupNodes nodes={n.children} coll={coll} depth={depth + 1} sel={sel} collapsed={collapsed} onToggle={onToggle} onSelectGroup={onSelectGroup} /> : null}
      </div>
    );
  })}</>;
}

function HierarchyTree({ collections, sel, collapsed, onToggle, onSelectColl, onSelectGroup }: {
  collections: ExplorerCollection[]; sel: { coll: number; group: string };
  collapsed: Set<string>; onToggle: (id: string) => void; onSelectColl: (i: number) => void; onSelectGroup: (coll: number, gid: string) => void;
}) {
  return <>{collections.map((c, i) => {
    const cid = `c${i}`;
    const isCollapsed = collapsed.has(cid);
    const isSel = i === sel.coll && sel.group === ALL_GROUPS;
    return (
      <div key={c.name}>
        <div onClick={() => onSelectColl(i)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px', cursor: 'pointer', background: isSel ? C.selBg : 'transparent', borderLeft: `2px solid ${isSel ? C.selText : 'transparent'}` }}>
          {c.groups.length ? <span onClick={(e) => { e.stopPropagation(); onToggle(cid); }} style={{ cursor: 'pointer' }}><Chevron collapsed={isCollapsed} /></span> : <span style={{ width: 12, flex: '0 0 auto' }} />}
          <span style={{ fontSize: 12, fontWeight: 600, color: isSel ? C.selText : C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 auto' }}>{c.shortName}</span>
          <span style={{ fontSize: 11, color: C.textFaint, flex: '0 0 auto' }}>{c.tokens.length}</span>
        </div>
        {c.groups.length && !isCollapsed ? <GroupNodes nodes={c.groups} coll={i} depth={1} sel={sel} collapsed={collapsed} onToggle={onToggle} onSelectGroup={onSelectGroup} /> : null}
      </div>
    );
  })}</>;
}

// ── Right rail: full Figma→code resolution chain ─────────────────────────────
function InspectPanel({ token, theme, onClose }: { token: ExplorerToken; theme: 'Light' | 'Dark'; onClose: () => void }) {
  const chain = theme === 'Dark' ? token.chainDark : token.chainLight;
  const fig = theme === 'Dark' ? token.figmaDark : token.figmaLight;
  const gen = theme === 'Dark' ? token.generatedDark : token.generatedLight;
  const swatch = theme === 'Dark' ? token.swatchDark : token.swatchLight;
  return (
    <aside style={{ width: 340, flex: '0 0 340px', borderLeft: `1px solid ${C.border}`, background: C.rail, padding: 16, overflow: 'auto', fontFamily: C.sans }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 13, color: C.text }}>Inspect · {theme}</strong>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', color: C.textMuted, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ marginTop: 12, font: `12px/1.5 ${C.mono}`, color: C.text, wordBreak: 'break-all' }}>{token.cssVar}</div>
      <div style={{ marginTop: 2, fontSize: 11, color: C.textMuted }}>{token.type}{token.scopes.length ? ` · ${token.scopes.join(', ')}` : ''}</div>
      <div style={{ marginTop: 8 }}><VerdictBadge verdict={token.verdict as Verdict} /></div>

      <div style={sectionLabel}>Figma cascade (source → primitive)</div>
      <ol style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
        {chain.map((s: ExplorerStep, i) => (
          <li key={`${s.collection}-${s.path}-${i}`} style={{ padding: '7px 9px', border: `1px solid ${C.border}`, borderRadius: 6, background: C.bg, marginBottom: 6 }}>
            <div style={{ fontSize: 10, color: C.textFaint }}>{i === 0 ? 'this token' : `→ ${i}`} · {s.collection} · {s.mode}</div>
            <div style={{ font: `12px/1.4 ${C.mono}`, color: C.text, marginTop: 2, wordBreak: 'break-all' }}>{s.path}</div>
            <div style={{ font: `11px/1.4 ${C.mono}`, color: s.isAlias ? C.selText : C.textMuted, marginTop: 2 }}>{s.rawValue}</div>
          </li>
        ))}
      </ol>

      <div style={sectionLabel}>Figma resolved</div>
      <div style={valueBox(fig === '(unresolved)')}>
        {swatch ? <span style={{ width: 18, height: 18, borderRadius: 4, background: swatch, border: `1px solid ${C.borderStrong}`, flex: '0 0 auto' }} /> : null}
        <span style={{ font: `13px/1.4 ${C.mono}` }}>{fig}</span>
      </div>

      <div style={sectionLabel}>Generated (code)</div>
      <div style={valueBox(gen === '(missing)' || gen === 'CYCLE')}>
        <span style={{ font: `13px/1.4 ${C.mono}` }}>{gen}</span>
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: C.textMuted }}>CSS var: <code style={{ font: `11px ${C.mono}` }}>{token.cssVar}</code></div>
    </aside>
  );
}
const sectionLabel: React.CSSProperties = { marginTop: 16, fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 };
const valueBox = (bad: boolean): React.CSSProperties => ({ marginTop: 6, padding: '9px 11px', border: `1px solid ${bad ? V.DIFF.fg : C.border}`, borderRadius: 6, background: bad ? V.DIFF.bg : C.bg, color: bad ? V.DIFF.fg : C.text, display: 'flex', alignItems: 'center', gap: 9 });

// ── Main ─────────────────────────────────────────────────────────────────────
export default function CascadeExplorer({ data }: { data: ExplorerData }) {
  const [sel, setSel] = useState<{ coll: number; group: string }>({ coll: 0, group: ALL_GROUPS });
  const [search, setSearch] = useState('');
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [theme, setTheme] = useState<'Light' | 'Dark'>('Light');

  const coll = data.collections[sel.coll];
  const q = search.trim().toLowerCase();

  const visibleTokens = useMemo(() => {
    if (!coll) return [];
    return coll.tokens.filter((t) => {
      if (sel.group !== ALL_GROUPS && t.group !== sel.group && !t.group.startsWith(sel.group + '/')) return false;
      if (q && !t.cssVar.toLowerCase().includes(q) && !t.id.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [coll, sel.group, q]);

  const grouped = useMemo(() => {
    const out: { group: string; tokens: ExplorerToken[] }[] = [];
    const idx = new Map<string, ExplorerToken[]>();
    for (const t of visibleTokens) {
      if (!idx.has(t.group)) { const b: ExplorerToken[] = []; idx.set(t.group, b); out.push({ group: t.group, tokens: b }); }
      idx.get(t.group)!.push(t);
    }
    return out;
  }, [visibleTokens]);

  const selectedToken = useMemo(() => (selectedTokenId ? coll?.tokens.find((t) => t.id === selectedTokenId) ?? null : null), [coll, selectedTokenId]);
  const toggle = (id: string) => setCollapsed((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const integ = data.integrity;

  return (
    <div className={styles.explorer} style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: C.bg, fontFamily: C.sans, color: C.text }}>
      {/* Left rail */}
      <div style={{ width: 260, flex: '0 0 260px', background: C.rail, display: 'flex', flexDirection: 'column', minWidth: 0, borderRight: `1px solid ${C.border}` }}>
        <div style={{ padding: '12px 14px 8px', fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Hierarchy</div>
        <div style={{ overflow: 'auto', flex: '1 1 auto', minHeight: 40 }}>
          <HierarchyTree collections={data.collections} sel={sel} collapsed={collapsed} onToggle={toggle}
            onSelectColl={(i) => { setSel({ coll: i, group: ALL_GROUPS }); setSelectedTokenId(null); }}
            onSelectGroup={(c, g) => { setSel({ coll: c, group: g }); setSelectedTokenId(null); }} />
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{coll?.shortName ?? '—'}</div>
          <span style={{ fontSize: 11, color: C.textFaint }}>{coll?.tokens.length ?? 0} tokens · {coll?.modes.length ?? 0} mode{(coll?.modes.length ?? 0) > 1 ? 's' : ''}</span>
          <div style={{ flex: '1 1 auto' }} />
          <span style={{ display: 'inline-flex', border: `1px solid ${C.chipBorder}`, borderRadius: 7, overflow: 'hidden' }} title="Focus mode for the Inspect chain">
            {(['Light', 'Dark'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTheme(t)} style={{ border: 'none', padding: '3px 9px', fontSize: 11, cursor: 'pointer', background: theme === t ? C.selBg : 'transparent', color: theme === t ? C.selText : C.textMuted, fontWeight: theme === t ? 600 : 400 }}>{t === 'Light' ? '☀ Light' : '☾ Dark'}</button>
            ))}
          </span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search variables…" style={{ border: `1px solid ${C.borderStrong}`, borderRadius: 7, padding: '5px 10px', fontSize: 12, outline: 'none', background: C.bg, color: C.text, width: 200, fontFamily: C.sans }} />
        </div>

        {/* Integrity + per-screen banner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 12, flexWrap: 'wrap', background: integ.verified ? V.MATCH.bg : V.DIFF.bg }}>
          <span style={{ color: integ.verified ? V.MATCH.fg : V.DIFF.fg, fontWeight: 600 }}>{integ.verified ? '✓ run verified' : '⚠ run NOT verified — verdicts forced UNVERIFIED'}</span>
          <span style={{ color: C.textMuted }}>{integ.reason}</span>
          <div style={{ flex: '1 1 auto' }} />
          <span style={{ color: C.textMuted }}>screen <code style={{ font: `11px ${C.mono}` }}>{data.screen}</code> · <b>{data.consumedCount}</b> consumed{data.perScreen ? '' : ' (all)'}</span>
          {order.map((v) => data.counts[v] ? <span key={v} style={{ color: V[v].fg, fontWeight: 600 }}>{data.counts[v]} {V[v].label}</span> : null)}
        </div>

        {/* Column header */}
        <div style={{ display: 'flex', alignItems: 'stretch', padding: '6px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          <div style={{ flex: '0 0 30%', minWidth: 0 }}>Name</div>
          <div style={{ flex: '1 1 0', minWidth: 0, paddingLeft: 8, borderLeft: `1px solid ${C.border}`, color: theme === 'Light' ? C.selText : C.textMuted }}>Figma · Light</div>
          <div style={{ flex: '1 1 0', minWidth: 0, paddingLeft: 8, borderLeft: `1px solid ${C.border}`, color: theme === 'Dark' ? C.selText : C.textMuted }}>Figma · Dark</div>
          <div style={{ flex: '1 1 0', minWidth: 0, paddingLeft: 8, borderLeft: `1px solid ${C.border}` }}>Generated · {theme}</div>
          <div style={{ flex: '0 0 96px', paddingLeft: 8, borderLeft: `1px solid ${C.border}` }}>Verdict</div>
        </div>

        {/* Rows */}
        <div style={{ overflow: 'auto', flex: '1 1 auto' }}>
          {grouped.length === 0 ? (
            <div style={{ padding: 24, fontSize: 12, color: C.textFaint }}>No variables match.</div>
          ) : grouped.map((bucket) => (
            <div key={bucket.group || '(root)'}>
              {bucket.group ? <div style={{ padding: '5px 14px', background: C.groupBg, borderBottom: `1px solid ${C.border}`, font: `11px/1.4 ${C.mono}`, color: C.textMuted }}>{bucket.group}</div> : null}
              {bucket.tokens.map((t) => {
                const selected = t.id === selectedTokenId;
                const gen = theme === 'Dark' ? t.generatedDark : t.generatedLight;
                const genSwatch = t.type === 'color' && /^#|^oklch\(|^rgb/.test(gen) ? gen : undefined;
                return (
                  <div key={t.id} onClick={() => setSelectedTokenId(selected ? null : t.id)} style={{ borderBottom: `1px solid ${C.border}`, background: selected ? C.selBg : 'transparent', padding: '6px 14px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <div style={{ flex: '0 0 30%', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <TypeIcon type={t.type} swatch={t.swatchLight} />
                      <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.text }} title={t.cssVar}>{t.name}</span>
                    </div>
                    <div style={{ flex: '1 1 0', minWidth: 0, paddingLeft: 8, borderLeft: `1px solid ${C.border}` }}><Swatch v={t.figmaLight} color={t.swatchLight} /></div>
                    <div style={{ flex: '1 1 0', minWidth: 0, paddingLeft: 8, borderLeft: `1px solid ${C.border}` }}><Swatch v={t.figmaDark} color={t.swatchDark} /></div>
                    <div style={{ flex: '1 1 0', minWidth: 0, paddingLeft: 8, borderLeft: `1px solid ${C.border}` }}><Swatch v={gen} color={genSwatch} /></div>
                    <div style={{ flex: '0 0 96px', paddingLeft: 8, borderLeft: `1px solid ${C.border}` }}><VerdictBadge verdict={t.verdict as Verdict} /></div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Inspect rail */}
      {selectedToken ? <InspectPanel token={selectedToken} theme={theme} onClose={() => setSelectedTokenId(null)} /> : null}
    </div>
  );
}
