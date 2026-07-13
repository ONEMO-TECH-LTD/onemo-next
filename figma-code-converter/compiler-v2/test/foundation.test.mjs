/**
 * compiler-v2 foundation tests — schema identity tuple, evidence snapshot integrity,
 * alias inventory classification. Every test encodes a contract law (WHY), not just behavior.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { sourceBindingIdentity, emittedBindingIdentity, formatBindingForError, BindingIdentityError, validateBindingRecord, validateManifest, SCHEMA } from '../src/schema.mjs';
const bindingIdentity = sourceBindingIdentity;
import { writeSnapshot, readSnapshot, canonicalJson, censusOf, restTextRuns, EvidenceError } from '../src/evidence.mjs';
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

test('PROBE 1b: a manifest byte-length lie is refused at read (not just sha)', async () => {
  const tmp = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'cv2-')), 'snap');
  await makeSnap(tmp);
  const mp = path.join(tmp, 'manifest.json');
  const m = JSON.parse(await fs.readFile(mp, 'utf8'));
  m.files['document.rest.json'].bytes += 99;
  await fs.writeFile(mp, JSON.stringify(m, null, 1));
  await assert.rejects(() => readSnapshot(tmp), (e) => e instanceof EvidenceError && /byte-length|hash|fingerprint|invalid/.test(e.message));
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
