// E8 audit-export (KAI-9383) — the expert's "one machine-readable artifact every mode reads".
// Runs BOTH deterministic tools, maps every result to Dan's 12 goal items, emits a single
// report (json + md) with the pass/fail matrix, the item→gate coverage, and the contract
// provenance. This is the authoritative conformance surface for QA + Dan's acceptance.
//
// usage: node editor-engine/audit/audit-export.mjs [--url http://localhost:3025/react-figma]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const URL_ = flag('--url', 'http://localhost:3025/react-figma');
const OUT = flag('--out', '/tmp/e8-report');
mkdirSync(OUT, { recursive: true });

const run = (script, out) => {
  try { execFileSync('node', [path.join(HERE, script), '--url', URL_, '--out', out], { stdio: 'pipe', encoding: 'utf8' }); return true; }
  catch { return false; } // exit 1 = failures present; we read the matrix either way
};
run('inspector-conformance.mjs', path.join(OUT, 'conf'));
run('input-behavior.mjs', path.join(OUT, 'beh'));
const conf = JSON.parse(readFileSync(path.join(OUT, 'conf', 'conformance-matrix.json'), 'utf8')).rows;
const beh = JSON.parse(readFileSync(path.join(OUT, 'beh', 'behavior-gates.json'), 'utf8')).rows;
const spec = JSON.parse(readFileSync(path.join(HERE, 'figma-spec.json'), 'utf8'));

// Dan's 12 items → the gates that prove each (by matching row field/prop/name substrings)
const ITEMS = {
  '1/5 font + anatomy of every input': { conf: /font|inkColor|containerHeight|borderRadius|mode label/i },
  '2 variable pill → picker preselected': { conf: /pill|assignedPreselected|preselectedScrolled/i, beh: null },
  '3 raw value badge only': { conf: /pill.*showsRawValue|pill.*background/i },
  '4 picker figma names + scoping + search': { conf: /picker.*(rowHeight|searchPresent|rowsCarryFigmaPath)/i },
  '6 field min-width + responsive': { beh: /responsive|below Figma min/i },
  '7 panel min/max resize': { beh: /panel resize clamps/i, conf: /panel.*width/i },
  '8 Link To last': { conf: /linkToLast/i, beh: /link Enter|link Escape/i },
  '9 scroll + hover/tap': { beh: /scroll overflow|add-state-rule|honest error/i },
  '10 rotation undo + degree': { conf: /degreeSuffix/i, beh: /undo.*rotation DISPLAY|EVERY field reverts DISPLAY|scrub display shows degrees/i },
  '11 type-no-Enter reverts on blur': { beh: /blur-without-enter|escape reverts/i },
  '12 drag scrub': { beh: /scrub cursor|scrub stages|glyph-cell/i },
};

const allRows = [...conf.map((r) => ({ src: 'conformance', name: `${r.field} · ${r.prop}`, pass: r.pass })),
                 ...beh.map((r) => ({ src: 'behavior', name: r.name, pass: r.pass }))];
const coverage = Object.entries(ITEMS).map(([item, pats]) => {
  const matched = allRows.filter((r) =>
    (pats.conf && r.src === 'conformance' && pats.conf.test(r.name)) ||
    (pats.beh && r.src === 'behavior' && pats.beh.test(r.name)));
  return { item, gates: matched.length, allPass: matched.length > 0 && matched.every((m) => m.pass), failing: matched.filter((m) => !m.pass).map((m) => m.name) };
});

const confPass = conf.filter((r) => r.pass).length, behPass = beh.filter((r) => r.pass).length;
const report = {
  head: (() => { try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: HERE, encoding: 'utf8' }).trim(); } catch { return 'unknown'; } })(),
  conformance: { pass: confPass, total: conf.length },
  behavior: { pass: behPass, total: beh.length },
  green: confPass === conf.length && behPass === beh.length,
  itemCoverage: coverage,
  contractProvenance: spec._provenance,
};
writeFileSync(path.join(OUT, 'E8-conformance-report.json'), JSON.stringify(report, null, 2));

const md = [
  `# E8 conformance report — HEAD ${report.head}`,
  '',
  `- Conformance matrix: **${confPass}/${conf.length}**`,
  `- Behavior gates: **${behPass}/${beh.length}**`,
  `- Overall: **${report.green ? 'GREEN' : 'RED — failures below'}**`,
  '',
  '## Dan\'s 12 items → gate coverage',
  '| Item | Gates | All pass |',
  '|---|---|---|',
  ...coverage.map((c) => `| ${c.item} | ${c.gates} | ${c.allPass ? '✅' : c.gates === 0 ? '⚠ no gate' : '❌ ' + c.failing.join('; ')} |`),
  '',
  '## Contract provenance',
  report.contractProvenance ?? '(none)',
  '',
  '> Run `node editor-engine/audit/audit-export.mjs` to regenerate. Both source tools are two-run deterministic.',
].join('\n');
writeFileSync(path.join(OUT, 'E8-conformance-report.md'), md);
console.log(md);
console.log(`\nreport → ${OUT}/E8-conformance-report.{json,md}`);
if (!report.green) process.exit(1);
