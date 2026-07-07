/**
 * figma-to-code · C1.3 — emitter: IR → <ComponentName>.tsx + <frame-slug>.module.css + page.tsx
 * (SPEC §3.1 structure/class contract, §3.2 flex, §3.5 visual pins, §3.6 semantics, §4b formatting law).
 *
 * Pure function over the IR — no filesystem, no network. SVG bodies and image files come from an
 * asset cache map (nodeId/imageRef → content|path); a missing asset emits a sized placeholder svg
 * + a report entry, never a crash (assets land via fetch-assets, C1.3b).
 */
import { minimalBoxShorthand, minimalRadiusShorthand } from './slot-law.mjs';

// ─── class + component naming (§3.1 class contract — NO underscores, ordinal uniquing) ──
function words(name) {
  const w = String(name).replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  return w.length ? w : ['el'];
}
export function camelClass(name) {
  const [h, ...t] = words(name).map((s) => s.toLowerCase());
  let out = h + t.map((s) => s[0].toUpperCase() + s.slice(1)).join('');
  if (/^\d/.test(out)) out = `el${out}`; // CSS class can't start with a digit
  return out;
}
export function pascalName(name) {
  return words(name).map((s) => s[0].toUpperCase() + s.slice(1).toLowerCase()).join('');
}
function kebabSlug(name) {
  return words(name).map((s) => s.toLowerCase()).join('-');
}
export class ClassNamer {
  constructor() { this.used = new Map(); }
  claim(name) {
    const base = camelClass(name);
    const n = this.used.get(base) ?? 0;
    this.used.set(base, n + 1);
    return n === 0 ? base : `${base}${n + 1}`; // ordinal, never `_2` (§3.1)
  }
}

// ─── value formatting (§3.4 token rule; §3.5 unit pins) ─────────────────────
const px = (v) => (v === 0 ? '0' : `${round2(v)}px`);
const round2 = (v) => Math.round(v * 100) / 100;
// Figma REST `rotation` is RADIANS, counter-clockwise-positive; CSS `rotate()` is degrees,
// clockwise-positive → negate AND convert rad→deg (C3.1). e.g. Figma -π/2 → CSS rotate(90deg).
const rotateDeg = (rad) => round2(-rad * 180 / Math.PI);
export function cssColor({ r, g, b, a }) {
  if (a === undefined || a >= 1) {
    const hex = [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
    return `#${hex}`;
  }
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
/** Bound value → var(--…); unbound → raw text. cssVar undefined but varId present = unmapped
 *  binding — emitted as raw + surfaced by C1.4's report (never silently dropped). */
const tokenOr = (entry, rawText) => (entry?.ref?.cssVar ? `var(${entry.ref.cssVar})` : rawText);
// ─── image crop (meta-qa C3 F1): Figma imageTransform → background-size/position ────────────
// STRETCH ("crop") fills carry an affine matrix mapping layer space → image space:
// image_u = m00·layer_u + m02 · image_v = m11·layer_v + m12. The exact CSS reproduction:
//   background-size = 100/m00 % × 100/m11 %  ·  background-position = m02/(1−m00) % , m12/(1−m11) %
// (the % positioning identity). Rotation/skew terms (m01/m10 ≠ 0) have no faithful bg equivalent →
// approximation note in the report.
export const isIdentityTransform = (t) => !t || (Math.abs(t[0][0] - 1) < 1e-6 && Math.abs(t[1][1] - 1) < 1e-6
  && Math.abs(t[0][2]) < 1e-6 && Math.abs(t[1][2]) < 1e-6 && Math.abs(t[0][1]) < 1e-6 && Math.abs(t[1][0]) < 1e-6);
export function imageCropCss(t, notes, node) {
  const [[m00, m01, m02], [m10, m11, m12]] = t;
  if (Math.abs(m01) > 1e-6 || Math.abs(m10) > 1e-6) {
    notes.push({ nodeId: node.id, kind: 'approximation', note: `imageTransform has rotation/skew — crop approximated axis-aligned` });
  }
  const pct = (v) => `${Math.round(v * 10000) / 100}%`;
  const pos = (tr, sc) => (Math.abs(1 - sc) < 1e-6 ? '0' : pct(tr / (1 - sc)));
  return { size: `${pct(1 / m00)} ${pct(1 / m11)}`, position: `${pos(m02, m00)} ${pos(m12, m11)}` };
}

// C3.2: average a gradient's stops → one solid color (for a gradient border on a ROUNDED node,
// where border-image would ignore the radius and give square corners). Exact gradient is kept for
// square nodes via border-image; rounded nodes get the faithful shape + averaged gradient color.
export const avgGradientColor = (g) => {
  const s = g.stops ?? [];
  if (!s.length) return '#000000';
  const a = s.reduce((m, x) => ({ r: m.r + x.color.r, g: m.g + x.color.g, b: m.b + x.color.b, al: m.al + (x.color.a ?? 1) }), { r: 0, g: 0, b: 0, al: 0 });
  return cssColor({ r: Math.round(a.r / s.length), g: Math.round(a.g / s.length), b: Math.round(a.b / s.length), a: Math.round(a.al / s.length * 1000) / 1000 });
};

// ─── background + border derivation — THE single source (C4.2) ──────────────────────────────
// Shared by declsFor (emit) AND reverse's geomOf: both sides call THIS, so a background/border
// rule change can never drift between the emitter and the round-trip gate (the C2/C3 bug class).
//
// Gradient strokes (never refused):
//  · node has fill layers covering the padding area → EXACT ring via layered backgrounds:
//    fills clipped to padding-box stacked over the stroke gradient clipped to border-box, with a
//    transparent border — follows border-radius, shows the true gradient (kills the avg-color
//    approximation for filled nodes like the golden card).
//  · no fill layers: square → border-image (exact); rounded → solid avg color + APPROXIMATION
//    entry (CSS cannot ring-clip a gradient on a rounded, unfilled node without a second element).
export function bgBorderDecls(node, images, notes) {
  const d = [];
  const st = node.style ?? {};
  // imgLeaf derived here from buildIr fields + images (NOT the emit-annotated flag) so emit and
  // reverse agree byte-for-byte (lead C3 F2 single-source law).
  const allImgs = (st.fills?.layers ?? []).filter((l) => l.type === 'image');
  const isImgLeaf = node.kind === 'element' && node.children.length === 0 && allImgs.length === 1
    && !!images?.has(allImgs[0].imageRef) && isIdentityTransform(allImgs[0].imageTransform);
  const layers = (st.fills?.layers ?? []).filter((l) => !(l.type === 'image' && isImgLeaf));
  // aligned layer↔css pairs (a missing image asset drops its layer from every list consistently)
  let pairs = layers.map((l) => ({ l, css: gradientCss(l, notes, node, images) })).filter((p) => p.css);
  const s = st.strokes;
  const wAll = s ? (s.weight.all !== undefined ? s.weight.all : Math.max(s.weight.top ?? 0, s.weight.right ?? 0, s.weight.bottom ?? 0, s.weight.left ?? 0)) : 0;
  const wv = s ? tokenOr({ ref: s.weight.ref }, px(wAll)) : null;
  const strokeGrad = s?.gradient ? gradientCss(s.gradient, notes, node, images) : null;
  // C5: a SOLID bottom fill also covers the padding area — promote it to a layer so solid-fill
  // nodes get the exact ring too (background-color alone paints border-box and can't clip).
  const bgc = node.kind !== 'text' ? st.fills?.backgroundColor : undefined;
  const layered = !!(strokeGrad && (pairs.length || bgc)); // exact-ring technique available
  if (layered && !pairs.length && bgc) {
    pairs = [{ l: { type: 'solid' }, css: gradientCss({ type: 'solid', color: bgc.color }, notes, node, images) }];
  }
  // background-color (single source): plain fill when NOT layered; folded into the layer stack when layered
  if (bgc && !layered) d.push(['background-color', tokenOr({ ref: bgc.ref }, cssColor(bgc.color))]);

  const bgList = layered ? [...pairs.map((p) => p.css), strokeGrad] : pairs.map((p) => p.css);
  if (bgList.length) d.push(['background-image', bgList.join(', ')]);

  const imgPair = pairs.find((p) => p.l.type === 'image' && images?.get(p.l.imageRef));
  if (imgPair) {
    const crop = imgPair.l.imageTransform && !isIdentityTransform(imgPair.l.imageTransform)
      ? imageCropCss(imgPair.l.imageTransform, notes, node) : null;
    const size = crop ? crop.size : ({ FILL: 'cover', FIT: 'contain', STRETCH: '100% 100%' }[imgPair.l.scaleMode] ?? 'cover');
    if (layered) { // per-layer lists (a single value would apply the crop to the ring gradient too)
      d.push(['background-size', [...pairs.map((p) => (p === imgPair ? size : 'auto')), 'auto'].join(', ')]);
      if (crop) d.push(['background-position', [...pairs.map((p) => (p === imgPair ? crop.position : '0 0')), '0 0'].join(', ')]);
    } else {
      d.push(['background-size', size]);
      if (crop) d.push(['background-position', crop.position]);
    }
    d.push(['background-repeat', 'no-repeat']);
  }
  // C4.1: Figma paints fills across the FULL node bounds with strokes on top; CSS positions
  // backgrounds from the padding-box → border-box anchor whenever a bordered node has bg layers.
  if (layered) {
    d.push(['background-origin', 'border-box']);
    d.push(['background-clip', [...pairs.map(() => 'padding-box'), 'border-box'].join(', ')]);
  } else if (bgList.length && s && (s.gradient || s.align === 'INSIDE')) {
    d.push(['background-origin', 'border-box']);
  }
  // border
  if (s) {
    if (s.gradient) {
      if (layered) d.push(['border', `${wv} solid transparent`]);
      else if (st.radius) {
        d.push(['border', `${wv} solid ${avgGradientColor(s.gradient)}`]);
        // lead C3: a lossy gradient→flat flatten must be VISIBLE in the report, never silent
        notes.push({ nodeId: node.id, kind: 'approximation', note: `gradient border flattened to avg color ${avgGradientColor(s.gradient)} (unfilled rounded node — exact ring needs a second element)` });
      } else { d.push(['border', `${wv} solid transparent`]); d.push(['border-image', `${strokeGrad} 1`]); }
    } else if (s.align === 'INSIDE') {
      const color = tokenOr({ ref: s.ref }, cssColor(s.color));
      // INSIDE-on-HUG law (live-hit: 48px dials rendered 50): a border on an auto-sized node ADDS
      // to the content box — Figma's INSIDE stroke paints within it. HUG nodes take the ring as an
      // inset box-shadow instead (declsFor's shadow list); FIXED/FILL keep border (border-box absorbs).
      const hug = node.sizing?.h === 'HUG' || node.sizing?.v === 'HUG';
      if (s.weight.all !== undefined && !hug) d.push(['border', `${wv} solid ${color}`]);
      else if (s.weight.all !== undefined) { /* inset ring joins declsFor's box-shadow list */ }
      else {
        for (const [sideName, w] of [['top', s.weight.top], ['right', s.weight.right], ['bottom', s.weight.bottom], ['left', s.weight.left]]) {
          if (w) d.push([`border-${sideName}`, `${px(w)} solid ${color}`]);
        }
      }
    }
    // OUTSIDE / CENTER solid rings join declsFor's box-shadow list (§3.5 composition order)
  }
  return d;
}

// ─── per-node CSS declarations, pinned order: layout → box → visual → typography (§4b-2) ──
function declsFor(node, notes) {
  const d = [];
  const { layout, sizing, style, text } = node;

  // layout
  if (layout) {
    d.push(['display', 'flex']);
    if (layout.direction === 'column') d.push(['flex-direction', 'column']);
    if (layout.wrap) d.push(['flex-wrap', 'wrap']);
    const J = { MIN: 'flex-start', CENTER: 'center', MAX: 'flex-end', SPACE_BETWEEN: 'space-between' };
    const A = { MIN: 'flex-start', CENTER: 'center', MAX: 'flex-end', BASELINE: 'baseline' };
    if (layout.justify !== 'MIN') d.push(['justify-content', J[layout.justify] ?? 'flex-start']);
    // C5 fixture-board finding: CSS flex DEFAULTS to align-items: stretch, Figma's MIN is
    // flex-start — omitting MIN silently stretched every HUG child cross-axis. Always explicit.
    if (layout.stretchHoist) d.push(['align-items', 'stretch']); // two-pass hoist (§3.2)
    else d.push(['align-items', A[layout.align] ?? 'flex-start']);
    if (layout.gap?.value > 0) d.push(['gap', tokenOr(layout.gap, px(layout.gap.value))]);
    const p = layout.padding;
    const side = (e) => (e ? tokenOr(e, px(e.value ?? 0)) : '0');
    if (p && (p.top?.value || p.right?.value || p.bottom?.value || p.left?.value
      || p.top?.ref || p.right?.ref || p.bottom?.ref || p.left?.ref)) {
      d.push(['padding', minimalBoxShorthand(side(p.top), side(p.right), side(p.bottom), side(p.left))]);
    }
    if (layout.clips) d.push(['overflow', 'hidden']); // clipsContent (§3.2, s58-designer)
  }

  // box (sizing per §3.2 FIXED/HUG/FILL; parent context applied by the caller).
  // TEXT (C5 fixture finding): a text node with a FIXED box (autoResize NONE/TRUNCATE, and
  // HEIGHT for width) must carry its dimensions — otherwise the box collapses to content and
  // TRUNCATE has nothing to truncate against. Auto-sizing text (WIDTH_AND_HEIGHT) stays unsized.
  const textAR = node.kind === 'text' ? (node.text?.autoResize ?? 'NONE') : null;
  const emitW = node.kind !== 'text' ? sizing?.h === 'FIXED'
    : (sizing?.h === 'FIXED' && (textAR === 'NONE' || textAR === 'TRUNCATE' || textAR === 'HEIGHT'));
  const emitH = node.kind !== 'text' ? sizing?.v === 'FIXED'
    : (sizing?.v === 'FIXED' && (textAR === 'NONE' || textAR === 'TRUNCATE'));
  if (emitW) d.push(['width', tokenOr(sizing.width, px(sizing.width.value))]);
  if (emitH) d.push(['height', tokenOr(sizing.height, px(sizing.height.value))]);
  // Root = viewport: capped root children keep filling to the cap (explicit width — auto
  // margins disable flex stretch) and center in the leftover space (no-op ≤ design width)
  if (node.centerViewport && !emitW) d.push(['width', '100%']);
  if (node.kind !== 'text' && sizing?.maxWidth) d.push(['max-width', tokenOr(sizing.maxWidth, px(sizing.maxWidth.value ?? 0))]);
  if (node.centerViewport) d.push(['margin-inline', 'auto']);
  // ruler law part 3: a zero-extent line's box is strokeWeight wide but must occupy ZERO layout
  // width (Figma spaces lines by their zero bbox) — negative half-weight margins on the zero axis
  if (node.lineMargin) {
    const m = node.lineMargin;
    d.push([`margin-${m.axis}`, m.weight.ref?.cssVar ? `calc(var(${m.weight.ref.cssVar}) / -2)` : px(-(m.weight.value ?? 0) / 2)]);
  }
  if (node.fillMain) d.push(['flex', '1']);            // main-axis FILL (§3.2)
  // Figma never shrinks children (it overflows); CSS flex does → pin non-FILL flex children (C3.5)
  if (node.isFlexChild && !node.fillMain) d.push(['flex-shrink', '0']);
  // C5: negative itemSpacing → negative main-axis margin on children after the first (overlap stacks)
  if (node.negMargin) d.push([`margin-${node.negMargin.axis}`, px(node.negMargin.value)]);
  if (node.stretchCross) d.push(['align-self', 'stretch']); // cross-axis FILL, not hoisted
  if (node.textMinWidth) d.push(['min-width', '0']);   // text-bearing FILL child (§3.2, s58-designer)
  if (node.absolute) {
    d.push(['position', 'absolute']);
    d.push(['left', px(node.absolute.x)]);
    d.push(['top', px(node.absolute.y)]);
  }
  // §3.2 absolute parent: position:relative makes the box a containing block — but ONLY when it
  // isn't already absolutely positioned (absolute is itself a containing block; two position
  // declarations would be duplicate slop, and nested no-autolayout frames hit exactly this).
  else if (node.hasAbsoluteChild) d.push(['position', 'relative']);

  // visual (§3.5) — text color here; element background-color lives in bgBorderDecls (single source)
  const st = style ?? {};
  if (st.fills?.backgroundColor && node.kind === 'text') {
    const f = st.fills.backgroundColor;
    d.push(['color', tokenOr({ ref: f.ref }, cssColor(f.color))]);
  }
  for (const decl of bgBorderDecls(node, node.imagesMap, notes)) d.push(decl);
  if (node.imgLeaf) d.push(['object-fit', { FILL: 'cover', FIT: 'contain', STRETCH: 'fill' }[node.imgLeaf] ?? 'cover']);
  const shadows = [];
  if (st.strokes && !st.strokes.gradient) {
    const s = st.strokes; const w = s.weight.all;
    const color = tokenOr({ ref: s.ref }, cssColor(s.color));
    if (s.align === 'OUTSIDE' && w !== undefined) shadows.push(`0 0 0 ${px(w)} ${color}`);
    // CENTER straddles the edge: half outside + half inside
    if (s.align === 'CENTER' && w !== undefined) { shadows.push(`0 0 0 ${px(w / 2)} ${color}`, `inset 0 0 0 ${px(w / 2)} ${color}`); }
    // INSIDE on a HUG node: inset ring (a border would inflate the auto-sized box — 48px dial → 50)
    if (s.align === 'INSIDE' && w !== undefined && (node.sizing?.h === 'HUG' || node.sizing?.v === 'HUG')) shadows.push(`inset 0 0 0 ${px(w)} ${color}`);
  }
  for (const e of st.effects ?? []) {
    if (e.type === 'DROP_SHADOW') shadows.push(`${px(e.offset?.x ?? 0)} ${px(e.offset?.y ?? 0)} ${px(e.radius ?? 0)} ${e.spread ? px(e.spread) + ' ' : ''}${cssColor(e.color)}`);
    if (e.type === 'INNER_SHADOW') shadows.push(`inset ${px(e.offset?.x ?? 0)} ${px(e.offset?.y ?? 0)} ${px(e.radius ?? 0)} ${e.spread ? px(e.spread) + ' ' : ''}${cssColor(e.color)}`);
  }
  if (shadows.length) d.push(['box-shadow', shadows.join(', ')]);
  const backdropBlurs = [];
  for (const e of st.effects ?? []) {
    if (e.type === 'LAYER_BLUR') d.push(['filter', `blur(${px(e.radius ?? 0)})`]);
    if (e.type === 'BACKGROUND_BLUR') backdropBlurs.push(e.radius ?? 0);
    if (e.type === 'GLASS') { // proprietary material, no REST params → pinned 8px approximation (C5)
      backdropBlurs.push(8);
      notes.push({ nodeId: node.id, kind: 'approximation', note: 'GLASS effect → backdrop-filter: blur(8px) (Figma exposes no material params over REST)' });
    }
  }
  // one composed decl (two backdrop-filters would be duplicate slop, canon R7) — strongest blur wins
  if (backdropBlurs.length) d.push(['backdrop-filter', `blur(${px(Math.max(...backdropBlurs))})`]);
  if (st.radius) {
    if (st.radius.all !== undefined) d.push(['border-radius', tokenOr({ ref: st.radius.ref }, px(st.radius.all))]);
    else {
      const c = st.radius.corners.map((v, i) => {
        const ref = st.radius.refs?.[i];
        return ref?.cssVar ? `var(${ref.cssVar})` : px(v);
      });
      d.push(['border-radius', minimalRadiusShorthand(c[0], c[1], c[2], c[3])]);
    }
  }
  if (st.opacity !== undefined) d.push(['opacity', String(st.opacity)]);
  if (st.blendMode) d.push(['mix-blend-mode', st.blendMode.toLowerCase().replace(/_/g, '-')]);
  // rotation → transform (C3.1: radians→degrees, sign-negated). geometry math, never refused.
  if (node.rotation) d.push(['transform', `rotate(${rotateDeg(node.rotation)}deg)`]);

  // typography (§3.5 TEXT + unit pins: lineHeight %→unitless, px→px)
  if (text) {
    d.push(['font-family', tokenOr(text.fontFamily, `'${text.fontFamily.value}'`)]);
    d.push(['font-size', tokenOr(text.fontSize, px(text.fontSize.value))]);
    if (text.fontWeight && text.fontWeight !== 400) d.push(['font-weight', String(text.fontWeight)]);
    if (text.italic) d.push(['font-style', 'italic']);
    const lh = text.lineHeight;
    if (lh?.ref?.cssVar) d.push(['line-height', `var(${lh.ref.cssVar})`]);
    else if (lh?.unit === 'PIXELS' && lh.value) d.push(['line-height', px(lh.value)]);
    else if (lh?.percentFontSize) d.push(['line-height', String(round2(lh.percentFontSize / 100))]);
    const ls = text.letterSpacing;
    if (ls?.ref?.cssVar) d.push(['letter-spacing', `var(${ls.ref.cssVar})`]);
    else if (ls?.value) d.push(['letter-spacing', px(ls.value)]);
    if (text.alignX !== 'LEFT') d.push(['text-align', text.alignX.toLowerCase()]);
    if (text.autoResize === 'TRUNCATE') { d.push(['white-space', 'nowrap']); d.push(['overflow', 'hidden']); d.push(['text-overflow', 'ellipsis']); }
  }
  return d;
}

export function gradientCss(layer, notes, node, images) {
  if (layer.type === 'solid') return `linear-gradient(${cssColor(layer.color)}, ${cssColor(layer.color)})`; // non-bottom solid (§3.5)
  if (layer.type === 'image') {
    const img = images?.get(layer.imageRef);
    if (img) return `url('./assets/${img.file}')`; // container w/ image fill (§3.5 Dan package pin)
    notes.push({ nodeId: node.id, note: `image asset missing: ${layer.imageRef}` });
    return null;
  }
  const stops = layer.stops.map((s) => `${cssColor(s.color)} ${round2(s.position * 100)}%`).join(', ');
  const h = layer.gradientHandlePositions;
  const pctv = (v) => `${round2(v * 100)}%`;
  if (layer.type === 'linear') return `linear-gradient(${gradientAngle(h)}deg, ${stops})`;
  // C5 fixture findings: radial/angular need their CENTER + extent/start-angle from the handles
  // (h[0]=center, h[1]=primary axis end, h[2]=secondary), not CSS defaults.
  if (layer.type === 'radial') {
    if (h?.length >= 3) {
      const rx = Math.hypot(h[1].x - h[0].x, h[1].y - h[0].y);
      const ry = Math.hypot(h[2].x - h[0].x, h[2].y - h[0].y);
      return `radial-gradient(ellipse ${pctv(rx)} ${pctv(ry)} at ${pctv(h[0].x)} ${pctv(h[0].y)}, ${stops})`;
    }
    return `radial-gradient(${stops})`;
  }
  if (layer.type === 'angular') {
    if (h?.length >= 2) {
      const from = round2((Math.atan2(h[1].y - h[0].y, h[1].x - h[0].x) * 180) / Math.PI + 90);
      return `conic-gradient(from ${from}deg at ${pctv(h[0].x)} ${pctv(h[0].y)}, ${stops})`;
    }
    return `conic-gradient(${stops})`;
  }
  notes.push({ nodeId: node.id, note: `gradient type ${layer.type} skipped` });
  return null;
}
/** gradientTransform → CSS angle — the ONE shared function (§3.5 F5 pin). */
export function gradientAngle(handles) {
  if (!handles || handles.length < 2) return 180;
  const [a, b] = handles;
  const rad = Math.atan2(b.y - a.y, b.x - a.x);
  return round2((rad * 180) / Math.PI + 90);
}

// ─── §3.6 semantics (pinned tables) ──────────────────────────────────────────
const HEADING = [
  [/^display\//, 'h1'], [/^title\/screen\//, 'h2'], [/^title\/section\//, 'h3'],
  [/^title\/product\//, 'h4'], [/^title\/headline\//, 'h4'], [/^body\/heading\//, 'h5'],
];
function tagFor(node) {
  if (node.kind === 'text') {
    const p = node.text?.tokenPath;
    if (p) for (const [re, tag] of HEADING) if (re.test(p)) return tag;
    return 'span';
  }
  const n = String(node.name).toLowerCase();
  if (n === 'button' || n.endsWith('button')) return 'button';
  if (['nav', 'header', 'footer', 'main'].includes(n)) return n;
  return 'div';
}

// ─── the emit ────────────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/[&<>{}]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '{': '&#123;', '}': '&#125;' }[c]));

export function emit(ir, frameName, { assets = new Map(), images = new Map(), audit = false } = {}) {
  // C8.1: audit builds stamp data-fc="<figmaId>" so the console maps a click straight to the
  // node with zero class-name guessing. Off by default → product build byte-identical.
  const fc = (n) => (audit ? ` data-fc="${n.id}"` : '');
  const namer = new ClassNamer();
  const cssRules = [];
  const notes = [];
  let surfaceInvert = false; // set when the root image surface gets the dark difference-blend
  const idMap = []; // Figma node id ↔ emitted class (§4 conformance ID map)
  const imgImports = new Map(); // imageRef → identifier (static imports — Dan package pin)

  // annotate FILL/absolute context (parent-dependent flags read by declsFor)
  // EMIT-SPECIFIC annotations only (need the assets/images inputs). All layout-derived flags
  // (isFlexChild/fillMain/stretchCross/textMinWidth/hasAbsoluteChild) are derived in buildIr —
  // single source, so `check` (buildIr-only) and `convert` project identical IRs (lead C3 F2).
  (function annotate(n) {
    if (n.kind === 'element' || n.kind === 'text') {
      n.imagesMap = images;
      // §3.5 image-fill leaf rule: element, no children, ONE image fill with the asset present AND
      // an identity transform → <img>. A CROPPED fill (non-identity imageTransform) goes the
      // background-image path so the crop matrix is reproduced (meta-qa C3 F1).
      const imgs = (n.style?.fills?.layers ?? []).filter((l) => l.type === 'image');
      if (n.kind === 'element' && n.children.length === 0 && imgs.length === 1 && images.has(imgs[0].imageRef)
        && isIdentityTransform(imgs[0].imageTransform)) {
        n.imgLeaf = imgs[0].scaleMode ?? 'FILL';
        n.imgRef = imgs[0].imageRef;
      }
    }
    n.children.forEach(annotate);
  })(ir);

  function jsx(n, depth) {
    const pad = '  '.repeat(depth + 2);
    const cls = namer.claim(n.name);
    idMap.push({ figmaId: n.id, class: cls, kind: n.kind });

    if (n.kind === 'svg') {
      // Baked-binding detector (Dan: "what guarantees nothing else freezes silently") — any live
      // semantics inside a coalesced svg subtree (variable bindings below the root, auto-layout)
      // are baked into static pixels; that is a LOSSY conversion and must be ledgered, never
      // silent. The ruler passed every gate exactly because this class had no detector.
      if (n.svgSource) {
        let baked = 0, layouts = 0;
        (function scan(x, depth) {
          if (depth > 0) {
            baked += Object.keys(x.boundVariables ?? {}).length;
            if (x.layoutMode && x.layoutMode !== 'NONE') layouts++;
          }
          (x.children ?? []).forEach((c) => scan(c, depth + 1));
        })(n.svgSource, 0);
        baked = Math.max(0, baked - (n.svgTokenColor?.bindings ?? 0)); // C7.3: rewritten color bindings are LIVE, not baked
        if (baked > 0 || layouts > 0) {
          // visual:false — the baked VALUES render correctly today (loss is semantic: re-theming/
          // fluidity), so this note must NOT mask the region in the fidelity gate (C7.1: a masked
          // icon area would hide real pixel regressions).
          notes.push({ nodeId: n.id, kind: 'approximation', visual: false, note: `svg coalescing baked ${baked} variable binding(s) + ${layouts} auto-layout frame(s) into static pixels — live semantics lost (split the group or extend the vector-element law)` });
        }
      }
      let body = assets.get(n.id);
      // C7.3 (KAI-9371): token-aware svg — single-token subtrees rewrite their bound hexes to
      // currentColor; the class carries `color: var(--token)` so the icon re-themes with the DS.
      // JSX-safe by construction (attribute value swap only, no style attributes).
      if (body && n.svgTokenColor) {
        for (const hx of n.svgTokenColor.hexes) {
          body = body.replace(new RegExp(`(fill|stroke)="${hx}"`, 'gi'), '$1="currentColor"');
        }
      }
      // width/height as tokens when the vector's size is variable-bound (100%-Figma parity)
      const w = n.sizing?.h === 'FIXED' ? tokenOr(n.sizing.width, px(n.bounds.width)) : px(n.bounds.width);
      const h = n.sizing?.v === 'FIXED' ? tokenOr(n.sizing.height, px(n.bounds.height)) : px(n.bounds.height);
      const svgDecls = [['width', w], ['height', h]];
      if (n.isFlexChild) svgDecls.push(['flex-shrink', '0']); // svg flex items must not squeeze (C3.5)
      if (n.negMargin) svgDecls.push([`margin-${n.negMargin.axis}`, px(n.negMargin.value)]);
      if (n.absolute) { svgDecls.push(['position', 'absolute'], ['left', px(n.absolute.x)], ['top', px(n.absolute.y)]); }
      if (n.rotation) svgDecls.push(['transform', `rotate(${rotateDeg(n.rotation)}deg)`]);
      if (body && n.svgTokenColor) svgDecls.push(['color', `var(${n.svgTokenColor.cssVar})`]);
      cssRules.push([cls, svgDecls]);
      if (body) {
        // inline the Figma-exported svg, class attached (§3.5 vector pin)
        return `${pad}${body.replace('<svg', `<svg className={styles.${cls}}${fc(n)}`)}`;
      }
      notes.push({ nodeId: n.id, note: 'svg asset missing — sized placeholder emitted' });
      return `${pad}<svg className={styles.${cls}}${fc(n)} viewBox="0 0 ${n.bounds.width} ${n.bounds.height}" data-asset-pending="${n.id}" />`;
    }

    let decls = declsFor(n, notes);
    // C3.3 + C6 (Dan): frame = viewport, LITERALLY. The root frame IS the screen: it fills the
    // viewport (width 100%, height 100dvh) instead of its fixed Figma px — and because it is the
    // container-query context, every fluid token (clamp(… cqi …)) adapts WITH the viewport. At a
    // viewport equal to the frame's design size the render is identical to Figma (fidelity gates
    // measure there); larger/smaller viewports scale per the design system's own fluid tokens.
    if (depth === 0) {
      // The law is unconditional: a HUG/FILL root has no width/height decl to swap, so the
      // viewport pair is always (re)inserted — at the canonical rank-1 position (canon rule 9).
      decls = decls.filter(([p2]) => p2 !== 'width' && p2 !== 'height');
      const R0 = new Set(['display', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'gap', 'padding']);
      let at = 0; while (at < decls.length && R0.has(decls[at][0])) at++;
      decls.splice(at, 0, ['width', '100%'], ['height', '100dvh']);
      decls.unshift(['container-type', 'inline-size']);
      // Theme-responsive surface (Dan): the root's image background can't token-swap, so in dark
      // it inverts via a difference-blend against a theme-driven colour — light = transparent
      // (unchanged), dark = white (inverted). Only the ROOT surface; content images are untouched.
      if (decls.some(([p2]) => p2 === 'background-image') && !decls.some(([p2]) => p2 === 'background-color')) {
        decls.push(['background-color', 'var(--fc-surface-invert, transparent)'], ['background-blend-mode', 'difference']);
        surfaceInvert = true;
      }
    }
    if (decls.length) cssRules.push([cls, decls]);
    if (n.imgLeaf) { // §3.5: image-fill leaf → <img> via static import (self-contained package)
      let ident = imgImports.get(n.imgRef);
      if (!ident) { ident = `asset${imgImports.size}`; imgImports.set(n.imgRef, ident); }
      return `${pad}<img className={styles.${cls}}${fc(n)} src={${ident}.src} alt="${esc(n.name)}" />`;
    }
    const tag = tagFor(n);
    const open = `${pad}<${tag} className={styles.${cls}}${fc(n)}>`;
    if (n.kind === 'text') return `${open}${esc(n.text.content)}</${tag}>`;
    if (n.children.length === 0) return `${pad}<${tag} className={styles.${cls}}${fc(n)} />`;
    return [open, ...n.children.map((c) => jsx(c, depth + 1)), `${pad}</${tag}>`].join('\n');
  }

  const componentName = pascalName(frameName);
  const slug = kebabSlug(frameName);
  const body = jsx(ir, 0);

  // formatting law (§4b-2): one decl per line, `prop: value;` — byte-splice-editable
  const css = cssRules
    .map(([cls, decls]) => `.${cls} {\n${decls.map(([p, v]) => `  ${p}: ${v};`).join('\n')}\n}`)
    .join('\n\n') + '\n';

  const importLines = [...imgImports.entries()]
    .map(([ref, ident]) => `import ${ident} from './assets/${images.get(ref).file}';`).join('\n');
  const tsx = `// Generated by figma-to-code — deterministic, do not hand-edit structure (edit via react-figma).
import styles from './${slug}.module.css';
${importLines ? importLines + '\n' : ''}
export default function ${componentName}() {
  return (
${body}
  );
}
`;

  // Theme-responsive surface (Dan): the package SHIPS its own dark-surface definition as a plain
  // CSS import so it's self-contained (an app-level rule in a Tailwind globals.css gets stripped).
  // Light stays at the emitted `transparent` fallback; dark inverts the image via difference-blend.
  const themeCss = surfaceInvert
    ? '/* Generated by figma-to-code — theme-responsive surface (dark inverts the image background). */\n[data-theme="dark"] {\n  --fc-surface-invert: #ffffff;\n}\n'
    : null;

  // Route wrapper is BARE (Dan, C6): the converted root IS the viewport (width 100% ×
  // height 100dvh, container-query context) — it fills and adapts by itself; no presentation shell.
  const pageTsx = `// Generated by figma-to-code — route wrapper (SPEC §3.1 output placement).
${themeCss ? "import './theme.css';\n" : ''}import ${componentName} from './${componentName}';

export default function Page() {
  return <${componentName} />;
}
`;

  return { componentName, slug, tsx, css, pageTsx, themeCss, idMap, notes };
}
