/** P0 §4.7/V18 capture-operability measurement. Diagnostic only; cannot approve an envelope. */
import { canonicalJson, sha256 } from './evidence.mjs';

export const CAPTURE_PHASES = Object.freeze([
  'version-v0', 'pass-a', 'pass-b', 'version-v1', 'references', 'pass-c', 'version-v2', 'seal',
]);

const HASH = /^[0-9a-f]{64}$/;
const CORPUS_CLASSES = Object.freeze(['local-only', 'remote-heavy']);
const BLOCKERS = Object.freeze(['accepted-operator-envelope', 'integration-capture-authority']);

export class CaptureOperabilityError extends Error {
  constructor(message) { super(message); this.state = 'FAILED_CAPTURE'; }
}

class CaptureCancelled extends Error {}

class DependencyFailure extends Error {
  constructor(dependency) {
    super(formatDependency(dependency));
    this.dependency = dependency;
  }
}

export async function measureCaptureOperability({
  trialId, corpusClass, fileKey, signal, readPersistentStateHash, runAttempt, onProgress = () => {},
}) {
  validateInput({ trialId, corpusClass, fileKey, signal, readPersistentStateHash, runAttempt, onProgress });
  const persistentBeforeHash = await readStateHash(readPersistentStateHash, 'before');
  const attempts = [];
  const issues = [];
  let operatorAction = null;
  let state = 'FAILED_CAPTURE';
  let unstableAttempts = 0;
  const cpuStart = process.cpuUsage();
  const wallStart = performance.now();
  let peakRssBytes = process.memoryUsage.rss();
  const sampler = setInterval(() => { peakRssBytes = Math.max(peakRssBytes, process.memoryUsage.rss()); }, 1);

  try {
    for (let attemptNumber = 1; attemptNumber <= 2; attemptNumber++) {
      const record = { attempt: attemptNumber, phases: [], requests: [], observedFileKey: null, stability: null, identities: null, changedDependencies: [] };
      attempts.push(record);
      const meter = createMeter({ attemptNumber, record, signal, onProgress });
      try {
        checkCancelled(signal);
        const result = await runAttempt({ attempt: attemptNumber, meter, signal });
        meter.assertComplete();
        const normalized = validateAttemptResult(result);
        record.observedFileKey = normalized.observedFileKey;
        record.identities = normalized.identities;
        record.changedDependencies = normalized.changedDependencies;
        if (normalized.observedFileKey !== fileKey) {
          record.stability = 'ACTIVE_FILE_CHANGED';
          issues.push(`active Figma file changed from ${fileKey} to ${normalized.observedFileKey}; candidate discarded`);
          operatorAction = `switch back to ${fileKey} or select the intended file, then start a fresh capture`;
          break;
        }
        if (normalized.stable) {
          record.stability = 'STABLE';
          state = 'DIAGNOSTIC_ONLY';
          break;
        }
        record.stability = 'UNSTABLE';
        unstableAttempts++;
        if (attemptNumber === 1) continue;
        if (!normalized.changedDependencies.length) {
          issues.push('capture remained unstable after one retry but lacked the required changed-file/dependency report');
          operatorAction = 'inspect the active file and dependency versions, wait for them to settle, then start a fresh capture';
        } else {
          issues.push(...normalized.changedDependencies.map(formatDependency));
          operatorAction = normalized.changedDependencies[0].nextAction;
        }
      } catch (error) {
        if (error instanceof CaptureCancelled || signal.aborted) {
          state = 'CANCELLED';
          issues.push(`capture cancelled during ${record.phases.at(-1)?.id ?? 'startup'}; candidate discarded`);
          operatorAction = 'start a fresh capture when ready';
        } else if (error instanceof DependencyFailure) {
          issues.push(error.message);
          operatorAction = error.dependency.nextAction;
        } else {
          issues.push(`capture attempt ${attemptNumber} failed: ${error.message}`);
          operatorAction = 'resolve the named failure, then start a fresh capture';
        }
        break;
      }
    }
  } finally {
    clearInterval(sampler);
    peakRssBytes = Math.max(peakRssBytes, process.memoryUsage.rss());
  }

  let persistentAfterHash = null;
  try { persistentAfterHash = await readStateHash(readPersistentStateHash, 'after'); }
  catch (error) { issues.push(error.message); operatorAction ??= 'restore access to persistent state and rerun capture'; }
  const persistentUnchanged = persistentAfterHash === persistentBeforeHash;
  if (!persistentUnchanged) {
    state = 'FAILED_CAPTURE';
    issues.push('persistent registry/package state changed during observational capture');
    operatorAction = 'restore the last promoted state before retrying capture';
  }

  const cpu = process.cpuUsage(cpuStart);
  const requestCount = attempts.reduce((sum, attempt) => sum + attempt.requests.length, 0);
  const transferredBytes = attempts.reduce((sum, attempt) => sum + attempt.requests.reduce((bytes, request) => bytes + request.bytes, 0), 0);
  const metrics = {
    wallMs: performance.now() - wallStart,
    cpuUserMicros: cpu.user,
    cpuSystemMicros: cpu.system,
    peakRssBytes,
    requestCount,
    transferredBytes,
    retries: Math.max(0, attempts.length - 1),
    unstableAttempts,
    retryRate: attempts.length > 0 ? Math.max(0, attempts.length - 1) / attempts.length : 0,
    instabilityRate: attempts.length > 0 ? unstableAttempts / attempts.length : 0,
  };
  const body = {
    schemaVersion: 1,
    proofClass: 'p0-operability-diagnostic',
    state,
    trialId,
    corpusClass,
    fileKey,
    attempts,
    metrics,
    persistentState: { beforeHash: persistentBeforeHash, afterHash: persistentAfterHash, unchanged: persistentUnchanged },
    acceptedEnvelope: false,
    blockers: [...BLOCKERS],
    issues: [...new Set(issues)],
    operatorAction,
  };
  const report = { ...body, reportHash: sha256(canonicalJson(body)) };
  assertCaptureOperabilityReport(report);
  return report;
}

export function assertCaptureOperabilityReport(report) {
  if (!plainObject(report)) throw new CaptureOperabilityError('operability report malformed');
  const { reportHash, ...body } = report;
  if (!HASH.test(reportHash ?? '') || reportHash !== sha256(canonicalJson(body))) throw new CaptureOperabilityError('operability report hash mismatch');
  if (report.schemaVersion !== 1 || report.proofClass !== 'p0-operability-diagnostic' || !['DIAGNOSTIC_ONLY', 'FAILED_CAPTURE', 'CANCELLED'].includes(report.state)) throw new CaptureOperabilityError('operability report state/schema malformed');
  if (report.acceptedEnvelope !== false || canonicalJson(report.blockers) !== canonicalJson(BLOCKERS)) throw new CaptureOperabilityError('diagnostic report cannot claim an accepted envelope');
  if (!nonempty(report.trialId) || !CORPUS_CLASSES.includes(report.corpusClass) || !nonempty(report.fileKey) || !Array.isArray(report.attempts) || report.attempts.length < 1 || report.attempts.length > 2) throw new CaptureOperabilityError('operability report identity/attempts malformed');
  if (!Array.isArray(report.issues) || report.issues.some((issue) => !nonempty(issue)) || (report.operatorAction !== null && !nonempty(report.operatorAction))) throw new CaptureOperabilityError('operability issues/action malformed');
  let requests = 0, bytes = 0, unstable = 0;
  for (const [index, attempt] of report.attempts.entries()) {
    if (attempt?.attempt !== index + 1 || !Array.isArray(attempt.phases) || !Array.isArray(attempt.requests) || !Array.isArray(attempt.changedDependencies)) throw new CaptureOperabilityError('operability attempt malformed');
    if (attempt.phases.length > CAPTURE_PHASES.length || attempt.phases.some((phase, phaseIndex) => phase?.id !== CAPTURE_PHASES[phaseIndex] || !validCount(phase.completed) || !validCount(phase.total) || phase.total < 1 || phase.completed > phase.total || !finite(phase.wallMs) || !validCount(phase.requestCount) || !validCount(phase.transferredBytes))) throw new CaptureOperabilityError('operability phase census malformed');
    let storedStable = null;
    if (attempt.identities !== null) storedStable = validateStoredIdentities(attempt.identities);
    if (attempt.stability === null) {
      if (attempt.identities !== null || attempt.observedFileKey !== null || attempt.changedDependencies.length) throw new CaptureOperabilityError('unfinished attempt carries completed identity evidence');
    } else if (storedStable === null || !['STABLE', 'UNSTABLE', 'ACTIVE_FILE_CHANGED'].includes(attempt.stability) || !nonempty(attempt.observedFileKey)) throw new CaptureOperabilityError('operability attempt stability malformed');
    else if (attempt.stability === 'STABLE' && (!storedStable || attempt.observedFileKey !== report.fileKey || attempt.changedDependencies.length)) throw new CaptureOperabilityError('stable attempt contradicts captured identity evidence');
    else if (attempt.stability === 'UNSTABLE' && (storedStable !== false || attempt.observedFileKey !== report.fileKey)) throw new CaptureOperabilityError('unstable attempt contradicts captured identity evidence');
    else if (attempt.stability === 'ACTIVE_FILE_CHANGED' && attempt.observedFileKey === report.fileKey) throw new CaptureOperabilityError('active-file change lacks a changed file identity');
    for (const dependency of attempt.changedDependencies) validateDependency(dependency);
    for (const request of attempt.requests) {
      validateRequest(request);
      requests++;
      bytes += request.bytes;
    }
    let requestOffset = 0;
    for (const phase of attempt.phases) {
      const phaseRequests = attempt.requests.slice(requestOffset, requestOffset + phase.requestCount);
      if (phaseRequests.length !== phase.requestCount || phaseRequests.reduce((sum, request) => sum + request.bytes, 0) !== phase.transferredBytes) throw new CaptureOperabilityError('operability phase request census mismatch');
      requestOffset += phase.requestCount;
    }
    if (requestOffset !== attempt.requests.length) throw new CaptureOperabilityError('operability request lacks a phase owner');
    if (attempt.stability === 'UNSTABLE') unstable++;
  }
  const metrics = report.metrics;
  for (const key of ['wallMs', 'cpuUserMicros', 'cpuSystemMicros', 'peakRssBytes', 'requestCount', 'transferredBytes', 'retries', 'unstableAttempts', 'retryRate', 'instabilityRate']) if (!finite(metrics?.[key])) throw new CaptureOperabilityError(`operability metric ${key} malformed`);
  const retries = report.attempts.length - 1;
  if (metrics.requestCount !== requests || metrics.transferredBytes !== bytes || metrics.retries !== retries || metrics.unstableAttempts !== unstable
    || metrics.retryRate !== retries / report.attempts.length || metrics.instabilityRate !== unstable / report.attempts.length) throw new CaptureOperabilityError('operability request census/rate mismatch');
  if (!plainObject(report.persistentState) || !HASH.test(report.persistentState.beforeHash ?? '') || (report.persistentState.afterHash !== null && !HASH.test(report.persistentState.afterHash))
    || report.persistentState.unchanged !== (report.persistentState.beforeHash === report.persistentState.afterHash)) throw new CaptureOperabilityError('operability persistent-state proof malformed');
  if (report.state === 'DIAGNOSTIC_ONLY') {
    const last = report.attempts.at(-1);
    if (last.stability !== 'STABLE' || last.phases.length !== CAPTURE_PHASES.length || last.phases.some((phase) => phase.completed !== phase.total) || !report.persistentState.unchanged || report.issues.length || report.operatorAction !== null) throw new CaptureOperabilityError('diagnostic success lacks a complete stable read-only transaction');
  }
  const lastAttempt = report.attempts.at(-1);
  if (report.state === 'CANCELLED' && (lastAttempt.stability !== null || !report.persistentState.unchanged || !report.issues.some((issue) => issue.startsWith('capture cancelled during ')))) throw new CaptureOperabilityError('cancelled state contradicts attempt evidence');
  if (report.state === 'FAILED_CAPTURE' && ((lastAttempt.stability === 'STABLE' && report.persistentState.unchanged) || (lastAttempt.stability === 'UNSTABLE' && report.attempts.length !== 2))) throw new CaptureOperabilityError('failed state contradicts attempt evidence');
  if (report.state !== 'DIAGNOSTIC_ONLY' && (!report.issues.length || !nonempty(report.operatorAction))) throw new CaptureOperabilityError('failed/cancelled report lacks an actionable operator result');
  return true;
}

function validateStoredIdentities(identities) {
  if (!plainObject(identities)) throw new CaptureOperabilityError('capture identity record malformed');
  validateTriplet(identities.versions, ['V0', 'V1', 'V2'], nonempty, 'version');
  validateTriplet(identities.fingerprints, ['F0', 'F1', 'F2'], (value) => HASH.test(value), 'fingerprint');
  validateTriplet(identities.dependencyLocks, ['D0', 'D1', 'D2'], (value) => HASH.test(value), 'dependency lock');
  return allSame(Object.values(identities.versions)) && allSame(Object.values(identities.fingerprints)) && allSame(Object.values(identities.dependencyLocks));
}

function createMeter({ attemptNumber, record, signal, onProgress }) {
  let phaseIndex = 0;
  let phaseActive = false;
  return Object.freeze({
    async phase(id, total, work) {
      checkCancelled(signal);
      if (phaseActive) throw new CaptureOperabilityError('capture phases must run sequentially');
      const expected = CAPTURE_PHASES[phaseIndex];
      if (id !== expected) throw new CaptureOperabilityError(`expected phase ${expected}, received ${id ?? '?'}`);
      if (!Number.isInteger(total) || total < 1 || typeof work !== 'function') throw new CaptureOperabilityError(`phase ${id} requires a positive total and worker`);
      const phase = { id, completed: 0, total, wallMs: 0, requestCount: 0, transferredBytes: 0 };
      record.phases.push(phase);
      const requestStart = record.requests.length;
      const started = performance.now();
      const progress = () => onProgress(Object.freeze({ attempt: attemptNumber, phase: id, completed: phase.completed, total }));
      phaseActive = true;
      try {
        progress();
        const context = Object.freeze({
          signal,
          advance(amount = 1) {
            checkCancelled(signal);
            if (!Number.isInteger(amount) || amount < 1 || phase.completed + amount > total) throw new CaptureOperabilityError(`phase ${id} progress exceeds ${total}`);
            phase.completed += amount;
            progress();
          },
          recordRequest(request) {
            checkCancelled(signal);
            validateRequest(request);
            record.requests.push(structuredClone(request));
          },
          failDependency(dependency) {
            validateDependency(dependency);
            throw new DependencyFailure(structuredClone(dependency));
          },
        });
        await raceAbort(() => work(context), signal);
        checkCancelled(signal);
        if (phase.completed !== total) throw new CaptureOperabilityError(`phase ${id} incomplete: ${phase.completed}/${total}`);
        phaseIndex++;
      } finally {
        phaseActive = false;
        phase.wallMs = performance.now() - started;
        const phaseRequests = record.requests.slice(requestStart);
        phase.requestCount = phaseRequests.length;
        phase.transferredBytes = phaseRequests.reduce((sum, request) => sum + request.bytes, 0);
      }
    },
    assertComplete() {
      checkCancelled(signal);
      if (phaseIndex !== CAPTURE_PHASES.length) throw new CaptureOperabilityError(`capture attempt completed only ${phaseIndex}/${CAPTURE_PHASES.length} phases`);
    },
  });
}

function validateAttemptResult(result) {
  if (!plainObject(result) || !nonempty(result.observedFileKey)) throw new CaptureOperabilityError('capture attempt identity result malformed');
  validateTriplet(result.versions, ['V0', 'V1', 'V2'], nonempty, 'version');
  validateTriplet(result.fingerprints, ['F0', 'F1', 'F2'], (value) => HASH.test(value), 'fingerprint');
  validateTriplet(result.dependencyLocks, ['D0', 'D1', 'D2'], (value) => HASH.test(value), 'dependency lock');
  if (!Array.isArray(result.changedDependencies)) throw new CaptureOperabilityError('changed dependency report missing');
  for (const dependency of result.changedDependencies) validateDependency(dependency);
  const identities = {
    versions: structuredClone(result.versions),
    fingerprints: structuredClone(result.fingerprints),
    dependencyLocks: structuredClone(result.dependencyLocks),
  };
  const stable = allSame(Object.values(result.versions)) && allSame(Object.values(result.fingerprints)) && allSame(Object.values(result.dependencyLocks));
  if (stable && result.changedDependencies.length) throw new CaptureOperabilityError('stable capture cannot report changed dependencies');
  return {
    observedFileKey: result.observedFileKey,
    identities,
    changedDependencies: structuredClone(result.changedDependencies),
    stable,
  };
}

function validateTriplet(value, keys, predicate, label) {
  if (!plainObject(value) || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort()) || keys.some((key) => !predicate(value[key]))) throw new CaptureOperabilityError(`${label} triplet malformed`);
}

function validateRequest(request) {
  if (!plainObject(request) || !nonempty(request.provider) || !nonempty(request.fileKey) || !nonempty(request.key) || !Number.isInteger(request.bytes) || request.bytes < 0) throw new CaptureOperabilityError('capture request record malformed');
}

function validateDependency(dependency) {
  for (const key of ['provider', 'fileKey', 'key', 'fact', 'requiredPermission', 'nextAction']) if (!nonempty(dependency?.[key])) throw new CaptureOperabilityError(`dependency report missing ${key}`);
}

function formatDependency(row) {
  return `${row.provider} dependency ${row.fileKey}/${row.key} changed or unavailable (${row.fact}); requires ${row.requiredPermission}; next: ${row.nextAction}`;
}

function validateInput({ trialId, corpusClass, fileKey, signal, readPersistentStateHash, runAttempt, onProgress }) {
  if (!nonempty(trialId) || !CORPUS_CLASSES.includes(corpusClass) || !nonempty(fileKey) || typeof signal?.aborted !== 'boolean' || typeof readPersistentStateHash !== 'function' || typeof runAttempt !== 'function' || typeof onProgress !== 'function') throw new CaptureOperabilityError('capture operability input malformed');
}

async function readStateHash(read, point) {
  let value;
  try { value = await read(); }
  catch (error) { throw new CaptureOperabilityError(`persistent state ${point} read failed: ${error.message}`); }
  if (!HASH.test(value ?? '')) throw new CaptureOperabilityError(`persistent state ${point} hash malformed`);
  return value;
}

function checkCancelled(signal) {
  if (signal.aborted) throw new CaptureCancelled(String(signal.reason ?? 'cancelled'));
}

async function raceAbort(work, signal) {
  checkCancelled(signal);
  let onAbort;
  const aborted = new Promise((resolve, reject) => {
    onAbort = () => reject(new CaptureCancelled(String(signal.reason ?? 'cancelled')));
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try { return await Promise.race([Promise.resolve().then(work), aborted]); }
  finally { signal.removeEventListener('abort', onAbort); }
}

const allSame = (values) => values.length > 0 && values.every((value) => value === values[0]);
const nonempty = (value) => typeof value === 'string' && value.length > 0;
const plainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const validCount = (value) => Number.isInteger(value) && value >= 0;
const finite = (value) => Number.isFinite(value) && value >= 0;
