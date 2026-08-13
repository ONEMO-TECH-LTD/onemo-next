import { readFileSync } from "node:fs";
const T=JSON.parse(readFileSync("/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s62-grid-canvas/_WIP/grid-engine-v3/evidence/canonical-traces.json","utf8"));
const pip=(pts,x,y)=>{let i2=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const [xi,yi]=pts[i],[xj,yj]=pts[j];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))i2=!i2;}return i2;};
const d2=(px,py,ax,ay,bx,by)=>{const vx=bx-ax,vy=by-ay,wx=px-ax,wy=py-ay;const L=vx*vx+vy*vy;if(!L)return wx*wx+wy*wy;let t=Math.max(0,Math.min(1,(wx*vx+wy*vy)/L));const dx=px-(ax+t*vx),dy=py-(ay+t*vy);return dx*dx+dy*dy;};
for(const name of ["DUCK","BOT","BUTTERFLY"]){
  const pts=T[name];const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
  const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  let best=null,bd=-1;const N=80;
  for(let i=0;i<=N;i++)for(let j=0;j<=N;j++){const x=x0+(x1-x0)*i/N,y=y0+(y1-y0)*j/N;if(!pip(pts,x,y))continue;let m=Infinity;for(let k=0;k<pts.length;k+=3){const [ax,ay]=pts[k],[bx,by]=pts[(k+3)%pts.length];const d=d2(x,y,ax,ay,bx,by);if(d<m)m=d;}if(m>bd){bd=m;best=[x,y];}}
  const cy=(y0+y1)/2;
  console.log(`${name}: bbox y ${y0.toFixed(3)}..${y1.toFixed(3)} (centre ${cy.toFixed(3)}) | max-clearance at (${best[0].toFixed(3)}, ${best[1].toFixed(3)}) radius≈${Math.sqrt(bd).toFixed(3)} → ${best[1]<cy?"UPPER half":"LOWER half"} of the trace's y-axis`);
}
