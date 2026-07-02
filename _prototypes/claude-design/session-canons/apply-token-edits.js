// apply-token-edits.js — DETERMINISTIC source rewriter for the DS dash "Save → bake" flow.
//
// Pure function. Same input → same output. No judgment, nothing to "forget".
// Takes a screen's source text + a change-set keyed by each element's UNIQUE
// data-anat anchor, and rewrites exactly the named properties in that element's
// inline style. REFUSES (logs SKIP, changes nothing for that anchor) if an
// anchor is missing or ambiguous — so it can never edit the wrong element.
//
// Change-set shape (dash Save → localStorage 'dashBakeQueue'):
//   { "Creator Studio": { "bottom-section": { "padding-bottom": "var(--spacing-m)" },
//                          "status-bar":     { "color":         "var(--color-text-primary)" } } }
//   value === null  → remove that property.
//
// Padding/margin SIDE edits (padding-bottom etc.) auto-expand an existing
// shorthand into clean longhands first, so no stale shorthand is left behind.

function splitTopLevel(val) {            // split on spaces NOT inside parens
  const out = []; let depth = 0, cur = '';
  for (const c of val) {
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ' ' && depth === 0) { if (cur) { out.push(cur); cur = ''; } }
    else cur += c;
  }
  if (cur) out.push(cur);
  return out;
}

function expandShorthand(decls, base) {  // base = 'padding' | 'margin'
  const idx = decls.findIndex(d => d.slice(0, d.indexOf(':')).trim() === base);
  if (idx < 0) return decls;
  const val = decls[idx].slice(decls[idx].indexOf(':') + 1).trim();
  const p = splitTopLevel(val);
  let t, r, b, l;
  if (p.length <= 1) { t = r = b = l = p[0] || '0'; }
  else if (p.length === 2) { t = b = p[0]; r = l = p[1]; }
  else if (p.length === 3) { t = p[0]; r = l = p[1]; b = p[2]; }
  else { t = p[0]; r = p[1]; b = p[2]; l = p[3]; }
  const longs = [base + '-top:' + t, base + '-right:' + r, base + '-bottom:' + b, base + '-left:' + l];
  return [...decls.slice(0, idx), ...longs, ...decls.slice(idx + 1)];
}

function findTagRange(src, anat) {
  const needle = 'data-anat="' + anat + '"';
  const i = src.indexOf(needle);
  if (i < 0) return { error: 'anchor not found: ' + anat };
  if (src.indexOf(needle, i + needle.length) >= 0) return { error: 'anchor NOT UNIQUE: ' + anat };
  const start = src.lastIndexOf('<', i);
  let j = i, q = null;
  for (; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === q) q = null; }
    else if (c === '"' || c === "'") q = c;
    else if (c === '>') break;
  }
  return { start, end: j };
}

function applyEdits(src, edits) {
  const log = [], errors = [];
  for (const anat of Object.keys(edits || {})) {
    const range = findTagRange(src, anat);
    if (range.error) { errors.push(range.error); log.push('SKIP — ' + range.error); continue; }
    let tag = src.slice(range.start, range.end + 1);
    const sm = tag.match(/style="([^"]*)"/);
    let decls = sm ? sm[1].split(';').map(s => s.trim()).filter(Boolean) : [];
    for (const prop of Object.keys(edits[anat])) {
      const value = edits[anat][prop]; // string or null
      const m = prop.match(/^(padding|margin)-(top|right|bottom|left)$/);
      if (m) decls = expandShorthand(decls, m[1]);
      let found = false;
      decls = decls.map(d => {
        const p = d.slice(0, d.indexOf(':')).trim();
        if (p === prop) { found = true; return value === null ? null : (prop + ':' + value); }
        return d;
      }).filter(x => x !== null);
      if (!found && value !== null) decls.push(prop + ':' + value);
      log.push('OK   — ' + anat + ' · ' + prop + ' = ' + value);
    }
    const newStyle = decls.join(';') + (decls.length ? ';' : '');
    if (sm) tag = tag.slice(0, sm.index) + 'style="' + newStyle + '"' + tag.slice(sm.index + sm[0].length);
    else tag = tag.replace('data-anat="' + anat + '"', 'data-anat="' + anat + '" style="' + newStyle + '"');
    src = src.slice(0, range.start) + tag + src.slice(range.end + 1);
  }
  return { src, log, errors };
}

if (typeof module !== 'undefined') module.exports = { applyEdits, findTagRange, expandShorthand, splitTopLevel };
