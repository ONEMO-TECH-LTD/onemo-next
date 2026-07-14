/** Independent P1 capture-diagnostic oracle. Imports no capture transaction implementation. */
import { canonicalJson, sha256 } from '../src/evidence.mjs';

const HASH = /^[0-9a-f]{64}$/;
const BLOCKERS = ['accepted-operator-envelope', 'plugin-capture-authority'];
const PLANES = {
  document: 'plugin-primary-complete', supplement: 'plugin-primary-complete',
  variables: 'plugin-primary-complete', components: 'plugin-primary-complete',
  fonts: 'plugin-primary-complete', assets: 'plugin-primary-complete',
  references: 'rest-cross-check', dependencies: 'plugin-primary-complete',
};

export function p1CaptureFailures(report) {
  const failures = [];
  if (!plain(report)) return ['report malformed'];
  const { reportHash, ...body } = report;
  if (!HASH.test(reportHash ?? '') || reportHash !== sha256(canonicalJson(body))) failures.push('report hash');
  if (report.schemaVersion !== 1 || report.proofClass !== 'p1-capture-core-diagnostic') failures.push('schema/proof class');
  if (!['DIAGNOSTIC_ONLY', 'FAILED_CAPTURE', 'CANCELLED'].includes(report.state)) failures.push('state');
  if (report.persisted !== false || canonicalJson(report.blockers) !== canonicalJson(BLOCKERS)) failures.push('authority truth');
  if (!Number.isInteger(report.attempts) || report.attempts < 1 || report.attempts > 2) failures.push('attempts');
  if (!HASH.test(report.operabilityReportHash ?? '')) failures.push('operability authority');
  if (!Array.isArray(report.issues) || report.issues.some((value) => !text(value))) failures.push('issues');
  if (Object.keys(report.sourcePlanes ?? {}).sort().join(',') !== Object.keys(PLANES).sort().join(',')) failures.push('source plane census');
  for (const [family, expected] of Object.entries(PLANES)) if (report.sourcePlanes?.[family] !== expected) failures.push(`source plane ${family}`);
  const proof = report.readOnlyProof;
  if ((report.state === 'DIAGNOSTIC_ONLY' || proof !== null) && (!plain(proof) || proof.adapterKind !== 'dedicated-read-only-plugin' || !HASH.test(proof.bundleHash ?? '') || !HASH.test(proof.staticAuditHash ?? '')
    || proof.dynamicAccess !== false || !Array.isArray(proof.forbiddenCalls) || proof.forbiddenCalls.length
    || !Array.isArray(proof.documentChangeEvents) || proof.documentChangeEvents.length
    || !HASH.test(report.readOnlyProofHash ?? '') || report.readOnlyProofHash !== sha256(canonicalJson(proof)))) failures.push('read-only proof');
  if (report.state === 'DIAGNOSTIC_ONLY') {
    if (!HASH.test(report.candidateHash ?? '') || !stableTriplet(report.identities?.versions, ['V0', 'V1', 'V2'], text)
      || !stableTriplet(report.identities?.fingerprints, ['F0', 'F1', 'F2'], (value) => HASH.test(value))
      || !stableTriplet(report.identities?.dependencyLocks, ['D0', 'D1', 'D2'], (value) => HASH.test(value))
      || report.issues.length) failures.push('false diagnostic success');
  } else {
    if (report.candidateHash !== null) failures.push('failed candidate retained');
    if (!report.issues.length) failures.push('failed issue missing');
    if (proof === null) {
      if (report.readOnlyProofHash !== null) failures.push('orphan read-only proof hash');
    }
  }
  return [...new Set(failures)];
}

function stableTriplet(value, keys, predicate) {
  return plain(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',')
    && keys.every((key) => predicate(value[key])) && keys.every((key) => value[key] === value[keys[0]]);
}
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string' && value.length > 0;
