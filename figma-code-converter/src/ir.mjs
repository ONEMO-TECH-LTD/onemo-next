/**
 * figma-to-code · C1.2 — normalizer + IR (SPEC §2 pipeline, §3 mapping rules).
 *
 * Raw REST node document → thin IR. Deterministic: every branch below cites its SPEC rule.
 * Structure and geometry ALWAYS convert (Dan: layer tree = DOM tree; geometry is math) — a
 * container without auto-layout becomes a positioning context with absolute children, rotation
 * becomes a transform. Only genuinely unmappable PROPERTIES (e.g. Figma's GLASS effect, gradient
 * strokes) record a REFUSAL into the report; the element still emits. CSS text is the emitter's
 * job (C1.3); the IR carries CSS-canonical property names with semantic values + cssVar refs.
 */

// ─── vector subtree detection (§3.5 vector pin) ─────────────────────────────
const VEC_TYPES = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'LINE', 'STAR', 'POLYGON', 'REGULAR_POLYGON', 'ELLIPSE']);

const hasOwnPaint = (n) =>
  (n.fills ?? []).some((f) => f.visible !== false && f.type) ||
  (n.strokes ?? []).some((s) => s.visible !== false) ||
  (n.effects ?? []).some((e) => e.visible !== false);

export function isVectorish(node) {
  if (VEC_TYPES.has(node.type)) return true;
  // a GROUP (always transparent) or a paint-less FRAME whose entire non-empty subtree is vectors
  // IS an icon → one svg root. The paint guard keeps STYLED frames (glass buttons with their own
  // fill/effect, which also can't svg-export) as real CSS containers.
  if (node.type === 'GROUP' && node.children?.length > 0) return node.children.every(isVectorish);
  // Dan's ruler law: an auto-layout vector frame with LIVE semantics (variable-bound spacing) is
  // a wired composition, not an icon — coalescing bakes the bindings AND destroys the centering
  // container. It stays a real flex container; each line converts on its own.
  if (node.type === 'FRAME' && node.children?.length > 0 && !hasOwnPaint(node)) {
    if (node.layoutMode && node.layoutMode !== 'NONE' && node.boundVariables?.itemSpacing) return false;
    return node.children.every(isVectorish);
  }
  return false;
}

// ─── §3 visibility rules — SHARED law: the census walker applies the same ────
function isVisible(node) {
  return node.visible !== false;
}

// ─── bound-variable helpers (§3.4 rule 1) ────────────────────────────────────
function varRef(varMap, alias) {
  if (!alias || alias.type !== 'VARIABLE_ALIAS') return undefined;
  const hit = varMap?.get(alias.id);
  return { varId: alias.id, cssVar: hit?.cssVar, tokenName: hit?.name };
}

/** {value, ref?} for a scalar node property that may be variable-bound. */
function boundScalar(node, prop, varMap) {
  const value = node[prop];
  const ref = varRef(varMap, node.boundVariables?.[prop]);
  return value === undefined && !ref ? undefined : { value, ref };
}

// ─── §3.5 font-weight table (F3.7) — unknown style REFUSES, never guessed ────
const WEIGHTS = {
  thin: 100, extralight: 200, ultralight: 200, light: 300, regular: 400, normal: 400, book: 400,
  medium: 500, semibold: 600, demibold: 600, bold: 700, extrabold: 800, ultrabold: 800, black: 900, heavy: 900,
};
export function fontWeightOf(styleName) {
  const s = String(styleName).toLowerCase().replace(/\s+/g, '');
  const italic = s.endsWith('italic');
  const base = italic ? s.slice(0, -6) || 'regular' : s;
  const weight = WEIGHTS[base];
  return weight === undefined ? null : { weight, italic };
}

// ─── color: Figma {r,g,b,a} 0-1 → semantic value (emitter formats) ──────────
const colorOf = (c, opacity = 1) => ({
  r: Math.round(c.r * 255), g: Math.round(c.g * 255), b: Math.round(c.b * 255),
  a: Math.round(((c.a ?? 1) * opacity) * 1000) / 1000,
});

// ─── refusal record — PROPERTY-level only (§3.5). Structure/geometry NEVER refuse (Dan): the
// node always converts; a refusal just records a single unmappable property (e.g. GLASS effect,
// gradient stroke) into the conformance report while the element itself emits faithfully.
function refuse(refusals, node, reason, detail) {
  refusals.push({ nodeId: node.id, name: node.name, reason, ...(detail ? { detail } : {}) });
}

const bboxOf = (node) => node.absoluteBoundingBox ?? { width: 0, height: 0 };

// ─── fills (§3.5 fill stacks + gradients F3.4/F3.5) ─────────────────────────
function fillsOf(node, varMap, refusals) {
  const visible = (node.fills ?? []).filter((f) => f.visible !== false && f.type);
  if (visible.length === 0) return undefined;
  const layers = [];
  let backgroundColor;
  for (let i = 0; i < visible.length; i++) {
    const f = visible[i];
    // binding lives INSIDE the paint (REST carrier truth); node.boundVariables.fills is a
    // compacted mirror, NOT index-aligned — never indexed (C11 Binding Law, E1)
    const ref = varRef(varMap, f.boundVariables?.color);
    if (f.type === 'SOLID') {
      const entry = { type: 'solid', color: colorOf(f.color, f.opacity ?? 1), ref, blendMode: f.blendMode };
      if (i === 0 && !backgroundColor) backgroundColor = entry; // bottom-most solid → background-color
      else layers.push(entry);
    } else if (f.type === 'GRADIENT_LINEAR' || f.type === 'GRADIENT_RADIAL' || f.type === 'GRADIENT_ANGULAR') {
      layers.push({
        type: f.type.slice(9).toLowerCase(), // linear|radial|angular
        stops: (f.gradientStops ?? []).map((s) => ({ position: s.position, color: colorOf(s.color), ref: varRef(varMap, s.boundVariables?.color) })),
        gradientHandlePositions: f.gradientHandlePositions, blendMode: f.blendMode,
      });
    } else if (f.type === 'GRADIENT_DIAMOND') {
      refuse(refusals, node, 'unsupported-gradient', 'GRADIENT_DIAMOND has no CSS equivalent');
    } else if (f.type === 'IMAGE') {
      // imageTransform (STRETCH/crop mode): affine matrix mapping layer space → image space.
      // Carried so emit can reproduce Figma's crop exactly (meta-qa C3 F1) — never silently dropped.
      layers.push({ type: 'image', imageRef: f.imageRef, scaleMode: f.scaleMode, blendMode: f.blendMode,
        ...(f.imageTransform ? { imageTransform: f.imageTransform } : {}) });
    } else {
      refuse(refusals, node, 'unknown-fill', f.type);
    }
  }
  return { backgroundColor, layers: layers.reverse() }; // CSS layer order: top fill first (§3.5)
}

// ─── strokes (§3.5 F3.2 — C3.2: convert every stroke, never refuse) ──────────
// SOLID → border/ring (emit by align); GRADIENT_* → gradient descriptor (emit → border-image);
// CENTER align straddles the edge (emit → half-inside + half-outside box-shadow ring).
function strokesOf(node, varMap, refusals) {
  const strokes = (node.strokes ?? []).filter((s) => s.visible !== false);
  if (strokes.length === 0) return undefined;
  const s = strokes[0];
  if (strokes.length > 1) refuse(refusals, node, 'multi-stroke', `${strokes.length} paints; first used, rest reported`);
  const align = node.strokeAlign ?? 'INSIDE';
  const weightRef = varRef(varMap, node.boundVariables?.strokeWeight);
  const per = node.individualStrokeWeights;
  const weight = per
    ? { top: per.top, right: per.right, bottom: per.bottom, left: per.left, ref: weightRef }
    : { all: node.strokeWeight, ref: weightRef };
  if (s.type === 'SOLID') {
    return { align, weight, color: colorOf(s.color, s.opacity ?? 1), ref: varRef(varMap, node.boundVariables?.strokes?.[0]) };
  }
  if (s.type === 'GRADIENT_LINEAR' || s.type === 'GRADIENT_RADIAL' || s.type === 'GRADIENT_ANGULAR') {
    return {
      align, weight,
      gradient: {
        type: s.type.slice(9).toLowerCase(),
        stops: (s.gradientStops ?? []).map((g) => ({ position: g.position, color: colorOf(g.color), ref: varRef(varMap, g.boundVariables?.color) })),
        gradientHandlePositions: s.gradientHandlePositions,
      },
    };
  }
  refuse(refusals, node, 'unknown-stroke-paint', s.type); // IMAGE stroke etc — genuinely rare
  return undefined;
}

// ─── effects (§3.5 + unknown-effect pin) ─────────────────────────────────────
// GLASS (Figma's proprietary material, C5): exposes NO parameters over REST — converts as a
// pinned deterministic approximation (backdrop-filter blur(8px), emit adds the APPROXIMATIONS
// entry). Never refused; only truly unknown effect types still report.
const EFFECT_KINDS = new Set(['DROP_SHADOW', 'INNER_SHADOW', 'LAYER_BLUR', 'BACKGROUND_BLUR', 'GLASS']);
function effectsOf(node, refusals) {
  const list = (node.effects ?? []).filter((e) => e.visible !== false);
  if (list.length === 0) return undefined;
  const out = [];
  for (const e of list) {
    if (!EFFECT_KINDS.has(e.type)) { refuse(refusals, node, 'unknown-effect', e.type); continue; }
    out.push({
      type: e.type, radius: e.radius,
      ...(e.color ? { color: colorOf(e.color) } : {}),
      ...(e.offset ? { offset: e.offset } : {}),
      ...(e.spread !== undefined ? { spread: e.spread } : {}),
    });
  }
  return out.length ? out : undefined;
}

// ─── corner radius (§3.5, slot-preserving mixed corners) ─────────────────────
// boundVariables.rectangleCornerRadii comes two ways: an array [tl,tr,br,bl] (older) OR a
// corner-keyed OBJECT {RECTANGLE_TOP_LEFT_CORNER_RADIUS: alias, …} (live Figma). Handle both.
const CORNER_KEYS = ['RECTANGLE_TOP_LEFT_CORNER_RADIUS', 'RECTANGLE_TOP_RIGHT_CORNER_RADIUS', 'RECTANGLE_BOTTOM_RIGHT_CORNER_RADIUS', 'RECTANGLE_BOTTOM_LEFT_CORNER_RADIUS'];
function radiusOf(node, varMap) {
  const bvr = node.boundVariables?.rectangleCornerRadii;
  const cornerRefs = Array.isArray(bvr)
    ? bvr.map((r) => varRef(varMap, r))
    : bvr ? CORNER_KEYS.map((k) => varRef(varMap, bvr[k])) : [undefined, undefined, undefined, undefined];
  const per = node.rectangleCornerRadii; // [tl,tr,br,bl] numeric, or null when uniform
  if (per) return { corners: per, refs: cornerRefs.some(Boolean) ? cornerRefs : undefined };
  if (node.cornerRadius) {
    const direct = varRef(varMap, node.boundVariables?.cornerRadius);
    const allSame = cornerRefs[0]?.cssVar && cornerRefs.every((r) => r?.cssVar === cornerRefs[0].cssVar);
    if (direct || allSame) return { all: node.cornerRadius, ref: direct ?? cornerRefs[0] };
    if (cornerRefs.some(Boolean)) return { corners: [node.cornerRadius, node.cornerRadius, node.cornerRadius, node.cornerRadius], refs: cornerRefs };
    return { all: node.cornerRadius };
  }
  return undefined;
}

// ─── auto-layout (§3.2 incl. SPACE_BETWEEN gap-ignore + clipsContent) ────────
function layoutOf(node, varMap) {
  if (node.layoutMode !== 'HORIZONTAL' && node.layoutMode !== 'VERTICAL') return undefined;
  const spaceBetween = node.primaryAxisAlignItems === 'SPACE_BETWEEN';
  return {
    direction: node.layoutMode === 'HORIZONTAL' ? 'row' : 'column',
    // SPACE_BETWEEN ignores itemSpacing — Figma does too (§3.2, s58-designer)
    gap: spaceBetween ? undefined : boundScalar(node, 'itemSpacing', varMap),
    padding: {
      top: boundScalar(node, 'paddingTop', varMap), right: boundScalar(node, 'paddingRight', varMap),
      bottom: boundScalar(node, 'paddingBottom', varMap), left: boundScalar(node, 'paddingLeft', varMap),
    },
    justify: node.primaryAxisAlignItems ?? 'MIN',
    align: node.counterAxisAlignItems ?? 'MIN',
    wrap: node.layoutWrap === 'WRAP',
    clips: node.clipsContent === true,
  };
}

// ─── TEXT (§3.5 TEXT + F3.7 + §3.6 token path for heading promotion) ─────────
function textOf(node, varMap, refusals) {
  const st = node.style ?? {};
  const fw = fontWeightOf(st.fontStyle ?? 'Regular');
  if (!fw) refuse(refusals, node, 'unknown-font-style', st.fontStyle);
  // TEXT bound-vars are ARRAYS (per style-range) in real Figma — uniform text = one element [0].
  const ref = (k) => { const b = node.boundVariables?.[k]; return varRef(varMap, Array.isArray(b) ? b[0] : b); };
  return {
    content: node.characters ?? '',
    fontFamily: { value: st.fontFamily, ref: ref('fontFamily') },
    fontSize: { value: st.fontSize, ref: ref('fontSize') },
    fontWeight: fw?.weight, italic: fw?.italic ?? false,
    letterSpacing: { value: st.letterSpacing, ref: ref('letterSpacing') },
    lineHeight: {
      value: st.lineHeightPx, unit: st.lineHeightUnit, percentFontSize: st.lineHeightPercentFontSize,
      ref: ref('lineHeight'),
    },
    alignX: st.textAlignHorizontal ?? 'LEFT', alignY: st.textAlignVertical ?? 'TOP',
    autoResize: st.textAutoResize ?? 'NONE',
    // §3.6 heading promotion key: the bound size token's path (e.g. 'title/headline/size')
    tokenPath: ref('fontSize')?.tokenName,
  };
}

// ─── the walk (§3.1 structure · two-pass sizing §3.2) ────────────────────────
export function buildIr(rawDoc, varMap = null) {
  const refusals = [];

  // child offset within a parent — geometry is math (Dan: no structural refusals, ever).
  const offsetIn = (parent, node) => {
    const p = parent.absoluteBoundingBox ?? { x: 0, y: 0 };
    const c = node.absoluteBoundingBox ?? { x: 0, y: 0 };
    return { x: (c.x ?? 0) - (p.x ?? 0), y: (c.y ?? 0) - (p.y ?? 0) };
  };

  function build(node, parent = null, parentFlex = true) {
    if (!isVisible(node)) return null; // §3 visibility — shared with the census walker

    // Position: absolute within the parent when the parent has NO auto-layout (children pinned to
    // Figma coordinates) OR the node is explicitly ABSOLUTE-positioned. Figma's own geometry — exact.
    const absolute = parent && (!parentFlex || node.layoutPositioning === 'ABSOLUTE')
      ? offsetIn(parent, node) : undefined;
    // Rotation (Figma degrees, counter-clockwise-positive) → the emitter negates for CSS.
    let rotation = Math.abs(node.rotation ?? 0) > 0.001 ? node.rotation : undefined;
    // Reflection (C11 transform law, narrow slice): a PURE mirror matrix ([[-1,0],[0,1]] or
    // [[1,0],[0,-1]]) reports rotation=π over REST, but a mirror is NOT a 180° rotation — a
    // 180° turn flips BOTH axes and inverts vertical gradients (live-hit: Spec-Pill top-light
    // rendered bottom-up). Detect the pure mirror and emit scaleX/Y(-1); combos stay R4.
    let mirror;
    const rt = node.relativeTransform;
    const near = (v, t) => Math.abs(v - t) < 0.001;
    if (rt && near(rt[0][1], 0) && near(rt[1][0], 0)) {
      if (near(rt[0][0], -1) && near(rt[1][1], 1)) { mirror = 'x'; rotation = undefined; }
      else if (near(rt[0][0], 1) && near(rt[1][1], -1)) { mirror = 'y'; rotation = undefined; }
    }

    // C5 fixture finding — rotated geometry: absoluteBoundingBox is the ROTATED AABB, not the
    // intrinsic box. Recover the true size (solve w·c+h·s=W, w·s+h·c=H) and position by CENTER
    // (rotation preserves the center; CSS rotates about the center by default). Near 45° the
    // system is singular (|cos2θ| small) → fall back to the AABB.
    let trueSize = null;
    if (rotation && node.absoluteBoundingBox) {
      const c = Math.abs(Math.cos(rotation)), sn = Math.abs(Math.sin(rotation));
      const det = c * c - sn * sn;
      const { width: W, height: H } = node.absoluteBoundingBox;
      if (Math.abs(det) > 0.05) trueSize = { w: (W * c - H * sn) / det, h: (H * c - W * sn) / det };
    }
    // svg exports render the node in LOCAL space (live-proven: the +90°-rotated eye exports
    // upright) — so svg-kind nodes DO take their own rotation/mirror as css transforms,
    // exactly like elements.
    if (absolute && trueSize) {
      const b = bboxOf(node);
      absolute.x += (b.width - trueSize.w) / 2;
      absolute.y += (b.height - trueSize.h) / 2;
    }

    // Dan's ruler law, part 2: a zero-extent LINE vector (Figma lines have 0 width or height —
    // the stroke IS the paint) converts as a token-driven ELEMENT, not an svg: an exported svg
    // carries the stroke as intrinsic size (~2px), inflating flow layout (live-hit: the 320px
    // ruler rendered 402). Box = strokeWeight × length, background = stroke colour, rounded caps
    // via radius — every value keeps its variable binding.
    {
      const b = bboxOf(node);
      const zeroW = Math.round(b.width * 100) === 0, zeroH = Math.round(b.height * 100) === 0;
      const st0 = (node.strokes ?? []).filter((s) => s.visible !== false)[0];
      if (VEC_TYPES.has(node.type) && (zeroW !== zeroH) && st0?.type === 'SOLID') {
        const wRef = varRef(varMap, node.boundVariables?.strokeWeight);
        // a Figma LINE's LENGTH always lives on its local x-axis (size.y is the zero thickness —
        // often bound to a "none" token); a vertical tick is a 90°-rotated line, so its AABB
        // orientation already encodes the rotation — the box is emitted upright, rotation dropped.
        const sizeRef = varRef(varMap, node.boundVariables?.size?.x);
        const weight = { value: node.strokeWeight ?? 1, ref: wRef };
        const length = { value: zeroW ? b.height : b.width, ref: sizeRef };
        return {
          id: node.id, name: node.name, kind: 'element', figmaType: node.type,
          layout: null, absolute, rotation: undefined,
          // ruler law part 3 (live-hit: 41 ticks re-inflated the 320px ruler to 402): Figma lays
          // the line out by its ZERO-extent bbox, but the emitted strokeWeight-wide box occupies
          // layout — negative half-weight margins on the zero axis restore layout equivalence.
          lineMargin: { axis: zeroW ? 'inline' : 'block', weight },
          sizing: { h: 'FIXED', v: 'FIXED', width: zeroW ? weight : length, height: zeroW ? length : weight },
          style: {
            fills: { backgroundColor: { color: colorOf(st0.color, st0.opacity ?? 1), ref: varRef(varMap, node.boundVariables?.strokes?.[0]) }, layers: [] },
            strokes: undefined, effects: undefined,
            radius: node.strokeCap === 'ROUND' ? { all: 999 } : undefined,
            opacity: node.opacity !== undefined && node.opacity !== 1 ? Math.round(node.opacity * 10000) / 10000 : undefined,
          },
          children: [], hasAbsoluteChild: false,
        };
      }
    }

    // vector subtree root (§3.5 pin): one svg; internals stay raw for the emitter's svg pass
    if (isVectorish(node)) {
      const b = bboxOf(node);
      // C7.3 (KAI-9371): token-aware svg — when EVERY bound solid paint in the subtree resolves
      // to ONE css token, its hexes rewrite to currentColor and the class carries
      // `color: var(--token)` (JSX-safe: no style attrs in the body). Multiple distinct tokens
      // in one svg → skip, stays ledgered. Derived here (varMap lives here), consumed by emit.
      const hexOf = (c) => '#' + [c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
      const vars = new Set(); const hexes = new Set(); let colorBindings = 0;
      (function scanPaints(x, depth) {
        if (depth > 0) {
          for (const key of ['fills', 'strokes']) {
            const paints = x[key] ?? []; const bound = x.boundVariables?.[key];
            for (let i = 0; i < paints.length; i++) {
              const p = paints[i];
              if (p.visible === false || p.type !== 'SOLID') continue;
              const ref = varRef(varMap, Array.isArray(bound) ? bound[i] : undefined);
              if (ref?.cssVar) { vars.add(ref.cssVar); hexes.add(hexOf(p.color)); colorBindings++; }
            }
          }
        }
        (x.children ?? []).forEach((c) => scanPaints(c, depth + 1));
      })(node, 0);
      const svgTokenColor = vars.size === 1 ? { cssVar: [...vars][0], hexes: [...hexes].sort(), bindings: colorBindings } : undefined;
      return {
        id: node.id, name: node.name, kind: 'svg',
        bounds: { width: trueSize?.w ?? b.width, height: trueSize?.h ?? b.height },
        sizing: sizingOf(node, varMap, trueSize), absolute, rotation, mirror,
        svgSource: node, // raw subtree — emitter exports faithful svg (C1.3)
        svgTokenColor,
        children: [],
      };
    }

    if (node.type === 'TEXT') {
      return {
        id: node.id, name: node.name, kind: 'text',
        text: textOf(node, varMap, refusals),
        style: baseStyle(node), sizing: sizingOf(node, varMap, trueSize), absolute, rotation, mirror,
        children: [],
      };
    }

    // container: FRAME / INSTANCE (flattened) / GROUP / RECTANGLE. Auto-layout → flexbox;
    // otherwise the container is a positioning context and its children pin absolutely (above).
    // NEVER refused — structure is a 1:1 layer→DOM walk, geometry is math.
    const layout = layoutOf(node, varMap);
    const flex = !!layout;
    const kids = (node.children ?? []).map((c) => build(c, node, flex)).filter(Boolean);

    const ir = {
      id: node.id, name: node.name, kind: 'element',
      figmaType: node.type,
      layout,
      sizing: sizingOf(node, varMap, trueSize),
      style: baseStyle(node),
      absolute, rotation, mirror,
      hasAbsoluteChild: kids.some((k) => k.absolute),
      children: kids,
    };

    // two-pass sizing (§3.2): bottom-up child sizing done (recursion); now the hoist decision —
    // align-items:stretch on the container ONLY when every flowed child is cross-axis FILL
    if (layout && kids.length > 0) {
      const cross = layout.direction === 'row' ? 'v' : 'h';
      const real = kids.filter((k) => !k.absolute);
      layout.stretchHoist = real.length > 0 && real.every((k) => k.sizing?.[cross] === 'FILL');

      // Parent-layout-derived child flags — derived HERE, the single source (lead C3 F2): the
      // reverse gate reads these, and `check` builds the IR without running emit, so any flag
      // assigned during emit makes check-IR ≠ convert-IR and false-fails reverse on clean output
      // (this exact class broke twice: C2 varMap-null, C3 emit-mutated isFlexChild).
      const main = layout.direction === 'row' ? 'h' : 'v';
      let flowedIdx = 0;
      for (const k of kids) {
        k.isFlexChild = !k.absolute; // Figma never shrinks children → emit pins flex-shrink: 0
        // C5 fixture finding — negative itemSpacing (overlap stacks): CSS gap can't be negative,
        // so children after the first flowed one carry a negative main-axis margin instead.
        if (!k.absolute && (layout.gap?.value ?? 0) < 0) {
          if (flowedIdx > 0) k.negMargin = { axis: layout.direction === 'row' ? 'left' : 'top', value: layout.gap.value };
          flowedIdx++;
        }
        if (k.kind === 'element' || k.kind === 'text') {
          k.fillMain = !k.absolute && k.sizing?.[main] === 'FILL';
          k.stretchCross = !k.absolute && k.sizing?.[cross] === 'FILL' && !layout.stretchHoist;
          k.textMinWidth = k.fillMain && (k.kind === 'text' || k.children.some((c) => c.kind === 'text'));
        }
      }
    }
    return ir;
  }

  function sizingOf(node, varMap = null, trueSize = null) {
    const b = bboxOf(node);
    return {
      h: node.layoutSizingHorizontal ?? 'FIXED', v: node.layoutSizingVertical ?? 'FIXED',
      width: { value: trueSize?.w ?? b.width, ref: varRef(varMap, node.boundVariables?.size?.x) },
      height: { value: trueSize?.h ?? b.height, ref: varRef(varMap, node.boundVariables?.size?.y) },
      maxWidth: node.maxWidth != null || node.boundVariables?.maxWidth
        ? { value: node.maxWidth, ref: varRef(varMap, node.boundVariables?.maxWidth) }
        : undefined,
    };
  }

  function baseStyle(node) {
    return {
      fills: fillsOf(node, varMap, refusals),
      strokes: strokesOf(node, varMap, refusals),
      effects: effectsOf(node, refusals),
      radius: radiusOf(node, varMap),
      opacity: node.opacity !== undefined && node.opacity !== 1 ? Math.round(node.opacity * 10000) / 10000 : undefined, // §3.5 F3.1 (4dp — Figma floats carry noise like 0.800000011920929)
      blendMode: node.blendMode && node.blendMode !== 'PASS_THROUGH' && node.blendMode !== 'NORMAL'
        ? node.blendMode : undefined,
    };
  }

  const root = build(rawDoc);
  // Root = viewport (C6, Dan): a direct child whose width Figma caps (max-width) stops tracking
  // the viewport once it exceeds the cap — Figma has no opinion about the leftover space (the
  // frame IS the viewport there), so the law is: capped root children CENTER in the viewport
  // (margin-inline: auto — a no-op at/below the design width, centered beyond it). Derived here,
  // never in emit (check-IR == convert-IR law).
  for (const k of root.children ?? []) if (k.sizing?.maxWidth) k.centerViewport = true;
  return { root, refusals };
}
