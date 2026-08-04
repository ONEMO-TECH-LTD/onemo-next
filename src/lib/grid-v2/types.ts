/**
 * Grid Lab v2 — shared geometry types (used across P1–P5).
 * Pure data; mm coordinates throughout (law §9.1 — millimetres are the truth).
 */
import type { Pattern, Mode } from './config';

/** A point in millimetre space. */
export interface Pt {
  x: number;
  y: number;
}

/** A magnet-count span along the two axes of the base lattice at the chosen pitch. */
export interface GridSpan {
  nx: number;
  ny: number;
}

/** Input to the grid generator (P1). No physical size exists yet — population precedes size. */
export interface GridRequest {
  span: GridSpan;
  pitchMM: number;
  pattern: Pattern;
  mode: Mode;
}

/** Output of the grid generator (P1). */
export interface GridResult {
  /** Seated magnet centres after the mode mask (mm). */
  population: Pt[];
  /** The shape-defining extreme magnets of the population (mm). */
  vertices: Pt[];
}
