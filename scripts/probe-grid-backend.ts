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

import { DEFAULT_LAW } from "../src/lib/grid-engine/compute/grid-core";
import {
  distanceToPreparedContour,
  pointInPreparedContour,
  prepareExactContour,
} from "../src/lib/grid-engine/compute/grid-prepared";
import type { Contour, Pt } from "../src/lib/grid-engine/compute/types";
import {
  engineOutline,
  type OutlineUV,
} from "../src/lib/grid-engine/ui/trace-cutout";

const SCALE = 1_000;
const QUANTUM_MM = 1 / SCALE;
const RADIUS_MM = 12;
const APPROXIMATION_EPSILON_MM = 0.005;
const ARC_TOLERANCE_MM = 0.00025;
const PROJECTION_MM = Math.SQRT2 / (2 * SCALE);
const OFFSET_PIPELINE_BOUND_MM = PROJECTION_MM * 2 + ARC_TOLERANCE_MM;
const OFFSET_GUARD_MM = OFFSET_PIPELINE_BOUND_MM;
const DETERMINISM_RUNS = 4;
const RUNTIME_CALIBRATION_RUNS = 12;
const RUNTIME_VALIDATION_RUNS = 40;
const SELECTED_RUNTIME_GATE_MS = 7;
const RAW_TIMING_RUNS = 3;
const MEMORY_CALIBRATION_SAMPLES = 8;
const MEMORY_BATCHES = 10;
const MEMORY_RUNS_PER_BATCH = 10;
const SELECTED_RETAINED_HEAP_GATE_BYTES = 2.25 * 1024 * 1024;
const PAYLOAD_HARD_REJECTION_BYTES = 500 * 1024;

type CanonFixture = {
  outline: OutlineUV;
  box: { w: number; h: number };
};

type Route = "production-caller" | "raw-input-contract-alternative";

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

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

function median(values: number[]): number {
  return percentile(values, 0.5);
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

function pointSegmentDistance(point: Pt, start: Pt, end: Pt): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0)
    return Math.hypot(point[0] - start[0], point[1] - start[1]);
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared,
    ),
  );
  return Math.hypot(
    point[0] - (start[0] + t * dx),
    point[1] - (start[1] + t * dy),
  );
}

function distanceToRing(point: Pt, ring: Pt[]): number {
  let best = Infinity;
  for (let index = 0; index < ring.length; index += 1) {
    best = Math.min(
      best,
      pointSegmentDistance(point, ring[index], ring[(index + 1) % ring.length]),
    );
  }
  return best;
}

function sampledBoundaryDeviation(from: Pt[], to: Pt[]): number {
  let worst = 0;
  const samplesPerSegment = 8;
  for (let index = 0; index < from.length; index += 1) {
    const start = from[index];
    const end = from[(index + 1) % from.length];
    for (let sample = 0; sample <= samplesPerSegment; sample += 1) {
      const t = sample / samplesPerSegment;
      const point: Pt = [
        start[0] + (end[0] - start[0]) * t,
        start[1] + (end[1] - start[1]) * t,
      ];
      worst = Math.max(worst, distanceToRing(point, to));
    }
  }
  return worst;
}

function sampledApproximationFalsifications() {
  const contour = rectangle(80, 80);
  const area = areaRepresentation(contour);
  const offsetsMM = [-QUANTUM_MM, 0, 0.0005, 0.001, 0.002, 0.005];
  const samples = offsetsMM.map((offsetMM) => {
    const point: Pt = [RADIUS_MM + offsetMM, 40];
    return {
      offsetFromTangencyMM: offsetMM,
      exactLegal: discLegal(contour, point),
      represented: inApproximation(point, area.paths),
    };
  });
  assert.equal(samples[0].exactLegal, false);
  assert.equal(samples[0].represented, false);
  assert.equal(samples[1].exactLegal, true);
  assert.equal(samples.at(-1)?.represented, true);
  assert.equal(
    samples.some((sample) => !sample.exactLegal && sample.represented),
    false,
  );
  return samples;
}

function syntheticEvidence() {
  const split = areaRepresentation(splitSafeRegion);
  const zero = areaRepresentation(rectangle(80, 24));
  const isolated = areaRepresentation(rectangle(24, 24));
  const tooNarrow = areaRepresentation(rectangle(80, 23.999));
  const starved = areaRepresentation(rectangle(80, 24.0005));
  const hairline = areaRepresentation(rectangle(80, 24.01));
  const tangentPoint: Pt = [12, 40];
  const intrusionPoint: Pt = [12 - QUANTUM_MM, 40];

  assert.equal(discLegal(rectangle(80, 80), tangentPoint), true);
  assert.equal(discLegal(rectangle(80, 80), intrusionPoint), false);
  assert.equal(split.paths.length, 2);
  assert.equal(zero.paths.length, 0);
  assert.equal(isolated.paths.length, 0);
  assert.equal(tooNarrow.paths.length, 0);
  assert.equal(starved.paths.length, 0);
  assert.equal(hairline.paths.length, 1);
  assert.equal(discLegal(rectangle(80, 24), [12, 12]), true);
  assert.equal(discLegal(rectangle(24, 24), [12, 12]), true);
  assert.equal(discLegal(rectangle(80, 24.0005), [40, 12.00025]), true);
  assert.equal(
    pointInPreparedContour([30, 40], prepareExactContour(concaveNotch)),
    true,
  );
  assert.equal(discLegal(concaveNotch, [30, 40]), false);

  return {
    tangency: { pointMM: tangentPoint, legal: true },
    oneQuantumIntrusion: {
      pointMM: intrusionPoint,
      legal: false,
      configuredQuantumMM: QUANTUM_MM,
    },
    splitSafeRegions: { areaComponents: split.summary },
    zeroWidthCorridor: {
      governedFeasibleSet: "segment",
      exactPredicateFindsLegalPoint: true,
      backendAreaComponents: zero.summary,
      backendWitness: null,
      backendPreserved: false,
      status: "BACKEND_DROPPED_LEGAL_SET",
    },
    isolatedLegalWitness: {
      governedFeasibleSet: "point",
      exactPredicateFindsLegalPoint: true,
      backendAreaComponents: isolated.summary,
      backendWitness: null,
      backendPreserved: false,
      status: "BACKEND_DROPPED_LEGAL_SET",
    },
    justTooNarrow: {
      backendAreaComponents: tooNarrow.summary,
      widthMM: 23.999,
      proof: "bbox width < 2r",
      status: "INFEASIBLE_CERTIFIED",
    },
    concaveNotchFalseSeat: { pointMM: [30, 40], inside: true, legal: false },
    starvedRefinement: {
      governedFeasibleSet: "positive-area thinner than the guarded inset",
      exactPredicateFindsLegalPoint: true,
      backendAreaComponents: starved.summary,
      backendWitness: null,
      backendPreserved: false,
      status: "BACKEND_DROPPED_LEGAL_SET",
    },
    hairlineFeasibility: { widthMM: 24.01, areaComponents: hairline.summary },
    subMillimetreFalsifications: sampledApproximationFalsifications(),
  };
}

function loadFixtures(): Record<string, CanonFixture> {
  return JSON.parse(
    readFileSync(
      "src/lib/grid-engine/__tests__/__fixtures-canon-shapes.json",
      "utf8",
    ),
  ) as Record<string, CanonFixture>;
}

function toContour(outline: OutlineUV, box: CanonFixture["box"]): Contour {
  return {
    outer: {
      pts: outline.map(([u, v]) => [u * box.w, v * box.h]),
    },
    holes: [],
  };
}

function executeFixture(name: string, fixture: CanonFixture, route: Route) {
  const started = performance.now();
  const callerOutline =
    route === "production-caller"
      ? engineOutline(fixture.outline)
      : fixture.outline;
  const contour = toContour(callerOutline, fixture.box);
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
    canonical: {
      name,
      inputVertices: contour.outer.pts.length,
      outputComponents: area.paths.length,
      outputVertices: area.paths.reduce((sum, path) => sum + path.length, 0),
      geometryHash: hash(JSON.stringify(area.paths)),
    },
    runtimeMs: performance.now() - started,
  };
}

function executeRealCorpus(
  fixtures: Record<string, CanonFixture>,
  route: Route,
) {
  const started = performance.now();
  const contours = Object.entries(fixtures).map(([name, fixture]) =>
    executeFixture(name, fixture, route),
  );
  return {
    canonical: contours.map((item) => item.canonical),
    contourTimingsMs: Object.fromEntries(
      contours.map((item) => [item.canonical.name, item.runtimeMs]),
    ),
    totalMs: performance.now() - started,
  };
}

function simplificationEvidence(fixtures: Record<string, CanonFixture>) {
  return Object.entries(fixtures).map(([name, fixture]) => {
    const caller = engineOutline(fixture.outline);
    const rawMM = toContour(fixture.outline, fixture.box).outer.pts;
    const callerMM = toContour(caller, fixture.box).outer.pts;
    const rawToCallerSampledMM = sampledBoundaryDeviation(rawMM, callerMM);
    const callerToRawSampledMM = sampledBoundaryDeviation(callerMM, rawMM);
    return {
      name,
      rawVertices: rawMM.length,
      callerVertices: callerMM.length,
      normalizedRdpTolerance: 1 / DEFAULT_LAW.maxRungMM,
      oneWayRdpToleranceBoundMM:
        Math.max(fixture.box.w, fixture.box.h) / DEFAULT_LAW.maxRungMM,
      sampledBoundaryDeviationMM: {
        rawToCaller: round(rawToCallerSampledMM, 9),
        callerToRaw: round(callerToRawSampledMM, 9),
        symmetricMax: round(
          Math.max(rawToCallerSampledMM, callerToRawSampledMM),
          9,
        ),
        certification: "diagnostic samples only",
      },
    };
  });
}

function summarizeTimings(
  samples: Array<ReturnType<typeof executeRealCorpus>>,
) {
  const names = Object.keys(samples[0].contourTimingsMs);
  return {
    contours: names.map((name) => {
      const values = samples.map((sample) => sample.contourTimingsMs[name]);
      return {
        name,
        samples: values.length,
        medianMs: round(median(values), 3),
        p95Ms: round(percentile(values, 0.95), 3),
        maxMs: round(Math.max(...values), 3),
      };
    }),
    corpus: {
      samples: samples.length,
      medianMs: round(median(samples.map((sample) => sample.totalMs)), 3),
      p95Ms: round(
        percentile(
          samples.map((sample) => sample.totalMs),
          0.95,
        ),
        3,
      ),
      maxMs: round(Math.max(...samples.map((sample) => sample.totalMs)), 3),
    },
  };
}

function worstContourP95(summary: ReturnType<typeof summarizeTimings>): number {
  return Math.max(...summary.contours.map((contour) => contour.p95Ms));
}

function linearSlope(xs: number[], ys: number[]): number {
  const xMean = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const yMean = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  const numerator = xs.reduce(
    (sum, x, index) => sum + (x - xMean) * (ys[index] - yMean),
    0,
  );
  const denominator = xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0);
  return denominator === 0 ? 0 : numerator / denominator;
}

function measureMemory(
  fixtures: Record<string, CanonFixture>,
  collectGarbage: () => void,
) {
  executeRealCorpus(fixtures, "production-caller");
  const calibrationSamples: number[] = [];
  for (let index = 0; index < MEMORY_CALIBRATION_SAMPLES; index += 1) {
    collectGarbage();
    calibrationSamples.push(process.memoryUsage().heapUsed);
  }
  const calibrationNoiseBytes =
    Math.max(...calibrationSamples) - Math.min(...calibrationSamples);
  const baselineBytes = median(calibrationSamples.slice(-4));
  const postBatchBytes: number[] = [];
  const cumulativeRuns: number[] = [];
  const canonicalHashes = new Set<string>();
  for (let batch = 1; batch <= MEMORY_BATCHES; batch += 1) {
    for (let run = 0; run < MEMORY_RUNS_PER_BATCH; run += 1) {
      const result = executeRealCorpus(fixtures, "production-caller");
      canonicalHashes.add(hash(JSON.stringify(result.canonical)));
    }
    collectGarbage();
    postBatchBytes.push(process.memoryUsage().heapUsed);
    cumulativeRuns.push(batch * MEMORY_RUNS_PER_BATCH);
  }
  const totalRuns = MEMORY_BATCHES * MEMORY_RUNS_PER_BATCH;
  const retainedPeakGrowthBytes = Math.max(
    0,
    Math.max(...postBatchBytes) - baselineBytes,
  );
  const observedSlopeBytesPerRun = linearSlope(cumulativeRuns, postBatchBytes);
  const selectedSlopeGateBytesPerRun =
    SELECTED_RETAINED_HEAP_GATE_BYTES / totalRuns;
  const passed =
    retainedPeakGrowthBytes <= SELECTED_RETAINED_HEAP_GATE_BYTES &&
    observedSlopeBytesPerRun <= selectedSlopeGateBytesPerRun;
  assert.equal(canonicalHashes.size, 1);
  return {
    operation:
      "100 complete production-caller corpora after one warm corpus; forced GC after each 10-corpus batch",
    calibration: {
      samples: calibrationSamples,
      observedNoiseSpreadBytes: calibrationNoiseBytes,
    },
    selectedGate: {
      retainedHeapBytes: SELECTED_RETAINED_HEAP_GATE_BYTES,
      slopeBytesPerCorpusRun: round(selectedSlopeGateBytesPerRun, 3),
      rationale:
        "the T3 selection calibration observed 550,096 bytes of forced-GC noise; four times that measurement rounded up to the next quarter MiB records a 2.25 MiB retained-heap gate, divided across 100 runs for the unbounded-growth slope gate",
    },
    validation: {
      batches: MEMORY_BATCHES,
      runsPerBatch: MEMORY_RUNS_PER_BATCH,
      totalRuns,
      baselineBytes,
      postBatchBytes,
      retainedPeakGrowthBytes,
      observedSlopeBytesPerCorpusRun: round(observedSlopeBytesPerRun, 3),
    },
    passed,
  };
}

async function reproducibleBundle() {
  const entry = `
    import { Clipper, EndType, JoinType } from '@countertype/clipper2-ts'
    export { prepareExactContour, pointInPreparedContour, distanceToPreparedContour }
      from './src/lib/grid-engine/compute/grid-prepared.ts'
    export { engineOutline } from './src/lib/grid-engine/ui/trace-cutout.ts'
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

async function main() {
  if (typeof global.gc !== "function") {
    throw new Error("run the probe with node --expose-gc");
  }
  const collectGarbage = global.gc;
  const fixtures = loadFixtures();
  const synthetic = syntheticEvidence();
  const simplification = simplificationEvidence(fixtures);

  const determinism = Array.from({ length: DETERMINISM_RUNS }, () =>
    executeRealCorpus(fixtures, "production-caller"),
  );
  const deterministicHashes = determinism.map((run) =>
    hash(JSON.stringify(run.canonical)),
  );
  assert.equal(new Set(deterministicHashes).size, 1);

  executeRealCorpus(fixtures, "production-caller");
  const runtimeCalibration = Array.from(
    { length: RUNTIME_CALIBRATION_RUNS },
    () => executeRealCorpus(fixtures, "production-caller"),
  );
  const calibrationSummary = summarizeTimings(runtimeCalibration);
  const runtimeValidation = Array.from(
    { length: RUNTIME_VALIDATION_RUNS },
    () => executeRealCorpus(fixtures, "production-caller"),
  );
  const validationSummary = summarizeTimings(runtimeValidation);
  const validationWorstP95Ms = worstContourP95(validationSummary);
  const performancePassed = validationWorstP95Ms <= SELECTED_RUNTIME_GATE_MS;

  const rawCold = executeRealCorpus(fixtures, "raw-input-contract-alternative");
  const rawWarm = Array.from({ length: RAW_TIMING_RUNS }, () =>
    executeRealCorpus(fixtures, "raw-input-contract-alternative"),
  );
  const rawTimingSummary = summarizeTimings(rawWarm);
  const memory = measureMemory(fixtures, collectGarbage);
  const bundle = await reproducibleBundle();
  const alternative = cppWasmAvailability();

  const lowerDimensionalWitnessesPassed =
    synthetic.zeroWidthCorridor.backendPreserved &&
    synthetic.isolatedLegalWitness.backendPreserved &&
    synthetic.starvedRefinement.backendPreserved;
  const approximationCertified = false;
  const basicCorpusPassed =
    synthetic.tangency.legal &&
    !synthetic.oneQuantumIntrusion.legal &&
    synthetic.splitSafeRegions.areaComponents.length === 2 &&
    !synthetic.concaveNotchFalseSeat.legal &&
    synthetic.hairlineFeasibility.areaComponents.length > 0;
  const correctnessPassed =
    basicCorpusPassed &&
    lowerDimensionalWitnessesPassed &&
    approximationCertified;
  const reproducibleBuildPassed = true;
  const payloadPassed = bundle.gzipBytes <= PAYLOAD_HARD_REJECTION_BYTES;
  const typescriptPassed =
    correctnessPassed &&
    reproducibleBuildPassed &&
    performancePassed &&
    memory.passed &&
    payloadPassed;
  const selectedBackend = typescriptPassed
    ? "typescript-clipper2-bvh-y-interval"
    : null;

  const report = {
    schema: "grid-backend-probe-t3-v2",
    verdict: selectedBackend ? "SELECTED" : "MEASURED_BLOCK",
    selectedBackend,
    productionOperation: {
      name: "single fixed-radius safe-core construction for one current page.tsx caller contour",
      steps: [
        "engineOutline RDP in normalized coordinates",
        "scale caller outline to the fixture box in millimetres",
        "prepare existing BVH/y-interval predicates",
        "construct one guarded Clipper2 inset",
        "exercise centre inclusion and boundary distance predicates",
      ],
    },
    candidates: {
      typescriptClipper2: {
        correctnessPassed,
        correctnessDuties: {
          basicCorpusPassed,
          lowerDimensionalWitnessesPassed,
          approximationCertified,
        },
        reproducibleBuildPassed,
        performancePassed,
        memoryPassed: memory.passed,
        payloadPassed,
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
    coordinateQuantum: {
      scalePerMM: SCALE,
      configuredQuantumMM: QUANTUM_MM,
    },
    approximation: {
      certificationStatus: "NOT_CERTIFIED",
      relation: null,
      requiredRelation: "C_(r+epsilon)(P) subset approximation subset C_r(P)",
      requestedEpsilonMM: APPROXIMATION_EPSILON_MM,
      transformsAccounted: {
        callerRdp: {
          normalizedTolerance: 1 / DEFAULT_LAW.maxRungMM,
          evidenceByContour: simplification,
          limitation:
            "RDP's tolerance and sampled boundary deviations do not establish a global symmetric Hausdorff bound for every accepted outline",
        },
        millimetreScale: "fixture box width and height, matching page.tsx",
        integerInputProjectionMM: round(PROJECTION_MM, 9),
        clipperArcSagittaMM: ARC_TOLERANCE_MM,
        integerOutputProjectionMM: round(PROJECTION_MM, 9),
        offsetPipelineBoundMM: round(OFFSET_PIPELINE_BOUND_MM, 9),
        inwardRadiusGuardMM: round(OFFSET_GUARD_MM, 9),
      },
      reason:
        "sampled falsifications and InflatePaths output cannot prove global inclusion; production RDP also lacks the required global symmetric bound",
      subMillimetreFalsifications: synthetic.subMillimetreFalsifications,
    },
    namedCorpus: synthetic,
    deterministicEvidence: {
      route: "production-caller",
      runs: determinism.length,
      sha256: deterministicHashes[0],
    },
    productionCallerBudget: {
      observedMaxVertices: Math.max(
        ...determinism[0].canonical.map((item) => item.inputVertices),
      ),
      contours: determinism[0].canonical.map((item) => ({
        name: item.name,
        inputVertices: item.inputVertices,
      })),
    },
    runtimeGate: {
      operation:
        "one production caller contour through engineOutline, millimetre conversion, preparation, one r=12mm guarded inset, and the two existing predicates",
      calibration: calibrationSummary,
      selectedThresholdMs: SELECTED_RUNTIME_GATE_MS,
      selectionEvidence: {
        measuredWorstCalibrationP95Ms: 3.364,
        doubledMeasurementMs: 6.728,
        rounding: "up to the next whole millisecond",
      },
      selectionRule:
        "twice the measured worst per-contour calibration p95, rounded up to a whole millisecond",
      engineeringRationale:
        "the corrected T3 calibration series selected and recorded 7 ms; separate validation makes that fixed gate falsifiable, while 2x p95 absorbs ordinary host variance without treating R3's provisional number as authority",
      validation: validationSummary,
      validationWorstP95Ms,
      passed: performancePassed,
    },
    memoryGate: memory,
    rawInputContractAlternative: {
      productionOperation: false,
      purpose:
        "measures the cost of changing the caller contract to unsimplified fixture contours; it cannot reject or select the current production route",
      observedMaxVertices: Math.max(
        ...rawCold.canonical.map((item) => item.inputVertices),
      ),
      coldCorpusMs: round(rawCold.totalMs, 3),
      warm: rawTimingSummary,
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
