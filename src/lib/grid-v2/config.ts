/**
 * Grid Lab v2 — EngineConfig (P0)
 *
 * Every focal value the engine consumes lives here as DATA (`config.data.json`), never as a
 * numeric literal in the engine path (law §7, §10.6). The engine is a pure `fn(request, config)`
 * and never reads storage: `defaultConfig` is a build-time import, and the admin control layer
 * (P6) loads/saves overrides through its own persistence adapter and calls `resolveConfig()` to
 * produce the config passed per solve. Changing any field re-derives every dependent result.
 */
import configData from './config.data.json';

// ── Vocabulary ──────────────────────────────────────────────────────────────
export type ShapeFamily =
  | 'square'
  | 'rectangle'
  | 'circle'
  | 'triangle'
  | 'diamond'
  | 'pill'
  | 'ngon'
  | 'freeform';

export type Pattern = 'straight' | 'diamond' | 'dice';
export type Mode = 'standard' | 'light';
export type JoinStyle = 'miter' | 'round';
export type AttachmentMode = 'magnetic' | 'twin-fix' | 'velcro';
export type GarmentLayout = '48-straight' | '96-straight' | '96-dice';

// ── The released configuration ────────────────────────────────────────────────
export interface EngineConfig {
  /** Config identity; binds a precomputed catalogue to the values it was derived under (law §8.3). */
  version: string;

  /** The lattice (law §1). */
  lattice: {
    /** Base pitch — 48mm. Nothing ever sits between lattice points. */
    basePitchMM: number;
    /** Released pitch tiers; 96 is exactly two base steps (law §1.1). */
    pitchSetMM: number[];
  };

  /** Padding & margin (law §2). */
  padding: {
    /** Safe magnet placement radius from the magnet centre (law §2.2). */
    radiusMM: number;
    /** Auto-grow outward margin band; artwork is never scaled (v1 §2.7). */
    marginAllowanceMM: number;
  };

  /** Frame — a separate additive buffer OUTSIDE the derived size, never baked in (law §2.3). */
  frame: {
    defaultMM: number;
  };

  /** Publication rounding — sizes publish on the even millimetre, rounded up (law §3.4, §8.1). */
  rounding: {
    quantumMM: number;
  };

  /** Size bounds. */
  bounds: {
    /** Released size ceiling — garment bound, a released input not a constant (law §11.2). */
    ceilingMM: number;
    /** Geometric/preset ladders start at two anchors (v1 §3.10). */
    minAnchorsGeometric: number;
    /** Single anchor stays for freeform/AI (v1 §3.10a). */
    minAnchorsFreeform: number;
  };

  /** Magnet hardware & focal-8 assignment (law §5.7, §11.1). */
  magnets: {
    /** Released hardware set (mm). */
    setMM: number[];
    /** The larger magnet placed at radial extremes — never all-8 (law §5.7). */
    extremeMM: number;
    /** The default interior magnet. */
    interiorMM: number;
  };

  /** Per-family offset join: miter (sharp) for polygons, round for curved families (law §3.3). */
  joins: Record<ShapeFamily, JoinStyle>;

  /** Pattern bases (law §4.3a). */
  patterns: {
    available: Pattern[];
    /** Dice/quincunx is legal ONLY at this pitch (law §4.3a). */
    dicePitchMM: number;
    /** The straight grid is the default for every shape and source (law §1.2). */
    default: Pattern;
  };

  /** Curve tessellation budget — a rendering/production resolution, never the shape definition (law §9.2b, F6). */
  tessellation: {
    /** Steps for the analytic circle/ellipse. */
    circleSteps: number;
    /** Arc tolerance for round joins. */
    arcToleranceMM: number;
  };

  /** Freeform registration — a released input, no search loops (law §4.9 → config). */
  registration: {
    default: 'centroid';
  };

  /** Publication rules — released, not baked (law §8, §3.12–3.15, §4.3). */
  publication: {
    /** Light is the main product mode; Standard is admin-facing (law §4.3). */
    defaultMode: Mode;
    /** Whether the single-magnet (ONE) construction is offered on a panel (law §8.3). */
    offerONE: boolean;
    /** Families that publish via a slider; all others get standardised tiers (law §3.14). */
    sliderFamilies: ShapeFamily[];
    /** Launch-time hiding of untested sizes — a released rule, never deletion (law §3.12). */
    hideUntestedSizes: boolean;
  };

  /** Attachment ↔ grid compatibility (law §5.1a, §6.2). */
  attachment: {
    default: AttachmentMode;
    /** The garment's current canonical layout (law §6.2). */
    garmentCanon: GarmentLayout;
    /**
     * Which garment layouts each attachment mode holds on (law §5.1a).
     * magnetic = 48-straight OR 96-dice (via midpoints), NOT 96-straight; twin-fix/velcro are free.
     */
    compatibility: Record<AttachmentMode, GarmentLayout[]>;
  };
}

// ── Default (released) config, imported as build-time data ────────────────────
export const defaultConfig: EngineConfig = configData as EngineConfig;

// ── Overrides ─────────────────────────────────────────────────────────────────
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[]
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function deepMerge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(patch)) return (patch as T) ?? base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const key of Object.keys(patch)) {
    const pv = (patch as Record<string, unknown>)[key];
    const bv = out[key];
    // Plain objects merge recursively; arrays and primitives replace wholesale.
    out[key] = isPlainObject(pv) && isPlainObject(bv) ? deepMerge(bv, pv) : pv;
  }
  return out as T;
}

/**
 * Produce the config for a solve by deep-merging admin overrides onto a base config.
 * Pure: never reads storage, never mutates its inputs. This is the mechanism by which every
 * focal value is a live input — the admin layer supplies `overrides`, the engine gets a config.
 */
export function resolveConfig(
  overrides?: DeepPartial<EngineConfig>,
  base: EngineConfig = defaultConfig,
): EngineConfig {
  if (!overrides) return deepMerge(base, {}); // fresh clone; never hand out the frozen default
  return deepMerge(base, overrides);
}

// ── Config identity hash ──────────────────────────────────────────────────────
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (isPlainObject(v)) {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}

/**
 * Deterministic content hash (FNV-1a over canonical JSON). Binds a precomputed catalogue to the
 * exact config it was derived under (law §8.3, §7.1) — a live derivation must match the hash to
 * ship a catalogue.
 */
export function configHash(config: EngineConfig): string {
  const s = canonical(config);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
