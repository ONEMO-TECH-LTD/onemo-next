/** P6 browser runtime capture for one deterministic production bundle. */
import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { canonicalJson, sha256 } from './evidence.mjs';
import { assertRuntimeBuild } from './runtime-bundle.mjs';

const CAPTURE_AUTHORITIES = new WeakMap();
const ENVIRONMENT_AUTHORITIES = new WeakMap();
const HASH = /^[0-9a-f]{64}$/;
const FONT_ROOTS = ['/System/Library/Fonts', '/Library/Fonts', path.join(os.homedir(), 'Library/Fonts')];

export class RuntimeCaptureError extends Error {
  constructor(message) { super(message); this.state = 'FAILED_RUNTIME'; }
}

export async function createMicrofixtureEnvironmentAuthority({ environmentManifest, chromePath }) {
  if (environmentManifest?.evidenceClass !== 'microfixture') throw new RuntimeCaptureError('integration environment approval is unavailable before P0');
  const environmentManifestHash = await verifyEnvironmentManifest(environmentManifest, chromePath);
  const authority = Object.freeze({ schemaVersion: 1, evidenceClass: 'microfixture' });
  ENVIRONMENT_AUTHORITIES.set(authority, environmentManifestHash);
  return authority;
}

export async function captureRuntimeState({ chromium, chromePath, bundle, buildAuthority = bundle?.buildAuthority, modeContextPlan, tokenPlan, requiredState, fidelityBudgets, environmentManifest, environmentAuthority, reference = null, metricRegions = {} }) {
  if (!chromium?.launch || !bundle?.publicDir || !requiredState?.id || !fidelityBudgets || !environmentManifest || !environmentAuthority) throw new RuntimeCaptureError('runtime capture inputs missing');
  await assertRuntimeBuild(bundle, buildAuthority);
  const declaredEnvironmentHash = sha256(canonicalJson(environmentManifest));
  if (fidelityBudgets.environmentManifestHash !== declaredEnvironmentHash || ENVIRONMENT_AUTHORITIES.get(environmentAuthority) !== declaredEnvironmentHash) throw new RuntimeCaptureError('runtime environment manifest lacks its approved authority');
  const environmentManifestHash = await verifyEnvironmentManifest(environmentManifest, chromePath);
  assertReferenceEnvironment(requiredState.reference, environmentManifest);
  return withServer(bundle.publicDir, async (url) => {
    const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--force-color-profile=srgb'] });
    try {
      if (await browser.version() !== environmentManifest.browser.version) throw new RuntimeCaptureError('runtime browser version differs from environment manifest');
      const page = await browser.newPage({
        viewport: { width: requiredState.viewport.width, height: requiredState.viewport.height },
        deviceScaleFactor: requiredState.viewport.dpr,
        locale: environmentManifest.render.locale,
        reducedMotion: environmentManifest.render.reducedMotion,
      });
      await page.addInitScript(({ stableTimeMs }) => {
        const NativeDate = Date;
        globalThis.Date = class extends NativeDate {
          constructor(...args) { super(...(args.length ? args : [stableTimeMs])); }
          static now() { return stableTimeMs; }
        };
      }, { stableTimeMs: environmentManifest.render.stableTimeMs });
      const consoleErrors = [], runtimeErrors = [], networkRequests = [];
      page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
      page.on('pageerror', (error) => runtimeErrors.push(error.message));
      page.on('request', (request) => { if (!request.url().startsWith(url)) networkRequests.push(request.url()); });
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
      if (!response?.ok()) runtimeErrors.push(`runtime route HTTP ${response?.status() ?? 'no-response'}`);
      await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
      await page.evaluate(async () => { await Promise.all([...document.images].map((image) => image.decode?.().catch(() => undefined))); });
      await page.evaluate(() => document.fonts.ready);
      const contexts = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-figma-id]')].map((element) => {
        const boundary = element.closest('[data-mode-context]');
        return [element.getAttribute('data-figma-id'), boundary?.getAttribute('data-mode-context') ?? null];
      })));
      const bindings = await page.evaluate(({ bindings: requestedBindings, channels }) => {
        const out = {};
        for (const binding of requestedBindings) {
          const node = document.querySelector(`[data-figma-id=${JSON.stringify(binding.source.nodeId)}]`);
          if (!node) { out[binding.bindingId] = { error: 'source node missing' }; continue; }
          const channel = channels[binding.channelId];
          let resolvedValue;
          if (binding.target === 'css') resolvedValue = getComputedStyle(node).getPropertyValue(channel.cssName).trim();
          else if (binding.source.propertyPath === '/characters') resolvedValue = node.textContent;
          else if (binding.source.propertyPath.startsWith('/componentProperties/')) {
            const property = binding.source.propertyPath.slice('/componentProperties/'.length).replace(/~1/g, '/').replace(/~0/g, '~');
            const carrier = node.querySelector('[data-figma-component-props]');
            resolvedValue = carrier ? JSON.parse(carrier.getAttribute('data-figma-component-props'))[property] : undefined;
          } else if (binding.source.propertyPath === '/visible') resolvedValue = getComputedStyle(node).display !== 'none';
          else out[binding.bindingId] = { error: `unsupported React runtime carrier ${binding.source.propertyPath}` };
          if (!out[binding.bindingId]) out[binding.bindingId] = { channelId: binding.channelId, modeContextId: binding.modeContextId, target: binding.target, resolvedValue };
        }
        return out;
      }, { bindings: tokenPlan.bindings, channels: channelIndex(tokenPlan.registry) });
      const environment = await page.evaluate(() => ({
        browserVersion: null,
        userAgent: navigator.userAgent,
        locale: navigator.language,
        direction: getComputedStyle(document.documentElement).direction,
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduce' : 'no-preference',
        fontsReady: document.fonts.status === 'loaded',
        imagesDecoded: [...document.images].every((image) => image.complete && image.naturalWidth > 0),
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        stableTimeMs: Date.now(),
        animationsDisabled: [...document.querySelectorAll('*')].every((element) => getComputedStyle(element).animationName === 'none'),
        transitionsDisabled: [...document.querySelectorAll('*')].every((element) => getComputedStyle(element).transitionDuration === '0s'),
        deviceScaleFactor: devicePixelRatio,
        fontFamilies: [...new Set([...document.querySelectorAll('[data-figma-id]')].map((element) => getComputedStyle(element).fontFamily).filter(Boolean))].sort(),
      }));
      environment.browserVersion = await browser.version();
      environment.viewport = structuredClone(requiredState.viewport);
      assertObservedEnvironment(environment, environmentManifest, requiredState.viewport);
      const bytes = await page.screenshot({ type: 'png', fullPage: false });
      const image = await sharp(bytes).metadata();
      const referenceImage = reference ? await sharp(reference.bytes).metadata() : null;
      const runtime = {
        id: requiredState.id,
        rootId: requiredState.rootId,
        viewport: structuredClone(requiredState.viewport),
        collectionModes: structuredClone(requiredState.collectionModes),
        packageHash: bundle.packageHash,
        buildHash: bundle.buildHash,
        contexts,
        bindings,
        consoleErrors,
        networkRequests,
        runtimeErrors,
        environment,
        environmentManifestHash,
        screenshot: { sha256: sha256(bytes), width: image.width, height: image.height, colorProfile: image.space },
        reference: reference ? { ...reference.metadata, sha256: sha256(reference.bytes), width: referenceImage.width, height: referenceImage.height, decodedColorProfile: referenceImage.space } : null,
        metrics: reference ? await measureRegions(bytes, reference.bytes, metricRegions) : {},
      };
      const expectedRoot = modeContextPlan.nodes.find((row) => row.nodeId === requiredState.rootId)?.modeContextId;
      if (contexts[requiredState.rootId] !== expectedRoot) runtime.runtimeErrors.push('root runtime context differs from ModeContextPlan');
      const rootModes = parseContext(expectedRoot);
      for (const [key, mode] of Object.entries(requiredState.collectionModes)) if (rootModes[key] !== mode) runtime.runtimeErrors.push(`requested root mode ${key}=${mode} is not emitted`);
      const evidence = {
        schemaVersion: 1,
        runtime,
        screenshotBytes: bytes,
        referenceBytes: reference?.bytes ?? null,
        metricRegions: structuredClone(metricRegions),
        requiredState: structuredClone(requiredState),
        fidelityBudgets: structuredClone(fidelityBudgets),
        environmentManifest: structuredClone(environmentManifest),
        environmentAuthority,
        bundle,
        buildAuthority,
      };
      const captureAuthority = Object.freeze({ schemaVersion: 1 });
      CAPTURE_AUTHORITIES.set(captureAuthority, captureSeal(evidence));
      return { ...evidence, captureAuthority };
    } finally { await browser.close(); }
  });
}

export async function assertRuntimeCapture(evidence, authority) {
  const sealed = CAPTURE_AUTHORITIES.get(authority);
  if (!sealed || authority?.schemaVersion !== 1 || evidence?.schemaVersion !== 1) throw new RuntimeCaptureError('runtime capture authority mismatch');
  await assertRuntimeBuild(evidence.bundle, evidence.buildAuthority);
  if (sealed !== captureSeal(evidence)) throw new RuntimeCaptureError('runtime capture evidence drift');
  const { runtime, requiredState, fidelityBudgets } = evidence;
  if (runtime.buildHash !== evidence.bundle.buildHash || runtime.packageHash !== evidence.bundle.packageHash) throw new RuntimeCaptureError('runtime capture build identity drift');
  const environmentManifestHash = await verifyEnvironmentManifest(evidence.environmentManifest, evidence.environmentManifest?.browser?.executablePath);
  if (runtime.environmentManifestHash !== environmentManifestHash || fidelityBudgets.environmentManifestHash !== environmentManifestHash
    || ENVIRONMENT_AUTHORITIES.get(evidence.environmentAuthority) !== environmentManifestHash) throw new RuntimeCaptureError('runtime capture environment manifest drift');
  assertObservedEnvironment(runtime.environment, evidence.environmentManifest, requiredState.viewport);
  assertReferenceEnvironment(requiredState.reference, evidence.environmentManifest);
  const screenshot = await sharp(evidence.screenshotBytes).metadata();
  if (runtime.screenshot.sha256 !== sha256(evidence.screenshotBytes) || runtime.screenshot.width !== screenshot.width || runtime.screenshot.height !== screenshot.height || runtime.screenshot.colorProfile !== screenshot.space || screenshot.space !== evidence.environmentManifest.color.browserColorProfile) throw new RuntimeCaptureError('runtime screenshot bytes drift');
  if (requiredState.reference) {
    if (!evidence.referenceBytes || !runtime.reference) throw new RuntimeCaptureError('authored reference bytes missing');
    const reference = await sharp(evidence.referenceBytes).metadata();
    if (runtime.reference.sha256 !== sha256(evidence.referenceBytes) || runtime.reference.width !== reference.width || runtime.reference.height !== reference.height || runtime.reference.decodedColorProfile !== reference.space || reference.space !== evidence.environmentManifest.color.figmaColorProfile) throw new RuntimeCaptureError('authored reference bytes drift');
    if (canonicalJson(pickReference(runtime.reference)) !== canonicalJson(pickReference(requiredState.reference))) throw new RuntimeCaptureError('authored reference manifest drift');
    const metrics = await measureRegions(evidence.screenshotBytes, evidence.referenceBytes, evidence.metricRegions);
    if (canonicalJson(metrics) !== canonicalJson(runtime.metrics)) throw new RuntimeCaptureError('visual metric derivation drift');
  } else if (evidence.referenceBytes || runtime.reference || Object.keys(runtime.metrics).length) throw new RuntimeCaptureError('unreferenced capture carries visual claims');
  return true;
}

function captureSeal(evidence) {
  return sha256(canonicalJson({
    runtime: evidence.runtime,
    screenshotSha256: sha256(evidence.screenshotBytes),
    referenceSha256: evidence.referenceBytes ? sha256(evidence.referenceBytes) : null,
    metricRegions: evidence.metricRegions,
    requiredState: evidence.requiredState,
    fidelityBudgets: evidence.fidelityBudgets,
    environmentManifestHash: sha256(canonicalJson(evidence.environmentManifest)),
    buildHash: evidence.bundle?.buildHash,
  }));
}

async function verifyEnvironmentManifest(manifest, chromePath) {
  if (!plainObject(manifest) || manifest.schemaVersion !== 1 || !['microfixture', 'integration'].includes(manifest.evidenceClass)) throw new RuntimeCaptureError('environment manifest malformed');
  const { browser, os: operatingSystem, fonts, color, render } = manifest;
  if (!plainObject(browser) || !path.isAbsolute(browser.executablePath ?? '') || browser.executablePath !== chromePath || !HASH.test(browser.sha256 ?? '') || !browser.version || !browser.provenanceId) throw new RuntimeCaptureError('environment browser manifest malformed');
  const [declaredBrowser, actualBrowser] = await Promise.all([fs.realpath(browser.executablePath), fs.realpath(chromePath)]);
  if (declaredBrowser !== actualBrowser || sha256(await fs.readFile(actualBrowser)) !== browser.sha256) throw new RuntimeCaptureError('environment browser binary drift');
  if (!plainObject(operatingSystem) || operatingSystem.platform !== os.platform() || operatingSystem.release !== os.release() || operatingSystem.arch !== os.arch() || !operatingSystem.imageId || !operatingSystem.provenanceId
    || !path.isAbsolute(operatingSystem.receiptPath ?? '') || !HASH.test(operatingSystem.receiptSha256 ?? '') || sha256(await fs.readFile(await fs.realpath(operatingSystem.receiptPath))) !== operatingSystem.receiptSha256) throw new RuntimeCaptureError('environment OS image drift');
  if (!Array.isArray(fonts) || !fonts.length) throw new RuntimeCaptureError('environment font inventory missing');
  const fontKeys = new Set();
  for (const font of fonts) {
    if (!plainObject(font) || !font.figmaFamily || !font.figmaStyle || !font.webFamily || !font.provenanceId || !font.licenseId || !path.isAbsolute(font.filePath ?? '') || !HASH.test(font.sha256 ?? '')) throw new RuntimeCaptureError('environment font entry malformed');
    const realFont = await fs.realpath(font.filePath);
    if (!FONT_ROOTS.some((root) => within(root, realFont)) || sha256(await fs.readFile(realFont)) !== font.sha256) throw new RuntimeCaptureError('environment font file drift');
    const key = `${font.figmaFamily}\u0000${font.figmaStyle}`;
    if (fontKeys.has(key)) throw new RuntimeCaptureError('environment font mapping duplicate');
    fontKeys.add(key);
  }
  if (!plainObject(color) || color.figmaExportScale <= 0 || color.figmaColorProfile !== 'srgb' || color.browserColorProfile !== 'srgb') throw new RuntimeCaptureError('environment color profile malformed');
  if (!plainObject(render) || !Number.isSafeInteger(render.stableTimeMs) || render.stableTimeMs < 0 || render.animations !== 'disabled' || render.transitions !== 'disabled'
    || render.imageDecoding !== 'complete' || render.fontReadiness !== 'ready' || !render.backgroundColor || !render.locale || !['ltr', 'rtl'].includes(render.direction)
    || !['reduce', 'no-preference'].includes(render.reducedMotion)) throw new RuntimeCaptureError('environment render settings malformed');
  return sha256(canonicalJson(manifest));
}

function assertObservedEnvironment(observed, manifest, viewport) {
  const render = manifest.render;
  const webFonts = new Set(manifest.fonts.map((font) => font.webFamily));
  if (!plainObject(observed) || observed.browserVersion !== manifest.browser.version || observed.locale !== render.locale || observed.direction !== render.direction
    || observed.reducedMotion !== render.reducedMotion || observed.fontsReady !== true || observed.imagesDecoded !== true || observed.backgroundColor !== render.backgroundColor
    || observed.stableTimeMs !== render.stableTimeMs || observed.animationsDisabled !== true || observed.transitionsDisabled !== true
    || observed.deviceScaleFactor !== viewport.dpr || canonicalJson(observed.viewport) !== canonicalJson(viewport) || !Array.isArray(observed.fontFamilies)
    || !observed.fontFamilies.every((family) => family.split(',').map((part) => part.trim().replace(/^['"]|['"]$/g, '')).some((name) => webFonts.has(name)))) throw new RuntimeCaptureError(`observed runtime environment differs from manifest: ${canonicalJson(observed)}`);
}

function assertReferenceEnvironment(reference, manifest) {
  if (!reference) return;
  if (reference.exportScale !== manifest.color.figmaExportScale || reference.colorProfile !== manifest.color.figmaColorProfile) throw new RuntimeCaptureError('reference export environment differs from manifest');
}

const plainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const within = (root, candidate) => candidate === root || candidate.startsWith(`${root}${path.sep}`);

async function measureRegions(actualBytes, referenceBytes, regions) {
  const actualMeta = await sharp(actualBytes).metadata();
  const referenceMeta = await sharp(referenceBytes).metadata();
  if (actualMeta.width !== referenceMeta.width || actualMeta.height !== referenceMeta.height) throw new RuntimeCaptureError('visual reference dimensions differ');
  const entries = Object.entries(regions);
  if (!entries.length) throw new RuntimeCaptureError('visual metric regions missing');
  const out = {};
  for (const [kind, region] of entries) {
    const actual = region ? sharp(actualBytes).flatten({ background: '#ffffff' }).extract(region) : sharp(actualBytes).flatten({ background: '#ffffff' });
    const reference = region ? sharp(referenceBytes).flatten({ background: '#ffffff' }).extract(region) : sharp(referenceBytes).flatten({ background: '#ffffff' });
    const a = await actual.removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const b = await reference.removeAlpha().raw().toBuffer({ resolveWithObject: true });
    if (a.data.length !== b.data.length) throw new RuntimeCaptureError(`visual region ${kind} differs in size`);
    let changed = 0, delta = 0;
    for (let index = 0; index < a.data.length; index += a.info.channels) {
      const difference = Math.max(Math.abs(a.data[index] - b.data[index]), Math.abs(a.data[index + 1] - b.data[index + 1]), Math.abs(a.data[index + 2] - b.data[index + 2]));
      if (difference > 2) changed++;
      delta += difference;
    }
    const pixels = a.data.length / a.info.channels;
    out[kind] = { changedPct: changed / pixels * 100, meanDelta: delta / pixels };
  }
  return out;
}

async function withServer(root, run) {
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://runtime.local').pathname;
      if (pathname === '/favicon.ico') { response.writeHead(204).end(); return; }
      const name = pathname === '/' ? 'index.html' : pathname.slice(1);
      if (!['index.html', 'bundle.js', 'bundle.css'].includes(name)) { response.writeHead(404).end(); return; }
      const bytes = await fs.readFile(path.join(root, name));
      response.writeHead(200, { 'content-type': name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html', 'cache-control': 'no-store' });
      response.end(bytes);
    } catch { response.writeHead(500).end(); }
  });
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', (error) => error ? reject(error) : resolve()));
  try { return await run(`http://127.0.0.1:${server.address().port}/`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

function channelIndex(registry) {
  const out = {};
  for (const entry of Object.values(registry.entries ?? {})) for (const channel of Object.values(entry.channels ?? {})) out[channel.channelId] = channel;
  return out;
}

const parseContext = (id) => id === 'ø' ? {} : Object.fromEntries(String(id).split(',').map((part) => { const split = part.indexOf('='); return [part.slice(0, split), part.slice(split + 1)]; }));
const pickReference = (row) => ({ kind: row.kind, fileKey: row.fileKey, version: row.version, rootId: row.rootId, manifestHash: row.manifestHash ?? null, captureId: row.captureId ?? null, exportScale: row.exportScale, colorProfile: row.colorProfile });
