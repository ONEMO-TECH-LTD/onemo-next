/**
 * KAI-9686 — per-screen token cascade + Figma-1:1 matching model.
 * Reads a converted run's sealed surface (Figma source + generated CSS + the run manifest),
 * verifies run integrity (BOTH the Figma-source oracle AND the generated CSS hash-match the
 * sealed manifest, plus manifest fileKey/fileVersion identity), filters to the tokens THIS
 * screen actually consumes, resolves each token's full Figma cascade (prim→alias→semantic,
 * Light + Dark) and its generated value, and produces a fail-visible verdict. When the run
 * cannot be verified, every verdict is forced UNVERIFIED (fail-closed) — a run we can't trust
 * never shows a green MATCH. Read-only display half of the SSOT VariablesPanel.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { converter, parse, formatHex8 } from 'culori';
import { parseCollections, flattenCollection, resolveChain, type ParsedCollection } from './resolver';

const toOklch = converter('oklch');

/** Canonical 8-bit-per-channel hex `#rrggbbaa`, lowercased, or null if unrepresentable. */
function hex8(v: string): string | null {
  try { const h = formatHex8(parse(v)); return h ? h.toLowerCase() : null; } catch { return null; }
}
const chans = (h: string): number[] => [1, 3, 5, 7].map((i) => parseInt(h.slice(i, i + 2) || 'ff', 16));

/**
 * Colour verdict — compared in DECODED sRGB8 + alpha-byte space (what the browser actually
 * paints), a three-way taxonomy analogous to (but NOT byte-identical to) the audit's:
 *   MATCH   = byte-exact in sRGB8+alpha,
 *   BOUNDED = within 1/255 on every channel (a sub-render 1-byte drift — e.g. an alpha the
 *             generator rounded to a whole `%`: `#…b2` vs `#…b3`) — NOT a green MATCH, kept as
 *             its own class so the distinction isn't erased,
 *   DIFF    = a channel off by ≥2/255 (a real colour error).
 * NOTE ON COUNT: this sRGB8-byte pass yields ~599 BOUNDED on the full graph vs the generator
 * audit's 611 (which compares in OKLCH round-trip). The ~12-row gap is tokens that are
 * byte-identical once rendered to sRGB8 (correctly MATCH here) but 1/255 apart in OKLCH — a
 * comparison-SPACE difference, not a hidden false-green. Non-sRGB values (absent from this
 * Figma-hex corpus) fall back to a tight oklch compare.
 */
function colorVerdict(a: string, b: string): 'MATCH' | 'BOUNDED' | 'DIFF' {
  const ha = hex8(a), hb = hex8(b);
  if (ha && hb) {
    if (ha === hb) return 'MATCH';
    const ca = chans(ha), cb = chans(hb);
    const maxDelta = Math.max(...ca.map((v, i) => Math.abs(v - cb[i])));
    return maxDelta <= 1 ? 'BOUNDED' : 'DIFF';
  }
  const x = toOklch(parse(a)) as { l?: number; c?: number; h?: number; alpha?: number } | undefined;
  const y = toOklch(parse(b)) as { l?: number; c?: number; h?: number; alpha?: number } | undefined;
  if (!x || !y) return 'DIFF';
  const near = (p = 0, q = 0, t = 1e-4) => Math.abs(p - q) <= t;
  const hueOk = (x.c ?? 0) < 0.001 || (y.c ?? 0) < 0.001
    || Math.min(Math.abs((x.h ?? 0) - (y.h ?? 0)), 360 - Math.abs((x.h ?? 0) - (y.h ?? 0))) <= 0.05;
  return near(x.l, y.l) && near(x.c, y.c) && hueOk && near(x.alpha ?? 1, y.alpha ?? 1) ? 'MATCH' : 'DIFF';
}

type Unit = 'px' | 'unitless' | 'percent' | 'ms';
/**
 * Generated dimensional/number value → a domain-tagged comparable number.
 * rem×16 → px; s×1000 → ms; px/%/ms/bare parsed as-is. The UNIT carries the domain so a
 * wrong-unit corruption (Figma 10px vs generated 10rem = 160px) can't false-MATCH, and the
 * %/ms domains (percentages, durations) are covered — not just px/rem/bare.
 */
export function toComparable(gen: string): { n: number; unit: Unit } | null {
  let m = /^(-?[0-9.]+)px$/.exec(gen); if (m) return { n: parseFloat(m[1]), unit: 'px' };
  m = /^(-?[0-9.]+)rem$/.exec(gen); if (m) return { n: parseFloat(m[1]) * 16, unit: 'px' };
  m = /^(-?[0-9.]+)%$/.exec(gen); if (m) return { n: parseFloat(m[1]), unit: 'percent' };
  m = /^(-?[0-9.]+)ms$/.exec(gen); if (m) return { n: parseFloat(m[1]), unit: 'ms' };
  m = /^(-?[0-9.]+)s$/.exec(gen); if (m) return { n: parseFloat(m[1]) * 1000, unit: 'ms' };
  m = /^(-?[0-9.]+)$/.exec(gen); if (m) return { n: parseFloat(m[1]), unit: 'unitless' };
  return null;
}

/**
 * Expected unit-DOMAIN per Figma variable scope — derived from the SOURCE token contract,
 * NOT inferred from the generated value being audited. So a domain-swap (a LETTER_SPACING
 * token wrongly emitted as `%` or `ms`) is a DIFF even though the raw magnitude matches.
 * Verified against the run corpus: every float token carrying one of these scopes is that
 * domain; ratios/durations that would be mis-pinned all carry no mapped scope (fallthrough).
 */
const SCOPE_UNIT: Record<string, Unit> = {
  LETTER_SPACING: 'px', FONT_SIZE: 'px', LINE_HEIGHT: 'px', GAP: 'px', PARAGRAPH_SPACING: 'px',
  CORNER_RADIUS: 'px', WIDTH_HEIGHT: 'px', STROKE_FLOAT: 'px', EFFECT_FLOAT: 'px',
  OPACITY: 'percent',   // opacity is percent-valued in this DS (aliases Prim-Ratios/percent → `5%`)
};
/**
 * PATH-based domain — checked BEFORE collection rules because several collections are
 * MIXED-domain: Motion holds durations (ms) + scale/spring multipliers (unitless), and
 * Prim-Ratios holds ratio multipliers (unitless) + a percent/* subgroup (percent). Opacity
 * aliases the percent subgroup, so it is percent too. An independent re-derivation of the DS
 * convention (NOT imported from the generator), by the token's path segment.
 */
const PATH_UNIT: Array<[RegExp, Unit]> = [
  [/(^|\/)(time|duration)(\/|$)/i, 'ms'],
  [/(^|\/)(percent|opacity)(\/|$)/i, 'percent'],
  [/(^|\/)(scale|spring)(\/|$)/i, 'unitless'],
];
/** Collection fallback for the UNAMBIGUOUS single-domain collections. */
const COLL_UNIT: Array<[RegExp, Unit]> = [
  [/ratio/i, 'unitless'],   // ratio multipliers; the percent/* subgroup is caught by PATH_UNIT first
  [/(dim|radii|container|breakpoint|border|effect|track)/i, 'px'],
];
/**
 * Expected domain, driven by the RESOLVED TERMINAL primitive's identity (collection + path),
 * per the accepted terminal-driven law (KAI-9678): the terminal path wins (percent/time), the
 * terminal collection resolves the single-domain families (ratio/dimension), and the token's
 * Figma scope only CORROBORATES (it can't blanket-override the terminal). Caller passes the
 * terminal step's collection/path; scopes are the token's own.
 */
export function expectedUnit(scopes?: string[], collection?: string, path?: string): Unit | null {
  for (const [re, u] of PATH_UNIT) if (re.test(path ?? '')) return u;         // terminal path: percent/time/…
  if (/motion/i.test(collection ?? '')) return null;                          // motion terminal that isn't time (easing) — unpinned
  for (const [re, u] of COLL_UNIT) if (re.test(collection ?? '')) return u;   // terminal collection: ratio/dimension
  for (const s of scopes ?? []) if (s in SCOPE_UNIT) return SCOPE_UNIT[s];    // scope corroborates only
  return null;
}

export type Verdict = 'MATCH' | 'BOUNDED' | 'DIFF' | 'DERIVED' | 'UNVERIFIED';

/**
 * Compare one Figma-authored literal vs one generated resolved value (single mode).
 * `exp` is the expected unit-domain from the token's Figma scope contract (see expectedUnit);
 * when set, a generated value in the WRONG domain is a DIFF regardless of magnitude.
 */
export function compareOne(figma: string, gen: string, type: string, exp: Unit | null = null): Verdict {
  if (gen === '(missing)' || gen === 'CYCLE') return 'UNVERIFIED';   // dropped / cyclic generated var — fail-visible
  if (figma === '(unresolved)') return 'UNVERIFIED';                 // broken Figma cascade
  if (/clamp\(/.test(gen)) return 'DERIVED';                         // fluid clamp — verified by the browser/Figma bench, not a literal here
  if (type === 'color' || /^#|^oklch\(|^rgb/.test(figma)) return colorVerdict(figma, gen);
  if (type === 'float') {
    const fn = parseFloat(figma);
    const c = toComparable(gen);
    if (c === null || !Number.isFinite(fn)) return 'DIFF';
    // Domain-pin from the Figma scope contract: a LETTER_SPACING/dimension token emitted as
    // `%`/`ms`, or an OPACITY token emitted with a dimension unit, is a DIFF even at equal
    // magnitude (`50` vs `50ms`, `200` vs `200%`). rem is normalised to the px domain.
    // Only a BARE unitless zero is domain-agnostic (`0` == `0px`); an explicit wrong-domain
    // zero (`0ms` for a px token) is still a DIFF — 0px/0ms/0% are not interchangeable.
    if (exp && c.unit !== exp && !(c.n === 0 && c.unit === 'unitless')) return 'DIFF';
    return Math.abs(fn - c.n) < 0.01 ? 'MATCH' : 'DIFF';
  }
  return String(figma).trim() === String(gen).trim() ? 'MATCH' : 'DIFF'; // strings, exact
}

/**
 * The single per-token verdict orchestrator shared by buildMatch (flat) and buildExplorerData
 * (grouped) — so both surfaces grade identically and cannot drift. Given each mode's resolved
 * Figma + generated value and the mode terminals (for the domain contract), returns the merged
 * verdict; a missing generated var, or a run that failed integrity, is fail-closed UNVERIFIED.
 */
export function computeVerdict(
  type: string, scopes: string[] | undefined,
  figLight: string, figDark: string, genLight: string, genDark: string,
  termL: { collection: string; path: string } | undefined,
  termD: { collection: string; path: string } | undefined,
  fallbackColl: string, fallbackPath: string, integrityVerified: boolean,
): Verdict {
  if (!integrityVerified) return 'UNVERIFIED';
  if (genLight === '(missing)' || genDark === '(missing)') return 'UNVERIFIED';
  const expL = expectedUnit(scopes, termL?.collection ?? fallbackColl, termL?.path ?? fallbackPath);
  const expD = expectedUnit(scopes, termD?.collection ?? fallbackColl, termD?.path ?? fallbackPath);
  const vL = compareOne(figLight, genLight, type, expL);
  const vD = compareOne(figDark, genDark, type, expD);
  return (vL === 'UNVERIFIED' || vD === 'UNVERIFIED') ? 'UNVERIFIED'
    : (vL === 'DIFF' || vD === 'DIFF') ? 'DIFF'
    : (vL === 'BOUNDED' || vD === 'BOUNDED') ? 'BOUNDED'
    : (vL === 'DERIVED' || vD === 'DERIVED') ? 'DERIVED' : 'MATCH';
}

/** One hop of the resolved Figma cascade (prim→alias→semantic), for display. */
export type CascadeStep = { collection: string; path: string; isAlias: boolean; raw: string };

export type MatchRow = {
  collection: string; name: string; cssVar: string; type: string;
  figmaLight: string; figmaDark: string; generated: string; generatedResolved: string;
  cascade: CascadeStep[]; cascadeDark: CascadeStep[] | null; modesDiffer: boolean;
  verdict: Verdict; consumed: boolean;
};

function cssCategory(collectionName: string): string {
  return String(collectionName).replace(/^\.?\d+(?:\.\d+)?-/, '').split(/[-_\s]+/).map((p) => p.toLowerCase()).filter(Boolean).join('-');
}
function kebab(v: string): string { return String(v).replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase(); }
export function cssVarOf(collectionName: string, tokenPath: string[]): string {
  return `--${[cssCategory(collectionName), ...tokenPath.map(kebab)].join('-')}`;
}
export function shortColl(name: string): string { return String(name).replace(/^\.?\d+(?:\.\d+)?-/, ''); }
export function parseVars(css: string, selector: string): Map<string, string> {
  const m = new RegExp(selector.replace(/[.[\]="]/g, '\\$&') + '\\s*\\{([\\s\\S]*?)\\}').exec(css);
  const out = new Map<string, string>();
  if (!m) return out;
  for (const d of m[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) if (!out.has(d[1])) out.set(d[1], d[2].trim());
  return out;
}
export function resolveCssVar(name: string, root: Map<string, string>, seen = new Set<string>()): string {
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
export type RunIntegrity = {
  verified: boolean; reason: string;
  generatorSha?: string; fileKey?: string; fileVersion?: string;
  sourceVerified?: boolean; cssVerified?: boolean; screenScopeSha?: string;
};

function sha256File(p: string): string { return createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }

/**
 * Verify the run is a genuine sealed surface. Re-hashes BOTH oracle sides, not just one:
 *  - the Figma-source graph (`_inputs/variables-source.json`) that the generator consumed —
 *    so a tampered source (the value the page grades AGAINST) is caught;
 *  - the generated `tokens.css` — so a tampered output is caught.
 * Both must equal the sealed manifest hashes, and the manifest must carry a source identity
 * (fileKey/fileVersion). Fail-closed on any mismatch or missing piece.
 */
export function verifyRun(rp: RunPaths): RunIntegrity {
  if (!rp.manifest || !fs.existsSync(rp.manifest)) return { verified: false, reason: 'no token-surface manifest — cannot verify run integrity' };
  const screenScopeSha = rp.screenCss && fs.existsSync(rp.screenCss) ? sha256File(rp.screenCss) : undefined;
  try {
    const man = JSON.parse(fs.readFileSync(rp.manifest, 'utf8'));
    // 1) Figma-source oracle — the graph the page grades against.
    const src = man.source as { sha256?: string; fileKey?: string; fileVersion?: string } | undefined;
    if (!src?.sha256) return { verified: false, reason: 'manifest records no Figma-source hash', screenScopeSha };
    if (!fs.existsSync(rp.source)) return { verified: false, reason: 'Figma-source file missing from run', screenScopeSha };
    const srcActual = sha256File(rp.source);
    if (srcActual !== src.sha256) {
      return { verified: false, reason: `Figma source hash ${srcActual.slice(0, 12)} != manifest ${String(src.sha256).slice(0, 12)}`, sourceVerified: false, screenScopeSha };
    }
    // 2) Generated tokens.css.
    const artifacts: Array<{ role?: string; relativePath?: string; sha256?: string }> = man.artifacts ?? [];
    const cssArt = artifacts.find((a) => /tokens\.css$/.test(a.relativePath ?? '') || a.role === 'css');
    if (!cssArt?.sha256) return { verified: false, reason: 'manifest has no tokens.css artifact hash', sourceVerified: true, screenScopeSha };
    const cssActual = sha256File(rp.css);
    if (cssActual !== cssArt.sha256) {
      return { verified: false, reason: `tokens.css hash ${cssActual.slice(0, 12)} != manifest ${String(cssArt.sha256).slice(0, 12)}`, sourceVerified: true, cssVerified: false, screenScopeSha };
    }
    // 3) Manifest identity — the sealed fileKey must equal the ROUTE screen's fileKey
    //    (the `<fileKey>--<node>` screen segment), not merely be present. A run manifest
    //    from a different Figma file can no longer render green under this route.
    if (!src.fileKey || !src.fileVersion) return { verified: false, reason: 'manifest source lacks fileKey/fileVersion identity', sourceVerified: true, cssVerified: true, screenScopeSha };
    // Require a well-formed `<fileKey>--<node>` route identity: both segments non-empty,
    // fileKey equal to the manifest. Rejects a missing delimiter, an empty prefix, and an
    // empty node — all fail-closed.
    const dash = rp.screen.indexOf('--');
    const routeFileKey = dash >= 0 ? rp.screen.slice(0, dash) : '';
    const routeNode = dash >= 0 ? rp.screen.slice(dash + 2) : '';
    if (!routeFileKey || !routeNode || src.fileKey !== routeFileKey) {
      const reason = dash < 0 || !routeNode
        ? 'route screen is not a well-formed <fileKey>--<node> identity'
        : `manifest fileKey ${src.fileKey} != route screen ${routeFileKey}`;
      return { verified: false, reason, sourceVerified: true, cssVerified: true, fileKey: src.fileKey, fileVersion: src.fileVersion, screenScopeSha };
    }
    return {
      verified: true,
      reason: 'run verified — Figma source + tokens.css hash-match the sealed manifest; fileKey bound to route',
      generatorSha: man.generator?.gitSha, fileKey: src.fileKey, fileVersion: src.fileVersion,
      sourceVerified: true, cssVerified: true, screenScopeSha,
    };
  } catch (e) {
    return { verified: false, reason: `manifest unreadable: ${(e as Error).message}`, screenScopeSha };
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
  // per-screen closure over BOTH modes (dark can alias differently; union is complete).
  const consumed = screenCss
    ? new Set<string>([...consumedVars(screenCss, rootVars), ...consumedVars(screenCss, darkResolveVars)])
    : null;

  const rows: MatchRow[] = [];
  for (const coll of collections) {
    const flat = flattenCollection(coll.raw, coll.modes[0]);
    for (const r of flat) {
      const cssVar = cssVarOf(coll.name, r.path);
      const light = resolveChain(collections, coll.name, 'Light', r.path);
      const dark = resolveChain(collections, coll.name, 'Dark', r.path);
      const figLight = light.resolved == null ? '(unresolved)' : String(light.resolved);
      const figDark = dark.resolved == null ? '(unresolved)' : String(dark.resolved);
      // full cascade, displayed primitive→alias→semantic (resolver walks semantic→primitive,
      // so reverse for display to match the header). Dark is exposed only when its structure
      // actually diverges from Light (per the DS's primitive-level flip it usually doesn't).
      const toCascade = (steps: typeof light.steps): CascadeStep[] =>
        steps.slice().reverse().map((s) => ({ collection: shortColl(s.collection), path: s.path, isAlias: s.isAlias, raw: String(s.rawValue) }));
      const cascade = toCascade(light.steps);
      const cascadeDarkFull = toCascade(dark.steps);
      const key = (cs: CascadeStep[]) => cs.map((c) => `${c.collection}/${c.path}`).join('>');
      const modesDiffer = key(cascade) !== key(cascadeDarkFull);
      const cascadeDark = modesDiffer ? cascadeDarkFull : null;
      // verdict via the SHARED per-token orchestrator (same path buildExplorerData uses).
      const genRaw = rootVars.get(cssVar);
      const genLight = genRaw === undefined ? '(missing)' : resolveCssVar(cssVar, rootVars);
      const genDark = genRaw === undefined ? '(missing)' : resolveCssVar(cssVar, darkResolveVars);
      const termL = light.steps[light.steps.length - 1];
      const termD = dark.steps[dark.steps.length - 1];
      const verdict = computeVerdict(r.type, r.$scopes, figLight, figDark, genLight, genDark, termL, termD, coll.name, r.path.join('/'), integrity.verified);
      const isConsumed = consumed ? consumed.has(cssVar) : true;
      rows.push({
        collection: coll.name, name: r.path.join('/'), cssVar, type: r.type,
        figmaLight: figLight, figmaDark: figDark, generated: genRaw ?? '(missing)',
        generatedResolved: genLight === genDark ? genLight : `${genLight} / ${genDark}`,
        cascade, cascadeDark, modesDiffer, verdict, consumed: isConsumed,
      });
    }
  }
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
