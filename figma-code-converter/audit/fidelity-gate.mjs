// Fidelity-budget gate (C6.2, KAI-9349) — "works on any screen" as a MACHINE-CHECKED property.
// Measures the pixel mismatch between Figma's render and the converted screen's render, MASKING
// the ledgered-approximation node regions (they are declared-lossy) + the Next dev badge, and
// FAILS (exit 1) when the residual exceeds the budget. A screen that regresses fidelity for an
// unledgered reason fails loudly, forever.
//
// usage: node audit/fidelity-gate.mjs <outDir> <figma.png> <converted.png> <raw-nodes.json>
//          [--budget 5] [--chrome "<path>"]
// Self-contained: serves the outDir on an ephemeral port, runs headless Chrome, parses the number.
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Build the gate page (masks + canvas diff) into outDir. Exported for watch (C6 rework). */
export function writeGatePage({ outDir, figmaPng, convPng, nodesPath }) {
  const run = JSON.parse(readFileSync(path.join(outDir, 'convert-run.json'), 'utf8'));
  const raw = JSON.parse(readFileSync(nodesPath, 'utf8'));
  const rootB = raw.absoluteBoundingBox;
  const byId = new Map();
  (function idx(n) { byId.set(n.id, n); (n.children || []).forEach(idx); })(raw);
  // C7.1 mask discipline: only PIXEL-VISIBLE approximations mask (GLASS, crop-skew, gradient
  // flatten). visual:false notes (baked svg bindings — values render correctly today, the loss
  // is semantic) never mask: a masked icon region would hide real regressions.
  const approxIds = [...new Set((run.notes ?? [])
    .filter((n) => n.kind === 'approximation' && n.visual !== false).map((n) => n.nodeId))];
  const masks = approxIds.map((id) => {
    const b = byId.get(id)?.absoluteBoundingBox;
    return b ? { x: Math.floor((b.x - rootB.x) * 2), y: Math.floor((b.y - rootB.y) * 2), w: Math.ceil(b.width * 2), h: Math.ceil(b.height * 2) } : null;
  }).filter(Boolean);
  // mask-area cap: masking is exclusion from measurement — past 8% of the frame, say so loudly
  const frameArea = rootB.width * 2 * rootB.height * 2;
  const maskedArea = masks.reduce((s, m) => s + m.w * m.h, 0);
  const maskedPct = frameArea ? Math.round((maskedArea / frameArea) * 10000) / 100 : 0;
  if (maskedPct > 8) {
    console.error(`fidelity-gate: WARNING — approximation masks exclude ${maskedPct}% of the frame from measurement:`);
    masks.forEach((m) => console.error(`  mask ${m.w}×${m.h} @ ${m.x},${m.y}`));
  }
  masks.push({ x: 0, y: -1, w: 220, h: 200, badge: true }); // Next dev badge (bottom-left; y<0 = from bottom)
  copyFileSync(figmaPng, path.join(outDir, 'fg-figma.png'));
  copyFileSync(convPng, path.join(outDir, 'fg-converted.png'));
  writeFileSync(path.join(outDir, 'fidelity-gate.html'), gateHtml(masks));
  return { masks, maskedPct };
}

/** Judge a dumped DOM against the budget. Exported for watch. */
export function judgeDom(dom, budget) {
  const m = dom.match(/RESIDUAL ([\d.]+)/);
  if (!m) return { ok: false, residual: null };
  const residual = parseFloat(m[1]);
  return { ok: residual <= budget, residual };
}

const gateHtml = (masks) => `<!doctype html><meta charset="utf-8"><div id="out">computing…</div><script>
const MASKS=${JSON.stringify(masks)};
const load=s=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=s;});
(async()=>{
  const [A,B]=await Promise.all([load('fg-figma.png'),load('fg-converted.png')]);
  const W=Math.min(A.width,B.width),H=Math.min(A.height,B.height);
  const t=document.createElement('canvas');t.width=W;t.height=H;const x=t.getContext('2d');
  x.drawImage(A,0,0);const da=x.getImageData(0,0,W,H).data;
  x.clearRect(0,0,W,H);x.drawImage(B,0,0);const db=x.getImageData(0,0,W,H).data;
  const masked=(px,py)=>MASKS.some(m=>{const y0=m.badge?H-m.h:m.y;return px>=m.x&&px<m.x+m.w&&py>=y0&&py<y0+m.h;});
  let n=0,mis=0;
  for(let y=0;y<H;y++)for(let xx=0;xx<W;xx++){
    if(masked(xx,y))continue;
    const i=(y*W+xx)*4;
    const d=Math.max(Math.abs(da[i]-db[i]),Math.abs(da[i+1]-db[i+1]),Math.abs(da[i+2]-db[i+2]));
    n++;if(d>32)mis++;
  }
  document.getElementById('out').textContent='RESIDUAL '+(mis/n*100).toFixed(2);
})();
</script>`;
// ── CLI (main-module only — watch imports the exports above; running this body on import
// would parse watch's argv and crash it) ──
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , OUT, FIGMA, CONV, NODES, ...rest] = process.argv;
  if (!OUT || !FIGMA || !CONV || !NODES) {
    console.error('usage: node audit/fidelity-gate.mjs <outDir> <figma.png> <converted.png> <raw-nodes.json> [--budget 5] [--chrome <path>]');
    process.exit(2);
  }
  const flag = (name, dflt) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : dflt; };
  const BUDGET = parseFloat(flag('--budget', '10')); // default = general text-AA floor (font rasterizer deltas); structural regressions measure far above it
  const CHROME = flag('--chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  const { masks } = writeGatePage({ outDir: OUT, figmaPng: FIGMA, convPng: CONV, nodesPath: NODES });

  // ── measure ──
  // Chrome is invoked FROM THE SHELL, not from node: on macOS a node-spawned headless Chrome
  // SIGTRAPs/hangs in interactive contexts (live-hit, three variants tried) while the identical
  // shell command works. So: serve, print the one-liner, and judge whatever DOM arrives on stdin
  // when piped — `... --dump-dom <url> | node audit/fidelity-gate.mjs ... --judge` — or read a
  // saved dom file via --dom <file>.
  const domFile = flag('--dom', null);
  const judge = rest.includes('--judge');
  const finish = (dom) => {
    const { ok, residual } = judgeDom(dom, BUDGET);
    if (residual === null) { console.error('fidelity-gate: could not measure (no RESIDUAL in dom)'); process.exit(1); }
    console.log(`fidelity-gate: residual ${residual}% (budget ${BUDGET}%) · masks: ${masks.length - 1} approximation region(s) + badge · ${ok ? 'OK' : 'FAIL'}`);
    process.exit(ok ? 0 : 1);
  };
  if (domFile) finish(readFileSync(domFile, 'utf8'));
  else if (judge) {
    let dom = '';
    process.stdin.setEncoding('utf8');
    for await (const chunk of process.stdin) dom += chunk;
    finish(dom);
  } else {
    // prep-only: serve the page and print the exact measure command
    const server = createServer((req, res) => {
      try { res.end(readFileSync(path.join(OUT, decodeURIComponent(new URL(req.url, 'http://x').pathname)))); }
      catch { res.statusCode = 404; res.end(); }
    });
    await new Promise((r) => server.listen(0, r));
    const port = server.address().port;
    console.log(`fidelity-gate: page ready — measure with:\n  "${CHROME}" --headless=new --disable-gpu --virtual-time-budget=15000 --dump-dom http://127.0.0.1:${port}/fidelity-gate.html 2>/dev/null | node audit/fidelity-gate.mjs ${OUT} ${FIGMA} ${CONV} ${NODES} --budget ${BUDGET} --judge`);
    console.log('  (server stays up 120s)');
    setTimeout(() => { server.close(); process.exit(0); }, 120000);
  }
}
