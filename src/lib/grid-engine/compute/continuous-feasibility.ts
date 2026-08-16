import {
  Clipper,
  EndType,
  FillRule,
  JoinType,
  type Path64,
  type Paths64,
} from "@countertype/clipper2-ts";
import {
  assertContourCuttable,
  MANUFACTURING_TOLERANCE_MM,
} from "./geometry-truth";
import {
  computePreparedGrid,
  type GridConfig,
  type GridResult,
} from "./grid-core";
import {
  distanceToPreparedContour,
  pointInPreparedContour,
  prepareExactContour,
  type PreparedContour,
} from "./grid-prepared";
import { placeTemplate } from "./templates";
import type { Contour, Pt } from "./types";

/** T0 8C.1: all selected registrations are published on the integer-micron lattice. */
export const CONTINUOUS_REGISTRATION_QUANTUM_MM = 0.001;
const SCALE = 1 / CONTINUOUS_REGISTRATION_QUANTUM_MM;
const PROJECTION_ERROR_MM =
  (Math.SQRT2 * CONTINUOUS_REGISTRATION_QUANTUM_MM) / 2;
const ARC_ERROR_MM = MANUFACTURING_TOLERANCE_MM / 10;
const CONSERVATIVE_GUARD_MM = MANUFACTURING_TOLERANCE_MM / 2;

export interface ContinuousFeasibilityInput {
  contour: Contour;
  permittedDomain: Contour;
  effectiveRadiusMM: number;
  offsetsMM: ReadonlyArray<Pt>;
  /** Certified symmetric boundary error already carried by the caller (zero for an exact polygon). */
  sourceApproximationErrorMM?: number;
  /** Caller-supplied candidates (for example a canonical parity origin), retained only if exact. */
  exactWitnessesMM?: ReadonlyArray<Pt>;
  /** Required to prove witnesses when `contour` is an approximation of the source geometry. */
  exactContour?: PreparedContour;
}

export interface ContinuousFeasibilityResult {
  status:
    | "PROVED_FEASIBLE"
    | "INFEASIBLE_CERTIFIED"
    | "INDETERMINATE_WITHIN_TOLERANCE";
  /** Conservative, continuous area components of F. Every returned component is legal. */
  components: ReadonlyArray<ReadonlyArray<Pt>>;
  /** Caller-supplied zero/one-dimensional candidates retained only after exact predicates pass. */
  exactWitnessesMM: ReadonlyArray<Pt>;
  envelope: {
    quantumMM: number;
    arcErrorMM: number;
    projectionErrorMM: number;
    sourceApproximationErrorMM: number;
    conservativeGuardMM: number;
    omissionBoundMM: number;
    relation: "F_INSET_BY_EPSILON_SUBSET_APPROX_SUBSET_F";
  };
}

function requireSimpleSingleContour(contour: Contour, name: string): void {
  if (contour.holes.length > 0)
    throw new RangeError(`${name} holes are outside the v1 contract.`);
  const cuttable = assertContourCuttable(contour);
  if (!cuttable.ok)
    throw new RangeError(`${name} must be one simple non-degenerate ring.`);
}

function toPath(ring: ReadonlyArray<Pt>): Path64 {
  const flat: number[] = [];
  for (const [x, y] of ring)
    flat.push(Math.round(x * SCALE), Math.round(y * SCALE));
  return Clipper.makePath(flat);
}

function inset(path: Path64, deltaMM: number): Paths64 {
  return Clipper.inflatePaths(
    [path],
    deltaMM * SCALE,
    JoinType.Round,
    EndType.Polygon,
    2,
    ARC_ERROR_MM * SCALE,
  );
}

function canonicalPaths(paths: Paths64): Paths64 {
  const canonical = paths
    .filter((path) => path.length >= 3 && Math.abs(Clipper.area(path)) > 0)
    .map((path) => {
      const points = path.map(({ x, y }) => ({ x, y }));
      let start = 0;
      for (let index = 1; index < points.length; index += 1) {
        if (
          points[index].x < points[start].x ||
          (points[index].x === points[start].x &&
            points[index].y < points[start].y)
        )
          start = index;
      }
      return [...points.slice(start), ...points.slice(0, start)];
    });
  canonical.sort((left, right) => {
    const a = left[0],
      b = right[0];
    return (
      a.x - b.x ||
      a.y - b.y ||
      Math.abs(Clipper.area(right)) - Math.abs(Clipper.area(left))
    );
  });
  return canonical;
}

function exactRegistrationIsLegal(
  registration: Pt,
  offsets: ReadonlyArray<Pt>,
  radiusMM: number,
  contour: PreparedContour,
  permitted: PreparedContour,
): boolean {
  if (
    !pointInPreparedContour(registration, permitted) &&
    distanceToPreparedContour(registration, permitted) > Number.EPSILON
  )
    return false;
  return offsets.every(([dx, dy]) => {
    const centre: Pt = [registration[0] + dx, registration[1] + dy];
    return (
      pointInPreparedContour(centre, contour) &&
      distanceToPreparedContour(centre, contour) + Number.EPSILON >= radiusMM
    );
  });
}

/**
 * Compute F = A ∩ ⋂(C_r(P) - o_i).
 *
 * Each integer projection moves a segment by at most `projectionErrorMM`; round-offset chords move by
 * at most `arcErrorMM`. Eroding every constraint by the larger fixed guard therefore gives the stated
 * conservative sandwich. Features below the 0.05mm manufacturing envelope may disappear; an empty
 * area result is consequently indeterminate unless bbox separation proves impossibility.
 */
export function computeContinuousFeasibleSet(
  input: ContinuousFeasibilityInput,
): ContinuousFeasibilityResult {
  requireSimpleSingleContour(input.contour, "Contour");
  requireSimpleSingleContour(input.permittedDomain, "Permitted domain");
  if (
    !(input.effectiveRadiusMM > 0) ||
    !Number.isFinite(input.effectiveRadiusMM)
  ) {
    throw new RangeError("Effective radius must be positive and finite.");
  }
  if (input.offsetsMM.length === 0)
    throw new RangeError("At least one pattern offset is required.");
  const sourceApproximationErrorMM = input.sourceApproximationErrorMM ?? 0;
  if (
    sourceApproximationErrorMM < 0 ||
    !Number.isFinite(sourceApproximationErrorMM)
  ) {
    throw new RangeError(
      "Source approximation error must be finite and non-negative.",
    );
  }
  if (
    sourceApproximationErrorMM > 0 &&
    (input.exactWitnessesMM?.length ?? 0) > 0 &&
    !input.exactContour
  ) {
    throw new RangeError(
      "Exact source contour is required to certify witnesses from an approximated contour.",
    );
  }
  const conservativeGuardMM =
    CONSERVATIVE_GUARD_MM + sourceApproximationErrorMM;

  const contour = prepareExactContour(input.contour);
  const permitted = prepareExactContour(input.permittedDomain);
  const xs = input.offsetsMM.map(([x]) => x);
  const ys = input.offsetsMM.map(([, y]) => y);
  const requiredWidth =
    Math.max(...xs) - Math.min(...xs) + 2 * input.effectiveRadiusMM;
  const requiredHeight =
    Math.max(...ys) - Math.min(...ys) + 2 * input.effectiveRadiusMM;
  const bbox = contour.bbox;
  const bboxImpossible =
    bbox.maxX - bbox.minX + 2 * sourceApproximationErrorMM + Number.EPSILON <
      requiredWidth ||
    bbox.maxY - bbox.minY + 2 * sourceApproximationErrorMM + Number.EPSILON <
      requiredHeight;

  let feasible = inset(
    toPath(input.permittedDomain.outer.pts),
    -CONSERVATIVE_GUARD_MM,
  );
  const safe = inset(
    toPath(input.contour.outer.pts),
    -(input.effectiveRadiusMM + conservativeGuardMM),
  );
  if (safe.length === 0) feasible = [];
  for (const [dx, dy] of input.offsetsMM) {
    if (feasible.length === 0 || safe.length === 0) break;
    const shifted = Clipper.translatePaths(
      safe,
      -Math.round(dx * SCALE),
      -Math.round(dy * SCALE),
    );
    feasible = Clipper.intersect(feasible, shifted, FillRule.NonZero);
  }
  feasible = canonicalPaths(feasible);

  const exactWitnessesMM = (input.exactWitnessesMM ?? []).filter(
    (witness, index, all) =>
      exactRegistrationIsLegal(
        witness,
        input.offsetsMM,
        input.effectiveRadiusMM,
        input.exactContour ?? contour,
        permitted,
      ) &&
      all.findIndex(([x, y]) => x === witness[0] && y === witness[1]) === index,
  );

  const status =
    feasible.length > 0 || exactWitnessesMM.length > 0
      ? "PROVED_FEASIBLE"
      : bboxImpossible
        ? "INFEASIBLE_CERTIFIED"
        : "INDETERMINATE_WITHIN_TOLERANCE";

  return {
    status,
    components: feasible.map((path) =>
      path.map(({ x, y }) => [x / SCALE, y / SCALE] as Pt),
    ),
    exactWitnessesMM,
    envelope: {
      quantumMM: CONTINUOUS_REGISTRATION_QUANTUM_MM,
      arcErrorMM: ARC_ERROR_MM,
      projectionErrorMM: PROJECTION_ERROR_MM,
      sourceApproximationErrorMM,
      conservativeGuardMM,
      omissionBoundMM: 2 * conservativeGuardMM,
      relation: "F_INSET_BY_EPSILON_SUBSET_APPROX_SUBSET_F",
    },
  };
}

export function quantiseAndValidateRegistration(
  prepared: PreparedContour,
  originMM: Pt,
  steps: ReadonlyArray<readonly [number, number]>,
  basePitchMM: number,
  config: Omit<GridConfig, "construction" | "pitchMM" | "pattern"> = {},
): { originMM: Pt; grid: GridResult } {
  if (
    !(config.paddingMM != null && config.paddingMM > 0) ||
    !Number.isFinite(config.paddingMM)
  ) {
    throw new RangeError(
      "Registration validation requires an explicit positive padding radius.",
    );
  }
  const q = (value: number) =>
    Math.round(value / CONTINUOUS_REGISTRATION_QUANTUM_MM) *
    CONTINUOUS_REGISTRATION_QUANTUM_MM;
  const origin: Pt = [q(originMM[0]), q(originMM[1])];
  const construction = placeTemplate(origin, steps, basePitchMM);
  const paddingMM = config.paddingMM;
  for (const [across, down] of construction.population) {
    const point: Pt = [
      origin[0] +
        across * construction.basisMM[0][0] +
        down * construction.basisMM[1][0],
      origin[1] +
        across * construction.basisMM[0][1] +
        down * construction.basisMM[1][1],
    ];
    if (
      !pointInPreparedContour(point, prepared) ||
      distanceToPreparedContour(point, prepared) + Number.EPSILON < paddingMM
    ) {
      throw new RangeError(
        "Grid construction places an anchor outside the legal padding floor.",
      );
    }
  }
  return {
    originMM: origin,
    grid: computePreparedGrid(prepared, {
      ...config,
      paddingMM,
      construction,
    }),
  };
}
