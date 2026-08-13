import { readFileSync } from "node:fs";
import { measureLattice } from "../kernel/magnetic-grid-measurement-kernel/dist/index.js";
const T=JSON.parse(readFileSync("/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s62-grid-canvas/_WIP/grid-engine-v3/evidence/canonical-traces.json","utf8"));
const UNIT=1_000_000, PITCH=48n, DISC=24n, F=4n;
const ipoly=(pts)=>{const o=[];for(const [x,y] of pts){const px=BigInt(Math.round(x*UNIT)),py=BigInt(Math.round(y*UNIT));const l=o[o.length-1];if(!l||l.x!==px||l.y!==py)o.push({x:px,y:py});}while(o.length>1&&o[0].x===o[o.length-1].x&&o[0].y===o[o.length-1].y)o.pop();return o;};
const bbox=(v)=>{let a=v[0].x,b=v[0].x,c=v[0].y,d=v[0].y;for(const p of v){if(p.x<a)a=p.x;if(p.x>b)b=p.x;if(p.y<c)c=p.y;if(p.y>d)d=p.y;}return{minX:a,maxX:b,minY:c,maxY:d};};
// area centroid (shoelace) in float, then to rational
const centroid=(pts)=>{let A=0,cx=0,cy=0;for(let i=0;i<pts.length;i++){const [x0,y0]=pts[i],[x1,y1]=pts[(i+1)%pts.length];const cr=x0*y1-x1*y0;A+=cr;cx+=(x0+x1)*cr;cy+=(y0+y1)*cr;}A/=2;return[cx/(6*A),cy/(6*A)];};
// max-clearance point: sample grid, distance to boundary via segment distance, keep max inside
const pip=(pts,x,y)=>{let inside=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const [xi,yi]=pts[i],[xj,yj]=pts[j];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))inside=!inside;}return inside;};
const d2seg=(px,py,ax,ay,bx,by)=>{const vx=bx-ax,vy=by-ay,wx=px-ax,wy=py-ay;const L=vx*vx+vy*vy;if(L===0)return wx*wx+wy*wy;let t=(wx*vx+wy*vy)/L;t=Math.max(0,Math.min(1,t));const dx=px-(ax+t*vx),dy=py-(ay+t*vy);return dx*dx+dy*dy;};
const maxClear=(pts)=>{const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);let best=null,bd=-1;const N=60;
 for(let i=0;i<=N;i++)for(let j=0;j<=N;j++){const x=x0+(x1-x0)*i/N,y=y0+(y1-y0)*j/N;if(!pip(pts,x,y))continue;let m=Infinity;for(let k=0;k<pts.length;k+=3){const [ax,ay]=pts[k],[bx,by]=pts[(k+3)%pts.length];const d=d2seg(x,y,ax,ay,bx,by);if(d<m)m=d;}if(m>bd){bd=m;best=[x,y];}}
 return best;};
const R=(f)=>({numerator:BigInt(Math.round(f*UNIT*1000)),denominator:1000n});
const params=(v,anchor)=>({lattice:{pitch:PITCH,origin:{x:{numerator:0n,denominator:1n},y:{numerator:0n,denominator:1n}},fieldExtent:{minColumn:-F,maxColumn:F,minRow:-F,maxRow:F}},discDiameter:DISC,sizeTransform:{sourceSize:(()=>{const B=bbox(v),sx=B.maxX-B.minX,sy=B.maxY-B.minY;return sx>sy?sx:sy;})(),sourceAnchor:anchor,targetAnchor:{x:{numerator:0n,denominator:1n},y:{numerator:0n,denominator:1n}}}});
const CASES=[["DUCK",60],["DUCK",152],["BAT-WOMAN",144],["BUTTERFLY",130],["POKE1",123],["BOT",144],["BOT",236],["PILL",138],["BUTTERFLY",214]];
for(const [shape,size] of CASES){
  const pts=T[shape], v=ipoly(pts), B=bbox(v);
  const anchors={
    "box centre":{x:{numerator:B.minX+B.maxX,denominator:2n},y:{numerator:B.minY+B.maxY,denominator:2n}},
    "centroid":(()=>{const [cx,cy]=centroid(pts);return {x:R(cx),y:R(cy)};})(),
    "max clearance":(()=>{const [cx,cy]=maxClear(pts);return {x:R(cx),y:R(cy)};})(),
  };
  const out=[];
  for(const [name,a] of Object.entries(anchors)){
    const doc=measureLattice({polygon:{vertices:v},parameters:params(v,a),sizes:[BigInt(size)]});
    const held=doc.sizes[0].positions.filter(p=>p.fits).map(p=>`(${p.column},${p.row})`);
    out.push(`${name}: ${held.length} ${held.join(" ")}`);
  }
  console.log(`\n${shape} @${size}mm`); out.forEach(l=>console.log("   "+l));
}
