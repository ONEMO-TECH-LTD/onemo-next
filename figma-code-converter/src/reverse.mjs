/**
 * figma-to-code · C1.4 — reverse-reader (SPEC §6 AC7, Dan's fidelity proof).
 *
 * Parses the emitted TSX + module.css BACK into a structural projection and diffs it against
 * the SAME projection derived from the IR. Projection carries the design data the code must
 * not lose: tree shape, per-node kind/tag/class, text content, svg roots, and which class
 * carries declarations. The IR→projection derivation re-implements naming and §3.6 tag rules
 * independently of the emitter's jsx() path (mirrors the census principle).
 * diff must be EMPTY. (Structure/geometry always convert — there are no refusal placeholders.)
 */
import { promises as fs } from 'node:fs';
import { declsOf } from './conformance.mjs';
import { ClassNamer, bgBorderDecls, isIdentityTransform } from './emit.mjs';

const HEADING = [
  [/^display\//, 'h1'], [/^title\/screen\//, 'h2'], [/^title\/section\//, 'h3'],
  [/^title\/product\//, 'h4'], [/^title\/headline\//, 'h4'], [/^body\/heading\//, 'h5'],
];
function expectedTag(n) {
  if (n.kind === 'text') {
    const p = n.text?.tokenPath;
    if (p) for (const [re, tag] of HEADING) if (re.test(p)) return tag;
    return 'span';
  }
  const name = String(n.name).toLowerCase();
  if (name === 'button' || name.endsWith('button')) return 'button';
  if (['nav', 'header', 'footer', 'main'].includes(name)) return name;
  return 'div';
}

// ─── geometry re-derivation (lead C2 F2 — reverse must prove geometry VALUES, not just structure) ──
// This whole change is about faithful geometry (no-autolayout→absolute, rotation→transform); the
// round-trip must diff the RESOLVED numeric geometry the code carries, or a wrong coord/size/angle
// passes census+canon+reverse and only the human pixel-pass catches it. Mirrors emit's declsFor/svg
// geometry exactly, so a dropped/swapped/mis-valued left/top/width/height/transform fails loudly.
// C3 (meta-qa MED + imageTransform guard): the diffed set includes container-type (root), border
// (stroke value), flex-shrink (Figma-never-shrinks law), and the background image-fill quartet
// (image/size/position/repeat — the imageTransform crop) — so a regressed C3.1–C3.5 fix, a
// deleted background-image, or a drifted crop value fails mechanically through official `check`.
const GEOM_PROPS = ['position', 'left', 'top', 'width', 'height', 'transform', 'container-type', 'border',
  'flex-shrink', 'background-image', 'background-size', 'background-position', 'background-repeat', 'background-origin', 'background-clip', 'border-image', 'background-color', 'background-blend-mode', 'margin-left', 'margin-top', 'margin-inline', 'margin-block', 'filter', 'backdrop-filter'];
const rpx = (v) => (v === 0 ? '0' : `${Math.round(v * 100) / 100}px`);
const rtok = (entry, raw) => (entry?.ref?.cssVar ? `var(${entry.ref.cssVar})` : raw);
function geomOf(n, isRoot, images) {
  const g = {};
  if (isRoot) g['container-type'] = 'inline-size'; // frame = viewport (C3.3)
  if (n.kind === 'svg') { // emit always writes svg width/height (token when the vector size is bound)
    g.width = n.sizing?.h === 'FIXED' ? rtok(n.sizing.width, rpx(n.bounds.width)) : rpx(n.bounds.width);
    g.height = n.sizing?.v === 'FIXED' ? rtok(n.sizing.height, rpx(n.bounds.height)) : rpx(n.bounds.height);
    if (n.isFlexChild) g['flex-shrink'] = '0';
  } else { // elements: width/height when FIXED; TEXT: only fixed-box autoResize (C5 mirror)
    const ar = n.kind === 'text' ? (n.text?.autoResize ?? 'NONE') : null;
    const w = n.kind !== 'text' ? n.sizing?.h === 'FIXED'
      : (n.sizing?.h === 'FIXED' && (ar === 'NONE' || ar === 'TRUNCATE' || ar === 'HEIGHT'));
    const h = n.kind !== 'text' ? n.sizing?.v === 'FIXED'
      : (n.sizing?.v === 'FIXED' && (ar === 'NONE' || ar === 'TRUNCATE'));
    if (w) g.width = rtok(n.sizing.width, rpx(n.sizing.width.value));
    if (h) g.height = rtok(n.sizing.height, rpx(n.sizing.height.value));
  }
  if (isRoot) { g.width = '100%'; g.height = '100dvh'; } // root IS the viewport (C6, Dan)
  if ((n.kind === 'element' || n.kind === 'text') && n.isFlexChild && !n.fillMain) g['flex-shrink'] = '0';
  if (n.centerViewport) { // capped root children fill to the cap and center in the viewport
    if (g.width === undefined) g.width = '100%';
    g['margin-inline'] = 'auto';
  }
  if (n.negMargin) g[`margin-${n.negMargin.axis}`] = rpx(n.negMargin.value);
  // ruler law part 3 mirror: a zero-extent line's box must occupy ZERO layout width (emit parity)
  if (n.lineMargin) {
    const m = n.lineMargin;
    g[`margin-${m.axis}`] = m.weight.ref?.cssVar ? `calc(var(${m.weight.ref.cssVar}) / -2)` : rpx(-(m.weight.value ?? 0) / 2);
  }
  if (n.absolute) { g.position = 'absolute'; g.left = rpx(n.absolute.x); g.top = rpx(n.absolute.y); }
  else if (n.hasAbsoluteChild) g.position = 'relative';
  // C3.1: Figma rotation is RADIANS → CSS degrees, sign-negated (mirrors emit's rotateDeg).
  // Pure mirrors emit scale(-1) (C11 transform-law slice) — mirrors emit's branch exactly.
  if (n.mirror) g.transform = n.mirror === 'x' ? 'scaleX(-1)' : 'scaleY(-1)';
  else if (n.rotation) g.transform = `rotate(${Math.round(-n.rotation * 180 / Math.PI * 100) / 100}deg)`;
  // background + border (C4.2): merged from THE shared derivation — emit and reverse call the
  // same bgBorderDecls, so background/border rules can never drift between the two (the C2/C3
  // check-IR bug class, closed at the architecture level). Only GEOM_PROPS keys are diffed.
  if (n.kind === 'element' || n.kind === 'text') {
    for (const [p, v] of bgBorderDecls(n, images, [])) if (GEOM_PROPS.includes(p)) g[p] = v;
    // theme-responsive surface (Dan): the root's image background inverts in dark via a
    // difference-blend against a theme colour — mirrors emit's depth-0 addition.
    if (isRoot && g['background-image'] && g['background-color'] === undefined
      && !String(g['background-image']).includes('var(')) { // token-bound surfaces theme through their own variable (mirrors emit)
      g['background-color'] = 'var(--fc-surface-invert, transparent)';
      g['background-blend-mode'] = 'difference';
    }
    // effect blurs (meta-qa C5 HIGH): filter/backdrop-filter mirror emit's effects loop — a
    // drifted or deleted GLASS/BACKGROUND_BLUR/LAYER_BLUR output must fail official `check`.
    const blurs = [];
    for (const e of n.style?.effects ?? []) {
      if (e.type === 'LAYER_BLUR') g.filter = `blur(${rpx(e.radius ?? 0)})`;
      if (e.type === 'BACKGROUND_BLUR') blurs.push(e.radius ?? 0);
      if (e.type === 'GLASS') blurs.push(8); // pinned approximation (§3.5)
    }
    if (blurs.length) g['backdrop-filter'] = `blur(${rpx(Math.max(...blurs))})`;
  }
  return g;
}

/** IR → projection (independent re-derivation of naming + tags + resolved geometry). */
function projectIr(ir, images) {
  const namer = new ClassNamer();
  function proj(n, isRoot) {
    const cls = namer.claim(n.name);
    const geom = geomOf(n, isRoot, images);
    if (n.kind === 'svg') return { kind: 'svg', cls, geom, children: [] };
    if (n.kind === 'text') return { kind: 'text', cls, tag: expectedTag(n), text: n.text.content, geom, children: [] };
    // §3.5 image-fill leaf rule: one IDENTITY-transform image fill, no children, asset present → <img>.
    // A cropped fill (non-identity imageTransform) stays a div with background crop (meta-qa C3 F1).
    const imgs = (n.style?.fills?.layers ?? []).filter((l) => l.type === 'image');
    if (n.children.length === 0 && imgs.length === 1 && images?.has(imgs[0].imageRef) && isIdentityTransform(imgs[0].imageTransform)) {
      return { kind: 'element', cls, tag: 'img', geom, children: [] };
    }
    return { kind: 'element', cls, tag: expectedTag(n), geom, children: n.children.map((c) => proj(c, false)) };
  }
  return proj(ir, true);
}

/** Emitted TSX → projection (parses the emitter's strict 2-space-indent format). */
function parseTsx(tsx) {
  const lines = tsx.split('\n').filter((l) => /^\s+</.test(l));
  const root = { children: [] };
  const stack = [{ node: root, depth: 0 }];
  for (const line of lines) {
    const depth = (line.match(/^ */)[0].length - 4) / 2; // jsx starts at depth 0 = 4 spaces
    if (/^\s+<\/[a-z0-9]+>$/.test(line)) continue; // closing tag
    const m = line.match(/^\s+<([a-zA-Z0-9-]+) className=\{styles\.([a-zA-Z0-9]+)\}([^>]*)(\/?)>(?:([^<]*)<\/[a-z0-9]+>)?/);
    if (!m) continue; // svg internals / elided
    const [, tag, cls, , selfClose, text] = m;
    const node = {
      kind: tag === 'svg' ? 'svg' : text !== undefined ? 'text' : 'element',
      cls,
      ...(tag !== 'svg' ? { tag } : {}),
      ...(text !== undefined ? { text: unescapeJsx(text) } : {}),
      children: [],
    };
    while (stack.length > 1 && stack[stack.length - 1].depth >= depth) stack.pop();
    stack[stack.length - 1].node.children.push(node);
    if (!selfClose && text === undefined && tag !== 'svg') stack.push({ node, depth });
  }
  return root.children[0];
}
const unescapeJsx = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#123;/g, '{').replace(/&#125;/g, '}');

/** Deep structural diff; returns [] when the code carries the IR faithfully. */
function diffProjection(a, b, path = '', out = []) {
  if (!a || !b) { out.push(`${path}: ${a ? 'missing in code' : 'extra in code'}`); return out; }
  for (const k of ['kind', 'cls', 'tag', 'text']) {
    if ((a[k] ?? null) !== (b[k] ?? null)) out.push(`${path}.${k}: ir=${JSON.stringify(a[k])} code=${JSON.stringify(b[k])}`);
  }
  const n = Math.max(a.children.length, b.children.length);
  if (a.children.length !== b.children.length) out.push(`${path}.children: ir=${a.children.length} code=${b.children.length}`);
  for (let i = 0; i < n; i++) diffProjection(a.children[i], b.children[i], `${path}/${a.children[i]?.cls ?? i}`, out);
  return out;
}

export async function reverseCheck({ ir, tsxPath, cssPath, images }) {
  const [tsx, css] = await Promise.all([fs.readFile(tsxPath, 'utf8'), fs.readFile(cssPath, 'utf8')]);
  const fromIr = projectIr(ir, images);
  const fromCode = parseTsx(tsx);
  const diff = diffProjection(fromIr, fromCode);
  // decl-carrier check: every class with decls in css must exist in the TSX projection
  const inCode = new Set();
  (function w(n) { if (n) { inCode.add(n.cls); n.children.forEach(w); } })(fromCode);
  for (const d of declsOf(css)) if (!inCode.has(d.className)) diff.push(`css class .${d.className} not reachable in code tree`);

  // geometry-value diff (lead C2 F2): the resolved geometry the IR expects must match the CSS on disk,
  // both directions — a missing/extra/mis-valued position|left|top|width|height|transform fails.
  const cssGeom = new Map(); // className → { prop → value } (geometry props only)
  for (const d of declsOf(css)) {
    if (!GEOM_PROPS.includes(d.prop)) continue;
    if (!cssGeom.has(d.className)) cssGeom.set(d.className, {});
    cssGeom.get(d.className)[d.prop] = d.value;
  }
  (function walkGeom(n) {
    if (!n) return;
    if (n.geom) {
      const actual = cssGeom.get(n.cls) ?? {};
      for (const p of GEOM_PROPS) {
        const want = n.geom[p] ?? null;
        const got = actual[p] ?? null;
        if (want !== got) diff.push(`.${n.cls} geometry ${p}: ir=${JSON.stringify(want)} css=${JSON.stringify(got)}`);
      }
    }
    n.children.forEach(walkGeom);
  })(fromIr);

  return { pass: diff.length === 0, diff };
}
