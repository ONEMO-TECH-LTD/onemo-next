import type { Edge, IntPoint, Point, PreparedPolygon } from './contracts.js';
import { ComputeError } from './contracts.js';
import { canonicalHash } from './hash.js';
import { COMPUTE_ARTIFACT_HASH } from './artifact-manifest.js';
import { bigIntOrient, compareIntPoints, dequantizePoint, quantizePoint } from './numeric.js';
import { measureRing } from './measure.js';

function sameIntPoint(a:IntPoint,b:IntPoint):boolean{return a.x===b.x&&a.y===b.y;}

function pointOnSegmentInt(p:IntPoint,a:IntPoint,b:IntPoint):boolean{
  if(bigIntOrient(a,b,p)!==0n)return false;
  return p.x>=Math.min(a.x,b.x)&&p.x<=Math.max(a.x,b.x)&&p.y>=Math.min(a.y,b.y)&&p.y<=Math.max(a.y,b.y);
}

function segmentsIntersectInt(a:IntPoint,b:IntPoint,c:IntPoint,d:IntPoint):boolean{
  const o1=bigIntOrient(a,b,c),o2=bigIntOrient(a,b,d),o3=bigIntOrient(c,d,a),o4=bigIntOrient(c,d,b);
  if(o1===0n&&pointOnSegmentInt(c,a,b))return true;
  if(o2===0n&&pointOnSegmentInt(d,a,b))return true;
  if(o3===0n&&pointOnSegmentInt(a,c,d))return true;
  if(o4===0n&&pointOnSegmentInt(b,c,d))return true;
  return (o1>0n)!==(o2>0n)&&(o3>0n)!==(o4>0n);
}

function signedArea2Int(ring:readonly IntPoint[]):bigint{
  let sum=0n;
  for(let i=0;i<ring.length;i++){
    const a=ring[i]!,b=ring[(i+1)%ring.length]!;
    sum+=BigInt(a.x)*BigInt(b.y)-BigInt(b.x)*BigInt(a.y);
  }
  return sum;
}

function rotateCanonical(ring:readonly IntPoint[]):IntPoint[]{
  let best=0;
  for(let i=1;i<ring.length;i++){
    const c=compareIntPoints(ring[i]!,ring[best]!);
    if(c<0)best=i;
    else if(c===0){
      for(let k=1;k<ring.length;k++){
        const left=ring[(i+k)%ring.length]!,right=ring[(best+k)%ring.length]!;
        const d=compareIntPoints(left,right);
        if(d<0){best=i;break;} if(d>0)break;
      }
    }
  }
  return Array.from({length:ring.length},(_,i)=>ring[(best+i)%ring.length]!);
}

export function canonicalizeRingInt(input:readonly IntPoint[]):IntPoint[]{
  if(input.length<3)throw new ComputeError('INVALID_OUTLINE','outline requires at least three vertices',{vertexCount:input.length});
  const ring=[...input];
  if(ring.length>1&&sameIntPoint(ring[0]!,ring[ring.length-1]!))ring.pop();
  const deduped:IntPoint[]=[];
  for(const point of ring){
    if(!Number.isSafeInteger(point.x)||!Number.isSafeInteger(point.y))throw new ComputeError('NUMERIC_OVERFLOW','canonical coordinates must be safe integers',{point});
    if(deduped.length===0||!sameIntPoint(point,deduped[deduped.length-1]!))deduped.push({x:point.x,y:point.y});
  }
  if(deduped.length>1&&sameIntPoint(deduped[0]!,deduped[deduped.length-1]!))deduped.pop();
  if(deduped.length<3)throw new ComputeError('INVALID_OUTLINE','quantisation collapsed outline below three distinct vertices',{vertexCount:deduped.length});
  const unique=new Set(deduped.map(p=>`${p.x},${p.y}`));
  if(unique.size<3)throw new ComputeError('INVALID_OUTLINE','outline requires three distinct vertices',{uniqueCount:unique.size});
  for(let i=0;i<deduped.length;i++){
    const a=deduped[i]!,b=deduped[(i+1)%deduped.length]!;
    if(sameIntPoint(a,b))throw new ComputeError('INVALID_OUTLINE','zero-length edge after quantisation',{edgeIndex:i});
  }
  for(let i=0;i<deduped.length;i++){
    const a=deduped[i]!,b=deduped[(i+1)%deduped.length]!;
    for(let j=i+1;j<deduped.length;j++){
      const adjacent=j===i||j===(i+1)%deduped.length||i===(j+1)%deduped.length;
      if(adjacent)continue;
      const c=deduped[j]!,d=deduped[(j+1)%deduped.length]!;
      if(segmentsIntersectInt(a,b,c,d))throw new ComputeError('SELF_INTERSECTION','outline is not a simple polygon',{edgeA:i,edgeB:j});
    }
  }
  const area2=signedArea2Int(deduped);
  if(area2===0n)throw new ComputeError('INVALID_OUTLINE','outline area is zero after quantisation');
  const oriented=area2>0n?deduped:[...deduped].reverse();
  return rotateCanonical(oriented);
}

export function pointLocationInt(ring:readonly IntPoint[],point:IntPoint):'INSIDE'|'OUTSIDE'|'BOUNDARY'{
  let winding=0;
  for(let i=0;i<ring.length;i++){
    const a=ring[i]!,b=ring[(i+1)%ring.length]!;
    if(pointOnSegmentInt(point,a,b))return 'BOUNDARY';
    if(a.y<=point.y){
      if(b.y>point.y&&bigIntOrient(a,b,point)>0n)winding++;
    }else if(b.y<=point.y&&bigIntOrient(a,b,point)<0n)winding--;
  }
  return winding===0?'OUTSIDE':'INSIDE';
}

export function pointLocationNumber(ring:readonly Point[],point:Point):'INSIDE'|'OUTSIDE'|'BOUNDARY'{
  let winding=0;
  for(let i=0;i<ring.length;i++){
    const a=ring[i]!,b=ring[(i+1)%ring.length]!;
    const dx=b.x-a.x,dy=b.y-a.y;
    const cross=dx*(point.y-a.y)-dy*(point.x-a.x);
    const dot=(point.x-a.x)*dx+(point.y-a.y)*dy;
    if(Math.abs(cross)<=1e-10*Math.max(1,Math.hypot(dx,dy))&&dot>=-1e-10&&dot<=dx*dx+dy*dy+1e-10)return 'BOUNDARY';
    if(a.y<=point.y){if(b.y>point.y&&cross>0)winding++;}
    else if(b.y<=point.y&&cross<0)winding--;
  }
  return winding===0?'OUTSIDE':'INSIDE';
}

export function preparePolygon(input:readonly Point[],options:{quantumMm:number;maxVertices?:number}):PreparedPolygon{
  const maxVertices=options.maxVertices??4096;
  if(input.length>maxVertices)throw new ComputeError('RESOURCE_LIMIT_EXCEEDED','outline exceeds configured vertex budget',{vertexCount:input.length,maxVertices});
  for(const point of input)if(!Number.isFinite(point.x)||!Number.isFinite(point.y))throw new ComputeError('INVALID_OUTLINE','outline contains non-finite coordinates',{point});
  const ringInt=canonicalizeRingInt(input.map(p=>quantizePoint(p,options.quantumMm)));
  const ringMm=ringInt.map(p=>dequantizePoint(p,options.quantumMm));
  const baseMetrics=measureRing(ringMm);
  const centroidInside=pointLocationNumber(ringMm,baseMetrics.centroid)!=='OUTSIDE';
  const metrics={...baseMetrics,centroidInside};
  const edges:Edge[]=ringMm.map((a,index)=>{
    const b=ringMm[(index+1)%ringMm.length]!; const dx=b.x-a.x,dy=b.y-a.y;
    return {a,b,index,minX:Math.min(a.x,b.x),minY:Math.min(a.y,b.y),maxX:Math.max(a.x,b.x),maxY:Math.max(a.y,b.y),dx,dy,lengthSquared:dx*dx+dy*dy};
  });
  const geometryHash=canonicalHash({schema:'onemo-polygon-v1',quantumMm:options.quantumMm,ring:ringInt.map(p=>[p.x,p.y])});
  return Object.freeze({kind:'PreparedPolygon',quantumMm:options.quantumMm,ringInt:Object.freeze(ringInt),ringMm:Object.freeze(ringMm),edges:Object.freeze(edges),metrics:Object.freeze(metrics),geometryHash,artifactHash:COMPUTE_ARTIFACT_HASH});
}

export function transformPolygon(polygon:PreparedPolygon,options:{scale:number;translation?:Point;origin?:Point}):PreparedPolygon{
  if(!Number.isFinite(options.scale)||options.scale<=0)throw new ComputeError('INVALID_OUTLINE','scale must be finite and positive',{scale:options.scale});
  const translation=options.translation??{x:0,y:0}; const origin=options.origin??polygon.metrics.boundsCenter;
  const ring=polygon.ringMm.map(p=>({x:origin.x+options.scale*(p.x-origin.x)+translation.x,y:origin.y+options.scale*(p.y-origin.y)+translation.y}));
  return preparePolygon(ring,{quantumMm:polygon.quantumMm,maxVertices:polygon.ringMm.length});
}

export function centrePolygon(polygon:PreparedPolygon):PreparedPolygon{
  const c=polygon.metrics.boundsCenter;
  return transformPolygon(polygon,{scale:1,translation:{x:-c.x,y:-c.y},origin:{x:0,y:0}});
}

export function scaleToDominantDimension(polygon:PreparedPolygon,targetMm:number):PreparedPolygon{
  if(!Number.isFinite(targetMm)||targetMm<=0)throw new ComputeError('INVALID_OUTLINE','target dimension must be finite and positive',{targetMm});
  const scale=targetMm/polygon.metrics.dominantDimension;
  const scaled=transformPolygon(polygon,{scale,origin:polygon.metrics.boundsCenter});
  return centrePolygon(scaled);
}
