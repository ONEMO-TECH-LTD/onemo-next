/**
 * figma-to-code · C1.4 — conformance report (SPEC §4) + token-resolution gate (§4b.5, F2).
 *
 * Inputs: emitted module.css + convert-run.json + the target app's built tokens.css.
 * Outputs: CONFORMANCE.md (human audit surface) + conformance.json (tooling twin).
 * RAW entries carry {className, prop, value, line, candidates[]} — the exact DeclRef inputs
 * react-figma's resolver needs, so every RAW row is one-click bind-token remediation (designer F4).
 */
import { promises as fs } from 'node:fs';
import { themeScopedTokenDefs, resolveVar } from './token-defs.mjs';

/** Parse custom-property DEFINITIONS from a tokens build, scoped to the rendered theme (light).
 *  A flat scan lets dark overrides win → wrong value for theme-varying tokens (meta-qa F1). */
const tokenDefsOf = (cssText) => themeScopedTokenDefs(cssText);

/** All decls of the emitted module.css: [{className, prop, value, line}] (flat-selector canon). */
export function declsOf(cssText) {
  const out = [];
  let cls = null;
  cssText.split('\n').forEach((lineText, i) => {
    const open = lineText.match(/^\.([A-Za-z0-9]+) \{$/);
    if (open) { cls = open[1]; return; }
    if (lineText === '}') { cls = null; return; }
    const decl = lineText.match(/^  ([a-z-]+): (.+);$/);
    if (decl && cls) out.push({ className: cls, prop: decl[1], value: decl[2], line: i + 1 });
  });
  return out;
}

const STYLEABLE = new Set([ // props where a token COULD apply (coverage denominator)
  'gap', 'padding', 'width', 'height', 'max-width', 'background-color', 'color', 'border', 'box-shadow',
  'border-radius', 'font-family', 'font-size', 'line-height', 'letter-spacing', 'font-weight',
]);

// ─── C4.3 value parity: Figma raw value vs token-resolved value AT FRAME WIDTH ───────────────
// The converter's emission is correct by definition (bound token → var). But the DS can drift:
// the token's built value at the frame width may differ from the constant Figma shows in that
// mode (live case: the dial-row gap — Figma 24, token resolves 32 → the whole row shifts).
// This check makes that drift MECHANICAL: resolve each numeric var-decl through tokens.css,
// evaluate clamp()/rem/cqi at the frame width, compare with the raw Figma node value.
function evalCssLength(expr, frameW, depth = 0) {
  if (depth > 8 || !expr) return null;
  expr = expr.trim();
  const clamp = expr.match(/^clamp\((.*)\)$/s);
  if (clamp) {
    // split top-level commas
    const parts = []; let d = 0, cur = '';
    for (const ch of clamp[1]) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { parts.push(cur); cur = ''; } else cur += ch; }
    parts.push(cur);
    if (parts.length !== 3) return null;
    const [a, b, c] = parts.map((p) => evalCssLength(p, frameW, depth + 1));
    if ([a, b, c].some((v) => v == null)) return null;
    return Math.min(Math.max(b, a), c);
  }
  // additive expression: "1.1532rem + 0.3854cqi" (clamp middle terms; calc() bodies)
  const calcBody = expr.match(/^calc\((.*)\)$/s);
  if (calcBody) return evalCssLength(calcBody[1], frameW, depth + 1);
  const terms = expr.split(/\s+\+\s+/);
  if (terms.length > 1) {
    const vals = terms.map((t) => evalCssLength(t, frameW, depth + 1));
    return vals.some((v) => v == null) ? null : vals.reduce((a, b) => a + b, 0);
  }
  const m = expr.match(/^(-?[\d.]+)(px|rem|cqi|cqw|vi|vw|%)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  switch (m[2]) {
    case undefined: return n === 0 ? 0 : null; // unitless nonzero isn't a length
    case 'px': return n;
    case 'rem': return n * 16;
    case 'cqi': case 'cqw': case 'vi': case 'vw': return n * frameW / 100; // container = frame (C3.3)
    default: return null; // % — ambiguous base
  }
}

const VEC_TYPES = new Set(['VECTOR', 'LINE', 'STAR', 'POLYGON', 'REGULAR_POLYGON', 'ELLIPSE', 'BOOLEAN_OPERATION']);

/** decl prop → the raw Figma value(s) for that node. Returns array aligned with CSS slots. */
function figmaRawFor(prop, node) {
  if (!node) return null;
  const b = node.absoluteBoundingBox ?? {};
  // Line-law elements (ir.mjs): a zero-extent solid-stroke LINE emits its THICKNESS axis from
  // strokeWeight, not the bbox dimension (which is 0). So on that axis, parity must compare the
  // token against strokeWeight — else every ruler tick reads as false "2px vs 0px" DS drift.
  const isLine = VEC_TYPES.has(node.type) && node.strokeWeight != null;
  const thinW = isLine && Math.round((b.width ?? 0) * 100) === 0;
  const thinH = isLine && Math.round((b.height ?? 0) * 100) === 0;
  switch (prop) {
    case 'gap': return node.itemSpacing != null ? [node.itemSpacing] : null;
    case 'width': return thinW ? [node.strokeWeight] : (b.width != null ? [b.width] : null);
    case 'height': return thinH ? [node.strokeWeight] : (b.height != null ? [b.height] : null);
    case 'border-radius': return node.cornerRadius != null && !node.rectangleCornerRadii ? [node.cornerRadius] : null;
    case 'font-size': return node.style?.fontSize != null ? [node.style.fontSize] : null;
    case 'padding': return [node.paddingTop ?? 0, node.paddingRight ?? 0, node.paddingBottom ?? 0, node.paddingLeft ?? 0];
    default: return null;
  }
}

function valueParity({ decls, run, rawDoc, defs, frameW }) {
  const byId = new Map();
  (function idx(n) { byId.set(n.id, n); (n.children || []).forEach(idx); })(rawDoc);
  const cls2id = new Map(run.idMap.map((e) => [e.class, e.figmaId]));
  const resolveChain = (v) => resolveVar(defs, v);
  const rows = [];
  for (const d of decls) {
    if (!d.value.includes('var(')) continue;
    const raws = figmaRawFor(d.prop, byId.get(cls2id.get(d.className)));
    if (!raws) continue;
    // split shorthand slots at top level (padding: a b / a b c d …); expand CSS shorthand to 4
    const slots = d.value.split(/ (?![^()]*\))/);
    const expand = d.prop === 'padding'
      ? (slots.length === 1 ? [0, 0, 0, 0].map(() => slots[0])
        : slots.length === 2 ? [slots[0], slots[1], slots[0], slots[1]]
        : slots.length === 3 ? [slots[0], slots[1], slots[2], slots[1]] : slots)
      : slots;
    for (let i = 0; i < Math.min(expand.length, raws.length); i++) {
      if (!String(expand[i]).includes('var(')) continue; // raw slots aren't token drift
      const tokenName = String(expand[i]).match(/var\((--[a-zA-Z0-9-]+)\)/)?.[1];
      const resolved = evalCssLength(resolveChain(expand[i]), frameW);
      if (resolved == null) continue; // non-numeric (colors, fonts) — out of scope
      if (Math.abs(resolved - raws[i]) > 0.5) {
        rows.push({
          className: d.className, prop: d.prop + (raws.length > 1 ? `[${i}]` : ''), token: tokenName,
          figma: Math.round(raws[i] * 100) / 100, resolved: Math.round(resolved * 100) / 100, line: d.line,
        });
      }
    }
  }
  return rows;
}

export async function buildConformance({ cssPath, runPath, tokensCssPath, mdPath, jsonPath, rawNodesPath }) {
  const [css, runRaw, tokensCss] = await Promise.all([
    fs.readFile(cssPath, 'utf8'), fs.readFile(runPath, 'utf8'), fs.readFile(tokensCssPath, 'utf8'),
  ]);
  const run = JSON.parse(runRaw);
  const defs = tokenDefsOf(tokensCss);
  const decls = declsOf(css);

  // C4.3 value parity (needs the raw doc; optional so old callers keep working)
  let parity = [];
  if (rawNodesPath) {
    try {
      const rawDoc = JSON.parse(await fs.readFile(rawNodesPath, 'utf8'));
      const frameW = rawDoc.absoluteBoundingBox?.width ?? 0;
      if (frameW) parity = valueParity({ decls, run, rawDoc, defs, frameW });
    } catch { /* raw doc unavailable → skip parity, never crash the report */ }
  }

  // token-resolution gate (§4b.5): every emitted var(--x) must exist in the tokens build
  const used = [];
  for (const d of decls) for (const m of d.value.matchAll(/var\((--[a-zA-Z0-9-]+)\)/g)) {
    used.push({ ...d, cssVar: m[1], resolves: defs.has(m[1]) });
  }
  const unresolved = used.filter((u) => !u.resolves);

  // RAW list (§3.4 rule 3): styleable decls with no var() — with exact-value token candidates
  const raws = decls
    .filter((d) => STYLEABLE.has(d.prop) && !d.value.includes('var(') && d.value !== '0')
    .map((d) => ({
      ...d,
      candidates: [...defs.entries()]
        .filter(([, v]) => v === d.value || v === d.value.replace(/px$/, ''))
        .map(([name]) => ({ token: name, exact: true }))
        .slice(0, 3),
    }));

  const tokenDecls = used.length;
  const styleableDecls = decls.filter((d) => STYLEABLE.has(d.prop)).length;
  const coverage = styleableDecls === 0 ? 0 : Math.round((used.filter((u) => STYLEABLE.has(u.prop)).length / styleableDecls) * 100);

  // lead C3: lossy-but-deliberate conversions (gradient→avg flatten, skewed image crops) must be
  // VISIBLE — a distinct category between "converted exactly" and "refused". Never silent.
  const approximations = (run.notes ?? []).filter((n) => n.kind === 'approximation');

  // C5 fixture finding: a design font missing from the app build falls back silently (serif drift
  // wrecked the fixture text). List every font the screen needs — the app must actually load them.
  const fonts = [...new Set(decls.filter((d) => d.prop === 'font-family')
    .map((d) => resolveVar(defs, d.value).replace(/['"]/g, '').split(',')[0].trim()))];

  const report = {
    fileKey: run.fileKey, nodeId: run.nodeId, fileVersion: run.fileVersion,
    elements: run.idMap.length,
    tokenCoveragePct: coverage, tokenDecls, styleableDecls,
    unresolved, raws, refusals: run.refusals, approximations, valueParity: parity, fonts,
    missingAssets: run.missingAssets ?? [],
    pass: unresolved.length === 0,
  };
  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2) + '\n');

  const md = `# Conformance — ${run.nodeId} @ file v${run.fileVersion}

| Check | Result |
|---|---|
| Elements (ID map) | ${report.elements} |
| Token coverage (styleable) | **${coverage}%** (${report.tokenDecls} var-decls / ${styleableDecls} styleable) |
| Unresolved \`var(--…)\` | ${unresolved.length === 0 ? '**0** ✅' : `**${unresolved.length}** 🔴 FAIL`} |
| RAW values | ${raws.length} (worklist below) |
| REFUSED nodes | ${run.refusals.length} (design cleanup below) |
| APPROXIMATIONS | ${approximations.length} (lossy-but-deliberate, listed below) |
| TOKEN VALUE PARITY | ${parity.length === 0 ? '**0** ✅' : `**${parity.length}** ⚠️ DS drift (below)`} |
| Missing assets | ${report.missingAssets.length} |

${unresolved.length ? `## 🔴 Unresolved tokens (run FAILS — §4b.5)\n${unresolved.map((u) => `- \`${u.cssVar}\` @ .${u.className} ${u.prop} (css:${u.line})`).join('\n')}\n` : ''}
## RAW values — bind-token worklist
${raws.length === 0 ? '_none — full token conformance on styleable props_' : raws.map((r) => `- .${r.className} · \`${r.prop}: ${r.value}\` (css:${r.line})${r.candidates.length ? ` → candidates: ${r.candidates.map((c) => `\`${c.token}\``).join(', ')}` : ''}`).join('\n')}

## REFUSED — design cleanup worklist
${run.refusals.map((r) => `- ${r.reason} · ${r.name} (${r.nodeId})${r.detail ? ` — ${r.detail}` : ''}`).join('\n')}

## APPROXIMATIONS — lossy-but-deliberate (visible, never silent)
${approximations.length === 0 ? '_none — every converted value is exact_' : approximations.map((a) => `- ${a.nodeId}: ${a.note}`).join('\n')}

## FONTS USED — must exist in the app build (fallback = silent visual drift)
${fonts.length === 0 ? '_none_' : fonts.map((f) => `- ${f}`).join('\n')}

## TOKEN VALUE PARITY — DS drift (Figma raw vs token resolved at frame width)
${parity.length === 0 ? '_none — every bound token resolves to Figma\'s own value_' : parity.map((p) => `- .${p.className} · \`${p.prop}\` = \`${p.token}\` → resolves **${p.resolved}px** but Figma shows **${p.figma}px** (css:${p.line}) — fix the token build or the Figma variable, not the converter`).join('\n')}
`;
  await fs.writeFile(mdPath, md);
  return report;
}
