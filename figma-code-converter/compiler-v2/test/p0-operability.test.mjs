import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAPTURE_PHASES,
  assertCaptureOperabilityReport,
  measureCaptureOperability,
} from '../src/capture-operability.mjs';
import { canonicalJson, sha256 } from '../src/evidence.mjs';
import { p0OperabilityFailures } from './p0-operability-oracle.mjs';

const HASH = (value) => sha256(String(value));

function stableResult(overrides = {}) {
  return {
    observedFileKey: 'FILE',
    versions: { V0: 'v1', V1: 'v1', V2: 'v1' },
    fingerprints: { F0: HASH('f'), F1: HASH('f'), F2: HASH('f') },
    dependencyLocks: { D0: HASH('d'), D1: HASH('d'), D2: HASH('d') },
    changedDependencies: [],
    ...overrides,
  };
}

async function completeAttempt({ meter, signal, requestBytes = 4 }) {
  for (const phase of CAPTURE_PHASES) {
    await meter.phase(phase, 2, async ({ advance, recordRequest }) => {
      advance();
      if (phase === 'pass-a') recordRequest({ provider: 'figma-rest', fileKey: 'FILE', key: 'nodes', bytes: requestBytes });
      advance();
      assert.equal(signal.aborted, false);
    });
  }
  return stableResult();
}

function baseInput(overrides = {}) {
  const controller = new AbortController();
  let persistentHash = HASH('persistent');
  return {
    controller,
    setPersistentHash: (value) => { persistentHash = value; },
    input: {
      trialId: 'shape-local-1',
      corpusClass: 'local-only',
      fileKey: 'FILE',
      signal: controller.signal,
      readPersistentStateHash: async () => persistentHash,
      runAttempt: completeAttempt,
      ...overrides,
    },
  };
}

test('P0 operability derives exact phases, progress counts, resources, requests, and diagnostic-only truth', async () => {
  const events = [];
  const { input } = baseInput({ onProgress: (event) => events.push(event) });
  const report = await measureCaptureOperability(input);
  assert.equal(report.state, 'DIAGNOSTIC_ONLY');
  assert.equal(report.acceptedEnvelope, false);
  assert.equal(report.attempts.length, 1);
  assert.deepEqual(report.attempts[0].phases.map((row) => row.id), CAPTURE_PHASES);
  assert.ok(report.attempts[0].phases.every((row) => row.completed === 2 && row.total === 2 && row.wallMs >= 0));
  assert.equal(report.metrics.requestCount, 1);
  assert.equal(report.metrics.transferredBytes, 4);
  assert.equal(report.metrics.retries, 0);
  assert.equal(report.metrics.instabilityRate, 0);
  assert.ok(report.metrics.wallMs >= 0 && report.metrics.cpuUserMicros >= 0 && report.metrics.cpuSystemMicros >= 0 && report.metrics.peakRssBytes > 0);
  assert.deepEqual(events.filter((row) => row.completed === 0).map((row) => row.phase), CAPTURE_PHASES);
  assert.equal(assertCaptureOperabilityReport(report), true);
  assert.deepEqual(p0OperabilityFailures(report), []);
  const body = structuredClone(report); delete body.reportHash;
  assert.equal(report.reportHash, sha256(canonicalJson(body)));
});

test('P0 operability retries one unstable transaction and then succeeds', async () => {
  const { input } = baseInput({
    runAttempt: async (context) => {
      const result = await completeAttempt(context);
      if (context.attempt === 1) return stableResult({
        versions: { V0: 'v1', V1: 'v2', V2: 'v2' },
        changedDependencies: [{ provider: 'figma', fileKey: 'FILE', key: 'root', fact: 'version', requiredPermission: 'view', nextAction: 'wait for the file to settle and retry' }],
      });
      return result;
    },
  });
  const report = await measureCaptureOperability(input);
  assert.equal(report.state, 'DIAGNOSTIC_ONLY');
  assert.equal(report.attempts.length, 2);
  assert.equal(report.metrics.retries, 1);
  assert.equal(report.metrics.unstableAttempts, 1);
  assert.equal(report.metrics.retryRate, 0.5);
  assert.equal(report.metrics.instabilityRate, 0.5);
});

test('P0 operability fails after the one bounded retry with an actionable dependency report', async () => {
  const { input } = baseInput({
    runAttempt: async (context) => {
      await completeAttempt(context);
      return stableResult({
        fingerprints: { F0: HASH('a'), F1: HASH('b'), F2: HASH('b') },
        changedDependencies: [{ provider: 'library', fileKey: 'REMOTE', key: 'COMP', fact: 'component definition', requiredPermission: 'library access', nextAction: 'open REMOTE and grant library access' }],
      });
    },
  });
  const report = await measureCaptureOperability(input);
  assert.equal(report.state, 'FAILED_CAPTURE');
  assert.equal(report.attempts.length, 2);
  assert.match(report.issues.join('\n'), /library.*REMOTE.*COMP.*grant library access/);
  assert.equal(report.operatorAction, 'open REMOTE and grant library access');
});

test('P0 operability cancels at every phase and preserves persistent state', async () => {
  for (const cancelledPhase of CAPTURE_PHASES) {
    const { input, controller } = baseInput({
      runAttempt: async ({ meter }) => {
        for (const phase of CAPTURE_PHASES) {
          await meter.phase(phase, 1, ({ advance }) => {
            if (phase === cancelledPhase) controller.abort(`cancel ${phase}`);
            advance();
          });
        }
        return stableResult();
      },
    });
    const report = await measureCaptureOperability(input);
    assert.equal(report.state, 'CANCELLED', cancelledPhase);
    assert.match(report.operatorAction, /start a fresh capture/);
    assert.equal(assertCaptureOperabilityReport(report), true);
  }
});

test('P0 operability aborts an in-flight phase without waiting for an uncooperative worker', async () => {
  const { input, controller } = baseInput({
    runAttempt: async ({ meter }) => {
      await meter.phase('version-v0', 1, async () => {
        setTimeout(() => controller.abort('operator cancel'), 5);
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
      return stableResult();
    },
  });
  const started = performance.now();
  const report = await measureCaptureOperability(input);
  assert.equal(report.state, 'CANCELLED');
  assert.ok(performance.now() - started < 80, 'operator cancellation waited for the phase worker');
});

test('P0 operability refuses active-file drift, persistent mutation, and malformed phase progress', async () => {
  const active = baseInput({ runAttempt: async (context) => { await completeAttempt(context); return stableResult({ observedFileKey: 'OTHER' }); } });
  const activeReport = await measureCaptureOperability(active.input);
  assert.equal(activeReport.state, 'FAILED_CAPTURE');
  assert.match(activeReport.issues.join('\n'), /active Figma file changed.*OTHER/);

  const persistent = baseInput({ runAttempt: async (context) => { const result = await completeAttempt(context); persistent.setPersistentHash(HASH('mutated')); return result; } });
  const persistentReport = await measureCaptureOperability(persistent.input);
  assert.equal(persistentReport.state, 'FAILED_CAPTURE');
  assert.match(persistentReport.issues.join('\n'), /persistent registry\/package state changed/);

  const malformed = baseInput({
    runAttempt: async ({ meter }) => {
      await meter.phase('pass-a', 1, ({ advance }) => advance());
      return stableResult();
    },
  });
  const malformedReport = await measureCaptureOperability(malformed.input);
  assert.equal(malformedReport.state, 'FAILED_CAPTURE');
  assert.match(malformedReport.issues.join('\n'), /expected phase version-v0/);
});

test('P0 operability dependency failure names provider, identity, permission, and next action', async () => {
  const { input } = baseInput({
    runAttempt: async ({ meter }) => {
      await meter.phase('version-v0', 1, ({ failDependency }) => failDependency({
        provider: 'figma-rest', fileKey: 'REMOTE', key: 'variables', fact: 'remote variables',
        requiredPermission: 'file_variables:read', nextAction: 'request file_variables:read and retry',
      }));
    },
  });
  const report = await measureCaptureOperability(input);
  assert.equal(report.state, 'FAILED_CAPTURE');
  assert.match(report.issues.join('\n'), /figma-rest.*REMOTE.*variables.*file_variables:read/);
  assert.equal(report.operatorAction, 'request file_variables:read and retry');
});

test('P0 operability production and independent readers reject re-sealed derivation lies', async () => {
  const { input } = baseInput();
  const report = await measureCaptureOperability(input);
  const forged = structuredClone(report);
  forged.acceptedEnvelope = true;
  assert.throws(() => assertCaptureOperabilityReport(forged), /report hash mismatch|accepted envelope/);
  const copied = structuredClone(report);
  copied.metrics.requestCount = 0;
  delete copied.reportHash;
  copied.reportHash = sha256(canonicalJson(copied));
  assert.throws(() => assertCaptureOperabilityReport(copied), /request census/);
  assert.deepEqual(p0OperabilityFailures(copied), ['derived metrics']);

  const phaseLie = structuredClone(report);
  phaseLie.attempts[0].phases[1].transferredBytes = 0;
  delete phaseLie.reportHash;
  phaseLie.reportHash = sha256(canonicalJson(phaseLie));
  assert.throws(() => assertCaptureOperabilityReport(phaseLie), /phase request census/);
  assert.deepEqual(p0OperabilityFailures(phaseLie), ['phase request census']);

  const stabilityLie = structuredClone(report);
  stabilityLie.attempts[0].identities.fingerprints.F1 = HASH('different');
  delete stabilityLie.reportHash;
  stabilityLie.reportHash = sha256(canonicalJson(stabilityLie));
  assert.throws(() => assertCaptureOperabilityReport(stabilityLie), /stable attempt contradicts/);
  assert.deepEqual(p0OperabilityFailures(stabilityLie), ['stability derivation']);

  const identityLie = structuredClone(report);
  identityLie.attempts[0].identities = null;
  delete identityLie.reportHash;
  identityLie.reportHash = sha256(canonicalJson(identityLie));
  assert.throws(() => assertCaptureOperabilityReport(identityLie), /stability malformed/);
  assert.deepEqual(p0OperabilityFailures(identityLie), ['unfinished identity']);

  const stateLie = structuredClone(report);
  stateLie.state = 'FAILED_CAPTURE';
  stateLie.issues = ['invented failure'];
  stateLie.operatorAction = 'retry';
  delete stateLie.reportHash;
  stateLie.reportHash = sha256(canonicalJson(stateLie));
  assert.throws(() => assertCaptureOperabilityReport(stateLie), /failed state contradicts/);
  assert.deepEqual(p0OperabilityFailures(stateLie), ['failed derivation']);
});
