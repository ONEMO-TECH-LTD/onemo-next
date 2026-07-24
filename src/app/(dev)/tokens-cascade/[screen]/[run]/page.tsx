/**
 * KAI-9686 — permanent per-screen token cascade + Figma-1:1 matching page.
 * Open at /tokens-cascade/<screenKey>/<runId> to verify a converted screen's tokens
 * against Figma: every token with its cascade, Light/Dark resolved value, the generated
 * value, and a MATCH/DIFF verdict. Read-only display half of the SSOT VariablesPanel dash.
 */
import { buildMatch, findRun, type MatchRow } from '../../_lib/match';

export const dynamic = 'force-dynamic';

const verdictColor: Record<string, string> = {
  MATCH: '#12251e', DIFF: '#3a1113', DERIVED: '#1a2230', UNRESOLVED: '#2a2410',
};
const verdictText: Record<string, string> = {
  MATCH: '#4ade80', DIFF: '#f87171', DERIVED: '#7dd3fc', UNRESOLVED: '#fbbf24',
};

export default async function Page({ params }: { params: Promise<{ screen: string; run: string }> }) {
  const { screen, run } = await params;
  const rp = findRun(screen, run);
  if (!rp) {
    return <main style={{ padding: 24, fontFamily: 'ui-monospace, monospace' }}>
      <h1>Token cascade — run not found</h1>
      <p>No sealed run at <code>{screen}/{run}</code>. Expected <code>_inputs/variables-source.json</code> + <code>_token-surface/artifacts/tokens.css</code>.</p>
    </main>;
  }
  const { rows, counts } = buildMatch(rp);
  const order = ['DIFF', 'UNRESOLVED', 'DERIVED', 'MATCH'];
  const sorted = [...rows].sort((a, b) => order.indexOf(a.verdict) - order.indexOf(b.verdict) || a.cssVar.localeCompare(b.cssVar));

  return (
    <main style={{ padding: '20px 24px', fontFamily: 'ui-monospace, SFMono-Regular, monospace', color: '#e5e7eb', background: '#0b0e14', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 18, margin: '0 0 4px' }}>Token cascade — Figma 1:1 matching</h1>
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
        screen <code>{screen}</code> · run <code>{run}</code> · {rows.length} tokens ·{' '}
        {order.map((v) => counts[v] ? <span key={v} style={{ color: verdictText[v], marginRight: 12 }}>{counts[v]} {v}</span> : null)}
      </div>
      <div style={{ overflowX: 'auto', border: '1px solid #1f2937', borderRadius: 8 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#111827', textAlign: 'left' }}>
              {['CSS var', 'cascade', 'Figma (Light)', 'Figma (Dark)', 'Generated', 'Resolved', ''].map((h) => (
                <th key={h} style={{ padding: '6px 10px', borderBottom: '1px solid #1f2937', position: 'sticky', top: 0, background: '#111827', color: '#cbd5e1' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r: MatchRow) => (
              <tr key={r.cssVar} style={{ borderBottom: '1px solid #111827' }}>
                <td style={{ padding: '4px 10px', color: '#93c5fd', whiteSpace: 'nowrap' }}>{r.cssVar}</td>
                <td style={{ padding: '4px 10px', color: '#64748b', whiteSpace: 'nowrap' }}>{r.chain}</td>
                <td style={{ padding: '4px 10px' }}><Swatch v={r.figmaLight} /></td>
                <td style={{ padding: '4px 10px' }}><Swatch v={r.figmaDark} /></td>
                <td style={{ padding: '4px 10px', color: '#cbd5e1', whiteSpace: 'nowrap' }}>{r.generated}</td>
                <td style={{ padding: '4px 10px', color: '#e5e7eb', whiteSpace: 'nowrap' }}>{r.generatedResolved}</td>
                <td style={{ padding: '4px 10px' }}>
                  <span style={{ background: verdictColor[r.verdict], color: verdictText[r.verdict], padding: '1px 8px', borderRadius: 4, fontSize: 11 }}>{r.verdict}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Swatch({ v }: { v: string }) {
  const isColor = /^#|^oklch\(|^rgb/.test(v);
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
    {isColor && <span style={{ width: 12, height: 12, borderRadius: 3, background: v, border: '1px solid #334155', display: 'inline-block' }} />}
    <span style={{ color: '#cbd5e1' }}>{v}</span>
  </span>;
}
