import type { ClearanceResult, IntPoint, Point, PreparedPolygon } from './contracts.js';
import { pointLocationPreparedInt, pointLocationPreparedNumber } from './polygon.js';
import { dequantizePoint, quantizePoint } from './numeric.js';

function nearestPointOnSegment(point:Point,a:Point,b:Point):{point:Point;distanceSquared:number}{
  const dx=b.x-a.x,dy=b.y-a.y; const len2=dx*dx+dy*dy;
  if(len2===0){const x=point.x-a.x,y=point.y-a.y;return{point:a,distanceSquared:x*x+y*y};}
  const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/len2));
  const q={x:a.x+t*dx,y:a.y+t*dy};const ex=point.x-q.x,ey=point.y-q.y;
  return{point:q,distanceSquared:ex*ex+ey*ey};
}

export function clearanceAtPoint(polygon:PreparedPolygon,point:Point):ClearanceResult{
  const location=pointLocationPreparedNumber(polygon,point);
  let best=Infinity,bestPoint={x:NaN,y:NaN},bestIndex=-1;
  const bins=polygon.edgeIndex.bins.map((_,index)=>index).sort((left,right)=>{
    const distance=(bin:number)=>{const min=polygon.edgeIndex.minY+bin*polygon.edgeIndex.binHeight,max=min+polygon.edgeIndex.binHeight;return point.y<min?min-point.y:point.y>max?point.y-max:0;};
    return distance(left)-distance(right)||left-right;
  });
  const seen=new Set<number>();
  for(const bin of bins){
    const minY=polygon.edgeIndex.minY+bin*polygon.edgeIndex.binHeight,maxY=minY+polygon.edgeIndex.binHeight;
    const verticalDistance=point.y<minY?minY-point.y:point.y>maxY?point.y-maxY:0;
    if(verticalDistance*verticalDistance>best)break;
    for(const edgeIndex of polygon.edgeIndex.bins[bin]!){if(seen.has(edgeIndex))continue;seen.add(edgeIndex);const edge=polygon.edges[edgeIndex]!;
    const hit=nearestPointOnSegment(point,edge.a,edge.b);
    if(hit.distanceSquared<best){best=hit.distanceSquared;bestPoint=hit.point;bestIndex=edge.index;}
    }
  }
  const clearance=Math.sqrt(best);
  const signed=location==='OUTSIDE'?-clearance:location==='BOUNDARY'?0:clearance;
  return{point,location,signedClearanceMm:signed,clearanceMm:clearance,nearestBoundaryPoint:bestPoint,nearestEdgeIndex:bestIndex,exactness:'CERTIFIED_APPROXIMATE'};
}

export function exactDistanceComparison(point:IntPoint,a:IntPoint,b:IntPoint,radiusInt:number):{atLeast:boolean;distanceMmFactor:{numerator:bigint;denominator:bigint};projection:'A'|'B'|'INTERIOR'}{
  const vx=b.x-a.x,vy=b.y-a.y,wx=point.x-a.x,wy=point.y-a.y;
  const len2=BigInt(vx)*BigInt(vx)+BigInt(vy)*BigInt(vy);
  const dot=BigInt(wx)*BigInt(vx)+BigInt(wy)*BigInt(vy);
  const r2=BigInt(radiusInt)*BigInt(radiusInt);
  if(dot<=0n){const d2=BigInt(wx)*BigInt(wx)+BigInt(wy)*BigInt(wy);return{atLeast:d2>=r2,distanceMmFactor:{numerator:d2,denominator:1n},projection:'A'};}
  if(dot>=len2){const x=point.x-b.x,y=point.y-b.y;const d2=BigInt(x)*BigInt(x)+BigInt(y)*BigInt(y);return{atLeast:d2>=r2,distanceMmFactor:{numerator:d2,denominator:1n},projection:'B'};}
  const cross=BigInt(vx)*BigInt(wy)-BigInt(vy)*BigInt(wx);
  const cross2=cross*cross;
  return{atLeast:cross2>=r2*len2,distanceMmFactor:{numerator:cross2,denominator:len2},projection:'INTERIOR'};
}

export function exactClearanceAtQuantizedPoint(polygon:PreparedPolygon,point:Point):ClearanceResult{
  const pInt=quantizePoint(point,polygon.quantumMm);
  const location=pointLocationPreparedInt(polygon,pInt);
  const snapped=dequantizePoint(pInt,polygon.quantumMm);
  const approximate=clearanceAtPoint(polygon,snapped),clearance=approximate.clearanceMm;
  const signed=location==='OUTSIDE'?-clearance:location==='BOUNDARY'?0:clearance;
  return{...approximate,point:snapped,location,signedClearanceMm:signed,exactness:'EXACT'};
}
