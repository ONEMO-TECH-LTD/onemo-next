/**
 * KAI-9686 — server-side model for the per-screen token EXPLORER (a converter-adapted
 * VariablesPanel). Produces the Figma-like hierarchy (collections ▸ groups ▸ tokens) filtered
 * to the tokens a screen consumes, and for each token the FULL Figma→code cascade per mode
 * (resolution chain + resolved Figma value) alongside the generated value and a fail-visible
 * verdict from the gated match.ts engine. Read-only; all editing/build machinery of the SSOT
 * panel is intentionally dropped.
 */
import fs from 'node:fs';
import {
  parseCollections, flattenCollection, buildGroupTree, resolveChain,
  type ParsedCollection, type GroupNode, type ChainStep, type TokenRow,
} from './resolver';
import {
  verifyRun, consumedVars, parseVars, resolveCssVar, cssVarOf, shortColl,
  computeVerdict, type RunPaths, type RunIntegrity, type Verdict,
} from './match';

export type ExplorerStep = { collection: string; mode: string; path: string; rawValue: string; isAlias: boolean };
export type ExplorerToken = {
  id: string; name: string; group: string; path: string; type: string; scopes: string[];
  cssVar: string;
  figmaLight: string; figmaDark: string;
  generatedLight: string; generatedDark: string; generated: string;
  chainLight: ExplorerStep[]; chainDark: ExplorerStep[]; modesDiffer: boolean;
  verdict: Verdict;
  swatchLight?: string; swatchDark?: string;
};
export type ExplorerCollection = {
  name: string; shortName: string; modes: string[];
  groups: GroupNode[];
  tokens: ExplorerToken[];
  counts: Record<string, number>;
};
export type ExplorerData = {
  screen: string; run: string;
  integrity: RunIntegrity;
  collections: ExplorerCollection[];
  totalTokens: number; consumedCount: number; perScreen: boolean;
  counts: Record<string, number>;
};

const toSteps = (steps: ChainStep[]): ExplorerStep[] =>
  steps.map((s) => ({ collection: shortColl(s.collection), mode: s.mode, path: s.path, rawValue: String(s.rawValue), isAlias: s.isAlias }));

const cascadeKey = (steps: ExplorerStep[]): string => steps.map((c) => `${c.collection}/${c.path}`).join('>');

export function buildExplorerData(rp: RunPaths): ExplorerData {
  const integrity = verifyRun(rp);
  const source = JSON.parse(fs.readFileSync(rp.source, 'utf8'));
  const collections: ParsedCollection[] = parseCollections(source);
  const css = fs.readFileSync(rp.css, 'utf8');
  const rootVars = parseVars(css, ':root');
  const darkVars = parseVars(css, '[data-theme="dark"]');
  const darkResolveVars = new Map(rootVars);
  for (const [k, v] of darkVars) darkResolveVars.set(k, v);
  const screenCss = rp.screenCss && fs.existsSync(rp.screenCss) ? fs.readFileSync(rp.screenCss, 'utf8') : '';
  const consumed = screenCss
    ? new Set<string>([...consumedVars(screenCss, rootVars), ...consumedVars(screenCss, darkResolveVars)])
    : null;

  const outCollections: ExplorerCollection[] = [];
  const allCounts: Record<string, number> = {};
  let total = 0;

  for (const coll of collections) {
    const flat = flattenCollection(coll.raw, coll.modes[0]);
    const tokens: ExplorerToken[] = [];
    const consumedRows: TokenRow[] = [];
    const counts: Record<string, number> = {};

    for (const r of flat) {
      total++;
      const cssVar = cssVarOf(coll.name, r.path);
      if (consumed && !consumed.has(cssVar)) continue; // per-screen filter
      consumedRows.push(r);

      const light = resolveChain(collections, coll.name, 'Light', r.path);
      const dark = resolveChain(collections, coll.name, 'Dark', r.path);
      const figLight = light.resolved == null ? '(unresolved)' : String(light.resolved);
      const figDark = dark.resolved == null ? '(unresolved)' : String(dark.resolved);
      const genRaw = rootVars.get(cssVar);
      const genLight = genRaw === undefined ? '(missing)' : resolveCssVar(cssVar, rootVars);
      const genDark = genRaw === undefined ? '(missing)' : resolveCssVar(cssVar, darkResolveVars);
      const termL = light.steps[light.steps.length - 1];
      const termD = dark.steps[dark.steps.length - 1];
      // SHARED verdict orchestrator — identical grading to buildMatch (no drift), fail-closed.
      const verdict: Verdict = computeVerdict(r.type, r.$scopes, figLight, figDark, genLight, genDark, termL, termD, coll.name, r.path.join('/'), integrity.verified);

      const chainLight = toSteps(light.steps);
      const chainDark = toSteps(dark.steps);
      const isColor = r.type === 'color';
      tokens.push({
        id: r.id, name: r.name, group: r.group, path: r.path.join('/'), type: r.type, scopes: r.$scopes ?? [],
        cssVar,
        figmaLight: figLight, figmaDark: figDark,
        generatedLight: genLight, generatedDark: genDark, generated: genRaw ?? '(missing)',
        chainLight, chainDark, modesDiffer: cascadeKey(chainLight) !== cascadeKey(chainDark) || figLight !== figDark,
        verdict,
        swatchLight: isColor && figLight !== '(unresolved)' ? figLight : undefined,
        swatchDark: isColor && figDark !== '(unresolved)' ? figDark : undefined,
      });
      counts[verdict] = (counts[verdict] || 0) + 1;
      allCounts[verdict] = (allCounts[verdict] || 0) + 1;
    }

    if (!tokens.length) continue; // drop collections with nothing consumed
    outCollections.push({
      name: coll.name, shortName: shortColl(coll.name), modes: coll.modes,
      groups: buildGroupTree(consumedRows), tokens, counts,
    });
  }

  return {
    screen: rp.screen, run: rp.run, integrity,
    collections: outCollections,
    totalTokens: total, consumedCount: consumed ? consumed.size : total, perScreen: !!consumed,
    counts: allCounts,
  };
}
