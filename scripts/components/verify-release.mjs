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
  try { manifest = JSON.parse(await fs.readFile(path.join(releaseDir, 'component-release.json'), 'utf8')); }
  catch { return { status: 'unverified', reason: 'component-release.json unavailable' }; }
  if (manifest?.schemaVersion !== 1 || path.basename(releaseDir) !== manifest.releaseId
    || !manifest.artifacts || !Array.isArray(manifest.components)) {
    return { status: 'unverified', reason: 'release manifest incomplete', manifest };
  }
  if (expectedReleaseId(manifest) !== manifest.releaseId) {
    return { status: 'fail', reason: 'release id does not seal canonical manifest payload', manifest };
  }
  const actual = (await filesOf(releaseDir)).filter((file) => file !== 'component-release.json');
  const claimed = Object.keys(manifest.artifacts).sort();
  if (actual.join('\0') !== claimed.join('\0')) return { status: 'fail', reason: 'release file inventory mismatch', manifest };
  for (const relative of claimed) {
    const got = await digest(path.join(releaseDir, relative));
    const want = manifest.artifacts[relative];
    if (got.bytes !== want?.bytes || got.sha256 !== want?.sha256)
      return { status: 'fail', reason: `release artifact mismatch: ${relative}`, manifest };
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
  return { status: 'pass', manifest };
}

export function compareApi(previous, next) {
  const failures = [];
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
        failures.push({ component: component.codeName, prop: prop.authoredKey, reason: 'removed' });
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

export async function verifyPulledGenerated({ generatedDir, appTokensPath }) {
  let provenance;
  try { provenance = JSON.parse(await fs.readFile(path.join(generatedDir, 'provenance.json'), 'utf8')); }
  catch { return { status: 'unverified', reason: 'generated provenance unavailable' }; }
  if (!provenance.releaseId || !provenance.releaseHash || !Array.isArray(provenance.components)) {
    return { status: 'unverified', reason: 'generated provenance incomplete', provenance };
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
  return { status: 'pass', provenance };
}
