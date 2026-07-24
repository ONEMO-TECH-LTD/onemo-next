/**
 * KAI-9686 — permanent per-screen token cascade explorer.
 * /tokens-cascade/<screenKey>/<runId> — a Figma-Variables-panel-faithful, navigable view of
 * every token a converted screen consumes: Collections ▸ Groups hierarchy, the full Figma→code
 * cascade per token (both modes), the generated value, and a fail-visible verdict. Run
 * integrity (sealed source + tokens.css hash-match the manifest, fileKey bound to route) is
 * checked up front; an unverifiable run forces every verdict UNVERIFIED (fail-closed).
 */
import { findRun } from '../../_lib/match';
import { buildExplorerData } from '../../_lib/explorer-data';
import CascadeExplorer from '../../_lib/CascadeExplorer';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ screen: string; run: string }> }) {
  const { screen, run } = await params;
  const rp = findRun(screen, run);
  if (!rp) {
    return (
      <main style={{ padding: '24px 28px', fontFamily: 'ui-monospace, monospace', color: '#1c1c1e' }}>
        <h1 style={{ fontSize: 18 }}>Token cascade — run not found</h1>
        <p>No sealed run at <code>{screen}/{run}</code>.</p>
      </main>
    );
  }
  const data = buildExplorerData(rp);
  if (!data.collections.length) {
    return (
      <main style={{ padding: '24px 28px', fontFamily: 'ui-monospace, monospace', color: '#1c1c1e' }}>
        <h1 style={{ fontSize: 18 }}>Token cascade — {screen}</h1>
        <p>This run consumes no resolvable tokens{data.perScreen ? ' for the screen' : ''}.</p>
      </main>
    );
  }
  return <CascadeExplorer data={data} />;
}
