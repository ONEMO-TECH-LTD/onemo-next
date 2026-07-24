/**
 * KAI-9686 mutation bites — the matching model must FAIL VISIBLY on each decisive corruption
 * pixel's review found false-greening: stripped alpha, wrong unit, dropped token, cycles,
 * a tampered Figma-source oracle, and an unverifiable run (fail-closed), plus %/ms domains.
 */
import { describe, it, expect } from 'vitest';
import { compareOne, toComparable, expectedUnit, consumedVars, verifyRun, buildMatch, type RunPaths } from './match';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

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

describe('compareOne — percent / duration domains (KAI-9686 rework)', () => {
  it('percent Figma 50 vs 50% MATCH; vs 60% DIFF', () => {
    expect(compareOne('50', '50%', 'float')).toBe('MATCH');
    expect(compareOne('50', '60%', 'float')).toBe('DIFF');
  });
  it('duration Figma 200 vs 200ms MATCH; vs 0.2s(=200ms) MATCH; vs 300ms DIFF', () => {
    expect(compareOne('200', '200ms', 'float')).toBe('MATCH');
    expect(compareOne('200', '0.2s', 'float')).toBe('MATCH');
    expect(compareOne('200', '300ms', 'float')).toBe('DIFF');
  });
  it('toComparable tags domains', () => {
    expect(toComparable('50%')).toEqual({ n: 50, unit: 'percent' });
    expect(toComparable('200ms')).toEqual({ n: 200, unit: 'ms' });
    expect(toComparable('0.5s')).toEqual({ n: 500, unit: 'ms' });
    expect(toComparable('1rem')).toEqual({ n: 16, unit: 'px' });
    expect(toComparable('nonsense')).toBeNull();
  });
});

describe('domain-pin from the Figma scope contract (KAI-9686 rework #2)', () => {
  it('expectedUnit maps scopes to domains (or null when unpinned)', () => {
    expect(expectedUnit(['LETTER_SPACING'])).toBe('px');
    expect(expectedUnit(['OPACITY'])).toBe('unitless');
    expect(expectedUnit(['CORNER_RADIUS'])).toBe('px');
    expect(expectedUnit(['(none)'])).toBeNull();   // ratios/durations carry no mapped scope
    expect(expectedUnit(undefined)).toBeNull();
  });
  it('BITE: a px-domain token emitted as ms or % is DIFF at equal magnitude', () => {
    expect(compareOne('50', '50ms', 'float', 'px')).toBe('DIFF');
    expect(compareOne('200', '200%', 'float', 'px')).toBe('DIFF');
    expect(compareOne('50', '50px', 'float', 'px')).toBe('MATCH');
    expect(compareOne('10', '0.625rem', 'float', 'px')).toBe('MATCH'); // rem is the px domain
  });
  it('BITE: an OPACITY (unitless) token emitted with a unit is DIFF', () => {
    expect(compareOne('0.8', '0.8', 'float', 'unitless')).toBe('MATCH');
    expect(compareOne('0.8', '0.8px', 'float', 'unitless')).toBe('DIFF');
  });
  it('no scope contract → magnitude only (page always supplies the scope)', () => {
    expect(compareOne('50', '50ms', 'float')).toBe('MATCH');
  });
  it('only BARE unitless zero is domain-agnostic; explicit wrong-domain zero is DIFF', () => {
    expect(compareOne('0', '0', 'float', 'px')).toBe('MATCH');    // bare 0 == 0px
    expect(compareOne('0', '0px', 'float', 'px')).toBe('MATCH');  // matching domain
    expect(compareOne('0', '0ms', 'float', 'px')).toBe('DIFF');   // 0ms is not 0px
    expect(compareOne('0', '0%', 'float', 'px')).toBe('DIFF');    // 0% is not 0px
  });
  it('collection fallback pins UNSCOPED tokens by DS convention', () => {
    expect(expectedUnit(['(none)'], 'Prim-Dim')).toBe('px');
    expect(expectedUnit([], 'Prim-Ratios')).toBe('unitless');
    expect(expectedUnit([], 'Prim-Type')).toBeNull();            // strings — no float domain
    expect(expectedUnit(['LETTER_SPACING'], 'Prim-Motion', 'x')).toBe('px'); // scope wins
  });
  it('motion is MIXED-domain — resolved by path, never blanket-pinned', () => {
    expect(expectedUnit([], 'Prim-Motion', 'time/200')).toBe('ms');
    expect(expectedUnit([], '.2.7-Al-Motion', 'duration/base')).toBe('ms');
    expect(expectedUnit([], '.2.7-Al-Motion', 'scale/press')).toBe('unitless');   // NOT ms
    expect(expectedUnit([], '.2.7-Al-Motion', 'spring/response')).toBe('unitless'); // NOT ms
    expect(expectedUnit([], '3.8-Sem-Motion', 'easing/standard')).toBeNull();     // string
    expect(expectedUnit([], 'Prim-Motion')).toBeNull();          // no path → unclassified, unpinned
  });
  it('BITE: a motion scale (unitless) is NOT false-DIFF as ms', () => {
    // regression for the 131-false-DIFF blanket motion→ms bug.
    const exp = expectedUnit([], '.2.7-Al-Motion', 'scale/press'); // 'unitless'
    expect(compareOne('0.96', '0.96', 'float', exp)).toBe('MATCH');
    expect(compareOne('300', '300', 'float', expectedUnit([], '.2.7-Al-Motion', 'spring/damping'))).toBe('MATCH');
  });
  it('BITE: an unscoped Prim-Dim 2.5rem(=40px) emitted as 40ms is DIFF, not a same-magnitude MATCH', () => {
    const exp = expectedUnit([], 'Prim-Dim');                    // 'px'
    expect(compareOne('40', '40ms', 'float', exp)).toBe('DIFF');
    expect(compareOne('40', '2.5rem', 'float', exp)).toBe('MATCH');
  });
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

describe('verifyRun — run integrity (source oracle + css + identity)', () => {
  // A run dir with a Figma source, generated css, and a manifest sealing BOTH hashes.
  const mk = (opts: { source?: string; css?: string; manifestSourceSha?: string; manifestCssSha?: string; fileVersion?: string | null } = {}) => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-'));
    const source = opts.source ?? '[{"Prim":{"modes":{"Light":{}}}}]';
    const css = opts.css ?? ':root{--x:1px}\n';
    fs.writeFileSync(path.join(d, 'variables-source.json'), source);
    fs.writeFileSync(path.join(d, 'tokens.css'), css);
    const man = {
      source: { relativePath: '_inputs/variables-source.json', sha256: opts.manifestSourceSha ?? sha(source), fileKey: 'FK', ...(opts.fileVersion === null ? {} : { fileVersion: opts.fileVersion ?? 'FV' }) },
      artifacts: [{ role: 'css', relativePath: 'artifacts/tokens.css', sha256: opts.manifestCssSha ?? sha(css) }],
      generator: { gitSha: 'abc123' },
    };
    const m = path.join(d, 'token-surface.json');
    fs.writeFileSync(m, JSON.stringify(man));
    return { d, m };
  };
  // route screen encodes the fileKey as `<fileKey>--<node>`; manifest fileKey is 'FK'.
  const rp = (d: string, m: string | null, screen = 'FK--12-34'): RunPaths =>
    ({ root: d, source: path.join(d, 'variables-source.json'), css: path.join(d, 'tokens.css'), manifest: m, screenCss: null, screen, run: 'r' });

  it('valid manifest — source + css hash-match + fileKey binds to route → verified', () => {
    const { d, m } = mk();
    expect(verifyRun(rp(d, m)).verified).toBe(true);
  });
  it('BITE: manifest fileKey != route screen fileKey → NOT verified', () => {
    const { d, m } = mk();
    expect(verifyRun(rp(d, m, 'WRONG-FILE-KEY--12-34')).verified).toBe(false);
  });
  it('BITE: tampered Figma source (still-matching manifest) → NOT verified', () => {
    // manifest seals the ORIGINAL source hash; we overwrite the source on disk after.
    const { d, m } = mk();
    fs.writeFileSync(path.join(d, 'variables-source.json'), '[{"Prim":{"modes":{"Light":{"x":{"$type":"float","$value":999}}}}}]');
    const r = verifyRun(rp(d, m));
    expect(r.verified).toBe(false);
    expect(r.sourceVerified).toBe(false);
  });
  it('BITE: tampered tokens.css (wrong hash) → NOT verified', () => {
    const { d, m } = mk({ manifestCssSha: 'deadbeef'.repeat(8) });
    const r = verifyRun(rp(d, m));
    expect(r.verified).toBe(false);
    expect(r.cssVerified).toBe(false);
  });
  it('BITE: manifest missing fileVersion identity → NOT verified', () => {
    const { d, m } = mk({ fileVersion: null });
    expect(verifyRun(rp(d, m)).verified).toBe(false);
  });
  it('BITE: no manifest → NOT verified (fail-closed)', () => {
    const { d } = mk();
    expect(verifyRun(rp(d, null)).verified).toBe(false);
  });
});

describe('buildMatch — fail-closed on unverifiable run', () => {
  // A run whose value WOULD match, but whose manifest css hash is wrong → integrity fails.
  const mkRun = (goodManifest: boolean) => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-'));
    // one collection, one primitive float leaf = 8 (px)
    const source = JSON.stringify([{ 'Prim-Dim': { modes: { Light: { r: { $type: 'float', $value: 8 } }, Dark: { r: { $type: 'float', $value: 8 } } } } }]);
    const css = ':root{--prim-dim-r:8px;}\n';
    fs.writeFileSync(path.join(d, 'variables-source.json'), source);
    fs.writeFileSync(path.join(d, 'tokens.css'), css);
    fs.writeFileSync(path.join(d, 'token-surface.json'), JSON.stringify({
      source: { relativePath: '_inputs/variables-source.json', sha256: sha(source), fileKey: 'FK', fileVersion: 'FV' },
      artifacts: [{ role: 'css', relativePath: 'artifacts/tokens.css', sha256: goodManifest ? sha(css) : 'deadbeef'.repeat(8) }],
      generator: { gitSha: 'abc' },
    }));
    return { root: d, source: path.join(d, 'variables-source.json'), css: path.join(d, 'tokens.css'), manifest: path.join(d, 'token-surface.json'), screenCss: null, screen: 'FK--12-34', run: 'r' } as RunPaths;
  };
  it('verified run → the matching token is MATCH', () => {
    const { rows, integrity } = buildMatch(mkRun(true));
    expect(integrity.verified).toBe(true);
    expect(rows.find((r) => r.cssVar === '--prim-dim-r')?.verdict).toBe('MATCH');
  });
  it('BITE: tampered run → the SAME token is UNVERIFIED, never a green MATCH', () => {
    const { rows, counts, integrity } = buildMatch(mkRun(false));
    expect(integrity.verified).toBe(false);
    expect(rows.find((r) => r.cssVar === '--prim-dim-r')?.verdict).toBe('UNVERIFIED');
    expect(counts.MATCH ?? 0).toBe(0);
  });
});
