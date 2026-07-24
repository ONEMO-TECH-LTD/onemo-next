/**
 * KAI-9686 — per-screen token cascade + Figma-1:1 matching model.
 * Reads a converted run's sealed surface (Figma source + generated CSS + the run manifest),
 * verifies run integrity, filters to the tokens THIS screen actually consumes, resolves each
 * token's Figma cascade (Light + Dark) and its generated value, and produces a fail-visible
 * MATCH / DIFF / DERIVED / UNVERIFIED verdict. Read-only display half of the SSOT VariablesPanel.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { converter, parse } from 'culori';
import { parseCollections, flattenCollection, resolveChain, type ParsedCollection } from './resolver';

const toOklch = converter('oklch');

/** Colour equivalence — L, C, H AND alpha (so a stripped-alpha corruption is a DIFF). */
function colorEq(a: string, b: string): boolean {
  const x = toOklch(parse(a)) as { l?: number; c?: number; h?: number; alpha?: number } | undefined;
  const y = toOklch(parse(b)) as { l?: number; c?: number; h?: number; alpha?: number } | undefined;
  if (!x || !y) return false;
  const near = (p = 0, q = 0, t = 0.005) => Math.abs(p - q) <= t;
  const hueOk = (x.c ?? 0) < 0.01 || (y.c ?? 0) < 0.01
    || Math.min(Math.abs((x.h ?? 0) - (y.h ?? 0)), 360 - Math.abs((x.h ?? 0) - (y.h ?? 0))) <= 1;
  return near(x.l, y.l) && near(x.c, y.c) && hueOk && near(x.alpha ?? 1, y.alpha ?? 1);
}

/** Generated dimensional value → px (unit-aware). rem×16; px as-is; bare number = unitless (ratio). */
function toPx(gen: string): { px: number; unitless: boolean } | null {
  let m = /^(-?[0-9.]+)px$/.exec(gen); if (m) return { px: parseFloat(m[1]), unitless: false };
  m = /^(-?[0-9.]+)rem$/.exec(gen); if (m) return { px: parseFloat(m[1]) * 16, unitless: false };
  m = /^(-?[0-9.]+)$/.exec(gen); if (m) return { px: parseFloat(m[1]), unitless: true };
  return null;
}

export type Verdict = 'MATCH' | 'DIFF' | 'DERIVED' | 'UNVERIFIED';

/** Compare one Figma-authored literal vs one generated resolved value (single mode). */
export function compareOne(figma: string, gen: string, type: string): Verdict {
  if (gen === '(missing)' || gen === 'CYCLE') return 'UNVERIFIED';   // dropped / cyclic generated var — fail-visible
  if (figma === '(unresolved)') return 'UNVERIFIED';                 // broken Figma cascade
  if (/clamp\(/.test(gen)) return 'DERIVED';                         // fluid clamp — verified by the browser/Figma bench, not a literal here
  if (type === 'color' || /^#|^oklch\(|^rgb/.test(figma)) return colorEq(figma, gen) ? 'MATCH' : 'DIFF';
  if (type === 'float') {
    const fn = parseFloat(figma);
    const g = toPx(gen);
    if (g === null || !Number.isFinite(fn)) return 'DIFF';
    // Figma stores a bare number: px for dimensions, the raw factor for unitless (ratio/opacity).
    // A wrong UNIT (Figma 10px → generated 10rem = 160px) is now a DIFF, not a false MATCH.
    return Math.abs(fn - g.px) < 0.01 ? 'MATCH' : 'DIFF';
  }
  return String(figma).trim() === String(gen).trim() ? 'MATCH' : 'DIFF'; // strings, exact
}

export type MatchRow = {
  collection: string; name: string; cssVar: string; type: string;
  figmaLight: string; figmaDark: string; generated: string; generatedResolved: string;
  chain: string; verdict: Verdict; consumed: boolean;
};

function cssCategory(collectionName: string): string {
  return String(collectionName).replace(/^\.?\d+(?:\.\d+)?-/, '').split(/[-_\s]+/).map((p) => p.toLowerCase()).filter(Boolean).join('-');
}
function kebab(v: string): string { return String(v).replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase(); }
function cssVarOf(collectionName: string, tokenPath: string[]): string {
  return `--${[cssCategory(collectionName), ...tokenPath.map(kebab)].join('-')}`;
}
function parseVars(css: string, selector: string): Map<string, string> {
  const m = new RegExp(selector.replace(/[.[\]="]/g, '\\$&') + '\\s*\\{([\\s\\S]*?)\\}').exec(css);
  const out = new Map<string, string>();
  if (!m) return out;
  for (const d of m[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) if (!out.has(d[1])) out.set(d[1], d[2].trim());
  return out;
}
function resolveCssVar(name: string, root: Map<string, string>, seen = new Set<string>()): string {
  if (seen.has(name)) return 'CYCLE';
  const v = root.get(name);
  if (v === undefined) return '(missing)';
  const ref = /^var\((--[a-z0-9-]+)\)$/.exec(v);
  return ref ? resolveCssVar(ref[1], root, new Set([...seen, name])) : v;
}

/** Transitive closure of the CSS vars a screen actually consumes (from its module CSS). */
export function consumedVars(screenCss: string, rootVars: Map<string, string>): Set<string> {
  const seed = new Set<string>();
  for (const m of screenCss.matchAll(/var\((--[a-z0-9-]+)/g)) seed.add(m[1]);
  const closure = new Set<string>();
  const stack = [...seed];
  while (stack.length) {
    const v = stack.pop()!;
    if (closure.has(v)) continue;
    closure.add(v);
    const val = rootVars.get(v);
    if (val) for (const r of val.matchAll(/var\((--[a-z0-9-]+)/g)) if (!closure.has(r[1])) stack.push(r[1]);
  }
  return closure;
}

export type RunPaths = { root: string; source: string; css: string; manifest: string | null; screenCss: string | null; screen: string; run: string };
export type RunIntegrity = { verified: boolean; reason: string; tokenCount?: number; generatorSha?: string };

/** Verify the run is a genuine sealed surface: token-surface manifest present, and the
 *  tokens.css bytes hash to the manifest's recorded artifact hash. Fail-closed otherwise. */
export function verifyRun(rp: RunPaths): RunIntegrity {
  if (!rp.manifest || !fs.existsSync(rp.manifest)) return { verified: false, reason: 'no token-surface manifest — cannot verify run integrity' };
  try {
    const man = JSON.parse(fs.readFileSync(rp.manifest, 'utf8'));
    const artifacts: Array<{ role?: string; relativePath?: string; sha256?: string }> = man.artifacts ?? [];
    const cssArt = artifacts.find((a) => /tokens\.css$/.test(a.relativePath ?? '') || a.role === 'css');
    if (!cssArt?.sha256) return { verified: false, reason: 'manifest has no tokens.css artifact hash' };
    const actual = createHash('sha256').update(fs.readFileSync(rp.css)).digest('hex');
    if (actual !== cssArt.sha256) return { verified: false, reason: `tokens.css hash ${actual.slice(0, 12)} != manifest ${cssArt.sha256.slice(0, 12)}` };
    return { verified: true, reason: 'run verified against sealed token-surface manifest', generatorSha: man.generator?.gitSha };
  } catch (e) {
    return { verified: false, reason: `manifest unreadable: ${(e as Error).message}` };
  }
}

export function buildMatch(rp: RunPaths): { rows: MatchRow[]; counts: Record<string, number>; integrity: RunIntegrity; consumedCount: number } {
  const integrity = verifyRun(rp);
  const source = JSON.parse(fs.readFileSync(rp.source, 'utf8'));
  const collections: ParsedCollection[] = parseCollections(source);
  const css = fs.readFileSync(rp.css, 'utf8');
  const rootVars = parseVars(css, ':root');
  const darkVars = parseVars(css, '[data-theme="dark"]');
  const darkResolveVars = new Map(rootVars);
  for (const [k, v] of darkVars) darkResolveVars.set(k, v);
  const screenCss = rp.screenCss && fs.existsSync(rp.screenCss) ? fs.readFileSync(rp.screenCss, 'utf8') : '';
  const consumed = screenCss ? consumedVars(screenCss, rootVars) : null;

  const rows: MatchRow[] = [];
  for (const coll of collections) {
    const flat = flattenCollection(coll.raw, coll.modes[0]);
    for (const r of flat) {
      const cssVar = cssVarOf(coll.name, r.path);
      const light = resolveChain(collections, coll.name, 'Light', r.path);
      const dark = resolveChain(collections, coll.name, 'Dark', r.path);
      const figLight = light.resolved == null ? '(unresolved)' : String(light.resolved);
      const figDark = dark.resolved == null ? '(unresolved)' : String(dark.resolved);
      const chain = light.steps.map((s) => s.collection.replace(/^\.?\d+(?:\.\d+)?-/, '')).filter((v, i, a) => a.indexOf(v) === i).join(' ← ');
      const genRaw = rootVars.get(cssVar);
      let verdict: Verdict; let genLight: string; let genDark: string;
      if (genRaw === undefined) {
        // Source token with NO emitted CSS var — a dropped/missing token. Fail-visible, never skipped.
        verdict = 'UNVERIFIED'; genLight = '(missing)'; genDark = '(missing)';
      } else {
        genLight = resolveCssVar(cssVar, rootVars);
        genDark = resolveCssVar(cssVar, darkResolveVars);
        const vL = compareOne(figLight, genLight, r.type);
        const vD = compareOne(figDark, genDark, r.type);
        verdict = (vL === 'UNVERIFIED' || vD === 'UNVERIFIED') ? 'UNVERIFIED'
          : (vL === 'DIFF' || vD === 'DIFF') ? 'DIFF'
          : (vL === 'DERIVED' || vD === 'DERIVED') ? 'DERIVED' : 'MATCH';
      }
      const isConsumed = consumed ? consumed.has(cssVar) : true;
      rows.push({
        collection: coll.name, name: r.path.join('/'), cssVar, type: r.type,
        figmaLight: figLight, figmaDark: figDark, generated: genRaw ?? '(missing)',
        generatedResolved: genLight === genDark ? genLight : `${genLight} / ${genDark}`,
        chain, verdict, consumed: isConsumed,
      });
    }
  }
  // per-screen: when the screen's module CSS is available, show only the consumed closure.
  const visible = consumed ? rows.filter((r) => r.consumed) : rows;
  const counts = visible.reduce((a, r) => { a[r.verdict] = (a[r.verdict] || 0) + 1; return a; }, {} as Record<string, number>);
  return { rows: visible, counts, integrity, consumedCount: consumed ? consumed.size : rows.length };
}

export function findRun(screen: string, run: string): RunPaths | null {
  const base = path.join(process.cwd(), 'src/app/(dev)/converted/sandbox/runs', screen, run);
  const source = path.join(base, '_token-surface/_inputs/variables-source.json');
  const css = path.join(base, '_token-surface/artifacts/tokens.css');
  if (!fs.existsSync(source) || !fs.existsSync(css)) return null;
  const manifest = path.join(base, '_token-surface/token-surface.json');
  const screenCss = path.join(base, 'style.module.css');
  return { root: base, source, css, manifest: fs.existsSync(manifest) ? manifest : null, screenCss: fs.existsSync(screenCss) ? screenCss : null, screen, run };
}
