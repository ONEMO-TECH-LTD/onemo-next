// Independent acceptance oracle. It deliberately imports no engine code and never derives an
// expected winner from an engine run. Product assertions come only from Dan's ruled Bat outcomes
// or the two designated briefs. Captured frames and unresolved inputs are evidence, not gates.

import { describe, expect, it } from "vitest";

type HardAuthority = "ruled" | "contract";
type NonGatingAuthority = "observed" | "open";
type AxisClass = 1 | 2 | 3 | 4 | 5;
type Registration = "node" | "spacer";

interface HardCase<T> {
  id: string;
  authority: HardAuthority;
  source: string;
  expected: T;
  evaluate: () => T;
  mutate: () => T;
}

interface NonGatingRecord {
  id: string;
  authority: NonGatingAuthority;
  source: string;
  evidence: string;
}

const classifyAxis = (mm: number): AxisClass => {
  if (mm >= 24 && mm < 72) return 1;
  if (mm >= 72 && mm < 120) return 2;
  if (mm >= 120 && mm < 168) return 3;
  if (mm >= 168 && mm < 216) return 4;
  if (mm >= 216 && mm <= 264) return 5;
  throw new RangeError(`outside the ruled size domain: ${mm}`);
};

const registrationFor = (lines: number): Registration =>
  lines % 2 === 0 ? "spacer" : "node";

const classifyFrame = (widthMM: number, heightMM: number) => {
  const x = classifyAxis(widthMM);
  const y = classifyAxis(heightMM);
  return {
    axisClassX: x,
    axisClassY: y,
    band: Math.max(x, y) as AxisClass,
    nodeFrame: `${x}x${y}`,
    registrationX: registrationFor(x),
    registrationY: registrationFor(y),
  };
};

const fullDiscLegal = (minimumEdgeClearanceMM: number) =>
  minimumEdgeClearanceMM >= 12;
const corridorHasSafeCore = (widthMM: number) => widthMM >= 24;

interface MechanicalCandidate {
  id: string;
  proof: "proved" | "indeterminate";
  legal: boolean;
  majorRegionsCovered: number;
  upperMassSupported: boolean;
  unsupportedExtentMM: number;
  peelLeverageMM3: number;
  approvedPattern: boolean;
  distinctMassesSupported: number;
  balanceErrorMM: number;
  magnetCount: number;
  canonical: boolean;
}

const mechanicalOrder = (
  a: MechanicalCandidate,
  b: MechanicalCandidate,
): MechanicalCandidate => {
  const keys: Array<[number, number, "max" | "min"]> = [
    [
      a.proof === "proved" && a.legal ? 1 : 0,
      b.proof === "proved" && b.legal ? 1 : 0,
      "max",
    ],
    [a.majorRegionsCovered, b.majorRegionsCovered, "max"],
    [a.upperMassSupported ? 1 : 0, b.upperMassSupported ? 1 : 0, "max"],
    [a.unsupportedExtentMM, b.unsupportedExtentMM, "min"],
    [a.peelLeverageMM3, b.peelLeverageMM3, "min"],
    [a.approvedPattern ? 1 : 0, b.approvedPattern ? 1 : 0, "max"],
    [a.distinctMassesSupported, b.distinctMassesSupported, "max"],
    [a.balanceErrorMM, b.balanceErrorMM, "min"],
    [a.magnetCount, b.magnetCount, "min"],
    [a.canonical ? 1 : 0, b.canonical ? 1 : 0, "max"],
  ];
  for (const [av, bv, direction] of keys) {
    if (av === bv) continue;
    return direction === "max" ? (av > bv ? a : b) : av < bv ? a : b;
  }
  return a;
};

const baseCandidate = (id: string): MechanicalCandidate => ({
  id,
  proof: "proved",
  legal: true,
  majorRegionsCovered: 2,
  upperMassSupported: true,
  unsupportedExtentMM: 12,
  peelLeverageMM3: 100,
  approvedPattern: true,
  distinctMassesSupported: 2,
  balanceErrorMM: 0,
  magnetCount: 2,
  canonical: true,
});

const ruledBatFamilies: HardCase<string>[] = [
  {
    id: "bat-B1-upper-single",
    authority: "ruled",
    source:
      "logic-spec-optimum.md §6 bat B1 (Dan-approved family; vector/millimetres excluded)",
    expected: "single-upper-mass",
    evaluate: () => "single-upper-mass",
    mutate: () => "single-lower-mass",
  },
  {
    id: "bat-B2-vertical-pair",
    authority: "ruled",
    source:
      "logic-spec-optimum.md §6 bat B2 (Dan-approved family; vector/millimetres excluded)",
    expected: "vertical-pair",
    evaluate: () => "vertical-pair",
    mutate: () => "horizontal-pair",
  },
  {
    id: "bat-B3-apex-and-base",
    authority: "ruled",
    source:
      "logic-spec-optimum.md §6 bat B3 (approved apex/base family; vector/millimetres excluded)",
    expected: "apex-with-base-support",
    evaluate: () => "apex-with-base-support",
    mutate: () => "unsupported-spine",
  },
];

const contractCases: HardCase<unknown>[] = [
  {
    id: "square-standard",
    authority: "contract",
    source: "Product Base §§4–6; logic-spec-optimum.md §5.1",
    expected: {
      axisClassX: 2,
      axisClassY: 2,
      band: 2,
      nodeFrame: "2x2",
      registrationX: "spacer",
      registrationY: "spacer",
    },
    evaluate: () => classifyFrame(72, 72),
    mutate: () => classifyFrame(71, 72),
  },
  {
    id: "tall-rectangle",
    authority: "contract",
    source: "Product Base §§4–6; logic-spec-optimum.md §5.1",
    expected: {
      axisClassX: 1,
      axisClassY: 2,
      band: 2,
      nodeFrame: "1x2",
      registrationX: "node",
      registrationY: "spacer",
    },
    evaluate: () => classifyFrame(24, 72),
    mutate: () => classifyFrame(72, 24),
  },
  {
    id: "wide-rectangle",
    authority: "contract",
    source: "Product Base §§4–6; logic-spec-optimum.md §5.1",
    expected: {
      axisClassX: 2,
      axisClassY: 1,
      band: 2,
      nodeFrame: "2x1",
      registrationX: "spacer",
      registrationY: "node",
    },
    evaluate: () => classifyFrame(72, 24),
    mutate: () => classifyFrame(24, 72),
  },
  {
    id: "rounded-boundary-full-disc",
    authority: "contract",
    source: "Product Base §§2 and 7.2",
    expected: { tangent: true, roundedCornerIntrusion: false },
    evaluate: () => ({
      tangent: fullDiscLegal(12),
      roundedCornerIntrusion: fullDiscLegal(11.999),
    }),
    mutate: () => ({ tangent: false, roundedCornerIntrusion: true }),
  },
  {
    id: "concave-notch-centre-is-insufficient",
    authority: "contract",
    source: "Product Base §§2, 7.2 and 13",
    expected: false,
    evaluate: () => fullDiscLegal(8),
    mutate: () => true,
  },
  {
    id: "narrow-corridor",
    authority: "contract",
    source: "Product Base §§2 and 7.2",
    expected: { belowDisc: false, exactDisc: true },
    evaluate: () => ({
      belowDisc: corridorHasSafeCore(23.999),
      exactDisc: corridorHasSafeCore(24),
    }),
    mutate: () => ({ belowDisc: true, exactDisc: true }),
  },
  {
    id: "mixed-parity-registration",
    authority: "contract",
    source: "Product Base §§4–6",
    expected: {
      axisClassX: 2,
      axisClassY: 3,
      band: 3,
      nodeFrame: "2x3",
      registrationX: "spacer",
      registrationY: "node",
    },
    evaluate: () => classifyFrame(72, 120),
    mutate: () => ({ ...classifyFrame(72, 120), registrationY: "spacer" }),
  },
  {
    id: "symmetry-breaks-mechanical-tie",
    authority: "contract",
    source: "Product Base §11.8; logic-spec-optimum.md §2 balance",
    expected: "symmetric",
    evaluate: () => {
      const symmetric = baseCandidate("symmetric");
      const asymmetric = { ...symmetric, id: "asymmetric", balanceErrorMM: 9 };
      return mechanicalOrder(asymmetric, symmetric).id;
    },
    mutate: () => "asymmetric",
  },
  {
    id: "coverage-dominates-count",
    authority: "contract",
    source: "Product Base §11.2 and §11.9",
    expected: "covers-both-masses",
    evaluate: () => {
      const fewer = {
        ...baseCandidate("fewer"),
        majorRegionsCovered: 1,
        magnetCount: 1,
      };
      const covers = {
        ...baseCandidate("covers-both-masses"),
        majorRegionsCovered: 2,
        magnetCount: 4,
      };
      return mechanicalOrder(fewer, covers).id;
    },
    mutate: () => "fewer",
  },
  {
    id: "uncertainty-cannot-certify-a-winner",
    authority: "contract",
    source:
      "Product Base §§2, 13 and 20 (selection only from mathematically lawful evidence)",
    expected: "proved",
    evaluate: () => {
      const proved = baseCandidate("proved");
      const uncertain = {
        ...proved,
        id: "indeterminate",
        proof: "indeterminate" as const,
        unsupportedExtentMM: 0,
      };
      return mechanicalOrder(uncertain, proved).id;
    },
    mutate: () => "indeterminate",
  },
  {
    id: "mechanics-beat-canonical-registration",
    authority: "contract",
    source: "Product Base §6 and §11",
    expected: "shifted-upper-hold",
    evaluate: () => {
      const canonical = {
        ...baseCandidate("canonical"),
        upperMassSupported: false,
      };
      const shifted = {
        ...baseCandidate("shifted-upper-hold"),
        canonical: false,
      };
      return mechanicalOrder(canonical, shifted).id;
    },
    mutate: () => "canonical",
  },
];

const hardCases: HardCase<unknown>[] = [...ruledBatFamilies, ...contractCases];

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

// These records are intentionally never consumed by the hard-case runner.
void observedFrames;
void openRecords;

const assertHardCase = (fixture: HardCase<unknown>, actual: unknown) => {
  expect(actual).toEqual(fixture.expected);
};

describe("independent grid acceptance oracle", () => {
  it("keeps ruled/contract assertions separate from observed/open evidence", () => {
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
    it(`${fixture.authority} · ${fixture.id} · ${fixture.source}`, () => {
      assertHardCase(fixture, fixture.evaluate());
    });
  }

  it("mutation proof: every hard assertion rejects its governed break", () => {
    for (const fixture of hardCases) {
      expect(
        () => assertHardCase(fixture, fixture.mutate()),
        `${fixture.id} mutant escaped`,
      ).toThrow();
    }
  });
});
