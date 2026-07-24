/**
 * KAI-9686 — permanent per-screen token cascade + Figma-1:1 matching page.
 * /tokens-cascade/<screenKey>/<runId> — verify a converted screen's consumed tokens against
 * Figma: cascade, Light/Dark resolved value, generated value, and a fail-visible verdict.
 * Run integrity (sealed token-surface manifest + tokens.css hash) is checked up front.
 */
import { buildMatch, findRun, type MatchRow } from '../../_lib/match';

export const dynamic = 'force-dynamic';

const vColor: Record<string, string> = { MATCH: '#12251e', DIFF: '#3a1113', DERIVED: '#1a2230', UNVERIFIED: '#2a2410' };
const vText: Record<string, string> = { MATCH: '#4ade80', DIFF: '#f87171', DERIVED: '#7dd3fc', UNVERIFIED: '#fbbf24' };
const order = ['DIFF', 'UNVERIFIED', 'DERIVED', 'MATCH'];

export default async function Page({ params }: { params: Promise<{ screen: string; run: string }> }) {
  const { screen, run } = await params;
  const rp = findRun(screen, run);
  if (!rp) {
    return <main style={sMain}><h1>Token cascade — run not found</h1><p>No sealed run at <code>{screen}/{run}</code>.</p></main>;
  }
  const { rows, counts, integrity } = buildMatch(rp);
  // group by collection for the Figma-like hierarchy
  const groups = new Map<string, MatchRow[]>();
  for (const r of [...rows].sort((a, b) => order.indexOf(a.verdict) - order.indexOf(b.verdict) || a.cssVar.localeCompare(b.cssVar))) {
    const g = r.collection.replace(/^\.?\d+(?:\.\d+)?-/, '');
    (groups.get(g) ?? groups.set(g, []).get(g)!).push(r);
  }

  return (
    <main style={sMain}>
      <h1 style={{ fontSize: 18, margin: '0 0 4px' }}>Token cascade — Figma 1:1 matching</h1>
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
        screen <code>{screen}</code> · run <code>{run}</code> · showing <b>{rows.length}</b> consumed tokens
        {rp.screenCss ? ' (per-screen)' : ' (all — screen module CSS absent)'} ·{' '}
        {order.map((v) => counts[v] ? <span key={v} style={{ color: vText[v], marginRight: 12 }}>{counts[v]} {v}</span> : null)}
      </div>
      <div style={{ fontSize: 12, marginBottom: 12, padding: '6px 10px', borderRadius: 6,
        background: integrity.verified ? '#12251e' : '#2a2410', color: integrity.verified ? '#4ade80' : '#fbbf24' }}>
        {integrity.verified ? '✓ run verified' : '⚠ run NOT verified'} — {integrity.reason}
        {integrity.generatorSha ? ` · generator ${integrity.generatorSha.slice(0, 12)}` : ''}
      </div>
      {[...groups.entries()].map(([g, grows]) => (
        <details key={g} open style={{ marginBottom: 8, border: '1px solid #1f2937', borderRadius: 8 }}>
          <summary style={{ padding: '6px 10px', cursor: 'pointer', color: '#cbd5e1', fontSize: 13, background: '#111827' }}>
            {g} <span style={{ color: '#64748b' }}>({grows.length})</span>
          </summary>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
              <tbody>
                {grows.map((r) => (
                  <tr key={r.cssVar} style={{ borderBottom: '1px solid #111827' }}>
                    <td style={{ padding: '4px 10px', color: '#93c5fd', whiteSpace: 'nowrap' }}>{r.cssVar}</td>
                    <td style={{ padding: '4px 10px', color: '#64748b', whiteSpace: 'nowrap' }}>{r.chain}</td>
                    <td style={{ padding: '4px 10px' }}><Swatch v={r.figmaLight} /></td>
                    <td style={{ padding: '4px 10px' }}><Swatch v={r.figmaDark} /></td>
                    <td style={{ padding: '4px 10px', color: '#e5e7eb', whiteSpace: 'nowrap' }}><Swatch v={r.generatedResolved} /></td>
                    <td style={{ padding: '4px 10px' }}>
                      <span style={{ background: vColor[r.verdict], color: vText[r.verdict], padding: '1px 8px', borderRadius: 4, fontSize: 11 }}>{r.verdict}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </main>
  );
}

const sMain: React.CSSProperties = { padding: '20px 24px', fontFamily: 'ui-monospace, SFMono-Regular, monospace', color: '#e5e7eb', background: '#0b0e14', minHeight: '100vh' };

function Swatch({ v }: { v: string }) {
  const isColor = /^#|^oklch\(|^rgb/.test(v);
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
    {isColor && <span style={{ width: 12, height: 12, borderRadius: 3, background: v, border: '1px solid #334155', display: 'inline-block' }} />}
    <span style={{ color: '#cbd5e1' }}>{v}</span>
  </span>;
}
