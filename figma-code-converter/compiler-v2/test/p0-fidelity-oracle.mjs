/** Independent P0 §13.3 draft oracle. No production calibration imports. */
import { canonicalJson, sha256 } from '../src/evidence.mjs';

const HASH = /^[0-9a-f]{64}$/;
const BLOCKERS = ['dan-approval', 'meta-approval', 'qa-approval'];
const REQUIRED_CLASSES = ['flat-color-alpha', 'vector-shape', 'raster-crop', 'text-font', 'effects-compositing', 'geometry-transforms', 'shape-screen', 'mother-screen'];

export function p0FidelityFailures(draft) {
  const failures = [];
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return ['draft malformed'];
  const { draftHash, ...body } = draft;
  if (!HASH.test(draftHash ?? '') || draftHash !== sha256(canonicalJson(body))) failures.push('draft hash');
  if (draft.schemaVersion !== 1 || draft.kind !== 'fidelity-budgets-draft' || !['DIAGNOSTIC_ONLY', 'FAILED_CAPTURE', 'FAILED_VISUAL'].includes(draft.state) || draft.accepted !== false || draft.approvals?.length !== 0) failures.push('terminal/approval truth');
  if (!HASH.test(draft.environmentManifestHash ?? '') || !HASH.test(draft.corpusManifestHash ?? '') || !Array.isArray(draft.classes) || !draft.classes.length) return [...failures, 'draft identity'];
  let unseparated = 0;
  const classIds = draft.classes.map((row) => row.id);
  const missingClassIds = REQUIRED_CLASSES.filter((id) => !classIds.includes(id));
  if (classIds.some((id) => !REQUIRED_CLASSES.includes(id)) || new Set(classIds).size !== classIds.length || draft.completeClassCensus !== (missingClassIds.length === 0) || canonicalJson(draft.missingClassIds) !== canonicalJson(missingClassIds)
    || canonicalJson(draft.blockers) !== canonicalJson([...BLOCKERS, ...(missingClassIds.length ? ['missing-required-classes'] : [])])) failures.push('class census');
  for (const row of draft.classes) {
    const ids = row.metricDefinitions?.map((metric) => metric.id) ?? [];
    if (!ids.length || new Set(ids).size !== ids.length || row.owningGate !== 'G11' || row.metricDefinitions.some((metric) => !text(metric.id) || !text(metric.unit) || metric.direction !== 'max' || !text(metric.definition))
      || Object.keys(row.thresholds ?? {}).sort().join(',') !== [...ids].sort().join(',') || Object.values(row.thresholds ?? {}).some((value) => !finite(value))) { failures.push('metric census'); continue; }
    if (!text(row.separationRationale) || !Array.isArray(row.exclusions) || row.exclusions.some((item) => !text(item.id) || item.kind !== 'environment-only' || !text(item.reason) || item.areaPixels !== 0)) failures.push('exclusion/rationale');
    if (!Array.isArray(row.repeatSamples) || !Array.isArray(row.brokenSamples) || !row.repeatSamples.length || !row.brokenSamples.length) { failures.push('sample census'); continue; }
    const samples = [...row.repeatSamples, ...row.brokenSamples];
    if (new Set(samples.map((sample) => sample.sampleId)).size !== samples.length) failures.push('sample identity');
    const repeatSources = new Map();
    for (const sample of row.repeatSamples) {
      const identity = repeatSources.get(sample.sourceId);
      if (identity && (identity.corpusHash !== sample.corpusHash || identity.referenceHash !== sample.referenceHash || identity.packageHash !== sample.packageHash || identity.buildHash !== sample.buildHash)) failures.push('source repeat linkage');
      repeatSources.set(sample.sourceId, { count: (identity?.count ?? 0) + 1, corpusHash: sample.corpusHash, referenceHash: sample.referenceHash, packageHash: sample.packageHash, buildHash: sample.buildHash });
    }
    if ([...repeatSources.values()].some((identity) => identity.count < 2) || row.brokenSamples.some((sample) => {
      const identity = repeatSources.get(sample.sourceId);
      return !identity || identity.corpusHash !== sample.corpusHash || identity.referenceHash !== sample.referenceHash;
    })) failures.push('source repeat linkage');
    for (const sample of samples) {
      if (!text(sample.sampleId) || !text(sample.sourceId) || sample.sourceVersion !== draft.sourceVersion || sample.environmentManifestHash !== draft.environmentManifestHash
        || !HASH.test(sample.corpusHash ?? '') || !HASH.test(sample.referenceHash ?? '') || !HASH.test(sample.outputHash ?? '') || !HASH.test(sample.packageHash ?? '') || !HASH.test(sample.buildHash ?? '')
        || sample.buildKind !== 'production' || sample.devBadge !== false || sample.approximationMaskPixels !== 0 || Object.keys(sample.values ?? {}).sort().join(',') !== [...ids].sort().join(',')
        || Object.values(sample.values ?? {}).some((value) => !finite(value))) failures.push('sample identity');
    }
    if (row.repeatSamples.some((sample) => sample.mutationId !== undefined) || row.brokenSamples.some((sample) => !text(sample.mutationId))) failures.push('mutation identity');
    const passes = (sample) => ids.every((id) => sample.values?.[id] <= row.thresholds[id]);
    const falseFailures = row.repeatSamples?.filter((sample) => !passes(sample)).length;
    const falsePasses = row.brokenSamples?.filter(passes).length;
    if (row.analysis?.confidenceMethod !== 'wilson-score' || row.analysis?.confidenceLevel !== 0.95 || row.analysis?.falseFailures !== falseFailures || row.analysis?.falsePasses !== falsePasses || row.analysis?.falseFailureRate !== round(falseFailures / row.repeatSamples.length)
      || row.analysis?.falsePassRate !== round(falsePasses / row.brokenSamples.length) || row.analysis?.falseFailure95Upper !== wilsonUpper(falseFailures, row.repeatSamples.length)
      || row.analysis?.falsePass95Upper !== wilsonUpper(falsePasses, row.brokenSamples.length) || row.sampleSize?.repeat !== row.repeatSamples?.length || row.sampleSize?.knownBroken !== row.brokenSamples?.length) failures.push('analysis');
    for (const [group, samples] of [['repeat', row.repeatSamples], ['knownBroken', row.brokenSamples]]) {
      for (const id of ids) if (canonicalJson(row.distributions?.[group]?.[id]) !== canonicalJson(distribution(samples.map((sample) => sample.values[id])))) failures.push('distribution');
    }
    const classification = falseFailures || falsePasses ? 'UNSEPARATED' : 'CANDIDATE_SEPARATED';
    if (row.classification !== classification) failures.push('classification');
    if (classification === 'UNSEPARATED') unseparated++;
  }
  const shapeSources = new Set(draft.classes.find((row) => row.id === 'shape-screen')?.repeatSamples.map((sample) => sample.sourceId) ?? []);
  const motherSources = new Set(draft.classes.find((row) => row.id === 'mother-screen')?.repeatSamples.map((sample) => sample.sourceId) ?? []);
  if ([...shapeSources].some((sourceId) => motherSources.has(sourceId))) failures.push('shape/mother identity');
  if (draft.state !== (missingClassIds.length ? 'FAILED_CAPTURE' : unseparated ? 'FAILED_VISUAL' : 'DIAGNOSTIC_ONLY')) failures.push('state derivation');
  const expectedIssues = draft.classes.filter((row) => row.classification === 'UNSEPARATED').map((row) => `class ${row.id} has ${row.analysis.falseFailures} false failures and ${row.analysis.falsePasses} false passes`);
  if (missingClassIds.length) expectedIssues.push(`required fidelity classes missing: ${missingClassIds.join(', ')}`);
  if (canonicalJson(draft.issues) !== canonicalJson(expectedIssues)) failures.push('issue derivation');
  return [...new Set(failures)];
}

function distribution(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return { n: sorted.length, min: sorted[0], max: sorted.at(-1), mean: round(sorted.reduce((sum, value) => sum + value, 0) / sorted.length), p95: sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] };
}

function wilsonUpper(errors, total) {
  const z = 1.95996398454;
  const p = errors / total;
  const denominator = 1 + z ** 2 / total;
  const center = p + z ** 2 / (2 * total);
  const margin = z * Math.sqrt(p * (1 - p) / total + z ** 2 / (4 * total ** 2));
  return round((center + margin) / denominator);
}

const round = (value) => Number(value.toFixed(12));
const text = (value) => typeof value === 'string' && value.length > 0;
const finite = (value) => Number.isFinite(value) && value >= 0;
