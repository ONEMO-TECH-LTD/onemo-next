import type { AdaptiveBox, FinalTieBreakResult, Point, PreparedPolygon } from './contracts.js';
import { add, clampPoint, dequantizePoint, quantizePoint, squaredDistance } from './numeric.js';
import { discsContainedExact } from './containment.js';
import { boxCentre } from './adaptive.js';

function pointInBox(point:Point,box:AdaptiveBox):boolean{return point.x>=box.minX-1e-12&&point.x<=box.maxX+1e-12&&point.y>=box.minY-1e-12&&point.y<=box.maxY+1e-12;}
function exactLegal(polygon:PreparedPolygon,offsets:readonly Point[],translation:Point,radiusMm:number):boolean{return discsContainedExact(polygon,offsets.map(o=>add(translation,o)),radiusMm).every(r=>r.legal);}

export function finalRegistrationTieBreak(
  polygon:PreparedPolygon,
  offsets:readonly Point[],
  radiusMm:number,
  optimumBoxes:readonly AdaptiveBox[],
  canonicalTarget:Point,
  quantumMm:number
):FinalTieBreakResult{
  const candidates:Point[]=[];
  for(const box of optimumBoxes){
    const c=boxCentre(box);const near=clampPoint(canonicalTarget,box);
    candidates.push(near,c,{x:box.minX,y:box.minY},{x:box.maxX,y:box.minY},{x:box.minX,y:box.maxY},{x:box.maxX,y:box.maxY});
  }
  const unique=new Map<string,Point>();
  for(const p of candidates){const q=dequantizePoint(quantizePoint(p,quantumMm),quantumMm);if(optimumBoxes.some(b=>pointInBox(q,b)))unique.set(`${q.x},${q.y}`,q);}
  const ordered=[...unique.values()].sort((a,b)=>squaredDistance(a,canonicalTarget)-squaredDistance(b,canonicalTarget)||a.x-b.x||a.y-b.y);
  let attempted=0;
  for(const point of ordered){attempted++;if(exactLegal(polygon,offsets,point,radiusMm))return{status:'SELECTED',point,canonicalDistanceSquared:squaredDistance(point,canonicalTarget),attemptedPoints:attempted};}
  if(optimumBoxes.length>0)return{status:'FEASIBLE_BELOW_OUTPUT_QUANTUM',attemptedPoints:attempted};
  return{status:'INDETERMINATE_WITHIN_TOLERANCE',attemptedPoints:attempted};
}
