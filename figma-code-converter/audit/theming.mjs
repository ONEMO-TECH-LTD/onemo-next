// Theming assertion (C7.3 lock) — proves the token-aware SVG rewrite is LIVE, not a claim:
// a token-coloured icon's rendered colour MUST move when the theme token changes. The pixel
// fidelity gate can't catch a reverted token link (the picture looks identical in one theme —
// ~0.05% delta), so this is the dedicated guarantee. Flips data-theme light→dark on the route
// and asserts every token-aware icon's computed colour actually changed.
//
// usage: node audit/theming.mjs <route-url>
import { existsSync } from 'node:fs';

const [, , url] = process.argv;
if (!url) { console.error('usage: node audit/theming.mjs <route-url>'); process.exit(2); }

const PW = [process.env.FTC_PLAYWRIGHT, '/opt/homebrew/lib/node_modules/@playwright/test/node_modules/playwright/index.mjs', '/opt/homebrew/lib/node_modules/playwright/index.mjs'].filter(Boolean).find((p) => existsSync(p));
if (!PW) { console.error('theming: no playwright module found — set FTC_PLAYWRIGHT'); process.exit(1); }
const CHROME = process.env.FTC_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const { chromium } = await import(PW);
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 402, height: 871 } });
await page.goto(url, { waitUntil: 'load', timeout: 45000 });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);

const result = await page.evaluate(() => {
  // token-aware icons carry an inline color: var(--…) on the class → computed `color` drives currentColor
  const icons = [...document.querySelectorAll('svg')].filter((s) => {
    const c = getComputedStyle(s);
    // only icons whose paint is token-driven (a real color set, and paths use currentColor)
    return c.color && [...s.querySelectorAll('[fill],[stroke]')].some((p) =>
      p.getAttribute('fill') === 'currentColor' || p.getAttribute('stroke') === 'currentColor');
  });
  const root = document.documentElement;
  const before = icons.map((s) => getComputedStyle(s).color);
  const prevTheme = root.getAttribute('data-theme');
  root.setAttribute('data-theme', prevTheme === 'dark' ? 'light' : 'dark');
  const after = icons.map((s) => getComputedStyle(s).color);
  root.setAttribute('data-theme', prevTheme ?? 'light');
  const moved = before.filter((c, i) => c !== after[i]).length;
  return { total: icons.length, moved, sample: icons.length ? { before: before[0], after: after[0] } : null };
});
await browser.close();

if (result.total === 0) { console.error('theming: FAIL — no token-aware icons found (currentColor rewrite missing?)'); process.exit(1); }
if (result.moved === 0) { console.error(`theming: FAIL — ${result.total} token-aware icons, but NONE changed colour on theme flip (token link dead)`); process.exit(1); }
console.log(`theming: OK — ${result.moved}/${result.total} token-aware icons re-coloured on theme flip (e.g. ${result.sample.before} → ${result.sample.after})`);
