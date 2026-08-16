// Independent acceptance oracle: executable inputs plus source-grounded expected results.
// It implements no geometry, classification or selection. Later stages supply SubjectAdapter;
// captured frames and unresolved inputs remain evidence, never expected answers.

import { describe, expect, it } from "vitest";

type PointMM = readonly [number, number];
type HardAuthority = "ruled" | "contract";
type NonGatingAuthority = "observed" | "open";

interface ContourFixture {
  outer: readonly PointMM[];
  holes: readonly [];
}

interface SelectionCandidate {
  id: string;
  legality: "CERTIFIED";
  majorRegionsCovered: number;
  upperMassSupported: boolean;
  unsupportedExtent:
    | { status: "CERTIFIED"; valueMM: number }
    | { status: "SCORE_UNCERTAIN"; lowerBoundMM: number; upperBoundMM: number };
  peelLeverageMM3: number;
  approvedPattern: boolean;
  distinctMassesSupported: number;
  balanceErrorMM: number;
  mirrorSymmetric: boolean;
  magnetCount: number;
  canonicalRegistration: boolean;
}

type OracleInput =
  | {
      id: string;
      kind: "classification";
      boundingBoxMM: { width: number; height: number };
    }
  | {
      id: string;
      kind: "legality";
      contour: ContourFixture;
      requiredDiscRadiusMM: 12;
      probes: ReadonlyArray<{ id: string; centreMM: PointMM }>;
    }
  | {
      id: string;
      kind: "selection";
      shapeMirrorSymmetric: boolean;
      candidates: readonly SelectionCandidate[];
    }
  | {
      id: string;
      kind: "bat-family";
      band: 1 | 2 | 3;
      geometryHash: null;
    };

type OracleResult =
  | {
      kind: "classification";
      axisClassX: 1 | 2 | 3 | 4 | 5;
      axisClassY: 1 | 2 | 3 | 4 | 5;
      band: 1 | 2 | 3 | 4 | 5;
      nodeFrame: string;
      registrationX: "node" | "spacer";
      registrationY: "node" | "spacer";
    }
  | {
      kind: "legality";
      safeCore: "NON_EMPTY" | "EMPTY";
      probes: ReadonlyArray<{
        id: string;
        fullDiscContained: boolean;
        minimumClearanceMM: number;
        boundaryWitnessMM: PointMM;
      }>;
    }
  | {
      kind: "selection";
      status: "SELECTED" | "DECISION_INDETERMINATE";
      winnerId: string | null;
      decisiveCriterion: string;
    }
  | {
      kind: "bat-family";
      band: 1 | 2 | 3;
      layoutFamily:
        "single-upper-mass" | "vertical-pair" | "apex-with-base-support";
    };

interface ResultMutation {
  name: string;
  apply: (result: OracleResult) => OracleResult;
}

interface HardCase {
  id: string;
  authority: HardAuthority;
  source: string;
  input: OracleInput;
  expected: OracleResult;
  mutations: readonly ResultMutation[];
}

interface NonGatingRecord {
  id: string;
  authority: NonGatingAuthority;
  source: string;
  evidence: string;
}

type SubjectAdapter = (input: OracleInput) => OracleResult;

const assertOracleCase = (fixture: HardCase, subject: SubjectAdapter) => {
  expect(subject(fixture.input)).toEqual(fixture.expected);
};

const harnessSubject =
  (inputId: string, result: OracleResult): SubjectAdapter =>
  (input) => {
    if (input.id !== inputId)
      throw new Error(`adapter received ${input.id}, expected ${inputId}`);
    return result;
  };

const mutate = (
  name: string,
  apply: (result: OracleResult) => OracleResult,
): ResultMutation => ({ name, apply });

const patchResult = (
  name: string,
  patch: Partial<OracleResult>,
): ResultMutation =>
  mutate(name, (result) => ({ ...result, ...patch }) as OracleResult);

const candidate = (
  id: string,
  overrides: Partial<SelectionCandidate> = {},
): SelectionCandidate => ({
  id,
  legality: "CERTIFIED",
  majorRegionsCovered: 2,
  upperMassSupported: true,
  unsupportedExtent: { status: "CERTIFIED", valueMM: 12 },
  peelLeverageMM3: 100,
  approvedPattern: true,
  distinctMassesSupported: 2,
  balanceErrorMM: 0,
  mirrorSymmetric: false,
  magnetCount: 2,
  canonicalRegistration: false,
  ...overrides,
});

const selected = (
  winnerId: string,
  decisiveCriterion: string,
): OracleResult => ({
  kind: "selection",
  status: "SELECTED",
  winnerId,
  decisiveCriterion,
});

const classificationMutations: readonly ResultMutation[] = [
  mutate("axis class", (result) => ({
    ...(result as Extract<OracleResult, { kind: "classification" }>),
    axisClassX:
      result.kind === "classification" && result.axisClassX === 1 ? 2 : 1,
  })),
  patchResult("frame", { nodeFrame: "wrong-frame" }),
  mutate("parity registration", (result) => ({
    ...(result as Extract<OracleResult, { kind: "classification" }>),
    registrationY:
      result.kind === "classification" && result.registrationY === "node"
        ? "spacer"
        : "node",
  })),
];

const batCase = (
  band: 1 | 2 | 3,
  id: string,
  layoutFamily: Extract<OracleResult, { kind: "bat-family" }>["layoutFamily"],
  brokenFamily: Extract<OracleResult, { kind: "bat-family" }>["layoutFamily"],
): HardCase => ({
  id,
  authority: "ruled",
  source: `logic-spec-optimum.md §6 bat B${band} (family only; vector and millimetres excluded)`,
  input: { id, kind: "bat-family", band, geometryHash: null },
  expected: { kind: "bat-family", band, layoutFamily },
  mutations: [patchResult("layout family", { layoutFamily: brokenFamily })],
});

const classificationCase = (
  id: string,
  width: number,
  height: number,
  expected: Extract<OracleResult, { kind: "classification" }>,
  source = "Product Base §§4–6; logic-spec-optimum.md §5.1",
): HardCase => ({
  id,
  authority: "contract",
  source,
  input: { id, kind: "classification", boundingBoxMM: { width, height } },
  expected,
  mutations: classificationMutations,
});

const roundedContour: ContourFixture = {
  outer: [
    [12, 0],
    [28, 0],
    [40, 12],
    [40, 28],
    [28, 40],
    [12, 40],
    [0, 28],
    [0, 12],
  ],
  holes: [],
};

const notchedContour: ContourFixture = {
  outer: [
    [0, 0],
    [100, 0],
    [100, 40],
    [55, 40],
    [55, 60],
    [100, 60],
    [100, 100],
    [0, 100],
  ],
  holes: [],
};

const corridorContour: ContourFixture = {
  outer: [
    [0, 0],
    [23, 0],
    [23, 80],
    [0, 80],
  ],
  holes: [],
};

const hardCases: HardCase[] = [
  batCase(1, "bat-B1-upper-single", "single-upper-mass", "vertical-pair"),
  batCase(2, "bat-B2-vertical-pair", "vertical-pair", "single-upper-mass"),
  batCase(3, "bat-B3-apex-and-base", "apex-with-base-support", "vertical-pair"),
  classificationCase("square-standard", 72, 72, {
    kind: "classification",
    axisClassX: 2,
    axisClassY: 2,
    band: 2,
    nodeFrame: "2x2",
    registrationX: "spacer",
    registrationY: "spacer",
  }),
  classificationCase("tall-rectangle", 24, 72, {
    kind: "classification",
    axisClassX: 1,
    axisClassY: 2,
    band: 2,
    nodeFrame: "1x2",
    registrationX: "node",
    registrationY: "spacer",
  }),
  classificationCase("wide-rectangle", 72, 24, {
    kind: "classification",
    axisClassX: 2,
    axisClassY: 1,
    band: 2,
    nodeFrame: "2x1",
    registrationX: "spacer",
    registrationY: "node",
  }),
  {
    id: "rounded-boundary-full-disc",
    authority: "contract",
    source: "Product Base §§2 and 7.2",
    input: {
      id: "rounded-boundary-full-disc",
      kind: "legality",
      contour: roundedContour,
      requiredDiscRadiusMM: 12,
      probes: [
        { id: "tangent", centreMM: [20, 12] },
        { id: "intruding", centreMM: [20, 10] },
      ],
    },
    expected: {
      kind: "legality",
      safeCore: "NON_EMPTY",
      probes: [
        {
          id: "tangent",
          fullDiscContained: true,
          minimumClearanceMM: 12,
          boundaryWitnessMM: [20, 0],
        },
        {
          id: "intruding",
          fullDiscContained: false,
          minimumClearanceMM: 10,
          boundaryWitnessMM: [20, 0],
        },
      ],
    },
    mutations: [
      mutate("tangency", (result) => {
        const legal = result as Extract<OracleResult, { kind: "legality" }>;
        return {
          ...legal,
          probes: [
            { ...legal.probes[0], fullDiscContained: false },
            legal.probes[1],
          ],
        };
      }),
      mutate("intrusion", (result) => {
        const legal = result as Extract<OracleResult, { kind: "legality" }>;
        return {
          ...legal,
          probes: [
            legal.probes[0],
            { ...legal.probes[1], fullDiscContained: true },
          ],
        };
      }),
    ],
  },
  {
    id: "concave-notch-centre-is-insufficient",
    authority: "contract",
    source: "Product Base §§2, 7.2 and 13",
    input: {
      id: "concave-notch-centre-is-insufficient",
      kind: "legality",
      contour: notchedContour,
      requiredDiscRadiusMM: 12,
      probes: [{ id: "notch-wall", centreMM: [50, 50] }],
    },
    expected: {
      kind: "legality",
      safeCore: "NON_EMPTY",
      probes: [
        {
          id: "notch-wall",
          fullDiscContained: false,
          minimumClearanceMM: 5,
          boundaryWitnessMM: [55, 50],
        },
      ],
    },
    mutations: [
      mutate("concave witness", (result) => {
        const legal = result as Extract<OracleResult, { kind: "legality" }>;
        return {
          ...legal,
          probes: [{ ...legal.probes[0], fullDiscContained: true }],
        };
      }),
    ],
  },
  {
    id: "narrow-corridor",
    authority: "contract",
    source: "Product Base §§2 and 7.2",
    input: {
      id: "narrow-corridor",
      kind: "legality",
      contour: corridorContour,
      requiredDiscRadiusMM: 12,
      probes: [{ id: "corridor-midline", centreMM: [11.5, 40] }],
    },
    expected: {
      kind: "legality",
      safeCore: "EMPTY",
      probes: [
        {
          id: "corridor-midline",
          fullDiscContained: false,
          minimumClearanceMM: 11.5,
          boundaryWitnessMM: [0, 40],
        },
      ],
    },
    mutations: [patchResult("empty safe core", { safeCore: "NON_EMPTY" })],
  },
  classificationCase(
    "mixed-parity-registration",
    72,
    120,
    {
      kind: "classification",
      axisClassX: 2,
      axisClassY: 3,
      band: 3,
      nodeFrame: "2x3",
      registrationX: "spacer",
      registrationY: "node",
    },
    "Product Base §§4–6",
  ),
  {
    id: "symmetry-breaks-mechanical-tie",
    authority: "contract",
    source: "Product Base §11.8; logic-spec-optimum.md §2 balance",
    input: {
      id: "symmetry-breaks-mechanical-tie",
      kind: "selection",
      shapeMirrorSymmetric: true,
      candidates: [
        candidate("symmetric", { mirrorSymmetric: true }),
        candidate("symmetry-broken"),
      ],
    },
    expected: selected("symmetric", "SYMMETRY"),
    mutations: [
      patchResult("symmetry-only tie", { winnerId: "symmetry-broken" }),
    ],
  },
  {
    id: "coverage-dominates-count",
    authority: "contract",
    source: "Product Base §11.2 and §11.9",
    input: {
      id: "coverage-dominates-count",
      kind: "selection",
      shapeMirrorSymmetric: false,
      candidates: [
        candidate("fewer", {
          majorRegionsCovered: 1,
          distinctMassesSupported: 1,
          magnetCount: 1,
        }),
        candidate("covers-both-masses", { magnetCount: 4 }),
      ],
    },
    expected: selected("covers-both-masses", "MAJOR_REGION_COVERAGE"),
    mutations: [
      patchResult("count before coverage", {
        winnerId: "fewer",
        decisiveCriterion: "MAGNET_COUNT",
      }),
    ],
  },
  {
    id: "uncertain-dominance-is-indeterminate",
    authority: "contract",
    source: "FINAL-CONSOLIDATED-PROPOSAL.md T5.3–T5.5",
    input: {
      id: "uncertain-dominance-is-indeterminate",
      kind: "selection",
      shapeMirrorSymmetric: false,
      candidates: [
        candidate("certified-12"),
        candidate("score-uncertain", {
          unsupportedExtent: {
            status: "SCORE_UNCERTAIN",
            lowerBoundMM: 0,
            upperBoundMM: 20,
          },
        }),
      ],
    },
    expected: {
      kind: "selection",
      status: "DECISION_INDETERMINATE",
      winnerId: null,
      decisiveCriterion: "UNCERTIFIED_DOMINANCE",
    },
    mutations: [
      patchResult("silent uncertain drop", {
        status: "SELECTED",
        winnerId: "certified-12",
        decisiveCriterion: "UNSUPPORTED_EXTENT",
      }),
    ],
  },
  {
    id: "mechanics-beat-canonical-registration",
    authority: "contract",
    source: "Product Base §6 and §11",
    input: {
      id: "mechanics-beat-canonical-registration",
      kind: "selection",
      shapeMirrorSymmetric: false,
      candidates: [
        candidate("canonical", {
          upperMassSupported: false,
          canonicalRegistration: true,
        }),
        candidate("shifted-upper-hold"),
      ],
    },
    expected: selected("shifted-upper-hold", "UPPER_MASS_SUPPORT"),
    mutations: [
      patchResult("canonical override", {
        winnerId: "canonical",
        decisiveCriterion: "CANONICAL_REGISTRATION",
      }),
    ],
  },
];

const observedFrames: NonGatingRecord[] = [
  "bat-B1:single@60x1",
  "bat-B2:pair-v@88x2",
  "bat-B3:tri-96-up@146x3",
  "bat-B4:pair-v-96@170x2",
  "duck-B1:auto@60x1",
  "duck-B2:pair-v@84x2",
  "duck-B3:rect-48x96@154x4",
  "duck-B4:pair-v-96@178x2",
  "butterfly-B1:single@68x1",
  "butterfly-B2:pair-h@92x2",
  "butterfly-B3:square-48@126x4",
  "butterfly-B4:square-96@204x4",
  "bot-B1:auto@44x1",
  "bot-B2:pair-v@98x2",
  "bot-B3:rect-48x96@144x4",
  "bot-B4:pair-v-96@168x2",
  "pill-B1:single@54x1",
  "pill-B2:pair-antidiag@82x2",
  "pill-B3:pair-antidiag@120x2",
  "pill-B4:run-antidiag-3@168x3",
  "poke1-B1:single@40x1",
  "poke1-B2:auto@76x2",
  "poke1-B3:square-48@126x4",
  "poke1-B4:rect-48x96@172x4",
  "poke2-B1:single@44x1",
  "poke2-B2:pair-v@76x2",
  "poke2-B3:pair-v-96@124x2",
  "poke2-B4:auto@190x4",
].map((evidence) => ({
  id: evidence.slice(0, evidence.indexOf(":")),
  authority: "observed",
  source: "canon-adjudication/frames-data.json",
  evidence,
}));

const openRecords: NonGatingRecord[] = [
  {
    id: "bat-B4-bulls-eye",
    authority: "open",
    source: "logic-spec-optimum.md §6 and T0 authority ledger §10",
    evidence: "No ruled B4 winner; do not pin one.",
  },
  {
    id: "missing-uploaded-contour",
    authority: "open",
    source: "T0 authority ledger §10",
    evidence:
      "Contour identity is absent; only this contour's final assertion remains blocked.",
  },
];

// Observed/open records are deliberately unreachable from the hard-case runner.
void observedFrames;
void openRecords;

describe("independent grid acceptance oracle", () => {
  it("keeps only direct/designated contract rows in the hard set", () => {
    expect(new Set(hardCases.map((fixture) => fixture.id)).size).toBe(
      hardCases.length,
    );
    expect(
      hardCases.every(
        (fixture) =>
          fixture.authority === "ruled" || fixture.authority === "contract",
      ),
    ).toBe(true);
    expect(hardCases.every((fixture) => fixture.source.length > 0)).toBe(true);
  });

  for (const fixture of hardCases) {
    it(`${fixture.authority} · ${fixture.id} · mutation proof`, () => {
      for (const mutation of fixture.mutations) {
        const mutated = mutation.apply(fixture.expected);
        expect(
          () =>
            assertOracleCase(
              fixture,
              harnessSubject(fixture.input.id, mutated),
            ),
          `${fixture.id} / ${mutation.name} escaped`,
        ).toThrow();
      }
    });
  }
});
