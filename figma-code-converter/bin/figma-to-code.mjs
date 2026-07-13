#!/usr/bin/env node
/**
 * figma-to-code CLI · C1.1 surface (fetch + dump-variables). Later phases add `convert`.
 * Contract: ../SPEC.md. Deterministic — no Date/random in any output artifact.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrameUrl } from '../src/figma-url.mjs';
import { fetchFrame } from '../src/fetch.mjs';
import { loadVariableMap, dumpPath, dumpSnippet, StaleDumpError } from '../src/variable-map.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function usage() {
  console.log(`figma-to-code — deterministic Figma→React/CSS-Modules converter (SPEC.md)

usage:
  figma-to-code fetch <frame-url> [--offline]   fetch + cache the raw node document
  figma-to-code dump-variables <frame-url>      refresh the ID→name variable dump (bridge, else instructions)
  figma-to-code convert <frame-url> [--offline] [--out <dir>] [--no-vars]
                                                 full pipeline: fetch → IR → emit (SPEC §2)
  figma-to-code check <frame-url> --out <dir> [--tokens-css <path>]
                                                 gate EXISTING output without re-emitting (CI / post-edit)
  figma-to-code watch <frame-url> --out <dir> [--tokens-css <path>] [--interval 6]
                        [--fidelity-route <url> [--budget 10]]   visual gate in the promotion path:
                        screenshot the live route, pixel-judge vs Figma's render, ROLLBACK on fail
                                                 LIVE: poll the file version; on change re-convert into
                                                 --out (staging + error-hold: a failed gate keeps the
                                                 last good output). Figma becomes the editor (C6.3)`);
  process.exit(2);
}

const [cmd, urlArg, ...flags] = process.argv.slice(2);
if (!cmd || !urlArg) usage();
const { fileKey, nodeId } = parseFrameUrl(urlArg);

if (cmd === 'fetch') {
  const offline = flags.includes('--offline');
  const r = await fetchFrame(ROOT, fileKey, nodeId, { offline });
  console.log(`${r.fromCache ? 'cache' : 'fetched'}: ${fileKey}/${nodeId} version=${r.fileVersion} hash=${r.contentHash.slice(0, 12)}`);
  // Variable-map staleness is checked at fetch time so a stale dump surfaces EARLY, not mid-convert.
  try {
    const map = await loadVariableMap(ROOT, fileKey, r.fileVersion);
    console.log(`variable-map: ok (${map.size} variables, dump matches file version)`);
  } catch (e) {
    if (e instanceof StaleDumpError) console.error(`variable-map: ${e.message}`);
    else throw e;
  }
} else if (cmd === 'dump-variables') {
  // C10.4: the STUDIO hosts a live Desktop-Bridge peer (the plugin pushes the full catalog to it)
  // — ask it first; the raw probe + instruction path is the fallback when no studio is running.
  try {
    const r2 = await fetch(`http://127.0.0.1:3900/api/bridge/dump/${fileKey}`, { method: 'POST', signal: AbortSignal.timeout(30000) });
    const j = await r2.json();
    if (r2.ok) { console.log(`dump written via studio bridge peer: ${j.variables} variables @ file version ${j.fileVersion}${j.tokensRegenerated ? ' · tokens.css regenerated' : ''}`); process.exit(0); }
    console.error(`studio bridge: ${j.error}`);
  } catch { /* no studio running — fall through to the probe */ }
  const { tryBridgeDump } = await import('../src/bridge-dump.mjs');
  const r = await tryBridgeDump(ROOT, fileKey);
  if (r.ok) {
    console.log(`dump written: ${dumpPath(ROOT, fileKey)} (${r.count} variables, file version ${r.fileVersion})`);
  } else {
    console.error(`bridge unreachable (${r.reason}). Manual path (one step):\n\n${dumpSnippet(fileKey)}`);
    process.exit(1);
  }
} else if (cmd === 'convert') {
  const { buildIr } = await import('../src/ir.mjs');
  const { emit } = await import('../src/emit.mjs');
  const { promises: fs } = await import('node:fs');
  const offline = flags.includes('--offline');
  const outFlag = flags.indexOf('--out');
  const noVars = flags.includes('--no-vars'); // pre-dump runs: refs carry varId, values raw — C1.4 reports them

  const r = await fetchFrame(ROOT, fileKey, nodeId, { offline });
  let varMap = null;
  if (!noVars) {
    // --allow-stale-dump: watch mode (C6.3) — warn instead of refuse on version drift
    varMap = await loadVariableMap(ROOT, fileKey, r.fileVersion, { allowStale: flags.includes('--allow-stale-dump') });
  }
  const { root, refusals } = buildIr(r.document, varMap);
  const { exportSvgs, svgIdsOf, exportImageFills, imageRefsOf } = await import('../src/assets.mjs');
  const svg = await exportSvgs(ROOT, fileKey, svgIdsOf(root), { offline, version: r.fileVersion }); // version-keyed cache (C11 G7): a Figma vector edit invalidates its export
  // image fills → ORIGINALS into the package's assets/ (Dan pin: complete self-contained package)
  const outDirBase = outFlag >= 0 ? flags[outFlag + 1] : null;
  const imgRefs = imageRefsOf(root);
  // export to a staging dir first (slug not known yet), then the emit tells us the folder
  const imgStage = path.join(ROOT, 'cache', 'assets', fileKey, 'images');
  const imgs = await exportImageFills(fileKey, imgRefs, imgStage, { offline });
  const out = emit(root, r.document.name ?? 'Frame', { assets: svg.assets, images: imgs.images, audit: flags.includes('--audit') });
  const outDir = outDirBase ?? path.join(ROOT, 'out', out.slug);
  await fs.mkdir(outDir, { recursive: true });
  // materialize the package's assets/ from staging (byte-exact copies)
  if (imgs.images.size) {
    await fs.mkdir(path.join(outDir, 'assets'), { recursive: true });
    for (const { file } of imgs.images.values()) {
      await fs.copyFile(path.join(imgStage, file), path.join(outDir, 'assets', file));
    }
  }
  await fs.writeFile(path.join(outDir, `${out.componentName}.tsx`), out.tsx);
  await fs.writeFile(path.join(outDir, `${out.slug}.module.css`), out.css);
  await fs.writeFile(path.join(outDir, 'page.tsx'), out.pageTsx);
  if (out.themeCss) await fs.writeFile(path.join(outDir, 'theme.css'), out.themeCss); // ships the dark-surface def with the package
  // machine-readable run record — the conformance report (C1.4) builds on this
  let absoluteCount = 0; // canon rule 8 strict budget (lead C1 F4)
  (function countAbs(n) { if (n.absolute) absoluteCount++; n.children.forEach(countAbs); })(root);
  await fs.writeFile(path.join(outDir, 'convert-run.json'), JSON.stringify({
    fileKey, nodeId, fileVersion: r.fileVersion, contentHash: r.contentHash, absoluteCount,
    idMap: out.idMap, refusals, notes: out.notes,
    assetHashes: svg.hashes, missingAssets: svg.missing, // AC4/F7: assets by content hash
    imageHashes: Object.fromEntries([...imgs.images].map(([ref, v]) => [ref, v.hash])),
    missingImages: imgs.missing,
  }, null, 2) + '\n');
  console.log(`emitted: ${outDir}`);
  console.log(`  ${out.componentName}.tsx (${out.tsx.length}B) · ${out.slug}.module.css (${out.css.length}B) · page.tsx`);
  const approx = out.notes.filter((n) => n.kind === 'approximation').length;
  console.log(`  elements: ${out.idMap.length} · refusals: ${refusals.length} · approximations: ${approx} · pending assets: ${out.notes.length - approx}`);

  // ── the gates (§4/§4b): census · canon · reverse round-trip · conformance — every run ──
  const tsxPath = path.join(outDir, `${out.componentName}.tsx`);
  const cssPath = path.join(outDir, `${out.slug}.module.css`);
  const runPath2 = path.join(outDir, 'convert-run.json');

  const { execFileSync } = await import('node:child_process');
  const { nodes: nodesPath } = (await import('../src/fetch.mjs')).cachePaths(ROOT, fileKey, nodeId);
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'census/walk.mjs'), nodesPath, runPath2], { stdio: 'pipe' });
    console.log('  census: OK (independent walker agrees)');
  } catch (e) { console.error(`  census: FAIL\n${e.stderr}`); process.exit(1); }

  const { canonCheck } = await import('../src/canon-check.mjs');
  const canon = await canonCheck({ tsxPath, cssPath, runPath: runPath2 });
  if (!canon.pass) { console.error(`  canon: FAIL ×${canon.violations.length}`, canon.violations.slice(0, 5)); process.exit(1); }
  console.log('  canon: OK (0 violations)');

  const { reverseCheck } = await import('../src/reverse.mjs');
  const rev = await reverseCheck({ ir: root, tsxPath, cssPath, images: imgs.images });
  if (!rev.pass) { console.error(`  reverse round-trip: FAIL ×${rev.diff.length}`, rev.diff.slice(0, 5)); process.exit(1); }
  console.log('  reverse round-trip: OK (diff 0)');

  const tokensFlag = flags.indexOf('--tokens-css');
  if (tokensFlag >= 0) {
    const { buildConformance } = await import('../src/conformance.mjs');
    const rep = await buildConformance({
      cssPath, runPath: runPath2, tokensCssPath: flags[tokensFlag + 1], rawNodesPath: nodesPath,
      mdPath: path.join(outDir, 'CONFORMANCE.md'), jsonPath: path.join(outDir, 'conformance.json'),
    });
    console.log(`  conformance: coverage ${rep.tokenCoveragePct}% · unresolved ${rep.unresolved.length} · raws ${rep.raws.length} · ${rep.pass ? 'OK' : 'FAIL'}`);
    if (!rep.pass) process.exit(1);
    // fonts packaging (Dan): resolve the FONTS list against the repo font library so the
    // package carries the full match — a family missing from the library is reported loudly.
    const fontsFlag = flags.indexOf('--fonts-dir');
    if (fontsFlag >= 0 && rep.fonts.length) {
      const { packageFonts } = await import('../src/fonts.mjs');
      const fr = await packageFonts({
        outDir, fontsDir: flags[fontsFlag + 1], families: rep.fonts, pageTsxPath: path.join(outDir, 'page.tsx'),
      });
      console.log(`  fonts: ${fr.files.length} file(s) packaged [${fr.found.join(', ')}]${fr.missing.length ? ` · MISSING IN LIBRARY: ${fr.missing.join(', ')}` : ''}`);
    }
  }
} else if (cmd === 'check') {
  // F2 (lead C1): gate the OUTPUT ON DISK — no re-emit, so hand-mutations can't be clobbered.
  const { buildIr } = await import('../src/ir.mjs');
  const { promises: fs } = await import('node:fs');
  const outFlag = flags.indexOf('--out');
  if (outFlag < 0) { console.error('check requires --out <dir>'); process.exit(2); }
  const outDir = flags[outFlag + 1];
  const run = JSON.parse(await fs.readFile(path.join(outDir, 'convert-run.json'), 'utf8'));
  const r = await fetchFrame(ROOT, fileKey, nodeId, { offline: true }); // cache only — never mutates
  // F1 (lead C2): build the SAME IR convert did — with the varMap. §3.6 heading promotion is
  // token-driven (a bound size token → h1–h5), so a null varMap yields <span> where the emitted
  // code has <hN>, false-positiving the reverse gate on pristine output. Mirror convert's --no-vars.
  const noVars = flags.includes('--no-vars');
  const varMap = noVars ? null : await loadVariableMap(ROOT, fileKey, r.fileVersion);
  const { root } = buildIr(r.document, varMap);
  const { imageRefsOf } = await import('../src/assets.mjs');
  const images = new Map(imageRefsOf(root).map((ref) => [ref, { file: `${ref}.png` }]));
  const files = await fs.readdir(outDir);
  const tsxPath = path.join(outDir, files.find((f) => /^[A-Z].*\.tsx$/.test(f)));
  const cssPath = path.join(outDir, files.find((f) => f.endsWith('.module.css')));
  const runPath3 = path.join(outDir, 'convert-run.json');

  let fail = false;
  const { execFileSync } = await import('node:child_process');
  const { nodes: nodesPath } = (await import('../src/fetch.mjs')).cachePaths(ROOT, fileKey, nodeId);
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'census/walk.mjs'), nodesPath, runPath3], { stdio: 'pipe' });
    console.log('  census: OK');
  } catch (e) { console.error(`  census: FAIL\n${e.stderr}`); fail = true; }
  const { canonCheck } = await import('../src/canon-check.mjs');
  const canon = await canonCheck({ tsxPath, cssPath, runPath: runPath3 });
  console.log(canon.pass ? '  canon: OK (0 violations)' : `  canon: FAIL ×${canon.violations.length} ${JSON.stringify(canon.violations.slice(0, 3))}`);
  if (!canon.pass) fail = true;
  const { reverseCheck } = await import('../src/reverse.mjs');
  const rev = await reverseCheck({ ir: root, tsxPath, cssPath, images });
  console.log(rev.pass ? '  reverse round-trip: OK (diff 0)' : `  reverse round-trip: FAIL ×${rev.diff.length} ${JSON.stringify(rev.diff.slice(0, 3))}`);
  if (!rev.pass) fail = true;
  const tokensFlag2 = flags.indexOf('--tokens-css');
  if (tokensFlag2 >= 0) {
    const { buildConformance } = await import('../src/conformance.mjs');
    const rep = await buildConformance({
      cssPath, runPath: runPath3, tokensCssPath: flags[tokensFlag2 + 1], rawNodesPath: nodesPath,
      mdPath: path.join(outDir, 'CONFORMANCE.md'), jsonPath: path.join(outDir, 'conformance.json'),
    });
    console.log(`  conformance: coverage ${rep.tokenCoveragePct}% · unresolved ${rep.unresolved.length} · ${rep.pass ? 'OK' : 'FAIL'}`);
    if (!rep.pass) fail = true;
  }
  process.exit(fail ? 1 : 0);
} else if (cmd === 'watch') {
  // ── C6 rework (s58-qa BLOCKER): the measured-visual gate is part of promotion when
  // --fidelity-route is given: convert → structural gates → promote → screenshot the live route →
  // pixel-judge vs Figma's render (ledgered regions masked) → over budget = ROLLBACK to the
  // previous good output + loud HELD-VISUAL. Without the flag, watch provides STRUCTURAL
  // error-hold only (SPEC §2 says exactly which). Chrome runs via sh (node-direct SIGTRAPs).
  // C6.3 (KAI-9346): Figma → build, live. Poll version; on change convert to STAGING; only a run
  // with ALL gates green replaces --out (error-hold: broken edits never clobber the last good build).
  const { fetchFileVersion } = await import('../src/fetch.mjs');
  const { cpSync, rmSync } = await import('node:fs');
  const { execFileSync } = await import('node:child_process');
  const outFlag = flags.indexOf('--out');
  if (outFlag < 0) { console.error('watch requires --out <dir>'); process.exit(2); }
  const outDir = flags[outFlag + 1];
  const tokensFlag = flags.indexOf('--tokens-css');
  const intervalFlag = flags.indexOf('--interval');
  const interval = (intervalFlag >= 0 ? parseFloat(flags[intervalFlag + 1]) : 6) * 1000;
  const staging = `${outDir}.staging`;
  const prevDir = `${outDir}.prev`;
  const self = process.argv[1];
  const fidelityFlag = flags.indexOf('--fidelity-route');
  const fidelityRoute = fidelityFlag >= 0 ? flags[fidelityFlag + 1] : null;
  const budgetFlag = flags.indexOf('--budget');
  const budget = budgetFlag >= 0 ? parseFloat(flags[budgetFlag + 1]) : 10;
  const { figmaToken, cachePaths, cacheDir } = await import('../src/fetch.mjs');
  const { writeGatePage, judgeDom } = await import('../audit/fidelity-gate.mjs');
  const { readFileSync, writeFileSync, existsSync, mkdirSync } = await import('node:fs');
  const sh = (cmdline) => execFileSync('/bin/sh', ['-c', cmdline], { encoding: 'utf8', timeout: 90000, stdio: ['ignore', 'pipe', 'ignore'] });

  /** Figma's own render of the frame, cached per file version. */
  async function figmaRender(version) {
    const dir = path.join(cacheDir(ROOT), 'renders'); mkdirSync(dir, { recursive: true });
    const f = path.join(dir, `${nodeId.replace(':', '-')}-${version}.png`);
    if (existsSync(f)) return f;
    const token = await figmaToken();
    const j = await (await fetch(`https://api.figma.com/v1/images/${fileKey}?ids=${nodeId}&format=png&scale=2`, { headers: { 'X-Figma-Token': token } })).json();
    const url = Object.values(j.images ?? {})[0];
    if (!url) throw new Error('figma render unavailable');
    writeFileSync(f, Buffer.from(await (await fetch(url)).arrayBuffer()));
    return f;
  }

  /** Post-promotion visual verdict: screenshot route, gate vs Figma render. */
  async function visualVerdict(version) {
    const { nodes: nodesPath } = cachePaths(ROOT, fileKey, nodeId);
    const raw = JSON.parse(readFileSync(nodesPath, 'utf8'));
    const W = Math.round(raw.absoluteBoundingBox.width), H = Math.round(raw.absoluteBoundingBox.height);
    const shot = path.join(staging, 'fg-route-shot.png');
    await new Promise((r) => setTimeout(r, 4500)); // let the dev server hot-reload the promotion
    // exact-viewport capture (raw headless Chrome enforces a ~500px min width → false fails)
    process.stderr.write('[watch] visual: capture… ');
    sh(`node "${path.join(ROOT, 'audit', 'capture.mjs')}" "${fidelityRoute}" "${shot}" ${W} ${H}`);
    process.stderr.write('render… ');
    writeGatePage({ outDir: staging, figmaPng: await figmaRender(version), convPng: shot, nodesPath });
    // the judge child serves the gate dir itself — watch is blocked in execFileSync during the
    // call, so ANY server hosted by this process would deadlock the child (live-hit)
    process.stderr.write('judge… ');
    const dom = sh(`node "${path.join(ROOT, 'audit', 'capture.mjs')}" "${staging}" --judge`);
    return judgeDom(dom, budget);
  }

  let last = null;
  console.log(`watch: ${fileKey}/${nodeId} every ${interval / 1000}s → ${outDir} (staging + error-hold)`);
  for (;;) {
    try {
      const v = await fetchFileVersion(fileKey);
      if (v !== last) {
        const t0 = Date.now();
        process.stdout.write(`[watch] version ${last === null ? 'initial' : 'changed'} → ${v} · converting… `);
        try {
          const args = [self, 'convert', urlArg, '--out', staging, '--allow-stale-dump'];
          if (tokensFlag >= 0) args.push('--tokens-css', flags[tokensFlag + 1]);
          const wFontsFlag = flags.indexOf('--fonts-dir'); // s58-qa C6 rework F1: forward, don't drop
          if (wFontsFlag >= 0) args.push('--fonts-dir', flags[wFontsFlag + 1]);
          const cOut = execFileSync(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
          // fonts packaging is part of the promotion contract — surface it (esp. MISSING IN LIBRARY)
          const fontsLine = cOut.split('\n').find((l) => l.includes('fonts:'));
          if (fontsLine) process.stdout.write(`${fontsLine.trim()} · `);
          rmSync(prevDir, { recursive: true, force: true });
          if (existsSync(outDir)) cpSync(outDir, prevDir, { recursive: true }); // rollback point
          rmSync(outDir, { recursive: true, force: true });
          cpSync(staging, outDir, { recursive: true });
          if (fidelityRoute) {
            // fail-closed (s58-qa C6 BLOCKER): a gate that cannot measure must not promote —
            // a capture/judge crash rolls back exactly like an over-budget verdict.
            let verdict;
            try { verdict = await visualVerdict(v); }
            catch (ve) { verdict = { ok: false, residual: null, error: String(ve.code ?? ve.message ?? ve).slice(0, 300) }; }
            if (!verdict.ok) { // over budget OR unmeasurable (judgeDom residual null / capture crash)
              rmSync(outDir, { recursive: true, force: true });
              if (existsSync(prevDir)) cpSync(prevDir, outDir, { recursive: true });
              const why = verdict.residual === null ? `unmeasured: ${verdict.error ?? 'no RESIDUAL in judge dom'}` : `residual ${verdict.residual}% > budget ${budget}%`;
              console.log(`✗ HELD-VISUAL — ${why}; ROLLED BACK to last good output`);
              last = v; continue;
            } else {
              console.log(`✓ live in ${Math.round((Date.now() - t0) / 100) / 10}s (all gates green · visual residual ${verdict.residual}% ≤ ${budget}%)`);
            }
          } else {
            console.log(`✓ live in ${Math.round((Date.now() - t0) / 100) / 10}s (structural gates green — no --fidelity-route, visual gate not run)`);
          }
          last = v;
        } catch (e) {
          console.log('✗ HELD — gates failed, last good output kept:');
          const fails = String(e.stdout ?? '').split('\n').filter((l) => l.includes('FAIL')).join('\n');
          console.error(fails || String(e.stderr ?? '').slice(-400) || String(e.stdout ?? '').slice(-400) || String(e.message ?? e).slice(0, 400));
          last = v; // don't thrash on the same broken version; next edit retriggers
        }
      }
    } catch (e) { console.error(`[watch] probe error: ${e.message}`); }
    await new Promise((r) => setTimeout(r, interval));
  }
} else {
  usage();
}
