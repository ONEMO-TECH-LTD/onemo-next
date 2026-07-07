// Field-level pixel fidelity gate (E8, KAI-9383) — built on the expert's visual-diff /
// fidelity-gate method (tools/figma-to-code/audit/, s58 figma-to-code lane): per-pixel
// max-channel delta, Δ>32/255 = mismatch (tolerant of font-AA engine differences),
// Δ>16 = warn, heatmap artifact + numeric budget, exit 1 over budget.
//
// What it compares: CROPPED FIELD RENDERS — Figma's real inspector field (reference PNGs
// captured from Dan's authenticated Figma tab at dpr2, stored in audit/figma-refs/) vs the
// SAME field rendered by our build (Playwright clip at deviceScaleFactor 2, same CSS size,
// same displayed value staged first). Pixel-for-pixel, field-for-field — "do the resizing
// inputs fully match figma" answered in pixels, not adjectives.
//
// FAIL-CLOSED LAW (expert): a field listed in the manifest with no reference PNG is a
// FAILURE, not a skip. Coverage is printed; nothing is silently dropped.
//
// usage: node editor-engine/audit/field-pixel-fidelity.mjs [--url http://localhost:3025/react-figma]
//        [--out /tmp/e8-pixel] [--budget 12]
//   refs: editor-engine/audit/figma-refs/<key>.png  + manifest.json (captured by
//         capture-figma-field-refs helper — see audit/figma-refs/README.md)
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REFS = path.join(HERE, 'figma-refs');
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const URL_ = flag('--url', 'http://localhost:3025/react-figma');
const OUT = flag('--out', '/tmp/e8-pixel');
// Budget: the expert's default text-AA floor is 10% for full screens; small field crops are
// text-dense so AA deltas weigh more — 12% is the floor measured on a known-good field; a
// structural miss (wrong bg, wrong glyph, clipped value) measures FAR above it.
const BUDGET = parseFloat(flag('--budget', '12'));
mkdirSync(OUT, { recursive: true });

const PW_CANDIDATES = [
  process.env.FTC_PLAYWRIGHT,
  '/opt/homebrew/lib/node_modules/@playwright/test/node_modules/playwright/index.mjs',
  '/opt/homebrew/lib/node_modules/playwright/index.mjs',
].filter(Boolean);
const CHROME = process.env.FTC_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const pwPath = PW_CANDIDATES.find((p) => existsSync(p));
if (!pwPath) { console.error('pixel-fidelity: no playwright module — set FTC_PLAYWRIGHT'); process.exit(1); }
const { chromium } = await import(pwPath);

// ── manifest: which Figma fields are pixel-gated, and how to reproduce each in the build ──
// stage: overrides to apply so the build DISPLAYS the same value the reference shows.
// selector: our field's container (the FigmaField root around the aria-labeled input).
if (!existsSync(path.join(REFS, 'manifest.json'))) {
  console.error(`pixel-fidelity: FAIL-CLOSED — no reference manifest at ${REFS}/manifest.json.`);
  console.error('Capture references first (audit/figma-refs/README.md). Missing oracle = red, never skip.');
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(path.join(REFS, 'manifest.json'), 'utf8'));

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1728, height: 1080 }, deviceScaleFactor: 2 });
await page.goto(URL_, { waitUntil: 'load', timeout: 45000 });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(800);
await page.evaluate(() => {
  document.querySelector('iframe')?.contentDocument?.querySelector('[data-src]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await page.waitForTimeout(500);

const results = [];
for (const f of manifest.fields) {
  const refPng = path.join(REFS, `${f.key}.png`);
  if (!existsSync(refPng)) { results.push({ key: f.key, pass: false, note: 'reference PNG missing (fail-closed)' }); continue; }
  // stage the mode label to the reference's state (e.g. Figma's W shows 'Fill')
  if (f.modeOption) {
    const modeBtn = page.locator(`button[aria-label="${f.aria} mode"]`);
    if (await modeBtn.count()) {
      await modeBtn.click(); await page.waitForTimeout(250);
      await page.locator('button[role="menuitemradio"]').filter({ hasText: f.modeOption }).first().click().catch(() => {});
      await page.waitForTimeout(250);
    }
  }
  // stage the displayed value to match the reference
  if (f.type) {
    await page.evaluate(({ aria, text }) => {
      const el = document.querySelector(`input[aria-label="${aria}"]`);
      if (!el) return;
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      set.call(el, text);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, { aria: f.aria, text: f.type });
    await page.waitForTimeout(120);
  }
  const el = page.locator(`input[aria-label="${f.aria}"]`).locator('xpath=ancestor::div[1]');
  if ((await el.count()) === 0) { results.push({ key: f.key, pass: false, note: 'build field not found' }); continue; }
  const ourPng = path.join(OUT, `our-${f.key}.png`);
  // park the pointer away first — hover reveals the ⬡ picker cell, which is NOT the rest state.
  // A real move is not enough: when the mode menu unmounts under the pointer, Chrome fires no
  // boundary event and React's hover state sticks — dispatch the mouseout explicitly.
  await page.mouse.move(4, 600); await page.waitForTimeout(150);
  await page.evaluate((aria) => {
    const root = document.querySelector(`input[aria-label="${aria}"]`)?.closest('div');
    root?.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
  }, f.aria);
  await page.waitForTimeout(150);
  await el.first().screenshot({ path: ourPng });
  results.push({ key: f.key, ref: refPng, our: ourPng });
  // un-stage typed draft (Escape reverts)
  if (f.type) { await page.locator(`input[aria-label="${f.aria}"]`).press('Escape').catch(() => {}); await page.waitForTimeout(80); }
}

// ── the expert's diff, run headless per pair: max-channel Δ, heatmap, mismatch % ──
const pairs = results.filter((r) => r.ref);
const diffPage = await browser.newPage();
for (const r of pairs) {
  const b64 = (p) => readFileSync(p).toString('base64');
  const out = await diffPage.evaluate(async ({ A64, B64 }) => {
    const load = (s) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/png;base64,' + s; });
    const [A, B] = await Promise.all([load(A64), load(B64)]);
    // normalize: draw both at the SMALLER common pixel size (dpr differences scale here)
    const W = Math.min(A.width, B.width), H = Math.min(A.height, B.height);
    const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const t = cv(W, H); const tx = t.getContext('2d', { willReadFrequently: true });
    tx.drawImage(A, 0, 0, W, H); const da = tx.getImageData(0, 0, W, H).data;
    tx.clearRect(0, 0, W, H); tx.drawImage(B, 0, 0, W, H); const db = tx.getImageData(0, 0, W, H).data;
    // Cross-rasterizer AA phase: Figma's renderer and ours disagree by ≤1px subpixel phase on
    // text even when anatomy is identical (cluster-verified). Standard VRT practice: score at
    // the best GLOBAL ±1px alignment (one rigid shift for the whole crop — a real layout drift
    // of >1px, or any per-element drift, still fails). The chosen shift is reported.
    const scoreAt = (sx, sy, paint) => {
      let n = 0, mis = 0, warn = 0, sum = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const bx = x + sx, by = y + sy;
        if (bx < 0 || by < 0 || bx >= W || by >= H) continue;
        const i = (y * W + x) * 4, j = (by * W + bx) * 4;
        const delta = Math.max(Math.abs(da[i] - db[j]), Math.abs(da[i + 1] - db[j + 1]), Math.abs(da[i + 2] - db[j + 2]));
        n++; sum += delta;
        const bad = delta > 32, wn = delta > 16;
        if (bad) mis++; else if (wn) warn++;
        if (paint) {
          const g = Math.round((da[i] + da[i + 1] + da[i + 2]) / 3 * 0.3 + 160);
          paint.data[i] = bad || wn ? 255 : g; paint.data[i + 1] = bad ? 40 : wn ? 160 : g; paint.data[i + 2] = bad ? 40 : wn ? 0 : g; paint.data[i + 3] = 255;
        }
      }
      return { n, mis, warn, sum };
    };
    let best = { sx: 0, sy: 0, s: scoreAt(0, 0, null) };
    for (let sy = -1; sy <= 1; sy++) for (let sx = -1; sx <= 1; sx++) {
      if (!sx && !sy) continue;
      const s = scoreAt(sx, sy, null);
      if (s.mis / s.n < best.s.mis / best.s.n) best = { sx, sy, s };
    }
    const d = cv(W, H); const dx = d.getContext('2d'); const D = dx.createImageData(W, H);
    const s = scoreAt(best.sx, best.sy, D);
    dx.putImageData(D, 0, 0);
    return { W, H, shift: `${best.sx},${best.sy}`, mismatch: s.mis / s.n, warn: s.warn / s.n, mean: s.sum / s.n, heat: d.toDataURL('image/png').split(',')[1] };
  }, { A64: b64(r.ref), B64: b64(r.our) });
  r.W = out.W; r.H = out.H; r.shift = out.shift; r.mismatchPct = Math.round(out.mismatch * 10000) / 100;
  r.meanDelta = Math.round(out.mean * 100) / 100;
  r.pass = r.mismatchPct <= BUDGET;
  writeFileSync(path.join(OUT, `heat-${r.key}.png`), Buffer.from(out.heat, 'base64'));
}
await browser.close();

// ── report ──
const rows = results.map((r) => r.ref
  ? `${r.pass ? 'PASS' : 'FAIL'}  ${r.key.padEnd(24)} mismatch ${String(r.mismatchPct).padStart(6)}% (budget ${BUDGET}%) · shift ${r.shift} · meanΔ ${r.meanDelta}/255 · ${r.W}x${r.H} · heat-${r.key}.png`
  : `FAIL  ${r.key.padEnd(24)} ${r.note}`);
writeFileSync(path.join(OUT, 'pixel-fidelity.json'), JSON.stringify({ url: URL_, budget: BUDGET, at: new Date().toISOString(), results }, null, 2));
console.log(rows.join('\n'));
const failures = results.filter((r) => !r.pass);
console.log(`\n${results.length - failures.length}/${results.length} fields within pixel budget → ${OUT}`);
if (failures.length) { console.error(`${failures.length} PIXEL-FIDELITY FAILURES.`); process.exit(1); }
