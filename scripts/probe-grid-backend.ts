import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { cpus, platform, release } from "node:os";
import { performance } from "node:perf_hooks";

import {
  computeContinuousFeasibleSet,
  CONTINUOUS_REGISTRATION_QUANTUM_MM,
  type ContinuousFeasibilityResult,
} from "../src/lib/grid-engine/compute/continuous-feasibility";
import type { Contour, Pt } from "../src/lib/grid-engine/compute/types";
import {
  engineOutline,
  type OutlineUV,
} from "../src/lib/grid-engine/ui/trace-cutout";

const RADIUS_MM = 12;
const SINGLE_NODE_PATTERN: ReadonlyArray<Pt> = [[0, 0]];
const DETERMINISM_RUNS = 4;
const RUNTIME_CALIBRATION_RUNS = 12;
const RUNTIME_VALIDATION_RUNS = 40;
const SELECTED_RUNTIME_GATE_MS = 7;
const MEMORY_CALIBRATION_SAMPLES = 8;
const MEMORY_BATCHES = 10;
const MEMORY_RUNS_PER_BATCH = 10;
const SELECTED_RETAINED_HEAP_GATE_BYTES = 2.25 * 1024 * 1024;

type CanonFixture = {
  outline: OutlineUV;
  box: { w: number; h: number };
};

type Status = ContinuousFeasibilityResult["status"];

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

function hash(value: string): string {
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

function boundsMM(contour: Contour) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of contour.outer.pts) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** The whole translation domain — the contour's own bounding box. The probe holds no policy. */
function boundingDomain(contour: Contour): Contour {
  const { minX, minY, maxX, maxY } = boundsMM(contour);
  return {
    outer: {
      pts: [
        [minX, minY],
        [maxX, minY],
        [maxX, maxY],
        [minX, maxY],
      ],
    },
    holes: [],
  };
}

/**
 * The measured subject: the product's own T4 seam. This probe carries no geometry implementation,
 * so what it reports is what the engine does.
 *
 * `sourceApproximationErrorMM` is deliberately not supplied. That parameter carries a CERTIFIED
 * SYMMETRIC boundary error; the caller's RDP simplification guarantees a one-way bound only, so
 * passing its tolerance there would assert a certification nobody has proved. Every claim below is
 * therefore scoped to the exact caller polygon handed to T4, and says nothing about that polygon's
 * relation to the raw trace. The one risk a zero carries — a false INFEASIBLE_CERTIFIED from the
 * bbox test — stays falsifiable: every measured contour prints its bbox against the 2r = 24mm
 * requirement.
 */
function feasibility(
  contour: Contour,
  effectiveRadiusMM: number,
  exactWitnessesMM?: ReadonlyArray<Pt>,
): ContinuousFeasibilityResult {
  return computeContinuousFeasibleSet({
    contour,
    permittedDomain: boundingDomain(contour),
    effectiveRadiusMM,
    offsetsMM: SINGLE_NODE_PATTERN,
    exactWitnessesMM,
  });
}

interface CorpusCase {
  name: string;
  duty: string;
  contour: Contour;
  witnessesMM: Pt[];
  expected: {
    status: Status;
    /** Pinned only where the count is a governed duty; otherwise assert non-emptiness alone. */
    components?: number;
    minComponents?: number;
    retainedWitnessesMM: Pt[];
  };
}

const NAMED_CORPUS: CorpusCase[] = [
  {
    name: "tangency",
    duty: "a disc touching the boundary exactly is legal and is retained",
    contour: rectangle(80, 80),
    witnessesMM: [[12, 40]],
    expected: {
      status: "PROVED_FEASIBLE",
      minComponents: 1,
      retainedWitnessesMM: [[12, 40]],
    },
  },
  {
    name: "oneQuantumIntrusion",
    duty: "one registration quantum inside the boundary is illegal and is not retained",
    contour: rectangle(24 - CONTINUOUS_REGISTRATION_QUANTUM_MM, 24),
    witnessesMM: [[12 - CONTINUOUS_REGISTRATION_QUANTUM_MM, 12]],
    expected: {
      status: "INFEASIBLE_CERTIFIED",
      components: 0,
      retainedWitnessesMM: [],
    },
  },
  {
    name: "splitSafeRegions",
    duty: "an erosion that splits into two masses keeps both, never the largest ring alone",
    contour: splitSafeRegion,
    witnessesMM: [],
    expected: {
      status: "PROVED_FEASIBLE",
      components: 2,
      retainedWitnessesMM: [],
    },
  },
  {
    name: "zeroWidthCorridor",
    duty: "a one-dimensional feasible set survives as a supplied exact witness",
    contour: rectangle(24, 60),
    witnessesMM: [[12, 30]],
    expected: {
      status: "PROVED_FEASIBLE",
      components: 0,
      retainedWitnessesMM: [[12, 30]],
    },
  },
  {
    name: "isolatedLegalWitness",
    duty: "a zero-dimensional feasible set survives as a supplied exact witness",
    contour: rectangle(24, 24),
    witnessesMM: [[12, 12]],
    expected: {
      status: "PROVED_FEASIBLE",
      components: 0,
      retainedWitnessesMM: [[12, 12]],
    },
  },
  {
    name: "starvedRefinement",
    duty: "area thinner than the guarded inset is not lost when a witness proves it",
    contour: rectangle(24.04, 60),
    witnessesMM: [[12.02, 30]],
    expected: {
      status: "PROVED_FEASIBLE",
      components: 0,
      retainedWitnessesMM: [[12.02, 30]],
    },
  },
  {
    name: "hairlineFeasibility",
    duty: "a hairline-feasible contour is still feasible",
    contour: rectangle(24.01, 60),
    witnessesMM: [[12.005, 30]],
    expected: {
      status: "PROVED_FEASIBLE",
      retainedWitnessesMM: [[12.005, 30]],
    },
  },
  {
    name: "lowerDimensionalWithoutWitness",
    duty: "an empty approximation with no witness is indeterminate, never certified infeasible",
    contour: rectangle(24, 60),
    witnessesMM: [],
    expected: {
      status: "INDETERMINATE_WITHIN_TOLERANCE",
      components: 0,
      retainedWitnessesMM: [],
    },
  },
  {
    name: "justTooNarrow",
    duty: "a contour narrower than the disc is certified infeasible from bbox separation",
    contour: rectangle(23.999, 60),
    witnessesMM: [],
    expected: {
      status: "INFEASIBLE_CERTIFIED",
      components: 0,
      retainedWitnessesMM: [],
    },
  },
  {
    name: "concaveNotchFalseSeat",
    duty: "a seat inside the material but too near a notch wall is rejected",
    contour: concaveNotch,
    witnessesMM: [[30, 40]],
    expected: {
      status: "PROVED_FEASIBLE",
      minComponents: 1,
      retainedWitnessesMM: [],
    },
  },
];

/** Every case is a real T4 call judged on T4's own result. A miss records the duty, never throws. */
function evaluateNamedCorpus() {
  return NAMED_CORPUS.map((testCase) => {
    const identity = {
      name: testCase.name,
      duty: testCase.duty,
      radiusMM: RADIUS_MM,
      suppliedWitnessesMM: testCase.witnessesMM,
    };
    let result: ContinuousFeasibilityResult;
    try {
      result = feasibility(testCase.contour, RADIUS_MM, testCase.witnessesMM);
    } catch (error) {
      return {
        ...identity,
        passed: false,
        mismatches: [
          `threw: ${error instanceof Error ? error.message : String(error)}`,
        ],
      };
    }
    const retained = result.exactWitnessesMM.map(([x, y]) => [x, y] as Pt);
    const mismatches: string[] = [];
    if (result.status !== testCase.expected.status)
      mismatches.push(
        `status ${result.status}, expected ${testCase.expected.status}`,
      );
    if (
      testCase.expected.components !== undefined &&
      result.components.length !== testCase.expected.components
    )
      mismatches.push(
        `components ${result.components.length}, expected ${testCase.expected.components}`,
      );
    if (
      testCase.expected.minComponents !== undefined &&
      result.components.length < testCase.expected.minComponents
    )
      mismatches.push(
        `components ${result.components.length}, expected at least ${testCase.expected.minComponents}`,
      );
    if (
      JSON.stringify(retained) !==
      JSON.stringify(testCase.expected.retainedWitnessesMM)
    )
      mismatches.push(
        `retained ${JSON.stringify(retained)}, expected ${JSON.stringify(
          testCase.expected.retainedWitnessesMM,
        )}`,
      );
    return {
      ...identity,
      status: result.status,
      components: result.components.length,
      componentVertices: result.components.reduce(
        (total, component) => total + component.length,
        0,
      ),
      retainedWitnessesMM: retained,
      envelope: result.envelope,
      passed: mismatches.length === 0,
      mismatches,
    };
  });
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

function executeFixture(name: string, fixture: CanonFixture) {
  const started = performance.now();
  const contour = toContour(engineOutline(fixture.outline), fixture.box);
  const result = feasibility(contour, RADIUS_MM);
  const runtimeMs = performance.now() - started;
  const bounds = boundsMM(contour);
  return {
    canonical: {
      name,
      inputVertices: contour.outer.pts.length,
      bboxWidthMM: round(bounds.maxX - bounds.minX, 3),
      bboxHeightMM: round(bounds.maxY - bounds.minY, 3),
      status: result.status,
      components: result.components.length,
      componentVertices: result.components.reduce(
        (total, component) => total + component.length,
        0,
      ),
      geometryHash: hash(JSON.stringify(result.components)),
    },
    runtimeMs,
  };
}

function executeRealCorpus(fixtures: Record<string, CanonFixture>) {
  const started = performance.now();
  const contours = Object.entries(fixtures).map(([name, fixture]) =>
    executeFixture(name, fixture),
  );
  return {
    canonical: contours.map((item) => item.canonical),
    contourTimingsMs: Object.fromEntries(
      contours.map((item) => [item.canonical.name, item.runtimeMs]),
    ),
    totalMs: performance.now() - started,
  };
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
  executeRealCorpus(fixtures);
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
      const result = executeRealCorpus(fixtures);
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
      "100 complete T4 corpora over the production caller contours after one warm corpus; forced GC after each 10-corpus batch",
    calibration: {
      samples: calibrationSamples,
      observedNoiseSpreadBytes: calibrationNoiseBytes,
    },
    selectedGate: {
      retainedHeapBytes: SELECTED_RETAINED_HEAP_GATE_BYTES,
      slopeBytesPerCorpusRun: round(selectedSlopeGateBytesPerRun, 3),
      provenance:
        "fixed during the T3 selection calibration and unchanged since; this run measures the T4 seam against that already-recorded number rather than re-deriving one",
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

function main() {
  if (typeof global.gc !== "function") {
    throw new Error("run the probe with node --expose-gc");
  }
  const collectGarbage = global.gc;
  const fixtures = loadFixtures();

  const namedCorpus = evaluateNamedCorpus();
  const correctnessPassed = namedCorpus.every((item) => item.passed);

  const determinism = Array.from({ length: DETERMINISM_RUNS }, () =>
    executeRealCorpus(fixtures),
  );
  const deterministicHashes = determinism.map((run) =>
    hash(JSON.stringify(run.canonical)),
  );
  const determinismPassed = new Set(deterministicHashes).size === 1;

  executeRealCorpus(fixtures);
  const runtimeCalibration = Array.from(
    { length: RUNTIME_CALIBRATION_RUNS },
    () => executeRealCorpus(fixtures),
  );
  const calibrationSummary = summarizeTimings(runtimeCalibration);
  const runtimeValidation = Array.from(
    { length: RUNTIME_VALIDATION_RUNS },
    () => executeRealCorpus(fixtures),
  );
  const validationSummary = summarizeTimings(runtimeValidation);
  const validationWorstP95Ms = worstContourP95(validationSummary);
  const performancePassed = validationWorstP95Ms <= SELECTED_RUNTIME_GATE_MS;

  const memory = measureMemory(fixtures, collectGarbage);

  const selectedBackend =
    correctnessPassed && determinismPassed && performancePassed && memory.passed
      ? "typescript-clipper2-bvh-y-interval"
      : null;
  const failedDuties = [
    correctnessPassed ? null : "namedCorpus",
    determinismPassed ? null : "determinism",
    performancePassed ? null : "runtime",
    memory.passed ? null : "retainedHeap",
  ].filter((duty): duty is string => duty !== null);

  const report = {
    schema: "grid-backend-probe-t3-v3",
    verdict: selectedBackend ? "SELECTED" : "MEASURED_BLOCK",
    selectedBackend,
    failedDuties,
    subject: {
      seam: "src/lib/grid-engine/compute/continuous-feasibility.ts#computeContinuousFeasibleSet",
      note: "the probe carries no geometry implementation of its own; every result below is the product's own T4 output",
    },
    productionOperation: {
      name: "one continuous feasible-set solve for one page.tsx caller contour at the 12mm effective radius",
      steps: [
        "engineOutline RDP in normalized coordinates — the caller's own simplification",
        "scale the caller outline to the fixture box in millimetres, exactly as page.tsx does",
        "computeContinuousFeasibleSet over the contour bounding box as permitted domain, r = 12mm, single-node pattern",
      ],
    },
    sourceApproximation: {
      carriedErrorSupplied: false,
      scope:
        "every correctness claim in this report is scoped to the exact caller polygon passed into T4",
      reason:
        "T4's carried-error parameter states a certified symmetric boundary error; the caller's RDP guarantees a one-way bound only, so no value is asserted here and the raw-trace-to-RDP relation is not certified by this probe",
      bboxFalsification:
        "every measured contour prints its bbox; INFEASIBLE_CERTIFIED is only reachable below 2r = 24mm",
    },
    namedCorpus,
    deterministicEvidence: {
      runs: determinism.length,
      sha256: deterministicHashes[0],
      distinctHashes: new Set(deterministicHashes).size,
      passed: determinismPassed,
    },
    productionCallerBudget: {
      observedMaxVertices: Math.max(
        ...determinism[0].canonical.map((item) => item.inputVertices),
      ),
      contours: determinism[0].canonical.map((item) => ({
        name: item.name,
        inputVertices: item.inputVertices,
        bboxWidthMM: item.bboxWidthMM,
        bboxHeightMM: item.bboxHeightMM,
        status: item.status,
        components: item.components,
      })),
      note: "real-contour status is observed evidence; the no-indeterminate product gate belongs to the replacement gate, not to this probe",
    },
    runtimeGate: {
      operation:
        "one production caller contour through engineOutline, millimetre conversion and one computeContinuousFeasibleSet solve",
      selectedThresholdMs: SELECTED_RUNTIME_GATE_MS,
      provenance:
        "fixed during the T3 selection calibration and unchanged since; this run measures the T4 seam against that already-recorded number rather than re-deriving one",
      calibration: calibrationSummary,
      validation: validationSummary,
      validationWorstP95Ms,
      passed: performancePassed,
    },
    memoryGate: memory,
    environment: {
      node: process.version,
      platform: platform(),
      release: release(),
      cpu: cpus()[0]?.model ?? "unknown",
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

main();
