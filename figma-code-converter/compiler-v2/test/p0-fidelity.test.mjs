import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIDELITY_CLASSES, assertFidelityCalibrationDraft, buildFidelityCalibrationDraft } from '../src/fidelity-calibration.mjs';
import { canonicalJson, sha256 } from '../src/evidence.mjs';
import { p0FidelityFailures } from './p0-fidelity-oracle.mjs';

const HASH = (value) => sha256(String(value));
const ENVIRONMENT_HASH = HASH('environment');
const SOURCE_VERSION = '2375782983690416241';
const metrics = Object.freeze([
  { id: 'changedPct', unit: 'percent', direction: 'max', definition: 'pixels whose max channel delta exceeds 2' },
  { id: 'meanDelta', unit: 'channel-level', direction: 'max', definition: 'mean maximum RGB channel delta' },
]);

function sample(id, values, mutationId = null, sourceId = 'shape-light') {
  return {
    sampleId: id,
    sourceId,
    sourceVersion: SOURCE_VERSION,
    environmentManifestHash: ENVIRONMENT_HASH,
    corpusHash: HASH(`corpus-${sourceId}`),
    referenceHash: HASH(`reference-${sourceId}`),
    outputHash: HASH(`output-${id}`),
    packageHash: HASH(`package-${sourceId}`),
    buildHash: HASH(`build-${sourceId}`),
    buildKind: 'production',
    devBadge: false,
    approximationMaskPixels: 0,
    ...(mutationId ? { mutationId } : {}),
    values,
  };
}

function classInput(id = 'flat-color-alpha', overrides = {}) {
  const sourceId = id === 'mother-screen' ? 'mother-light' : 'shape-light';
  return {
    id,
    owningGate: 'G11',
    metricDefinitions: metrics,
    thresholds: { changedPct: 0.2, meanDelta: 0.1 },
    repeatSamples: [sample('r1', { changedPct: 0, meanDelta: 0 }, null, sourceId), sample('r2', { changedPct: 0.05, meanDelta: 0.02 }, null, sourceId), sample('r3', { changedPct: 0.1, meanDelta: 0.04 }, null, sourceId)],
    brokenSamples: [sample('b1', { changedPct: 2, meanDelta: 0.4 }, 'paint-shift', sourceId), sample('b2', { changedPct: 1, meanDelta: 0.3 }, 'alpha-shift', sourceId), sample('b3', { changedPct: 0.5, meanDelta: 0.2 }, 'token-bake', sourceId)],
    exclusions: [{ id: 'caret', kind: 'environment-only', reason: 'caret is disabled by the pinned render environment', areaPixels: 0 }],
    separationRationale: 'repeat noise remains below both limits; every known-broken mutation exceeds at least one limit',
    ...overrides,
  };
}

function build(overrides = {}) {
  return buildFidelityCalibrationDraft({
    calibrationId: 'p0-shape-v1',
    environmentManifestHash: ENVIRONMENT_HASH,
    corpusManifestHash: HASH('corpus-manifest'),
    sourceVersion: SOURCE_VERSION,
    classes: FIDELITY_CLASSES.map((id) => classInput(id)),
    ...overrides,
  });
}

test('P0 fidelity draft derives repeat/broken distributions and empirical separation without approval', () => {
  const draft = build();
  assert.equal(draft.state, 'DIAGNOSTIC_ONLY');
  assert.equal(draft.accepted, false);
  assert.deepEqual(draft.approvals, []);
  assert.deepEqual(draft.blockers, ['dan-approval', 'meta-approval', 'qa-approval']);
  assert.equal(draft.completeClassCensus, true);
  assert.deepEqual(draft.missingClassIds, []);
  const row = draft.classes[0];
  assert.equal(row.classification, 'CANDIDATE_SEPARATED');
  assert.deepEqual(row.sampleSize, { repeat: 3, knownBroken: 3 });
  assert.deepEqual(row.analysis, { confidenceMethod: 'wilson-score', confidenceLevel: 0.95, falseFailures: 0, falsePasses: 0, falseFailureRate: 0, falsePassRate: 0, falseFailure95Upper: row.analysis.falseFailure95Upper, falsePass95Upper: row.analysis.falsePass95Upper });
  assert.ok(row.analysis.falseFailure95Upper > 0 && row.analysis.falsePass95Upper > 0);
  assert.deepEqual(row.distributions.repeat.changedPct, { n: 3, min: 0, max: 0.1, mean: 0.05, p95: 0.1 });
  assert.deepEqual(row.distributions.knownBroken.meanDelta, { n: 3, min: 0.2, max: 0.4, mean: 0.3, p95: 0.4 });
  assert.equal(assertFidelityCalibrationDraft(draft), true);
  assert.deepEqual(p0FidelityFailures(draft), []);
});

test('P0 fidelity draft exposes overlap as FAILED_VISUAL, never a separated candidate', () => {
  const draft = build({ classes: FIDELITY_CLASSES.map((id) => classInput(id, id === 'flat-color-alpha' ? {
    repeatSamples: [sample('r1', { changedPct: 0.3, meanDelta: 0.02 }), sample('r2', { changedPct: 0.1, meanDelta: 0.04 })],
    brokenSamples: [sample('b1', { changedPct: 0.1, meanDelta: 0.05 }, 'subtle-break'), sample('b2', { changedPct: 1, meanDelta: 0.4 }, 'large-break')],
  } : {})) });
  assert.equal(draft.state, 'FAILED_VISUAL');
  assert.equal(draft.classes[0].classification, 'UNSEPARATED');
  assert.equal(draft.classes[0].analysis.falseFailures, 1);
  assert.equal(draft.classes[0].analysis.falsePasses, 1);
  assert.match(draft.issues.join('\n'), /flat-color-alpha.*false failures.*false passes/);
});

test('P0 fidelity draft rejects incomplete metrics, unsafe exclusions, bad hashes, and duplicate samples', () => {
  assert.throws(() => build({ classes: [classInput('flat-color-alpha', { thresholds: { changedPct: 0.2 } })] }), /threshold metric census/);
  assert.throws(() => build({ classes: [classInput('flat-color-alpha', { exclusions: [{ id: 'mask', kind: 'environment-only', reason: 'hide drift', areaPixels: 4 }] })] }), /zero-area/);
  assert.throws(() => build({ environmentManifestHash: 'bad' }), /environment manifest hash/);
  assert.throws(() => build({ classes: [classInput('flat-color-alpha', { repeatSamples: [sample('same', { changedPct: 0, meanDelta: 0 }), sample('same', { changedPct: 0, meanDelta: 0 })] })] }), /duplicate sample/);
  assert.throws(() => build({ classes: [classInput('flat-color-alpha', { brokenSamples: [sample('b', { changedPct: 1, invented: 2 }, 'bad')] })] }), /metric value census/);
  const wrongVersion = sample('wrong-version', { changedPct: 0, meanDelta: 0 }); wrongVersion.sourceVersion = 'other';
  assert.throws(() => build({ classes: [classInput('flat-color-alpha', { repeatSamples: [sample('r1', { changedPct: 0, meanDelta: 0 }), wrongVersion] })] }), /synchronization/);
  const lone = sample('lone', { changedPct: 0, meanDelta: 0 }); lone.sourceId = 'one-off';
  assert.throws(() => build({ classes: [classInput('flat-color-alpha', { repeatSamples: [sample('r1', { changedPct: 0, meanDelta: 0 }), sample('r2', { changedPct: 0, meanDelta: 0 }), lone] })] }), /lacks a repeat distribution/);
  assert.throws(() => build({ classes: [classInput('invented')] }), /unknown fidelity class/);
  const mixed = sample('mixed', { changedPct: 0, meanDelta: 0 }); mixed.referenceHash = HASH('different-reference');
  assert.throws(() => build({ classes: [classInput('flat-color-alpha', { repeatSamples: [sample('r1', { changedPct: 0, meanDelta: 0 }), mixed] })] }), /mixes corpus\/reference\/build/);
  const dev = sample('dev', { changedPct: 0, meanDelta: 0 }); dev.devBadge = true;
  assert.throws(() => build({ classes: [classInput('flat-color-alpha', { repeatSamples: [sample('r1', { changedPct: 0, meanDelta: 0 }), dev] })] }), /production boundary/);
  const sharedMother = classInput('mother-screen', { repeatSamples: [sample('r1', { changedPct: 0, meanDelta: 0 }), sample('r2', { changedPct: 0, meanDelta: 0 })], brokenSamples: [sample('b1', { changedPct: 1, meanDelta: 1 }, 'break')] });
  assert.throws(() => build({ classes: FIDELITY_CLASSES.map((id) => id === 'mother-screen' ? sharedMother : classInput(id)) }), /Shape and mother-screen.*distinct/);
});

test('P0 fidelity partial draft names every missing required class and stays unapproved', () => {
  const draft = build({ classes: [classInput('flat-color-alpha')] });
  assert.equal(draft.state, 'FAILED_CAPTURE');
  assert.equal(draft.completeClassCensus, false);
  assert.deepEqual(draft.missingClassIds, FIDELITY_CLASSES.slice(1));
  assert.ok(draft.blockers.includes('missing-required-classes'));
  assert.match(draft.issues.join('\n'), /required fidelity classes missing/);
});

test('P0 fidelity production and independent readers reject re-sealed distribution, analysis, and terminal lies', () => {
  const draft = build();
  const mutations = [
    (copy) => { copy.classes[0].distributions.repeat.changedPct.max = 99; },
    (copy) => { copy.classes[0].analysis.falsePasses = 2; },
    (copy) => { copy.classes[0].classification = 'UNSEPARATED'; },
    (copy) => { copy.state = 'PROMOTABLE_VERIFIED'; copy.accepted = true; },
  ];
  for (const mutate of mutations) {
    const copy = structuredClone(draft);
    mutate(copy);
    delete copy.draftHash;
    copy.draftHash = sha256(canonicalJson(copy));
    assert.throws(() => assertFidelityCalibrationDraft(copy));
    assert.ok(p0FidelityFailures(copy).length > 0);
  }
});

test('P0 fidelity draft is byte-deterministic for identical sealed sample input', () => {
  assert.deepEqual(build(), build());
});
