#!/usr/bin/env node
// figma-to-code STUDIO — the deterministic conversion app (C10.1, Dan's brief verbatim:
// "paste the figma screen link … the converter auto converts and saves it like a tab …
// deterministic entire block of the tools working by themselves not needing coding or agents").
//
// One zero-dependency node server that packages the whole pipeline behind a browser UI:
//   paste link → fetch → convert --audit (all gates) → audit-export → fidelity captures → TAB.
// Sandbox = a GITIGNORED folder inside the app worktree (converted React needs the Next dev
// server to render — files outside the repo can't render); promote copies the accepted screen
// into the real converted/ route as a clean PRODUCT build (no data-fc stamps).
// The server PROXIES the Next app so console + screens share one origin (the inspector reads
// the iframe document — cross-origin would kill it).
//
//   usage: node studio/server.mjs          (or: npm run studio)
//   then open http://localhost:3900
//
// Config lives in studio/config.json next to this file. See STUDIO.md for the full manual.
import { createServer, request as httpRequest } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import { startBridgePeer } from '../src/bridge-peer.mjs';
import { toDsExport, toVariableDump } from '../src/ds-export.mjs';

const run = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOL = path.resolve(HERE, '..');

const cfg = JSON.parse(fs.readFileSync(path.join(HERE, 'config.json'), 'utf8'));
const APP = path.resolve(TOOL, cfg.appWorktree); // relative = resolved against the tool root (the tool lives inside the app repo)
const SANDBOX = path.join(APP, 'src/app/(dev)/converted/sandbox');
const PROMOTED = path.join(APP, 'src/app/(dev)/converted');
const AUDIT_PUB = path.join(APP, 'public/audit/sandbox');
const EXPORTS = path.resolve(TOOL, cfg.exportsDir || 'exports');
const TOKENS = path.join(APP, cfg.tokensCss);
const FONTS = path.join(APP, cfg.fontsDir);

// FIGMA_TOKEN: from the app worktree's .env.local (single source — no new secret paths)
for (const line of fs.readFileSync(path.join(cfg.envFile), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

// ── Desktop-Bridge peer (C10.4): the studio IS a bridge server — the Figma plugin scans
// 9223-9232, connects, and pushes the full variable catalog. No MCP, no agent, no manual export.
let bridge = null;
try { bridge = await startBridgePeer({ log: (m) => console.log(`[bridge] ${m}`) }); }
catch (e) { console.error(`[bridge] peer disabled: ${e.message}`); }

const slugOf = (dir) => fs.readdirSync(dir).find((f) => f.endsWith('.module.css'))?.replace(/\.module\.css$/, '');
const figmaUrlOf = (u) => { // accept any figma.com/design|file link with node-id
  const m = String(u).match(/figma\.com\/(?:design|file)\/([A-Za-z0-9]+)[^\s]*?node-id=([0-9]+)[-:]([0-9]+)/);
  return m ? { fileKey: m[1], nodeId: `${m[2]}:${m[3]}`, url: u } : null;
};
const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };

function urlOfScreen(slug) {
  for (const base of [SANDBOX, PROMOTED]) {
    const rj = path.join(base, slug, 'convert-run.json');
    if (fs.existsSync(rj)) { const r = JSON.parse(fs.readFileSync(rj, 'utf8')); return `https://www.figma.com/design/${r.fileKey}/x?node-id=${r.nodeId.replace(':', '-')}`; }
  }
  return null;
}
// current file version via REST (lightweight) — the dump must be stamped with it
async function fileVersionOf(fileKey) {
  const r = await fetch(`https://api.figma.com/v1/files/${fileKey}?depth=1`, { headers: { 'X-Figma-Token': process.env.FIGMA_TOKEN } });
  if (!r.ok) throw new Error(`REST version check failed: HTTP ${r.status}`);
  return (await r.json()).version;
}

// variables → BOTH artifacts: the converter's ID→name dump AND a regenerated tokens.css
// (synthesized DS-export JSON → ds-pipeline build-scan). This is what makes "edit tokens in
// Figma → Refresh" work with no manual JSON export (Dan's directive).
async function syncVariables(fileKey) {
  if (!bridge) throw new Error('bridge peer disabled (port range full)');
  const data = await bridge.freshVariables();               // fresh if plugin connected, cached else, throws if neither
  if (data.fileKey && data.fileKey !== fileKey) throw new Error(`bridge is attached to file ${data.fileKey}, not ${fileKey} — open the right file in Figma`);
  const fileVersion = await fileVersionOf(fileKey);
  // 1. converter dump
  await fsp.writeFile(path.join(TOOL, `cache/${fileKey}.variables.json`), JSON.stringify(toVariableDump(data, fileKey, fileVersion), null, 1));
  // 2. tokens.css regeneration via the DS pipeline (ad-hoc --output-dir; only tokens.css is copied in)
  let tokensRegenerated = false;
  if (cfg.dsBuildScan && fs.existsSync(cfg.dsBuildScan)) {
    const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'fc-ds-'));
    const inputJson = path.join(tmp, 'ds-live.json');
    await fsp.writeFile(inputJson, JSON.stringify(toDsExport(data), null, 1));
    await run('node', [cfg.dsBuildScan, '--input', inputJson, '--output-dir', tmp], { env: process.env, timeout: 60000, maxBuffer: 8e6 });
    const built = path.join(tmp, path.basename(TOKENS));
    if (!fs.existsSync(built)) throw new Error('build-scan produced no tokens.css');
    await fsp.copyFile(built, TOKENS); tokensRegenerated = true;
    await fsp.rm(tmp, { recursive: true, force: true });
  }
  return { variables: data.variables?.length ?? 0, fileVersion, tokensRegenerated, live: bridge.state.connected };
}

async function refreshScreen(slug) { // FORCE re-pull: variables + token system + nodes (Dan: one button keeps everything updated)
  const url = urlOfScreen(slug);
  if (!url) throw new Error(`no linked Figma URL for "${slug}"`);
  const { fileKey } = figmaUrlOf(url);
  let vars = null, varsError = null;
  try { vars = await syncVariables(fileKey); }
  catch (e) { varsError = e.message; }                       // plugin closed → still refresh nodes; stale dump fails loudly downstream
  const converted = await convertScreen(url);                // no --offline → fetches the latest nodes, all gates
  return { ...converted, variables: vars, variablesError: varsError };
}
async function convertScreen(url) {
  const parsed = figmaUrlOf(url);
  if (!parsed) throw new Error('Not a Figma frame link (needs …figma.com/design/<key>/…?node-id=N-N)');
  await fsp.mkdir(SANDBOX, { recursive: true }); await fsp.mkdir(AUDIT_PUB, { recursive: true });
  const tmp = path.join(SANDBOX, `_tmp-${Date.now()}`);
  const cli = path.join(TOOL, 'bin/figma-to-code.mjs');
  // full pipeline, all gates — a gate failure surfaces VERBATIM in the UI (fail loud, never silent)
  try {
    await run('node', [cli, 'convert', url, '--audit', '--out', tmp, '--tokens-css', TOKENS, '--fonts-dir', FONTS],
      { env: process.env, timeout: 120000, maxBuffer: 8e6 });
  } catch (e) {
    await fsp.rm(tmp, { recursive: true, force: true });
    throw new Error((e.stdout || '') + (e.stderr || e.message));
  }
  const slug = slugOf(tmp); if (!slug) { await fsp.rm(tmp, { recursive: true, force: true }); throw new Error('convert produced no package'); }
  const dest = path.join(SANDBOX, slug);
  await fsp.rm(dest, { recursive: true, force: true }); // override = re-convert same screen
  await fsp.rename(tmp, dest);
  // audit backbone for the console
  const nodesCache = path.join(TOOL, `cache/${parsed.fileKey}-${parsed.nodeId.replace(':', '-')}.nodes.json`);
  await run('node', [path.join(TOOL, 'audit/audit-export.mjs'), dest, nodesCache, TOKENS, '--out', path.join(AUDIT_PUB, `${slug}.json`)], { env: process.env, maxBuffer: 8e6 });
  // fidelity pair — Figma's own render (REST) + the live build (captured once Next compiles the route)
  fidelityPair(parsed, slug).catch((e) => console.error(`[studio] fidelity ${slug}:`, e.message));
  // warm the route so the operator doesn't land on a blank/compiling iframe (meta-qa HIGH #1). Next
  // compiles on-demand; a huge screen (e.g. the fixture board) can exceed this — report routeReady
  // honestly rather than hang, and the console keeps polling.
  const routeReady = await warmRoute(`sandbox/${slug}`, 30000);
  return { slug, nodeId: parsed.nodeId, routeReady };
}

// poll a converted route on the Next dev server until it serves 200 (on-demand compile), bounded.
async function warmRoute(routePath, budgetMs = 25000) {
  const url = `http://127.0.0.1:${cfg.nextPort}/converted/${routePath}`;
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    try { const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 4000);
      const ok = (await fetch(url, { signal: ac.signal })).ok; clearTimeout(t); if (ok) return true; }
    catch { /* compiling / not ready */ }
    await new Promise((r) => setTimeout(r, 1200));
  }
  return false;
}

// ensure an INSPECTABLE (audit) build + audit.json exist for a screen (meta-qa HIGH #2: accepted-only
// Library screens have only a product build → not openable). Re-materialize the audit build from the
// committed cache, deterministically, then warm its route.
async function ensureAudit(slug) {
  const dest = path.join(SANDBOX, slug), auditJson = path.join(AUDIT_PUB, `${slug}.json`);
  if (!fs.existsSync(path.join(dest, 'convert-run.json')) || !fs.existsSync(auditJson)) {
    const runJson = fs.existsSync(path.join(PROMOTED, slug, 'convert-run.json')) ? path.join(PROMOTED, slug, 'convert-run.json') : path.join(dest, 'convert-run.json');
    if (!fs.existsSync(runJson)) throw new Error(`no build to inspect for "${slug}"`);
    const { nodeId, fileKey } = JSON.parse(await fsp.readFile(runJson, 'utf8'));
    const url = `https://www.figma.com/design/${fileKey}/x?node-id=${nodeId.replace(':', '-')}`;
    const cli = path.join(TOOL, 'bin/figma-to-code.mjs');
    await fsp.mkdir(SANDBOX, { recursive: true }); await fsp.mkdir(AUDIT_PUB, { recursive: true });
    await run('node', [cli, 'convert', url, '--offline', '--audit', '--out', dest, '--tokens-css', TOKENS, '--fonts-dir', FONTS], { env: process.env, timeout: 120000, maxBuffer: 8e6 });
    const nodesCache = path.join(TOOL, `cache/${fileKey}-${nodeId.replace(':', '-')}.nodes.json`);
    await run('node', [path.join(TOOL, 'audit/audit-export.mjs'), dest, nodesCache, TOKENS, '--out', auditJson], { env: process.env, maxBuffer: 8e6 });
  }
  return { slug, routeReady: await warmRoute(`sandbox/${slug}`, 30000) };
}

async function fidelityPair(parsed, slug) {
  const r = await fetch(`https://api.figma.com/v1/images/${parsed.fileKey}?ids=${parsed.nodeId}&scale=2&format=png`,
    { headers: { 'X-Figma-Token': process.env.FIGMA_TOKEN } });
  const img = (await r.json()).images?.[parsed.nodeId];
  if (img) await fsp.writeFile(path.join(AUDIT_PUB, `${slug}-figma.png`), Buffer.from(await (await fetch(img)).arrayBuffer()));
  const audit = JSON.parse(await fsp.readFile(path.join(AUDIT_PUB, `${slug}.json`), 'utf8'));
  const route = `http://127.0.0.1:${cfg.nextPort}/converted/sandbox/${slug}`;
  for (let i = 0; i < 20; i++) { // wait for Next to compile the fresh route
    try { if ((await fetch(route)).ok) break; } catch { /* dev server warming */ }
    await new Promise((r2) => setTimeout(r2, 1500));
  }
  await run('node', [path.join(TOOL, 'audit/capture.mjs'), route, path.join(AUDIT_PUB, `${slug}-build.png`), String(audit.frame.w), String(audit.frame.h)], { env: process.env, timeout: 60000 });
}

// One legible registry: every screen the operator has, with its acceptance status.
//  · draft    = a sandbox conversion, inspectable, NOT yet saved to the app
//  · accepted = promoted to a committed converted/<slug> route (saved; ships with the app)
// A screen can be both (accepted + still has its draft to re-inspect). Built-in reference
// screens (mother-v2, the audit builds) are accepted and read-only (no draft to discard).
const BUILTIN = new Set(['mother-v2', 'audit-mother-v2', 'audit-editor-402', 'fixtures']);
function readName(slug, inSandbox) {
  const p = inSandbox ? path.join(AUDIT_PUB, `${slug}.json`) : null;
  try { if (p) { const a = JSON.parse(fs.readFileSync(p, 'utf8')); return { name: a.name, frame: a.frame }; } } catch { /* pending */ }
  return { name: slug, frame: null };
}
function listScreens() {
  const drafts = fs.existsSync(SANDBOX)
    ? fs.readdirSync(SANDBOX).filter((d) => !d.startsWith('_') && fs.existsSync(path.join(SANDBOX, d, 'convert-run.json'))) : [];
  const accepted = fs.existsSync(PROMOTED)
    ? fs.readdirSync(PROMOTED).filter((d) => !d.startsWith('audit-') && d !== 'sandbox' && fs.existsSync(path.join(PROMOTED, d, 'convert-run.json'))) : [];
  // two zones: CONVERSIONS (sandbox drafts — scratch, clearable) and SAVED (promoted routes —
  // committed backup). A screen can be in both (saved, still has its draft to re-inspect).
  const slugs = [...new Set([...drafts, ...accepted])].filter((slug) => !BUILTIN.has(slug));
  return slugs.map((slug) => {
    const hasDraft = drafts.includes(slug), isAccepted = accepted.includes(slug);
    const { name, frame } = readName(slug, hasDraft);
    return { slug, name, frame, status: isAccepted ? 'accepted' : 'draft', hasDraft, accepted: isAccepted, builtin: false };
  }).sort((a, b) => (a.accepted === b.accepted ? a.name.localeCompare(b.name) : a.accepted ? 1 : -1));
}

// Export a portable integration bundle OUT of the app, for dropping into a dev/prod product.
// Ships only the runtime files (component, styles, self-contained tokens, theme, fonts, assets,
// manifest) — dev/audit metadata excluded. Reveals the folder in Finder (macOS).
const BUNDLE_META_SKIP = new Set(['convert-run.json', 'conformance.json', 'CONFORMANCE.md', 'anatomy.html', 'audit.json']);
async function exportBundle(slug) {
  await promote(slug); // guarantee a fresh self-contained bundle in converted/<slug>
  const src = path.join(PROMOTED, slug), out = path.join(EXPORTS, slug);
  await fsp.rm(out, { recursive: true, force: true }); await fsp.mkdir(out, { recursive: true });
  for (const f of fs.readdirSync(src)) if (!BUNDLE_META_SKIP.has(f)) await fsp.cp(path.join(src, f), path.join(out, f), { recursive: true });
  try { await run('open', [out]); } catch { /* non-macOS/headless — path still returned */ }
  return { export: out };
}

async function promote(slug) {
  const src = path.join(SANDBOX, slug);
  if (!fs.existsSync(src)) throw new Error(`no sandbox screen "${slug}"`);
  const { nodeId, fileKey } = JSON.parse(await fsp.readFile(path.join(src, 'convert-run.json'), 'utf8'));
  const dest = path.join(PROMOTED, slug);
  const cli = path.join(TOOL, 'bin/figma-to-code.mjs');
  // promoted = clean PRODUCT build (no data-fc), from the same cached data — deterministic
  const url = `https://www.figma.com/design/${fileKey}/x?node-id=${nodeId.replace(':', '-')}`;
  await run('node', [cli, 'convert', url, '--offline', '--out', dest, '--tokens-css', TOKENS, '--fonts-dir', FONTS], { env: process.env, timeout: 120000, maxBuffer: 8e6 });
  // self-contained bundle (Dan): extract the exact tokens this screen uses into its own tokens.css
  // so the folder integrates into any product without an external design-system stylesheet.
  const { bundleTokensCss } = await import(path.join(TOOL, 'src/bundle.mjs'));
  const moduleCssFile = fs.readdirSync(dest).find((f) => f.endsWith('.module.css'));
  const themeCssPath = path.join(dest, 'theme.css');
  const extraCss = fs.existsSync(themeCssPath) ? await fsp.readFile(themeCssPath, 'utf8') : '';
  const { css: tokCss, used, unresolved } = bundleTokensCss(await fsp.readFile(path.join(dest, moduleCssFile), 'utf8'), await fsp.readFile(TOKENS, 'utf8'), extraCss);
  await fsp.writeFile(path.join(dest, 'tokens.css'), tokCss);
  // page.tsx imports tokens.css FIRST (definitions before consumers) — insert ahead of fonts.css
  const pageFile = path.join(dest, 'page.tsx'); let page = await fsp.readFile(pageFile, 'utf8');
  if (!page.includes("./tokens.css")) { page = page.replace(/^/, "import './tokens.css';\n"); await fsp.writeFile(pageFile, page); }
  const hasImgs = fs.existsSync(path.join(dest, 'assets'));
  const md = [
    `# ${slug} — self-contained conversion bundle`, '',
    'Drop this folder into a product and it renders without external design-system wiring.', '',
    '## What ships',
    `- \`page.tsx\` / \`${moduleCssFile.replace('.module.css', '')}.tsx\` — the component + full structure`,
    `- \`${moduleCssFile}\` — styles (reference only the tokens below)`,
    `- \`tokens.css\` — **${used.length} design tokens** this screen uses, extracted from the DS (light + dark scopes) — the self-containment guarantee`,
    '- \`theme.css\` — dark-mode surface handling',
    '- \`fonts.css\` + \`fonts/\` — packaged woff2 (exact weights)',
    ...(hasImgs ? ['- \`assets/\` — byte-exact images + inline SVGs'] : []),
    '', '## Integrate',
    `\`import Page from './${slug}/page'\` (or copy the folder under your route). Nothing else required.`, '',
    unresolved.length
      ? `## ⚠ Unresolved (${unresolved.length}) — would break on integration\n${unresolved.map((u) => `- \`${u}\` — not found in the DS tokens.css`).join('\n')}`
      : '_All tokens resolved — no external dependency._',
  ].join('\n') + '\n';
  await fsp.writeFile(path.join(dest, 'BUNDLE.md'), md);
  return { dest: path.relative(APP, dest), tokens: used.length, unresolved: unresolved.length };
}

const server = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  try {
    if (u.pathname === '/api/root' && req.method === 'GET') return json(res, 200, { tool: TOOL, app: APP });
    if (u.pathname === '/api/bridge' && req.method === 'GET')
      return json(res, 200, bridge ? { port: bridge.port, connected: bridge.state.connected, variables: bridge.state.variables?.variables?.length ?? 0, variablesAt: bridge.state.variablesAt, fileKey: bridge.state.variables?.fileKey ?? null } : { disabled: true });
    const bd = u.pathname.match(/^\/api\/bridge\/dump\/([A-Za-z0-9]+)$/);
    if (bd && req.method === 'POST') {
      try { return json(res, 200, await syncVariables(bd[1])); }
      catch (e) { return json(res, 422, { error: String(e.message).slice(0, 2000) }); }
    }
    if (u.pathname === '/api/screens' && req.method === 'GET') return json(res, 200, listScreens());
    if (u.pathname === '/api/convert' && req.method === 'POST') {
      let body = ''; for await (const c of req) body += c;
      try { return json(res, 200, await convertScreen(JSON.parse(body).url)); }
      catch (e) { return json(res, 422, { error: String(e.message).slice(0, 4000) }); }
    }
    if (u.pathname === '/api/clear-conversions' && req.method === 'POST') {
      let cleared = 0;
      if (fs.existsSync(SANDBOX)) for (const slug of fs.readdirSync(SANDBOX)) {
        if (slug.startsWith('_') || BUILTIN.has(slug)) continue;
        await fsp.rm(path.join(SANDBOX, slug), { recursive: true, force: true });
        for (const f of [`${slug}.json`, `${slug}-figma.png`, `${slug}-build.png`]) await fsp.rm(path.join(AUDIT_PUB, f), { force: true });
        cleared++;
      }
      return json(res, 200, { cleared }); // Saved (promoted) routes are in converted/<slug> — untouched
    }
    const del = u.pathname.match(/^\/api\/screens\/([a-z0-9-]+)$/);
    if (del && req.method === 'DELETE') {
      const scope = u.searchParams.get('scope') || 'all'; // draft | accepted | all
      if (scope === 'draft' || scope === 'all') {
        await fsp.rm(path.join(SANDBOX, del[1]), { recursive: true, force: true });
        for (const f of [`${del[1]}.json`, `${del[1]}-figma.png`, `${del[1]}-build.png`]) await fsp.rm(path.join(AUDIT_PUB, f), { force: true });
      }
      if (scope === 'accepted' || scope === 'all') { // remove the committed route (git tracks the deletion — a backed-up removal)
        await fsp.rm(path.join(PROMOTED, del[1]), { recursive: true, force: true });
      }
      return json(res, 200, { deleted: del[1], scope });
    }
    const ref = u.pathname.match(/^\/api\/refresh\/([a-z0-9-]+)$/);
    if (ref && req.method === 'POST') {
      try { return json(res, 200, await refreshScreen(ref[1])); }
      catch (e) { return json(res, 422, { error: String(e.message).slice(0, 4000) }); }
    }
    const ea = u.pathname.match(/^\/api\/ensure-audit\/([a-z0-9-]+)$/);
    if (ea && req.method === 'POST') {
      try { return json(res, 200, await ensureAudit(ea[1])); }
      catch (e) { return json(res, 422, { error: String(e.message).slice(0, 4000) }); }
    }
    const exp = u.pathname.match(/^\/api\/export\/([a-z0-9-]+)$/);
    if (exp && req.method === 'POST') {
      try { return json(res, 200, await exportBundle(exp[1])); }
      catch (e) { return json(res, 422, { error: String(e.message).slice(0, 4000) }); }
    }
    const pro = u.pathname.match(/^\/api\/promote\/([a-z0-9-]+)$/);
    if (pro && req.method === 'POST') {
      try { return json(res, 200, await promote(pro[1])); }
      catch (e) { return json(res, 422, { error: String(e.message).slice(0, 4000) }); }
    }
    // the console itself — always the freshest source from the converter repo
    if (u.pathname === '/' || u.pathname === '/audit-console.html') {
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end(await fsp.readFile(path.join(TOOL, 'audit/console.html')));
    }
    // everything else (converted routes, audit data, HMR) proxies to the Next dev app — one origin
    const p = httpRequest({ host: '127.0.0.1', port: cfg.nextPort, path: req.url, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${cfg.nextPort}` } },
      (up) => { res.writeHead(up.statusCode, up.headers); up.pipe(res); });
    p.on('error', () => json(res, 502, { error: `Next dev app not reachable on :${cfg.nextPort} — start it first` }));
    req.pipe(p);
  } catch (e) { json(res, 500, { error: String(e.message) }); }
});
server.listen(cfg.port, () => console.log(`figma-to-code studio → http://localhost:${cfg.port}  (sandbox: ${SANDBOX})`));
