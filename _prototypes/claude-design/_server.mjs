// Dev server for the Creator design tools — static files + DIRECT SAVE write-back.
// Replaces `python -m http.server 8756`. Reuses the proven deterministic baker
// (session-canons/apply-token-edits.js) so the inspector's "Save → bake" writes
// straight to the screen source — no localStorage-only bake, no agent round-trip.
//
//   node _server.mjs        (run from the design-vault current/ dir)
import http from 'http';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { applyEdits } = require('./session-canons/apply-token-edits.js');

const ROOT = dirname(fileURLToPath(import.meta.url));   // serve from this file's dir (current/), cwd-independent
const PORT = 8756;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg',
  '.webp':'image/webp', '.ts':'text/plain', '.liquid':'text/plain', '.woff2':'font/woff2' };

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── DIRECT SAVE: POST /api/bake  body = { "<screen>": { "<data-anat>": { "<prop>": "var(--token)"|null } } }
  if (req.method === 'POST' && req.url.split('?')[0] === '/api/bake') {
    let body=''; req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const queue = JSON.parse(body || '{}');
        const result = {};
        for (const screen of Object.keys(queue)) {
          const file = join(ROOT, screen + '.dc.html');
          if (!existsSync(file)) { result[screen] = { error: 'no source file: ' + screen + '.dc.html' }; continue; }
          const src = await readFile(file, 'utf8');
          const { src: out, log, errors } = applyEdits(src, queue[screen]);
          const okCount = log.filter(l => l.startsWith('OK')).length;
          if (okCount > 0) await writeFile(file, out, 'utf8');   // apply the valid edits; skipped anchors reported
          result[screen] = { saved: okCount, skipped: errors.length, log, errors };
        }
        res.writeHead(200, { 'Content-Type':'application/json' });
        res.end(JSON.stringify({ ok: true, result }, null, 2));
      } catch (e) {
        res.writeHead(500, { 'Content-Type':'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
      }
    });
    return;
  }

  // ── static GET
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/_resizer.html';
  const file = join(ROOT, p);
  if (!existsSync(file) || !file.startsWith(ROOT)) { res.writeHead(404); res.end('not found'); return; }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
    res.end(data);
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
server.listen(PORT, '0.0.0.0', () => console.log('✓ Creator dev server (static + /api/bake direct-save) on http://0.0.0.0:' + PORT));
