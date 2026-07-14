import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { canonicalJson, sha256 } from '../src/evidence.mjs';
import { REQUIRED_INTEGRATION_ROLES, assessCorpusInventory, loadCorpusInventory } from '../src/corpus-index.mjs';

const COMPLETE = 'plugin-primary-complete';

function descriptor(role) {
  const rootId = `root-${role}`;
  const document = { id: rootId, type: 'FRAME', children: [] };
  const variables = { variables: [{ key: `key-${role}`, codeSyntax: {} }] };
  const components = { components: [], componentSets: [] };
  const supplement = { nodes: [{ nodeId: rootId }] };
  const census = { nodes: 1, aliases: 0, textRuns: 0, variables: 1, components: 0, supplementNodes: 1 };
  if (role === 'component-provider') {
    census.components = 2;
    components.components.push({ id: 'one' }, { id: 'two' });
  }
  if (role === 'component-consumer-a' || role === 'component-consumer-b') {
    document.children.push({ id: `${rootId}-instance`, type: 'INSTANCE', children: [] });
    census.nodes = 2;
  }
  if (role === 'editorial') {
    const textId = `${rootId}-text`;
    document.children.push({ id: textId, type: 'TEXT', characters: 'ab', children: [] });
    supplement.nodes.push({ nodeId: textId, styledTextSegments: [{ start: 0, end: 1 }, { start: 1, end: 2 }] });
    census.nodes = 2;
    census.textRuns = 2;
    census.supplementNodes = 2;
  }
  if (role === 'grid-mask-marketing') document.children.push(
    { id: `${rootId}-grid`, type: 'FRAME', layoutMode: 'GRID', children: [] },
    { id: `${rootId}-mask`, type: 'RECTANGLE', isMask: true, children: [] },
    { id: `${rootId}-layers`, type: 'RECTANGLE', fills: [{ type: 'SOLID' }, { type: 'IMAGE' }], children: [] },
  );
  if (role === 'grid-mask-marketing') census.nodes = 4;
  if (role === 'enterprise-remote') {
    let cursor = document;
    for (let depth = 0; depth < 12; depth++) { const child = { id: `${rootId}-${depth}`, type: depth % 2 ? 'INSTANCE' : 'FRAME', children: [] }; cursor.children.push(child); cursor = child; }
    for (let index = 13; index < 1_000; index++) document.children.push({ id: `${rootId}-${index}`, type: 'FRAME', children: [] });
    census.nodes = 1_000;
  }
  return {
    role, snapshotPath: `${role}/snapshot`, rootId, fileKey: `file-${role}`, fileVersion: 'v1', fingerprint: `fp-${role}`,
    manifest: {
      rootIds: [rootId], fileKey: `file-${role}`, fileVersion: 'v1', fingerprint: `fp-${role}`, census,
      sourcePlanes: { document: COMPLETE, supplement: COMPLETE, variables: COMPLETE, components: COMPLETE, fonts: COMPLETE, assets: COMPLETE, references: 'rest-cross-check', dependencies: COMPLETE },
    },
    document,
    supplement,
    variables,
    components,
    dependencies: { locks: role === 'enterprise-remote' ? [{ key: 'remote', version: '1' }] : [] },
    computedCensus: structuredClone(census),
  };
}

const completeInventory = () => REQUIRED_INTEGRATION_ROLES.map(descriptor);

test('P7 inventory unit law covers every exact §14.2 role but cannot self-promote', () => {
  const report = assessCorpusInventory(completeInventory());
  assert.equal(report.structuralInventoryReady, true);
  assert.equal(report.integrationInventoryReady, false);
  assert.equal(report.state, 'DIAGNOSTIC_ONLY');
  assert.deepEqual(report.missingRoles, []);
  assert.deepEqual(report.blockers, ['accepted-budgets', 'capture-authority', 'mutation-proof', 'runtime-proof', 'scale-proof']);
  assertReportHash(report);
});

test('P7 inventory refuses missing/duplicate roles, synthetic provenance, and Shape as mother', () => {
  const missing = completeInventory().filter((row) => row.role !== 'editorial');
  missing.find((row) => row.role === 'shape').manifest.sourcePlanes.supplement = 'fixture';
  const shape = missing.find((row) => row.role === 'shape');
  const mother = missing.find((row) => row.role === 'mother');
  Object.assign(mother, { fileKey: shape.fileKey, rootId: shape.rootId });
  Object.assign(mother.manifest, { fileKey: shape.fileKey, rootIds: [shape.rootId] });
  missing.push(structuredClone(missing.find((row) => row.role === 'golden-replacement')));
  const report = assessCorpusInventory(missing);
  assert.equal(report.structuralInventoryReady, false);
  assert.equal(report.integrationInventoryReady, false);
  assert.equal(report.state, 'FAILED_CAPTURE');
  assert.deepEqual(report.missingRoles, ['editorial']);
  assert.ok(report.issues.some((issue) => issue.includes('duplicate role golden-replacement')));
  assert.ok(report.issues.some((issue) => issue.includes('supplement provenance')));
  assert.ok(report.issues.some((issue) => issue.includes('mother must be distinct')));
});

test('P7 role checks refuse WEB syntax, missing consumers/content features, and a fake large fixture', () => {
  const inventory = completeInventory();
  inventory.find((row) => row.role === 'non-onemo-no-web').variables.variables[0].codeSyntax.WEB = '--forbidden';
  inventory.find((row) => row.role === 'component-provider').components.components = [];
  inventory.find((row) => row.role === 'component-consumer-a').document.children = [];
  inventory.find((row) => row.role === 'editorial').supplement.nodes[1].styledTextSegments = [{ start: 0, end: 1 }];
  inventory.find((row) => row.role === 'grid-mask-marketing').document.children = [];
  inventory.find((row) => row.role === 'enterprise-remote').document.children = [];
  inventory.find((row) => row.role === 'enterprise-remote').dependencies.locks = [];
  const report = assessCorpusInventory(inventory);
  assert.equal(report.integrationInventoryReady, false);
  for (const fragment of ['WEB syntax', 'component definitions', 'INSTANCE', 'rich text', 'GRID + mask + multilayer', 'large/deep/remote']) {
    assert.ok(report.issues.some((issue) => issue.includes(fragment)), `${fragment}: ${report.issues.join('\n')}`);
  }
});

test('P7 index identity refuses root/version/fingerprint drift and unknown roles', () => {
  const inventory = completeInventory();
  inventory[0].manifest.fingerprint = 'different';
  inventory[1].manifest.fileVersion = 'different';
  inventory[2].manifest.rootIds = ['other'];
  inventory[3].computedCensus.nodes = 999;
  inventory.push({ ...descriptor('shape'), role: 'invented-role' });
  const report = assessCorpusInventory(inventory);
  assert.equal(report.integrationInventoryReady, false);
  for (const fragment of ['fingerprint drift', 'version drift', 'root missing', 'census drift', 'unknown role invented-role']) {
    assert.ok(report.issues.some((issue) => issue.includes(fragment)), `${fragment}: ${report.issues.join('\n')}`);
  }
});

test('P7 checked-in loader reports a missing index as a named capture failure, never a skip', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'compiler-v2-p7-missing-'));
  try {
    const report = await loadCorpusInventory({ corpusRoot: root });
    assert.equal(report.state, 'FAILED_CAPTURE');
    assert.equal(report.structuralInventoryReady, false);
    assert.equal(report.integrationInventoryReady, false);
    assert.deepEqual(report.missingRoles, REQUIRED_INTEGRATION_ROLES);
    assert.match(report.issues[0], /corpus index refused/);
    assertReportHash(report);
  } finally { await rm(root, { recursive: true, force: true }); }
});

function assertReportHash(report) {
  const body = structuredClone(report);
  delete body.reportHash;
  assert.equal(report.reportHash, sha256(canonicalJson(body)));
}

test('P7 checked-in loader refuses a corpus index symlink that escapes the corpus root', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'compiler-v2-p7-root-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'compiler-v2-p7-outside-'));
  try {
    const outsideIndex = path.join(outside, 'index.json');
    await writeFile(outsideIndex, '{}');
    await symlink(outsideIndex, path.join(root, 'index.json'));
    const report = await loadCorpusInventory({ corpusRoot: root });
    assert.equal(report.state, 'FAILED_CAPTURE');
    assert.match(report.issues[0], /resolves outside corpus root/);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});
