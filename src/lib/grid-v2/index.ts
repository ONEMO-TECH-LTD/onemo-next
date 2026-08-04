/**
 * Grid Lab v2 — P5 · Sealed public API
 *
 * The ONE boundary any host calls (this webapp, a Shopify backend function, the admin bench).
 * Internals (grid / offset / shape / publish) are NOT re-exported — a host consumes the engine
 * through `solveGrid` / `solveLadder` and the config surface only, never reaching internals. This
 * is the seal that kills the v1 "UI logic leak" class (law §10.2). Pure `fn(input)` — no DOM, no
 * storage; the engine is backend-portable (law §10.1) and every value crosses the API as JSON.
 */
import { generateShape, type ShapeRequest } from './shape';
import {
  sizeOf, manufacturingSpec, labelAt, publicationChannel,
  type ManufacturingSpec, type SizeMM, type Rung,
} from './publish';
import {
  resolveConfig, defaultConfig, configHash,
  type EngineConfig, type DeepPartial, type ShapeFamily, type Mode, type Pattern,
  type AttachmentMode, type GarmentLayout,
} from './config';
import type { Pt, GridSpan } from './types';
import type { Contour } from './offset';

/** The public engine request. Every focal value is either here or in `config` — nothing baked. */
export interface EngineInput {
  family: ShapeFamily;
  span: GridSpan;
  /** Defaults to the config base pitch. */
  pitchMM?: number;
  /** Defaults to the config product mode (Light). */
  mode?: Mode;
  /** Population pattern (straight/diamond/dice); defaults to the config default (straight). */
  pattern?: Pattern;
  /** The traced/AI outline (mm) — required for freeform. */
  contour?: Pt[];
  /** Corner rounding for polygon families (law §3.21). */
  cornerRadiusMM?: number;
  /** Admin overrides, deep-merged onto the released config. */
  config?: DeepPartial<EngineConfig>;
}

export interface EngineOutput {
  family: ShapeFamily;
  population: Pt[];
  /** The shape-defining magnets (corners / tips / axis / ring) — every one sits under a magnet (law §3.2). */
  vertices: Pt[];
  contour: Contour;
  /** Frameless even-mm size. */
  sizeMM: SizeMM;
  /** The full mm manufacturing specification. */
  spec: ManufacturingSpec;
}

export interface LadderRung {
  label: string;
  sizeMM: number;
  widthMM: number;
  heightMM: number;
  span: GridSpan;
}

/** Families whose size scales symmetrically (n×n); others keep the input's second dimension. */
const SYMMETRIC: ReadonlySet<ShapeFamily> = new Set(['square', 'circle', 'diamond', 'triangle']);

function toShapeRequest(input: EngineInput, config: EngineConfig): ShapeRequest {
  return {
    family: input.family,
    span: input.span,
    pitchMM: input.pitchMM ?? config.lattice.basePitchMM,
    mode: input.mode ?? config.publication.defaultMode,
    pattern: input.pattern ?? config.patterns.default,
    contour: input.contour,
    cornerRadiusMM: input.cornerRadiusMM,
  };
}

/** Resolve one shape → population, contour, frameless size, and the mm manufacturing spec. */
export function solveGrid(input: EngineInput): EngineOutput {
  const config = resolveConfig(input.config);
  const shape = generateShape(toShapeRequest(input, config), config);
  return {
    family: shape.family,
    population: shape.population,
    vertices: shape.vertices,
    contour: shape.contour,
    sizeMM: sizeOf(shape.contour, config),
    spec: manufacturingSpec(shape, config),
  };
}

/**
 * Resolve the full published size ladder for a tiered family — every rung from the minimum
 * anchors up to the released ceiling, sequentially labelled, no skips (law §3.7/§3.9/§3.14).
 * Slider families (generator/AI) have no tier ladder — call `solveGrid` per size.
 */
export function solveLadder(input: EngineInput): LadderRung[] {
  const config = resolveConfig(input.config);
  if (publicationChannel(input.family, config) === 'slider') {
    throw new Error(`solveLadder is for tiered families; '${input.family}' publishes via a slider — call solveGrid per size`);
  }
  const rungs: LadderRung[] = [];
  const maxAnchors = 64; // hard loop bound; the ceiling stops it far sooner
  // Lawful spans only — a triangle needs an odd base so its apex lands on a magnet (law §3.2);
  // the ladder must never walk a span whose skeleton has no magnet under a corner.
  const start = input.family === 'triangle' ? 3 : config.bounds.minAnchorsGeometric;
  const step = input.family === 'triangle' ? 2 : 1;
  for (let n = start; n <= maxAnchors; n += step) {
    const span: GridSpan = SYMMETRIC.has(input.family) ? { nx: n, ny: n } : { nx: n, ny: input.span.ny };
    const shape = generateShape(toShapeRequest({ ...input, span }, config), config);
    const size = sizeOf(shape.contour, config);
    const sizeMM = Math.max(size.widthMM, size.heightMM);
    if (sizeMM > config.bounds.ceilingMM) break;
    rungs.push({ label: labelAt(rungs.length), sizeMM, widthMM: size.widthMM, heightMM: size.heightMM, span });
  }
  return rungs;
}

// ── The config surface (for the admin control layer) — the only other public export ──
export { defaultConfig, resolveConfig, configHash };
export type {
  EngineConfig, DeepPartial, ManufacturingSpec, SizeMM, Rung, Contour, Pt, GridSpan,
  ShapeFamily, Mode, Pattern, AttachmentMode, GarmentLayout,
};
