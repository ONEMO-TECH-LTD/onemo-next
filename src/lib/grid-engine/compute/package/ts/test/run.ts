import { MagneticEngineBridge, type EngineTransport } from "../src/bridge.js";
import type {
  ArrangementClass,
  CandidateResult,
  EngineOkResult,
  GuardedPhysicalSpec,
} from "../src/contracts.js";
import { INITIAL_GRAMMAR_V1 } from "../src/initialGrammar.js";
import {
  assessExplicitRegionalCoverage,
  evaluateAndOrderCandidates,
} from "../src/productLogic.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`assertion failed: ${message}`);
}

function candidate(
  id: string,
  indices: readonly (readonly [number, number])[],
): CandidateResult {
  return {
    id,
    size_id: "size-96",
    band: "band-2",
    physical_size_mm: "96",
    population: { id: "p48", stride: 1, phase: [0, 0] },
    registration_id: "r.site-site",
    arrangement_class: "horizontal_pair",
    pattern_id: "test-pair",
    placement_population_index: [0, 0],
    sites: indices.map((baseIndex, patternSiteIndex) => ({
      pattern_site_index: patternSiteIndex,
      pattern_index: baseIndex,
      base_index: baseIndex,
      coordinate_mm: [String(baseIndex[0] * 48), String(baseIndex[1] * 48)],
      center_location: "inside",
      boundary_clearance_mm_exact: { squared_mm2: "400" },
      limiting_witness: { edge_index: 0, boundary_point_mm: ["0", "0"] },
      complete_disc_contained: true,
    })),
    edges: [],
  };
}

function testInitialGrammar(): void {
  assert(INITIAL_GRAMMAR_V1.length === 461, "initial grammar has exactly 461 explicit patterns");
  const classes = new Set<ArrangementClass>(INITIAL_GRAMMAR_V1.map((pattern) => pattern.class));
  assert(classes.size === 9, "all nine required arrangement classes exist");
  assert(INITIAL_GRAMMAR_V1.some((pattern) => pattern.id === "pair.d.rising"), "rising diagonal pair exists");
  assert(INITIAL_GRAMMAR_V1.some((pattern) => pattern.id === "pair.d.falling"), "falling diagonal pair exists");
  assert(
    INITIAL_GRAMMAR_V1.some((pattern) => pattern.id === "skip.rows.alternate.w9.h9"),
    "maximum row-skipping pattern exists",
  );
  assert(
    INITIAL_GRAMMAR_V1.some((pattern) => pattern.id === "corner.rectangle.w9.h9"),
    "maximum corner rectangle exists",
  );
}

function testClusteredRegionalCoverage(): void {
  const clustered = candidate("clustered", [[-1, 0], [0, 0]]);
  const balanced = candidate("balanced", [[-1, 0], [1, 0]]);
  const membership = {
    "r.site-site:-1,0": ["left"],
    "r.site-site:0,0": ["left"],
    "r.site-site:1,0": ["right"],
  } as const;
  const regions = [
    { id: "left", minimumDistinctSites: 1 },
    { id: "right", minimumDistinctSites: 1 },
  ] as const;

  const clusteredAssessment = assessExplicitRegionalCoverage(clustered, regions, membership);
  const balancedAssessment = assessExplicitRegionalCoverage(balanced, regions, membership);
  const raw = Object.freeze([clustered, balanced]);
  const evaluated = evaluateAndOrderCandidates(raw, [clusteredAssessment, balancedAssessment], {
    precedence: [
      { criterionId: "worst_supported_region", direction: "higher" },
      { criterionId: "covered_region_count", direction: "higher" },
    ],
    tieBreak: "candidate_id_ascending",
  });

  assert(evaluated.rawCandidates === raw, "raw immutable candidate set is retained");
  assert(evaluated.rejectedCandidateIds.length === 1, "one candidate is rejected");
  assert(evaluated.rejectedCandidateIds[0] === "clustered", "clustered candidate fails distinct-region support");
  assert(evaluated.acceptedOrder[0] === "balanced", "balanced candidate remains accepted");
  const clusteredTrace = evaluated.evaluations.find((entry) => entry.candidate.id === "clustered");
  assert(clusteredTrace?.rejectionReasons[0]?.includes("region right has 0"), "rejection has a reason trace");
}


function testDeterministicProductTieBreak(): void {
  const underscore = candidate("a_1", [[0, 0]]);
  const hyphen = candidate("a-1", [[0, 0]]);
  const assessments = [underscore, hyphen].map((entry) => ({
    candidateId: entry.id,
    gates: [],
    criteria: [{ criterionId: "same", value: "1", reason: "explicit tie fixture" }],
  }));
  const evaluated = evaluateAndOrderCandidates([underscore, hyphen], assessments, {
    precedence: [{ criterionId: "same", direction: "higher" }],
    tieBreak: "candidate_id_ascending",
  });
  assert(evaluated.acceptedOrder[0] === "a-1", "tie-break uses deterministic code-unit order");
  assert(evaluated.orderingTrace[0]?.decisiveRule === "candidate_id_ascending", "tie trace names the rule");
}

async function testBridgeCacheAndIndexedBrowsing(): Promise<void> {
  const result: EngineOkResult = {
    schema: "onemo.magnetic.solve.result/1",
    status: "ok",
    outline: {
      vertex_count: 4,
      canonical_orientation: "counter_clockwise",
      scale_basis: "max_bbox_extent",
      bbox_canonical: { min: ["-1", "-1"], max: ["1", "1"], center: ["0", "0"], max_extent: "2" },
    },
    physical_spec: {
      magnet_radius_mm: "12",
      base_pitch_mm: "48",
      field: { min_x: -4, max_x: 4, min_y: -4, max_y: 4 },
      populations: [{ id: "p48", stride: 1, phase: [0, 0] }],
    },
    sizes: [{
      id: "size-96",
      band: "band-2",
      max_extent_mm: "96",
      canonical_to_physical_scale: "48",
      physical_to_canonical_scale: "1/48",
      candidate_count: 1,
    }],
    lattices: [{
      registration_id: "r0",
      origin_mm: ["0", "0"],
      base_sites: [{ index: [0, 0], coordinate_mm: ["0", "0"] }],
    }],
    candidates: [{ ...candidate("candidate-0", [[0, 0]]), registration_id: "r0" }],
    metrics: {
      prepared_vertex_count: 4,
      site_facts_computed: 1,
      corridor_facts_computed: 0,
      placements_tested: 1,
      candidates_emitted: 1,
    },
  };

  let solveCalls = 0;
  const transport: EngineTransport = {
    async solve(): Promise<Uint8Array> {
      solveCalls += 1;
      return new TextEncoder().encode(JSON.stringify(result));
    },
  };
  const physicalSpec: GuardedPhysicalSpec = {
    magnet_radius_mm: "12",
    base_pitch_mm: "48",
    field: { min_x: -4, max_x: 4, min_y: -4, max_y: 4 },
    sizes: [{ id: "size-96", band: "band-2", max_extent_mm: "96" }],
    registrations: [{ id: "r0", origin_mm: ["0", "0"] }],
    populations: [{ id: "p48", stride: 1, phase: [0, 0] }],
  };
  const bridge = new MagneticEngineBridge({
    transport,
    physicalSpec,
    patterns: [{ id: "single", class: "single_site", sites: [[0, 0]], edges: [] }],
  });
  const outline = [["-1", "-1"], ["1", "-1"], ["1", "1"], ["-1", "1"]] as const;
  const first = await bridge.solve(outline);
  const second = await bridge.solve(outline);
  assert(solveCalls === 1, "same outline/spec solve is cached");
  assert(first.candidateAt(0).id === "candidate-0", "candidate browsing is indexed lookup");
  assert(second.renderSelectionAt(0).lattice.registration_id === "r0", "selection returns one referenced lattice");
  assert(solveCalls === 1, "candidate browsing performs no solve");
}

async function main(): Promise<void> {
  testInitialGrammar();
  console.log("PASS initial explicit grammar");
  testClusteredRegionalCoverage();
  console.log("PASS clustered-but-poor regional coverage");
  testDeterministicProductTieBreak();
  console.log("PASS deterministic product tie-break");
  await testBridgeCacheAndIndexedBrowsing();
  console.log("PASS bridge cache and indexed browsing");
  console.log("All TypeScript tests passed");
}

await main();
