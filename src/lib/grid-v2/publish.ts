/**
 * Grid Lab v2 — P4 · Publication + mm manufacturing spec
 *
 * Turns a constructed shape (P3) into published sizes and the mm manufacturing specification.
 * Size is a CONSEQUENCE of the construction (law §3.4) — even millimetre, rounded up (§8.1),
 * frameless (frame is a separate additive buffer, §2.3). Magnet hardware is assigned focal-8 at
 * the radial extremes (§5.7). Publication behaviours (no skipped sizes §3.7, labels never delete
 * §3.9, snap upward §3.15, tiers vs slider §3.14, mode switch never shrinks §4.11) and the
 * attachment↔grid compatibility filter (§5.1a) are released rules, read from config.
 */
import type { EngineConfig, ShapeFamily, AttachmentMode, GarmentLayout } from './config';
import type { Pt } from './types';
import type { Contour, AnalyticSpec } from './offset';
import type { ShapeResult } from './shape';

export interface SizeMM {
  widthMM: number;
  heightMM: number;
}

export interface MagnetSpec {
  x: number;
  y: number;
  /** Hardware diameter (mm) — focal-8 at the radial extremes, base elsewhere (law §5.7). */
  diameterMM: number;
}

export interface Rung {
  label: string;
  sizeMM: number;
}

export interface ManufacturingSpec {
  unit: 'mm';
  family: ShapeFamily;
  /** Resolved contour rings — outer first, then holes (law §9.4). */
  paths: Pt[][];
  /** The analytic identity — the true shape, not the tessellation (law §9.2a/b, F6). */
  analytic: AnalyticSpec;
  /** Frameless base size (law §2.3). */
  bboxMM: SizeMM;
  /** Frame buffer (mm); 0 = off. Added OUTSIDE the base, never baked in (law §2.3). */
  frameMM: number;
  /** Base size plus the frame buffer on every side. */
  framedBboxMM: SizeMM;
  areaMM2: number;
  paddingMM: number;
  population: Pt[];
  /** Per-magnet hardware plan (law §5.7, F5). */
  magnetPlan: MagnetSpec[];
  attachment: {
    mode: AttachmentMode;
    /** Garment layouts this attachment mode holds on (law §5.1a, F12). */
    compatibleLayouts: GarmentLayout[];
  };
}

const keyOf = (p: Pt) => `${Math.round(p.x * 1000)}:${Math.round(p.y * 1000)}`;

/** Signed area of a ring (shoelace). */
function ringArea(ring: Pt[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    a += ring[i].x * ring[j].y - ring[j].x * ring[i].y;
  }
  return Math.abs(a) / 2;
}

/** Manufacturing area — outer ring minus holes (law §9.4). */
function areaWithHoles(paths: Pt[][]): number {
  if (paths.length === 0) return 0;
  return paths.slice(1).reduce((a, hole) => a - ringArea(hole), ringArea(paths[0]));
}

/**
 * The frameless published size — the contour's dimensions rounded UP to the even millimetre
 * (law §3.4, §8.1). Frame is not included; it is a separate buffer (§2.3).
 */
export function sizeOf(contour: Contour, config: EngineConfig): SizeMM {
  const q = config.rounding.quantumMM;
  const up = (v: number) => Math.ceil(v / q) * q;
  return {
    widthMM: up(contour.bounds.maxX - contour.bounds.minX),
    heightMM: up(contour.bounds.maxY - contour.bounds.minY),
  };
}

/** Add the frame buffer on every side (law §2.3). Frame off (0) → the true base size. */
export function applyFrame(size: SizeMM, frameMM: number): SizeMM {
  return { widthMM: size.widthMM + 2 * frameMM, heightMM: size.heightMM + 2 * frameMM };
}

/**
 * Focal-8 magnet plan (law §5.7, F5): the shape-defining magnets (the radial extremes — corners,
 * tips, the circle ring) get the focal diameter; every other magnet gets the base diameter. Never
 * all-8 whenever an interior exists. Sizes are config-tuned.
 */
export function magnetPlan(population: Pt[], vertices: Pt[], config: EngineConfig): MagnetSpec[] {
  const extreme = new Set(vertices.map(keyOf));
  return population.map((p) => ({
    x: p.x,
    y: p.y,
    diameterMM: extreme.has(keyOf(p)) ? config.magnets.extremeMM : config.magnets.interiorMM,
  }));
}

/** Garment layouts an attachment mode holds on (law §5.1a, F12) — released config data. */
export function attachmentSupport(mode: AttachmentMode, config: EngineConfig): GarmentLayout[] {
  return config.attachment.compatibility[mode];
}

/** Standard shapes publish as tiers; only generator/AI families use a slider (law §3.14). */
export function publicationChannel(family: ShapeFamily, config: EngineConfig): 'tiers' | 'slider' {
  return config.publication.sliderFamilies.includes(family) ? 'slider' : 'tiers';
}

/** Whether the single-magnet (ONE) construction is offered on a panel (law §8.3). */
export function oneOffered(config: EngineConfig): boolean {
  return config.publication.offerONE;
}

/** Snapping advances UPWARD to the next rung, never the nearest (law §3.15). */
export function snapUp(sizeMM: number, rungsMM: number[]): number {
  const sorted = [...rungsMM].sort((a, b) => a - b);
  return sorted.find((r) => r >= sizeMM) ?? sorted[sorted.length - 1];
}

/** A mode switch never silently shrinks the effect (law §4.11). */
export function modeSwitchNeverShrinks(standard: SizeMM, light: SizeMM): boolean {
  return light.widthMM >= standard.widthMM && light.heightMM >= standard.heightMM;
}

const LABELS = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL'];
/** Sequential size labels — a label never deletes a size (law §3.9). */
export function labelAt(index: number): string {
  return LABELS[index] ?? `${index - 3}XL`;
}

/**
 * Assemble the published ladder from derived sizes: sorted, de-duplicated, sequentially labelled.
 * The ladder never skips a size and a label never deletes one (law §3.7, §3.9) — every distinct
 * derived size gets the next sequential label.
 */
export function catalogueLadder(sizesMM: number[]): Rung[] {
  const distinct = [...new Set(sizesMM)].sort((a, b) => a - b);
  return distinct.map((sizeMM, i) => ({ label: labelAt(i), sizeMM }));
}

/** Emit the full mm manufacturing specification for one resolved shape (law §9.3–9.7). */
export function manufacturingSpec(result: ShapeResult, config: EngineConfig): ManufacturingSpec {
  const bboxMM = sizeOf(result.contour, config);
  const frameMM = config.frame.defaultMM;
  return {
    unit: 'mm',
    family: result.family,
    paths: result.contour.paths,
    analytic: result.contour.analytic,
    bboxMM,
    frameMM,
    framedBboxMM: applyFrame(bboxMM, frameMM),
    areaMM2: Math.round(areaWithHoles(result.contour.paths) * 10) / 10,
    paddingMM: config.padding.radiusMM,
    population: result.population,
    magnetPlan: magnetPlan(result.population, result.vertices, config),
    attachment: {
      mode: config.attachment.default,
      compatibleLayouts: attachmentSupport(config.attachment.default, config),
    },
  };
}
