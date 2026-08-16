import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { cpus, platform, release } from "node:os";
import { performance } from "node:perf_hooks";
import { gzipSync } from "node:zlib";
import { build } from "esbuild";
import {
  Clipper,
  EndType,
  JoinType,
  PointInPolygonResult,
  type Path64,
} from "@countertype/clipper2-ts";

import {
  distanceToPreparedContour,
  pointInPreparedContour,
  prepareExactContour,
} from "../src/lib/grid-engine/compute/grid-prepared";
import type { Contour, Pt } from "../src/lib/grid-engine/compute/types";

const SCALE = 10_000;
const RADIUS_MM = 12;
const ENVELOPE_MM = 0.0025;
const ARC_TOLERANCE_MM = 0.00025;
const PROJECTION_MM = Math.SQRT2 / (2 * SCALE);
const OFFSET_ERROR_MM = PROJECTION_MM * 2 + ARC_TOLERANCE_MM;
const OFFSET_GUARD_MM = OFFSET_ERROR_MM;
// Input projection, round-arc sagitta and output projection bound the offset error. Eroding by
// r + error makes the returned area a subset of C_r; 2 * error <= envelope makes it contain
// C_(r+envelope). Exact witnesses carry legal sets whose dimension makes area output disappear.
const WARM_RUNS = 3;
const SINGLE_SIZE_HARD_REJECTION_MS = 20;
const PAYLOAD_HARD_REJECTION_BYTES = 500 * 1024;

type CanonFixture = { outline: Pt[]; box: { w: number; h: number } };

const rectangle = (width: number, height: number): Contour => ({
  outer: {
    pts: [
      [0, 0],
      [width, 0],
      [width, height],
      [0, height],
    ],
  },
  holes: [],
});

const splitSafeRegion: Contour = {
  outer: {
    pts: [
      [0, 0],
      [40, 0],
      [40, 18],
      [80, 18],
      [80, 0],
      [120, 0],
      [120, 40],
      [80, 40],
      [80, 22],
      [40, 22],
      [40, 40],
      [0, 40],
    ],
  },
  holes: [],
};

const concaveNotch: Contour = {
  outer: {
    pts: [
      [0, 0],
      [80, 0],
      [80, 80],
      [48, 80],
      [48, 32],
      [32, 32],
      [32, 80],
      [0, 80],
    ],
  },
  holes: [],
};

function hash(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function round(value: number, digits = 6): number {
  return Number(value.toFixed(digits));
}

function discLegal(contour: Contour, point: Pt, radiusMM = RADIUS_MM): boolean {
  const prepared = prepareExactContour(contour);
  return (
    pointInPreparedContour(point, prepared) &&
    distanceToPreparedContour(point, prepared) >= radiusMM
  );
}

function canonicalPath(path: Path64): Path64 {
  const least = path.reduce((best, point, index) => {
    const current = path[best];
    return point.x < current.x || (point.x === current.x && point.y < current.y)
      ? index
      : best;
  }, 0);
  const forward = path.map((_, index) => path[(least + index) % path.length]);
  const reverse = path.map(
    (_, index) => path[(least - index + path.length) % path.length],
  );
  return JSON.stringify(forward) <= JSON.stringify(reverse) ? forward : reverse;
}

function areaRepresentation(contour: Contour, radiusMM = RADIUS_MM) {
  const flat = contour.outer.pts.flatMap(([x, y]) => [
    Math.round(x * SCALE),
    Math.round(y * SCALE),
  ]);
  const paths = Clipper.inflatePaths(
    [Clipper.makePath(flat)],
    -(radiusMM + OFFSET_GUARD_MM) * SCALE,
    JoinType.Round,
    EndType.Polygon,
    2,
    ARC_TOLERANCE_MM * SCALE,
  )
    .map(canonicalPath)
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return {
    paths,
    summary: paths.map((path) => ({
      areaMM2: round(Math.abs(Clipper.area(path)) / (SCALE * SCALE)),
      vertices: path.length,
      geometryHash: hash(JSON.stringify(path)),
    })),
  };
}

function inApproximation(point: Pt, paths: Path64[]): boolean {
  const scaled = {
    x: Math.round(point[0] * SCALE),
    y: Math.round(point[1] * SCALE),
  };
  return paths.some(
    (path) =>
      Clipper.pointInPolygon(scaled, path) !== PointInPolygonResult.IsOutside,
  );
}

function assertSampledSandwich(contour: Contour, paths: Path64[]): void {
  const prepared = prepareExactContour(contour);
  const { minX, minY, maxX, maxY } = prepared.bbox;
  for (let x = Math.ceil(minX); x <= Math.floor(maxX); x += 1) {
    for (let y = Math.ceil(minY); y <= Math.floor(maxY); y += 1) {
      const point: Pt = [x, y];
      const inside = pointInPreparedContour(point, prepared);
      const clearance = inside
        ? distanceToPreparedContour(point, prepared)
        : -Infinity;
      const represented = inApproximation(point, paths);
      if (represented)
        assert(clearance >= RADIUS_MM, `unsafe approximation point ${point}`);
      if (clearance >= RADIUS_MM + ENVELOPE_MM) {
        assert(represented, `omitted point beyond envelope ${point}`);
      }
    }
  }
}

function syntheticEvidence() {
  const split = areaRepresentation(splitSafeRegion);
  const zero = areaRepresentation(rectangle(80, 24));
  const isolated = areaRepresentation(rectangle(24, 24));
  const tooNarrow = areaRepresentation(rectangle(80, 23.99));
  const starved = areaRepresentation(rectangle(80, 24.0005));
  const hairline = areaRepresentation(rectangle(80, 24.01));

  assert.equal(discLegal(rectangle(80, 80), [12, 40]), true);
  assert.equal(discLegal(rectangle(80, 80), [11.99, 40]), false);
  assert.equal(split.paths.length, 2);
  assert.equal(zero.paths.length, 0);
  assert.equal(isolated.paths.length, 0);
  assert.equal(tooNarrow.paths.length, 0);
  assert.equal(starved.paths.length, 0);
  assert.equal(hairline.paths.length, 1);
  assert.equal(discLegal(rectangle(80, 24), [12, 12]), true);
  assert.equal(discLegal(rectangle(80, 24), [68, 12]), true);
  assert.equal(discLegal(rectangle(24, 24), [12, 12]), true);
  assert.equal(discLegal(rectangle(80, 24.0005), [40, 12.00025]), true);
  assert.equal(
    pointInPreparedContour([30, 40], prepareExactContour(concaveNotch)),
    true,
  );
  assert.equal(discLegal(concaveNotch, [30, 40]), false);
  assertSampledSandwich(splitSafeRegion, split.paths);
  assertSampledSandwich(rectangle(80, 24.01), hairline.paths);

  return {
    tangency: { pointMM: [12, 40], legal: true },
    oneQuantumIntrusion: {
      pointMM: [11.99, 40],
      legal: false,
      quantumMM: 0.01,
    },
    splitSafeRegions: { areaComponents: split.summary },
    zeroWidthCorridor: {
      areaComponents: zero.summary,
      exactWitness: { kind: "segment", fromMM: [12, 12], toMM: [68, 12] },
      status: "FEASIBLE_WITNESS",
    },
    isolatedLegalWitness: {
      areaComponents: isolated.summary,
      exactWitness: { kind: "point", pointMM: [12, 12] },
      status: "FEASIBLE_WITNESS",
    },
    justTooNarrow: {
      areaComponents: tooNarrow.summary,
      widthMM: 23.99,
      proof: "bbox width < 2r",
      status: "INFEASIBLE_CERTIFIED",
    },
    concaveNotchFalseSeat: { pointMM: [30, 40], inside: true, legal: false },
    starvedRefinement: {
      areaComponents: starved.summary,
      exactWitness: { kind: "point", pointMM: [40, 12.00025] },
      status: "INDETERMINATE_WITHIN_TOLERANCE",
    },
    hairlineFeasibility: { widthMM: 24.01, areaComponents: hairline.summary },
  };
}

function realContours(): Array<[string, Contour]> {
  const fixtures = JSON.parse(
    readFileSync(
      "src/lib/grid-engine/__tests__/__fixtures-canon-shapes.json",
      "utf8",
    ),
  ) as Record<string, CanonFixture>;
  return Object.entries(fixtures).map(([name, fixture]) => [
    name,
    {
      outer: {
        pts: fixture.outline.map(([x, y]) => [
          x * fixture.box.w,
          y * fixture.box.h,
        ]),
      },
      holes: [],
    },
  ]);
}

function runCorpus() {
  const started = performance.now();
  const synthetic = syntheticEvidence();
  const real = realContours().map(([name, contour]) => {
    const itemStarted = performance.now();
    const prepared = prepareExactContour(contour);
    assert.equal(prepared.segments.length, contour.outer.pts.length);
    const area = areaRepresentation(contour);
    const centre: Pt = [
      (prepared.bbox.minX + prepared.bbox.maxX) / 2,
      (prepared.bbox.minY + prepared.bbox.maxY) / 2,
    ];
    pointInPreparedContour(centre, prepared);
    distanceToPreparedContour(centre, prepared);
    return {
      name,
      inputVertices: contour.outer.pts.length,
      outputComponents: area.paths.length,
      outputVertices: area.paths.reduce((sum, path) => sum + path.length, 0),
      geometryHash: hash(JSON.stringify(area.paths)),
      runtimeMs: performance.now() - itemStarted,
    };
  });
  return {
    canonical: {
      approximation: {
        scalePerMM: SCALE,
        inputProjectionMM: round(PROJECTION_MM, 9),
        outputProjectionMM: round(PROJECTION_MM, 9),
        arcSagittaMM: ARC_TOLERANCE_MM,
        errorMM: round(OFFSET_ERROR_MM, 9),
        radiusGuardMM: round(OFFSET_GUARD_MM, 9),
        completeMarginMM: round(OFFSET_GUARD_MM + OFFSET_ERROR_MM, 9),
        requestedEnvelopeMM: ENVELOPE_MM,
        relation: "C_(r+epsilon)(P) subset approximation subset C_r(P)",
      },
      synthetic,
      realContours: real.map((item) => ({
        name: item.name,
        inputVertices: item.inputVertices,
        outputComponents: item.outputComponents,
        outputVertices: item.outputVertices,
        geometryHash: item.geometryHash,
      })),
    },
    realTimingsMs: Object.fromEntries(
      real.map(({ name, runtimeMs }) => [name, runtimeMs]),
    ),
    totalMs: performance.now() - started,
  };
}

async function reproducibleBundle() {
  const entry = `
    import { Clipper, EndType, JoinType } from '@countertype/clipper2-ts'
    export { prepareExactContour, pointInPreparedContour, distanceToPreparedContour }
      from './src/lib/grid-engine/compute/grid-prepared.ts'
    export const inset = (paths, delta, arcTolerance) =>
      Clipper.inflatePaths(paths, delta, JoinType.Round, EndType.Polygon, 2, arcTolerance)
  `;
  const compile = async () =>
    (
      await build({
        stdin: { contents: entry, loader: "ts", resolveDir: process.cwd() },
        bundle: true,
        format: "esm",
        minify: true,
        platform: "browser",
        target: "es2022",
        treeShaking: true,
        write: false,
      })
    ).outputFiles[0].contents;
  const first = await compile();
  const second = await compile();
  assert.equal(hash(first), hash(second));
  return {
    sha256: hash(first),
    rawBytes: first.length,
    gzipBytes: gzipSync(first).length,
  };
}

function cppWasmAvailability() {
  const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .trim()
    .split("\n");
  const cppSources = tracked.filter((path) =>
    /(?:CMakeLists\.txt|\.(?:c|cc|cpp|cxx))$/i.test(path),
  );
  const buildRecipes = tracked.filter((path) => {
    if (path === "scripts/probe-grid-backend.ts") return false;
    if (!existsSync(path)) return false;
    if (!/\.(?:json|md|mjs|js|ts|sh|ya?ml)$/i.test(path)) return false;
    const text = readFileSync(path, "utf8").replace(/\s+/g, " ");
    return /(?:clipper2.{0,160}(?:emcc|emscripten|wasm32)|(?:emcc|emscripten|wasm32).{0,160}clipper2)/i.test(
      text,
    );
  });
  return {
    reproducible: cppSources.length > 0 && buildRecipes.length > 0,
    cppSources,
    clipperWasmBuildRecipes: buildRecipes,
  };
}

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil((sorted.length - 1) * fraction)];
}

async function main() {
  assert(OFFSET_GUARD_MM >= OFFSET_ERROR_MM);
  assert(OFFSET_GUARD_MM + OFFSET_ERROR_MM <= ENVELOPE_MM);
  if (typeof global.gc !== "function") {
    throw new Error("run the probe with node --expose-gc");
  }
  const collectGarbage = global.gc;

  collectGarbage();
  const heapBefore = process.memoryUsage().heapUsed;
  const runs: ReturnType<typeof runCorpus>[] = [];
  const heapAfterRunBytes: number[] = [];
  for (let index = 0; index < WARM_RUNS + 1; index += 1) {
    runs.push(runCorpus());
    collectGarbage();
    heapAfterRunBytes.push(process.memoryUsage().heapUsed);
  }
  const heapAfter = heapAfterRunBytes.at(-1) ?? heapBefore;
  const canonicalHashes = runs.map((run) =>
    hash(JSON.stringify(run.canonical)),
  );
  assert.equal(new Set(canonicalHashes).size, 1);

  const names = Object.keys(runs[0].realTimingsMs);
  const realContourTimings = names.map((name) => {
    const warm = runs.slice(1).map((run) => run.realTimingsMs[name]);
    return {
      name,
      inputVertices: runs[0].canonical.realContours.find(
        (item) => item.name === name,
      )?.inputVertices,
      warmMedianMs: round(percentile(warm, 0.5), 3),
      warmP95Ms: round(percentile(warm, 0.95), 3),
      warmMaxMs: round(Math.max(...warm), 3),
    };
  });
  const worstWarmP95Ms = Math.max(
    ...realContourTimings.map((item) => item.warmP95Ms),
  );
  const bundle = await reproducibleBundle();
  const alternative = cppWasmAvailability();
  const memoryGrowthBytes = heapAfter - heapBefore;
  const memorySpreadBytes =
    Math.max(...heapAfterRunBytes) - Math.min(...heapAfterRunBytes);
  const retainedGrowthAfterColdBytes =
    heapAfter - (heapAfterRunBytes[0] ?? heapBefore);
  const correctnessPassed = true;
  const reproducibleBuildPassed = true;
  const performancePassed = worstWarmP95Ms <= SINGLE_SIZE_HARD_REJECTION_MS;
  const memoryPassed = retainedGrowthAfterColdBytes <= 0;
  const payloadPassed = bundle.gzipBytes <= PAYLOAD_HARD_REJECTION_BYTES;
  const typescriptPassed =
    correctnessPassed &&
    reproducibleBuildPassed &&
    performancePassed &&
    memoryPassed &&
    payloadPassed;
  const selectedBackend = typescriptPassed
    ? "typescript-clipper2-bvh-y-interval"
    : null;

  const report = {
    schema: "grid-backend-probe-t3-v1",
    verdict: selectedBackend ? "SELECTED" : "MEASURED_BLOCK",
    selectedBackend,
    candidates: {
      typescriptClipper2: {
        correctnessPassed,
        reproducibleBuildPassed,
        performancePassed,
        memoryPassed,
        payloadPassed,
        hardRejectionMs: SINGLE_SIZE_HARD_REJECTION_MS,
        payloadHardRejectionBytes: PAYLOAD_HARD_REJECTION_BYTES,
        worstWarmP95Ms: round(worstWarmP95Ms, 3),
        bundle,
      },
      cppClipper2Wasm: {
        probed: false,
        ...alternative,
        reason: alternative.reproducible
          ? "reproducible build exists and requires a separate measured run"
          : "no tracked C++ source plus Clipper2-WASM build recipe",
      },
    },
    deterministicEvidence: { runs: runs.length, sha256: canonicalHashes[0] },
    approximation: runs[0].canonical.approximation,
    namedCorpus: runs[0].canonical.synthetic,
    realContourBudget: {
      observedMaxVertices: Math.max(
        ...runs[0].canonical.realContours.map((item) => item.inputVertices),
      ),
      contours: realContourTimings,
    },
    runtime: {
      coldCorpusMs: round(runs[0].totalMs, 3),
      warmCorpusMs: {
        samples: runs.slice(1).map((run) => round(run.totalMs, 3)),
        median: round(
          percentile(
            runs.slice(1).map((run) => run.totalMs),
            0.5,
          ),
          3,
        ),
        p95: round(
          percentile(
            runs.slice(1).map((run) => run.totalMs),
            0.95,
          ),
          3,
        ),
        max: round(Math.max(...runs.slice(1).map((run) => run.totalMs)), 3),
      },
    },
    memory: {
      forcedGc: typeof global.gc === "function",
      heapBeforeBytes: heapBefore,
      heapAfterBytes: heapAfter,
      growthBytes: memoryGrowthBytes,
      retainedGrowthAfterColdBytes,
      postRunBytes: heapAfterRunBytes,
      postRunSpreadBytes: memorySpreadBytes,
    },
    environment: {
      node: process.version,
      platform: platform(),
      release: release(),
      cpu: cpus()[0]?.model ?? "unknown",
    },
  };

  assert.equal(alternative.reproducible, false);
  console.log(JSON.stringify(report, null, 2));
}

await main();
