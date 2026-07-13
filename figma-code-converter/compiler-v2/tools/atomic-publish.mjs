/**
 * Compiler v2 calibration generation publish.
 *
 * Calibration is multi-writer, not globally locked: every transaction owns UUID-isolated stage,
 * generation, and temp-pointer paths. Complete generations may coexist; the last COMPLETE pointer
 * rename wins. Recovery removes only a valid same-host transaction whose PID is provably dead (or
 * an ended transaction in this process). Live, cross-host, malformed, and ownerless artifacts are
 * preserved. The registry/package CAS required by V17 is a separate product transaction.
 * Published generations are removed only when recovery atomically wins ownership of their dead
 * temp pointer; ENOENT means the publisher won the final rename and its generation is preserved.
 * Bounded retention/reader leases remain explicit P0 operability work.
 */
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

const POINTER_SCHEMA = 2;
const TRANSACTION_SCHEMA = 2;
const activeTransactions = new WeakMap();
const activeIds = new Set();

export const runToken = (stamp) => `${process.pid}-${stamp}`;
export const compilerV2OutDir = (legacyOutDir) => path.join(legacyOutDir, 'v2');

const pointerPath = (outDir) => path.join(outDir, 'latest.json');
const transactionPath = (dir) => path.join(dir, '.transaction.json');
const publishedPath = (dir) => path.join(dir, '.published.json');
const ownedStage = (outDir, genBase, token, id) => path.join(outDir, `.stage-${genBase}-${token}-${id}`);
const ownedGeneration = (outDir, genBase, token, id) => path.join(outDir, 'generations', `${genBase}-${token}-${id}`);
const tempPointerPath = (outDir, id) => path.join(outDir, `.latest-${id}.json`);

export async function beginTransaction(outDir) {
  const root = path.resolve(outDir);
  await ensureRegularDirectory(root);
  const rootTopology = await captureDirectory(root);
  const transaction = Object.freeze({ id: randomUUID(), outDir: root, pid: process.pid, host: os.hostname() });
  activeTransactions.set(transaction, { active: true, candidates: new Map(), rootTopology });
  activeIds.add(transaction.id);
  return transaction;
}

export async function endTransaction(transaction) {
  const state = activeTransactions.get(transaction);
  if (!state?.active) return;
  state.active = false;
  activeIds.delete(transaction.id);
}

export async function withTransaction(outDir, fn) {
  const transaction = await beginTransaction(outDir);
  try { return await fn(transaction); }
  finally { await endTransaction(transaction); }
}

async function assertTransaction(outDir, transaction) {
  const state = transaction && activeTransactions.get(transaction);
  if (!state?.active || transaction.outDir !== path.resolve(outDir)) {
    throw new Error('calibration transaction invalid, forged, ended, or for another output directory');
  }
  await assertSameDirectory(state.rootTopology);
  return state;
}

export async function prepareStaging({ outDir, genBase, token, transaction }) {
  const state = await assertTransaction(outDir, transaction);
  assertPathSegment('genBase', genBase);
  assertPathSegment('token', token);
  const key = `${genBase}\u241f${token}`;
  if (state.candidates.has(key)) throw new Error(`transaction candidate already exists for ${genBase}/${token}`);
  const staging = ownedStage(outDir, genBase, token, transaction.id);
  const generation = ownedGeneration(outDir, genBase, token, transaction.id);
  await ensureRegularDirectory(path.dirname(generation));
  const generationParent = await captureDirectory(path.dirname(generation));
  assertContained(state.rootTopology.real, generationParent.real, 'generations directory escapes output root');
  await fs.mkdir(staging);
  const candidate = { key, staging, generation, generationParent, genBase, token };
  state.candidates.set(key, candidate);
  try {
    await writeTransactionMarker(staging, outDir, candidate, transaction);
    return staging;
  } catch (error) {
    state.candidates.delete(key);
    await fs.rm(staging, { recursive: true, force: true });
    throw error;
  }
}

export async function publishGeneration({ outDir, genBase, token, transaction, _injectAfterGen, _injectBeforePointer }) {
  const state = await assertTransaction(outDir, transaction);
  const key = `${genBase}\u241f${token}`;
  const candidate = state.candidates.get(key);
  if (!candidate) throw new Error(`publish: no owned staged candidate for ${genBase}/${token}`);
  const tempPointer = tempPointerPath(outDir, transaction.id);
  let moved = false;
  try {
    const marker = await readTransactionMarker(candidate.staging, outDir);
    if (!marker || marker.transactionId !== transaction.id) throw new Error('publish: staging transaction ownership mismatch');
    await assertSameDirectory(state.rootTopology);
    await assertSameDirectory(candidate.generationParent);
    assertContained(state.rootTopology.real, candidate.generationParent.real, 'generations directory escapes output root');
    await fs.rename(candidate.staging, candidate.generation);
    moved = true;
    if (_injectAfterGen) await _injectAfterGen();
    const pointer = pointerRecord(outDir, candidate, transaction);
    await fs.writeFile(tempPointer, JSON.stringify(pointer, null, 1), { flag: 'wx' });
    await fs.writeFile(publishedPath(candidate.generation), JSON.stringify(pointer, null, 1), { flag: 'wx' });
    if (_injectBeforePointer) await _injectBeforePointer();
    await fs.rename(tempPointer, pointerPath(outDir)); // FINAL operation: old or new complete generation
    return { genDir: candidate.generation, pointer: pointerPath(outDir) };
  } catch (error) {
    const cleanupErrors = [];
    if (moved) {
      try {
        await assertSameDirectory(candidate.generationParent);
        await fs.rm(candidate.generation, { recursive: true, force: true });
      } catch (cleanupError) { cleanupErrors.push(cleanupError); }
    } else {
      try { await fs.rm(candidate.staging, { recursive: true, force: true }); }
      catch (cleanupError) { cleanupErrors.push(cleanupError); }
    }
    try { await fs.rm(tempPointer, { force: true }); }
    catch (cleanupError) { cleanupErrors.push(cleanupError); }
    if (cleanupErrors.length) {
      throw new AggregateError([error, ...cleanupErrors], `publish failed: ${error.message}; cleanup also failed`, { cause: error });
    }
    throw error;
  } finally { state.candidates.delete(key); }
}

export async function cleanStaging(outDir, genBase, token, { transaction } = {}) {
  const state = await assertTransaction(outDir, transaction);
  const key = `${genBase}\u241f${token}`;
  const candidate = state.candidates.get(key);
  if (!candidate) return false;
  if (!await exists(candidate.staging)) return;
  const marker = await readTransactionMarker(candidate.staging, outDir);
  if (!marker || marker.transactionId !== transaction.id) throw new Error('clean staging refused: transaction ownership mismatch');
  await fs.rm(candidate.staging, { recursive: true, force: true });
  state.candidates.delete(key);
  return true;
}

export async function recoverGenerations(outDir, { transaction, _injectAfterTempRead } = {}) {
  const body = async (owned) => {
    await assertTransaction(outDir, owned);
    return recoverOwned(outDir, owned, { _injectAfterTempRead });
  };
  return transaction ? body(transaction) : withTransaction(outDir, body);
}

async function recoverOwned(outDir, transaction, { _injectAfterTempRead } = {}) {
  const state = await assertTransaction(outDir, transaction);
  const topology = await captureOutputTopology(outDir);
  await assertSameDirectory(state.rootTopology);
  const pointer = await readPointer(outDir, topology);
  const referenced = pointer?.generation ?? null;
  const removedTemp = [], removedGenerations = [], tempPlans = [], stagePlans = [], generationPlans = [];
  for (const name of await fs.readdir(outDir).catch(() => [])) {
    const absolute = path.join(outDir, name);
    if (name.startsWith('.latest-') && name.endsWith('.json')) {
      const temp = await readCandidatePointer(absolute, outDir);
      if (temp) {
        if (_injectAfterTempRead) await _injectAfterTempRead({ file: absolute, pointer: temp });
        if (await ownerEnded(temp, transaction)) tempPlans.push({ absolute, name, generation: temp.generation });
      }
    } else if (name.startsWith('.stage-')) {
      const marker = await readTransactionMarker(absolute, outDir);
      if (marker && await ownerEnded(marker, transaction)) {
        stagePlans.push({ absolute, name });
      }
    }
  }

  const generations = path.join(outDir, 'generations');
  for (const name of await fs.readdir(generations).catch(() => [])) {
    const absolute = path.join(generations, name);
    const relative = path.join('generations', name);
    if (relative === referenced) continue;
    const marker = await readTransactionMarker(absolute, outDir);
    const published = await exists(publishedPath(absolute));
    if (marker && await ownerEnded(marker, transaction)) {
      generationPlans.push({ absolute, relative, published });
    }
  }

  // Validate the complete topology and pointer first. No recovery mutation occurs before here.
  await assertOutputTopologyUnchanged(topology);
  const abandonedFromTemp = new Set();
  for (const { absolute, name, generation } of tempPlans) {
    try {
      await fs.unlink(absolute);
      abandonedFromTemp.add(generation);
      removedTemp.push(name);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      // Publisher won the temp→latest rename; this generation is complete, not abandoned.
    }
  }
  for (const { absolute, name } of stagePlans) {
    await fs.rm(absolute, { recursive: true, force: true });
    removedTemp.push(name);
  }
  const currentReferenced = (await readPointer(outDir, topology))?.generation ?? null;
  for (const { absolute, relative, published } of generationPlans) {
    if (relative === currentReferenced || (published && !abandonedFromTemp.has(relative))) continue;
    if (topology.generations) await assertSameDirectory(topology.generations);
    await fs.rm(absolute, { recursive: true, force: true });
    removedGenerations.push(relative);
  }
  return { referenced, removedGenerations, removedTemp };
}

function pointerRecord(outDir, candidate, transaction) {
  return {
    schemaVersion: POINTER_SCHEMA,
    generation: path.relative(outDir, candidate.generation),
    token: candidate.token,
    transactionId: transaction.id,
    pid: transaction.pid,
    host: transaction.host,
  };
}

async function readPointer(outDir, topology) {
  const file = pointerPath(outDir);
  let stat;
  try { stat = await fs.lstat(file); }
  catch (error) { if (error.code === 'ENOENT') return null; throw pointerError(error); }
  if (!stat.isFile() || stat.isSymbolicLink()) throw pointerError('latest.json is not a regular file');
  let value;
  try { value = JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) { throw pointerError(error); }
  const target = validatePointerRecord(outDir, value);
  let targetStat;
  try { targetStat = await fs.lstat(target); }
  catch (error) { throw pointerError(`referenced generation missing (${error.code ?? error.message})`); }
  if (!targetStat.isDirectory() || targetStat.isSymbolicLink()) throw pointerError('referenced generation is not a regular directory');
  const generationsTopology = topology.generations ?? await captureDirectory(path.join(outDir, 'generations'));
  assertContained(topology.root.real, generationsTopology.real, 'generations directory escapes output root');
  const targetReal = await fs.realpath(target).catch((error) => { throw pointerError(error); });
  assertContained(generationsTopology.real, targetReal, 'referenced generation escapes generations directory');
  const marker = await readTransactionMarker(target, outDir);
  if (!marker || !pointerMatchesMarker(value, marker)) throw pointerError('referenced generation transaction identity mismatch');
  const published = await readPublishedMarker(target, outDir);
  if (!published || !samePointer(value, published)) throw pointerError('referenced generation publication identity mismatch');
  return value;
}

async function readCandidatePointer(file, outDir) {
  try {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink()) return null;
    const value = JSON.parse(await fs.readFile(file, 'utf8'));
    const target = validatePointerRecord(outDir, value);
    const marker = await readTransactionMarker(target, outDir);
    return marker && pointerMatchesMarker(value, marker) ? value : null;
  } catch { return null; }
}

function validatePointerRecord(outDir, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schemaVersion !== POINTER_SCHEMA ||
      typeof value.generation !== 'string' || typeof value.token !== 'string' || typeof value.transactionId !== 'string' ||
      !Number.isInteger(value.pid) || typeof value.host !== 'string') throw pointerError('latest.json schema invalid');
  if (value.generation.includes('\\') || path.posix.normalize(value.generation) !== value.generation) throw pointerError('generation path is not normalized');
  const parts = value.generation.split('/');
  if (parts.length !== 2 || parts[0] !== 'generations' || !parts[1]) throw pointerError('generation path invalid');
  const target = path.resolve(outDir, value.generation);
  const root = path.resolve(outDir, 'generations');
  if (!target.startsWith(root + path.sep)) throw pointerError('generation path escapes output root');
  return target;
}

function pointerMatchesMarker(pointer, marker) {
  return pointer.transactionId === marker.transactionId && pointer.token === marker.token && pointer.pid === marker.pid &&
    pointer.host === marker.host && pointer.generation === marker.generation;
}

function samePointer(a, b) {
  return a.schemaVersion === b.schemaVersion && pointerMatchesMarker(a, b);
}

function pointerError(cause) {
  const detail = typeof cause === 'string' ? cause : (cause.code ?? cause.message);
  return new Error(`recover: latest.json unreadable/corrupt — refusing, all generations preserved (${detail})`);
}

async function writeTransactionMarker(dir, outDir, candidate, transaction) {
  const marker = {
    schemaVersion: TRANSACTION_SCHEMA,
    transactionId: transaction.id,
    pid: transaction.pid,
    host: transaction.host,
    genBase: candidate.genBase,
    token: candidate.token,
    staging: path.relative(outDir, candidate.staging),
    generation: path.relative(outDir, candidate.generation),
  };
  await fs.writeFile(transactionPath(dir), JSON.stringify(marker, null, 1), { flag: 'wx' });
}

async function readTransactionMarker(dir, outDir) {
  try {
    const dirStat = await fs.lstat(dir);
    const markerStat = await fs.lstat(transactionPath(dir));
    if (!dirStat.isDirectory() || dirStat.isSymbolicLink() || !markerStat.isFile() || markerStat.isSymbolicLink()) return null;
    const marker = JSON.parse(await fs.readFile(transactionPath(dir), 'utf8'));
    if (!marker || marker.schemaVersion !== TRANSACTION_SCHEMA || typeof marker.transactionId !== 'string' ||
        !Number.isInteger(marker.pid) || typeof marker.host !== 'string' || !validPathSegment(marker.genBase) ||
        !validPathSegment(marker.token) || typeof marker.staging !== 'string' || typeof marker.generation !== 'string') return null;
    const expectedStage = ownedStage(outDir, marker.genBase, marker.token, marker.transactionId);
    const expectedGeneration = ownedGeneration(outDir, marker.genBase, marker.token, marker.transactionId);
    if (marker.staging !== path.relative(outDir, expectedStage) || marker.generation !== path.relative(outDir, expectedGeneration)) return null;
    const actual = path.resolve(dir);
    if (actual !== path.resolve(expectedStage) && actual !== path.resolve(expectedGeneration)) return null;
    return marker;
  } catch { return null; }
}

async function readPublishedMarker(dir, outDir) {
  try {
    const stat = await fs.lstat(publishedPath(dir));
    if (!stat.isFile() || stat.isSymbolicLink()) return null;
    const value = JSON.parse(await fs.readFile(publishedPath(dir), 'utf8'));
    validatePointerRecord(outDir, value);
    return value;
  } catch { return null; }
}

async function ownerEnded(owner, currentTransaction) {
  if (owner.host !== os.hostname()) return false;
  if (owner.pid === process.pid) return owner.transactionId !== currentTransaction.id && !activeIds.has(owner.transactionId);
  try { process.kill(owner.pid, 0); return false; }
  catch (error) { return error.code === 'ESRCH'; }
}

function validPathSegment(value) {
  return typeof value === 'string' && value.length > 0 && value !== '.' && value !== '..' && !value.includes('/') && !value.includes('\\');
}

function assertPathSegment(name, value) {
  if (!validPathSegment(value)) throw new Error(`${name} must be one confined path segment`);
}

async function ensureRegularDirectory(dir) {
  await fs.mkdir(dir, { recursive: true });
  await assertRegularDirectory(dir);
}

async function assertRegularDirectory(dir) {
  const stat = await fs.lstat(dir);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`calibration path must be a regular directory (${dir})`);
}

async function captureDirectory(dir) {
  await assertRegularDirectory(dir);
  const [real, stat] = await Promise.all([fs.realpath(dir), fs.stat(dir)]);
  return { path: path.resolve(dir), real, dev: stat.dev, ino: stat.ino };
}

async function assertSameDirectory(expected) {
  const current = await captureDirectory(expected.path);
  if (current.real !== expected.real || current.dev !== expected.dev || current.ino !== expected.ino) {
    throw new Error(`calibration directory identity changed (${expected.path})`);
  }
}

async function captureOutputTopology(outDir) {
  const root = await captureDirectory(path.resolve(outDir));
  const generationsPath = path.join(outDir, 'generations');
  let generations = null;
  try { generations = await captureDirectory(generationsPath); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (generations) assertContained(root.real, generations.real, 'generations directory escapes output root');
  return { root, generations };
}

async function assertOutputTopologyUnchanged(topology) {
  await assertSameDirectory(topology.root);
  if (topology.generations) await assertSameDirectory(topology.generations);
  else if (await exists(path.join(topology.root.path, 'generations'))) {
    const generations = await captureDirectory(path.join(topology.root.path, 'generations'));
    assertContained(topology.root.real, generations.real, 'generations directory escapes output root');
  }
}

function assertContained(root, target, message) {
  if (target !== root && !target.startsWith(root + path.sep)) throw new Error(message);
}

async function exists(file) { try { await fs.access(file); return true; } catch { return false; } }
