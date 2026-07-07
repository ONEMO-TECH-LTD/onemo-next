// Inspector conformance audit (Sprint E8, KAI-9383) — deterministic Figma-parity gate.
// Modeled on the expert's figma-to-code harness (s58-expert consult 2026-07-07):
//   · oracle from CONTRACT (figma-spec.json, measured from real Figma) — never from the artifact
//   · fail-closed: unmeasured/unmeasurable contract entries FAIL, never skip
//   · display transforms encoded in the contract (rotation "°", opacity "%") — no false drift
//   · exit 1 naming every failing field + value pair; machine-readable matrix artifact out
//
// usage: node editor-engine/audit/inspector-conformance.mjs [--url http://localhost:3025/react-figma]
//        [--out /tmp/e8-conformance]
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SPEC = JSON.parse(readFileSync(path.join(HERE, 'figma-spec.json'), 'utf8'));
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const URL_ = flag('--url', 'http://localhost:3025/react-figma');
const OUT = flag('--out', '/tmp/e8-conformance');
mkdirSync(OUT, { recursive: true });

// expert (c): lift the playwright+system-Chrome resolution verbatim
const PW_CANDIDATES = [
  process.env.FTC_PLAYWRIGHT,
  '/opt/homebrew/lib/node_modules/@playwright/test/node_modules/playwright/index.mjs',
  '/opt/homebrew/lib/node_modules/playwright/index.mjs',
].filter(Boolean);
const CHROME = process.env.FTC_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const pwPath = PW_CANDIDATES.find((p) => existsSync(p));
if (!pwPath) { console.error('conformance: no playwright module found — set FTC_PLAYWRIGHT'); process.exit(1); }
const { chromium } = await import(pwPath);

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1728, height: 1080 } }); // expert (b): exact viewport
await page.goto(URL_, { waitUntil: 'load', timeout: 45000 }); // 'load', never networkidle (HMR never settles)
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(800);

// select a canvas element so the full inspector renders
await page.evaluate(() => {
  const idoc = document.querySelector('iframe')?.contentDocument;
  idoc?.querySelector('[data-src]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await page.waitForTimeout(500);

const rows = [];
const fail = (field, prop, expected, actual) => rows.push({ field, prop, expected: String(expected), actual: String(actual), pass: false });
const pass = (field, prop, expected, actual) => rows.push({ field, prop, expected: String(expected), actual: String(actual), pass: true });
const check = (field, prop, expected, actual, cmp = (e, a) => String(e) === String(a)) =>
  (cmp(expected, actual) ? pass : fail)(field, prop, expected, actual);

// ── value-field census: EVERY visible inspector input vs the IMPARTIAL contract ─────
// Dan (2026-07-07): "the contract must be deterministic - it must read all figma properties
// and impartially match." The oracle is SPEC.fieldGroups — the FULL fixed property list
// pulled from Figma's inspector DOM per distinct field group, no hand-picked properties.
// Comparability laws (declared in the contract's _provenance): fontFamily = first family,
// letterSpacing tolerance 0.01px; cursor + input-internal bg/radius are Figma-DOM artifacts
// covered by the behavior gates (scrub cursor) instead of this anatomy matrix.
const spec = SPEC.valueField;
const groups = SPEC.fieldGroups;
const census = await page.evaluate(() => {
  const panel = [...document.querySelectorAll('aside')].pop();
  const inputs = [...(panel?.querySelectorAll('input[role="spinbutton"], input[aria-label]') ?? [])]
    .filter((i) => i.offsetParent && i.type !== 'checkbox' && i.type !== 'color');
  return inputs.map((i) => {
    const s = getComputedStyle(i);
    // climb to the 24px field container (bg or radius bearer)
    let c = i.parentElement;
    for (let k = 0; k < 4 && c; k++) {
      const cs = getComputedStyle(c);
      if (parseFloat(cs.height) >= 20 && (cs.borderRadius !== '0px' || cs.backgroundColor !== 'rgba(0, 0, 0, 0)')) break;
      c = c.parentElement;
    }
    const cs = c ? getComputedStyle(c) : null;
    const cr = c?.getBoundingClientRect();
    return {
      aria: i.getAttribute('aria-label') ?? '(unlabeled)',
      fontFamily: s.fontFamily.split(',')[0].replace(/["']/g, ''),
      fontSize: s.fontSize, lineHeight: s.lineHeight, fontWeight: s.fontWeight, color: s.color,
      letterSpacing: s.letterSpacing,
      contH: cr ? Math.round(cr.height) : -1, contR: cs?.borderRadius ?? '-', contBg: cs?.backgroundColor ?? '-',
      value: i.value,
    };
  });
});
if (census.length === 0) fail('inspector', 'inputs-present', '>0 inputs', '0 (selection failed?)');
const lsNum = (v) => (v === 'normal' ? 0 : parseFloat(v) || 0);
for (const f of census) {
  const id = `field:${f.aria}`;
  // resolve the field's Figma group; 'a|b' alternatives resolve by measured ink
  let gName = groups.buildFieldMap[f.aria] ?? groups.buildFieldMap._default;
  if (gName.includes('|')) {
    const [a, b] = gName.split('|');
    gName = f.color === groups[a].input.color ? a : b;
  }
  const g = groups[gName];
  check(id, `fontFamily(${gName})`, g.inputFontFamilyFirst, f.fontFamily);
  check(id, `fontSize(${gName})`, g.input.fontSize, f.fontSize);
  check(id, `lineHeight(${gName})`, g.input.lineHeight, f.lineHeight);
  check(id, `fontWeight(${gName})`, g.input.fontWeight, f.fontWeight);
  check(id, `letterSpacing(${gName})`, g.input.letterSpacing, f.letterSpacing, (e, a) => Math.abs(lsNum(e) - lsNum(a)) <= 0.01);
  check(id, `inkColor(${gName})`, g.input.color, f.color);
  check(id, `containerHeight(${gName})`, g.containerRectH, f.contH, (e, a) => Math.abs(e - a) <= 1);
  check(id, `borderRadius(${gName})`, g.container.borderRadius, f.contR);
  check(id, `containerBg(${gName})`, g.container.backgroundColor, f.contBg);
}

// ── rendered-truth font gate: DECLARED Inter passes computed-style checks even when the
// browser renders a fallback (expert law: static-identical ≠ correct) ────────
const fontLoaded = await page.evaluate(() => document.fonts.check('450 11px Inter'));
check('fonts', 'InterActuallyLoaded', 'true', fontLoaded);

// ── rotation display transform (expert law: transforms live in the contract) ─
const rot = census.find((f) => /rotation/i.test(f.aria));
if (rot) check('field:Rotation', 'degreeSuffixInValue', SPEC.rotation.example.replace(/^\d+/, 'n') , /°$/.test(rot.value) ? 'n°' : rot.value || '(empty)');
else fail('field:Rotation', 'present', 'rotation input', 'not found');

// ── item 5: RESIZE field mode label (Fill/Hug/Fixed) must be the SAME 11px as the value,
// not oversized (Dan: 'resizing font too big not fitting the input') ─────────
const resizeModeFont = await page.evaluate(() => {
  const w = document.querySelector('input[aria-label="width value"]');
  const btn = w?.parentElement && [...w.parentElement.children].find((c) => c.tagName === 'BUTTON');
  return btn ? getComputedStyle(btn).fontSize : null;
});
check('field:width mode label', 'fontSize', SPEC.valueField.fontSize, resizeModeFont);

// ── panel geometry + resize clamps ───────────────────────────────────────────
const panelGeo = await page.evaluate(() => {
  const aside = [...document.querySelectorAll('aside')].pop();
  const r = aside?.getBoundingClientRect();
  return { w: r ? Math.round(r.width) : -1 };
});
check('panel', 'width>=min', `>=${SPEC.panel.ourMinWidth}`, panelGeo.w, (e, a) => a >= SPEC.panel.ourMinWidth);
check('panel', 'width<=max', `<=${SPEC.panel.ourMaxWidth}`, panelGeo.w, (e, a) => a <= SPEC.panel.ourMaxWidth);

// ── section order: Link To last ──────────────────────────────────────────────
const lastSection = await page.evaluate(() => {
  const aside = [...document.querySelectorAll('aside')].pop();
  const headers = [...(aside?.querySelectorAll('div') ?? [])]
    .filter((d) => d.children.length <= 2 && /^(Position|Auto layout|Layout|Appearance|Fill|Stroke|Effects|Selection colors|Layout guide|Export|Text|Link)$/.test(d.textContent.trim()))
    .map((d) => d.textContent.trim());
  return headers[headers.length - 1] ?? '(none)';
});
check('sections', 'linkToLast', 'Link', lastSection);

// ── fail-closed pending contract entries ─────────────────────────────────────
for (const [key, val] of Object.entries({ variablePillAnatomy: SPEC.variablePill.pillAnatomy, variablePickerRowAnatomy: SPEC.variablePicker.rowAnatomy })) {
  if (val && val.measured === false) fail(`contract:${key}`, 'measured', 'measured contract entry', `PENDING — ${val.todo}`);
}

// ── variable pill + picker: bind → pill anatomy → click → preselection (items 2/3/4) ─
const pillSpec = SPEC.variablePill.pillAnatomy;
const pickerSpec = SPEC.variablePicker.rowAnatomy;
const pillRun = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // the ⬡ picker is hover-revealed (Figma census: no trailing cell at rest) — hover the field first
  const xInput = document.querySelector('input[aria-label="X-position"]');
  xInput?.closest('div')?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  await sleep(400);
  document.querySelector('button[aria-label="Apply variable to X-position"]')?.click();
  await sleep(450);
  const dialog1 = document.querySelector('[role="dialog"]');
  const firstRow = [...(dialog1?.querySelectorAll('button') ?? [])].find((b) => b.title && b.querySelector('span'));
  const rowH = firstRow ? Math.round(firstRow.getBoundingClientRect().height) : -1;
  const searchPresent = !!dialog1?.querySelector('input[placeholder="Search"]');
  const rowTitleHasPath = !!firstRow?.title?.includes('/');
  firstRow?.click();
  await sleep(450);
  const pill = [...document.querySelectorAll('button')].find((b) => {
    const s = getComputedStyle(b); const r = b.getBoundingClientRect();
    return s.borderRadius === '5px' && s.backgroundColor === 'rgb(255, 255, 255)' && Math.round(r.height) === 20 && b.title.includes('/');
  });
  const ps = pill ? getComputedStyle(pill) : null;
  const pillInfo = pill ? { h: 20, radius: ps.borderRadius, bg: ps.backgroundColor, borderColor: ps.borderColor, font: `${ps.fontSize} w${ps.fontWeight}`, rawText: /^[\d.#a-fA-F%]+/.test(pill.textContent.trim()), tooltipHasPath: pill.title.includes('/') } : null;
  pill?.click();
  await sleep(500);
  const dialog2 = document.querySelector('[role="dialog"]');
  const selRow = [...(dialog2?.querySelectorAll('button') ?? [])].find((b) => getComputedStyle(b).backgroundColor === 'rgb(229, 244, 255)');
  let inView = false;
  if (selRow && dialog2) { const r = selRow.getBoundingClientRect(); const d = dialog2.getBoundingClientRect(); inView = r.top >= d.top && r.bottom <= d.bottom; }
  // cleanup: close picker, unbind by typing 0? leave binding (staging only, discarded on reload)
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return { rowH, searchPresent, rowTitleHasPath, pillInfo, preselected: !!selRow, preselectedInView: inView };
});
check('picker', 'rowHeight', pickerSpec.row.height, pillRun.rowH);
check('picker', 'searchPresent', 'true', pillRun.searchPresent);
check('picker', 'rowsCarryFigmaPath', 'true', pillRun.rowTitleHasPath);
if (pillRun.pillInfo) {
  check('pill', 'height', pillSpec.height, pillRun.pillInfo.h);
  check('pill', 'borderRadius', pillSpec.borderRadius, pillRun.pillInfo.radius);
  check('pill', 'background', pillSpec.background, pillRun.pillInfo.bg);
  check('pill', 'font', pillSpec.font, pillRun.pillInfo.font, (e, a) => a === String(e));
  check('pill', 'showsRawValue', 'true', pillRun.pillInfo.rawText);
  check('pill', 'tooltipFullPath', 'true', pillRun.pillInfo.tooltipHasPath);
} else fail('pill', 'present-after-bind', 'pill rendered', 'not found');
check('picker', 'assignedPreselected', 'true', pillRun.preselected);
check('picker', 'preselectedScrolledIntoView', 'true', pillRun.preselectedInView);

await browser.close();

// ── report: matrix artifact + exit-1 named failures (expert law) ─────────────
const failures = rows.filter((r) => !r.pass);
writeFileSync(path.join(OUT, 'conformance-matrix.json'), JSON.stringify({ url: URL_, at: new Date().toISOString(), rows }, null, 2));
const lines = rows.map((r) => `${r.pass ? 'PASS' : 'FAIL'}  ${r.field} · ${r.prop} · expected ${r.expected} · actual ${r.actual}`);
writeFileSync(path.join(OUT, 'conformance-matrix.txt'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
console.log(`\n${rows.length - failures.length}/${rows.length} PASS → matrix at ${OUT}/conformance-matrix.json`);
if (failures.length) { console.error(`\n${failures.length} CONFORMANCE FAILURES (named above).`); process.exit(1); }
