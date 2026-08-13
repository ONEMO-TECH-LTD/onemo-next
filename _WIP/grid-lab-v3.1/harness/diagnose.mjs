import { readFileSync } from "node:fs";
import { measureLattice } from "../engine/magnetic-grid-measurement-kernel/dist/index.js";
const T=JSON.parse(readFileSync("/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s62-grid-canvas/_WIP/grid-engine-v3/evidence/canonical-traces.json","utf8"));
const U=1_000_000, P=48n, D=24n, F=4n;
const ip=(pts)=>{const o=[];for(const[x,y]of pts){const px=BigInt(Math.round(x*U)),py=BigInt(Math.round(y*U));const l=o.at(-1);if(!l||l.x!==px||l.y!==py)o.push({x:px,y:py});}while(o.length>1&&o[0].x===o.at(-1).x&&o[0].y===o.at(-1).y)o.pop();return o;};
const bb=(v)=>v.reduce((b,p)=>({minX:p.x<b.minX?p.x:b.minX,maxX:p.x>b.maxX?p.x:b.maxX,minY:p.y<b.minY?p.y:b.minY,maxY:p.y>b.maxY?p.y:b.maxY}),{minX:v[0].x,maxX:v[0].x,minY:v[0].y,maxY:v[0].y});
const R=(n,d=1n)=>({numerator:n,denominator:d});
for (const [shape,size] of [["DUCK",152],["BUTTERFLY",130],["BOT",144],["POKE1",123],["PILL",79],["BUTTERFLY",214]]) {
  const v=ip(T[shape]); const b=bb(v); const sx=b.maxX-b.minX, sy=b.maxY-b.minY;
  const doc=measureLattice({polygon:{vertices:v},parameters:{lattice:{pitch:P,origin:{x:R(0n),y:R(0n)},fieldExtent:{minColumn:-F,maxColumn:F,minRow:-F,maxRow:F}},discDiameter:D,
    sizeTransform:{sourceSize:sx>sy?sx:sy,sourceAnchor:{x:R((b.minX+b.maxX)/2n),y:R((b.minY+b.maxY)/2n)},targetAnchor:{x:R(0n),y:R(0n)}}},sizes:[BigInt(size)]});
  const held=doc.sizes[0].positions.filter(p=>p.fits).map(p=>`${p.column},${p.row}`);
  console.log(`${shape}@${size} bbox-anchor held(${held.length}): ${held.join("  ")}`);
}
