/**
 * compiler-v2 foundation tests — schema identity tuple, evidence snapshot integrity,
 * alias inventory classification. Every test encodes a contract law (WHY), not just behavior.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sourceBindingIdentity, emittedBindingIdentity, formatBindingForError, BindingIdentityError, validateBindingRecord, validateManifest, SCHEMA } from '../src/schema.mjs';
const bindingIdentity = sourceBindingIdentity;
import { writeSnapshot, readSnapshot, canonicalJson, EvidenceError } from '../src/evidence.mjs';
import { collectOccurrences, classifyOccurrences } from '../src/inventory.mjs';

// ── G2 identity tuple: every swap the gate must catch changes the key ──────────────────────
const baseRecord = () => ({
  schemaVersion: SCHEMA.bindingRecord,
  bindingId: 'b1',
  source: { fileKey: 'F', nodeId: '1:2', propertyPath: 'fills/1/color', slot: { kind: 'paint', index: 1 } },
  variable: { key: 'VarKey/abc', captureId: 'VariableID:1:1', collectionKey: 'Coll/x', figmaType: 'COLOR' },
  modeContextId: 'mc-default',
  resolutionTraceId: 't1',
  destinationDomain: 'color',
  emissionTarget: 'css',
  disposition: 'pending',
});

test('identity changes when the stable variable key is swapped (same values elsewhere)', () => {
  const a = baseRecord();
  const b = { ...a, variable: { ...a.variable, key: 'VarKey/xyz' } };
  assert.notEqual(bindingIdentity(a), bindingIdentity(b)); // G2: id-swap with equal counts must fail
});

test('identity changes when destination channel/target differs (FLOAT multi-domain law)', () => {
  const a = baseRecord();
  const css = { ...a, destinationDomain: 'length-px' };
  const react = { ...a, emissionTarget: 'react' };
  assert.notEqual(bindingIdentity(a), bindingIdentity(css));
  assert.notEqual(bindingIdentity(a), bindingIdentity(react));
});

test('identity changes across slot, text range, and mode context', () => {
  const a = baseRecord();
  assert.notEqual(bindingIdentity(a), bindingIdentity({ ...a, source: { ...a.source, slot: { kind: 'paint', index: 2 } } }));
  assert.notEqual(bindingIdentity(a), bindingIdentity({ ...a, source: { ...a.source, textRange: { start: 0, end: 4 } } }));
  assert.notEqual(bindingIdentity(a), bindingIdentity({ ...a, modeContextId: 'mc-dark' }));
});

test('missing stable key HARD-FAILS identity and the validator (§6.1) — captureId only appears in diagnostics, marked', () => {
  const a = baseRecord();
  delete a.variable.key;
  assert.throws(() => bindingIdentity(a), BindingIdentityError);
  assert.ok(validateBindingRecord(a).some((e) => /variable\.key/.test(e)));
  assert.match(formatBindingForError(a), /⚠capture-id:VariableID:1:1/); // diagnostic surface, never a gate key
});

test('emitted conservation identity includes the registry channelId — same domain+target, swapped channel must differ (G2)', () => {
  const a = baseRecord();
  assert.notEqual(emittedBindingIdentity(a, 'ch-color-css-1'), emittedBindingIdentity(a, 'ch-color-css-2'));
  assert.throws(() => emittedBindingIdentity(a, undefined), BindingIdentityError); // channel-less emission cannot claim conservation
});

test('validateBindingRecord rejects invalid domain/slot/disposition', () => {
  assert.equal(validateBindingRecord(baseRecord()).length, 0);
  assert.ok(validateBindingRecord({ ...baseRecord(), destinationDomain: 'nope' }).length > 0);
  assert.ok(validateBindingRecord({ ...baseRecord(), disposition: 'maybe' }).length > 0);
});

// ── evidence snapshots: sealed, hash-verified, refuse-on-tamper (V1, G0 core) ───────────────
const tinyDoc = () => ({
  id: '0:1', type: 'FRAME', name: 'Fixture',
  fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, boundVariables: { color: { type: 'VARIABLE_ALIAS', id: 'VariableID:9:9' } } }],
  children: [{ id: '0:2', type: 'TEXT', name: 'label', characters: 'hi', characterStyleOverrides: {} }],
});

async function makeSnap(tmp) {
  return writeSnapshot(tmp, {
    fileKey: 'FIX', fileVersion: 'v1', rootIds: ['0:1'], captureId: 'cap-1',
    sourcePlanes: { document: 'fixture', variables: 'fixture', supplement: 'fixture' },
    document: tinyDoc(),
    supplement: { schemaVersion: SCHEMA.supplement, nodes: [] },
    variables: { variables: [{ id: 'VariableID:9:9', name: 'bg/x', key: 'K9', variableCollectionId: 'C1', resolvedType: 'COLOR', valuesByMode: { 'm1': { r: 1, g: 1, b: 1, a: 1 } } }], variableCollections: [{ id: 'C1', key: 'CK1', name: 'coll', modes: [{ modeId: 'm1', name: 'light' }], defaultModeId: 'm1' }] },
    components: { components: [] },
    fonts: { families: [] },
    compilerVersion: 'v2-dev', capabilityRegistryVersion: 0,
  });
}

test('snapshot round-trips and re-verifies its own fingerprint', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'cv2-'));
  const { manifest } = await makeSnap(tmp);
  assert.equal(validateManifest(manifest).length, 0);
  const snap = await readSnapshot(tmp);
  assert.equal(snap.manifest.fingerprint, manifest.fingerprint);
  assert.equal(snap.manifest.census.nodes, 2);
  assert.equal(snap.manifest.census.aliases, 1);
});

test('a tampered evidence file is REFUSED, never silently reinterpreted', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'cv2-'));
  await makeSnap(tmp);
  const p = path.join(tmp, 'document.rest.json');
  await fs.writeFile(p, (await fs.readFile(p, 'utf8')).replace('"Fixture"', '"Tampered"'));
  await assert.rejects(() => readSnapshot(tmp), (e) => e instanceof EvidenceError && e.state === 'FAILED_CAPTURE');
});

test('canonicalJson is key-order independent (fingerprint determinism, V12)', () => {
  assert.equal(canonicalJson({ b: 1, a: [{ y: 2, x: 3 }] }), canonicalJson({ a: [{ x: 3, y: 2 }], b: 1 }));
});

// ── alias inventory: carrier truth, mirrors linked, unknown fatal (V2/V3, G1 core) ──────────
test('carrier-local + mirror + scalar occurrences classify; nothing silently drops', () => {
  const doc = {
    id: '1:0', type: 'FRAME',
    fills: [
      { type: 'IMAGE', imageRef: 'x' },
      { type: 'SOLID', color: { r: 0, g: 0, b: 0 }, boundVariables: { color: { type: 'VARIABLE_ALIAS', id: 'V:a' } } },
    ],
    boundVariables: {
      fills: [{ type: 'VARIABLE_ALIAS', id: 'V:a' }], // compacted mirror (E1 shape: 2 fills, 1 entry)
      opacity: { type: 'VARIABLE_ALIAS', id: 'V:o' },
      individualStrokeWeights: { BORDER_TOP_WEIGHT: { type: 'VARIABLE_ALIAS', id: 'V:w' } },
    },
    children: [],
  };
  const { canonical, mirrors, unknown, nonvisual } = classifyOccurrences(collectOccurrences(doc));
  assert.equal(unknown.length, 0);
  assert.equal(mirrors.length, 1);
  assert.equal(nonvisual.length, 0);
  const paths = canonical.map((c) => c.propertyPath).sort();
  assert.deepEqual(paths, ['fills/1/color', 'individualStrokeWeights/BORDER_TOP_WEIGHT', 'opacity']);
  // the E1 killer: the canonical fill binding is carrier-local index 1, not mirror index 0
  assert.equal(canonical.find((c) => c.propertyPath === 'fills/1/color').slot.index, 1);
});

test('an unknown carrier location is FATAL classification, not a skip (G1)', () => {
  const doc = { id: '1:0', type: 'FRAME', novelFeature: { boundVariables: { glow: { type: 'VARIABLE_ALIAS', id: 'V:n' } } }, children: [] };
  const { unknown } = classifyOccurrences(collectOccurrences(doc));
  assert.equal(unknown.length, 1);
  assert.match(unknown[0].jsonPointer, /novelFeature/);
});

test('a mirror with no same-node canonical carrier is escalated to unknown (no silent trust)', () => {
  const doc = { id: '1:0', type: 'FRAME', fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }], boundVariables: { fills: [{ type: 'VARIABLE_ALIAS', id: 'V:ghost' }] }, children: [] };
  const { unknown, canonical } = classifyOccurrences(collectOccurrences(doc));
  assert.equal(canonical.length, 0);
  assert.equal(unknown.length, 1);
  assert.match(unknown[0].reason ?? '', /no same-node canonical/);
});

test('gradient stop bindings classify per-stop with paint linkage (E2)', () => {
  const doc = {
    id: '1:0', type: 'FRAME',
    fills: [{ type: 'GRADIENT_LINEAR', gradientStops: [
      { position: 0, color: { r: 0, g: 0, b: 0 }, boundVariables: { color: { type: 'VARIABLE_ALIAS', id: 'V:s0' } } },
      { position: 1, color: { r: 1, g: 1, b: 1 }, boundVariables: { color: { type: 'VARIABLE_ALIAS', id: 'V:s1' } } },
    ] }],
    boundVariables: { fills: [{ type: 'VARIABLE_ALIAS', id: 'V:s0' }, { type: 'VARIABLE_ALIAS', id: 'V:s1' }] },
    children: [],
  };
  const { canonical, mirrors, unknown } = classifyOccurrences(collectOccurrences(doc));
  assert.equal(unknown.length, 0);
  assert.equal(mirrors.length, 2); // the flattened compaction that fooled the legacy converter
  assert.deepEqual(canonical.map((c) => c.propertyPath).sort(), ['fills/0/stops/0/color', 'fills/0/stops/1/color']);
});

test('paragraphSpacing lands in the reviewed nonvisual list, not unknown and not canonical', () => {
  const doc = { id: '1:0', type: 'TEXT', characters: 'x', boundVariables: { paragraphSpacing: [{ type: 'VARIABLE_ALIAS', id: 'V:p' }] }, children: [] };
  const { nonvisual, unknown, canonical } = classifyOccurrences(collectOccurrences(doc));
  assert.equal(nonvisual.length, 1);
  assert.equal(unknown.length, 0);
  assert.equal(canonical.length, 0);
});
