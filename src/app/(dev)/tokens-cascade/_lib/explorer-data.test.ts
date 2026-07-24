/**
 * KAI-9686 — buildExplorerData: the grouped per-screen model behind the explorer page.
 * Verifies the Figma-like hierarchy (collections ▸ groups), the full per-token Figma→code
 * cascade, per-screen filtering, fail-closed integrity, and grading PARITY with buildMatch
 * (both share computeVerdict — they cannot drift).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildExplorerData } from './explorer-data';
import { buildMatch, type RunPaths } from './match';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

// A run: Sem-Col/text/primary (grouped, TEXT_FILL) aliases Prim-Col/base/ink; both modes.
function mkRun(opts: { withScreen?: boolean; goodHash?: boolean } = {}): RunPaths {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ed-'));
  const source = JSON.stringify([
    { 'Sem-Col': { modes: {
      Light: { text: { primary: { $type: 'color', $value: '{base.ink}', $collectionName: 'Prim-Col', $scopes: ['TEXT_FILL'] } } },
      Dark: { text: { primary: { $type: 'color', $value: '{base.ink}', $collectionName: 'Prim-Col', $scopes: ['TEXT_FILL'] } } },
    } } },
    { 'Prim-Col': { modes: {
      Light: { base: { ink: { $type: 'color', $value: '#000000' }, other: { $type: 'color', $value: '#123456' } } },
      Dark: { base: { ink: { $type: 'color', $value: '#ffffff' }, other: { $type: 'color', $value: '#123456' } } },
    } } },
  ]);
  const css = ':root{--prim-col-base-ink:oklch(0% 0 0);--prim-col-base-other:oklch(30% 0.05 250);--sem-col-text-primary:var(--prim-col-base-ink);}\n[data-theme="dark"]{--prim-col-base-ink:oklch(100% 0 0);}\n';
  const screenCss = '.a{color:var(--sem-col-text-primary);}\n';
  fs.writeFileSync(path.join(d, 'variables-source.json'), source);
  fs.writeFileSync(path.join(d, 'tokens.css'), css);
  fs.writeFileSync(path.join(d, 'style.module.css'), screenCss);
  fs.writeFileSync(path.join(d, 'token-surface.json'), JSON.stringify({
    source: { relativePath: '_inputs/variables-source.json', sha256: sha(source), fileKey: 'FK', fileVersion: 'FV' },
    artifacts: [{ role: 'css', relativePath: 'artifacts/tokens.css', sha256: opts.goodHash === false ? 'deadbeef'.repeat(8) : sha(css) }],
    generator: { gitSha: 'abc' },
  }));
  return {
    root: d, source: path.join(d, 'variables-source.json'), css: path.join(d, 'tokens.css'),
    manifest: path.join(d, 'token-surface.json'),
    screenCss: opts.withScreen ? path.join(d, 'style.module.css') : null,
    screen: 'FK--12-34', run: 'r',
  };
}

describe('buildExplorerData — Figma-like model', () => {
  it('builds the collections ▸ groups hierarchy with per-token full cascade', () => {
    const d = buildExplorerData(mkRun());
    expect(d.integrity.verified).toBe(true);
    const sem = d.collections.find((c) => c.shortName === 'Sem-Col')!;
    expect(sem).toBeTruthy();
    expect(sem.groups.some((g) => g.name === 'text')).toBe(true);            // grouped like Figma
    const tok = sem.tokens.find((t) => t.cssVar === '--sem-col-text-primary')!;
    expect(tok.group).toBe('text');
    expect(tok.chainLight.length).toBeGreaterThanOrEqual(2);                 // semantic → primitive chain
    expect(tok.chainLight[tok.chainLight.length - 1].collection).toContain('Prim-Col');
    expect(tok.figmaLight).toBe('#000000');
    expect(tok.figmaDark).toBe('#ffffff');
    expect(tok.verdict).toBe('MATCH');                                        // #000 == oklch(0% 0 0)
    expect(tok.modesDiffer).toBe(true);                                       // light/dark values differ
  });

  it('per-screen filter keeps only consumed tokens (+ their alias closure)', () => {
    const all = buildExplorerData(mkRun({ withScreen: false }));
    const scoped = buildExplorerData(mkRun({ withScreen: true }));
    expect(scoped.perScreen).toBe(true);
    // consumed: --sem-col-text-primary + its Prim-Col/base/ink terminal; NOT --prim-col-base-other.
    const allVars = new Set(all.collections.flatMap((c) => c.tokens.map((t) => t.cssVar)));
    const scopedVars = new Set(scoped.collections.flatMap((c) => c.tokens.map((t) => t.cssVar)));
    expect(allVars.has('--prim-col-base-other')).toBe(true);        // present in the full model
    expect(scopedVars.has('--prim-col-base-other')).toBe(false);    // filtered out per-screen
    expect(scopedVars.has('--sem-col-text-primary')).toBe(true);
    expect(scopedVars.has('--prim-col-base-ink')).toBe(true);       // alias-closure terminal kept
  });

  it('BITE: tampered run → every verdict UNVERIFIED (fail-closed)', () => {
    const d = buildExplorerData(mkRun({ goodHash: false }));
    expect(d.integrity.verified).toBe(false);
    const verdicts = d.collections.flatMap((c) => c.tokens.map((t) => t.verdict));
    expect(verdicts.every((v) => v === 'UNVERIFIED')).toBe(true);
    expect(d.counts.MATCH ?? 0).toBe(0);
  });

  it('PARITY: grades identically to buildMatch (shared computeVerdict, no drift)', () => {
    const rp = mkRun();
    const ed = buildExplorerData(rp);
    const bm = buildMatch(rp);
    const edByVar = new Map(ed.collections.flatMap((c) => c.tokens).map((t) => [t.cssVar, t.verdict]));
    for (const row of bm.rows) {
      expect(edByVar.get(row.cssVar)).toBe(row.verdict);
    }
  });
});
