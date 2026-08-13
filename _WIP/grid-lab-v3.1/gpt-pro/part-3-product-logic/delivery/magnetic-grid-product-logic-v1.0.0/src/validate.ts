import { cloneExact } from "./clone.js";
import { ProductLogicInputError } from "./errors.js";
import {
  assertAllowedKeys,
  assertExactKeys,
  isRecord,
  nonemptyString,
  parseDecimalInteger,
  parseNonnegativeDecimalInteger,
  validateExactJson,
  validateOrderedComparator,
  validateOrderedValue,
  validateRational,
} from "./exact.js";
import {
  candidatePointer,
  parseCandidatePointer,
  parsePositionPointer,
  parseSizePointer,
} from "./pointer.js";
import { serializeCanonical } from "./serialize.js";
import type {
  ApplyProductLogicInput,
  BandRulesInput,
  BandSupportAssessmentInput,
  BoundaryFeatureJson,
  CandidateEnumerationDocumentJson,
  CandidateEvaluationJson,
  CandidateFamily,
  CandidateJson,
  CandidateJudgementInput,
  CandidateStatusJson,
  EscalationPolicyInput,
  EscalationPromotionInput,
  ExactJsonValue,
  GravityRuleInput,
  LatticeMeasurementDocumentJson,
  LatticePositionMeasurementJson,
  OrderedValueComparatorInput,
  PointBoundaryContactJson,
  ProductRulesInput,
  RationalPointJson,
  RegionalPrecedence,
  RegionalSupportRuleInput,
  SizeMeasurementJson,
  StatusPolicyInput,
  SupportingKernelFactJson,
  TightWrapRuleInput,
} from "./types.js";

const FAMILY_SET = new Set<CandidateFamily>([
  "single",
  "run",
  "rectangle-corners",
  "corner-triangle",
  "full-window",
]);

const REGIONAL_PRECEDENCE_SET = new Set<RegionalPrecedence>([
  "report-only",
  "before-gravity",
  "between-gravity-and-tight-wrap",
  "after-tight-wrap",
]);

export interface ValidatedBandAssessment extends BandSupportAssessmentInput {
  readonly orderIndex: number;
}

export interface ValidatedPromotion extends EscalationPromotionInput {
  readonly inputIndex: number;
  readonly assessment: ValidatedBandAssessment;
}

export interface ValidatedCandidate {
  readonly index: number;
  readonly ref: string;
  readonly candidate: CandidateJson;
  readonly sizeIndex: number;
  readonly bandId: string;
  readonly bandOrderIndex: number;
  readonly judgement: CandidateJudgementInput;
  readonly supportingKernelFacts: readonly SupportingKernelFactJson[];
  readonly status: CandidateStatusJson;
  readonly promotionsAsTarget: readonly ValidatedPromotion[];
}

export interface ValidatedRules {
  readonly gravity: GravityRuleInput;
  readonly tightWrap: TightWrapRuleInput;
  readonly regionalSupport: RegionalSupportRuleInput;
  readonly bands: BandRulesInput;
  readonly bandOrderIndex: ReadonlyMap<string, number>;
  readonly sizeBandByIndex: ReadonlyMap<number, string>;
  readonly escalation: EscalationPolicyInput | undefined;
  readonly bandAssessmentById: ReadonlyMap<string, ValidatedBandAssessment>;
  readonly promotionByTargetAndSourceBand: ReadonlyMap<string, ValidatedPromotion>;
  readonly promotionsByTargetRef: ReadonlyMap<string, readonly ValidatedPromotion[]>;
  readonly statusPolicy: StatusPolicyInput | undefined;
}

export interface ValidatedInput {
  readonly candidateDocument: CandidateEnumerationDocumentJson;
  readonly measurementDocument: LatticeMeasurementDocumentJson;
  readonly rules: ValidatedRules;
  readonly candidates: readonly ValidatedCandidate[];
}

interface CandidateBase {
  readonly index: number;
  readonly ref: string;
  readonly candidate: CandidateJson;
  readonly sizeIndex: number;
  readonly supportingKernelFacts: readonly SupportingKernelFactJson[];
}

export function validateInput(input: ApplyProductLogicInput): ValidatedInput {
  const root = input as unknown;
  if (!isRecord(root)) {
    throw new ProductLogicInputError("INVALID_INPUT", "input", "expected an object");
  }
  assertExactKeys(
    root,
    ["candidateDocument", "judgements", "measurementDocument", "rules"],
    "input",
  );

  // This clone is also the exact-JSON gate for all upstream metadata retained in output.
  const candidateDocument = validateCandidateDocument(root.candidateDocument);
  const measurementDocument = validateMeasurementDocument(root.measurementDocument);
  const candidateBases = validateCandidateSources(candidateDocument, measurementDocument);
  const rules = validateRules(root.rules, measurementDocument, candidateBases);
  const judgementsByRef = validateJudgements(
    root.judgements,
    candidateBases,
    rules.tightWrap.comparator,
    rules.regionalSupport.comparator,
  );
  const statusByRef = validateStatusAssignments(rules.statusPolicy, candidateBases);

  const candidates: ValidatedCandidate[] = candidateBases.map((base) => {
    const bandId = rules.sizeBandByIndex.get(base.sizeIndex);
    if (bandId === undefined) {
      throw new Error("internal invariant: every size has a validated band assignment");
    }
    const bandOrderIndex = rules.bandOrderIndex.get(bandId);
    if (bandOrderIndex === undefined) {
      throw new Error("internal invariant: assigned band is ordered");
    }
    const judgement = judgementsByRef.get(base.ref);
    if (judgement === undefined) {
      throw new Error("internal invariant: every candidate has a validated judgement");
    }
    const status = statusByRef.get(base.ref) ?? { kind: "not-supplied" as const };
    return {
      ...base,
      bandId,
      bandOrderIndex,
      judgement,
      status,
      promotionsAsTarget: rules.promotionsByTargetRef.get(base.ref) ?? [],
    };
  });

  return {
    candidateDocument,
    measurementDocument,
    rules,
    candidates,
  };
}

function validateCandidateDocument(value: unknown): CandidateEnumerationDocumentJson {
  const cloned = cloneExact(value, "input.candidateDocument");
  if (!isRecord(cloned)) {
    throw new ProductLogicInputError(
      "INVALID_INPUT",
      "input.candidateDocument",
      "expected an object",
    );
  }
  if (cloned.schema !== "magnetic-grid-candidate-enumerator/candidates/v1") {
    throw new ProductLogicInputError(
      "INVALID_SCHEMA",
      "input.candidateDocument.schema",
      "expected magnetic-grid-candidate-enumerator/candidates/v1",
    );
  }
  if (cloned.sourceMeasurementSchema !== "magnetic-grid-measurement-kernel/lattice/v1") {
    throw new ProductLogicInputError(
      "INVALID_SCHEMA",
      "input.candidateDocument.sourceMeasurementSchema",
      "expected magnetic-grid-measurement-kernel/lattice/v1",
    );
  }
  if (!Array.isArray(cloned.candidates)) {
    throw new ProductLogicInputError(
      "INVALID_INPUT",
      "input.candidateDocument.candidates",
      "expected an array",
    );
  }
  return cloned as unknown as CandidateEnumerationDocumentJson;
}

function validateMeasurementDocument(value: unknown): LatticeMeasurementDocumentJson {
  const cloned = cloneExact(value, "input.measurementDocument");
  if (!isRecord(cloned)) {
    throw new ProductLogicInputError(
      "INVALID_INPUT",
      "input.measurementDocument",
      "expected an object",
    );
  }
  if (cloned.schema !== "magnetic-grid-measurement-kernel/lattice/v1") {
    throw new ProductLogicInputError(
      "INVALID_SCHEMA",
      "input.measurementDocument.schema",
      "expected magnetic-grid-measurement-kernel/lattice/v1",
    );
  }
  if (!Array.isArray(cloned.sizes)) {
    throw new ProductLogicInputError(
      "INVALID_INPUT",
      "input.measurementDocument.sizes",
      "expected an array",
    );
  }
  cloned.sizes.forEach((size, index) => validateSizeMeasurement(size, `input.measurementDocument.sizes[${index}]`));
  return cloned as unknown as LatticeMeasurementDocumentJson;
}

function validateSizeMeasurement(value: unknown, path: string): asserts value is SizeMeasurementJson {
  if (!isRecord(value)) {
    throw new ProductLogicInputError("INVALID_INPUT", path, "expected an object");
  }
  parseDecimalInteger(value.size, `${path}.size`);
  validateRational(value.scale, `${path}.scale`);
  if (!Array.isArray(value.positions)) {
    throw new ProductLogicInputError("INVALID_INPUT", `${path}.positions`, "expected an array");
  }
  value.positions.forEach((position, index) =>
    validatePositionMeasurement(position, `${path}.positions[${index}]`),
  );
}

function validatePositionMeasurement(
  value: unknown,
  path: string,
): asserts value is LatticePositionMeasurementJson {
  if (!isRecord(value)) {
    throw new ProductLogicInputError("INVALID_INPUT", path, "expected an object");
  }
  parseDecimalInteger(value.column, `${path}.column`);
  parseDecimalInteger(value.row, `${path}.row`);
  validateRationalPoint(value.center, `${path}.center`);
  if (
    value.centerLocation !== "inside" &&
    value.centerLocation !== "outside" &&
    value.centerLocation !== "boundary"
  ) {
    throw new ProductLogicInputError(
      "INVALID_INPUT",
      `${path}.centerLocation`,
      "expected inside, outside, or boundary",
    );
  }
  if (!isRecord(value.clearance) || value.clearance.kind !== "sqrt-rational") {
    throw new ProductLogicInputError(
      "INVALID_INPUT",
      `${path}.clearance`,
      "expected a sqrt-rational object",
    );
  }
  validateRational(value.clearance.radicand, `${path}.clearance.radicand`);
  if (typeof value.fits !== "boolean") {
    throw new ProductLogicInputError("INVALID_INPUT", `${path}.fits`, "expected a boolean");
  }
  if (!Array.isArray(value.limitingContacts)) {
    throw new ProductLogicInputError(
      "INVALID_INPUT",
      `${path}.limitingContacts`,
      "expected an array",
    );
  }
  value.limitingContacts.forEach((contact, index) =>
    validatePointBoundaryContact(contact, `${path}.limitingContacts[${index}]`),
  );
}

function validatePointBoundaryContact(
  value: unknown,
  path: string,
): asserts value is PointBoundaryContactJson {
  if (!isRecord(value)) {
    throw new ProductLogicInputError("INVALID_INPUT", path, "expected an object");
  }
  validateBoundaryFeature(value.boundaryFeature, `${path}.boundaryFeature`);
  validateRationalPoint(value.boundaryPoint, `${path}.boundaryPoint`);
}

function validateBoundaryFeature(value: unknown, path: string): asserts value is BoundaryFeatureJson {
  if (!isRecord(value)) {
    throw new ProductLogicInputError("INVALID_INPUT", path, "expected an object");
  }
  if (value.kind === "edge") {
    parseDecimalInteger(value.edgeIndex, `${path}.edgeIndex`);
    parseDecimalInteger(value.startVertexIndex, `${path}.startVertexIndex`);
    parseDecimalInteger(value.endVertexIndex, `${path}.endVertexIndex`);
    return;
  }
  if (value.kind === "vertex") {
    parseDecimalInteger(value.vertexIndex, `${path}.vertexIndex`);
    return;
  }
  throw new ProductLogicInputError(
    "INVALID_INPUT",
    `${path}.kind`,
    "expected edge or vertex",
  );
}

function validateRationalPoint(value: unknown, path: string): RationalPointJson {
  if (!isRecord(value)) {
    throw new ProductLogicInputError("INVALID_RATIONAL", path, "expected an object");
  }
  const x = validateRational(value.x, `${path}.x`);
  const y = validateRational(value.y, `${path}.y`);
  return { x, y };
}

function validateCandidateSources(
  document: CandidateEnumerationDocumentJson,
  measurement: LatticeMeasurementDocumentJson,
): readonly CandidateBase[] {
  const seenOccurrences = new Set<string>();
  const candidates: CandidateBase[] = [];

  document.candidates.forEach((candidateValue, index) => {
    const path = `input.candidateDocument.candidates[${index}]`;
    if (!isRecord(candidateValue)) {
      throw new ProductLogicInputError("INVALID_INPUT", path, "expected an object");
    }
    const id = nonemptyString(candidateValue.id, `${path}.id`);
    const family = candidateValue.family;
    if (typeof family !== "string" || !FAMILY_SET.has(family as CandidateFamily)) {
      throw new ProductLogicInputError(
        "INVALID_INPUT",
        `${path}.family`,
        "expected single, run, rectangle-corners, corner-triangle, or full-window",
      );
    }
    nonemptyString(candidateValue.population, `${path}.population`);
    if (!isRecord(candidateValue.steps)) {
      throw new ProductLogicInputError("INVALID_INPUT", `${path}.steps`, "expected an object");
    }
    parseDecimalInteger(candidateValue.steps.column, `${path}.steps.column`);
    parseDecimalInteger(candidateValue.steps.row, `${path}.steps.row`);

    if (!isRecord(candidateValue.size)) {
      throw new ProductLogicInputError("INVALID_INPUT", `${path}.size`, "expected an object");
    }
    const sizeIndexBig = parseNonnegativeDecimalInteger(
      candidateValue.size.kernelSizeIndex,
      `${path}.size.kernelSizeIndex`,
    );
    if (sizeIndexBig > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new ProductLogicInputError(
        "INVALID_POINTER",
        `${path}.size.kernelSizeIndex`,
        "size index exceeds JavaScript safe array indexing range",
      );
    }
    const sizeIndex = Number(sizeIndexBig);
    const pointerIndex = parseSizePointer(candidateValue.size.kernelFactRef, `${path}.size.kernelFactRef`);
    if (pointerIndex !== sizeIndex) {
      throw new ProductLogicInputError(
        "SOURCE_FACT_MISMATCH",
        `${path}.size.kernelFactRef`,
        "pointer does not match kernelSizeIndex",
      );
    }
    const sizeFact = measurement.sizes[sizeIndex];
    if (sizeFact === undefined) {
      throw new ProductLogicInputError(
        "MISSING_SOURCE_FACT",
        `${path}.size.kernelFactRef`,
        "referenced kernel size fact is absent",
      );
    }
    parseDecimalInteger(candidateValue.size.value, `${path}.size.value`);
    if (candidateValue.size.value !== sizeFact.size) {
      throw new ProductLogicInputError(
        "SOURCE_FACT_MISMATCH",
        `${path}.size.value`,
        "candidate size value is not the referenced kernel size value",
      );
    }

    const occurrenceKey = `${sizeIndex}:${id}`;
    if (seenOccurrences.has(occurrenceKey)) {
      throw new ProductLogicInputError(
        "DUPLICATE_INPUT",
        path,
        "candidate id is duplicated within the same kernel size occurrence",
      );
    }
    seenOccurrences.add(occurrenceKey);

    if (!Array.isArray(candidateValue.positions) || candidateValue.positions.length === 0) {
      throw new ProductLogicInputError(
        "INVALID_INPUT",
        `${path}.positions`,
        "expected a non-empty candidate position set",
      );
    }

    const supportingKernelFacts: SupportingKernelFactJson[] = [];
    const seenPositionPointers = new Set<string>();
    candidateValue.positions.forEach((positionValue, positionIndex) => {
      const positionPath = `${path}.positions[${positionIndex}]`;
      if (!isRecord(positionValue)) {
        throw new ProductLogicInputError("INVALID_INPUT", positionPath, "expected an object");
      }
      parseDecimalInteger(positionValue.column, `${positionPath}.column`);
      parseDecimalInteger(positionValue.row, `${positionPath}.row`);
      validateRationalPoint(positionValue.center, `${positionPath}.center`);
      const sourcePointer = nonemptyString(positionValue.kernelFactRef, `${positionPath}.kernelFactRef`);
      if (seenPositionPointers.has(sourcePointer)) {
        throw new ProductLogicInputError(
          "DUPLICATE_INPUT",
          `${positionPath}.kernelFactRef`,
          "candidate position set contains the same kernel fact more than once",
        );
      }
      seenPositionPointers.add(sourcePointer);
      const parsedPointer = parsePositionPointer(sourcePointer, `${positionPath}.kernelFactRef`);
      if (parsedPointer.sizeIndex !== sizeIndex) {
        throw new ProductLogicInputError(
          "SOURCE_FACT_MISMATCH",
          `${positionPath}.kernelFactRef`,
          "position fact belongs to a different kernel size occurrence",
        );
      }
      const sourceFact = sizeFact.positions[parsedPointer.positionIndex];
      if (sourceFact === undefined) {
        throw new ProductLogicInputError(
          "MISSING_SOURCE_FACT",
          `${positionPath}.kernelFactRef`,
          "referenced kernel position fact is absent",
        );
      }
      if (
        positionValue.column !== sourceFact.column ||
        positionValue.row !== sourceFact.row ||
        serializeCanonical(positionValue.center) !== serializeCanonical(sourceFact.center)
      ) {
        throw new ProductLogicInputError(
          "SOURCE_FACT_MISMATCH",
          positionPath,
          "candidate index or centre is not an exact copy of its referenced kernel fact",
        );
      }
      if (!sourceFact.fits) {
        throw new ProductLogicInputError(
          "UNHELD_CANDIDATE_POSITION",
          `${positionPath}.kernelFactRef`,
          "candidate references a kernel position whose fits fact is false",
        );
      }
      supportingKernelFacts.push({
        candidatePositionRef: `${candidatePointer(index)}/positions/${positionIndex}`,
        kernelFactRef: sourcePointer,
        fact: cloneExact(sourceFact, `${positionPath}.sourceFact`),
      });
    });

    candidates.push({
      index,
      ref: candidatePointer(index),
      candidate: candidateValue as CandidateJson,
      sizeIndex,
      supportingKernelFacts,
    });
  });

  return candidates;
}

function validateRules(
  value: unknown,
  measurement: LatticeMeasurementDocumentJson,
  candidates: readonly CandidateBase[],
): ValidatedRules {
  if (!isRecord(value)) {
    throw new ProductLogicInputError("INVALID_INPUT", "input.rules", "expected an object");
  }
  assertAllowedKeys(
    value,
    ["bands", "gravity", "regionalSupport", "schema", "tightWrap"],
    ["escalation", "statusPolicy"],
    "input.rules",
  );
  if (value.schema !== "magnetic-grid-product-logic/rules/v1") {
    throw new ProductLogicInputError(
      "INVALID_SCHEMA",
      "input.rules.schema",
      "expected magnetic-grid-product-logic/rules/v1",
    );
  }

  const gravity = validateGravityRule(value.gravity, "input.rules.gravity");
  const tightWrap = validateTightWrapRule(value.tightWrap, "input.rules.tightWrap");
  const regionalSupport = validateRegionalSupportRule(
    value.regionalSupport,
    "input.rules.regionalSupport",
  );
  const bands = validateBands(value.bands, measurement.sizes.length, "input.rules.bands");
  const bandOrderIndex = new Map<string, number>();
  bands.order.forEach((band, index) => bandOrderIndex.set(band, index));
  const sizeBandByIndex = new Map<number, string>();
  bands.sizeAssignments.forEach((assignment) =>
    sizeBandByIndex.set(Number(BigInt(assignment.kernelSizeIndex)), assignment.band),
  );

  const candidateRefs = new Set(candidates.map((candidate) => candidate.ref));
  const candidateBandByRef = new Map<string, string>();
  for (const candidate of candidates) {
    const band = sizeBandByIndex.get(candidate.sizeIndex);
    if (band === undefined) {
      throw new Error("internal invariant: every size is assigned to a band");
    }
    candidateBandByRef.set(candidate.ref, band);
  }

  const escalationResult = validateEscalation(
    value.escalation,
    bands,
    bandOrderIndex,
    candidateRefs,
    candidateBandByRef,
    "input.rules.escalation",
  );
  const statusPolicy = validateStatusPolicyDefinition(
    value.statusPolicy,
    "input.rules.statusPolicy",
  );

  return {
    gravity,
    tightWrap,
    regionalSupport,
    bands,
    bandOrderIndex,
    sizeBandByIndex,
    escalation: escalationResult.policy,
    bandAssessmentById: escalationResult.assessments,
    promotionByTargetAndSourceBand: escalationResult.byTargetAndSource,
    promotionsByTargetRef: escalationResult.byTarget,
    statusPolicy,
  };
}

function validateGravityRule(value: unknown, path: string): GravityRuleInput {
  if (!isRecord(value)) {
    throw new ProductLogicInputError("INVALID_INPUT", path, "expected an object");
  }
  assertExactKeys(value, ["definition", "definitionId"], path);
  return {
    definitionId: nonemptyString(value.definitionId, `${path}.definitionId`),
    definition: validateExactJson(value.definition, `${path}.definition`),
  };
}

function validateTightWrapRule(value: unknown, path: string): TightWrapRuleInput {
  if (!isRecord(value)) {
    throw new ProductLogicInputError("INVALID_INPUT", path, "expected an object");
  }
  assertExactKeys(value, ["comparator", "definition", "definitionId"], path);
  return {
    definitionId: nonemptyString(value.definitionId, `${path}.definitionId`),
    definition: validateExactJson(value.definition, `${path}.definition`),
    comparator: validateOrderedComparator(value.comparator, `${path}.comparator`),
  };
}

function validateRegionalSupportRule(value: unknown, path: string): RegionalSupportRuleInput {
  if (!isRecord(value)) {
    throw new ProductLogicInputError("INVALID_INPUT", path, "expected an object");
  }
  assertExactKeys(value, ["comparator", "definition", "definitionId", "precedence"], path);
  if (
    typeof value.precedence !== "string" ||
    !REGIONAL_PRECEDENCE_SET.has(value.precedence as RegionalPrecedence)
  ) {
    throw new ProductLogicInputError(
      "INVALID_RULE_VALUE",
      `${path}.precedence`,
      "expected report-only, before-gravity, between-gravity-and-tight-wrap, or after-tight-wrap",
    );
  }
  return {
    definitionId: nonemptyString(value.definitionId, `${path}.definitionId`),
    definition: validateExactJson(value.definition, `${path}.definition`),
    comparator: validateOrderedComparator(value.comparator, `${path}.comparator`),
    precedence: value.precedence as RegionalPrecedence,
  };
}

function validateBands(value: unknown, sizeCount: number, path: string): BandRulesInput {
  if (!isRecord(value)) {
    throw new ProductLogicInputError("INVALID_BAND_POLICY", path, "expected an object");
  }
  assertExactKeys(value, ["order", "sizeAssignments"], path);
  if (!Array.isArray(value.order)) {
    throw new ProductLogicInputError("INVALID_BAND_POLICY", `${path}.order`, "expected an array");
  }
  if (sizeCount > 0 && value.order.length === 0) {
    throw new ProductLogicInputError(
      "INVALID_BAND_POLICY",
      `${path}.order`,
      "at least one band is required when the measurement document has sizes",
    );
  }
  const order: string[] = [];
  const bandSet = new Set<string>();
  value.order.forEach((item, index) => {
    const band = nonemptyString(item, `${path}.order[${index}]`);
    if (bandSet.has(band)) {
      throw new ProductLogicInputError(
        "DUPLICATE_INPUT",
        `${path}.order[${index}]`,
        `duplicate band ${JSON.stringify(band)}`,
      );
    }
    bandSet.add(band);
    order.push(band);
  });

  if (!Array.isArray(value.sizeAssignments)) {
    throw new ProductLogicInputError(
      "INVALID_BAND_POLICY",
      `${path}.sizeAssignments`,
      "expected an array",
    );
  }
  const assignmentByIndex = new Map<number, { kernelSizeIndex: string; band: string }>();
  value.sizeAssignments.forEach((assignmentValue, assignmentIndex) => {
    const assignmentPath = `${path}.sizeAssignments[${assignmentIndex}]`;
    if (!isRecord(assignmentValue)) {
      throw new ProductLogicInputError("INVALID_BAND_POLICY", assignmentPath, "expected an object");
    }
    assertExactKeys(assignmentValue, ["band", "kernelSizeIndex"], assignmentPath);
    const exactIndex = parseNonnegativeDecimalInteger(
      assignmentValue.kernelSizeIndex,
      `${assignmentPath}.kernelSizeIndex`,
    );
    if (exactIndex > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new ProductLogicInputError(
        "INVALID_BAND_POLICY",
        `${assignmentPath}.kernelSizeIndex`,
        "index exceeds JavaScript safe array indexing range",
      );
    }
    const index = Number(exactIndex);
    if (index >= sizeCount) {
      throw new ProductLogicInputError(
        "INVALID_BAND_POLICY",
        `${assignmentPath}.kernelSizeIndex`,
        "referenced kernel size occurrence is absent",
      );
    }
    if (assignmentByIndex.has(index)) {
      throw new ProductLogicInputError(
        "DUPLICATE_INPUT",
        assignmentPath,
        "kernel size occurrence is assigned more than once",
      );
    }
    const band = nonemptyString(assignmentValue.band, `${assignmentPath}.band`);
    if (!bandSet.has(band)) {
      throw new ProductLogicInputError(
        "INVALID_BAND_POLICY",
        `${assignmentPath}.band`,
        "assigned band is absent from bands.order",
      );
    }
    assignmentByIndex.set(index, { kernelSizeIndex: exactIndex.toString(), band });
  });

  for (let index = 0; index < sizeCount; index += 1) {
    if (!assignmentByIndex.has(index)) {
      throw new ProductLogicInputError(
        "MISSING_INPUT",
        `${path}.sizeAssignments`,
        `kernel size occurrence ${index} has no band assignment`,
      );
    }
  }

  const sizeAssignments = [...assignmentByIndex.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, assignment]) => assignment);
  return { order, sizeAssignments };
}

function validateEscalation(
  value: unknown,
  bands: BandRulesInput,
  bandOrderIndex: ReadonlyMap<string, number>,
  candidateRefs: ReadonlySet<string>,
  candidateBandByRef: ReadonlyMap<string, string>,
  path: string,
): {
  readonly policy: EscalationPolicyInput | undefined;
  readonly assessments: ReadonlyMap<string, ValidatedBandAssessment>;
  readonly byTargetAndSource: ReadonlyMap<string, ValidatedPromotion>;
  readonly byTarget: ReadonlyMap<string, readonly ValidatedPromotion[]>;
} {
  if (value === undefined) {
    return {
      policy: undefined,
      assessments: new Map(),
      byTargetAndSource: new Map(),
      byTarget: new Map(),
    };
  }
  if (!isRecord(value)) {
    throw new ProductLogicInputError("INVALID_ESCALATION", path, "expected an object");
  }
  assertExactKeys(value, ["bandAssessments", "policyId", "promotions"], path);
  const policyId = nonemptyString(value.policyId, `${path}.policyId`);
  if (!Array.isArray(value.bandAssessments)) {
    throw new ProductLogicInputError(
      "INVALID_ESCALATION",
      `${path}.bandAssessments`,
      "expected an array",
    );
  }
  const assessments = new Map<string, ValidatedBandAssessment>();
  const assessmentOutput: BandSupportAssessmentInput[] = [];
  value.bandAssessments.forEach((assessmentValue, index) => {
    const assessmentPath = `${path}.bandAssessments[${index}]`;
    if (!isRecord(assessmentValue)) {
      throw new ProductLogicInputError("INVALID_ESCALATION", assessmentPath, "expected an object");
    }
    assertExactKeys(
      assessmentValue,
      ["band", "supportInsufficient", "triggerDefinitionId", "triggerInput"],
      assessmentPath,
    );
    const band = nonemptyString(assessmentValue.band, `${assessmentPath}.band`);
    const orderIndex = bandOrderIndex.get(band);
    if (orderIndex === undefined) {
      throw new ProductLogicInputError(
        "INVALID_ESCALATION",
        `${assessmentPath}.band`,
        "band is absent from bands.order",
      );
    }
    if (assessments.has(band)) {
      throw new ProductLogicInputError(
        "DUPLICATE_INPUT",
        assessmentPath,
        `band ${JSON.stringify(band)} is assessed more than once`,
      );
    }
    if (typeof assessmentValue.supportInsufficient !== "boolean") {
      throw new ProductLogicInputError(
        "INVALID_ESCALATION",
        `${assessmentPath}.supportInsufficient`,
        "expected a boolean caller ruling",
      );
    }
    const assessment: ValidatedBandAssessment = {
      band,
      supportInsufficient: assessmentValue.supportInsufficient,
      triggerDefinitionId: nonemptyString(
        assessmentValue.triggerDefinitionId,
        `${assessmentPath}.triggerDefinitionId`,
      ),
      triggerInput: validateExactJson(assessmentValue.triggerInput, `${assessmentPath}.triggerInput`),
      orderIndex,
    };
    assessments.set(band, assessment);
    assessmentOutput.push({
      band: assessment.band,
      supportInsufficient: assessment.supportInsufficient,
      triggerDefinitionId: assessment.triggerDefinitionId,
      triggerInput: assessment.triggerInput,
    });
  });
  for (const band of bands.order) {
    if (!assessments.has(band)) {
      throw new ProductLogicInputError(
        "MISSING_INPUT",
        `${path}.bandAssessments`,
        `band ${JSON.stringify(band)} has no explicit support-insufficiency ruling`,
      );
    }
  }

  if (!Array.isArray(value.promotions)) {
    throw new ProductLogicInputError(
      "INVALID_ESCALATION",
      `${path}.promotions`,
      "expected an array",
    );
  }
  const byTargetAndSource = new Map<string, ValidatedPromotion>();
  const mutableByTarget = new Map<string, ValidatedPromotion[]>();
  const promotionOutput: EscalationPromotionInput[] = [];
  value.promotions.forEach((promotionValue, index) => {
    const promotionPath = `${path}.promotions[${index}]`;
    if (!isRecord(promotionValue)) {
      throw new ProductLogicInputError("INVALID_ESCALATION", promotionPath, "expected an object");
    }
    assertExactKeys(
      promotionValue,
      [
        "sourceBand",
        "strengthDefinitionId",
        "strengthInput",
        "targetBand",
        "targetCandidateRef",
      ],
      promotionPath,
    );
    const sourceBand = nonemptyString(promotionValue.sourceBand, `${promotionPath}.sourceBand`);
    const targetBand = nonemptyString(promotionValue.targetBand, `${promotionPath}.targetBand`);
    const sourceIndex = bandOrderIndex.get(sourceBand);
    const targetIndex = bandOrderIndex.get(targetBand);
    if (sourceIndex === undefined || targetIndex === undefined) {
      throw new ProductLogicInputError(
        "INVALID_ESCALATION",
        promotionPath,
        "sourceBand and targetBand must both appear in bands.order",
      );
    }
    if (targetIndex !== sourceIndex + 1) {
      throw new ProductLogicInputError(
        "INVALID_ESCALATION",
        `${promotionPath}.targetBand`,
        "targetBand must be the immediate next band after sourceBand",
      );
    }
    const assessment = assessments.get(sourceBand);
    if (assessment === undefined || !assessment.supportInsufficient) {
      throw new ProductLogicInputError(
        "INVALID_ESCALATION",
        promotionPath,
        "a promotion requires an explicit insufficient=true ruling for its source band",
      );
    }
    const targetCandidateRef = nonemptyString(
      promotionValue.targetCandidateRef,
      `${promotionPath}.targetCandidateRef`,
    );
    const targetIndexValue = parseCandidatePointer(
      targetCandidateRef,
      `${promotionPath}.targetCandidateRef`,
    );
    if (!candidateRefs.has(targetCandidateRef)) {
      throw new ProductLogicInputError(
        "UNKNOWN_CANDIDATE",
        `${promotionPath}.targetCandidateRef`,
        `candidate index ${targetIndexValue} is absent`,
      );
    }
    if (candidateBandByRef.get(targetCandidateRef) !== targetBand) {
      throw new ProductLogicInputError(
        "INVALID_ESCALATION",
        `${promotionPath}.targetCandidateRef`,
        "target candidate does not belong to targetBand",
      );
    }
    const key = `${targetCandidateRef}\u0000${sourceBand}`;
    if (byTargetAndSource.has(key)) {
      throw new ProductLogicInputError(
        "DUPLICATE_INPUT",
        promotionPath,
        "the same target candidate is promoted over the same source band more than once",
      );
    }
    const promotion: ValidatedPromotion = {
      sourceBand,
      targetBand,
      targetCandidateRef,
      strengthDefinitionId: nonemptyString(
        promotionValue.strengthDefinitionId,
        `${promotionPath}.strengthDefinitionId`,
      ),
      strengthInput: validateExactJson(promotionValue.strengthInput, `${promotionPath}.strengthInput`),
      inputIndex: index,
      assessment,
    };
    byTargetAndSource.set(key, promotion);
    const targetList = mutableByTarget.get(targetCandidateRef) ?? [];
    targetList.push(promotion);
    mutableByTarget.set(targetCandidateRef, targetList);
    promotionOutput.push({
      sourceBand: promotion.sourceBand,
      targetBand: promotion.targetBand,
      targetCandidateRef: promotion.targetCandidateRef,
      strengthDefinitionId: promotion.strengthDefinitionId,
      strengthInput: promotion.strengthInput,
    });
  });

  const byTarget = new Map<string, readonly ValidatedPromotion[]>();
  for (const [target, promotions] of mutableByTarget) {
    promotions.sort((left, right) => {
      if (left.assessment.orderIndex !== right.assessment.orderIndex) {
        return left.assessment.orderIndex - right.assessment.orderIndex;
      }
      return left.inputIndex - right.inputIndex;
    });
    byTarget.set(target, promotions);
  }

  return {
    policy: {
      policyId,
      bandAssessments: assessmentOutput,
      promotions: promotionOutput,
    },
    assessments,
    byTargetAndSource,
    byTarget,
  };
}

function validateStatusPolicyDefinition(value: unknown, path: string): StatusPolicyInput | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new ProductLogicInputError("INVALID_STATUS_POLICY", path, "expected an object");
  }
  assertExactKeys(value, ["assignments", "definition", "policyId"], path);
  if (!Array.isArray(value.assignments)) {
    throw new ProductLogicInputError(
      "INVALID_STATUS_POLICY",
      `${path}.assignments`,
      "expected an array",
    );
  }
  return {
    policyId: nonemptyString(value.policyId, `${path}.policyId`),
    definition: validateExactJson(value.definition, `${path}.definition`),
    assignments: value.assignments.map((assignment, index) => {
      const assignmentPath = `${path}.assignments[${index}]`;
      if (!isRecord(assignment)) {
        throw new ProductLogicInputError(
          "INVALID_STATUS_POLICY",
          assignmentPath,
          "expected an object",
        );
      }
      assertExactKeys(assignment, ["candidateRef", "policyInput", "status"], assignmentPath);
      return {
        candidateRef: nonemptyString(assignment.candidateRef, `${assignmentPath}.candidateRef`),
        status: nonemptyString(assignment.status, `${assignmentPath}.status`),
        policyInput: validateExactJson(assignment.policyInput, `${assignmentPath}.policyInput`),
      };
    }),
  };
}

function validateJudgements(
  value: unknown,
  candidates: readonly CandidateBase[],
  tightWrapComparator: OrderedValueComparatorInput,
  regionalComparator: OrderedValueComparatorInput,
): ReadonlyMap<string, CandidateJudgementInput> {
  if (!Array.isArray(value)) {
    throw new ProductLogicInputError("INVALID_INPUT", "input.judgements", "expected an array");
  }
  const candidateRefs = new Set(candidates.map((candidate) => candidate.ref));
  const output = new Map<string, CandidateJudgementInput>();
  value.forEach((judgementValue, index) => {
    const path = `input.judgements[${index}]`;
    if (!isRecord(judgementValue)) {
      throw new ProductLogicInputError("INVALID_INPUT", path, "expected an object");
    }
    assertExactKeys(
      judgementValue,
      ["candidateRef", "gravity", "regionalSupport", "tightWrap"],
      path,
    );
    const candidateRef = nonemptyString(judgementValue.candidateRef, `${path}.candidateRef`);
    parseCandidatePointer(candidateRef, `${path}.candidateRef`);
    if (!candidateRefs.has(candidateRef)) {
      throw new ProductLogicInputError(
        "UNKNOWN_CANDIDATE",
        `${path}.candidateRef`,
        "candidate pointer is absent from candidateDocument",
      );
    }
    if (output.has(candidateRef)) {
      throw new ProductLogicInputError(
        "DUPLICATE_INPUT",
        path,
        "candidate has more than one judgement record",
      );
    }

    if (!isRecord(judgementValue.gravity)) {
      throw new ProductLogicInputError("INVALID_INPUT", `${path}.gravity`, "expected an object");
    }
    assertExactKeys(judgementValue.gravity, ["basis", "holdsUpperMaterial"], `${path}.gravity`);
    if (typeof judgementValue.gravity.holdsUpperMaterial !== "boolean") {
      throw new ProductLogicInputError(
        "INVALID_RULE_VALUE",
        `${path}.gravity.holdsUpperMaterial`,
        "expected a boolean caller judgement",
      );
    }

    if (!isRecord(judgementValue.tightWrap)) {
      throw new ProductLogicInputError("INVALID_INPUT", `${path}.tightWrap`, "expected an object");
    }
    assertExactKeys(judgementValue.tightWrap, ["basis", "value"], `${path}.tightWrap`);

    if (!isRecord(judgementValue.regionalSupport)) {
      throw new ProductLogicInputError(
        "INVALID_INPUT",
        `${path}.regionalSupport`,
        "expected an object",
      );
    }
    assertExactKeys(
      judgementValue.regionalSupport,
      ["basis", "value"],
      `${path}.regionalSupport`,
    );

    output.set(candidateRef, {
      candidateRef,
      gravity: {
        holdsUpperMaterial: judgementValue.gravity.holdsUpperMaterial,
        basis: validateExactJson(judgementValue.gravity.basis, `${path}.gravity.basis`),
      },
      tightWrap: {
        value: validateOrderedValue(
          judgementValue.tightWrap.value,
          tightWrapComparator,
          `${path}.tightWrap.value`,
        ),
        basis: validateExactJson(judgementValue.tightWrap.basis, `${path}.tightWrap.basis`),
      },
      regionalSupport: {
        value: validateOrderedValue(
          judgementValue.regionalSupport.value,
          regionalComparator,
          `${path}.regionalSupport.value`,
        ),
        basis: validateExactJson(
          judgementValue.regionalSupport.basis,
          `${path}.regionalSupport.basis`,
        ),
      },
    });
  });

  for (const candidate of candidates) {
    if (!output.has(candidate.ref)) {
      throw new ProductLogicInputError(
        "MISSING_INPUT",
        "input.judgements",
        `candidate ${candidate.ref} has no gravity, tight-wrap, and regional-support judgements`,
      );
    }
  }
  return output;
}

function validateStatusAssignments(
  policy: StatusPolicyInput | undefined,
  candidates: readonly CandidateBase[],
): ReadonlyMap<string, CandidateStatusJson> {
  if (policy === undefined) {
    return new Map();
  }
  const candidateRefs = new Set(candidates.map((candidate) => candidate.ref));
  const output = new Map<string, CandidateStatusJson>();
  policy.assignments.forEach((assignment, index) => {
    const path = `input.rules.statusPolicy.assignments[${index}]`;
    parseCandidatePointer(assignment.candidateRef, `${path}.candidateRef`);
    if (!candidateRefs.has(assignment.candidateRef)) {
      throw new ProductLogicInputError(
        "UNKNOWN_CANDIDATE",
        `${path}.candidateRef`,
        "candidate pointer is absent from candidateDocument",
      );
    }
    if (output.has(assignment.candidateRef)) {
      throw new ProductLogicInputError(
        "DUPLICATE_INPUT",
        path,
        "candidate has more than one status assignment",
      );
    }
    output.set(assignment.candidateRef, {
      kind: "assigned",
      policyId: policy.policyId,
      status: assignment.status,
      policyInput: assignment.policyInput,
    });
  });
  for (const candidate of candidates) {
    if (!output.has(candidate.ref)) {
      throw new ProductLogicInputError(
        "MISSING_INPUT",
        "input.rules.statusPolicy.assignments",
        `candidate ${candidate.ref} has no status assignment under the supplied policy`,
      );
    }
  }
  return output;
}

export function buildCandidateEvaluation(
  candidate: ValidatedCandidate,
  rules: ValidatedRules,
): CandidateEvaluationJson {
  const assessment = rules.bandAssessmentById.get(candidate.bandId);
  if (rules.escalation !== undefined && assessment === undefined) {
    throw new Error("internal invariant: every band has an escalation assessment");
  }
  const escalationJudgement =
    rules.escalation === undefined
      ? ({ kind: "not-supplied" } as const)
      : {
          kind: "supplied" as const,
          policyId: rules.escalation.policyId,
          bandSupportInsufficient: assessment!.supportInsufficient,
          triggerDefinitionId: assessment!.triggerDefinitionId,
          triggerInput: assessment!.triggerInput,
          promotionsAsTarget: candidate.promotionsAsTarget.map((promotion) => ({
            sourceBand: promotion.sourceBand,
            targetBand: promotion.targetBand,
            strengthDefinitionId: promotion.strengthDefinitionId,
            strengthInput: promotion.strengthInput,
          })),
        };

  return {
    candidateRef: candidate.ref,
    candidateId: candidate.candidate.id,
    band: {
      id: candidate.bandId,
      orderIndex: candidate.bandOrderIndex.toString(),
    },
    supportingKernelFacts: candidate.supportingKernelFacts,
    judgements: {
      gravity: {
        definitionId: rules.gravity.definitionId,
        holdsUpperMaterial: candidate.judgement.gravity.holdsUpperMaterial,
        basis: candidate.judgement.gravity.basis,
      },
      tightWrap: {
        definitionId: rules.tightWrap.definitionId,
        eligibleUnderGravity: candidate.judgement.gravity.holdsUpperMaterial,
        comparator: rules.tightWrap.comparator,
        value: candidate.judgement.tightWrap.value,
        basis: candidate.judgement.tightWrap.basis,
      },
      regionalSupport: {
        definitionId: rules.regionalSupport.definitionId,
        precedence: rules.regionalSupport.precedence,
        comparator: rules.regionalSupport.comparator,
        value: candidate.judgement.regionalSupport.value,
        basis: candidate.judgement.regionalSupport.basis,
      },
      escalation: escalationJudgement,
    },
    status: candidate.status,
  };
}
