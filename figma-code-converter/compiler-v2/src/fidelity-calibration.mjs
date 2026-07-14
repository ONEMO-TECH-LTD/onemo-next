/** P0 §13.3 fidelity-budget calibration draft. Diagnostic only; cannot approve thresholds. */
import { canonicalJson, sha256 } from './evidence.mjs';

const HASH = /^[0-9a-f]{64}$/;
const BLOCKERS = Object.freeze(['dan-approval', 'meta-approval', 'qa-approval']);
export const FIDELITY_CLASSES = Object.freeze([
  'flat-color-alpha', 'vector-shape', 'raster-crop', 'text-font', 'effects-compositing',
  'geometry-transforms', 'shape-screen', 'mother-screen',
]);

export class FidelityCalibrationError extends Error {
  constructor(message) { super(message); this.state = 'FAILED_VISUAL'; }
}

export function buildFidelityCalibrationDraft({ calibrationId, environmentManifestHash, corpusManifestHash, sourceVersion, classes }) {
  if (!text(calibrationId) || !HASH.test(environmentManifestHash ?? '') || !HASH.test(corpusManifestHash ?? '') || !text(sourceVersion) || !Array.isArray(classes) || !classes.length) throw new FidelityCalibrationError('calibration identity, environment manifest hash, corpus manifest hash, source version, and classes are required');
  unique(classes.map((row) => row?.id), 'class id');
  for (const row of classes) if (!FIDELITY_CLASSES.includes(row.id)) throw new FidelityCalibrationError(`unknown fidelity class ${row.id}`);
  const derived = classes.map((row) => deriveClass(row, { environmentManifestHash, sourceVersion }));
  const shapeSources = new Set(derived.find((row) => row.id === 'shape-screen')?.repeatSamples.map((sample) => sample.sourceId) ?? []);
  const motherSources = new Set(derived.find((row) => row.id === 'mother-screen')?.repeatSamples.map((sample) => sample.sourceId) ?? []);
  if ([...shapeSources].some((sourceId) => motherSources.has(sourceId))) throw new FidelityCalibrationError('Shape and mother-screen calibration sources must be distinct');
  const missingClassIds = FIDELITY_CLASSES.filter((id) => !derived.some((row) => row.id === id));
  const issues = derived.filter((row) => row.classification === 'UNSEPARATED').map((row) => `class ${row.id} has ${row.analysis.falseFailures} false failures and ${row.analysis.falsePasses} false passes`);
  if (missingClassIds.length) issues.push(`required fidelity classes missing: ${missingClassIds.join(', ')}`);
  const body = {
    schemaVersion: 1,
    kind: 'fidelity-budgets-draft',
    state: missingClassIds.length ? 'FAILED_CAPTURE' : issues.length ? 'FAILED_VISUAL' : 'DIAGNOSTIC_ONLY',
    calibrationId,
    environmentManifestHash,
    corpusManifestHash,
    sourceVersion,
    classes: derived,
    completeClassCensus: missingClassIds.length === 0,
    missingClassIds,
    accepted: false,
    approvals: [],
    blockers: [...BLOCKERS, ...(missingClassIds.length ? ['missing-required-classes'] : [])],
    issues,
  };
  return { ...body, draftHash: sha256(canonicalJson(body)) };
}

export function assertFidelityCalibrationDraft(draft) {
  if (!object(draft)) throw new FidelityCalibrationError('fidelity calibration draft malformed');
  const { draftHash, ...body } = draft;
  if (!HASH.test(draftHash ?? '') || draftHash !== sha256(canonicalJson(body))) throw new FidelityCalibrationError('fidelity calibration draft hash mismatch');
  if (draft.kind !== 'fidelity-budgets-draft' || draft.accepted !== false || draft.approvals?.length !== 0) throw new FidelityCalibrationError('fidelity calibration draft cannot claim approval');
  const rebuilt = buildFidelityCalibrationDraft({
    calibrationId: draft.calibrationId,
    environmentManifestHash: draft.environmentManifestHash,
    corpusManifestHash: draft.corpusManifestHash,
    sourceVersion: draft.sourceVersion,
    classes: draft.classes?.map((row) => ({
      id: row.id,
      owningGate: row.owningGate,
      metricDefinitions: row.metricDefinitions,
      thresholds: row.thresholds,
      repeatSamples: row.repeatSamples,
      brokenSamples: row.brokenSamples,
      exclusions: row.exclusions,
      separationRationale: row.separationRationale,
    })),
  });
  if (canonicalJson(rebuilt) !== canonicalJson(draft)) throw new FidelityCalibrationError('fidelity calibration derived truth differs');
  return true;
}

function deriveClass(input, synchronization) {
  if (!object(input) || !text(input.id) || input.owningGate !== 'G11' || !Array.isArray(input.metricDefinitions) || !input.metricDefinitions.length || !object(input.thresholds)
    || !Array.isArray(input.repeatSamples) || !input.repeatSamples.length || !Array.isArray(input.brokenSamples) || !input.brokenSamples.length
    || !Array.isArray(input.exclusions) || !text(input.separationRationale)) throw new FidelityCalibrationError(`class ${input?.id ?? '?'} calibration input malformed`);
  const metricIds = input.metricDefinitions.map((row) => row?.id);
  unique(metricIds, `class ${input.id} metric id`);
  for (const metric of input.metricDefinitions) if (!text(metric.id) || !text(metric.unit) || metric.direction !== 'max' || !text(metric.definition)) throw new FidelityCalibrationError(`class ${input.id} metric definition malformed`);
  if (canonicalJson(Object.keys(input.thresholds).sort()) !== canonicalJson([...metricIds].sort())) throw new FidelityCalibrationError(`class ${input.id} threshold metric census differs`);
  for (const [id, value] of Object.entries(input.thresholds)) if (!finite(value)) throw new FidelityCalibrationError(`class ${input.id} threshold ${id} malformed`);
  const samples = [...input.repeatSamples, ...input.brokenSamples];
  unique(samples.map((row) => row?.sampleId), `class ${input.id} sample`);
  input.repeatSamples.forEach((sample) => validateSample(sample, metricIds, input.id, false, synchronization));
  input.brokenSamples.forEach((sample) => validateSample(sample, metricIds, input.id, true, synchronization));
  const repeatSources = new Map();
  for (const sample of input.repeatSamples) {
    const identity = repeatSources.get(sample.sourceId);
    if (identity && (identity.corpusHash !== sample.corpusHash || identity.referenceHash !== sample.referenceHash || identity.packageHash !== sample.packageHash || identity.buildHash !== sample.buildHash)) throw new FidelityCalibrationError(`class ${input.id} source ${sample.sourceId} mixes corpus/reference/build identity`);
    repeatSources.set(sample.sourceId, { count: (identity?.count ?? 0) + 1, corpusHash: sample.corpusHash, referenceHash: sample.referenceHash, packageHash: sample.packageHash, buildHash: sample.buildHash });
  }
  for (const [sourceId, identity] of repeatSources) if (identity.count < 2) throw new FidelityCalibrationError(`class ${input.id} source ${sourceId} lacks a repeat distribution`);
  for (const sample of input.brokenSamples) {
    const identity = repeatSources.get(sample.sourceId);
    if (!identity) throw new FidelityCalibrationError(`class ${input.id} broken sample ${sample.sampleId} lacks a repeated source`);
    if (identity.corpusHash !== sample.corpusHash || identity.referenceHash !== sample.referenceHash) throw new FidelityCalibrationError(`class ${input.id} broken sample ${sample.sampleId} differs from repeated source identity`);
  }
  for (const exclusion of input.exclusions) {
    if (!text(exclusion?.id) || exclusion.kind !== 'environment-only' || !text(exclusion.reason) || exclusion.areaPixels !== 0) throw new FidelityCalibrationError(`class ${input.id} exclusions must be named zero-area environment-only controls`);
  }
  unique(input.exclusions.map((row) => row.id), `class ${input.id} exclusion`);
  const passes = (sample) => metricIds.every((id) => sample.values[id] <= input.thresholds[id]);
  const falseFailures = input.repeatSamples.filter((sample) => !passes(sample)).length;
  const falsePasses = input.brokenSamples.filter(passes).length;
  const distributions = {
    repeat: Object.fromEntries(metricIds.map((id) => [id, distribution(input.repeatSamples.map((sample) => sample.values[id]))])),
    knownBroken: Object.fromEntries(metricIds.map((id) => [id, distribution(input.brokenSamples.map((sample) => sample.values[id]))])),
  };
  const analysis = {
    confidenceMethod: 'wilson-score',
    confidenceLevel: 0.95,
    falseFailures,
    falsePasses,
    falseFailureRate: round(falseFailures / input.repeatSamples.length),
    falsePassRate: round(falsePasses / input.brokenSamples.length),
    falseFailure95Upper: wilsonUpper(falseFailures, input.repeatSamples.length),
    falsePass95Upper: wilsonUpper(falsePasses, input.brokenSamples.length),
  };
  return {
    id: input.id,
    owningGate: 'G11',
    metricDefinitions: structuredClone(input.metricDefinitions),
    thresholds: structuredClone(input.thresholds),
    repeatSamples: structuredClone(input.repeatSamples),
    brokenSamples: structuredClone(input.brokenSamples),
    exclusions: structuredClone(input.exclusions),
    separationRationale: input.separationRationale,
    sampleSize: { repeat: input.repeatSamples.length, knownBroken: input.brokenSamples.length },
    distributions,
    analysis,
    classification: falseFailures || falsePasses ? 'UNSEPARATED' : 'CANDIDATE_SEPARATED',
  };
}

function validateSample(sample, metricIds, classId, broken, synchronization) {
  if (!object(sample) || !text(sample.sampleId) || !text(sample.sourceId) || sample.sourceVersion !== synchronization.sourceVersion || sample.environmentManifestHash !== synchronization.environmentManifestHash
    || !HASH.test(sample.corpusHash ?? '') || !HASH.test(sample.referenceHash ?? '') || !HASH.test(sample.outputHash ?? '') || !HASH.test(sample.packageHash ?? '') || !HASH.test(sample.buildHash ?? '')
    || sample.buildKind !== 'production' || sample.devBadge !== false || sample.approximationMaskPixels !== 0 || !object(sample.values)) throw new FidelityCalibrationError(`class ${classId} sample identity/synchronization/production boundary malformed`);
  if (broken !== text(sample.mutationId)) throw new FidelityCalibrationError(`class ${classId} ${broken ? 'known-broken' : 'repeat'} sample mutation identity malformed`);
  if (canonicalJson(Object.keys(sample.values).sort()) !== canonicalJson([...metricIds].sort())) throw new FidelityCalibrationError(`class ${classId} sample metric value census differs`);
  for (const [id, value] of Object.entries(sample.values)) if (!finite(value)) throw new FidelityCalibrationError(`class ${classId} sample metric ${id} malformed`);
}

function distribution(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    n: sorted.length,
    min: sorted[0],
    max: sorted.at(-1),
    mean: round(sorted.reduce((sum, value) => sum + value, 0) / sorted.length),
    p95: sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)],
  };
}

function wilsonUpper(errors, total) {
  const z = 1.95996398454;
  const p = errors / total;
  const denominator = 1 + z ** 2 / total;
  const center = p + z ** 2 / (2 * total);
  const margin = z * Math.sqrt(p * (1 - p) / total + z ** 2 / (4 * total ** 2));
  return round((center + margin) / denominator);
}

function unique(values, label) {
  if (values.some((value) => !text(value)) || new Set(values).size !== values.length) throw new FidelityCalibrationError(`${label} missing or duplicate sample/identity`);
}

const round = (value) => Number(value.toFixed(12));
const text = (value) => typeof value === 'string' && value.length > 0;
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value) => Number.isFinite(value) && value >= 0;
