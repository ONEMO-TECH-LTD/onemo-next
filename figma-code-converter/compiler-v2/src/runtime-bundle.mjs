/** P6 deterministic production browser bundle for one sealed emission package. */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { canonicalJson, sha256 } from './evidence.mjs';
import { selectSource } from './editor-adapter.mjs';

const BUILD_AUTHORITIES = new WeakMap();

export class RuntimeBundleError extends Error {
  constructor(message) { super(message); this.state = 'FAILED_RUNTIME'; }
}

export async function buildRuntimeBundle({ packageOutput, editorAuthority, outDir, nodeModulesDir }) {
  validatePackage(packageOutput, editorAuthority);
  if (typeof outDir !== 'string' || !path.isAbsolute(outDir)) throw new RuntimeBundleError('runtime bundle outDir must be absolute');
  if (typeof nodeModulesDir !== 'string' || !path.isAbsolute(nodeModulesDir)) throw new RuntimeBundleError('runtime bundle nodeModulesDir must be absolute');
  const packageDir = path.join(outDir, 'package');
  const publicDir = path.join(outDir, 'public');
  await fs.mkdir(packageDir, { recursive: true });
  await fs.mkdir(publicDir, { recursive: true });
  for (const [name, content] of Object.entries(packageOutput.files)) {
    const target = confined(packageDir, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
  }
  const screenFile = Object.keys(packageOutput.files).filter((name) => name.startsWith('screens/') && name.endsWith('.tsx'));
  if (screenFile.length !== 1) throw new RuntimeBundleError(`runtime bundle requires exactly one screen entry, found ${screenFile.length}`);
  const symbol = path.basename(screenFile[0], '.tsx');
  const entry = [
    'import React from "react";',
    'import { createRoot } from "react-dom/client";',
    'import "./tokens.css";',
    `import { ${symbol} } from "./${screenFile[0].replace(/\.tsx$/, '.js')}";`,
    'const host = document.getElementById("root");',
    'if (!host) throw new Error("runtime root missing");',
    `createRoot(host).render(React.createElement(${symbol}));`,
  ].join('\n');
  await fs.writeFile(path.join(packageDir, 'entry.tsx'), `${entry}\n`);
  try {
    await build({
      entryPoints: [path.join(packageDir, 'entry.tsx')],
      outfile: path.join(publicDir, 'bundle.js'),
      bundle: true,
      minify: true,
      sourcemap: false,
      metafile: false,
      platform: 'browser',
      format: 'iife',
      target: ['chrome120'],
      jsx: 'automatic',
      legalComments: 'none',
      logLevel: 'silent',
      nodePaths: [nodeModulesDir],
    });
  } catch (error) {
    throw new RuntimeBundleError(`production bundle failed: ${error.errors?.[0]?.text ?? error.message}`);
  }
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Compiler v2 runtime</title><link rel="stylesheet" href="/bundle.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>\n';
  await fs.writeFile(path.join(publicDir, 'index.html'), html);
  const files = {};
  for (const name of (await fs.readdir(publicDir)).sort()) {
    const bytes = await fs.readFile(path.join(publicDir, name));
    files[name] = { sha256: sha256(bytes), bytes: bytes.length };
  }
  const result = { schemaVersion: 1, packageHash: sha256(canonicalJson(packageOutput)), entrySymbol: symbol, files, artifactHash: sha256(canonicalJson(files)) };
  const output = { ...result, buildHash: sha256(canonicalJson(result)), publicDir };
  const buildAuthority = Object.freeze({ schemaVersion: 1, authorityId: randomUUID() });
  BUILD_AUTHORITIES.set(buildAuthority, { buildHash: output.buildHash, packageHash: output.packageHash, artifactHash: output.artifactHash });
  return { ...output, buildAuthority };
}

export async function assertRuntimeBuild(output, authority) {
  const sealed = BUILD_AUTHORITIES.get(authority);
  if (!sealed || authority?.schemaVersion !== 1 || sealed.buildHash !== output?.buildHash || sealed.packageHash !== output?.packageHash || sealed.artifactHash !== output?.artifactHash) throw new RuntimeBundleError('runtime build authority mismatch');
  if (output.artifactHash !== sha256(canonicalJson(output.files)) || output.buildHash !== sha256(canonicalJson({ schemaVersion: output.schemaVersion, packageHash: output.packageHash, entrySymbol: output.entrySymbol, files: output.files, artifactHash: output.artifactHash }))) throw new RuntimeBundleError('runtime build artifact seal drift');
  if (!path.isAbsolute(output.publicDir ?? '')) throw new RuntimeBundleError('runtime build output directory missing');
  const names = ['bundle.js', 'bundle.css', 'index.html'];
  if (canonicalJson((await fs.readdir(output.publicDir)).sort()) !== canonicalJson(names.slice().sort())) throw new RuntimeBundleError('runtime build output inventory drift');
  for (const name of names) {
    const expected = output.files?.[name];
    const bytes = await fs.readFile(path.join(output.publicDir, name));
    if (!Number.isInteger(expected?.bytes) || expected.bytes <= 0 || expected.bytes !== bytes.length || expected.sha256 !== sha256(bytes)) throw new RuntimeBundleError(`runtime build artifact ${name} drift`);
  }
  return true;
}

function validatePackage(output, editorAuthority) {
  if (output?.schemaVersion !== 1 || !output.files || typeof output.files !== 'object' || !output.manifest || !output.sourceMap) throw new RuntimeBundleError('sealed emission package missing');
  try { selectSource(output, editorAuthority, output.rootId); }
  catch (error) { throw new RuntimeBundleError(`P5 package authority refused: ${error.message}`); }
  for (const [name, content] of Object.entries(output.files)) if (!safePath(name) || typeof content !== 'string') throw new RuntimeBundleError(`unsafe runtime package entry ${name}`);
  try {
    const parsedManifest = JSON.parse(output.files['manifest.json']);
    const parsedSourceMap = JSON.parse(output.files['source-map.json']);
    if (canonicalJson(parsedManifest) !== canonicalJson(output.manifest) || canonicalJson(parsedSourceMap) !== canonicalJson(output.sourceMap)) throw new Error('persisted metadata drift');
    const inventory = Object.fromEntries(Object.entries(output.files).filter(([name]) => name !== 'manifest.json').sort().map(([name, content]) => [name, { sha256: sha256(content), bytes: Buffer.byteLength(content) }]));
    if (canonicalJson(inventory) !== canonicalJson(output.manifest.files)) throw new Error('manifest inventory drift');
  } catch (error) { throw new RuntimeBundleError(`emission package integrity refused: ${error.message}`); }
}

function confined(root, relative) {
  if (!safePath(relative)) throw new RuntimeBundleError(`unsafe runtime package path ${relative}`);
  const target = path.resolve(root, relative);
  if (!target.startsWith(path.resolve(root) + path.sep)) throw new RuntimeBundleError(`runtime package path escapes: ${relative}`);
  return target;
}

const safePath = (value) => typeof value === 'string' && value.length > 0 && !value.includes('\\') && !value.startsWith('/') && !value.split('/').some((part) => !part || part === '.' || part === '..');
