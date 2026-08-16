import { describe, expect, it } from "vitest";
import {
  computeContinuousFeasibleSet,
  quantiseAndValidateRegistration,
} from "../compute/continuous-feasibility";
import {
  distanceToPreparedContour,
  pointInPreparedContour,
  prepareExactContour,
} from "../compute/grid-prepared";
import type { Contour, Pt } from "../compute/types";

const rect = (
  x: number,
  y: number,
  width: number,
  height: number,
): Contour => ({
  outer: {
    pts: [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height],
    ],
  },
  holes: [],
});

const solve = (
  contour: Contour,
  radiusMM = 12,
  exactWitnessesMM?: ReadonlyArray<Pt>,
) =>
  computeContinuousFeasibleSet({
    contour,
    permittedDomain: rect(
      contour.outer.pts.reduce((value, [x]) => Math.min(value, x), Infinity),
      contour.outer.pts.reduce((value, [, y]) => Math.min(value, y), Infinity),
      contour.outer.pts.reduce((value, [x]) => Math.max(value, x), -Infinity) -
        contour.outer.pts.reduce((value, [x]) => Math.min(value, x), Infinity),
      contour.outer.pts.reduce(
        (value, [, y]) => Math.max(value, y),
        -Infinity,
      ) -
        contour.outer.pts.reduce(
          (value, [, y]) => Math.min(value, y),
          Infinity,
        ),
    ),
    effectiveRadiusMM: radiusMM,
    offsetsMM: [[0, 0]],
    exactWitnessesMM,
  });

describe("continuous safe and feasible sets", () => {
  it("keeps every positive-area component after a concave neck splits", () => {
    const dumbbell: Contour = {
      outer: {
        pts: [
          [0, 0],
          [40, 0],
          [40, 15],
          [60, 15],
          [60, 0],
          [100, 0],
          [100, 40],
          [60, 40],
          [60, 25],
          [40, 25],
          [40, 40],
          [0, 40],
        ],
      },
      holes: [],
    };
    const result = solve(dumbbell, 6);

    expect(result.status).toBe("PROVED_FEASIBLE");
    expect(result.components).toHaveLength(2);
  });

  it("intersects the permitted domain with every shifted safe-centre constraint", () => {
    const result = computeContinuousFeasibleSet({
      contour: rect(0, 0, 100, 60),
      permittedDomain: rect(5, 5, 80, 50),
      effectiveRadiusMM: 10,
      offsetsMM: [
        [0, 0],
        [48, 0],
      ],
    });

    expect(result.status).toBe("PROVED_FEASIBLE");
    expect(result.components).toHaveLength(1);
    const prepared = prepareExactContour(rect(0, 0, 100, 60));
    for (const [x, y] of result.components[0]) {
      expect(x).toBeGreaterThanOrEqual(10);
      expect(x).toBeLessThanOrEqual(42);
      expect(y).toBeGreaterThanOrEqual(10);
      expect(y).toBeLessThanOrEqual(50);
      for (const dx of [0, 48]) {
        const centre: Pt = [x + dx, y];
        expect(pointInPreparedContour(centre, prepared)).toBe(true);
        expect(
          distanceToPreparedContour(centre, prepared),
        ).toBeGreaterThanOrEqual(10);
      }
    }
    expect(result.envelope).toMatchObject({
      quantumMM: 0.001,
      omissionBoundMM: 0.05,
      relation: "F_INSET_BY_EPSILON_SUBSET_APPROX_SUBSET_F",
    });
  });

  it("retains a caller-supplied zero-dimensional witness only after exact validation", () => {
    const result = solve(rect(0, 0, 24, 24), 12, [[12, 12]]);

    expect(result.components).toEqual([]);
    expect(result.exactWitnessesMM).toEqual([[12, 12]]);
    expect(result.status).toBe("PROVED_FEASIBLE");
  });

  it("returns indeterminate when a lower-dimensional set has no supplied witness", () => {
    const result = solve(rect(0, 0, 24, 60), 12);

    expect(result.components).toEqual([]);
    expect(result.status).toBe("INDETERMINATE_WITHIN_TOLERANCE");
  });

  it("exact-validates supplied hairline and starved-area registrations", () => {
    const hairline = solve(rect(0, 0, 24.01, 60), 12, [[12.005, 30]]);
    const starved = solve(rect(0, 0, 24.04, 60), 12, [[12.02, 30]]);

    expect(hairline.exactWitnessesMM).toEqual([[12.005, 30]]);
    expect(starved.exactWitnessesMM).toEqual([[12.02, 30]]);
    expect(hairline.status).toBe("PROVED_FEASIBLE");
    expect(starved.status).toBe("PROVED_FEASIBLE");
  });

  it("certifies a just-too-narrow bbox without trusting an empty approximation", () => {
    const result = solve(rect(0, 0, 23.999, 60), 12);

    expect(result.components).toEqual([]);
    expect(result.status).toBe("INFEASIBLE_CERTIFIED");
  });

  it("accepts exact tangency and rejects exactly one micron of intrusion", () => {
    const tangent = solve(rect(0, 0, 24, 24), 12, [[12, 12]]);
    const intrusion = solve(rect(0, 0, 23.999, 24), 12, [[11.999, 12]]);

    expect(tangent.exactWitnessesMM).toEqual([[12, 12]]);
    expect(intrusion.exactWitnessesMM).toEqual([]);
    expect(intrusion.status).toBe("INFEASIBLE_CERTIFIED");
  });

  it("does not retain a concave-notch false seat", () => {
    const notch: Contour = {
      outer: {
        pts: [
          [0, 0],
          [100, 0],
          [100, 100],
          [60, 100],
          [60, 20],
          [40, 20],
          [40, 100],
          [0, 100],
        ],
      },
      holes: [],
    };
    const result = solve(notch, 10, [[50, 50]]);

    expect(result.exactWitnessesMM).toEqual([]);
  });

  it("rejects v1 holes and self-intersecting inputs", () => {
    const withHole = rect(0, 0, 100, 100);
    withHole.holes.push({ pts: rect(40, 40, 20, 20).outer.pts });
    const bowtie: Contour = {
      outer: {
        pts: [
          [0, 0],
          [40, 40],
          [0, 40],
          [40, 0],
        ],
      },
      holes: [],
    };

    expect(() => solve(withHole)).toThrow("holes are outside the v1 contract");
    expect(() => solve(bowtie)).toThrow(
      "must be one simple non-degenerate ring",
    );
  });

  it("quantises once and revalidates every disc through the construction door", () => {
    const prepared = prepareExactContour(rect(0, 0, 100, 60));
    const valid = quantiseAndValidateRegistration(
      prepared,
      [12.0004, 30.0004],
      [
        [0, 0],
        [1, 0],
      ],
      48,
      { paddingMM: 12, perimeterOnly: false },
    );

    expect(valid.originMM).toEqual([12, 30]);
    expect(valid.grid.anchors.map(({ p }) => p)).toEqual([
      [12, 30],
      [60, 30],
    ]);
    expect(() =>
      quantiseAndValidateRegistration(
        prepared,
        [11.9994, 30],
        [
          [0, 0],
          [1, 0],
        ],
        48,
        { paddingMM: 12, perimeterOnly: false },
      ),
    ).toThrow("outside the legal padding floor");
    expect(() =>
      quantiseAndValidateRegistration(prepared, [12, 30], [[0, 0]], 48),
    ).toThrow("requires an explicit positive padding radius");
  });

  it("returns byte-identical geometry for the same inputs", () => {
    const input = {
      contour: rect(0, 0, 100, 60),
      permittedDomain: rect(5, 5, 80, 50),
      effectiveRadiusMM: 10,
      offsetsMM: [
        [0, 0],
        [48, 0],
      ] as Pt[],
      sourceApproximationErrorMM: 1,
    };

    expect(computeContinuousFeasibleSet(input)).toEqual(
      computeContinuousFeasibleSet(input),
    );
  });
});
