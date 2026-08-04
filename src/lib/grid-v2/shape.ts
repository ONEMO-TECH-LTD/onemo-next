/**
 * Grid Lab v2 — P3 · ShapeGenerator (the construction law realized)
 *
 * `generateShape` dispatches by STRATEGY (polygon / rounded / freeform), never by shape name in
 * the solve (law §5.2). A family contributes only its declared construction rule — which magnets
 * are its defining vertices — and its join style (config). The solve is identical for all:
 *   population (law §3.1) → link the defining magnet centres (law §3.2) → offset by padding (law §3.3).
 * Interior magnets sit inside the hull and never change the outline or the size (law §3.4).
 */
import type { EngineConfig, ShapeFamily, RegistrationMode } from './config';
import type { GridSpan, Pt } from './types';
import { boundaryRing } from './grid';
import { offset, circle, type Contour } from './offset';

const EPS = 1e-6;
const ORIGIN: Pt = { x: 0, y: 0 };
const ptKey = (p: Pt): string => `${Math.round(p.x * 1000)}:${Math.round(p.y * 1000)}`;

export interface ShapeRequest {
  family: ShapeFamily;
  /** Magnet-count size; meaning is per-family (square n×n, rectangle nx×ny, triangle base=nx, diamond radius=nx). */
  span: GridSpan;
  pitchMM: number;
  mode: 'standard' | 'light';
  /** Required for freeform — the traced/AI outline (mm) that IS the skeleton. */
  contour?: Pt[];
  /** Corner rounding for polygon families (law §3.21/§3.22) — the user's radius; 0 = sharp. */
  cornerRadiusMM?: number;
}

export interface ShapeResult {
  family: ShapeFamily;
  /** The manufactured outline + analytic identity + bounds (P2). */
  contour: Contour;
  /** Mode-masked magnet centres for rendering (Standard = full, Light = ring). */
  population: Pt[];
  /** The shape-defining magnets (corners / tips / axis / ring). */
  vertices: Pt[];
}

// ── geometry primitives (self-contained; the engine imports no geometry lib but clipper, via P2) ──
const centroid = (pts: Pt[]): Pt => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
});

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  const cx = a.x + t * dx, cy = a.y + t * dy;
  return Math.hypot(p.x - cx, p.y - cy);
}

/** Minimum distance from a point to the polygon boundary. */
function clearanceToEdges(p: Pt, poly: Pt[]): number {
  let min = Infinity;
  for (let i = 0; i < poly.length; i++) {
    min = Math.min(min, distToSegment(p, poly[i], poly[(i + 1) % poly.length]));
  }
  return min;
}

/** Ray-cast interior test (exclusive of the boundary). */
function rayCastInside(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

const insideOrOn = (p: Pt, poly: Pt[]): boolean => rayCastInside(p, poly) || clearanceToEdges(p, poly) < EPS;

/** The registration reference the lattice is anchored to (law §4.9 → config). Deterministic. */
function registrationAnchor(poly: Pt[], mode: RegistrationMode): Pt {
  if (mode === 'bbox-center') {
    const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y);
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  }
  return centroid(poly); // 'centroid'
}

/**
 * Lattice points seated inside a polygon at pitch, with a magnet ON the `anchor`.
 * Anchoring the lattice to the shape (rather than the world origin) makes seating
 * translation-invariant — an identical outline seats identically wherever it sits (law §5.1) —
 * and centres the grid on the shape so thin/offset outlines get magnets.
 * `insetMM` = the clearance a magnet needs to be fully seated (0 for geometric shapes whose
 * corner magnets sit ON the outline; = padding for freeform's fits-it-sits, law §2.4).
 */
function seatLattice(poly: Pt[], pitchMM: number, insetMM: number, anchor: Pt): Pt[] {
  const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const i0 = Math.floor((minX - anchor.x) / pitchMM), i1 = Math.ceil((maxX - anchor.x) / pitchMM);
  const j0 = Math.floor((minY - anchor.y) / pitchMM), j1 = Math.ceil((maxY - anchor.y) / pitchMM);
  const out: Pt[] = [];
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      const p = { x: anchor.x + i * pitchMM, y: anchor.y + j * pitchMM };
      if (insetMM <= EPS ? insideOrOn(p, poly) : rayCastInside(p, poly) && clearanceToEdges(p, poly) >= insetMM - EPS) {
        out.push(p);
      }
    }
  }
  return out;
}

/**
 * Rounded-corner polygon (law §3.21/§3.22): the corner radius is the USER's — never clamped;
 * corner rounding moves the size, never the magnet count.
 *  · r ≥ padding: offset the magnet skeleton outward by r with a round join → corner radius exactly
 *    r and every magnet clears the outline by r ≥ padding. The outline GROWS with r (the flagship
 *    20mm rounded square; v1's 92-vs-88 arithmetic).
 *  · 0 < r < padding: keep the straight edges snug at padding while rounding the corners tighter —
 *    expand by (padding − r) sharp, then by r round → net padding edges, corners of radius r.
 * The analytic carries the true params (F6).
 */
function roundedPolygon(vertices: Pt[], paddingMM: number, cornerRadiusMM: number, config: EngineConfig): Contour {
  const r = Math.max(0, cornerRadiusMM);
  const rounded = r >= paddingMM
    ? offset(vertices, r, 'round', true, config) // grows: clearance = r ≥ padding, corner radius r
    : offset(offset(vertices, paddingMM - r, 'miter', true, config).paths[0], r, 'round', true, config);
  return {
    paths: rounded.paths,
    analytic: { kind: 'rounded', vertices, paddingMM, cornerRadiusMM: r },
    bounds: rounded.bounds,
  };
}

// ── family construction rules (the declared skeletons — law §3.2) ─────────────
function rectCorners(nx: number, ny: number, p: number): Pt[] {
  const w = (nx - 1) * p, h = (ny - 1) * p;
  return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
}

/** Isoceles lattice triangle: base of `base` magnets (odd → apex lands on the lattice), apex centred. */
function triangleCorners(base: number, p: number): Pt[] {
  const w = (base - 1) * p;
  return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w / 2, y: w }]; // apex height = base width → apex on lattice when base odd
}

/** Diamond (rotated square) with tip-to-centre radius `r` pitch-steps; tips on the straight lattice. */
function diamondTips(r: number, p: number): Pt[] {
  const R = r * p;
  return [{ x: R, y: 0 }, { x: 2 * R, y: R }, { x: R, y: 2 * R }, { x: 0, y: R }];
}

// ── strategies ────────────────────────────────────────────────────────────────
const POLYGON_FAMILIES: ReadonlySet<ShapeFamily> = new Set(['square', 'rectangle', 'triangle', 'diamond']);

function polygonSkeleton(family: ShapeFamily, span: GridSpan, p: number): Pt[] {
  switch (family) {
    case 'square': return rectCorners(span.nx, span.nx, p);
    case 'rectangle': return rectCorners(span.nx, span.ny, p);
    case 'triangle': return triangleCorners(span.nx, p);
    case 'diamond': return diamondTips(span.nx, p);
    default: throw new Error(`'${family}' is not a polygon family`);
  }
}

/**
 * P3 · generateShape. Pure `fn(request, config)`. Source-blind (no source parameter, law §5.1).
 * Same three-step solve for every family; only the declared skeleton rule and join differ.
 */
export function generateShape(request: ShapeRequest, config: EngineConfig): ShapeResult {
  const { family, span, pitchMM, mode } = request;
  const paddingMM = config.padding.radiusMM;
  const populationPattern = config.patterns.default; // straight is the default population lattice (law §1.2)

  // ── Freeform: the supplied contour IS the skeleton (law §3.2). Engine-native custom shapes (v1). ──
  if (family === 'freeform') {
    if (!request.contour || request.contour.length < 3) {
      throw new Error('freeform requires a contour of at least 3 points');
    }
    const outline = request.contour;
    // fits-it-sits: a magnet is seated only if it + its padding halo fit fully inside (law §2.4);
    // circles never overlap because pitch ≥ 2×padding (law §2.5). The lattice is REGISTERED to the
    // outline (config default = centroid) — deterministic, translation-invariant, no search loops (F3).
    const anchor = registrationAnchor(outline, config.registration.default);
    const seated = seatLattice(outline, pitchMM, paddingMM, anchor);
    const population = mode === 'light' ? boundaryRing(seated, populationPattern, pitchMM) : seated;
    const contour = offset(outline, paddingMM, config.joins.freeform, true, config);
    return { family, contour, population, vertices: outline };
  }

  // ── Circle: the ring magnets define a true circle through their circumscribing radius (law §3.2). ──
  if (family === 'circle') {
    const block = rectCorners(span.nx, span.ny, pitchMM);
    const c = centroid(block);
    const seated = seatLattice(block, pitchMM, 0, ORIGIN);
    const radius = Math.max(...seated.map((m) => Math.hypot(m.x - c.x, m.y - c.y))) + paddingMM;
    const ring = boundaryRing(seated, populationPattern, pitchMM);
    const population = mode === 'light' ? ring : seated;
    const contour = circle(c, radius, config);
    return { family, contour, population, vertices: ring }; // the ring magnets define the circle
  }

  // ── Pill / stadium: an open magnet axis; round-cap offset (law §3.3). ──
  if (family === 'pill') {
    const axis: Pt[] = [];
    for (let i = 0; i < span.nx; i++) axis.push({ x: i * pitchMM, y: 0 });
    const contour = offset(axis, paddingMM, config.joins.pill, false, config);
    return { family, contour, population: axis, vertices: [axis[0], axis[axis.length - 1]] };
  }

  // ── Polygon families: link the corner magnets, miter-offset by padding (law §3.2–3.3). ──
  if (POLYGON_FAMILIES.has(family)) {
    const vertices = polygonSkeleton(family, span, pitchMM);
    const seated = seatLattice(vertices, pitchMM, 0, ORIGIN); // corner magnets sit ON the hull
    // Law §3.2: every skeleton vertex passes through a magnet centre. A span that puts a corner
    // off-lattice (e.g. an even-base triangle apex) is unlawful — fail loud, never a fitted template.
    const seatedKeys = new Set(seated.map(ptKey));
    for (const v of vertices) {
      if (!seatedKeys.has(ptKey(v))) {
        throw new Error(`unlawful span for ${family}: skeleton vertex (${v.x}, ${v.y}) has no magnet centre under it (law §3.2)`);
      }
    }
    const population = mode === 'light' ? boundaryRing(seated, populationPattern, pitchMM) : seated;
    // Corner rounding is the user's radius (law §3.21/§3.22) — it moves the outline, never the
    // magnet count (population is derived above, before rounding).
    const r = request.cornerRadiusMM ?? 0;
    const contour = r > 0
      ? roundedPolygon(vertices, paddingMM, r, config)
      : offset(vertices, paddingMM, config.joins[family], true, config);
    return { family, contour, population, vertices };
  }

  throw new Error(`unsupported family '${family}' in v1`);
}
