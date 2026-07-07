/**
 * Theme-scoped token resolution (meta-qa C8.1 F1). A flat last-wins scan of tokens.css lets a
 * `[data-theme="dark"]` override win over the `:root`/light value, so any theme-varying token
 * (colours) resolves to the WRONG value for the rendered theme. The converted routes render
 * `data-theme="light"` by default, so we build the map from the default/active-theme scope only:
 * keep `:root` and the active theme's blocks; skip every other explicit `[data-theme="…"]` block.
 */
/** Resolve a value's var(--…) chain against a defs map (cycle-guarded). The single token
 *  resolver — conformance, anatomy and audit-export all use this rather than re-implementing
 *  the walk (o-deslop: was 4 copies). Returns the value unchanged when nothing resolves. */
export function resolveVar(defs, value, depth = 0) {
  const m = String(value).match(/var\((--[a-zA-Z0-9-]+)\)/);
  return m && defs.has(m[1]) && depth < 12 ? resolveVar(defs, String(value).replace(m[0], defs.get(m[1])), depth + 1) : value;
}

export function themeScopedTokenDefs(cssText, { theme = 'light' } = {}) {
  const defs = new Map();
  for (const block of String(cssText).split('}')) {
    const i = block.indexOf('{'); if (i < 0) continue;
    const selector = block.slice(0, i).toLowerCase();
    const m = selector.match(/data-theme\s*=\s*["']?([a-z]+)/);
    if (m && m[1] !== theme) continue; // an explicit OTHER-theme scope — not what the route renders
    for (const d of block.slice(i + 1).matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g)) defs.set(d[1], d[2].trim());
  }
  return defs;
}
