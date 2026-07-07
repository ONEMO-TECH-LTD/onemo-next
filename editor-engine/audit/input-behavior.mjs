// Input behavior gates (Sprint E8, KAI-9383) — deterministic Figma-behavior verification.
// Contract: figma-spec.json inputCommitSemantics/scrub (blur-without-Enter PROVEN in real Figma).
// Expert laws: gates read the MODEL (the iframe #engine-overrides staging sheet), never just the
// input box; real keyboard/mouse via Playwright (in-page probes can't even focus in bg tabs).
// usage: node editor-engine/audit/input-behavior.mjs [--url http://localhost:3025/react-figma]
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const URL_ = flag('--url', 'http://localhost:3025/react-figma');
const OUT = flag('--out', '/tmp/e8-behavior');
mkdirSync(OUT, { recursive: true });

const PW_CANDIDATES = [
  process.env.FTC_PLAYWRIGHT,
  '/opt/homebrew/lib/node_modules/@playwright/test/node_modules/playwright/index.mjs',
  '/opt/homebrew/lib/node_modules/playwright/index.mjs',
].filter(Boolean);
const CHROME = process.env.FTC_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const pwPath = PW_CANDIDATES.find((p) => existsSync(p));
if (!pwPath) { console.error('behavior: no playwright — set FTC_PLAYWRIGHT'); process.exit(1); }
const { chromium } = await import(pwPath);
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1728, height: 1080 } });
await page.goto(URL_, { waitUntil: 'load', timeout: 45000 });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(800);
await page.evaluate(() => {
  document.querySelector('iframe')?.contentDocument?.querySelector('[data-src]')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await page.waitForTimeout(500);

const model = () => page.evaluate(() => document.querySelector('iframe')?.contentDocument?.getElementById('engine-overrides')?.textContent ?? '');
const rows = [];
const gate = (name, expected, actual) => rows.push({ name, expected: String(expected), actual: String(actual), pass: String(expected) === String(actual) });

const opacity = page.locator('input[aria-label="Opacity"]');

// G1 — item 11: type WITHOUT Enter, click away → display reverts, MODEL untouched
const orig = await opacity.inputValue();
await opacity.click();
await opacity.fill('37');
await page.locator('input[aria-label="Corner radius"]').click(); // real click-away
await page.waitForTimeout(300);
gate('blur-without-enter: display reverts', orig, await opacity.inputValue());
gate('blur-without-enter: model untouched', 'false', /opacity/.test(await model()));

// G2 — Enter commits ONCE to the model
await opacity.click();
await opacity.fill('42');
await opacity.press('Enter');
await page.waitForTimeout(300);
gate('enter commits to model', 'true', /opacity: 0\.42/.test(await model()));
gate('enter commits display', '42', await opacity.inputValue());

// G3 — Escape reverts (display + model)
const before = await model();
await opacity.click();
await opacity.fill('77');
await opacity.press('Escape');
await page.waitForTimeout(200);
gate('escape reverts display', '42', await opacity.inputValue());
gate('escape leaves model', 'true', (await model()) === before);

// G4 — item 10: undo restores the PRIOR committed value (one entry per commit)
await opacity.click();
await opacity.fill('55');
await opacity.press('Enter');
await page.waitForTimeout(250);
await page.keyboard.press('Meta+z');
await page.waitForTimeout(350);
gate('undo restores prior committed value (model)', 'true', /opacity: 0\.42/.test(await model()));

// G5 — item 12: scrub — real mouse drag on the rotation glyph changes value + stages model
const rotGlyph = page.locator('input[aria-label="Rotation"]').locator('xpath=../span[1]');
const gb = await rotGlyph.boundingBox();
gate('scrub cursor ew-resize', 'ew-resize', await rotGlyph.evaluate((el) => getComputedStyle(el).cursor));
await page.mouse.move(gb.x + 8, gb.y + 12);
await page.mouse.down();
for (let i = 1; i <= 5; i++) await page.mouse.move(gb.x + 8 + i * 4, gb.y + 12);
await page.mouse.up();
await page.waitForTimeout(400);
gate('scrub stages rotation in model', 'true', /rotate\(20deg\)/.test(await model()));
gate('scrub display shows degrees', '20°', await page.locator('input[aria-label="Rotation"]').inputValue());

// G6 — item 10 annotation: frame preset change is undoable
const label = () => page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.title === 'Select frame')?.textContent ?? '');
const before6 = await label();
await page.locator('button[aria-label*="Frame Dimension Presets"]').first().click();
await page.waitForTimeout(300);
const rowBtn = page.locator('[role="menu"] [role="menuitemradio"], [role="menu"] li, [role="menu"] button').filter({ hasText: 'MacBook' }).first();
if (await rowBtn.count()) {
  await rowBtn.click(); await page.waitForTimeout(400);
  const changed = (await label()) !== before6;
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(400);
  gate('frame preset undo restores', 'true', changed && (await label()) === before6);
} else gate('frame preset menu reachable', 'true', false);

// G7 — items 6/7: panel resize clamps + fields grow responsively
const aside = page.locator('aside').last();
const asideBox = await aside.boundingBox();
const fieldW0 = await opacity.evaluate((el) => Math.round(el.closest('div').getBoundingClientRect().width));
await page.mouse.move(asideBox.x + 3, asideBox.y + 400);
await page.mouse.down();
await page.mouse.move(asideBox.x - 600, asideBox.y + 400, { steps: 8 }); // try far beyond max
await page.mouse.up();
await page.waitForTimeout(300);
const wideW = Math.round((await aside.boundingBox()).width);
gate('panel resize clamps at max 480', 'true', wideW <= 481 && wideW >= 470);
const fieldW1 = await opacity.evaluate((el) => Math.round(el.closest('div').getBoundingClientRect().width));
gate('fields grow with panel (responsive)', 'true', fieldW1 > fieldW0);
await page.mouse.move((await aside.boundingBox()).x + 3, asideBox.y + 400);
await page.mouse.down();
await page.mouse.move(asideBox.x + 900, asideBox.y + 400, { steps: 8 }); // try far below min
await page.mouse.up();
await page.waitForTimeout(300);
const narrowW = Math.round((await aside.boundingBox()).width);
gate('panel resize clamps at min 241', 'true', narrowW >= 240 && narrowW <= 242);
const fieldWmin = await opacity.evaluate((el) => Math.round(el.closest('div').getBoundingClientRect().width));
gate('fields never below Figma min 88', 'true', fieldWmin >= 88);

// G8 — annotation: vertical alignment writes the model
const alignBtn = page.locator('button[aria-label*="Align top"], button[title*="Align top"]').first();
if (await alignBtn.count()) {
  const m0 = await model();
  await alignBtn.click(); await page.waitForTimeout(300);
  const m1 = await model();
  gate('vertical align (top) writes model', 'true', m1 !== m0 && /(align-self|margin-bottom)/.test(m1));
} else gate('vertical align control present', 'true', false);

// G9 — annotation: tidy-up/distribute writes the model
const moreBtn = page.locator('button[title="Distribute"]').first();
if (await moreBtn.count()) {
  await moreBtn.click(); await page.waitForTimeout(300);
  const item = page.locator('[role="menu"] button, [role="menuitem"], [role="menuitemradio"]').filter({ hasText: /space|between|distribute/i }).first();
  if (await item.count()) {
    const m0 = await model();
    await item.click(); await page.waitForTimeout(300);
    gate('distribute writes model', 'true', (await model()) !== m0 && /justify-content/.test(await model()));
  } else { gate('distribute menu has options', 'true', false); await page.keyboard.press('Escape'); }
} else gate('distribute control present', 'true', false);

// G10 — item 9 (scroll half): overflow control writes the model
const scrollSeg = page.locator('[role="radiogroup"][aria-label="Scroll overflow"] button').filter({ hasText: 'Hidden' });
if (await scrollSeg.count()) {
  await scrollSeg.click(); await page.waitForTimeout(300);
  gate('scroll overflow writes model', 'true', /overflow: hidden/.test(await model()));
} else gate('scroll control present', 'true', false);

await browser.close();
writeFileSync(path.join(OUT, 'behavior-gates.json'), JSON.stringify({ url: URL_, at: new Date().toISOString(), rows }, null, 2));
const lines = rows.map((r) => `${r.pass ? 'PASS' : 'FAIL'}  ${r.name} · expected ${r.expected} · actual ${r.actual}`);
console.log(lines.join('\n'));
const failures = rows.filter((r) => !r.pass);
console.log(`\n${rows.length - failures.length}/${rows.length} PASS → ${OUT}/behavior-gates.json`);
if (failures.length) process.exit(1);
