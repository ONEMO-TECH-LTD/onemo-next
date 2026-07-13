#!/usr/bin/env node
/**
 * compiler-v2 · P0.4 calibration harness (C11 v3 §13.3).
 * Produces SYNCHRONIZED Figma/build pairs (file version checked before/after — an unstable
 * version discards the pair) plus a build↔build repeat capture for the renderer noise floor.
 * Emits calibration-draft.json with honest sample sizes. Uses ONLY legacy capture tooling +
 * Playwright canvas diff — no dependency on the compiler-v2 foundation under review.
 *
 * usage: node compiler-v2/tools/calibrate.mjs <fileKey> <nodeId> <routeUrl> <outDir>
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOL = path.resolve(HERE, '../..'); // figma-code-converter/
const [, , FK, NODE, ROUTE, OUT] = process.argv;
if (!FK || !NODE || !ROUTE || !OUT) { console.error('usage: calibrate.mjs <fileKey> <nodeId> <routeUrl> <outDir>'); process.exit(2); }
mkdirSync(OUT, { recursive: true });

const env = Object.fromEntries(readFileSync('/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.env.local', 'utf8')
  .split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const H = { 'X-Figma-Token': env.FIGMA_TOKEN };

const version = async () => (await (await fetch(`https://api.figma.com/v1/files/${FK}?depth=1`, { headers: H })).json()).version;

async function figmaRender(file) {
  const j = await (await fetch(`https://api.figma.com/v1/images/${FK}?ids=${NODE}&scale=2&format=png`, { headers: H })).json();
  const url = j.images?.[NODE];
  if (!url) throw new Error('figma render unavailable');
  writeFileSync(file, Buffer.from(await (await fetch(url)).arrayBuffer()));
}

const capture = (file, w, h) =>
  execFileSync(process.execPath, [path.join(TOOL, 'audit/capture.mjs'), ROUTE, file, String(w), String(h)], { stdio: 'pipe' });

/** canvas diff via headless chrome — same mechanics class as the legacy gate, run per pair. */
async function diffPair(aPng, bPng) {
  const PW = ['/opt/homebrew/lib/node_modules/@playwright/test/node_modules/playwright/index.mjs', '/opt/homebrew/lib/node_modules/playwright/index.mjs'].find(existsSync);
  const { chromium } = await import(PW);
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage();
  const dataUrl = (f) => `data:image/png;base64,${readFileSync(f).toString('base64')}`;
  const result = await page.evaluate(async ([a, b]) => {
    const load = (s) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = s; });
    const [A, B] = await Promise.all([load(a), load(b)]);
    const W = Math.min(A.width, B.width), H = Math.min(A.height, B.height);
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    x.drawImage(A, 0, 0); const da = x.getImageData(0, 0, W, H).data;
    x.clearRect(0, 0, W, H); x.drawImage(B, 0, 0); const db = x.getImageData(0, 0, W, H).data;
    let n = 0, over2 = 0, over32 = 0, sum = 0;
    for (let i = 0; i < W * H * 4; i += 4) {
      const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
      n++; sum += d; if (d > 2) over2++; if (d > 32) over32++;
    }
    return { W, H, changedPct_t2: over2 / n * 100, changedPct_t32: over32 / n * 100, meanDelta: sum / n };
  }, [dataUrl(aPng), dataUrl(bPng)]);
  await browser.close();
  return result;
}

const round = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v * 1000) / 1000 : v]));

(async () => {
  const v0 = await version();
  const figmaPng = path.join(OUT, 'cal-figma.png');
  const buildA = path.join(OUT, 'cal-build-a.png');
  const buildB = path.join(OUT, 'cal-build-b.png');
  await figmaRender(figmaPng);
  capture(buildA, 402, 874);
  capture(buildB, 402, 874); // immediate repeat → renderer/capture noise floor
  const v1 = await version();
  if (v0 !== v1) { console.error(`UNSTABLE: file version moved ${v0} → ${v1}; pair discarded`); process.exit(1); }

  const draft = {
    schemaVersion: 1,
    kind: 'calibration-draft',
    fileKey: FK, nodeId: NODE, fileVersion: v0,
    environment: { capture: 'playwright system-chrome dpr2', viewport: '402x874', theme: 'data-theme=light', figmaExport: 'REST png scale=2 (color profile unpinned — owed)' },
    samples: {
      noiseFloor_buildRepeat: { n: 1, ...round(await diffPair(buildA, buildB)) },
      fidelity_figmaVsBuild: { n: 1, ...round(await diffPair(figmaPng, buildA)) },
    },
    honesty: [
      'n=1 per class — distributions, per-class regions (text/vector/raster), DeltaE, SSIM, and known-broken mutation runs OWED before any budget becomes normative',
      'legacy-lane build (nine truth-fixes) — v2 packages recalibrate at P6',
      'whole-frame metrics only; class segmentation requires region maps from the v2 source map',
    ],
  };
  writeFileSync(path.join(OUT, 'calibration-draft.json'), JSON.stringify(draft, null, 1));
  console.log(JSON.stringify(draft.samples, null, 1));
})();
