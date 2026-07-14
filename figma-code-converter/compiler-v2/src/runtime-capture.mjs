/** P6 browser runtime capture for one deterministic production bundle. */
import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { canonicalJson, sha256 } from './evidence.mjs';

export class RuntimeCaptureError extends Error {
  constructor(message) { super(message); this.state = 'FAILED_RUNTIME'; }
}

export async function captureRuntimeState({ chromium, chromePath, bundle, modeContextPlan, tokenPlan, requiredState, reference = null, metricRegions = {} }) {
  if (!chromium?.launch || !bundle?.publicDir || !requiredState?.id) throw new RuntimeCaptureError('runtime capture inputs missing');
  return withServer(bundle.publicDir, async (url) => {
    const browser = await chromium.launch({ executablePath: chromePath, headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: requiredState.viewport.width, height: requiredState.viewport.height }, deviceScaleFactor: requiredState.viewport.dpr });
      const consoleErrors = [], runtimeErrors = [], networkRequests = [];
      page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
      page.on('pageerror', (error) => runtimeErrors.push(error.message));
      page.on('request', (request) => { if (!request.url().startsWith(url)) networkRequests.push(request.url()); });
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
      if (!response?.ok()) runtimeErrors.push(`runtime route HTTP ${response?.status() ?? 'no-response'}`);
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
      const environment = await page.evaluate(() => ({ userAgent: navigator.userAgent, locale: navigator.language, fontsReady: document.fonts.status === 'loaded' }));
      environment.browser = await browser.version();
      environment.viewport = structuredClone(requiredState.viewport);
      const bytes = await page.screenshot({ type: 'png', fullPage: false });
      const image = await sharp(bytes).metadata();
      const runtime = {
        id: requiredState.id,
        rootId: requiredState.rootId,
        viewport: structuredClone(requiredState.viewport),
        collectionModes: structuredClone(requiredState.collectionModes),
        packageHash: bundle.packageHash,
        contexts,
        bindings,
        consoleErrors,
        networkRequests,
        runtimeErrors,
        environment,
        environmentId: sha256(canonicalJson(environment)),
        screenshot: { sha256: sha256(bytes), width: image.width, height: image.height },
        reference: reference ? { ...reference.metadata, sha256: sha256(reference.bytes), width: (await sharp(reference.bytes).metadata()).width, height: (await sharp(reference.bytes).metadata()).height } : null,
        metrics: reference ? await measureRegions(bytes, reference.bytes, metricRegions) : {},
      };
      const expectedRoot = modeContextPlan.nodes.find((row) => row.nodeId === requiredState.rootId)?.modeContextId;
      if (contexts[requiredState.rootId] !== expectedRoot) runtime.runtimeErrors.push('root runtime context differs from ModeContextPlan');
      const rootModes = parseContext(expectedRoot);
      for (const [key, mode] of Object.entries(requiredState.collectionModes)) if (rootModes[key] !== mode) runtime.runtimeErrors.push(`requested root mode ${key}=${mode} is not emitted`);
      return { runtime, screenshotBytes: bytes };
    } finally { await browser.close(); }
  });
}

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
