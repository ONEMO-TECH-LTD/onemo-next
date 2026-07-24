/**
 * KAI-9686 — per-screen token cascade + Figma-1:1 matching model.
 * Server-side: reads a converted run's Figma source (`_inputs/variables-source.json`)
 * and the generated CSS (`_token-surface/artifacts/tokens.css`), resolves each token's
 * Figma cascade (via the ported resolver), looks up the generated value, and produces a
 * MATCH/DIFF row. This is the read-only display half of the SSOT VariablesPanel dashboard,
 * bound to a screen's sealed surface.
 */
import fs from 'node:fs';
import path from 'node:path';
import { converter, parse } from 'culori';
import { parseCollections, flattenCollection, resolveChain, type ParsedCollection } from './resolver';

const toOklch = converter('oklch');

/** True when two colours (a Figma hex, a generated oklch()/hex string) are equivalent. */
function colorEq(a: string, b: string): boolean {
  const x = toOklch(parse(a)); const y = toOklch(parse(b));
  if (!x || !y) return false;
  const near = (p?: number, q?: number, t = 0.005) => Math.abs((p ?? 0) - (q ?? 0)) <= t;
  const hueOk = (x.c ?? 0) < 0.01 || (y.c ?? 0) < 0.01
    || Math.min(Math.abs((x.h ?? 0) - (y.h ?? 0)), 360 - Math.abs((x.h ?? 0) - (y.h ?? 0))) <= 1;
  return near(x.l, y.l) && near(x.c, y.c) && hueOk;
}

/** Compare one Figma-authored literal against one generated resolved value (single mode). */
function compareOne(figma: string, gen: string, type: string): 'MATCH' | 'DIFF' | 'DERIVED' {
  if (gen === '(missing)' || gen === 'CYCLE' || figma === '(unresolved)') return 'DERIVED';
  if (/clamp\(/.test(gen)) return 'DERIVED'; // fluid clamp — not a literal 1:1 (verified structurally elsewhere)
  if (type === 'color' || /^#|^oklch\(|^rgb/.test(figma) || /^oklch\(|^#/.test(gen)) return colorEq(figma, gen) ? 'MATCH' : 'DIFF';
  if (type === 'float') {
    const fn = parseFloat(figma); const gn = parseFloat(gen);
    if (Number.isFinite(fn) && Number.isFinite(gn)) {
      if (Math.abs(fn - gn) < 0.001) return 'MATCH';                 // literal px / unitless
      if (gen.endsWith('rem') && Math.abs(gn * 16 - fn) < 0.001) return 'MATCH'; // rem carries px magnitude
      return 'DIFF';
    }
  }
  return String(figma).trim() === String(gen).trim() ? 'MATCH' : 'DIFF'; // strings, exact
}

export type MatchRow = {
  collection: string;
  name: string;          // token path (e.g. track/neg-4)
  cssVar: string;        // generated var name (e.g. --prim-track-neg-4)
  type: string;
  figmaLight: string;    // Figma-authored resolved literal (Light)
  figmaDark: string;     // Figma-authored resolved literal (Dark)
  generated: string;     // emitted CSS value (the cascade's own emitted string, incl var())
  generatedResolved: string; // emitted value resolved through the CSS var() chain
  chain: string;         // human cascade: prim ← al ← sem
  verdict: 'MATCH' | 'DIFF' | 'DERIVED' | 'UNRESOLVED';
};

// collection name → css category (mirror of build-scan categorySegments): strip leading
// ".<n>[.<n>]-" then kebab. ".1.3-Prim-Track" → "prim-track"; "3.3-Sem-Type-Fluid" → "sem-type-fluid".
function cssCategory(collectionName: string): string {
  return String(collectionName).replace(/^\.?\d+(?:\.\d+)?-/, '').split(/[-_\s]+/).map((p) => p.toLowerCase()).filter(Boolean).join('-');
}
function kebab(v: string): string {
  return String(v).replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}
function cssVarOf(collectionName: string, tokenPath: string[]): string {
  return `--${[cssCategory(collectionName), ...tokenPath.map(kebab)].join('-')}`;
}

// parse a CSS block into a var→value map (first declaration wins).
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

export type RunPaths = { root: string; source: string; css: string; screen: string; run: string };

export function buildMatch(rp: RunPaths): { rows: MatchRow[]; counts: Record<string, number>; screen: string; run: string } {
  const source = JSON.parse(fs.readFileSync(rp.source, 'utf8'));
  const collections: ParsedCollection[] = parseCollections(source);
  const css = fs.readFileSync(rp.css, 'utf8');
  const rootVars = parseVars(css, ':root');
  const darkVars = parseVars(css, '[data-theme="dark"]');
  // Dark resolution map: the [data-theme="dark"] block only carries OVERRIDES; unlisted tokens
  // inherit their :root (light) value — so a token's dark value = root overlaid with dark.
  const darkResolveVars = new Map(rootVars);
  for (const [k, v] of darkVars) darkResolveVars.set(k, v);

  const rows: MatchRow[] = [];
  for (const coll of collections) {
    // enumerate every leaf via the first mode
    const mode0 = coll.modes[0];
    const flat = flattenCollection(coll.raw, mode0);
    for (const r of flat) {
      const tokenPath = r.path;
      const cssVar = cssVarOf(coll.name, tokenPath);
      const light = resolveChain(collections, coll.name, 'Light', tokenPath);
      const dark = resolveChain(collections, coll.name, 'Dark', tokenPath);
      const genRaw = rootVars.get(cssVar);
      if (genRaw === undefined) continue; // not emitted as a CSS var (aliases sometimes fold)
      const genLight = resolveCssVar(cssVar, rootVars);
      const genDark = resolveCssVar(cssVar, darkResolveVars);
      const figLight = light.resolved == null ? '(unresolved)' : String(light.resolved);
      const figDark = dark.resolved == null ? '(unresolved)' : String(dark.resolved);
      const chain = light.steps.map((s) => s.collection.replace(/^\.?\d+(?:\.\d+)?-/, '')).filter((v, i, a) => a.indexOf(v) === i).join(' ← ');
      // Verdict = BOTH modes verified: Figma-authored literal vs generated resolved, per mode,
      // with real colour equivalence (hex→oklch), float magnitude, and string equality.
      let verdict: MatchRow['verdict'];
      if (light.broken || dark.broken) verdict = 'UNRESOLVED';
      else {
        const vL = compareOne(figLight, genLight, r.type);
        const vD = compareOne(figDark, genDark, r.type);
        verdict = (vL === 'DIFF' || vD === 'DIFF') ? 'DIFF'
          : (vL === 'DERIVED' || vD === 'DERIVED') ? 'DERIVED' : 'MATCH';
      }
      const genResolved = genLight === genDark ? genLight : `${genLight} / ${genDark}`;
      rows.push({ collection: coll.name, name: tokenPath.join('/'), cssVar, type: r.type, figmaLight: figLight, figmaDark: figDark, generated: genRaw, generatedResolved: genResolved, chain, verdict });
    }
  }
  const counts = rows.reduce((a, r) => { a[r.verdict] = (a[r.verdict] || 0) + 1; return a; }, {} as Record<string, number>);
  return { rows, counts, screen: rp.screen, run: rp.run };
}

// locate a run package under the converted runs dir (dev/runtime location).
export function findRun(screen: string, run: string): RunPaths | null {
  const base = path.join(process.cwd(), 'src/app/(dev)/converted/sandbox/runs', screen, run);
  const source = path.join(base, '_token-surface/_inputs/variables-source.json');
  const css = path.join(base, '_token-surface/artifacts/tokens.css');
  if (!fs.existsSync(source) || !fs.existsSync(css)) return null;
  return { root: base, source, css, screen, run };
}
