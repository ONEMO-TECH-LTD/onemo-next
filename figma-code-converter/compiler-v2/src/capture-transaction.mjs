/** C11 v3 P1 three-pass capture core. Diagnostic until external envelope/adapter authority exists. */
import { canonicalJson, fingerprint, sha256 } from './evidence.mjs';
import { assertCaptureOperabilityReport, measureCaptureOperability } from './capture-operability.mjs';

const HASH = /^[0-9a-f]{64}$/;
const BLOCKERS = Object.freeze(['accepted-operator-envelope', 'plugin-capture-authority']);
const REQUIRED_PLANES = Object.freeze({
  document: 'plugin-primary-complete', supplement: 'plugin-primary-complete',
  variables: 'plugin-primary-complete', components: 'plugin-primary-complete',
  fonts: 'plugin-primary-complete', assets: 'plugin-primary-complete',
  references: 'rest-cross-check', dependencies: 'plugin-primary-complete',
});

export class CaptureTransactionError extends Error {
  constructor(message) { super(message); this.state = 'FAILED_CAPTURE'; }
}

export class CaptureDependencyError extends Error {
  constructor(dependency) { super(`capture dependency unavailable: ${dependency?.provider ?? '?'}/${dependency?.key ?? '?'}`); this.dependency = dependency; }
}

export async function runCaptureDiagnostic({
  trialId, corpusClass, fileKey, rootIds, referenceDeclarations = [], adapter, signal,
  readPersistentStateHash, onProgress = () => {},
}) {
  validateInput({ fileKey, rootIds, referenceDeclarations, adapter });
  let stableCandidate = null;
  let lastAudit = null;
  const operability = await measureCaptureOperability({
    trialId, corpusClass, fileKey, signal, readPersistentStateHash, onProgress,
    runAttempt: async ({ attempt, meter, signal: attemptSignal }) => {
      const root = {};
      const passes = {};
      const references = [];

      root.V0 = await phaseResult(meter, 'version-v0', () => adapter.readRoot({ phase: 'version-v0', attempt, signal: attemptSignal }));
      passes.A = await phaseResult(meter, 'pass-a', () => adapter.capturePass({ pass: 'A', attempt, rootIds: [...rootIds], signal: attemptSignal }));
      validatePass(passes.A, fileKey, rootIds, 'A');
      passes.B = await phaseResult(meter, 'pass-b', () => adapter.capturePass({ pass: 'B', attempt, rootIds: [...rootIds], signal: attemptSignal }));
      validatePass(passes.B, fileKey, rootIds, 'B');
      root.V1 = await phaseResult(meter, 'version-v1', () => adapter.readRoot({ phase: 'version-v1', attempt, signal: attemptSignal }));

      await meter.phase('references', Math.max(1, referenceDeclarations.length), async ({ advance, recordRequest, failDependency }) => {
        if (!referenceDeclarations.length) { advance(); return; }
        for (const declaration of referenceDeclarations) {
          let response;
          try { response = await adapter.captureReference({ declaration: structuredClone(declaration), attempt, signal: attemptSignal }); }
          catch (error) {
            if (error instanceof CaptureDependencyError) failDependency(error.dependency);
            throw error;
          }
          for (const request of response?.requests ?? []) recordRequest(request);
          references.push(validateReference(response?.value, declaration, root.V0));
          advance();
        }
      });

      passes.C = await phaseResult(meter, 'pass-c', () => adapter.capturePass({ pass: 'C', attempt, rootIds: [...rootIds], signal: attemptSignal }));
      validatePass(passes.C, fileKey, rootIds, 'C');
      root.V2 = await phaseResult(meter, 'version-v2', () => adapter.readRoot({ phase: 'version-v2', attempt, signal: attemptSignal }));

      let audit;
      await meter.phase('seal', 1, async ({ advance }) => {
        audit = validateAudit(await adapter.readAudit({ attempt, signal: attemptSignal }));
        lastAudit = audit;
        for (const [key, identity] of Object.entries(root)) validateRootIdentity(identity, rootIds, key);
        if (Object.values(root).every((identity) => identity.fileKey === fileKey)) {
          for (const [pass, version] of [['A', 'V0'], ['B', 'V1'], ['C', 'V2']]) validateRootLock(passes[pass], root[version], pass);
        }
        advance();
      });

      const versions = Object.fromEntries(['V0', 'V1', 'V2'].map((key) => [key, root[key].fileVersion]));
      const fingerprints = Object.fromEntries(['A', 'B', 'C'].map((key, index) => [`F${index}`, passFingerprint(passes[key])]));
      const dependencyLocks = Object.fromEntries(['A', 'B', 'C'].map((key, index) => [`D${index}`, dependencyLock(passes[key], referenceDeclarations, root[`V${index}`])]));
      const stable = same(Object.values(versions)) && same(Object.values(fingerprints)) && same(Object.values(dependencyLocks));
      const changedDependencies = stable ? [] : identityChanges({ versions, fingerprints, dependencyLocks, fileKey });
      if (stable) stableCandidate = makeCandidate({ root, pass: passes.C, references, audit });
      else stableCandidate = null;
      const observedFileKey = Object.values(root).find((identity) => identity.fileKey !== fileKey)?.fileKey ?? root.V2.fileKey;
      return { observedFileKey, versions, fingerprints, dependencyLocks, changedDependencies };
    },
  });

  if (operability.state !== 'DIAGNOSTIC_ONLY') stableCandidate = null;
  const last = operability.attempts.at(-1);
  const body = {
    schemaVersion: 1,
    proofClass: 'p1-capture-core-diagnostic',
    state: operability.state,
    attempts: operability.attempts.length,
    identities: last?.identities ?? null,
    sourcePlanes: { ...REQUIRED_PLANES },
    readOnlyProof: stableCandidate?.readOnlyProof ?? lastAudit,
    readOnlyProofHash: (stableCandidate?.readOnlyProof ?? lastAudit) ? sha256(canonicalJson(stableCandidate?.readOnlyProof ?? lastAudit)) : null,
    candidateHash: stableCandidate ? candidateHash(stableCandidate) : null,
    operabilityReportHash: operability.reportHash,
    persisted: false,
    blockers: [...BLOCKERS],
    issues: [...operability.issues],
  };
  const report = { ...body, reportHash: sha256(canonicalJson(body)) };
  const bundle = { report, candidate: stableCandidate, operability };
  assertCaptureDiagnosticBundle(bundle);
  return bundle;
}

export function assertCaptureDiagnosticReport(report) {
  if (!plain(report)) throw new CaptureTransactionError('capture diagnostic report malformed');
  const { reportHash, ...body } = report;
  if (!HASH.test(reportHash ?? '') || reportHash !== sha256(canonicalJson(body))) throw new CaptureTransactionError('capture diagnostic report hash mismatch');
  if (report.schemaVersion !== 1 || report.proofClass !== 'p1-capture-core-diagnostic' || !['DIAGNOSTIC_ONLY', 'FAILED_CAPTURE', 'CANCELLED'].includes(report.state)) throw new CaptureTransactionError('capture diagnostic schema/state malformed');
  if (report.persisted !== false || canonicalJson(report.blockers) !== canonicalJson(BLOCKERS)) throw new CaptureTransactionError('diagnostic capture cannot claim persistence or authority');
  if (!Number.isInteger(report.attempts) || report.attempts < 1 || report.attempts > 2 || !HASH.test(report.operabilityReportHash ?? '') || !Array.isArray(report.issues) || report.issues.some((issue) => !text(issue))) throw new CaptureTransactionError('capture diagnostic attempts/issues malformed');
  validateSourcePlanes(report.sourcePlanes);
  if (report.state === 'DIAGNOSTIC_ONLY') {
    validateAudit(report.readOnlyProof);
    if (!HASH.test(report.readOnlyProofHash ?? '') || report.readOnlyProofHash !== sha256(canonicalJson(report.readOnlyProof))
      || !HASH.test(report.candidateHash ?? '') || !stableTriplet(report.identities?.versions, ['V0', 'V1', 'V2'], text)
      || !stableTriplet(report.identities?.fingerprints, ['F0', 'F1', 'F2'], (value) => HASH.test(value))
      || !stableTriplet(report.identities?.dependencyLocks, ['D0', 'D1', 'D2'], (value) => HASH.test(value)) || report.issues.length) {
      throw new CaptureTransactionError('diagnostic success lacks stable candidate truth');
    }
  } else {
    if (report.candidateHash !== null) throw new CaptureTransactionError('failed capture retained a candidate');
    if (!report.issues.length) throw new CaptureTransactionError('failed capture lacks an actionable issue');
    if (report.readOnlyProof === null) {
      if (report.readOnlyProofHash !== null) throw new CaptureTransactionError('failed capture has an orphan read-only proof hash');
    } else {
      validateAudit(report.readOnlyProof);
      if (!HASH.test(report.readOnlyProofHash ?? '') || report.readOnlyProofHash !== sha256(canonicalJson(report.readOnlyProof))) throw new CaptureTransactionError('failed capture read-only proof hash mismatch');
    }
    if (report.identities !== null && (!triplet(report.identities.versions, ['V0', 'V1', 'V2'], text)
      || !triplet(report.identities.fingerprints, ['F0', 'F1', 'F2'], (value) => HASH.test(value))
      || !triplet(report.identities.dependencyLocks, ['D0', 'D1', 'D2'], (value) => HASH.test(value)))) throw new CaptureTransactionError('failed capture identity evidence malformed');
  }
  return true;
}

export function assertCaptureCandidate(candidate, report) {
  if (!plain(candidate) || candidate.schemaVersion !== 1 || candidate.proofClass !== 'p1-capture-candidate') throw new CaptureTransactionError('capture candidate malformed');
  validateSourcePlanes(candidate.sourcePlanes);
  validateAudit(candidate.readOnlyProof);
  validatePass(candidate, candidate.rootIdentity.fileKey, candidate.rootIdentity.rootIds, 'candidate');
  if (!Array.isArray(candidate.references)) throw new CaptureTransactionError('capture candidate references malformed');
  for (const reference of candidate.references) {
    if (!Buffer.isBuffer(reference.bytes) || sha256(reference.bytes) !== reference.sha256 || reference.bytes.length !== reference.byteLength) throw new CaptureTransactionError(`capture reference bytes drift: ${reference.file ?? '?'}`);
  }
  const declarations = candidate.references.map(({ bytes, sha256: hash, byteLength, ...declaration }) => declaration);
  if (passFingerprint(candidate) !== report.identities.fingerprints.F2) throw new CaptureTransactionError('capture candidate fingerprint does not conserve F2');
  if (dependencyLock(candidate, declarations, candidate.rootIdentity) !== report.identities.dependencyLocks.D2) throw new CaptureTransactionError('capture candidate dependency lock does not conserve D2');
  if (candidateHash(candidate) !== report.candidateHash) throw new CaptureTransactionError('capture candidate hash mismatch');
  return true;
}

export function assertCaptureDiagnosticBundle({ report, candidate, operability }) {
  assertCaptureDiagnosticReport(report);
  assertCaptureOperabilityReport(operability);
  if (report.operabilityReportHash !== operability.reportHash || report.state !== operability.state
    || report.attempts !== operability.attempts.length || canonicalJson(report.issues) !== canonicalJson(operability.issues)
    || canonicalJson(report.identities) !== canonicalJson(operability.attempts.at(-1)?.identities ?? null)) {
    throw new CaptureTransactionError('capture diagnostic report diverges from operability authority');
  }
  if (report.state === 'DIAGNOSTIC_ONLY') {
    if (!candidate) throw new CaptureTransactionError('stable capture bundle missing candidate');
    assertCaptureCandidate(candidate, report);
  } else if (candidate !== null) throw new CaptureTransactionError('failed capture bundle retained candidate');
  return true;
}

async function phaseResult(meter, phase, work) {
  let value;
  await meter.phase(phase, 1, async ({ advance, recordRequest, failDependency }) => {
    let response;
    try { response = await work(); }
    catch (error) {
      if (error instanceof CaptureDependencyError) failDependency(error.dependency);
      throw error;
    }
    for (const request of response?.requests ?? []) recordRequest(request);
    value = response?.value ?? response?.identity;
    advance();
  });
  if (!plain(value)) throw new CaptureTransactionError(`${phase} returned no capture value`);
  return value;
}

function validateInput({ fileKey, rootIds, referenceDeclarations, adapter }) {
  if (!text(fileKey) || !Array.isArray(rootIds) || !rootIds.length || rootIds.some((id) => !text(id)) || new Set(rootIds).size !== rootIds.length) throw new CaptureTransactionError('capture file/root identity malformed');
  if (!plain(adapter) || !['readRoot', 'capturePass', 'captureReference', 'readAudit'].every((method) => typeof adapter[method] === 'function')) throw new CaptureTransactionError('dedicated capture adapter interface incomplete');
  if (!Array.isArray(referenceDeclarations)) throw new CaptureTransactionError('reference declarations malformed');
  const seen = new Set();
  const states = new Set();
  for (const ref of referenceDeclarations) {
    for (const key of ['state', 'file', 'fileKey', 'nodeId', 'fileVersion']) if (!text(ref?.[key])) throw new CaptureTransactionError(`reference declaration missing ${key}`);
    if (!validRelative(ref.file, 'references') || !plain(ref.request) || !jsonSafe(ref.request)) throw new CaptureTransactionError(`reference declaration invalid: ${ref.file}`);
    if (ref.fileKey !== fileKey && (!plain(ref.externalApproval) || !text(ref.externalApproval.authorityId) || !HASH.test(ref.externalApproval.manifestHash ?? ''))) throw new CaptureTransactionError(`external reference ${ref.file} lacks approved manifest authority`);
    const identity = `${ref.state}\u241f${ref.file}`;
    if (seen.has(identity)) throw new CaptureTransactionError(`duplicate reference declaration ${identity}`);
    if (states.has(ref.state)) throw new CaptureTransactionError(`duplicate reference state ${ref.state}`);
    seen.add(identity);
    states.add(ref.state);
  }
}

function validateRootIdentity(identity, rootIds, phase) {
  const keys = ['branchKey', 'colorProfile', 'currentPageId', 'editorType', 'fileKey', 'fileVersion', 'rootIds'];
  if (!jsonSafe(identity) || Object.keys(identity).sort().join(',') !== keys.sort().join(',')) throw new CaptureTransactionError(`${phase} root identity is not the closed JSON contract`);
  for (const key of ['fileKey', 'branchKey', 'fileVersion', 'editorType', 'currentPageId', 'colorProfile']) if (!text(identity?.[key])) throw new CaptureTransactionError(`${phase} root identity missing ${key}`);
  if (!Array.isArray(identity.rootIds) || canonicalJson(identity.rootIds) !== canonicalJson(rootIds)) throw new CaptureTransactionError(`${phase} root selection drift`);
}

function validatePass(pass, fileKey, rootIds, label) {
  if (!plain(pass) || !plain(pass.document) || !plain(pass.supplement) || !plain(pass.variables) || !plain(pass.components) || !plain(pass.fonts) || !plain(pass.dependencies)) throw new CaptureTransactionError(`pass ${label} evidence families incomplete`);
  if (![pass.document, pass.supplement, pass.variables, pass.components, pass.fonts, pass.dependencies, pass.sourcePlanes].every(jsonSafe)) throw new CaptureTransactionError(`pass ${label} evidence is not canonical JSON data`);
  validateSourcePlanes(pass.sourcePlanes);
  if (!(pass.assets instanceof Map) || [...pass.assets.entries()].some(([name, bytes]) => !validRelative(name) || !Buffer.isBuffer(bytes) || bytes.length < 1)) throw new CaptureTransactionError(`pass ${label} assets must be a confined nonempty byte map`);
  const boundary = pass.dependencies.boundary;
  if (!plain(boundary) || boundary.closed !== true || canonicalJson(boundary.rootIds) !== canonicalJson(rootIds)
    || !Array.isArray(boundary.nodeIds) || rootIds.some((id) => !boundary.nodeIds.includes(id))
    || !Array.isArray(boundary.externalDependencies) || !Array.isArray(boundary.backdropDependencies)) throw new CaptureTransactionError(`pass ${label} render boundary is open or incomplete`);
  if (!Array.isArray(pass.dependencies.locks)) throw new CaptureTransactionError(`pass ${label} dependency locks missing`);
  const locks = new Set();
  for (const lock of pass.dependencies.locks) {
    if (!['provider', 'fileKey', 'key'].every((key) => text(lock?.[key])) || (!text(lock.version) && !HASH.test(lock.fingerprint ?? ''))
      || (lock.fingerprint !== undefined && !HASH.test(lock.fingerprint))) throw new CaptureTransactionError(`pass ${label} dependency lock malformed`);
    const id = `${lock.provider}\u241f${lock.fileKey}\u241f${lock.key}`;
    if (locks.has(id)) throw new CaptureTransactionError(`pass ${label} duplicate dependency lock ${id}`);
    locks.add(id);
  }
  if (!pass.dependencies.locks.some((lock) => lock.fileKey === fileKey && lock.key === 'root' && text(lock.version))) throw new CaptureTransactionError(`pass ${label} root dependency lock missing or unversioned`);
  const nodes = new Map();
  (function walk(node) {
    if (!text(node?.id) || !text(node?.type) || nodes.has(node.id)) throw new CaptureTransactionError(`pass ${label} document identity malformed`);
    if (node.children !== undefined && !Array.isArray(node.children)) throw new CaptureTransactionError(`pass ${label} document children malformed at ${node.id}`);
    nodes.set(node.id, node);
    for (const child of node.children ?? []) walk(child);
  })(pass.document);
  if (new Set(boundary.nodeIds).size !== boundary.nodeIds.length || canonicalJson([...boundary.nodeIds].sort()) !== canonicalJson([...nodes.keys()].sort())) throw new CaptureTransactionError(`pass ${label} closed-boundary node census mismatch`);
  validateBoundaryDependencies(pass, label, locks);
  if (pass.supplement.schemaVersion !== 1 || !Array.isArray(pass.supplement.nodes)) throw new CaptureTransactionError(`pass ${label} supplement schema incomplete`);
  validateFonts(pass.fonts, pass.assets, nodes, label);
  const supplements = new Map();
  for (const row of pass.supplement.nodes) {
    if (!text(row?.nodeId) || !nodes.has(row.nodeId) || supplements.has(row.nodeId) || row.nodeType !== nodes.get(row.nodeId).type
      || !plain(row.resolvedVariableModes) || !plain(row.explicitVariableModes)) throw new CaptureTransactionError(`pass ${label} supplement node incomplete: ${row?.nodeId ?? '?'}`);
    supplements.set(row.nodeId, row);
  }
  for (const nodeId of nodes.keys()) if (!supplements.has(nodeId)) throw new CaptureTransactionError(`pass ${label} supplement missing node ${nodeId}`);
}

function validateRootLock(pass, rootIdentity, label) {
  const lock = pass.dependencies.locks.find((row) => row.fileKey === rootIdentity.fileKey && row.key === 'root');
  if (!lock || lock.version !== rootIdentity.fileVersion) throw new CaptureTransactionError(`pass ${label} root dependency version disagrees with ${rootIdentity.fileVersion}`);
}

function validateFonts(fonts, assets, nodes, label) {
  if (!Array.isArray(fonts.families)) throw new CaptureTransactionError(`pass ${label} font inventory missing`);
  for (const row of fonts.families) {
    const figma = row?.figma;
    const web = row?.web;
    if (!plain(figma) || !text(figma.family) || !text(figma.style) || figma.available !== true || figma.missing !== false
      || !Array.isArray(figma.ranges) || !figma.ranges.length || figma.ranges.some((range) => {
        const node = nodes.get(range?.nodeId);
        return !node || node.type !== 'TEXT' || !Number.isInteger(range.start) || !Number.isInteger(range.end)
          || range.start < 0 || range.end <= range.start || range.end > String(node.characters ?? '').length;
      })) throw new CaptureTransactionError(`pass ${label} Figma font provenance malformed`);
    if (!plain(web) || !text(web.source) || !validRelative(web.path) || !text(web.licenseId) || !text(web.format)
      || !(text(web.weight) || Number.isFinite(web.weight)) || !text(web.style) || !Number.isInteger(web.bytes) || web.bytes < 1 || !HASH.test(web.sha256 ?? '')) throw new CaptureTransactionError(`pass ${label} web-font provenance malformed`);
    const bytes = assets.get(web.path);
    if (!Buffer.isBuffer(bytes) || bytes.length !== web.bytes || sha256(bytes) !== web.sha256) throw new CaptureTransactionError(`pass ${label} web-font bytes are missing or stale: ${web.path}`);
  }
}

function validateBoundaryDependencies(pass, label, lockIds) {
  for (const family of ['externalDependencies', 'backdropDependencies']) {
    for (const dependency of pass.dependencies.boundary[family]) {
      if (!plain(dependency) || !['provider', 'fileKey', 'key'].every((key) => text(dependency[key]))
        || !['captured', 'reference', 'inactive-proven'].includes(dependency.disposition)) throw new CaptureTransactionError(`pass ${label} ${family} disposition malformed`);
      const identity = `${dependency.provider}\u241f${dependency.fileKey}\u241f${dependency.key}`;
      if (!lockIds.has(identity)) throw new CaptureTransactionError(`pass ${label} ${family} dependency lacks a matching lock: ${identity}`);
    }
  }
}

function validateSourcePlanes(planes) {
  if (!plain(planes)) throw new CaptureTransactionError('per-fact source planes missing');
  if (Object.keys(planes).sort().join(',') !== Object.keys(REQUIRED_PLANES).sort().join(',')) throw new CaptureTransactionError('per-fact source plane census differs from the closed contract');
  for (const [family, expected] of Object.entries(REQUIRED_PLANES)) if (planes[family] !== expected) throw new CaptureTransactionError(`${family}=${planes[family] ?? 'missing'} (need ${expected})`);
}

function validateReference(value, declaration, rootIdentity) {
  if (!plain(value) || !Buffer.isBuffer(value.bytes) || value.bytes.length < 1) throw new CaptureTransactionError(`reference ${declaration.state} returned no byte artifact`);
  for (const key of ['state', 'file', 'fileKey', 'nodeId', 'fileVersion']) if (value[key] !== declaration[key]) throw new CaptureTransactionError(`reference ${declaration.state} ${key} drift`);
  if (declaration.fileKey === rootIdentity.fileKey && declaration.fileVersion !== rootIdentity.fileVersion) throw new CaptureTransactionError(`reference ${declaration.state} version does not match root V0`);
  if (canonicalJson(value.request) !== canonicalJson(declaration.request)) throw new CaptureTransactionError(`reference ${declaration.state} request drift`);
  return { ...structuredClone(declaration), bytes: Buffer.from(value.bytes), sha256: sha256(value.bytes), byteLength: value.bytes.length };
}

function validateAudit(audit) {
  if (!plain(audit) || audit.adapterKind !== 'dedicated-read-only-plugin' || !HASH.test(audit.bundleHash ?? '') || !HASH.test(audit.staticAuditHash ?? '')
    || audit.dynamicAccess !== false || !Array.isArray(audit.forbiddenCalls) || audit.forbiddenCalls.length
    || !Array.isArray(audit.documentChangeEvents) || audit.documentChangeEvents.length) {
    const event = Array.isArray(audit?.documentChangeEvents) && audit.documentChangeEvents.length ? 'documentchange event recorded' : 'read-only adapter audit invalid';
    throw new CaptureTransactionError(event);
  }
  return structuredClone(audit);
}

function passFingerprint(pass) {
  return fingerprint({
    document: pass.document, supplement: pass.supplement, variables: pass.variables,
    components: pass.components, fonts: pass.fonts, dependencies: pass.dependencies,
    assetHashes: Object.fromEntries([...pass.assets].sort(([a], [b]) => a.localeCompare(b)).map(([name, bytes]) => [name, sha256(bytes)])),
  });
}

function dependencyLock(pass, references, rootIdentity) {
  return sha256(canonicalJson({
    rootIdentity,
    locks: [...pass.dependencies.locks].sort((a, b) => `${a.provider}\u241f${a.fileKey}\u241f${a.key}`.localeCompare(`${b.provider}\u241f${b.fileKey}\u241f${b.key}`)),
    boundary: pass.dependencies.boundary,
    references,
  }));
}

function makeCandidate({ root, pass, references, audit }) {
  return {
    schemaVersion: 1,
    proofClass: 'p1-capture-candidate',
    rootIdentity: structuredClone(root.V2),
    sourcePlanes: structuredClone(pass.sourcePlanes),
    document: structuredClone(pass.document), supplement: structuredClone(pass.supplement),
    variables: structuredClone(pass.variables), components: structuredClone(pass.components),
    fonts: structuredClone(pass.fonts), dependencies: structuredClone(pass.dependencies),
    assets: new Map([...pass.assets].map(([name, bytes]) => [name, Buffer.from(bytes)])),
    references: references.map((reference) => ({ ...structuredClone(reference), bytes: Buffer.from(reference.bytes) })),
    readOnlyProof: structuredClone(audit),
  };
}

function candidateHash(candidate) {
  const descriptor = {
    ...candidate,
    assets: Object.fromEntries([...candidate.assets].sort(([a], [b]) => a.localeCompare(b)).map(([name, bytes]) => [name, { sha256: sha256(bytes), bytes: bytes.length }])),
    references: candidate.references.map(({ bytes, ...reference }) => ({ ...reference, sha256: sha256(bytes), byteLength: bytes.length })),
  };
  return sha256(canonicalJson(descriptor));
}

function identityChanges({ versions, fingerprints, dependencyLocks, fileKey }) {
  const changes = [];
  if (!same(Object.values(versions))) changes.push(change(fileKey, 'root-version', 'root version changed across V0/V1/V2'));
  if (!same(Object.values(fingerprints))) changes.push(change(fileKey, 'content-fingerprint', 'semantic capture fingerprint changed across A/B/C'));
  if (!same(Object.values(dependencyLocks))) changes.push(change(fileKey, 'dependency-lock', 'dependency lock changed across A/B/C'));
  return changes;
}

const change = (fileKey, key, fact) => ({
  provider: 'figma-capture', fileKey, key, fact, requiredPermission: 'stable view access',
  nextAction: 'wait for the named file/dependency to settle, then start one fresh capture',
});
function stableTriplet(value, keys, predicate) {
  return triplet(value, keys, predicate) && keys.every((key) => value[key] === value[keys[0]]);
}
function triplet(value, keys, predicate) {
  return plain(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',') && keys.every((key) => predicate(value[key]));
}
const same = (values) => values.length > 0 && values.every((value) => value === values[0]);
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string' && value.length > 0;
function validRelative(value, requiredRoot = null) {
  if (!text(value) || value.includes('\\') || value.startsWith('/') || value.endsWith('/')) return false;
  const segments = value.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return false;
  return requiredRoot === null || segments[0] === requiredRoot;
}
function jsonSafe(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(jsonSafe);
  if (!plain(value) || Object.getPrototypeOf(value) !== Object.prototype) return false;
  return Object.entries(value).every(([key, child]) => text(key) && jsonSafe(child));
}
