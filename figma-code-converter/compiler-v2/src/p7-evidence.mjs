/** P7 §14.3/§15 diagnostic evidence core. It cannot issue integration or promotion authority. */
import { randomUUID } from 'node:crypto';
import { canonicalJson, sha256 } from './evidence.mjs';

const mutation = (id, gate, targetSeam, contractText) => Object.freeze({ id, gate, targetSeam, contractText });

export const MUTATION_CATALOG = Object.freeze([
  mutation('swap-variable-id', 'G2', 'binding-identity', 'swap same-valued variable ids'),
  mutation('bake-bound-value', 'G2', 'binding-emission', 'bake one bound value'),
  mutation('use-root-mode', 'G3', 'mode-resolution', 'use root mode for a descendant override'),
  mutation('reorder-render-stack', 'G6', 'render-order', 'reorder paints/effects/masks'),
  mutation('flatten-instance', 'G4', 'component-identity', 'flatten an instance'),
  mutation('change-variant-default-or-swap', 'G4', 'component-variants', 'change one variant default or instance swap'),
  mutation('merge-unequal-text-runs', 'G5', 'text-ranges', 'merge two unequal text runs'),
  mutation('drop-grid-span-or-reverse-z', 'G6', 'layout', 'drop one grid span or reverse-z flag'),
  mutation('reduce-affine-to-angle', 'G6', 'transform', 'reduce an affine matrix to angle'),
  mutation('inject-unsafe-content', 'G8', 'static-security', 'inject unsafe SVG/CSS/URL content'),
  mutation('reuse-stale-asset-or-verdict', 'G0', 'capture-freshness', 'reuse a stale asset or verdict'),
  mutation('skip-runtime-state', 'G10', 'runtime-state-census', 'skip one required runtime state'),
  mutation('token-value-churns-component', 'G9', 'change-locality', 'change only a token value and churn component TSX'),
  mutation('collapse-destination-channels', 'G2', 'token-channels', 'collapse two incompatible destination channels into one CSS custom property'),
  mutation('emit-react-binding-as-css-text', 'G2', 'binding-target', 'emit token-bound characters, visibility, or component props as inert CSS text'),
  mutation('drop-mode-context-marker', 'G3', 'mode-context', 'drop a descendant mode-context marker or its React context id'),
  mutation('advertise-uncaptured-variant', 'G4', 'component-variants', 'advertise one uncaptured component variant'),
  mutation('materialize-remote-or-mutate-source', 'G0', 'capture-read-only', 'import/materialize a remote component or change a source mode during capture'),
  mutation('bypass-read-adapter', 'G0', 'capture-read-only', 'bypass the read adapter through direct/dynamic Plugin-global access'),
  mutation('change-stable-library-dependency', 'G0', 'dependency-lock', 'change a library dependency between fingerprint reads while keeping its stable key'),
  mutation('omit-external-render-dependency', 'G0', 'render-boundary', 'omit an external backdrop/overlap dependency from the source boundary'),
  mutation('substitute-font-bytes', 'G0', 'font-lock', 'substitute a same-family font with different bytes'),
  mutation('promote-null-or-stale-reference', 'G11', 'visual-reference', 'promote a state whose authored reference is null or belongs to another version'),
  mutation('continue-on-unknown-visual-field', 'G1', 'canonical-schema', 'add an unknown visual field and continue conversion'),
  mutation('drop-or-duplicate-source-address', 'G13', 'source-map', 'drop or duplicate one semantic/component source address'),
  mutation('forge-fragment-semantic-owner', 'G13', 'editor-selection', 'expose a decorative fragment as a fake semantic selection or lose its owning-node address'),
  mutation('lose-fragment-inspection-address', 'G13', 'render-inspection', 'make an auxiliary fragment unselectable by fragmentId in render-inspection mode'),
  mutation('resolve-edit-to-wrong-segment', 'G13', 'save-to-code', 'resolve a token edit to the wrong declaration/expression segment'),
  mutation('rewrite-outside-owning-declaration', 'G13', 'save-to-code', 'edit one padding/radius slot and rewrite unrelated slots or more than the owning declaration'),
  mutation('save-churns-identity-mode-map-order', 'G13', 'editor-round-trip', 'Save-to-code and churn component identity, scoped mode markers, source-map ids, or render order'),
  mutation('failed-stage-mutates-registry', 'G9', 'registry-transaction', 'fail or cancel after staging a new token channel and mutate the persistent registry'),
  mutation('registry-generation-race-last-write-wins', 'G9', 'registry-transaction', 'race two compiles from one registry generation and accept last-write-wins'),
  mutation('restart-retains-partial-generation', 'G9', 'registry-transaction', 'restart during registry/package commit and retain a partial generation'),
  mutation('cancel-capture-leaves-staged-state', 'G0', 'capture-transaction', 'cancel capture and leave staged artifacts or an indeterminate operator state'),
]);

const MUTATION_BY_ID = new Map(MUTATION_CATALOG.map((row) => [row.id, row]));
const MUTATION_AUTHORITIES = new WeakMap();
const SCALE_AUTHORITIES = new WeakMap();
const OPERATION_KINDS = Object.freeze(['document', 'alias', 'lookup', 'render']);
const BLOCKERS = Object.freeze([
  'accepted-budgets', 'capture-authority', 'integration-corpus', 'integration-mutation-proof',
  'runtime-proof', 'scale-hardware-authority',
]);

export class P7EvidenceError extends Error {
  constructor(message) { super(message); this.state = 'FAILED_STATIC'; }
}

/**
 * Exercise one mutation through a caller-supplied microfixture evaluator. The opaque authority
 * proves only what this process observed; proofClass deliberately prevents integration use.
 */
export async function runDiagnosticMutation({ mutationId, fixtureId, before, mutate, evaluate }) {
  const spec = MUTATION_BY_ID.get(mutationId);
  if (!spec) throw new P7EvidenceError(`unknown mutation ${mutationId ?? '?'}`);
  if (!nonempty(fixtureId) || !plainObject(before) || typeof mutate !== 'function' || typeof evaluate !== 'function') throw new P7EvidenceError(`mutation ${mutationId} diagnostic input malformed`);
  const beforeClone = cloneCanonical(before, `mutation ${mutationId} before`);
  const after = cloneCanonical(before, `mutation ${mutationId} before`);
  await mutate(after);
  assertJsonSafe(after, `mutation ${mutationId} after`);
  const beforeHash = sha256(canonicalJson(beforeClone));
  const afterHash = sha256(canonicalJson(after));
  if (beforeHash === afterHash) throw new P7EvidenceError(`mutation ${mutationId} did not change sealed input bytes`);
  const observed = await evaluate(structuredClone(after));
  if (!plainObject(observed) || observed.gate !== spec.gate) throw new P7EvidenceError(`mutation ${mutationId} did not refuse at assigned gate ${spec.gate}`);
  if (observed.state !== 'FAILED' || !stringArray(observed.issues) || observed.issues.length === 0) throw new P7EvidenceError(`mutation ${mutationId} lacks an observed assigned refusal`);
  const body = {
    schemaVersion: 1,
    proofClass: 'microfixture-diagnostic',
    mutationId,
    fixtureId,
    gate: spec.gate,
    targetSeam: spec.targetSeam,
    beforeHash,
    afterHash,
    observedAssignedRefusal: true,
    issues: [...observed.issues],
  };
  const authority = Object.freeze({ schemaVersion: 1, authorityId: randomUUID() });
  MUTATION_AUTHORITIES.set(authority, sha256(canonicalJson(body)));
  return { ...body, authority };
}

export function assertDiagnosticMutationRun(run, authority) {
  const expected = MUTATION_AUTHORITIES.get(authority);
  const body = withoutAuthority(run);
  if (!expected || run?.authority !== authority || authority?.schemaVersion !== 1 || run?.proofClass !== 'microfixture-diagnostic' || expected !== sha256(canonicalJson(body))) throw new P7EvidenceError('diagnostic mutation authority mismatch');
  const spec = MUTATION_BY_ID.get(run.mutationId);
  if (!spec || run.gate !== spec.gate || run.targetSeam !== spec.targetSeam || run.observedAssignedRefusal !== true || run.beforeHash === run.afterHash) throw new P7EvidenceError('diagnostic mutation record drift');
  return true;
}

/** Measure one synthetic workload. Metrics and artifact bytes are derived inside this harness. */
export async function measureDiagnosticScale({ trialId, size, workload }) {
  validateSize(size);
  if (!nonempty(trialId) || typeof workload !== 'function') throw new P7EvidenceError('scale trial id/workload malformed');
  const operations = Object.fromEntries(OPERATION_KINDS.map((kind) => [kind, 0]));
  let networkRequests = 0;
  let networkBytes = 0;
  let innerLoopNetworkRequests = 0;
  const innerLoops = [];
  const meter = Object.freeze({
    count(kind, amount = 1) {
      if (!OPERATION_KINDS.includes(kind) || !Number.isInteger(amount) || amount < 0) throw new P7EvidenceError(`invalid operation count ${kind}:${amount}`);
      operations[kind] += amount;
    },
    enterInnerLoop(kind) {
      if (!['node', 'binding', 'text-run', 'render-fragment'].includes(kind)) throw new P7EvidenceError(`unknown inner loop ${kind}`);
      innerLoops.push(kind);
    },
    leaveInnerLoop(kind) {
      if (innerLoops.pop() !== kind) throw new P7EvidenceError(`unbalanced inner loop ${kind}`);
    },
    recordNetwork({ bytes }) {
      if (!Number.isInteger(bytes) || bytes < 0) throw new P7EvidenceError('network byte count must be a non-negative integer');
      networkRequests++;
      networkBytes += bytes;
      if (innerLoops.length) innerLoopNetworkRequests++;
    },
  });
  const cpuStart = process.cpuUsage();
  const wallStart = performance.now();
  let peakRss = process.memoryUsage.rss();
  const sampler = setInterval(() => { peakRss = Math.max(peakRss, process.memoryUsage.rss()); }, 1);
  let output;
  try { output = await workload(meter); }
  finally { clearInterval(sampler); }
  const wallMs = performance.now() - wallStart;
  const cpu = process.cpuUsage(cpuStart);
  peakRss = Math.max(peakRss, process.memoryUsage.rss());
  if (innerLoops.length) throw new P7EvidenceError(`unclosed inner loop ${innerLoops.at(-1)}`);
  const artifactInventory = inventoryOf(output?.artifacts);
  validateOutputCounts(output?.outputCounts);
  const metrics = {
    wallMs,
    cpuUserMicros: cpu.user,
    cpuSystemMicros: cpu.system,
    peakRssBytes: peakRss,
    outputBytes: Object.values(artifactInventory).reduce((sum, row) => sum + row.bytes, 0),
    networkRequests,
    networkBytes,
    innerLoopNetworkRequests,
    operations,
    outputCounts: structuredClone(output.outputCounts),
  };
  const body = {
    schemaVersion: 1,
    proofClass: 'synthetic-diagnostic',
    trialId,
    size: structuredClone(size),
    artifactInventory,
    metrics,
  };
  const authority = Object.freeze({ schemaVersion: 1, authorityId: randomUUID() });
  SCALE_AUTHORITIES.set(authority, sha256(canonicalJson(body)));
  return { ...body, authority };
}

export function assertDiagnosticScaleRun(run, authority) {
  const expected = SCALE_AUTHORITIES.get(authority);
  const body = withoutAuthority(run);
  if (!expected || run?.authority !== authority || authority?.schemaVersion !== 1 || run?.proofClass !== 'synthetic-diagnostic' || expected !== sha256(canonicalJson(body))) throw new P7EvidenceError('diagnostic scale authority mismatch');
  validateSize(run.size);
  validateMetrics(run.metrics);
  return true;
}

/** Aggregate only diagnostic core evidence. This API has no path to integrationReady:true. */
export function assessP7CoreEvidence({ mutationRuns, scaleRuns }) {
  const issues = [];
  const mutations = Array.isArray(mutationRuns) ? mutationRuns : [];
  const scales = Array.isArray(scaleRuns) ? scaleRuns : [];
  if (!Array.isArray(mutationRuns)) issues.push('mutation runs must be an array');
  if (!Array.isArray(scaleRuns)) issues.push('scale runs must be an array');
  const mutationIds = mutations.map((run) => run?.mutationId);
  for (const spec of MUTATION_CATALOG) {
    const matches = mutations.filter((run) => run?.mutationId === spec.id);
    if (matches.length === 0) issues.push(`missing mutation ${spec.id}`);
    if (matches.length > 1) issues.push(`duplicate mutation ${spec.id}`);
  }
  for (const id of mutationIds) if (!MUTATION_BY_ID.has(id)) issues.push(`unknown mutation evidence ${id ?? '?'}`);
  for (const run of mutations) {
    try { assertDiagnosticMutationRun(run, run?.authority); }
    catch (error) { issues.push(`mutation ${run?.mutationId ?? '?'} refused: ${error.message}`); }
  }
  const mutationCatalogComplete = MUTATION_CATALOG.every((spec) => mutationIds.filter((id) => id === spec.id).length === 1)
    && mutations.length === MUTATION_CATALOG.length
    && !issues.some((issue) => issue.startsWith('mutation ') || issue.includes('mutation evidence'));

  const scaleIds = scales.map((run) => run?.trialId);
  if (new Set(scaleIds).size !== scaleIds.length) issues.push('scale trial ids must be unique');
  for (const run of scales) {
    try { assertDiagnosticScaleRun(run, run?.authority); }
    catch (error) { issues.push(`scale ${run?.trialId ?? '?'} refused: ${error.message}`); }
    if (run?.metrics?.innerLoopNetworkRequests > 0) issues.push(`scale ${run.trialId} made a network call inside a contracted inner loop`);
  }
  if (scales.length < 3) issues.push('scale series requires at least three measured sizes');
  const workSizes = scales.map((run) => totalSize(run?.size));
  if (workSizes.some((size, index) => index > 0 && size <= workSizes[index - 1])) issues.push('scale work sizes must be strictly increasing');
  const syntheticScaleSeriesComplete = scales.length >= 3
    && !issues.some((issue) => issue.startsWith('scale ') || issue.includes('scale series') || issue.includes('scale work'));

  const uniqueIssues = [...new Set(issues)].sort();
  const body = {
    schemaVersion: 1,
    state: uniqueIssues.length ? 'FAILED_STATIC' : 'DIAGNOSTIC_ONLY',
    proofClass: 'p7-core-diagnostic',
    mutationCatalogComplete,
    syntheticScaleSeriesComplete,
    integrationReady: false,
    mutationIds: [...mutationIds].sort(),
    mutationRunHashes: mutations.map((run) => sha256(canonicalJson(withoutAuthority(run)))).sort(),
    scaleTrialIds: [...scaleIds].sort(),
    scaleRunHashes: scales.map((run) => sha256(canonicalJson(withoutAuthority(run)))).sort(),
    blockers: [...BLOCKERS],
    issues: uniqueIssues,
  };
  return { ...body, reportHash: sha256(canonicalJson(body)) };
}

function withoutAuthority(value) {
  if (!plainObject(value)) return value;
  const { authority, ...body } = value;
  return body;
}

function inventoryOf(artifacts) {
  if (!plainObject(artifacts) || Object.keys(artifacts).length === 0) throw new P7EvidenceError('scale workload artifacts missing');
  return Object.fromEntries(Object.entries(artifacts).sort().map(([name, value]) => {
    if (!nonempty(name) || name.includes('\\') || name.startsWith('/') || name.split('/').some((part) => !part || part === '.' || part === '..')) throw new P7EvidenceError(`unsafe scale artifact path ${name}`);
    const bytes = Buffer.isBuffer(value) ? value : typeof value === 'string' ? Buffer.from(value) : value instanceof Uint8Array ? Buffer.from(value) : null;
    if (!bytes) throw new P7EvidenceError(`scale artifact ${name} is not bytes/string`);
    return [name, { sha256: sha256(bytes), bytes: bytes.length }];
  }));
}

function validateSize(size) {
  if (!plainObject(size)) throw new P7EvidenceError('scale size malformed');
  for (const key of ['nodes', 'properties', 'aliases', 'variables', 'modeContexts']) if (!Number.isInteger(size[key]) || size[key] < 0) throw new P7EvidenceError(`scale size ${key} malformed`);
  if (size.nodes === 0) throw new P7EvidenceError('scale size requires nodes');
}

function validateOutputCounts(counts) {
  if (!plainObject(counts)) throw new P7EvidenceError('scale output counts malformed');
  for (const key of ['components', 'fragments', 'runtimeStates']) if (!Number.isInteger(counts[key]) || counts[key] < 0) throw new P7EvidenceError(`scale output count ${key} malformed`);
}

function validateMetrics(metrics) {
  if (!plainObject(metrics)) throw new P7EvidenceError('scale metrics malformed');
  for (const key of ['wallMs', 'cpuUserMicros', 'cpuSystemMicros', 'peakRssBytes', 'outputBytes', 'networkRequests', 'networkBytes', 'innerLoopNetworkRequests']) if (!Number.isFinite(metrics[key]) || metrics[key] < 0) throw new P7EvidenceError(`scale metric ${key} malformed`);
  if (!plainObject(metrics.operations) || Object.keys(metrics.operations).sort().join(',') !== [...OPERATION_KINDS].sort().join(',')) throw new P7EvidenceError('scale operation census malformed');
  for (const value of Object.values(metrics.operations)) if (!Number.isInteger(value) || value < 0) throw new P7EvidenceError('scale operation count malformed');
  validateOutputCounts(metrics.outputCounts);
}

const totalSize = (size) => plainObject(size) ? size.nodes + size.properties + size.aliases + size.variables + size.modeContexts : -1;
const nonempty = (value) => typeof value === 'string' && value.length > 0;
const plainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const stringArray = (value) => Array.isArray(value) && value.every(nonempty);

function cloneCanonical(value, label) {
  assertJsonSafe(value, label);
  try { return structuredClone(value); }
  catch (error) { throw new P7EvidenceError(`${label} is not cloneable JSON: ${error.message}`); }
}

function assertJsonSafe(value, label, seen = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new P7EvidenceError(`${label} contains a non-finite number`);
    return;
  }
  if (typeof value !== 'object') throw new P7EvidenceError(`${label} contains non-JSON data`);
  if (seen.has(value)) throw new P7EvidenceError(`${label} contains a cycle`);
  seen.add(value);
  if (!Array.isArray(value) && !jsonObject(value)) throw new P7EvidenceError(`${label} contains a non-plain object`);
  for (const item of Array.isArray(value) ? value : Object.values(value)) assertJsonSafe(item, label, seen);
  seen.delete(value);
}

const jsonObject = (value) => plainObject(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
