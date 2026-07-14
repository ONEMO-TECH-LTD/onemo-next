/** Independent P0 §4.7 diagnostic-report oracle. No production operability imports. */
import { canonicalJson, sha256 } from '../src/evidence.mjs';

const PHASES = ['version-v0', 'pass-a', 'pass-b', 'version-v1', 'references', 'pass-c', 'version-v2', 'seal'];
const BLOCKERS = ['accepted-operator-envelope', 'integration-capture-authority'];
const HASH = /^[0-9a-f]{64}$/;

export function p0OperabilityFailures(report) {
  const failures = [];
  if (!report || typeof report !== 'object' || Array.isArray(report)) return ['report malformed'];
  const { reportHash, ...body } = report;
  if (!HASH.test(reportHash ?? '') || reportHash !== sha256(canonicalJson(body))) failures.push('report hash');
  if (report.schemaVersion !== 1 || report.proofClass !== 'p0-operability-diagnostic') failures.push('schema/proof class');
  if (!text(report.trialId) || !['local-only', 'remote-heavy'].includes(report.corpusClass) || !text(report.fileKey)) failures.push('report identity');
  if (!['DIAGNOSTIC_ONLY', 'FAILED_CAPTURE', 'CANCELLED'].includes(report.state) || report.acceptedEnvelope !== false || canonicalJson(report.blockers) !== canonicalJson(BLOCKERS)) failures.push('terminal/envelope truth');
  if (!Array.isArray(report.issues) || report.issues.some((issue) => !text(issue)) || (report.operatorAction !== null && !text(report.operatorAction))) failures.push('issue/action shape');
  if (!Array.isArray(report.attempts) || report.attempts.length < 1 || report.attempts.length > 2) return [...failures, 'attempt census'];
  let requests = 0, bytes = 0, unstable = 0;
  for (const [attemptIndex, attempt] of report.attempts.entries()) {
    if (attempt?.attempt !== attemptIndex + 1 || !Array.isArray(attempt.phases) || !Array.isArray(attempt.requests) || !Array.isArray(attempt.changedDependencies)) { failures.push('attempt identity'); continue; }
    let requestOffset = 0;
    for (const [phaseIndex, phase] of attempt.phases.entries()) {
      if (phase.id !== PHASES[phaseIndex] || !integer(phase.completed) || !integer(phase.total) || phase.total < 1 || phase.completed > phase.total || !finite(phase.wallMs) || !integer(phase.requestCount) || !integer(phase.transferredBytes)) failures.push('phase census');
      const owned = attempt.requests.slice(requestOffset, requestOffset + phase.requestCount);
      if (owned.length !== phase.requestCount || owned.reduce((sum, row) => sum + row.bytes, 0) !== phase.transferredBytes) failures.push('phase request census');
      requestOffset += phase.requestCount;
    }
    if (requestOffset !== attempt.requests.length) failures.push('request phase ownership');
    for (const request of attempt.requests) {
      if (!text(request?.provider) || !text(request?.fileKey) || !text(request?.key) || !integer(request?.bytes)) failures.push('request shape');
      requests++;
      bytes += request?.bytes ?? 0;
    }
    for (const dependency of attempt.changedDependencies) if (!['provider', 'fileKey', 'key', 'fact', 'requiredPermission', 'nextAction'].every((key) => text(dependency?.[key]))) failures.push('dependency actionability');
    if (attempt.stability !== null && !['STABLE', 'UNSTABLE', 'ACTIVE_FILE_CHANGED'].includes(attempt.stability)) failures.push('attempt stability');
    if (attempt.identities !== null) {
      const versionsObject = attempt.identities?.versions ?? {};
      const fingerprintsObject = attempt.identities?.fingerprints ?? {};
      const dependenciesObject = attempt.identities?.dependencyLocks ?? {};
      if (Object.keys(versionsObject).sort().join(',') !== 'V0,V1,V2' || Object.keys(fingerprintsObject).sort().join(',') !== 'F0,F1,F2' || Object.keys(dependenciesObject).sort().join(',') !== 'D0,D1,D2'
        || Object.values(versionsObject).some((value) => !text(value)) || Object.values(fingerprintsObject).some((value) => !HASH.test(value)) || Object.values(dependenciesObject).some((value) => !HASH.test(value))) failures.push('identity shape');
      const versions = Object.values(versionsObject);
      const fingerprints = Object.values(fingerprintsObject);
      const dependencies = Object.values(dependenciesObject);
      const stable = versions.length === 3 && fingerprints.length === 3 && dependencies.length === 3
        && same(versions) && same(fingerprints) && same(dependencies);
      if (attempt.stability === 'STABLE' && (!stable || attempt.observedFileKey !== report.fileKey || attempt.changedDependencies?.length)) failures.push('stability derivation');
      if (attempt.stability === 'UNSTABLE' && (stable || attempt.observedFileKey !== report.fileKey)) failures.push('stability derivation');
      if (attempt.stability === 'ACTIVE_FILE_CHANGED' && attempt.observedFileKey === report.fileKey) failures.push('active-file derivation');
    } else if (attempt.stability !== null || attempt.observedFileKey !== null) failures.push('unfinished identity');
    if (attempt.stability === 'UNSTABLE') unstable++;
  }
  const retries = report.attempts.length - 1;
  for (const key of ['wallMs', 'cpuUserMicros', 'cpuSystemMicros', 'peakRssBytes', 'requestCount', 'transferredBytes', 'retries', 'unstableAttempts', 'retryRate', 'instabilityRate']) if (!finite(report.metrics?.[key])) failures.push('metric shape');
  if (report.metrics?.requestCount !== requests || report.metrics?.transferredBytes !== bytes || report.metrics?.retries !== retries || report.metrics?.unstableAttempts !== unstable
    || report.metrics?.retryRate !== retries / report.attempts.length || report.metrics?.instabilityRate !== unstable / report.attempts.length) failures.push('derived metrics');
  const persistent = report.persistentState;
  if (!HASH.test(persistent?.beforeHash ?? '') || (persistent?.afterHash !== null && !HASH.test(persistent?.afterHash ?? '')) || persistent?.unchanged !== (persistent?.beforeHash === persistent?.afterHash)) failures.push('persistent proof');
  if (report.state === 'DIAGNOSTIC_ONLY') {
    const last = report.attempts.at(-1);
    if (last?.stability !== 'STABLE' || last?.phases?.length !== PHASES.length || last.phases.some((phase) => phase.completed !== phase.total) || persistent?.unchanged !== true || report.issues?.length || report.operatorAction !== null) failures.push('false diagnostic success');
  }
  const lastAttempt = report.attempts.at(-1);
  if (report.state === 'CANCELLED' && (lastAttempt?.stability !== null || persistent?.unchanged !== true || !report.issues?.some((issue) => issue.startsWith('capture cancelled during ')))) failures.push('cancelled derivation');
  if (report.state === 'FAILED_CAPTURE' && ((lastAttempt?.stability === 'STABLE' && persistent?.unchanged === true) || (lastAttempt?.stability === 'UNSTABLE' && report.attempts.length !== 2))) failures.push('failed derivation');
  if (report.state !== 'DIAGNOSTIC_ONLY' && (!Array.isArray(report.issues) || !report.issues.length || !text(report.operatorAction))) failures.push('failure actionability');
  return [...new Set(failures)];
}

const text = (value) => typeof value === 'string' && value.length > 0;
const integer = (value) => Number.isInteger(value) && value >= 0;
const finite = (value) => Number.isFinite(value) && value >= 0;
const same = (values) => values.every((value) => value === values[0]);
