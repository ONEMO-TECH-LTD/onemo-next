// Responsive parity sweep (C7.4, KAI-9372 — Dan: "what happens if I change the size of the
// viewport and it is not behaving as figma?"). Fixed-width sampling can miss the continuum, so
// ONE browser session steps the viewport across the whole range and asserts screen-agnostic
// invariants — derived from the converter's own laws — at EVERY step:
//   1. root fills the viewport exactly (root = viewport law)
//   2. zero horizontal overflow (nothing escapes the frame)
//   3. every capped root child (max-width + margin-inline:auto) is horizontally CENTERED
// Any width failing exits 1 naming the width + invariant. This is behavior verification, not
// pixels; Figma ground-truth pixels at arbitrary widths come from the bridge clone-resize flow.
//
// usage: node audit/sweep.mjs <route-url> [--from 320] [--to 1728] [--step 16] [--height 900]
import { existsSync } from 'node:fs';

const [, , url, ...rest] = process.argv;
if (!url) { console.error('usage: node audit/sweep.mjs <route-url> [--from 320] [--to 1728] [--step 16] [--height 900]'); process.exit(2); }
const flag = (name, dflt) => { const i = rest.indexOf(name); return i >= 0 ? parseInt(rest[i + 1], 10) : dflt; };
const FROM = flag('--from', 320), TO = flag('--to', 1728), STEP = flag('--step', 16), H = flag('--height', 900);
// --expect-capped <n> + --cap <px>: the EXPECTED capped-children contract, supplied from the
// package (convert-run/CSS), not discovered from mutable computed styles — QA proved width:50%,
// fit-content and max-width:none all slipped past discovery-based checks.
const EXPECT = flag('--expect-capped', -1), CAP = flag('--cap', 0);

const PW_CANDIDATES = [
  process.env.FTC_PLAYWRIGHT,
  '/opt/homebrew/lib/node_modules/@playwright/test/node_modules/playwright/index.mjs',
  '/opt/homebrew/lib/node_modules/playwright/index.mjs',
].filter(Boolean);
const CHROME = process.env.FTC_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const pwPath = PW_CANDIDATES.find((p) => existsSync(p));
if (!pwPath) { console.error('sweep: no playwright module found — set FTC_PLAYWRIGHT'); process.exit(1); }

const { chromium } = await import(pwPath);
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: FROM, height: H } });
await page.goto(url, { waitUntil: 'load', timeout: 45000 });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);

const failures = [];
let steps = 0;
for (let w = FROM; w <= TO; w += STEP) {
  await page.setViewportSize({ width: w, height: H });
  await page.waitForTimeout(60); // let layout + container queries settle
  const r = await page.evaluate(({ EXPECT, CAP }) => {
    const root = [...document.body.children].find((e) => e.tagName === 'DIV' && getComputedStyle(e).display !== 'none');
    if (!root) return { err: 'no root element' };
    const rb = root.getBoundingClientRect();
    const out = []; let capped = 0;
    if (Math.abs(rb.width - innerWidth) > 1) out.push(`root width ${Math.round(rb.width)} ≠ viewport ${innerWidth}`);
    if (document.documentElement.scrollWidth > innerWidth + 1) out.push(`horizontal overflow: scrollWidth ${document.documentElement.scrollWidth} > ${innerWidth}`);
    for (const c of root.children) {
      const cs = getComputedStyle(c);
      // predicate = the CAP only (max-width). Keying on the margins too would exclude a child
      // whose centering was broken by zeroing them — the exact mutation this check exists to
      // catch (live-hit: margin-inline:0 passed the sweep silently).
      if (cs.maxWidth !== 'none') {
        capped++;
        const b = c.getBoundingClientRect();
        const off = Math.abs((b.x + b.width / 2) - innerWidth / 2);
        const name = String(c.className).split('__')[1]?.split(' ')[0] ?? c.className;
        if (off > 2) out.push(`capped child .${name} off-center by ${Math.round(off)}px`);
        // fill-to-cap: width must be min(viewport, cap) — width:50% / fit-content can't pass
        if (CAP > 0) {
          const want = Math.min(innerWidth, CAP);
          if (Math.abs(b.width - want) > 2) out.push(`capped child .${name} width ${Math.round(b.width)} ≠ min(viewport, cap) = ${want}`);
        }
      }
    }
    if (EXPECT >= 0 && capped !== EXPECT) out.push(`capped-children count ${capped} ≠ expected ${EXPECT} (cap removed/overridden?)`);
    return { out };
  }, { EXPECT, CAP });
  steps++;
  if (r.err) { failures.push(`${w}px: ${r.err}`); break; }
  for (const f of r.out) failures.push(`${w}px: ${f}`);
  if (failures.length > 12) break; // enough evidence
}
await browser.close();

if (failures.length) {
  console.error(`sweep: FAIL — ${failures.length} invariant violation(s) across ${FROM}–${TO}px:`);
  failures.slice(0, 12).forEach((f) => console.error(`  ${f}`));
  process.exit(1);
}
console.log(`sweep: OK — root=viewport, zero overflow, capped children centered at every width ${FROM}–${TO}px (${steps} steps, every ${STEP}px)`);
