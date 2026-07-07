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

const run = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOL = path.resolve(HERE, '..');

const cfg = JSON.parse(fs.readFileSync(path.join(HERE, 'config.json'), 'utf8'));
const APP = path.resolve(TOOL, cfg.appWorktree); // relative = resolved against the tool root (the tool lives inside the app repo)
const SANDBOX = path.join(APP, 'src/app/(dev)/converted/sandbox');
const PROMOTED = path.join(APP, 'src/app/(dev)/converted');
const AUDIT_PUB = path.join(APP, 'public/audit/sandbox');
const TOKENS = path.join(APP, cfg.tokensCss);
const FONTS = path.join(APP, cfg.fontsDir);

// FIGMA_TOKEN: from the app worktree's .env.local (single source — no new secret paths)
for (const line of fs.readFileSync(path.join(cfg.envFile), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const slugOf = (dir) => fs.readdirSync(dir).find((f) => f.endsWith('.module.css'))?.replace(/\.module\.css$/, '');
const figmaUrlOf = (u) => { // accept any figma.com/design|file link with node-id
  const m = String(u).match(/figma\.com\/(?:design|file)\/([A-Za-z0-9]+)[^\s]*?node-id=([0-9]+)[-:]([0-9]+)/);
  return m ? { fileKey: m[1], nodeId: `${m[2]}:${m[3]}`, url: u } : null;
};
const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };

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
  return { slug, nodeId: parsed.nodeId };
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

function listScreens() {
  if (!fs.existsSync(SANDBOX)) return [];
  return fs.readdirSync(SANDBOX).filter((d) => !d.startsWith('_') && fs.existsSync(path.join(SANDBOX, d, 'convert-run.json'))).map((slug) => {
    let name = slug, frame = null;
    try { const a = JSON.parse(fs.readFileSync(path.join(AUDIT_PUB, `${slug}.json`), 'utf8')); name = a.name; frame = a.frame; } catch { /* audit pending */ }
    return { slug, name, frame, promoted: fs.existsSync(path.join(PROMOTED, slug)) };
  });
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
  return { dest: path.relative(APP, dest) };
}

const server = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  try {
    if (u.pathname === '/api/screens' && req.method === 'GET') return json(res, 200, listScreens());
    if (u.pathname === '/api/convert' && req.method === 'POST') {
      let body = ''; for await (const c of req) body += c;
      try { return json(res, 200, await convertScreen(JSON.parse(body).url)); }
      catch (e) { return json(res, 422, { error: String(e.message).slice(0, 4000) }); }
    }
    const del = u.pathname.match(/^\/api\/screens\/([a-z0-9-]+)$/);
    if (del && req.method === 'DELETE') {
      await fsp.rm(path.join(SANDBOX, del[1]), { recursive: true, force: true });
      for (const f of [`${del[1]}.json`, `${del[1]}-figma.png`, `${del[1]}-build.png`]) await fsp.rm(path.join(AUDIT_PUB, f), { force: true });
      return json(res, 200, { deleted: del[1] });
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
