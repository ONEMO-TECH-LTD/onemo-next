import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MUTATION_CATALOG,
  assessP7CoreEvidence,
  assertDiagnosticMutationRun,
  assertDiagnosticScaleRun,
  measureDiagnosticScale,
  runDiagnosticMutation,
} from '../src/p7-evidence.mjs';
import { canonicalJson, sha256 } from '../src/evidence.mjs';

const EXPECTED_MUTATIONS = Object.freeze({
  'swap-variable-id': 'G2',
  'bake-bound-value': 'G2',
  'use-root-mode': 'G3',
  'reorder-render-stack': 'G6',
  'flatten-instance': 'G4',
  'change-variant-default-or-swap': 'G4',
  'merge-unequal-text-runs': 'G5',
  'drop-grid-span-or-reverse-z': 'G6',
  'reduce-affine-to-angle': 'G6',
  'inject-unsafe-content': 'G8',
  'reuse-stale-asset-or-verdict': 'G0',
  'skip-runtime-state': 'G10',
  'token-value-churns-component': 'G9',
  'collapse-destination-channels': 'G2',
  'emit-react-binding-as-css-text': 'G2',
  'drop-mode-context-marker': 'G3',
  'advertise-uncaptured-variant': 'G4',
  'materialize-remote-or-mutate-source': 'G0',
  'bypass-read-adapter': 'G0',
  'change-stable-library-dependency': 'G0',
  'omit-external-render-dependency': 'G0',
  'substitute-font-bytes': 'G0',
  'promote-null-or-stale-reference': 'G11',
  'continue-on-unknown-visual-field': 'G1',
  'drop-or-duplicate-source-address': 'G13',
  'forge-fragment-semantic-owner': 'G13',
  'lose-fragment-inspection-address': 'G13',
  'resolve-edit-to-wrong-segment': 'G13',
  'rewrite-outside-owning-declaration': 'G13',
  'save-churns-identity-mode-map-order': 'G13',
  'failed-stage-mutates-registry': 'G9',
  'registry-generation-race-last-write-wins': 'G9',
  'restart-retains-partial-generation': 'G9',
  'cancel-capture-leaves-staged-state': 'G0',
});

const EXPECTED_CONTRACT_TEXT = Object.freeze([
  'swap same-valued variable ids',
  'bake one bound value',
  'use root mode for a descendant override',
  'reorder paints/effects/masks',
  'flatten an instance',
  'change one variant default or instance swap',
  'merge two unequal text runs',
  'drop one grid span or reverse-z flag',
  'reduce an affine matrix to angle',
  'inject unsafe SVG/CSS/URL content',
  'reuse a stale asset or verdict',
  'skip one required runtime state',
  'change only a token value and churn component TSX',
  'collapse two incompatible destination channels into one CSS custom property',
  'emit token-bound characters, visibility, or component props as inert CSS text',
  'drop a descendant mode-context marker or its React context id',
  'advertise one uncaptured component variant',
  'import/materialize a remote component or change a source mode during capture',
  'bypass the read adapter through direct/dynamic Plugin-global access',
  'change a library dependency between fingerprint reads while keeping its stable key',
  'omit an external backdrop/overlap dependency from the source boundary',
  'substitute a same-family font with different bytes',
  'promote a state whose authored reference is null or belongs to another version',
  'add an unknown visual field and continue conversion',
  'drop or duplicate one semantic/component source address',
  'expose a decorative fragment as a fake semantic selection or lose its owning-node address',
  'make an auxiliary fragment unselectable by fragmentId in render-inspection mode',
  'resolve a token edit to the wrong declaration/expression segment',
  'edit one padding/radius slot and rewrite unrelated slots or more than the owning declaration',
  'Save-to-code and churn component identity, scoped mode markers, source-map ids, or render order',
  'fail or cancel after staging a new token channel and mutate the persistent registry',
  'race two compiles from one registry generation and accept last-write-wins',
  'restart during registry/package commit and retain a partial generation',
  'cancel capture and leave staged artifacts or an indeterminate operator state',
]);

test('P7 mutation catalog is an exact closed transcription of §14.3 with one earliest owning gate', () => {
  assert.deepEqual(Object.fromEntries(MUTATION_CATALOG.map(({ id, gate }) => [id, gate])), EXPECTED_MUTATIONS);
  assert.deepEqual(MUTATION_CATALOG.map((row) => row.contractText), EXPECTED_CONTRACT_TEXT);
  assert.equal(new Set(MUTATION_CATALOG.map((row) => row.id)).size, 34);
  assert.ok(MUTATION_CATALOG.every((row) => /^G(?:[0-9]|1[0-3])$/.test(row.gate) && row.contractText && row.targetSeam));
  assert.throws(() => MUTATION_CATALOG.push({}), TypeError);
});

test('P7 diagnostic mutation runner observes changed bytes and the assigned refusal but cannot self-promote', async () => {
  const before = { value: 1, nested: { stable: true } };
  const run = await runDiagnosticMutation({
    mutationId: 'bake-bound-value',
    fixtureId: 'micro-binding',
    before,
    mutate: (draft) => { draft.value = 2; },
    evaluate: (after) => ({ gate: 'G2', state: after.value === 2 ? 'FAILED' : 'VERIFIED', issues: ['bound identity lost'] }),
  });
  assert.equal(run.proofClass, 'microfixture-diagnostic');
  assert.equal(run.observedAssignedRefusal, true);
  assert.equal(run.beforeHash, sha256(canonicalJson(before)));
  assert.notEqual(run.beforeHash, run.afterHash);
  assert.equal(assertDiagnosticMutationRun(run, run.authority), true);
  const forged = structuredClone(run);
  forged.gate = 'G1';
  assert.throws(() => assertDiagnosticMutationRun(forged, run.authority), /authority mismatch/);
  const copied = structuredClone(run);
  assert.throws(() => assertDiagnosticMutationRun(copied, run.authority), /authority mismatch/);
});

test('P7 mutation runner refuses no-op, wrong-gate, invented-id, and caller-authored evidence', async () => {
  const base = { value: 1 };
  await assert.rejects(() => runDiagnosticMutation({
    mutationId: 'bake-bound-value', fixtureId: 'x', before: base,
    mutate() {}, evaluate: () => ({ gate: 'G2', state: 'FAILED', issues: ['x'] }),
  }), /did not change/);
  await assert.rejects(() => runDiagnosticMutation({
    mutationId: 'bake-bound-value', fixtureId: 'x', before: base,
    mutate: (draft) => { draft.value = 2; }, evaluate: () => ({ gate: 'G1', state: 'FAILED', issues: ['x'] }),
  }), /assigned gate G2/);
  await assert.rejects(() => runDiagnosticMutation({
    mutationId: 'invented', fixtureId: 'x', before: base,
    mutate: (draft) => { draft.value = 2; }, evaluate: () => ({ gate: 'G2', state: 'FAILED', issues: ['x'] }),
  }), /unknown mutation/);
  assert.throws(() => assertDiagnosticMutationRun({ mutationId: 'bake-bound-value' }, {}), /authority mismatch/);
  const cyclic = { value: 1 };
  cyclic.self = cyclic;
  await assert.rejects(() => runDiagnosticMutation({
    mutationId: 'bake-bound-value', fixtureId: 'x', before: cyclic,
    mutate: (draft) => { draft.value = 2; }, evaluate: () => ({ gate: 'G2', state: 'FAILED', issues: ['x'] }),
  }), /contains a cycle/);
  await assert.rejects(() => runDiagnosticMutation({
    mutationId: 'bake-bound-value', fixtureId: 'x', before: { value: Number.NaN },
    mutate: (draft) => { draft.value = 2; }, evaluate: () => ({ gate: 'G2', state: 'FAILED', issues: ['x'] }),
  }), /non-finite number/);
  await assert.rejects(() => runDiagnosticMutation({
    mutationId: 'bake-bound-value', fixtureId: 'x', before: base,
    mutate: (draft) => { draft.value = undefined; }, evaluate: () => ({ gate: 'G2', state: 'FAILED', issues: ['x'] }),
  }), /contains non-JSON data/);
  await assert.rejects(() => runDiagnosticMutation({
    mutationId: 'bake-bound-value', fixtureId: 'x', before: { value: new Date(0) },
    mutate: (draft) => { draft.value = 2; }, evaluate: () => ({ gate: 'G2', state: 'FAILED', issues: ['x'] }),
  }), /non-plain object/);
});

test('P7 scale harness measures its own time, bytes, operation counts, and inner-loop network violations', async () => {
  const run = await measureDiagnosticScale({
    trialId: 'synthetic-4',
    size: { nodes: 4, properties: 8, aliases: 2, variables: 2, modeContexts: 1 },
    workload: async (meter) => {
      meter.count('document', 12);
      meter.count('alias', 5);
      meter.enterInnerLoop('node');
      meter.recordNetwork({ bytes: 10 });
      meter.leaveInnerLoop('node');
      return { artifacts: { 'model.json': JSON.stringify({ nodes: 4 }), 'screen.tsx': 'export const X=1;' }, outputCounts: { components: 1, fragments: 3, runtimeStates: 1 } };
    },
  });
  assert.equal(run.proofClass, 'synthetic-diagnostic');
  assert.equal(run.metrics.networkRequests, 1);
  assert.equal(run.metrics.networkBytes, 10);
  assert.equal(run.metrics.innerLoopNetworkRequests, 1);
  assert.equal(run.metrics.outputBytes, Buffer.byteLength(JSON.stringify({ nodes: 4 })) + Buffer.byteLength('export const X=1;'));
  assert.equal(run.metrics.operations.document, 12);
  assert.equal(assertDiagnosticScaleRun(run, run.authority), true);
  const forged = structuredClone(run);
  forged.metrics.outputBytes = 0;
  assert.throws(() => assertDiagnosticScaleRun(forged, run.authority), /authority mismatch/);
  const copied = structuredClone(run);
  assert.throws(() => assertDiagnosticScaleRun(copied, run.authority), /authority mismatch/);
});

test('P7 evidence report requires the exact mutation census and a monotonic size series, while remaining non-integration', async () => {
  const mutationRuns = [];
  for (const spec of MUTATION_CATALOG) {
    mutationRuns.push(await runDiagnosticMutation({
      mutationId: spec.id,
      fixtureId: `micro-${spec.id}`,
      before: { mutationId: spec.id, value: 0 },
      mutate: (draft) => { draft.value = 1; },
      evaluate: () => ({ gate: spec.gate, state: 'FAILED', issues: [`${spec.id} refused`] }),
    }));
  }
  const scaleRuns = [];
  for (const nodes of [8, 16, 32]) {
    scaleRuns.push(await measureDiagnosticScale({
      trialId: `synthetic-${nodes}`,
      size: { nodes, properties: nodes * 2, aliases: nodes, variables: nodes, modeContexts: 2 },
      workload: (meter) => {
        meter.count('document', nodes * 3);
        meter.count('alias', nodes * 2 + 2);
        return { artifacts: { 'model.json': 'x'.repeat(nodes) }, outputCounts: { components: nodes / 8, fragments: nodes * 2, runtimeStates: 2 } };
      },
    }));
  }
  const report = assessP7CoreEvidence({ mutationRuns, scaleRuns });
  assert.equal(report.mutationCatalogComplete, true);
  assert.equal(report.syntheticScaleSeriesComplete, true);
  assert.equal(report.integrationReady, false);
  assert.equal(report.state, 'DIAGNOSTIC_ONLY');
  assert.deepEqual(report.blockers, ['accepted-budgets', 'capture-authority', 'integration-corpus', 'integration-mutation-proof', 'runtime-proof', 'scale-hardware-authority']);
  assert.equal(report.mutationRunHashes.length, 34);
  assert.equal(report.scaleRunHashes.length, 3);
  const reportBody = structuredClone(report);
  delete reportBody.reportHash;
  assert.equal(report.reportHash, sha256(canonicalJson(reportBody)));

  const missing = assessP7CoreEvidence({ mutationRuns: mutationRuns.slice(1), scaleRuns });
  assert.equal(missing.mutationCatalogComplete, false);
  assert.equal(missing.state, 'FAILED_STATIC');
  assert.ok(missing.issues.some((issue) => issue.includes('missing mutation swap-variable-id')));
});

test('P7 scale report refuses duplicate/non-monotonic series and any inner-loop network call', async () => {
  const trial = (id, nodes, innerNetwork = false) => measureDiagnosticScale({
    trialId: id,
    size: { nodes, properties: nodes, aliases: 0, variables: 0, modeContexts: 1 },
    workload: (meter) => {
      meter.count('document', nodes * 2);
      if (innerNetwork) { meter.enterInnerLoop('node'); meter.recordNetwork({ bytes: 1 }); meter.leaveInnerLoop('node'); }
      return { artifacts: { a: 'x' }, outputCounts: { components: 0, fragments: nodes, runtimeStates: 1 } };
    },
  });
  const runs = [await trial('a', 4), await trial('b', 4), await trial('c', 8, true)];
  const report = assessP7CoreEvidence({ mutationRuns: [], scaleRuns: runs });
  assert.equal(report.syntheticScaleSeriesComplete, false);
  assert.ok(report.issues.some((issue) => issue.includes('strictly increasing')));
  assert.ok(report.issues.some((issue) => issue.includes('network call inside')));
});
