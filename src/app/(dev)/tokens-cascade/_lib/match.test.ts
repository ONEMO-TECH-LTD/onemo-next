/**
 * KAI-9686 mutation bites — the matching model must FAIL VISIBLY on each decisive corruption
 * pixel's review found false-greening: stripped alpha, wrong unit, dropped token, cycles,
 * plus dark, string, colour, and run-tampering.
 */
import { describe, it, expect } from 'vitest';
import { compareOne, consumedVars, verifyRun, type RunPaths } from './match';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

describe('compareOne — colour', () => {
  it('equal colour MATCH', () => expect(compareOne('#ffffff', 'oklch(100% 0 0)', 'color')).toBe('MATCH'));
  it('different colour DIFF', () => expect(compareOne('#ffffff', 'oklch(0% 0 0)', 'color')).toBe('DIFF'));
  it('BITE: stripped 5% alpha is DIFF, not MATCH', () =>
    expect(compareOne('#ffffff0d', '#ffffff', 'color')).toBe('DIFF'));
  it('equal colour with matching alpha MATCH', () =>
    expect(compareOne('#ffffff0d', 'oklch(100% 0 0 / 0.05)', 'color')).toBe('MATCH'));
});

describe('compareOne — float / units', () => {
  it('Figma 10 vs generated 10px MATCH', () => expect(compareOne('10', '10px', 'float')).toBe('MATCH'));
  it('Figma 10 vs generated 0.625rem (=10px) MATCH', () => expect(compareOne('10', '0.625rem', 'float')).toBe('MATCH'));
  it('BITE: Figma 10px vs generated 10rem (=160px) is DIFF, not MATCH', () =>
    expect(compareOne('10', '10rem', 'float')).toBe('DIFF'));
  it('letter-spacing Figma -4 vs -4px MATCH; vs -0.04em DIFF', () => {
    expect(compareOne('-4', '-4px', 'float')).toBe('MATCH');
    expect(compareOne('-4', '-0.04em', 'float')).toBe('DIFF');
  });
  it('ratio Figma 1.05 unitless MATCH', () => expect(compareOne('1.05', '1.05', 'float')).toBe('MATCH'));
});

describe('compareOne — string / fail-visible', () => {
  it('equal string MATCH; different DIFF', () => {
    expect(compareOne('Chillax', 'Chillax', 'string')).toBe('MATCH');
    expect(compareOne('Chillax', 'Electra', 'string')).toBe('DIFF');
  });
  it('BITE: dropped generated var is UNVERIFIED, not MATCH', () =>
    expect(compareOne('-4', '(missing)', 'float')).toBe('UNVERIFIED'));
  it('BITE: cyclic generated var is UNVERIFIED', () =>
    expect(compareOne('-4', 'CYCLE', 'float')).toBe('UNVERIFIED'));
  it('fluid clamp is DERIVED (verified by the browser bench, not literal here)', () =>
    expect(compareOne('16', 'clamp(1rem, 1rem + 0.5vi, 1.125rem)', 'float')).toBe('DERIVED'));
  it('broken Figma cascade is UNVERIFIED', () =>
    expect(compareOne('(unresolved)', '10px', 'float')).toBe('UNVERIFIED'));
});

describe('consumedVars — per-screen closure', () => {
  it('follows the transitive var() chain the screen uses', () => {
    const root = new Map([['--sem-x', 'var(--al-x)'], ['--al-x', 'var(--prim-x)'], ['--prim-x', '#fff'], ['--unused', '#000']]);
    const c = consumedVars('.a{color:var(--sem-x)}', root);
    expect([...c].sort()).toEqual(['--al-x', '--prim-x', '--sem-x']);
    expect(c.has('--unused')).toBe(false);
  });
});

describe('verifyRun — run integrity', () => {
  const mk = () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-'));
    fs.mkdirSync(path.join(d, '_ts'));
    const css = ':root{--x:1px}\n';
    fs.writeFileSync(path.join(d, 'tokens.css'), css);
    const sha = createHash('sha256').update(css).digest('hex');
    return { d, css, sha };
  };
  const rp = (d: string, man: string | null): RunPaths =>
    ({ root: d, source: '', css: path.join(d, 'tokens.css'), manifest: man, screenCss: null, screen: 's', run: 'r' });
  it('valid manifest + matching hash → verified', () => {
    const { d, sha } = mk();
    const m = path.join(d, 'token-surface.json');
    fs.writeFileSync(m, JSON.stringify({ artifacts: [{ role: 'css', relativePath: 'artifacts/tokens.css', sha256: sha }], generator: { gitSha: 'abc' } }));
    expect(verifyRun(rp(d, m)).verified).toBe(true);
  });
  it('BITE: tampered tokens.css (wrong hash) → NOT verified', () => {
    const { d } = mk();
    const m = path.join(d, 'token-surface.json');
    fs.writeFileSync(m, JSON.stringify({ artifacts: [{ role: 'css', relativePath: 'artifacts/tokens.css', sha256: 'deadbeef'.repeat(8) }] }));
    expect(verifyRun(rp(d, m)).verified).toBe(false);
  });
  it('BITE: no manifest → NOT verified (fail-closed)', () => {
    const { d } = mk();
    expect(verifyRun(rp(d, null)).verified).toBe(false);
  });
});
