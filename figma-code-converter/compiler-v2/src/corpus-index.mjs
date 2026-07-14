/** P7 §14.2 integration-corpus inventory law. Inventory readiness is not phase clearance. */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { canonicalJson, censusOf, readSnapshot, resolveUnder, sha256 } from './evidence.mjs';

export const REQUIRED_INTEGRATION_ROLES = Object.freeze([
  'shape',
  'mother',
  'golden-replacement',
  'non-onemo-no-web',
  'component-provider',
  'component-consumer-a',
  'component-consumer-b',
  'editorial',
  'grid-mask-marketing',
  'enterprise-remote',
]);

const COMPLETE = 'plugin-primary-complete';
const REQUIRED_PLUGIN_PLANES = Object.freeze(['document', 'supplement', 'variables', 'components', 'fonts', 'assets', 'dependencies']);
const BLOCKERS = Object.freeze(['accepted-budgets', 'capture-authority', 'mutation-proof', 'runtime-proof', 'scale-proof']);

export async function loadCorpusInventory({ corpusRoot, indexPath = 'index.json' }) {
  try {
    const absoluteIndex = resolveUnder(corpusRoot, indexPath);
    const [rootReal, indexReal] = await Promise.all([fs.realpath(corpusRoot), fs.realpath(absoluteIndex)]);
    if (!within(rootReal, indexReal)) throw new Error('corpus index resolves outside corpus root');
    const bytes = await fs.readFile(indexReal);
    const index = JSON.parse(bytes);
    if (index?.schemaVersion !== 1 || !Array.isArray(index.entries)) throw new Error('corpus index schema malformed');
    const { seal, ...sealed } = index;
    if (!seal || seal !== sha256(canonicalJson(sealed))) throw new Error('corpus index seal mismatch');
    const entries = [];
    for (const row of index.entries) {
      const snapshotPath = resolveUnder(corpusRoot, row.snapshotPath);
      const snapshotReal = await fs.realpath(snapshotPath);
      if (!within(rootReal, snapshotReal)) throw new Error(`corpus snapshot resolves outside corpus root: ${row.snapshotPath}`);
      const snapshot = await readSnapshot(snapshotReal);
      entries.push({
        ...row,
        manifest: snapshot.manifest,
        document: snapshot.document,
        supplement: snapshot.supplement,
        variables: snapshot.variables,
        components: snapshot.components,
        dependencies: snapshot.dependencies,
        computedCensus: censusOf(snapshot),
      });
    }
    const report = assessCorpusInventory(entries);
    const body = structuredClone(report);
    delete body.reportHash;
    return withReportHash({ ...body, indexHash: sha256(bytes), indexPath });
  } catch (error) {
    const report = {
      schemaVersion: 1,
      state: 'FAILED_CAPTURE',
      structuralInventoryReady: false,
      integrationInventoryReady: false,
      roles: [],
      missingRoles: [...REQUIRED_INTEGRATION_ROLES],
      blockers: [...BLOCKERS],
      issues: [`corpus index refused: ${error.message}`],
    };
    return withReportHash({ ...report, indexHash: null, indexPath });
  }
}

/** Pure post-read validator for unit mutations. Production callers use loadCorpusInventory. */
export function assessCorpusInventory(entries) {
  const issues = [];
  const rows = Array.isArray(entries) ? entries : [];
  if (!Array.isArray(entries)) issues.push('corpus entries must be an array');
  const counts = new Map();
  for (const row of rows) {
    const role = row?.role;
    if (!REQUIRED_INTEGRATION_ROLES.includes(role)) { issues.push(`unknown role ${role ?? '?'}`); continue; }
    counts.set(role, (counts.get(role) ?? 0) + 1);
    validateIdentity(row, issues);
    validateProvenance(row, issues);
    validateRole(row, issues);
  }
  for (const role of REQUIRED_INTEGRATION_ROLES) if ((counts.get(role) ?? 0) > 1) issues.push(`duplicate role ${role}`);
  const missingRoles = REQUIRED_INTEGRATION_ROLES.filter((role) => !counts.has(role));
  const shape = rows.find((row) => row?.role === 'shape');
  const mother = rows.find((row) => row?.role === 'mother');
  if (shape && mother && shape.fileKey === mother.fileKey && shape.rootId === mother.rootId) issues.push('mother must be distinct from Shape');
  const normalizedIssues = [...new Set(issues)].sort();
  const report = {
    schemaVersion: 1,
    state: normalizedIssues.length ? 'FAILED_CAPTURE' : 'DIAGNOSTIC_ONLY',
    structuralInventoryReady: normalizedIssues.length === 0,
    integrationInventoryReady: false,
    roles: rows.filter((row) => REQUIRED_INTEGRATION_ROLES.includes(row?.role)).map((row) => row.role).sort(),
    missingRoles,
    blockers: [...BLOCKERS],
    issues: normalizedIssues,
  };
  return withReportHash(report);
}

function validateIdentity(row, issues) {
  const manifest = row?.manifest;
  if (!row?.snapshotPath || path.isAbsolute(row.snapshotPath) || path.normalize(row.snapshotPath) !== row.snapshotPath || row.snapshotPath.split('/').some((part) => !part || part === '.' || part === '..')) issues.push(`${row?.role} snapshot path invalid`);
  if (!manifest || row.fileKey !== manifest.fileKey) issues.push(`${row?.role} file key drift`);
  if (!manifest || row.fileVersion !== manifest.fileVersion) issues.push(`${row?.role} version drift`);
  if (!manifest || row.fingerprint !== manifest.fingerprint) issues.push(`${row?.role} fingerprint drift`);
  if (!manifest?.rootIds?.includes(row?.rootId)) issues.push(`${row?.role} root missing from snapshot`);
  if (canonicalJson(row?.computedCensus) !== canonicalJson(manifest?.census)) issues.push(`${row?.role} census drift`);
}

function validateProvenance(row, issues) {
  const planes = row?.manifest?.sourcePlanes ?? {};
  for (const plane of REQUIRED_PLUGIN_PLANES) if (planes[plane] !== COMPLETE) issues.push(`${row?.role} ${plane} provenance is not plugin-primary-complete`);
  if (![COMPLETE, 'rest-cross-check'].includes(planes.references)) issues.push(`${row?.role} references provenance is not sealed plugin/REST evidence`);
}

function validateRole(row, issues) {
  const role = row.role;
  const nodes = flatten(row.document);
  if (role === 'non-onemo-no-web' && (row.variables?.variables ?? []).some((variable) => Object.hasOwn(variable.codeSyntax ?? {}, 'WEB'))) issues.push(`${role} contains WEB syntax`);
  if (role === 'component-provider' && !((row.components?.components?.length ?? 0) + (row.components?.componentSets?.length ?? 0) > 0)) issues.push(`${role} lacks component definitions`);
  if (['component-consumer-a', 'component-consumer-b'].includes(role) && !nodes.some((node) => node.type === 'INSTANCE')) issues.push(`${role} lacks an INSTANCE consumer`);
  if (role === 'editorial' && !(row.supplement?.nodes ?? []).some((node) => (node.styledTextSegments?.length ?? 0) > 1)) issues.push(`${role} lacks rich text`);
  if (role === 'grid-mask-marketing') {
    const hasGrid = nodes.some((node) => node.layoutMode === 'GRID');
    const hasMask = nodes.some((node) => node.isMask === true || node.maskType);
    const hasLayers = nodes.some((node) => (node.fills?.length ?? 0) > 1 || (node.effects?.length ?? 0) > 1);
    if (!hasGrid || !hasMask || !hasLayers) issues.push(`${role} lacks GRID + mask + multilayer coverage`);
  }
  if (role === 'enterprise-remote') {
    const instances = nodes.filter((node) => node.type === 'INSTANCE').length;
    if (nodes.length < 1_000 || depth(row.document) < 12 || instances < 2 || !(row.dependencies?.locks?.length > 0)) issues.push(`${role} lacks large/deep/remote coverage`);
  }
}

function flatten(root) {
  const out = [];
  const pending = root ? [root] : [];
  while (pending.length) { const node = pending.pop(); out.push(node); pending.push(...[...(node.children ?? [])].reverse()); }
  return out;
}

function depth(root) {
  let maximum = 0;
  const pending = root ? [{ node: root, level: 0 }] : [];
  while (pending.length) {
    const { node, level } = pending.pop();
    maximum = Math.max(maximum, level);
    for (const child of node.children ?? []) pending.push({ node: child, level: level + 1 });
  }
  return maximum;
}

const within = (root, candidate) => candidate === root || candidate.startsWith(`${root}${path.sep}`);
const withReportHash = (report) => ({ ...report, reportHash: sha256(canonicalJson(report)) });
