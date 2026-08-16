import type { AdaptiveBox, FinalTieBreakResult, Point, PreparedPolygon } from './contracts.js';
import { add, dequantizePoint, squaredDistance } from './numeric.js';
import { discsContainedExact } from './containment.js';

function pointInBox(point:Point,box:AdaptiveBox):boolean{return point.x>=box.minX-1e-12&&point.x<=box.maxX+1e-12&&point.y>=box.minY-1e-12&&point.y<=box.maxY+1e-12;}
function exactLegal(polygon:PreparedPolygon,offsets:readonly Point[],translation:Point,radiusMm:number):boolean{return discsContainedExact(polygon,offsets.map(o=>add(translation,o)),radiusMm).every(r=>r.legal);}
function comparePoints(a:Point,b:Point,target:Point):number{return squaredDistance(a,target)-squaredDistance(b,target)||a.x-b.x||a.y-b.y;}
function integerBounds(min:number,max:number,quantumMm:number):readonly [number,number]{return[Math.ceil((min-1e-12)/quantumMm),Math.floor((max+1e-12)/quantumMm)];}
function closestIndex(target:number,min:number,max:number):number{
  const lower=Math.floor(target),upper=Math.ceil(target);let best=Math.min(max,Math.max(min,lower));
  for(const candidate of [upper,min,max])if(candidate>=min&&candidate<=max&&(Math.abs(candidate-target)<Math.abs(best-target)-1e-12||(Math.abs(Math.abs(candidate-target)-Math.abs(best-target))<=1e-12&&candidate<best)))best=candidate;
  return best;
}

export function finalRegistrationTieBreak(
  polygon:PreparedPolygon,
  offsets:readonly Point[],
  radiusMm:number,
  optimumBoxes:readonly AdaptiveBox[],
  canonicalTarget:Point,
  quantumMm:number
):FinalTieBreakResult{
  const seen=new Set<string>();let attempted=0,best:Point|undefined;
  const consider=(ix:number,iy:number)=>{
    const key=`${ix},${iy}`;if(seen.has(key))return;seen.add(key);
    const point=dequantizePoint({x:ix,y:iy},quantumMm);
    if(!optimumBoxes.some(box=>pointInBox(point,box)))return;
    attempted++;
    if(exactLegal(polygon,offsets,point,radiusMm)&&(!best||comparePoints(point,best,canonicalTarget)<0))best=point;
  };
  for(const box of optimumBoxes){
    if(box.status==='OUTSIDE')continue;
    const [minX,maxX]=integerBounds(box.minX,box.maxX,quantumMm),[minY,maxY]=integerBounds(box.minY,box.maxY,quantumMm);
    if(minX>maxX||minY>maxY)continue;
    if(box.status==='INSIDE')consider(closestIndex(canonicalTarget.x/quantumMm,minX,maxX),closestIndex(canonicalTarget.y/quantumMm,minY,maxY));
    else for(let iy=minY;iy<=maxY;iy++)for(let ix=minX;ix<=maxX;ix++)consider(ix,iy);
  }
  if(best)return{status:'SELECTED',point:best,canonicalDistanceSquared:squaredDistance(best,canonicalTarget),attemptedPoints:attempted};
  if(optimumBoxes.length>0)return{status:'FEASIBLE_BELOW_OUTPUT_QUANTUM',attemptedPoints:attempted};
  return{status:'INDETERMINATE_WITHIN_TOLERANCE',attemptedPoints:attempted};
}
