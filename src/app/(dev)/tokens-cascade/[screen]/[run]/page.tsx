/**
 * KAI-9686 — permanent per-screen token cascade + Figma-1:1 matching page.
 * /tokens-cascade/<screenKey>/<runId> — verify a converted screen's consumed tokens against
 * the sealed Figma-source graph: full cascade (prim→alias→semantic), Light/Dark resolved
 * value, generated value, and a fail-visible verdict. Run integrity (Figma source + tokens.css
 * both hash-match the sealed manifest) is checked up front; an unverifiable run forces every
 * verdict to UNVERIFIED (fail-closed).
 */
import { buildMatch, findRun, type MatchRow, type CascadeStep } from '../../_lib/match';

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

      {/* Run-integrity banner — fail-closed: an unverified run shows every verdict as UNVERIFIED. */}
      <div style={{ fontSize: 12, marginBottom: 6, padding: '8px 10px', borderRadius: 6,
        background: integrity.verified ? '#12251e' : '#3a1113', color: integrity.verified ? '#4ade80' : '#f87171',
        border: `1px solid ${integrity.verified ? '#14532d' : '#7f1d1d'}` }}>
        {integrity.verified ? '✓ run verified' : '⚠ run NOT verified — all verdicts forced UNVERIFIED (fail-closed)'} — {integrity.reason}
        <div style={{ color: '#94a3b8', marginTop: 3, fontSize: 11 }}>
          Figma source {integrity.sourceVerified ? '✓ hash-match' : '✗'} · tokens.css {integrity.cssVerified ? '✓ hash-match' : '✗'}
          {integrity.generatorSha ? ` · generator ${integrity.generatorSha.slice(0, 12)}` : ''}
          {integrity.fileVersion ? ` · figma ${String(integrity.fileVersion).slice(0, 12)}` : ''}
        </div>
      </div>
      {/* style.module.css is a converter output, not part of the sealed token surface, so it
          cannot be hash-bound to the manifest — its sha is shown for change-detection. */}
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>
        screen scope from <code>style.module.css</code>{' '}
        {integrity.screenScopeSha ? <>sha <code>{integrity.screenScopeSha.slice(0, 12)}</code> (not part of the sealed surface — advisory)</> : '(absent)'}
      </div>

      {[...groups.entries()].map(([g, grows]) => (
        <details key={g} open style={{ marginBottom: 8, border: '1px solid #1f2937', borderRadius: 8 }}>
          <summary style={{ padding: '6px 10px', cursor: 'pointer', color: '#cbd5e1', fontSize: 13, background: '#111827' }}>
            {g} <span style={{ color: '#64748b' }}>({grows.length})</span>
          </summary>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1f2937', color: '#64748b', textAlign: 'left' }}>
                  <th style={thStyle}>CSS var</th>
                  <th style={thStyle}>Cascade (prim → alias → semantic)</th>
                  <th style={thStyle}>Figma Light</th>
                  <th style={thStyle}>Figma Dark</th>
                  <th style={thStyle}>Generated</th>
                  <th style={thStyle}>Verdict</th>
                </tr>
              </thead>
              <tbody>
                {grows.map((r) => (
                  <tr key={r.cssVar} style={{ borderBottom: '1px solid #111827' }}>
                    <td style={{ padding: '4px 10px', color: '#93c5fd', whiteSpace: 'nowrap' }}>{r.cssVar}</td>
                    <td style={{ padding: '4px 10px' }}>
                      <Cascade steps={r.cascade} />
                      {r.modesDiffer && r.cascadeDark && (
                        <div style={{ marginTop: 3 }}>
                          <span style={{ color: '#7dd3fc', fontSize: 10, marginRight: 4 }}>dark:</span>
                          <Cascade steps={r.cascadeDark} />
                        </div>
                      )}
                    </td>
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
const thStyle: React.CSSProperties = { padding: '4px 10px', fontWeight: 600, whiteSpace: 'nowrap' };

/** Full prim→alias→semantic cascade as chips with arrows; alias hops labelled by their ref. */
function Cascade({ steps }: { steps: CascadeStep[] }) {
  if (!steps.length) return <span style={{ color: '#64748b' }}>—</span>;
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
      {steps.map((s, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{
            background: s.isAlias ? '#1e293b' : '#0f2a1e', color: s.isAlias ? '#cbd5e1' : '#86efac',
            padding: '1px 6px', borderRadius: 4, fontSize: 11, whiteSpace: 'nowrap',
          }} title={s.isAlias ? `${s.collection}/${s.path} → ${s.raw}` : `${s.collection}/${s.path} = ${s.raw}`}>
            <span style={{ color: '#64748b' }}>{s.collection}/</span>{s.path}{!s.isAlias && <span style={{ color: '#64748b' }}> ={s.raw}</span>}
          </span>
          {i < steps.length - 1 && <span style={{ color: '#475569' }}>→</span>}
        </span>
      ))}
    </span>
  );
}

function Swatch({ v }: { v: string }) {
  const isColor = /^#|^oklch\(|^rgb/.test(v);
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
    {isColor && <span style={{ width: 12, height: 12, borderRadius: 3, background: v, border: '1px solid #334155', display: 'inline-block' }} />}
    <span style={{ color: '#cbd5e1' }}>{v}</span>
  </span>;
}
