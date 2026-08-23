import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  applyProductLogic,
  NonTierableOrderingError,
  ProductLogicInputError,
  serializeCanonical,
} from "../dist/index.js";

const rational = (numerator, denominator = "1") => ({ numerator, denominator });
const point = (x, y) => ({ x: rational(x), y: rational(y) });
const orderedRational = (numerator, denominator = "1") => ({
  kind: "exact-rational",
  value: rational(numerator, denominator),
});

function position(column, row, clearance = "144") {
  return {
    column,
    row,
    center: point(column, row),
    centerLocation: "inside",
    clearance: {
      kind: "sqrt-rational",
      radicand: rational(clearance),
    },
    fits: true,
    limitingContacts: [
      {
        boundaryFeature: {
          kind: "edge",
          edgeIndex: "0",
          startVertexIndex: "0",
          endVertexIndex: "1",
        },
        boundaryPoint: point(column, "12"),
      },
    ],
  };
}

function makeDocuments({ sizes, candidateSpecs }) {
  const measurementDocument = {
    schema: "magnetic-grid-measurement-kernel/lattice/v1",
    sizes: sizes.map((size, sizeIndex) => ({
      size: size.value,
      scale: rational(size.value, "100"),
      positions: size.positions,
    })),
  };

  const candidates = candidateSpecs.map((spec, candidateIndex) => {
    const sizeIndex = spec.sizeIndex ?? 0;
    const sourceSize = measurementDocument.sizes[sizeIndex];
    const selected = spec.positionIndices.map((positionIndex) => {
      const fact = sourceSize.positions[positionIndex];
      return {
        column: fact.column,
        row: fact.row,
        center: structuredClone(fact.center),
        kernelFactRef: `/sizes/${sizeIndex}/positions/${positionIndex}`,
      };
    });
    return {
      id: spec.id ?? `candidate-${candidateIndex}`,
      size: {
        kernelSizeIndex: String(sizeIndex),
        value: sourceSize.size,
        kernelFactRef: `/sizes/${sizeIndex}`,
      },
      family: spec.family ?? (selected.length === 1 ? "single" : "run"),
      population: spec.population ?? "base",
      steps: spec.steps ?? (selected.length === 1
        ? { column: "0", row: "0" }
        : { column: "1", row: "0" }),
      positions: selected,
    };
  });

  return {
    measurementDocument,
    candidateDocument: {
      schema: "magnetic-grid-candidate-enumerator/candidates/v1",
      sourceMeasurementSchema: "magnetic-grid-measurement-kernel/lattice/v1",
      candidates,
    },
  };
}

function baseRules(sizeCount, {
  regionalPrecedence = "report-only",
  escalation,
  statusPolicy,
  bandOrder,
  sizeAssignments,
} = {}) {
  const order = bandOrder ?? ["band-a"];
  const assignments = sizeAssignments ?? Array.from({ length: sizeCount }, (_, index) => ({
    kernelSizeIndex: String(index),
    band: order[Math.min(index, order.length - 1)],
  }));
  const rules = {
    schema: "magnetic-grid-product-logic/rules/v1",
    gravity: {
      definitionId: "upper-material-v1",
      definition: {
        suppliedBy: "fixture",
        term: "caller-defined upper material",
      },
    },
    tightWrap: {
      definitionId: "wrap-v1",
      definition: {
        suppliedBy: "fixture",
        term: "caller-defined unsupported material",
      },
      comparator: {
        kind: "exact-rational",
        direction: "lower-is-better",
      },
    },
    regionalSupport: {
      definitionId: "regions-v1",
      definition: {
        suppliedBy: "fixture",
        term: "caller-defined masses",
      },
      comparator: {
        kind: "exact-rational",
        direction: "higher-is-better",
      },
      precedence: regionalPrecedence,
    },
    bands: {
      order,
      sizeAssignments: assignments,
    },
  };
  if (escalation !== undefined) {
    rules.escalation = escalation;
  }
  if (statusPolicy !== undefined) {
    rules.statusPolicy = statusPolicy;
  }
  return rules;
}

function judgement(candidateIndex, {
  gravity = true,
  wrap = "0",
  regional = "0",
  gravityBasis = "fixture-gravity",
  wrapBasis = "fixture-wrap",
  regionalBasis = "fixture-regions",
} = {}) {
  return {
    candidateRef: `/candidates/${candidateIndex}`,
    gravity: {
      holdsUpperMaterial: gravity,
      basis: { observation: gravityBasis },
    },
    tightWrap: {
      value: orderedRational(wrap),
      basis: { observation: wrapBasis },
    },
    regionalSupport: {
      value: orderedRational(regional),
      basis: { observation: regionalBasis },
    },
  };
}

function inputFrom(documents, judgements, rules = baseRules(documents.measurementDocument.sizes.length)) {
  return {
    candidateDocument: documents.candidateDocument,
    measurementDocument: documents.measurementDocument,
    rules,
    judgements,
  };
}

function tierRefs(result) {
  return result.ordering.tiers.map((tier) => [...tier.candidateRefs]);
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const member of Object.values(value)) {
      deepFreeze(member);
    }
  }
  return value;
}

test("gravity: a low cluster ranks below a top-holding candidate even with more positions", () => {
  const documents = makeDocuments({
    sizes: [{
      value: "100",
      positions: [position("0", "0"), position("1", "0"), position("2", "0"), position("0", "2")],
    }],
    candidateSpecs: [
      { family: "run", positionIndices: [0, 1, 2] },
      { family: "single", positionIndices: [3], steps: { column: "0", row: "0" } },
    ],
  });
  const input = inputFrom(documents, [
    judgement(0, { gravity: false, wrap: "0", regional: "9", gravityBasis: "low cluster" }),
    judgement(1, { gravity: true, wrap: "9", regional: "1", gravityBasis: "holds top" }),
  ]);

  const result = applyProductLogic(input);
  assert.deepEqual(tierRefs(result), [["/candidates/1"], ["/candidates/0"]]);
  assert.equal(result.ordering.boundaries[0].decisions[0].rule, "gravity");
});

test("tight wrap: a narrower arrangement covering the same masses ranks above a wider one", () => {
  const documents = makeDocuments({
    sizes: [{
      value: "100",
      positions: [position("0", "0"), position("1", "0"), position("3", "0")],
    }],
    candidateSpecs: [
      { family: "run", positionIndices: [0, 1] },
      { family: "run", positionIndices: [0, 2], steps: { column: "3", row: "0" } },
    ],
  });
  const result = applyProductLogic(inputFrom(documents, [
    judgement(0, { gravity: true, wrap: "2", regional: "7", wrapBasis: "narrow" }),
    judgement(1, { gravity: true, wrap: "5", regional: "7", wrapBasis: "wide" }),
  ]));

  assert.deepEqual(tierRefs(result), [["/candidates/0"], ["/candidates/1"]]);
  assert.equal(result.ordering.boundaries[0].decisions[0].rule, "tight-wrap");
});

test("regional support: one-mass concentration ranks below spread support when precedence is supplied", () => {
  const documents = makeDocuments({
    sizes: [{
      value: "100",
      positions: [position("0", "0"), position("1", "0"), position("4", "0")],
    }],
    candidateSpecs: [
      { family: "run", positionIndices: [0, 1] },
      { family: "run", positionIndices: [0, 2], steps: { column: "4", row: "0" } },
    ],
  });
  const rules = baseRules(1, { regionalPrecedence: "between-gravity-and-tight-wrap" });
  const result = applyProductLogic(inputFrom(documents, [
    judgement(0, { gravity: true, wrap: "3", regional: "1", regionalBasis: "one mass" }),
    judgement(1, { gravity: true, wrap: "3", regional: "2", regionalBasis: "both masses" }),
  ], rules));

  assert.deepEqual(tierRefs(result), [["/candidates/1"], ["/candidates/0"]]);
  assert.equal(result.ordering.boundaries[0].decisions[0].rule, "regional-support");
  assert.equal(
    result.evaluations[0].judgements.regionalSupport.basis.observation,
    "one mass",
  );
});

test("escalation: an explicitly stronger next-band candidate outranks every candidate in an insufficient band", () => {
  const documents = makeDocuments({
    sizes: [
      { value: "100", positions: [position("0", "0"), position("1", "0")] },
      { value: "112", positions: [position("0", "0")] },
    ],
    candidateSpecs: [
      { sizeIndex: 0, family: "single", positionIndices: [0], steps: { column: "0", row: "0" } },
      { sizeIndex: 0, family: "single", positionIndices: [1], steps: { column: "0", row: "0" } },
      { sizeIndex: 1, family: "single", positionIndices: [0], steps: { column: "0", row: "0" } },
    ],
  });
  const escalation = {
    policyId: "escalation-v1",
    bandAssessments: [
      {
        band: "band-a",
        supportInsufficient: true,
        triggerDefinitionId: "band-support-oracle",
        triggerInput: { ruling: "no candidate supports all masses" },
      },
      {
        band: "band-b",
        supportInsufficient: false,
        triggerDefinitionId: "band-support-oracle",
        triggerInput: { ruling: "sufficient" },
      },
    ],
    promotions: [
      {
        sourceBand: "band-a",
        targetBand: "band-b",
        targetCandidateRef: "/candidates/2",
        strengthDefinitionId: "strength-oracle",
        strengthInput: { ruling: "stronger than every band-a candidate" },
      },
    ],
  };
  const rules = baseRules(2, {
    bandOrder: ["band-a", "band-b"],
    sizeAssignments: [
      { kernelSizeIndex: "0", band: "band-a" },
      { kernelSizeIndex: "1", band: "band-b" },
    ],
    escalation,
  });
  const result = applyProductLogic(inputFrom(documents, [
    judgement(0, { gravity: true, wrap: "0", regional: "5" }),
    judgement(1, { gravity: true, wrap: "0", regional: "5" }),
    judgement(2, { gravity: false, wrap: "9", regional: "0" }),
  ], rules));

  assert.deepEqual(tierRefs(result), [["/candidates/2"], ["/candidates/0", "/candidates/1"]]);
  assert.ok(result.ordering.boundaries[0].decisions.every((decision) => decision.rule === "escalation"));
  assert.equal(result.ordering.boundaries[0].decisions.length, 2);
});

test("unresolved comparison: report-only regional differences do not split a tier", () => {
  const documents = makeDocuments({
    sizes: [{ value: "100", positions: [position("0", "0"), position("1", "0")] }],
    candidateSpecs: [
      { family: "single", positionIndices: [0], steps: { column: "0", row: "0" } },
      { family: "single", positionIndices: [1], steps: { column: "0", row: "0" } },
    ],
  });
  const result = applyProductLogic(inputFrom(documents, [
    judgement(0, { gravity: true, wrap: "4", regional: "1" }),
    judgement(1, { gravity: true, wrap: "4", regional: "99" }),
  ]));

  assert.deepEqual(tierRefs(result), [["/candidates/0", "/candidates/1"]]);
  assert.deepEqual(result.ordering.boundaries, []);
  assert.equal(result.evaluations[0].judgements.regionalSupport.precedence, "report-only");
});

test("identical inputs yield identical bytes; changed judgements yield a different explained order", () => {
  const documents = makeDocuments({
    sizes: [{ value: "100", positions: [position("0", "0"), position("1", "0")] }],
    candidateSpecs: [
      { family: "single", positionIndices: [0], steps: { column: "0", row: "0" } },
      { family: "single", positionIndices: [1], steps: { column: "0", row: "0" } },
    ],
  });
  const original = inputFrom(documents, [
    judgement(0, { gravity: false, wrap: "0", regional: "0" }),
    judgement(1, { gravity: true, wrap: "0", regional: "0" }),
  ]);
  const first = serializeCanonical(applyProductLogic(original));
  const second = serializeCanonical(applyProductLogic(original));
  assert.equal(first, second);

  const changed = structuredClone(original);
  changed.judgements[0].gravity.holdsUpperMaterial = true;
  changed.judgements[1].gravity.holdsUpperMaterial = false;
  const changedOutput = applyProductLogic(changed);
  const changedBytes = serializeCanonical(changedOutput);
  assert.notEqual(first, changedBytes);
  assert.deepEqual(tierRefs(changedOutput), [["/candidates/0"], ["/candidates/1"]]);
  assert.equal(changedOutput.ordering.boundaries[0].decisions[0].rule, "gravity");
});

test("candidate document is consumed without mutation, including under deep freeze", () => {
  const documents = makeDocuments({
    sizes: [{ value: "100", positions: [position("0", "0")] }],
    candidateSpecs: [
      { family: "single", positionIndices: [0], steps: { column: "0", row: "0" } },
    ],
  });
  const input = inputFrom(documents, [judgement(0)]);
  const before = serializeCanonical(input.candidateDocument);
  deepFreeze(input);
  const result = applyProductLogic(input);
  const after = serializeCanonical(input.candidateDocument);

  assert.equal(after, before);
  assert.deepEqual(result.candidateDocument, input.candidateDocument);
  assert.notStrictEqual(result.candidateDocument, input.candidateDocument);
});

test("all five upstream families are preserved; family never orders candidates", () => {
  const documents = makeDocuments({
    sizes: [{
      value: "100",
      positions: [position("0", "0"), position("1", "0"), position("0", "1"), position("1", "1")],
    }],
    candidateSpecs: [
      { family: "single", positionIndices: [0], steps: { column: "0", row: "0" } },
      { family: "run", positionIndices: [0, 1] },
      { family: "rectangle-corners", positionIndices: [0, 1, 2, 3], steps: { column: "1", row: "1" } },
      { family: "corner-triangle", positionIndices: [0, 1, 2], steps: { column: "1", row: "1" } },
      { family: "full-window", positionIndices: [0, 1, 2, 3], steps: { column: "1", row: "1" } },
    ],
  });
  const result = applyProductLogic(inputFrom(documents, [0, 1, 2, 3, 4].map((index) => judgement(index))));

  assert.equal(result.candidateDocument.candidates.length, 5);
  assert.deepEqual(
    result.candidateDocument.candidates.map((candidate) => candidate.family),
    ["single", "run", "rectangle-corners", "corner-triangle", "full-window"],
  );
  assert.deepEqual(tierRefs(result), [[
    "/candidates/0",
    "/candidates/1",
    "/candidates/2",
    "/candidates/3",
    "/candidates/4",
  ]]);
});

test("no status policy is stated per candidate rather than guessed", () => {
  const documents = makeDocuments({
    sizes: [{ value: "100", positions: [position("0", "0")] }],
    candidateSpecs: [{ family: "single", positionIndices: [0], steps: { column: "0", row: "0" } }],
  });
  const result = applyProductLogic(inputFrom(documents, [judgement(0)]));
  assert.deepEqual(result.evaluations[0].status, { kind: "not-supplied" });
  assert.deepEqual(result.ruleDefinitions.statusPolicy, { kind: "not-supplied" });
});

test("a supplied status policy is copied exactly and does not alter ordering", () => {
  const documents = makeDocuments({
    sizes: [{ value: "100", positions: [position("0", "0"), position("1", "0")] }],
    candidateSpecs: [
      { family: "single", positionIndices: [0], steps: { column: "0", row: "0" } },
      { family: "single", positionIndices: [1], steps: { column: "0", row: "0" } },
    ],
  });
  const statusPolicy = {
    policyId: "status-v1",
    definition: { boundary: "caller supplied" },
    assignments: [
      { candidateRef: "/candidates/0", status: "refused", policyInput: { ruling: "oracle-a" } },
      { candidateRef: "/candidates/1", status: "preferred", policyInput: { ruling: "oracle-b" } },
    ],
  };
  const result = applyProductLogic(inputFrom(
    documents,
    [judgement(0), judgement(1)],
    baseRules(1, { statusPolicy }),
  ));

  assert.deepEqual(tierRefs(result), [["/candidates/0", "/candidates/1"]]);
  assert.equal(result.evaluations[0].status.status, "refused");
  assert.equal(result.evaluations[1].status.status, "preferred");
});

test("referenced exact clearance and limiting witnesses are copied, never reconstructed", () => {
  const fact = position("7", "9", "169");
  const documents = makeDocuments({
    sizes: [{ value: "100", positions: [fact] }],
    candidateSpecs: [{ family: "single", positionIndices: [0], steps: { column: "0", row: "0" } }],
  });
  const result = applyProductLogic(inputFrom(documents, [judgement(0)]));
  const copied = result.evaluations[0].supportingKernelFacts[0];
  assert.equal(copied.kernelFactRef, "/sizes/0/positions/0");
  assert.deepEqual(copied.fact.clearance, fact.clearance);
  assert.deepEqual(copied.fact.limitingContacts, fact.limitingContacts);
});

test("JavaScript numeric rule input is rejected rather than rounded or compared", () => {
  const documents = makeDocuments({
    sizes: [{ value: "100", positions: [position("0", "0")] }],
    candidateSpecs: [{ family: "single", positionIndices: [0], steps: { column: "0", row: "0" } }],
  });
  const input = inputFrom(documents, [judgement(0)]);
  input.judgements[0].gravity.basis = { forbiddenFloat: 0.5 };
  assert.throws(
    () => applyProductLogic(input),
    (error) => error instanceof ProductLogicInputError && error.code === "INVALID_EXACT_JSON",
  );
});


test("canonical example fixture matches byte-for-byte", () => {
  const input = JSON.parse(readFileSync(new URL("../fixtures/example-input.json", import.meta.url), "utf8"));
  const expected = readFileSync(
    new URL("../fixtures/example-output.canonical.json", import.meta.url),
    "utf8",
  );
  const actual = `${serializeCanonical(applyProductLogic(input))}\n`;
  assert.equal(actual, expected);
});


test("exact rational comparison uses cross multiplication", () => {
  const documents = makeDocuments({
    sizes: [{ value: "100", positions: [position("0", "0"), position("1", "0")] }],
    candidateSpecs: [
      { family: "single", positionIndices: [0], steps: { column: "0", row: "0" } },
      { family: "single", positionIndices: [1], steps: { column: "0", row: "0" } },
    ],
  });
  const left = judgement(0, { gravity: true, wrap: "0", regional: "0" });
  const right = judgement(1, { gravity: true, wrap: "0", regional: "0" });
  left.tightWrap.value = orderedRational("1", "3");
  right.tightWrap.value = orderedRational("2", "5");
  const result = applyProductLogic(inputFrom(documents, [left, right]));
  assert.deepEqual(tierRefs(result), [["/candidates/0"], ["/candidates/1"]]);
  assert.deepEqual(
    result.ordering.boundaries[0].decisions[0].higherValue,
    orderedRational("1", "3"),
  );
});

test("contradictory supplied rulings stop instead of inventing tiers", () => {
  const documents = makeDocuments({
    sizes: [
      { value: "100", positions: [position("0", "0")] },
      { value: "112", positions: [position("0", "0")] },
      { value: "124", positions: [position("0", "0")] },
    ],
    candidateSpecs: [
      { sizeIndex: 0, family: "single", positionIndices: [0], steps: { column: "0", row: "0" } },
      { sizeIndex: 1, family: "single", positionIndices: [0], steps: { column: "0", row: "0" } },
      { sizeIndex: 2, family: "single", positionIndices: [0], steps: { column: "0", row: "0" } },
    ],
  });
  const escalation = {
    policyId: "cycle-policy",
    bandAssessments: [
      { band: "a", supportInsufficient: true, triggerDefinitionId: "t", triggerInput: "a-insufficient" },
      { band: "b", supportInsufficient: true, triggerDefinitionId: "t", triggerInput: "b-insufficient" },
      { band: "c", supportInsufficient: false, triggerDefinitionId: "t", triggerInput: "c-sufficient" },
    ],
    promotions: [
      {
        sourceBand: "a",
        targetBand: "b",
        targetCandidateRef: "/candidates/1",
        strengthDefinitionId: "s",
        strengthInput: "b-over-a",
      },
      {
        sourceBand: "b",
        targetBand: "c",
        targetCandidateRef: "/candidates/2",
        strengthDefinitionId: "s",
        strengthInput: "c-over-b",
      },
    ],
  };
  const rules = baseRules(3, {
    bandOrder: ["a", "b", "c"],
    sizeAssignments: [
      { kernelSizeIndex: "0", band: "a" },
      { kernelSizeIndex: "1", band: "b" },
      { kernelSizeIndex: "2", band: "c" },
    ],
    escalation,
  });
  const input = inputFrom(documents, [
    judgement(0, { gravity: true, wrap: "0", regional: "0" }),
    judgement(1, { gravity: false, wrap: "0", regional: "0" }),
    judgement(2, { gravity: false, wrap: "0", regional: "0" }),
  ], rules);

  assert.throws(
    () => applyProductLogic(input),
    (error) => error instanceof NonTierableOrderingError,
  );
});
