// Visual fidelity diff — generates a self-contained HTML that pixel-compares two renders
// (Figma's own render vs the converted screen rendered in a real route) with a heatmap +
// measured mismatch numbers. Dependency-free: the diff runs in the browser via canvas.
//
// usage: node audit/visual-diff.mjs <outDir> <figma.png> <converted.png> [--bands "name:y0:y1,…"]
//   → writes <outDir>/visual-diff.html (open via a local http server; file:// blocks canvas reads)
// Method: per-pixel max-channel delta; Δ>32/255 = mismatch (tolerant of font/AA engine
// differences), Δ>16 = warn. Optional bands give per-region stats (y in output pixels).
import { writeFileSync, copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const [, , OUT, FIGMA, CONV, ...rest] = process.argv;
if (!OUT || !FIGMA || !CONV) { console.error('usage: node audit/visual-diff.mjs <outDir> <figma.png> <converted.png> [--bands "name:y0:y1,…"]'); process.exit(2); }
const bandsArg = rest[0] === '--bands' ? rest[1] : '';
const bands = bandsArg ? bandsArg.split(',').map((b) => { const [name, y0, y1] = b.split(':'); return { name, y0: +y0, y1: +y1 }; }) : [];

// copy the two inputs next to the report so it is self-contained + servable
for (const [src, name] of [[FIGMA, 'vd-figma.png'], [CONV, 'vd-converted.png']]) {
  if (!existsSync(src)) { console.error(`missing: ${src}`); process.exit(1); }
  copyFileSync(src, path.join(OUT, name));
}

const html = `<!doctype html><html><head><meta charset="utf-8"><title>visual diff</title><style>
body{margin:0;background:#141418;color:#e8e8ec;font:14px -apple-system,sans-serif;padding:20px}
.row{display:flex;gap:14px}.col{display:flex;flex-direction:column;gap:6px}
.cap{font-size:12px;color:#aaa;font-weight:600}
canvas,img{width:300px;border-radius:10px;border:1px solid #2c2c34}
#out{white-space:pre;font-family:ui-monospace,monospace;font-size:13px;margin-top:14px;color:#cfd}
.legend span{display:inline-block;width:10px;height:10px;border-radius:2px;margin:0 4px 0 10px}
</style></head><body>
<div class="row">
<div class="col"><div class="cap">Figma</div><img src="vd-figma.png"></div>
<div class="col"><div class="cap">Converted</div><img src="vd-converted.png"></div>
<div class="col"><div class="cap">Diff <span class="legend"><span style="background:#ff2828"></span>Δ&gt;32 <span style="background:#ffa000"></span>Δ&gt;16</span></div><canvas id="d"></canvas></div>
</div>
<div id="out">computing…</div>
<script>
const BANDS=${JSON.stringify(bands)};
const load=s=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=s;});
(async()=>{
  const [A,B]=await Promise.all([load('vd-figma.png'),load('vd-converted.png')]);
  const W=Math.min(A.width,B.width),H=Math.min(A.height,B.height);
  const t=document.createElement('canvas');t.width=W;t.height=H;const tx=t.getContext('2d');
  tx.drawImage(A,0,0);const da=tx.getImageData(0,0,W,H).data;
  tx.clearRect(0,0,W,H);tx.drawImage(B,0,0);const db=tx.getImageData(0,0,W,H).data;
  const cv=document.getElementById('d');cv.width=W;cv.height=H;const x=cv.getContext('2d');
  const D=x.createImageData(W,H);
  const stats=BANDS.map(b=>({...b,n:0,mis:0,sum:0}));
  let n=0,mis=0,sum=0;
  for(let y=0;y<H;y++){const st=stats.find(s=>y>=s.y0&&y<s.y1);
    for(let xx=0;xx<W;xx++){const i=(y*W+xx)*4;
      const d=Math.max(Math.abs(da[i]-db[i]),Math.abs(da[i+1]-db[i+1]),Math.abs(da[i+2]-db[i+2]));
      n++;sum+=d;if(st){st.n++;st.sum+=d;}
      const bad=d>32,warn=d>16;if(bad){mis++;if(st)st.mis++;}
      const g=Math.round((da[i]+da[i+1]+da[i+2])/3*.3+160);
      D.data[i]=bad||warn?255:g;D.data[i+1]=bad?40:warn?160:g;D.data[i+2]=bad?40:warn?0:g;D.data[i+3]=255;}}
  x.putImageData(D,0,0);
  const pct=v=>(v*100).toFixed(2)+'%';
  let out=\`size \${W}x\${H}\\nOVERALL  mismatch(Δ>32): \${pct(mis/n)}   mean Δ: \${(sum/n).toFixed(2)}/255\\n\`;
  for(const s of stats) out+=\`\${s.name.padEnd(28)} mismatch: \${pct(s.mis/s.n)}   mean Δ: \${(s.sum/s.n).toFixed(2)}\\n\`;
  document.getElementById('out').textContent=out;
  window.__diff={overall:{mismatch:mis/n,mean:sum/n},regions:stats.map(s=>({name:s.name,mismatch:s.mis/s.n,mean:s.sum/s.n})),W,H};
})();
</script></body></html>`;
writeFileSync(path.join(OUT, 'visual-diff.html'), html);
console.log(`visual-diff.html written to ${OUT} (serve over http; read numbers from #out or window.__diff)`);
