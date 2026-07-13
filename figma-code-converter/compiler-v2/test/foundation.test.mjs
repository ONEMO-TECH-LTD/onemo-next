/**
 * compiler-v2 foundation tests — schema identity tuple, evidence snapshot integrity,
 * alias inventory classification. Every test encodes a contract law (WHY), not just behavior.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { sourceBindingIdentity, emittedBindingIdentity, formatBindingForError, BindingIdentityError, validateBindingRecord, validateManifest, SCHEMA } from '../src/schema.mjs';
const bindingIdentity = sourceBindingIdentity;
import { writeSnapshot, readSnapshot, canonicalJson, censusOf, restTextRuns, metadataSeal, EvidenceError } from '../src/evidence.mjs';
import { collectOccurrences, classifyOccurrences, escapePointerToken } from '../src/inventory.mjs';

// ── G2 identity tuple: every swap the gate must catch changes the key ──────────────────────
const baseRecord = () => ({
  schemaVersion: SCHEMA.bindingRecord,
  bindingId: 'b1',
  source: { fileKey: 'F', nodeId: '1:2', propertyPath: '/fills/1/color', slot: { kind: 'paint', index: 1 } },
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
    sourcePlanes: { document: 'fixture', variables: 'fixture', supplement: 'fixture', components: 'fixture', fonts: 'fixture', assets: 'fixture', references: 'fixture', dependencies: 'fixture' },
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

// ── Meta adversarial probe cases, made permanent (REWORK bc646cb findings 1–5) ─────────────
test('PROBE 1: an empty/incomplete manifest is refused — contracted evidence set + per-fact planes + census required', () => {
  const m = { schemaVersion: SCHEMA.manifest, compilerVersion: 'v2-dev', capabilityRegistryVersion: 0, fileKey: 'F', fileVersion: 'v1', rootIds: ['1:1'], captureId: 'cap', files: {}, census: {}, sourcePlanes: {} };
  const errs = validateManifest(m);
  assert.ok(errs.some((e) => /contracted evidence/.test(e)));
  assert.ok(errs.some((e) => /sourcePlanes/.test(e)));
  assert.ok(errs.some((e) => /census/.test(e)));
});

test('PROBE 1b: a manifest byte-length lie is refused at read — seal catches it, and byte-length catches it after re-seal', async () => {
  const tmp = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'cv2-')), 'snap');
  await makeSnap(tmp);
  const mp = path.join(tmp, 'manifest.json');
  const m = JSON.parse(await fs.readFile(mp, 'utf8'));
  m.files['document.rest.json'].bytes += 99;
  await fs.writeFile(mp, JSON.stringify(m, null, 1));
  await assert.rejects(() => readSnapshot(tmp), (e) => e instanceof EvidenceError && /seal mismatch/.test(e.message)); // seal (superset) bites first
  // re-seal so ONLY the per-file byte-length law can bite — it must still refuse
  const m2 = JSON.parse(await fs.readFile(mp, 'utf8')); m2.seal = metadataSeal(m2);
  await fs.writeFile(mp, JSON.stringify(m2, null, 1));
  await assert.rejects(() => readSnapshot(tmp), (e) => e instanceof EvidenceError && /byte-length/.test(e.message));
});

test('PROBE 2: snapshots are immutable — sealed target refused; failed write leaves no partial', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'cv2-'));
  const tmp = path.join(base, 'snap');
  await makeSnap(tmp);
  await assert.rejects(() => makeSnap(tmp), (e) => e instanceof EvidenceError && /already sealed/.test(e.message));
  const bad = path.join(base, 'bad');
  await assert.rejects(() => writeSnapshot(bad, {
    fileKey: 'F', fileVersion: 'v1', rootIds: ['r'], captureId: 'cap-x',
    sourcePlanes: { document: 'fixture', variables: 'fixture', supplement: 'fixture', components: 'fixture', fonts: 'fixture', assets: 'fixture', references: 'fixture', dependencies: 'fixture' },
    document: tinyDoc(), supplement: null, variables: null, components: null, fonts: null,
    assets: new Map([['broken.png', 'NOT-A-BUFFER']]),
    compilerVersion: 'v2-dev', capabilityRegistryVersion: 0,
  }), EvidenceError);
  const leftovers = (await fs.readdir(base)).filter((d) => d.includes('staging') || d === 'bad');
  assert.deepEqual(leftovers, []); // no partial candidate, no staged debris
});

test('PROBE 3: descendant aliases are not double-counted; text runs are transition-based', () => {
  const doc = { id: 'root', type: 'FRAME', children: [{ id: 'child', type: 'RECTANGLE', fills: [{ type: 'SOLID', boundVariables: { color: { type: 'VARIABLE_ALIAS', id: 'V:1' } } }] }] };
  assert.equal(censusOf({ document: doc }).aliases, 1);
  // 'aabba' with default style gaps: runs = a a | b b | a → 3, even though only 1 unique override id
  assert.equal(restTextRuns({ characters: 'aabba', characterStyleOverrides: [0, 0, 7, 7, 0] }), 3);
  assert.equal(restTextRuns({ characters: '', characterStyleOverrides: [] }), 0);
  // supplement styled segments are authoritative when present
  const supp = { nodes: [{ nodeId: 't1', styledTextSegments: [{}, {}, {}, {}] }] };
  const doc2 = { id: 't1', type: 'TEXT', characters: 'xy', characterStyleOverrides: [], children: [] };
  assert.equal(censusOf({ document: doc2, supplement: supp }).textRuns, 4);
});

test('PROBE 4: identity facts never coalesce — missing fileKey/collectionKey/modeContext hard-fail identity AND validator', () => {
  for (const strip of [
    (r) => delete r.source.fileKey,
    (r) => delete r.variable.collectionKey,
    (r) => delete r.modeContextId,
    (r) => delete r.resolutionTraceId,
  ]) {
    const r = baseRecord(); strip(r);
    assert.ok(validateBindingRecord(r).length > 0);
  }
  const r2 = baseRecord(); delete r2.source.fileKey;
  assert.throws(() => bindingIdentity(r2), BindingIdentityError);
  // slot/range boundary validation
  assert.ok(validateBindingRecord({ ...baseRecord(), source: { ...baseRecord().source, slot: { kind: 'stop', index: 0 } } }).some((e) => /paint linkage/.test(e)));
  assert.ok(validateBindingRecord({ ...baseRecord(), source: { ...baseRecord().source, textRange: { start: 3, end: 3 } } }).some((e) => /textRange/.test(e)));
});

test('PROBE 5: a cross-family mirror is UNKNOWN (effects mirror cannot ride a fill canonical)', () => {
  const doc = {
    id: 'root', type: 'FRAME',
    fills: [{ type: 'SOLID', boundVariables: { color: { type: 'VARIABLE_ALIAS', id: 'V:same' } } }],
    boundVariables: { effects: [{ type: 'VARIABLE_ALIAS', id: 'V:same' }] },
    children: [],
  };
  const { unknown } = classifyOccurrences(collectOccurrences(doc));
  assert.equal(unknown.length, 1);
  assert.match(unknown[0].reason, /effects family/);
});

test('PROBE 5b: pointer tokens are RFC6901-escaped — component-property keys with / or ~ stay unambiguous', () => {
  assert.equal(escapePointerToken('size/variant~x'), 'size~1variant~0x');
  const doc = { id: 'root', type: 'INSTANCE', componentProperties: { 'mode/dark': { type: 'BOOLEAN', value: true, boundVariables: { value: { type: 'VARIABLE_ALIAS', id: 'V:b' } } } }, children: [] };
  const occ = collectOccurrences(doc);
  assert.equal(occ.length, 1);
  assert.match(occ[0].jsonPointer, /mode~1dark/); // '/' inside the key cannot fake a path segment
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
  assert.deepEqual(paths, ['/fills/1/color', '/individualStrokeWeights/BORDER_TOP_WEIGHT', '/opacity']);
  // the E1 killer: the canonical fill binding is carrier-local index 1, not mirror index 0
  assert.equal(canonical.find((c) => c.propertyPath === '/fills/1/color').slot.index, 1);
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
  assert.deepEqual(canonical.map((c) => c.propertyPath).sort(), ['/fills/0/stops/0/color', '/fills/0/stops/1/color']);
});

test('paragraphSpacing lands in the reviewed nonvisual list, not unknown and not canonical', () => {
  const doc = { id: '1:0', type: 'TEXT', characters: 'x', boundVariables: { paragraphSpacing: [{ type: 'VARIABLE_ALIAS', id: 'V:p' }] }, children: [] };
  const { nonvisual, unknown, canonical } = classifyOccurrences(collectOccurrences(doc));
  assert.equal(nonvisual.length, 1);
  assert.equal(unknown.length, 0);
  assert.equal(canonical.length, 0);
});

// ── Meta adversarial probe round 2 (REWORK 4b9ad2a), made permanent ─────────────────────────
import { traceConservationKey } from '../src/schema.mjs';
import { resolveUnder } from '../src/evidence.mjs';

test('PROBE R2-1: identity hard-fails on EVERY serialized fact — node/property/trace/domain/target', () => {
  for (const strip of [
    (r) => delete r.source.nodeId,
    (r) => delete r.source.propertyPath,
    (r) => delete r.resolutionTraceId,
    (r) => delete r.destinationDomain,
    (r) => delete r.emissionTarget,
  ]) {
    const r = baseRecord(); strip(r);
    assert.throws(() => sourceBindingIdentity(r), BindingIdentityError);
  }
  // trace conservation: same source identity, different resolution route → different key (G3)
  const a = baseRecord(), b = { ...baseRecord(), resolutionTraceId: 't2' };
  assert.equal(sourceBindingIdentity(a), sourceBindingIdentity(b)); // trace is NOT source identity…
  assert.notEqual(traceConservationKey(a), traceConservationKey(b)); // …but its own conservation key
});

test('PROBE R2-2: path confinement on write AND read — absolute/dotted/escaping paths refused', async () => {
  for (const bad of ['../../escaped.bin', '/etc/passwd', 'a/../b', './x', '', 'a//b']) {
    assert.throws(() => resolveUnder('/tmp/root', bad), EvidenceError, `should refuse: ${bad}`);
  }
  assert.ok(resolveUnder('/tmp/root', 'assets/ok.png').endsWith('/tmp/root/assets/ok.png'));
  // write side: traversal asset never lands outside the snapshot
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'cv2-'));
  await assert.rejects(() => writeSnapshot(path.join(base, 'esc'), {
    fileKey: 'F', fileVersion: 'v1', rootIds: ['r'], captureId: 'cap-esc',
    sourcePlanes: { document: 'fixture', variables: 'fixture', supplement: 'fixture', components: 'fixture', fonts: 'fixture', assets: 'fixture', references: 'fixture', dependencies: 'fixture' },
    document: tinyDoc(), supplement: null, variables: null, components: null, fonts: null,
    assets: new Map([['../../escaped.bin', Buffer.from('x')]]),
    compilerVersion: 'v2-dev', capabilityRegistryVersion: 0,
  }), EvidenceError);
  assert.equal(await fs.access(path.join(base, '..', 'escaped.bin')).then(() => true, () => false), false);
  // read side: a checked-in malicious manifest cannot read outside its directory
  const snap = path.join(base, 'snap'); await makeSnap(snap);
  const mp = path.join(snap, 'manifest.json');
  const m = JSON.parse(await fs.readFile(mp, 'utf8'));
  m.files['../outside.json'] = { sha256: '0'.repeat(64), bytes: 2 };
  await fs.writeFile(mp, JSON.stringify(m, null, 1));
  await assert.rejects(() => readSnapshot(snap), (e) => e instanceof EvidenceError);
});

test('PROBE R2-3: references cannot be metadata-only — declared references seal bytes; unsealed entries refuse at read', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'cv2-'));
  // metadata-only declaration refused at write
  await assert.rejects(() => writeSnapshot(path.join(base, 'r1'), {
    fileKey: 'F', fileVersion: 'v1', rootIds: ['r'], captureId: 'cap-r1',
    sourcePlanes: { document: 'fixture', variables: 'fixture', supplement: 'fixture', components: 'fixture', fonts: 'fixture', assets: 'fixture', references: 'fixture', dependencies: 'fixture' },
    document: tinyDoc(), supplement: null, variables: null, components: null, fonts: null,
    references: [{ state: 'light', file: 'references/light.png' }], // no bytes
    compilerVersion: 'v2-dev', capabilityRegistryVersion: 0,
  }), (e) => e instanceof EvidenceError && /not provided as bytes/.test(e.message));
  // sealed reference round-trips and is hash-listed in manifest.files
  const dir = path.join(base, 'r2');
  const { manifest } = await writeSnapshot(dir, {
    fileKey: 'F', fileVersion: 'v1', rootIds: ['r'], captureId: 'cap-r2',
    sourcePlanes: { document: 'fixture', variables: 'fixture', supplement: 'fixture', components: 'fixture', fonts: 'fixture', assets: 'fixture', references: 'fixture', dependencies: 'fixture' },
    document: tinyDoc(), supplement: null, variables: null, components: null, fonts: null,
    references: [{ state: 'light', file: 'references/light.png', bytes: Buffer.from('PNGBYTES') }],
    compilerVersion: 'v2-dev', capabilityRegistryVersion: 0,
  });
  assert.ok(manifest.files['references/light.png']);
  const snap = await readSnapshot(dir);
  assert.equal(snap.manifest.files['references/light.png'].bytes, 8);
  // READ-SIDE stands alone: craft a fully self-consistent malicious snapshot — tamper the
  // reference manifest AND update manifest.json's file hash/bytes to match, so every byte/hash
  // check passes and ONLY the semantic reference law can catch it.
  const tamper = async (mutateRows) => {
    const refPath = path.join(dir, 'references/manifest.json');
    const refDoc = JSON.parse(await fs.readFile(refPath, 'utf8'));
    mutateRows(refDoc.references);
    const bytes = Buffer.from(JSON.stringify(refDoc, null, 1));
    await fs.writeFile(refPath, bytes);
    const mp = path.join(dir, 'manifest.json');
    const m = JSON.parse(await fs.readFile(mp, 'utf8'));
    m.files['references/manifest.json'] = { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
    m.seal = metadataSeal(m); // re-seal so the SEAL passes and only the reference-semantic law can bite
    await fs.writeFile(mp, JSON.stringify(m, null, 1));
  };
  await tamper((rows) => { delete rows[0].sha256; }); // missing sha — self-consistent hashes, semantic law must bite
  await assert.rejects(() => readSnapshot(dir), (e) => e instanceof EvidenceError && /missing sha256/.test(e.message));
  await tamper((rows) => { rows[0].sha256 = '0'.repeat(64); }); // wrong sha
  await assert.rejects(() => readSnapshot(dir), (e) => e instanceof EvidenceError && /sha mismatch/.test(e.message));
  await tamper((rows) => { rows[0] = { state: 'light', file: 'references/ghost.png', sha256: '0'.repeat(64) }; }); // unsealed file
  await assert.rejects(() => readSnapshot(dir), (e) => e instanceof EvidenceError && /not sealed/.test(e.message));
  await tamper((rows) => { rows[0] = { state: 'light', file: 'assets/../document.rest.json', sha256: '0'.repeat(64) }; }); // outside references/
  await assert.rejects(() => readSnapshot(dir), (e) => e instanceof EvidenceError && /outside references/.test(e.message));
});

test('PROBE R2-4: missing references/dependencies provenance planes are refused', () => {
  const m = {
    schemaVersion: SCHEMA.manifest, compilerVersion: 'v2-dev', capabilityRegistryVersion: 0,
    fileKey: 'F', fileVersion: 'v1', rootIds: ['1:1'], captureId: 'cap',
    fingerprint: 'x', files: Object.fromEntries(['document.rest.json', 'supplement.json', 'variables.json', 'components.json', 'fonts.json', 'dependencies.json', 'references/manifest.json'].map((f) => [f, { sha256: 'a', bytes: 1 }])),
    census: { nodes: 1, aliases: 0, textRuns: 0, variables: 0, components: 0, supplementNodes: 0 },
    sourcePlanes: { document: 'x', supplement: 'x', variables: 'x', components: 'x', fonts: 'x', assets: 'x' }, // references + dependencies missing
  };
  const errs = validateManifest(m);
  assert.ok(errs.some((e) => /sourcePlanes\.references/.test(e)));
  assert.ok(errs.some((e) => /sourcePlanes\.dependencies/.test(e)));
});

test('PROBE R2-5: canonical BindingRecord propertyPath is RFC6901 — leading slash, escaped tokens for / and ~ keys', () => {
  const doc = { id: 'root', type: 'INSTANCE', componentProperties: { 'mode/dark~x': { type: 'BOOLEAN', value: true, boundVariables: { value: { type: 'VARIABLE_ALIAS', id: 'V:1' } } } }, children: [] };
  const { canonical } = classifyOccurrences(collectOccurrences(doc));
  assert.equal(canonical.length, 1);
  assert.equal(canonical[0].propertyPath, '/componentProperties/mode~1dark~0x');
  assert.ok(canonical[0].propertyPath.startsWith('/'));
  // and the validator enforces the format on records
  assert.ok(validateBindingRecord({ ...baseRecord(), source: { ...baseRecord().source, propertyPath: 'fills/1/color' } }).some((e) => /RFC6901/.test(e)));
});

// ── Meta adversarial probe round 3 (against b0d4ed9), made permanent ────────────────────────
import { invalidPointer, SOURCE_PLANE_VALUES } from '../src/schema.mjs';

test('PROBE R3-1: forged/free-text provenance values are refused — closed vocabulary only', () => {
  const files = Object.fromEntries(['document.rest.json', 'supplement.json', 'variables.json', 'components.json', 'fonts.json', 'dependencies.json', 'references/manifest.json'].map((f) => [f, { sha256: 'a', bytes: 1 }]));
  const census = { nodes: 1, aliases: 0, textRuns: 0, variables: 0, components: 0, supplementNodes: 0 };
  const planes = Object.fromEntries(['document', 'supplement', 'variables', 'components', 'fonts', 'assets', 'references', 'dependencies'].map((k) => [k, 'fixture']));
  const base = { schemaVersion: SCHEMA.manifest, compilerVersion: 'v', capabilityRegistryVersion: 0, fileKey: 'F', fileVersion: 'v1', rootIds: ['1'], captureId: 'c', fingerprint: 'x', files, census, sourcePlanes: planes, seal: 's' };
  assert.equal(validateManifest(base).length, 0);
  const forged = { ...base, sourcePlanes: { ...planes, supplement: 'TOTALLY-LEGIT-PLUGIN' } };
  assert.ok(validateManifest(forged).some((e) => /closed provenance vocabulary/.test(e)));
  assert.ok(SOURCE_PLANE_VALUES.includes('rest-only')); // rest-only exists but is diagnostic-only downstream
});

test('PROBE R3-2: a symlink planted inside the snapshot cannot smuggle outside bytes at read', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'cv2-'));
  const snap = path.join(base, 'snap');
  await makeSnap(snap);
  const outside = path.join(base, 'outside.json');
  const target = path.join(snap, 'document.rest.json');
  await fs.copyFile(target, outside);       // identical bytes outside the snapshot
  await fs.rm(target);
  await fs.symlink(outside, target);        // hash/bytes would PASS — only the realpath law can bite
  await assert.rejects(() => readSnapshot(snap), (e) => e instanceof EvidenceError && /symlink/.test(e.message));
});

test('PROBE R3-3: an invalid ~2-class pointer is refused by validator AND identity', () => {
  assert.equal(invalidPointer('/componentProperties/mode~1dark~0x'), false);
  assert.equal(invalidPointer('/bad/token~2x'), true);
  const r = { ...baseRecord(), source: { ...baseRecord().source, propertyPath: '/bad/token~2x' } };
  assert.ok(validateBindingRecord(r).some((e) => /VALID RFC6901/.test(e)));
  assert.throws(() => sourceBindingIdentity(r), BindingIdentityError);
});

// ── Meta round-3 finding R3-4: provenance IMMUTABILITY (valid-value swap) ────────────────────

test('PROBE R3-4: a valid-vocabulary provenance swap (fixture→plugin-primary-complete, fileVersion) is REFUSED by the seal', async () => {
  const tmp = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'cv2-')), 'snap');
  await makeSnap(tmp);
  const snap = await readSnapshot(tmp); // baseline reads clean
  assert.ok(snap.manifest.seal);
  const mp = path.join(tmp, 'manifest.json');
  // swap to VOCABULARY-VALID values, leave all content + hashes intact, leave the seal stale
  const m = JSON.parse(await fs.readFile(mp, 'utf8'));
  m.sourcePlanes.supplement = 'plugin-primary-complete';
  m.fileVersion = 'forged-version';
  await fs.writeFile(mp, JSON.stringify(m, null, 1));
  await assert.rejects(() => readSnapshot(tmp), (e) => e instanceof EvidenceError && /seal mismatch/.test(e.message));
  // and a full re-seal is the AUTHENTICITY problem (P1/live-G0) — documented, not claimed closed:
  const m2 = JSON.parse(await fs.readFile(mp, 'utf8'));
  m2.seal = metadataSeal(m2);
  await fs.writeFile(mp, JSON.stringify(m2, null, 1));
  await readSnapshot(tmp); // a fully re-sealed forgery passes offline — authenticity is live-capture law, honestly owed
});

// ── Meta round-4 findings R3-5 (seal completeness) + R3-6 (atomic publish) ──────────────────
import { compilerV2OutDir, prepareStaging, publishGeneration, cleanStaging, runToken, recoverGenerations, withTransaction, beginTransaction, endTransaction } from '../tools/atomic-publish.mjs';

test('PROBE R3-5: the seal binds EVERY manifest field except seal — warnings/retries tamper is refused', async () => {
  const tmp = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'cv2-')), 'snap');
  await makeSnap(tmp);
  const mp = path.join(tmp, 'manifest.json');
  const m = JSON.parse(await fs.readFile(mp, 'utf8'));
  m.warnings = ['injected'];        // fields not previously in the seal input
  m.retries = 99;
  await fs.writeFile(mp, JSON.stringify(m, null, 1)); // leave seal stale
  await assert.rejects(() => readSnapshot(tmp), (e) => e instanceof EvidenceError && /seal mismatch/.test(e.message));
});

test('PROBE R3-6: atomic publish — real after-generation/before-pointer crash window; ordinary exception self-cleans; recovery is idempotent', async () => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'cal-'));
  const genBase = 'abc1234';
  // GEN1 publishes cleanly
  const t1 = runToken(1);
  const p1 = await withTransaction(out, async (transaction) => {
    const stage = await prepareStaging({ outDir: out, genBase, token: t1, transaction });
    await fs.writeFile(path.join(stage, 'a.png'), 'GEN1');
    return publishGeneration({ outDir: out, genBase, token: t1, transaction });
  });
  const pointer1 = await fs.readFile(p1.pointer, 'utf8');
  const gen1File = path.join(out, JSON.parse(pointer1).generation, 'a.png');
  assert.equal(await fs.readFile(gen1File, 'utf8'), 'GEN1');

  // GEN2 FAILS in the REAL window: after staging→generation rename, before the pointer flip.
  const t2 = runToken(2);
  let gen2;
  await withTransaction(out, async (transaction) => {
    const stage = await prepareStaging({ outDir: out, genBase, token: t2, transaction });
    const marker = JSON.parse(await fs.readFile(path.join(stage, '.transaction.json'), 'utf8'));
    gen2 = path.join(out, marker.generation);
    await fs.writeFile(path.join(stage, 'a.png'), 'GEN2');
    await assert.rejects(
      () => publishGeneration({ outDir: out, genBase, token: t2, transaction, _injectAfterGen: async () => { throw new Error('crash after generation, before pointer'); } }),
      /crash after generation/,
    );
  });
  // ordinary exception self-cleaned: pointer + GEN1 byte-identical, unreferenced GEN2 removed, no temp/stage debris
  assert.equal(await fs.readFile(p1.pointer, 'utf8'), pointer1);       // pointer preserved (current generation immediate)
  assert.equal(await fs.readFile(gen1File, 'utf8'), 'GEN1');           // GEN1 byte-identical
  assert.equal(await fs.access(gen2).then(() => true, () => false), false);
  let debris = (await fs.readdir(out)).filter((d) => d.startsWith('.stage') || d.startsWith('.latest'));
  assert.deepEqual(debris, []);

  // Simulate a HARD CRASH (cleanup could NOT run): leave a verifiably owned, unpublished
  // generation + temp pointer. Recovery may delete OWNED abandoned work, never unknown dirs.
  const t3 = runToken(3);
  const crashed = await beginTransaction(out);
  const crashedStage = await prepareStaging({ outDir: out, genBase, token: t3, transaction: crashed });
  const crashedMarker = JSON.parse(await fs.readFile(path.join(crashedStage, '.transaction.json'), 'utf8'));
  const crashedGeneration = path.join(out, crashedMarker.generation);
  await fs.writeFile(path.join(crashedStage, 'a.png'), 'ORPHAN');
  await fs.rename(crashedStage, crashedGeneration);
  await fs.writeFile(path.join(out, `.latest-${crashed.id}.json`), JSON.stringify({
    schemaVersion: 2,
    generation: crashedMarker.generation,
    token: t3,
    transactionId: crashed.id,
    pid: crashed.pid,
    host: crashed.host,
  }));
  await endTransaction(crashed);
  const r1 = await recoverGenerations(out);
  assert.equal(await fs.readFile(gen1File, 'utf8'), 'GEN1');           // current generation preserved through recovery
  assert.equal(await fs.access(crashedGeneration).then(() => true, () => false), false); // orphan cleared
  assert.deepEqual((await fs.readdir(out)).filter((d) => d.startsWith('.latest')), []); // temp pointer cleared
  // idempotent: a second recovery yields the identical state
  const before = JSON.stringify((await fs.readdir(path.join(out, 'generations'))).sort());
  const r2 = await recoverGenerations(out);
  assert.equal(JSON.stringify((await fs.readdir(path.join(out, 'generations'))).sort()), before);
  assert.equal(r2.referenced, r1.referenced);

  // concurrent same-commit transactions produce distinct UUID-owned generations
  assert.notEqual(p1.genDir, crashedGeneration);
});

// ── Multi-writer transaction/recovery laws ──────────────────────────────────────────────────
async function txn(out, genBase, token, content, { slowMs = 0 } = {}) {
  return withTransaction(out, async (transaction) => {
    await recoverGenerations(out, { transaction });
    const st = await prepareStaging({ outDir: out, genBase, token, transaction });
    await fs.writeFile(path.join(st, 'a.png'), content);
    if (slowMs) await new Promise((r) => setTimeout(r, slowMs)); // widen the build window
    const res = await publishGeneration({ outDir: out, genBase, token, transaction });
    return res;
  });
}

test('PROBE R3-8: two full transactions racing (recover→build→publish) never delete each other; both survive', async () => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'cal-'));
  const [a, b] = await Promise.all([
    txn(out, 'g', runToken('A'), 'GENA', { slowMs: 80 }),  // A's recover + build window overlaps B
    txn(out, 'g', runToken('B'), 'GENB', { slowMs: 80 }),
  ]);
  assert.equal(await fs.readFile(path.join(a.genDir, 'a.png'), 'utf8'), 'GENA'); // A's stage was NOT deleted by B's recover
  assert.equal(await fs.readFile(path.join(b.genDir, 'a.png'), 'utf8'), 'GENB');
  const pointed = JSON.parse(await fs.readFile(path.join(out, 'latest.json'), 'utf8')).generation;
  assert.ok(await fs.access(path.join(out, pointed, 'a.png')).then(() => true, () => false));
  const debris = (await fs.readdir(out)).filter((d) => d.startsWith('.stage') || d.startsWith('.latest') || d === '.publish.lock');
  assert.deepEqual(debris, []); // transaction stages/temp pointers cleaned
});

test('PROBE R3-9: recovery under a concurrent live transaction cannot delete its pre-pointer generation', async () => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'cal-'));
  await txn(out, 'g', runToken('base'), 'BASE'); // establish a referenced generation
  const [t] = await Promise.all([
    txn(out, 'g', runToken('slow'), 'SLOW', { slowMs: 150 }),
    (async () => { await new Promise((r) => setTimeout(r, 30)); return recoverGenerations(out); })(),
  ]);
  assert.equal(await fs.readFile(path.join(t.genDir, 'a.png'), 'utf8'), 'SLOW'); // survived concurrent recovery
});

test('PROBE R3-10: a corrupt/unreadable pointer THROWS and preserves every generation (only ENOENT proceeds)', async () => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'cal-'));
  await fs.mkdir(path.join(out, 'generations', 'g1'), { recursive: true });
  await fs.writeFile(path.join(out, 'generations', 'g1', 'a.png'), 'KEEP');
  await fs.writeFile(path.join(out, 'latest.json'), 'NOT JSON{{{'); // malformed, not ENOENT
  await assert.rejects(() => recoverGenerations(out), /unreadable\/corrupt/);
  assert.equal(await fs.readFile(path.join(out, 'generations', 'g1', 'a.png'), 'utf8'), 'KEEP'); // preserved, nothing deleted
});

test('PROBE R3-11: recovery preserves live/cross-host/unknown work and removes only an ended same-host owner', async () => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'cal-'));
  const live = await beginTransaction(out);
  const liveStage = await prepareStaging({ outDir: out, genBase: 'g', token: 'live', transaction: live });
  await fs.writeFile(path.join(liveStage, 'keep'), 'LIVE');

  const crossId = 'cross-host-owner';
  const crossStage = path.join(out, `.stage-g-cross-${crossId}`);
  await fs.mkdir(crossStage);
  await fs.writeFile(path.join(crossStage, '.transaction.json'), JSON.stringify({
    schemaVersion: 2, transactionId: crossId, pid: 2 ** 30, host: 'another-host.invalid',
    genBase: 'g', token: 'cross', staging: path.relative(out, crossStage),
    generation: `generations/g-cross-${crossId}`,
  }));
  const unknown = path.join(out, '.stage-ownerless');
  await fs.mkdir(unknown);
  await fs.writeFile(path.join(unknown, 'keep'), 'UNKNOWN');

  await recoverGenerations(out);
  assert.equal(await fs.readFile(path.join(liveStage, 'keep'), 'utf8'), 'LIVE');
  assert.ok(await fs.access(crossStage).then(() => true, () => false));
  assert.equal(await fs.readFile(path.join(unknown, 'keep'), 'utf8'), 'UNKNOWN');

  await endTransaction(live);
  await recoverGenerations(out);
  assert.equal(await fs.access(liveStage).then(() => true, () => false), false);
  assert.ok(await fs.access(crossStage).then(() => true, () => false));
  assert.ok(await fs.access(unknown).then(() => true, () => false));
});

test('PROBE R3-12: forged, copied, wrong-root, and ended transactions cannot authorize mutation', async () => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'cal-'));
  const other = await fs.mkdtemp(path.join(os.tmpdir(), 'cal-'));
  const transaction = await beginTransaction(out);
  const live = await prepareStaging({ outDir: out, genBase: 'g', token: 'live', transaction });
  await fs.writeFile(path.join(live, 'a.png'), 'KEEP');
  await assert.rejects(() => recoverGenerations(out, { transaction: { ...transaction } }), /invalid, forged, ended/);
  await assert.rejects(() => recoverGenerations(other, { transaction }), /another output directory/);
  assert.equal(await fs.readFile(path.join(live, 'a.png'), 'utf8'), 'KEEP');
  await endTransaction(transaction);
  await assert.rejects(() => recoverGenerations(out, { transaction }), /invalid, forged, ended/);
  assert.equal(await fs.readFile(path.join(live, 'a.png'), 'utf8'), 'KEEP');
});

test('PROBE R3-13: invalid pointer schema/path/token/target/type refuses before ANY recovery mutation', async (t) => {
  const cases = [
    ['valid JSON, invalid schema', {}, null],
    ['path traversal', { schemaVersion: 2, generation: 'generations/../escape-t', token: 't', transactionId: 'x', pid: 1, host: os.hostname() }, null],
    ['missing referenced generation', { schemaVersion: 2, generation: 'generations/g-t', token: 't', transactionId: 'x', pid: 1, host: os.hostname() }, null],
    ['unowned referenced directory', { schemaVersion: 2, generation: 'generations/g-t', token: 't', transactionId: 'x', pid: 1, host: os.hostname() }, 'directory'],
    ['referenced generation is a file', { schemaVersion: 2, generation: 'generations/g-t', token: 't', transactionId: 'x', pid: 1, host: os.hostname() }, 'file'],
    ['symlink referenced generation', { schemaVersion: 2, generation: 'generations/g-t', token: 't', transactionId: 'x', pid: 1, host: os.hostname() }, 'symlink'],
  ];
  for (const [name, pointer, targetKind] of cases) await t.test(name, async () => {
    const out = await fs.mkdtemp(path.join(os.tmpdir(), 'cal-'));
    const keeper = path.join(out, 'generations', 'keeper');
    await fs.mkdir(keeper, { recursive: true });
    await fs.writeFile(path.join(keeper, 'a.png'), 'KEEP');
    if (targetKind === 'directory') await fs.mkdir(path.join(out, 'generations', 'g-t'));
    if (targetKind === 'file') await fs.writeFile(path.join(out, 'generations', 'g-t'), 'not a directory');
    if (targetKind === 'symlink') {
      const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'cal-outside-'));
      await fs.mkdir(path.join(out, 'generations'), { recursive: true });
      await fs.symlink(outside, path.join(out, 'generations', 'g-t'));
    }
    await fs.writeFile(path.join(out, 'latest.json'), JSON.stringify(pointer));
    await assert.rejects(() => recoverGenerations(out), /unreadable\/corrupt/);
    assert.equal(await fs.readFile(path.join(keeper, 'a.png'), 'utf8'), 'KEEP');
  });
});

test('PROBE R3-14: the pointer flip is the final operation — ready-marker failure preserves prior latest and removes candidate', async () => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'cal-'));
  const first = runToken('first');
  await withTransaction(out, async (transaction) => {
    const stage = await prepareStaging({ outDir: out, genBase: 'g', token: first, transaction });
    await fs.writeFile(path.join(stage, 'a.png'), 'FIRST');
    await publishGeneration({ outDir: out, genBase: 'g', token: first, transaction });
  });
  const priorPointer = await fs.readFile(path.join(out, 'latest.json'), 'utf8');

  await withTransaction(out, async (transaction) => {
    const second = runToken('second');
    const stage = await prepareStaging({ outDir: out, genBase: 'g', token: second, transaction });
    const marker = JSON.parse(await fs.readFile(path.join(stage, '.transaction.json'), 'utf8'));
    const generation = path.join(out, marker.generation);
    await fs.writeFile(path.join(stage, 'a.png'), 'SECOND');
    await assert.rejects(() => publishGeneration({
      outDir: out, genBase: 'g', token: second, transaction,
      _injectBeforePointer: async () => { throw new Error('ready marker write window failed'); },
    }), /ready marker write window failed/);
    assert.equal(await fs.readFile(path.join(out, 'latest.json'), 'utf8'), priorPointer);
    assert.equal(await fs.access(generation).then(() => true, () => false), false);
    assert.deepEqual((await fs.readdir(out)).filter((f) => f.startsWith('.latest-')), []);
  });
});

test('PROBE R3-15: cleanStaging deletes only the active transaction candidate', async () => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'cal-'));
  await withTransaction(out, async (transaction) => {
    const raw = path.join(out, '.stage-g-raw-ownerless');
    await fs.mkdir(raw, { recursive: true });
    await fs.writeFile(path.join(raw, 'keep'), 'KEEP');
    assert.equal(await cleanStaging(out, 'g', 'raw', { transaction }), false);
    assert.equal(await fs.readFile(path.join(raw, 'keep'), 'utf8'), 'KEEP');
    const own = await prepareStaging({ outDir: out, genBase: 'g', token: 'own', transaction });
    await cleanStaging(out, 'g', 'own', { transaction });
    assert.equal(await fs.access(own).then(() => true, () => false), false);
  });

  const foreign = await beginTransaction(out);
  const foreignStage = await prepareStaging({ outDir: out, genBase: 'g', token: 'foreign', transaction: foreign });
  await withTransaction(out, async (transaction) => {
    assert.equal(await cleanStaging(out, 'g', 'foreign', { transaction }), false);
    assert.ok(await fs.access(foreignStage).then(() => true, () => false));
  });
  await endTransaction(foreign);
  await recoverGenerations(out);
  assert.equal(await fs.access(foreignStage).then(() => true, () => false), false);
});

test('PROBE R3-16: latest must match both transaction and publication records before recovery mutates', async () => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'cal-'));
  const token = 'candidate';
  const owner = await beginTransaction(out);
  const stage = await prepareStaging({ outDir: out, genBase: 'g', token, transaction: owner });
  const marker = JSON.parse(await fs.readFile(path.join(stage, '.transaction.json'), 'utf8'));
  await fs.writeFile(path.join(stage, 'a.png'), 'KEEP');
  const generation = path.join(out, marker.generation);
  await fs.rename(stage, generation);
  await endTransaction(owner);
  const pointer = {
    schemaVersion: 2, generation: marker.generation, token,
    transactionId: marker.transactionId, pid: marker.pid, host: marker.host,
  };
  await fs.writeFile(path.join(out, 'latest.json'), JSON.stringify(pointer));
  await assert.rejects(() => recoverGenerations(out), /publication identity mismatch/);
  assert.equal(await fs.readFile(path.join(generation, 'a.png'), 'utf8'), 'KEEP');
  await fs.writeFile(path.join(generation, '.published.json'), JSON.stringify({ ...pointer, transactionId: 'forged' }));
  await assert.rejects(() => recoverGenerations(out), /publication identity mismatch/);
  await fs.writeFile(path.join(generation, '.published.json'), JSON.stringify(pointer));
  await fs.writeFile(path.join(out, 'latest.json'), JSON.stringify({ ...pointer, transactionId: 'forged-transaction' }));
  await assert.rejects(() => recoverGenerations(out), /transaction identity mismatch/);
  assert.equal(await fs.readFile(path.join(generation, 'a.png'), 'utf8'), 'KEEP');
});

test('PROBE R3-17: transaction paths and ownership markers cannot escape through segments or symlinks', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'cal-'));
  const out = path.join(base, 'out');
  const outside = path.join(base, 'outside');
  await fs.mkdir(outside, { recursive: true });
  await fs.writeFile(path.join(outside, 'keep'), 'KEEP');
  await withTransaction(out, async (transaction) => {
    await assert.rejects(() => prepareStaging({ outDir: out, genBase: '../escape', token: 't', transaction }), /confined path segment/);
    await assert.rejects(() => prepareStaging({ outDir: out, genBase: 'g', token: '../escape', transaction }), /confined path segment/);
    const linked = path.join(out, `.stage-g-linked-${transaction.id}`);
    await fs.symlink(outside, linked);
    await assert.rejects(() => prepareStaging({ outDir: out, genBase: 'g', token: 'linked', transaction }));
    assert.equal(await cleanStaging(out, 'g', 'linked', { transaction }), false);
    assert.equal(await fs.readFile(path.join(outside, 'keep'), 'utf8'), 'KEEP');
    assert.equal(await fs.access(path.join(outside, '.transaction.json')).then(() => true, () => false), false);
  });

  const linkedRoot = path.join(base, 'linked-root');
  await fs.symlink(outside, linkedRoot);
  await assert.rejects(() => beginTransaction(linkedRoot), /regular directory/);

  const parentOut = path.join(base, 'parent-link');
  await fs.mkdir(parentOut);
  await fs.symlink(outside, path.join(parentOut, 'generations'));
  await withTransaction(parentOut, async (transaction) => {
    await assert.rejects(() => prepareStaging({ outDir: parentOut, genBase: 'g', token: 'linked-parent', transaction }), /regular directory/);
  });
  assert.equal(await fs.readFile(path.join(outside, 'keep'), 'utf8'), 'KEEP');
  assert.equal(await fs.access(path.join(outside, '.transaction.json')).then(() => true, () => false), false);
});

test('PROBE R3-18: 20x12 real processes publish isolated complete generations; last completed pointer stays valid', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'cv2-transactions-'));
  const worker = new URL('./transaction-worker.mjs', import.meta.url);
  for (let round = 0; round < 20; round++) {
    const out = path.join(base, `round-${round}`);
    await fs.mkdir(out, { recursive: true });
    const ids = Array.from({ length: 12 }, (_, index) => `${round}-${index}`);
    const exits = await Promise.all(ids.map((id) => new Promise((resolve) => {
      const child = spawn(process.execPath, [worker.pathname, out, id], { stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = '';
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      child.on('exit', (code) => resolve({ code, stderr }));
    })));
    assert.deepEqual(exits.filter(({ code }) => code !== 0), [], `round ${round}: worker failure ${JSON.stringify(exits)}`);
    for (const id of ids) {
      const { genDir } = JSON.parse(await fs.readFile(path.join(out, `result-${id}.json`), 'utf8'));
      assert.equal(await fs.readFile(path.join(genDir, 'artifact.txt'), 'utf8'), id);
    }
    await recoverGenerations(out);
    const pointer = JSON.parse(await fs.readFile(path.join(out, 'latest.json'), 'utf8'));
    assert.ok(await fs.access(path.join(out, pointer.generation, 'artifact.txt')).then(() => true, () => false));
    assert.deepEqual((await fs.readdir(out)).filter((name) => name.startsWith('.stage-') || name.startsWith('.latest-')), []);
  }
});

test('PROBE R3-18b: publisher-won temp rename preserves its generation after recovery read', async () => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'cv2-pointer-race-'));
  const worker = new URL('./transaction-worker.mjs', import.meta.url);
  const id = 'barrier-race';
  const child = spawn(process.execPath, [worker.pathname, out, id, 'barrier-before-pointer'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const exited = new Promise((resolve) => child.on('exit', (code) => resolve(code)));
  const barrier = path.join(out, `barrier-${id}.json`);
  for (let attempt = 0; attempt < 400 && !await fs.access(barrier).then(() => true, () => false); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  const ready = JSON.parse(await fs.readFile(barrier, 'utf8'));
  let released = false;
  await recoverGenerations(out, {
    _injectAfterTempRead: async ({ pointer }) => {
      if (pointer.transactionId !== ready.transactionId || released) return;
      released = true;
      await fs.writeFile(path.join(out, `release-${id}`), 'go');
      assert.equal(await exited, 0, stderr);
    },
  });
  assert.equal(released, true);
  const latest = JSON.parse(await fs.readFile(path.join(out, 'latest.json'), 'utf8'));
  assert.equal(latest.generation, ready.generation);
  assert.equal(await fs.readFile(path.join(out, ready.generation, 'artifact.txt'), 'utf8'), id);
  assert.deepEqual((await fs.readdir(out)).filter((name) => name.startsWith('.latest-')), []);
});

test('PROBE R3-19: dead stages and recovery-won pre-pointer generations recover; legacy v1 is preserved', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cal-legacy-'));
  const legacyGeneration = path.join(root, 'generations', 'legacy-token');
  await fs.mkdir(legacyGeneration, { recursive: true });
  await fs.writeFile(path.join(legacyGeneration, 'legacy.png'), 'LEGACY');
  const legacyPointer = JSON.stringify({ generation: 'generations/legacy-token', token: 'token' });
  await fs.writeFile(path.join(root, 'latest.json'), legacyPointer);
  const legacyPointerHash = createHash('sha256').update(await fs.readFile(path.join(root, 'latest.json'))).digest('hex');
  const legacyGenerationHash = createHash('sha256').update(await fs.readFile(path.join(legacyGeneration, 'legacy.png'))).digest('hex');

  const v2 = compilerV2OutDir(root);
  await fs.mkdir(v2, { recursive: true });
  const worker = new URL('./transaction-worker.mjs', import.meta.url);
  const deadId = 'dead-stage';
  const crashed = await new Promise((resolve) => {
    const child = spawn(process.execPath, [worker.pathname, v2, deadId, 'crash-stage'], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('exit', (code) => resolve({ code, stderr }));
  });
  assert.equal(crashed.code, 23, crashed.stderr);
  const { stage: deadStage } = JSON.parse(await fs.readFile(path.join(v2, `crash-${deadId}.json`), 'utf8'));
  assert.ok(await fs.access(deadStage).then(() => true, () => false));
  await recoverGenerations(v2);
  assert.equal(await fs.access(deadStage).then(() => true, () => false), false);

  for (const [mode, code] of [['crash-generation', 24], ['crash-before-pointer', 25]]) {
    const id = `dead-${mode}`;
    const crashedGeneration = await new Promise((resolve) => {
      const child = spawn(process.execPath, [worker.pathname, v2, id, mode], { stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = '';
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      child.on('exit', (exitCode) => resolve({ exitCode, stderr }));
    });
    assert.equal(crashedGeneration.exitCode, code, crashedGeneration.stderr);
    const { generation } = JSON.parse(await fs.readFile(path.join(v2, `crash-${id}.json`), 'utf8'));
    assert.ok(await fs.access(generation).then(() => true, () => false));
    await recoverGenerations(v2);
    assert.equal(await fs.access(generation).then(() => true, () => false), false);
    assert.deepEqual((await fs.readdir(v2)).filter((name) => name.startsWith('.latest-')), []);
  }

  await withTransaction(v2, async (transaction) => {
    const stage = await prepareStaging({ outDir: v2, genBase: 'new', token: 'token', transaction });
    await fs.writeFile(path.join(stage, 'new.png'), 'V2');
    await publishGeneration({ outDir: v2, genBase: 'new', token: 'token', transaction });
  });
  assert.equal(createHash('sha256').update(await fs.readFile(path.join(root, 'latest.json'))).digest('hex'), legacyPointerHash);
  assert.equal(createHash('sha256').update(await fs.readFile(path.join(legacyGeneration, 'legacy.png'))).digest('hex'), legacyGenerationHash);
  assert.ok(await fs.access(path.join(v2, 'latest.json')).then(() => true, () => false));
});

test('PROBE R3-20: publish and recovery fail before mutation when generations topology is swapped to a symlink', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'cal-topology-'));
  const out = path.join(base, 'publish');
  const outside = path.join(base, 'outside');
  await fs.mkdir(outside);
  await fs.writeFile(path.join(outside, 'keep'), 'KEEP');

  await withTransaction(out, async (transaction) => {
    const stage = await prepareStaging({ outDir: out, genBase: 'g', token: 't', transaction });
    await fs.writeFile(path.join(stage, 'artifact.txt'), 'INSIDE');
    await fs.rename(path.join(out, 'generations'), path.join(base, 'original-generations'));
    await fs.symlink(outside, path.join(out, 'generations'));
    await assert.rejects(() => publishGeneration({ outDir: out, genBase: 'g', token: 't', transaction }), /regular directory|identity changed/);
    assert.deepEqual(await fs.readdir(outside), ['keep']);
    assert.equal(await fs.access(stage).then(() => true, () => false), false);
    assert.equal(await fs.access(path.join(out, 'latest.json')).then(() => true, () => false), false);
  });

  const recoveryOut = path.join(base, 'recovery');
  await fs.mkdir(recoveryOut);
  await fs.symlink(outside, path.join(recoveryOut, 'generations'));
  const id = 'dead-owner';
  const deadStage = path.join(recoveryOut, `.stage-g-t-${id}`);
  await fs.mkdir(deadStage);
  await fs.writeFile(path.join(deadStage, 'keep'), 'PREEXISTING');
  await fs.writeFile(path.join(deadStage, '.transaction.json'), JSON.stringify({
    schemaVersion: 2, transactionId: id, pid: 2 ** 30, host: os.hostname(),
    genBase: 'g', token: 't', staging: path.relative(recoveryOut, deadStage),
    generation: `generations/g-t-${id}`,
  }));
  const before = await fs.readFile(path.join(deadStage, 'keep'), 'utf8');
  await assert.rejects(() => recoverGenerations(recoveryOut), /regular directory/);
  assert.equal(await fs.readFile(path.join(deadStage, 'keep'), 'utf8'), before);
  assert.deepEqual(await fs.readdir(outside), ['keep']);
});

test('PROBE R3-21: calibration handoff preserves original publish failure, prior pointer, and zero owned debris', async () => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'cal-handoff-'));
  await txn(out, 'g', 'prior', 'PRIOR');
  const priorPointer = await fs.readFile(path.join(out, 'latest.json'), 'utf8');
  let candidateGeneration;

  let error;
  try {
    await withTransaction(out, async (transaction) => {
      const stage = await prepareStaging({ outDir: out, genBase: 'g', token: 'candidate', transaction });
      const marker = JSON.parse(await fs.readFile(path.join(stage, '.transaction.json'), 'utf8'));
      candidateGeneration = path.join(out, marker.generation);
      let handedOff = false;
      try {
        await fs.writeFile(path.join(stage, 'artifact.txt'), 'CANDIDATE');
        handedOff = true;
        await publishGeneration({
          outDir: out, genBase: 'g', token: 'candidate', transaction,
          _injectBeforePointer: async () => { throw new Error('ORIGINAL_PUBLISH_FAILURE'); },
        });
      } finally {
        if (!handedOff) await cleanStaging(out, 'g', 'candidate', { transaction });
      }
    });
  } catch (caught) { error = caught; }
  assert.ok(error);
  assert.match(error.message, /ORIGINAL_PUBLISH_FAILURE/);
  assert.equal(await fs.readFile(path.join(out, 'latest.json'), 'utf8'), priorPointer);
  assert.equal(await fs.access(candidateGeneration).then(() => true, () => false), false);
  assert.deepEqual((await fs.readdir(out)).filter((name) => name.startsWith('.stage-') || name.startsWith('.latest-')), []);
});
