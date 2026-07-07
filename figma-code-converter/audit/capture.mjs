// Exact-viewport route capture (C6 rework, s58-qa).
// Raw headless Chrome silently enforces a ~500px minimum window width — a 402-wide capture
// actually lays out at 500 and crops, which falsely fails any viewport-law screen (root =
// width:100%). Playwright sets the viewport exactly, so it is the capture path; the system
// Chrome binary is used (no browser download). Override module/binary via env when needed:
//   FTC_PLAYWRIGHT=<dir containing playwright/index.mjs>  FTC_CHROME=<chrome binary>
//
// usage: node audit/capture.mjs <url> <out.png> <cssWidth> <cssHeight>
//        node audit/capture.mjs <gateDir> --judge       (judge mode: serves <gateDir> ITSELF on
//                                                        an ephemeral port, loads fidelity-gate.html,
//                                                        prints its "RESIDUAL n". The caller must NOT
//                                                        serve — a parent blocked in execFileSync has
//                                                        a frozen event loop → deadlock, live-hit.)
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';

const [, , url, out, w, h] = process.argv;
if (!url || !out || (out !== '--judge' && (!w || !h))) {
  console.error('usage: node audit/capture.mjs <url> <out.png> <width> <height> | <gateDir> --judge');
  process.exit(2);
}
const PW_CANDIDATES = [
  process.env.FTC_PLAYWRIGHT,
  '/opt/homebrew/lib/node_modules/@playwright/test/node_modules/playwright/index.mjs',
  '/opt/homebrew/lib/node_modules/playwright/index.mjs',
].filter(Boolean);
const CHROME = process.env.FTC_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const pwPath = PW_CANDIDATES.find((p) => existsSync(p));
if (!pwPath) {
  console.error(`capture: no playwright module found (tried ${PW_CANDIDATES.join(', ')}) — set FTC_PLAYWRIGHT`);
  process.exit(1);
}
const { chromium } = await import(pwPath);
const browser = await chromium.launch({ executablePath: CHROME });
if (out === '--judge') { // judge mode: url arg = the gate dir on disk
  const dir = url;
  const server = createServer((req, res) => {
    try { res.end(readFileSync(path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname)))); }
    catch { res.statusCode = 404; res.end(); }
  });
  await new Promise((r) => server.listen(0, r));
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/fidelity-gate.html`, { waitUntil: 'load', timeout: 45000 });
  await page.waitForFunction(() => /RESIDUAL [\d.]+/.test(document.getElementById('out')?.textContent ?? ''), { timeout: 30000 });
  console.log(await page.evaluate(() => document.getElementById('out').textContent));
  await browser.close();
  server.close();
} else {
  const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2 });
  // 'load' not 'networkidle': on a dev server a fresh promotion keeps HMR/compile traffic going
  // and networkidle can never settle (watch ETIMEDOUT, live-hit).
  await page.goto(url, { waitUntil: 'load', timeout: 45000 });
  await page.evaluate(() => document.fonts.ready); // fonts law: measure what the user sees, loaded
  await page.waitForTimeout(1200);
  await page.screenshot({ path: out });
  await browser.close();
  console.log(`capture: ${out} @ ${w}x${h} (dpr 2)`);
}
