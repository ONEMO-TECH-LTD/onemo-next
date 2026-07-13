#!/usr/bin/env node
/**
 * compiler-v2 · P0.4 calibration harness (C11 v3 §13.3) — REWORKED per Meta 4b9ad2a items 6–7.
 * Produces SYNCHRONIZED Figma/build pairs (file version checked before/after; unstable pair
 * discarded) plus a build↔build repeat for the renderer noise floor. Screen-agnostic: frame
 * dimensions come from the Figma node itself; no user-absolute paths; every HTTP call is
 * status-checked; the declared theme is stamped AND verified on the route; the build commit
 * and captured-artifact hashes are recorded; dimension-mismatched pairs FAIL (no min-crop
 * false-greens); alpha compositing is explicit (both images composited onto opaque white
 * before compare). Output remains draft evidence only until P0 budget acceptance.
 *
 * usage: node compiler-v2/tools/calibrate.mjs <fileKey> <nodeId> <routeUrl> <outDir> [--theme light]
 * env:   FIGMA_TOKEN (or repo .env.local at <repoRoot>/.env.local); FTC_CHROME optional.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOL = path.resolve(HERE, '../..');            // figma-code-converter/
const REPO = path.resolve(TOOL, '..');               // app repo root (worktree)
const [, , FK, NODE, ROUTE, OUT, ...rest] = process.argv;
if (!FK || !NODE || !ROUTE || !OUT) { console.error('usage: calibrate.mjs <fileKey> <nodeId> <routeUrl> <outDir> [--theme light]'); process.exit(2); }
const THEME = rest[rest.indexOf('--theme') + 1] && rest.includes('--theme') ? rest[rest.indexOf('--theme') + 1] : 'light';
mkdirSync(OUT, { recursive: true });

const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');

// token: process env first, else the repo's own .env.local (relative to the worktree, never a user-absolute path)
function figmaToken() {
  if (process.env.FIGMA_TOKEN) return process.env.FIGMA_TOKEN;
  const envFile = path.join(REPO, '.env.local');
  if (existsSync(envFile)) {
    const line = readFileSync(envFile, 'utf8').split('\n').find((l) => l.startsWith('FIGMA_TOKEN='));
    if (line) return line.slice('FIGMA_TOKEN='.length).trim();
  }
  throw new Error('FIGMA_TOKEN not set (env or <repo>/.env.local)');
}
const H = { 'X-Figma-Token': figmaToken() };

async function api(url) {
  const r = await fetch(url, { headers: H });
  if (!r.ok) throw new Error(`Figma API ${r.status} for ${url.slice(0, 80)}…`);
  return r;
}
const version = async () => (await (await api(`https://api.figma.com/v1/files/${FK}?depth=1`)).json()).version;

/** frame dimensions from the node itself — no screen hardcodes */
async function frameDims() {
  const j = await (await api(`https://api.figma.com/v1/files/${FK}/nodes?ids=${NODE}`)).json();
  const b = j.nodes?.[NODE]?.document?.absoluteBoundingBox;
  if (!b?.width || !b?.height) throw new Error(`node ${NODE} has no bounding box`);
  return { w: Math.round(b.width), h: Math.round(b.height) };
}

async function figmaRender(file) {
  const j = await (await api(`https://api.figma.com/v1/images/${FK}?ids=${NODE}&scale=2&format=png`)).json();
  const url = j.images?.[NODE];
  if (!url) throw new Error('figma render unavailable');
  const img = await fetch(url);
  if (!img.ok) throw new Error(`figma render download ${img.status}`);
  writeFileSync(file, Buffer.from(await img.arrayBuffer()));
}

const CHROME = process.env.FTC_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PW = [process.env.FTC_PLAYWRIGHT, '/opt/homebrew/lib/node_modules/@playwright/test/node_modules/playwright/index.mjs', '/opt/homebrew/lib/node_modules/playwright/index.mjs'].filter(Boolean).find(existsSync);
if (!PW) { console.error('calibrate: no playwright module found — set FTC_PLAYWRIGHT'); process.exit(1); }

/** capture the route at exact dims with the declared theme stamped AND verified */
async function captureRoute(file, w, h) {
  const { chromium } = await import(PW);
  const browser = await chromium.launch({ executablePath: CHROME });
  try {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    const resp = await page.goto(ROUTE, { waitUntil: 'load', timeout: 45000 });
    if (!resp || !resp.ok()) throw new Error(`route ${ROUTE} returned HTTP ${resp ? resp.status() : 'no-response'}`);
    await page.evaluate((t) => { document.documentElement.setAttribute('data-theme', t); }, THEME);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1200);
    const applied = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    if (applied !== THEME) throw new Error(`theme not applied: wanted ${THEME}, got ${applied}`);
    await page.screenshot({ path: file });
  } finally { await browser.close(); }
}

/** canvas diff — dimension mismatch FAILS; both sides composited onto opaque white first */
async function diffPair(aPng, bPng) {
  const { chromium } = await import(PW);
  const browser = await chromium.launch({ executablePath: CHROME });
  try {
    const page = await browser.newPage();
    const dataUrl = (f) => `data:image/png;base64,${readFileSync(f).toString('base64')}`;
    const result = await page.evaluate(async ([a, b]) => {
      const load = (s) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = s; });
      const [A, B] = await Promise.all([load(a), load(b)]);
      if (A.width !== B.width || A.height !== B.height) {
        return { dimensionMismatch: { a: [A.width, A.height], b: [B.width, B.height] } };
      }
      const draw = (img) => {
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const x = c.getContext('2d');
        x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height); // explicit alpha law: composite on opaque white
        x.drawImage(img, 0, 0);
        return x.getImageData(0, 0, c.width, c.height).data;
      };
      const da = draw(A), db = draw(B);
      let n = 0, over2 = 0, over32 = 0, sum = 0;
      for (let i = 0; i < da.length; i += 4) {
        const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
        n++; sum += d; if (d > 2) over2++; if (d > 32) over32++;
      }
      return { W: A.width, H: A.height, changedPct_t2: over2 / n * 100, changedPct_t32: over32 / n * 100, meanDelta: sum / n };
    }, [dataUrl(aPng), dataUrl(bPng)]);
    if (result.dimensionMismatch) throw new Error(`dimension mismatch — pair FAILS (no min-crop): ${JSON.stringify(result.dimensionMismatch)}`);
    return result;
  } finally { await browser.close(); }
}

const round = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v * 1000) / 1000 : v]));

(async () => {
  const buildCommit = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  // stage into a candidate dir; final artifacts are promoted ATOMICALLY only after version
  // stability is confirmed — an UNSTABLE run leaves prior outputs untouched (Meta finding).
  const staging = path.join(OUT, `.candidate-${buildCommit.slice(0, 8)}`);
  execFileSync('rm', ['-rf', staging]); mkdirSync(staging, { recursive: true });
  let ok = false;
  try {
    const v0 = await version();
    const dims = await frameDims();
    const figmaPng = path.join(staging, 'cal-figma.png');
    const buildA = path.join(staging, 'cal-build-a.png');
    const buildB = path.join(staging, 'cal-build-b.png');
    await figmaRender(figmaPng);
    await captureRoute(buildA, dims.w, dims.h);
    await captureRoute(buildB, dims.w, dims.h); // immediate repeat → renderer/capture noise floor
    const v1 = await version();
    if (v0 !== v1) throw new Error(`UNSTABLE: file version moved ${v0} → ${v1}; candidate discarded, prior outputs untouched`);

    const draft = {
      schemaVersion: 1,
      kind: 'calibration-draft',
      fileKey: FK, nodeId: NODE, fileVersion: v0, frame: dims,
      buildCommit,
      artifacts: { figma: sha(figmaPng), buildA: sha(buildA), buildB: sha(buildB) },
      environment: {
        capture: 'playwright system-chrome dpr2', viewport: `${dims.w}x${dims.h}`,
        theme: `${THEME} (stamped + verified on documentElement)`,
        alpha: 'both sides composited onto opaque #ffffff before compare',
        figmaExport: 'REST png scale=2 (color profile unpinned — owed)',
      },
      samples: {
        noiseFloor_buildRepeat: { n: 1, ...round(await diffPair(buildA, buildB)) },
        fidelity_figmaVsBuild: { n: 1, ...round(await diffPair(figmaPng, buildA)) },
      },
      honesty: [
        'DRAFT EVIDENCE ONLY — no budget is normative until P0 calibration acceptance (QA/Meta/Dan)',
        'n=1 per class; distributions, per-class regions, DeltaE, SSIM, known-broken runs OWED',
        'legacy-lane build — v2 packages recalibrate at P6',
      ],
    };
    writeFileSync(path.join(staging, 'calibration-draft.json'), JSON.stringify(draft, null, 1));
    // ATOMIC promote: only now, after version stability + diffs, do the final artifacts move in.
    for (const f of ['cal-figma.png', 'cal-build-a.png', 'cal-build-b.png', 'calibration-draft.json']) {
      execFileSync('mv', ['-f', path.join(staging, f), path.join(OUT, f)]);
    }
    ok = true;
    console.log(JSON.stringify({ frame: dims, buildCommit: buildCommit.slice(0, 8), samples: draft.samples }, null, 1));
  } finally {
    execFileSync('rm', ['-rf', staging]); // clean every failure; prior OUT artifacts untouched unless promoted
  }
  if (!ok) process.exit(1);
})().catch((e) => { console.error(`calibrate: ${e.message}`); process.exit(1); });
