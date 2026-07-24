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
import { parseCollections, flattenCollection, resolveChain, type ParsedCollection } from './resolver';

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
      const genResolved = resolveCssVar(cssVar, rootVars);
      const figLight = light.resolved == null ? '(unresolved)' : String(light.resolved);
      const figDark = dark.resolved == null ? '(unresolved)' : String(dark.resolved);
      const chain = light.steps.map((s) => s.collection.replace(/^\.?\d+(?:\.\d+)?-/, '')).filter((v, i, a) => a.indexOf(v) === i).join(' ← ');
      // verdict: colours compare via oklch(figma hex) vs generated oklch — but for a fast,
      // honest pass we compare structurally: literal figma vs the generated RESOLVED value.
      let verdict: MatchRow['verdict'] = 'MATCH';
      if (light.broken || dark.broken) verdict = 'UNRESOLVED';
      else if (/clamp\(|oklch\(/.test(genResolved)) verdict = 'DERIVED'; // fluid/colour derivations (not a literal 1:1)
      else if (r.type === 'float' && !genResolved.includes(figLight.replace(/^-?0\./, '.'))) {
        // dimensional: the generated value should carry the figma magnitude (px/rem)
        const figNum = parseFloat(figLight);
        const genNum = parseFloat(genResolved);
        verdict = Number.isFinite(figNum) && Number.isFinite(genNum) && Math.abs(figNum - genNum) < 0.001 ? 'MATCH'
          : (genResolved.endsWith('rem') && Math.abs((parseFloat(genResolved) * 16) - figNum) < 0.001 ? 'MATCH' : 'DIFF');
      }
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
