/**
 * Grid Lab v2 — P2 · Offset adapter (the clipper seam)
 *
 * The ONE place the engine touches the geometry backend (law §10.5 — swappable). Everything
 * downstream calls `offset()` / `circle()`; nothing else imports clipper. Replacing clipper with
 * a different backend is a change to THIS file alone, against the same tests.
 *
 * Construction law §3.3: offset the skeleton outward by the padding. Join style belongs to the
 * family — miter (sharp) for polygons, round for curved families; an open axis with round ends is
 * a pill/stadium. The tessellation resolution (steps, arc tolerance, miter limit, precision) is a
 * config budget (law §9.2b, F6) — the returned `analytic` spec is the TRUE shape, never the polygon.
 */
import {
  inflatePathsD,
  ellipseD,
  getBoundsPathsD,
  makePathD,
  JoinType,
  EndType,
} from '@countertype/clipper2-ts';
import type { EngineConfig, JoinStyle } from './config';
import type { Pt } from './types';

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** The TRUE shape definition (law §9.2a/b) — carried alongside the tessellated contour. */
export type AnalyticSpec =
  | { kind: 'offset'; rings: Pt[][]; paddingMM: number; join: JoinStyle; closed: boolean }
  | { kind: 'circle'; centre: Pt; radiusMM: number };

export interface Contour {
  /** Tessellated mm rings — outer boundary first, then any holes. */
  paths: Pt[][];
  /** The analytic identity — reproducible at any tessellation budget (F6). */
  analytic: AnalyticSpec;
  /** Axis-aligned bounds of the tessellated contour (mm). */
  bounds: Bounds;
}

// ── clipper interop (kept private to this seam) ───────────────────────────────
function toClipperPath(ring: Pt[]): ReturnType<typeof makePathD> {
  return makePathD(ring.flatMap((p) => [p.x, p.y]));
}

function fromClipper(paths: { x: number; y: number }[][]): Pt[][] {
  return paths.map((path) => path.map((pt) => ({ x: pt.x, y: pt.y })));
}

function boundsOf(paths: { x: number; y: number }[][]): Bounds {
  const r = getBoundsPathsD(paths);
  return { minX: r.left, minY: r.top, maxX: r.right, maxY: r.bottom };
}

function normaliseRings(skeleton: Pt[] | Pt[][]): Pt[][] {
  return Array.isArray((skeleton as Pt[][])[0]) ? (skeleton as Pt[][]) : [skeleton as Pt[]];
}

/**
 * Offset a skeleton outward by `paddingMM` (law §3.3). A single ring or multiple rings (outer +
 * holes) may be passed; holes are preserved. `closed` false + round → pill/stadium (round caps).
 */
export function offset(
  skeleton: Pt[] | Pt[][],
  paddingMM: number,
  style: JoinStyle,
  closed: boolean,
  config: EngineConfig,
): Contour {
  const rings = normaliseRings(skeleton);
  const jt = style === 'miter' ? JoinType.Miter : JoinType.Round;
  const et = closed ? EndType.Polygon : EndType.Round; // open axis → round caps = stadium
  const { miterLimit, precision, arcToleranceMM } = config.tessellation;
  const out = inflatePathsD(
    rings.map(toClipperPath),
    paddingMM,
    jt,
    et,
    miterLimit,
    precision,
    arcToleranceMM,
  );
  const paths = fromClipper(out);
  return {
    paths,
    analytic: { kind: 'offset', rings, paddingMM, join: style, closed },
    bounds: boundsOf(out),
  };
}

/**
 * The analytic circle (law §9.2a) — a true circle of `radiusMM` about `centre`. The polygon is a
 * tessellation of `config.tessellation.circleSteps`; the analytic radius is the product truth.
 */
export function circle(centre: Pt, radiusMM: number, config: EngineConfig): Contour {
  const ring = ellipseD(centre, radiusMM, radiusMM, config.tessellation.circleSteps);
  const paths = fromClipper([ring]);
  return {
    paths,
    analytic: { kind: 'circle', centre, radiusMM },
    bounds: boundsOf([ring]),
  };
}
