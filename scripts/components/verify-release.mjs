import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function filesOf(root, dir = root) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await filesOf(root, target));
    else if (entry.isFile()) out.push(path.relative(root, target).split(path.sep).join('/'));
    else throw new Error(`component pull: unsupported entry ${path.relative(root, target)}`);
  }
  return out.sort();
}

async function digest(file) {
  const bytes = await fs.readFile(file);
  return { bytes: bytes.length, sha256: sha256(bytes) };
}

async function directInternalImports(appRoot, generatedDir) {
  const src = path.join(appRoot, 'src');
  const generatedRelative = path.relative(src, generatedDir).split(path.sep).join('/');
  const findings = [];
  for (const relative of await filesOf(src)) {
    if (relative === generatedRelative || relative.startsWith(`${generatedRelative}/`)) continue;
    if (!/\.(?:ts|tsx|js|jsx)$/.test(relative)) continue;
    const source = await fs.readFile(path.join(src, relative), 'utf8');
    for (const match of source.matchAll(/['"]([^'"\n]+)['"]/g)) {
      if (/(?:^|\/)generated\/.+\/internal(?:\/|$)/.test(match[1])) {
        findings.push({ file: relative, specifier: match[1] });
      }
    }
  }
  return findings;
}

function definitions(css) {
  const out = new Map();
  for (const match of css.matchAll(/(--[A-Za-z0-9_-]+)\s*:\s*([^;]+);/g)) {
    if (!out.has(match[1])) out.set(match[1], match[2].trim());
  }
  return out;
}

function refs(value) {
  return [...String(value).matchAll(/var\((--[A-Za-z0-9_-]+)/g)].map((match) => match[1]);
}

function closureFromRoots(roots, css) {
  const defs = definitions(css);
  const found = new Map();
  const visit = (token, stack = []) => {
    if (found.has(token)) return;
    if (stack.includes(token)) throw new Error(`component pull: token cycle ${[...stack, token].join(' -> ')}`);
    const value = defs.get(token);
    if (value == null) throw new Error(`component pull: token ${token} is absent from app authority`);
    found.set(token, value);
    for (const ref of refs(value)) visit(ref, [...stack, token]);
  };
  for (const root of roots) visit(root);
  return [...found].sort(([a], [b]) => a.localeCompare(b))
    .map(([token, value]) => ({ token, value }));
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function expectedReleaseId(manifest) {
  const { releaseId: _releaseId, ...payload } = manifest;
  return sha256(canonical(payload));
}

function verifyCapabilityClosure(pointer, evidence, source) {
  if (
    !pointer
    || typeof pointer.relativePath !== 'string'
    || !pointer.relativePath
    || !pointer.summary
    || typeof pointer.recordsHash !== 'string'
  ) {
    return 'source capability closure absent';
  }
  if (
    evidence?.schemaVersion !== 1
    || canonical(evidence.source) !== canonical({
      fileKey: source?.fileKey,
      fileVersion: source?.fileVersion,
      boardId: source?.boardId,
      boardContentHash: source?.boardContentHash,
    })
    || canonical(evidence.summary) !== canonical(pointer.summary)
    || evidence.recordsHash !== pointer.recordsHash
    || !Array.isArray(evidence.dispositions)
    || !Array.isArray(evidence.refusals)
  ) {
    return 'source capability closure differs from sealed manifest authority';
  }
  const summary = evidence.summary;
  if (
    !Number.isInteger(summary.refused)
    || !Number.isInteger(summary.acknowledgedRefusals)
    || !Number.isInteger(summary.unacknowledgedRefusals)
    || summary.refused !== evidence.refusals.length
    || summary.refused !== summary.acknowledgedRefusals + summary.unacknowledgedRefusals
  ) {
    return 'source capability refusal census differs from sealed evidence';
  }
  const dispositionIds = new Set(evidence.dispositions.map(({ id }) => id));
  const unacknowledged = evidence.refusals.filter(({ dispositionId }) => !dispositionId);
  if (
    unacknowledged.length !== summary.unacknowledgedRefusals
    || evidence.refusals.some(({ dispositionId }) =>
      dispositionId && !dispositionIds.has(dispositionId))
  ) {
    return 'source capability disposition census differs from sealed evidence';
  }
  if (unacknowledged.length) {
    return [
      `source capability refusal: ${unacknowledged.length} unacknowledged`,
      ...unacknowledged.map(({ nodeId, path: fieldPath }) => `${nodeId} ${fieldPath}`),
    ].join('; ');
  }
  return null;
}

function syntaxClass(value) {
  const text = String(value).trim();
  if (/^var\(/.test(text)) return 'alias';
  if (/^#|^rgb|^oklch|^hsl/.test(text)) return 'color';
  if (/^-?[\d.]+(px|rem|em|vi|vw|cqi|cqw|%)$/.test(text)) return text.match(/[a-z%]+$/)?.[0] ?? 'number';
  if (/^clamp\(/.test(text)) return 'clamp';
  if (/^-?[\d.]+$/.test(text)) return 'number';
  return 'other';
}

export async function verifyPublishedRelease(releaseDir) {
  let manifest;
  try { manifest = JSON.parse(await fs.readFile(path.join(releaseDir, 'manifest.json'), 'utf8')); }
  catch { return { status: 'unverified', reason: 'manifest.json unavailable' }; }
  if (manifest?.schemaVersion !== 1 || path.basename(releaseDir) !== manifest.releaseId
    || !manifest.artifacts || !Array.isArray(manifest.components)) {
    return { status: 'unverified', reason: 'release manifest incomplete', manifest };
  }
  if (expectedReleaseId(manifest) !== manifest.releaseId) {
    return { status: 'fail', reason: 'release id does not seal canonical manifest payload', manifest };
  }
  const actual = (await filesOf(releaseDir)).filter((file) => file !== 'manifest.json');
  const claimed = Object.keys(manifest.artifacts).sort();
  if (actual.join('\0') !== claimed.join('\0')) return { status: 'fail', reason: 'release file inventory mismatch', manifest };
  for (const relative of claimed) {
    const got = await digest(path.join(releaseDir, relative));
    const want = manifest.artifacts[relative];
    if (got.bytes !== want?.bytes || got.sha256 !== want?.sha256)
      return { status: 'fail', reason: `release artifact mismatch: ${relative}`, manifest };
  }
  const capabilityPointer = manifest.capabilityClosure;
  if (!capabilityPointer?.relativePath || !manifest.artifacts[capabilityPointer.relativePath]) {
    return { status: 'unverified', reason: 'source capability closure absent', manifest };
  }
  let capabilityClosure;
  try {
    capabilityClosure = JSON.parse(
      await fs.readFile(path.join(releaseDir, capabilityPointer.relativePath), 'utf8'),
    );
  } catch {
    return {
      status: 'unverified',
      reason: `source capability evidence unavailable at ${path.join(releaseDir, capabilityPointer.relativePath)}`,
      manifest,
    };
  }
  const capabilityFailure = verifyCapabilityClosure(
    capabilityPointer,
    capabilityClosure,
    manifest.authority,
  );
  if (capabilityFailure) {
    return { status: 'fail', reason: capabilityFailure, manifest, capabilityClosure };
  }
  const tokenBytes = await fs.readFile(path.join(releaseDir, 'authority', 'tokens.css'));
  if (sha256(tokenBytes) !== manifest.authority?.tokensHash)
    return { status: 'fail', reason: 'release token authority mismatch', manifest };
  for (const component of manifest.components) {
    if (!component.figmaId || !component.codeName || !component.artifactRoot
      || !Array.isArray(component.api) || !component.tokenDependencies) {
      return { status: 'unverified', reason: `release component incomplete: ${component.figmaId ?? 'unknown'}`, manifest };
    }
  }
  return { status: 'pass', manifest, capabilityClosure };
}

export function compareApi(previous, next) {
  const failures = [];
  const isEmitted = (prop) => prop.emitted ?? Boolean(prop.emittedType);
  const scopeMasters = (prop) => new Set((prop.bindingScope ?? []).map(({ masterId }) => masterId));
  const beforeById = new Map((previous?.components ?? []).map((component) => [component.figmaId, component]));
  const nextById = new Map((next?.components ?? []).map((component) => [component.figmaId, component]));
  for (const component of previous?.components ?? []) {
    if (!nextById.has(component.figmaId)) {
      failures.push({ component: component.codeName, prop: '*', reason: 'component-removed' });
    }
  }
  for (const component of next.components ?? []) {
    const before = beforeById.get(component.figmaId);
    if (!before) continue;
    const nextProps = new Map(component.api.map((prop) => [prop.authoredKey, prop]));
    for (const prop of before.api) {
      const replacement = nextProps.get(prop.authoredKey);
      if (!replacement) {
        if (isEmitted(prop))
          failures.push({ component: component.codeName, prop: prop.authoredKey, reason: 'removed' });
        continue;
      }
      const beforeEmitted = isEmitted(prop);
      const afterEmitted = isEmitted(replacement);
      if (beforeEmitted && !afterEmitted) {
        failures.push({ component: component.codeName, prop: prop.authoredKey, reason: 'removed' });
        continue;
      }
      if (!beforeEmitted) {
        if (afterEmitted && replacement.required === true) {
          failures.push({ component: component.codeName, prop: prop.authoredKey, reason: 'new-required' });
        }
        continue;
      }
      if (replacement.propName !== prop.propName)
        failures.push({ component: component.codeName, prop: prop.authoredKey, reason: 'renamed' });
      if (replacement.type !== prop.type || replacement.emittedType !== prop.emittedType)
        failures.push({ component: component.codeName, prop: prop.authoredKey, reason: 'type-changed' });
      if (canonical(replacement.defaultValue) !== canonical(prop.defaultValue))
        failures.push({ component: component.codeName, prop: prop.authoredKey, reason: 'default-changed' });
      if (replacement.required === true && prop.required !== true)
        failures.push({ component: component.codeName, prop: prop.authoredKey, reason: 'new-required' });
      const nextScope = scopeMasters(replacement);
      for (const masterId of scopeMasters(prop)) {
        if (!nextScope.has(masterId)) {
          failures.push({
            component: component.codeName,
            prop: prop.authoredKey,
            reason: 'binding-scope-removed',
          });
          break;
        }
      }
      if (prop.type === 'VARIANT') {
        const nextOptions = new Set(replacement.variantOptions ?? []);
        for (const option of prop.variantOptions ?? []) {
          if (!nextOptions.has(option)) {
            failures.push({
              component: component.codeName,
              prop: `${prop.authoredKey}=${option}`,
              reason: 'variant-removed',
            });
          }
        }
      }
    }
  }
  return failures;
}

export function compareTokenClosure(component, appTokensCss) {
  const actual = closureFromRoots(component.tokenDependencies.roots, appTokensCss);
  const previous = component.tokenDependencies.closure;
  const beforeByToken = new Map(previous.map((row) => [row.token, row.value]));
  const actualByToken = new Map(actual.map((row) => [row.token, row.value]));
  const failures = [];
  for (const [token, value] of beforeByToken) {
    const next = actualByToken.get(token);
    if (next == null) failures.push({ token, reason: 'missing' });
    else if (refs(value).join('\0') !== refs(next).join('\0')) failures.push({ token, reason: 'alias-closure-changed' });
    else if (syntaxClass(value) !== syntaxClass(next)) failures.push({ token, reason: 'syntax-changed' });
  }
  return { failures, valueDrift: actual.filter((row) => beforeByToken.get(row.token) !== row.value) };
}

export async function verifyPulledGenerated({ generatedDir, appTokensPath, appRoot }) {
  if (!appRoot) return { status: 'unverified', reason: 'app import authority unavailable' };
  let provenance;
  try { provenance = JSON.parse(await fs.readFile(path.join(generatedDir, 'provenance.json'), 'utf8')); }
  catch { return { status: 'unverified', reason: 'generated provenance unavailable' }; }
  if (provenance.schemaVersion !== 1
    || !provenance.releaseId
    || !provenance.releaseHash
    || !provenance.source?.fileKey
    || !provenance.source?.fileVersion
    || !provenance.source?.converterSha
    || !provenance.appBase
    || !Array.isArray(provenance.components)
    || !provenance.capabilityClosure
    || !provenance.artifacts
    || Array.isArray(provenance.artifacts)) {
    return { status: 'unverified', reason: 'generated provenance incomplete', provenance };
  }
  const capabilityFailure = verifyCapabilityClosure(
    {
      relativePath: provenance.capabilityClosure.relativePath,
      summary: provenance.capabilityClosure.summary,
      recordsHash: provenance.capabilityClosure.recordsHash,
    },
    provenance.capabilityClosure,
    provenance.source,
  );
  if (capabilityFailure) {
    return { status: 'fail', reason: capabilityFailure, provenance };
  }
  const files = (await filesOf(generatedDir)).filter((file) => file !== 'provenance.json');
  const expected = Object.keys(provenance.artifacts ?? {}).sort();
  if (files.join('\0') !== expected.join('\0')) return { status: 'fail', reason: 'generated file inventory mismatch', provenance };
  for (const relative of expected) {
    const got = await digest(path.join(generatedDir, relative));
    const want = provenance.artifacts[relative];
    if (got.bytes !== want?.bytes || got.sha256 !== want?.sha256)
      return { status: 'fail', reason: `generated artifact mismatch: ${relative}`, provenance };
  }
  const appTokens = await fs.readFile(appTokensPath, 'utf8');
  for (const component of provenance.components) {
    const result = compareTokenClosure(component, appTokens);
    if (result.failures.length)
      return { status: 'fail', reason: `${component.codeName} token compatibility failed`, findings: result.failures, provenance };
  }
  const directImports = await directInternalImports(appRoot, generatedDir);
  if (directImports.length) {
    return {
      status: 'fail',
      reason: `direct generated-internal import: ${directImports
        .map(({ file, specifier }) => `${file}:${specifier}`).join(', ')}`,
      findings: directImports,
      provenance,
    };
  }
  return { status: 'pass', provenance };
}
