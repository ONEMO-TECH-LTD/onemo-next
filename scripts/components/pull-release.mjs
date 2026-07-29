#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFile as execFileCb } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  compareApi,
  compareTokenClosure,
  verifyPublishedRelease,
  verifyPulledGenerated,
} from './verify-release.mjs';

const execFile = promisify(execFileCb);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function filesOf(root, dir = root) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await filesOf(root, target));
    else if (entry.isFile()) out.push(path.relative(root, target).split(path.sep).join('/'));
  }
  return out.sort();
}

async function digest(file) {
  const bytes = await fs.readFile(file);
  return { bytes: bytes.length, sha256: sha256(bytes) };
}

async function wrapperHashes(appRoot, generatedDir) {
  const src = path.join(appRoot, 'src');
  const files = await filesOf(src);
  const generatedRelative = path.relative(src, generatedDir).split(path.sep).join('/');
  const rows = {};
  for (const relative of files) {
    if (relative === generatedRelative || relative.startsWith(`${generatedRelative}/`)) continue;
    if (!/\.(?:ts|tsx|js|jsx|css)$/.test(relative)) continue;
    rows[relative] = (await digest(path.join(src, relative))).sha256;
  }
  return rows;
}

async function gitSha(appRoot) {
  return (await execFile('git', ['rev-parse', 'HEAD'], { cwd: appRoot })).stdout.trim();
}

async function readPrevious(generatedDir) {
  try { return JSON.parse(await fs.readFile(path.join(generatedDir, 'provenance.json'), 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function consumersFor(component, wrapperFiles) {
  const needles = [
    `/generated/${component.codeName}`,
    `/generated/${component.codeName}/${component.codeName}`,
  ];
  return Object.entries(wrapperFiles)
    .filter(([, source]) => needles.some((needle) => source.includes(needle)))
    .map(([file]) => file)
    .sort();
}

async function wrapperSources(appRoot, generatedDir) {
  const src = path.join(appRoot, 'src');
  const files = await filesOf(src);
  const generatedRelative = path.relative(src, generatedDir).split(path.sep).join('/');
  const rows = {};
  for (const relative of files) {
    if (relative === generatedRelative || relative.startsWith(`${generatedRelative}/`)) continue;
    if (!/\.(?:ts|tsx|js|jsx)$/.test(relative)) continue;
    rows[relative] = await fs.readFile(path.join(src, relative), 'utf8');
  }
  return rows;
}

/**
 * @param {{
 *   releaseDir: string,
 *   appRoot: string,
 *   failAt?: 'before-swap' | 'after-swap' | null,
 * }} options
 */
export async function pullComponentRelease({
  releaseDir,
  appRoot,
  failAt = null,
}) {
  const release = await verifyPublishedRelease(releaseDir);
  if (release.status !== 'pass') throw new Error(`component pull: release ${release.status}: ${release.reason}`);
  const manifest = release.manifest;
  const generatedDir = path.join(appRoot, 'src', 'components', 'generated');
  const tokensPath = path.join(appRoot, 'src', 'app', 'tokens', 'tokens.css');
  const previous = await readPrevious(generatedDir);
  const wrappers = await wrapperSources(appRoot, generatedDir);
  const knownComponents = new Map([
    ...(previous?.components ?? []).map((component) => [component.figmaId, component]),
    ...manifest.components.map((component) => [component.figmaId, component]),
  ]);
  const liveConsumers = [...knownComponents.values()].flatMap((component) => consumersFor(component, wrappers));
  if (!liveConsumers.length) throw new Error('component pull: no app-owned generated-component consumer exists');
  const apiFailures = compareApi(previous, manifest);
  if (apiFailures.length) {
    const affected = [...new Set(apiFailures.flatMap((failure) => {
      const component = [...knownComponents.values()].find((row) => row.codeName === failure.component);
      return component ? consumersFor(component, wrappers) : [];
    }))];
    throw new Error(`component pull: breaking API change (${apiFailures.map((row) =>
      `${row.component}.${row.prop}:${row.reason}`).join(', ')}); consumers: ${affected.join(', ') || 'none found'}`);
  }
  const appTokens = await fs.readFile(tokensPath, 'utf8');
  const valueDrift = [];
  for (const component of manifest.components) {
    const compatibility = compareTokenClosure(component, appTokens);
    if (compatibility.failures.length) {
      throw new Error(`component pull: ${component.codeName} token incompatibility: ${compatibility.failures
        .map((row) => `${row.token}:${row.reason}`).join(', ')}`);
    }
    valueDrift.push(...compatibility.valueDrift.map((row) => ({ component: component.codeName, ...row })));
  }

  const beforeWrappers = await wrapperHashes(appRoot, generatedDir);
  const stage = path.join(appRoot, 'src', 'components', `.generated-stage-${process.pid}`);
  const backup = path.join(appRoot, 'src', 'components', `.generated-backup-${process.pid}`);
  await fs.rm(stage, { recursive: true, force: true });
  await fs.rm(backup, { recursive: true, force: true });
  let swapped = false;
  try {
    await fs.cp(path.join(releaseDir, 'components'), stage, { recursive: true, errorOnExist: true });
    const generatedFiles = await filesOf(stage);
    const artifacts = Object.fromEntries(await Promise.all(generatedFiles.map(async (relative) => [
      relative,
      await digest(path.join(stage, relative)),
    ])));
    const releaseBytes = await fs.readFile(path.join(releaseDir, 'manifest.json'));
    const provenance = {
      schemaVersion: 1,
      releaseId: manifest.releaseId,
      releaseHash: sha256(releaseBytes),
      source: manifest.authority,
      appBase: await gitSha(appRoot),
      components: manifest.components,
      artifacts,
      valueDrift,
    };
    await fs.writeFile(path.join(stage, 'provenance.json'), `${JSON.stringify(provenance, null, 2)}\n`);
    if (failAt === 'before-swap') throw new Error('injected component pull failure before swap');
    try {
      await fs.rename(generatedDir, backup);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    await fs.rename(stage, generatedDir);
    swapped = true;
    if (failAt === 'after-swap') throw new Error('injected component pull failure after swap');
    const afterWrappers = await wrapperHashes(appRoot, generatedDir);
    if (JSON.stringify(beforeWrappers) !== JSON.stringify(afterWrappers)) {
      throw new Error('component pull: app-owned wrapper bytes changed');
    }
    const verified = await verifyPulledGenerated({ generatedDir, appTokensPath: tokensPath, appRoot });
    if (verified.status !== 'pass') throw new Error(`component pull: generated verification ${verified.status}: ${verified.reason}`);
    await fs.rm(backup, { recursive: true, force: true });
    return { generatedDir, provenance, valueDrift };
  } catch (error) {
    if (swapped) {
      await fs.rm(generatedDir, { recursive: true, force: true });
      try { await fs.rename(backup, generatedDir); }
      catch (restoreError) {
        if (restoreError.code !== 'ENOENT') throw new AggregateError([error, restoreError], 'component pull and rollback failed');
      }
    }
    await fs.rm(stage, { recursive: true, force: true });
    await fs.rm(backup, { recursive: true, force: true });
    throw error;
  }
}

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith('--') || argv[i + 1] == null) throw new Error(`component pull: malformed option ${argv[i] ?? ''}`);
    out[argv[i].slice(2)] = argv[i + 1];
  }
  if (!out.release) throw new Error('component pull: --release is required');
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = args(process.argv.slice(2));
    const appRoot = options['app-root'] ? path.resolve(options['app-root']) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
    const result = await pullComponentRelease({ releaseDir: path.resolve(options.release), appRoot });
    console.log(`component pull: ${result.provenance.releaseId} -> ${result.generatedDir}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
