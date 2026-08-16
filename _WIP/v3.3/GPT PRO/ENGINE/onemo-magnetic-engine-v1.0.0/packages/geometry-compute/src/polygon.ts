import type { Edge, EdgeAccelerationIndex, IntPoint, Point, PreparedPolygon } from './contracts.js';
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

function validateSimpleRingInt(ring:readonly IntPoint[]):void{
  const count=ring.length;
  const divisions=Math.max(1,Math.ceil(Math.sqrt(count)));
  const minX=Math.min(...ring.map(point=>point.x)),maxX=Math.max(...ring.map(point=>point.x));
  const minY=Math.min(...ring.map(point=>point.y)),maxY=Math.max(...ring.map(point=>point.y));
  const width=Math.max(1,maxX-minX),height=Math.max(1,maxY-minY);
  const buckets=new Map<number,number[]>(),wideEdges:number[]=[];
  const cell=(value:number,min:number,span:number)=>Math.max(0,Math.min(divisions-1,Math.floor((value-min)/span*divisions)));
  for(let index=0;index<count;index++){
    const a=ring[index]!,b=ring[(index+1)%count]!;
    const x0=cell(Math.min(a.x,b.x),minX,width),x1=cell(Math.max(a.x,b.x),minX,width);
    const y0=cell(Math.min(a.y,b.y),minY,height),y1=cell(Math.max(a.y,b.y),minY,height);
    if((x1-x0+1)*(y1-y0+1)>divisions*4){wideEdges.push(index);continue;}
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const bucketKey=y*divisions+x,bucket=buckets.get(bucketKey);
      if(bucket)bucket.push(index);else buckets.set(bucketKey,[index]);
    }
  }
  const checked=new Set<number>();
  const checkPair=(i:number,j:number)=>{
    if(j===i||j===(i+1)%count||i===(j+1)%count)return;
    const pair=Math.min(i,j)*count+Math.max(i,j);if(checked.has(pair))return;checked.add(pair);
    const a=ring[i]!,b=ring[(i+1)%count]!,c=ring[j]!,d=ring[(j+1)%count]!;
    if(Math.max(a.x,b.x)<Math.min(c.x,d.x)||Math.max(c.x,d.x)<Math.min(a.x,b.x)||Math.max(a.y,b.y)<Math.min(c.y,d.y)||Math.max(c.y,d.y)<Math.min(a.y,b.y))return;
    if(segmentsIntersectInt(a,b,c,d))throw new ComputeError('SELF_INTERSECTION','outline is not a simple polygon',{edgeA:i,edgeB:j});
  };
  for(const bucket of buckets.values())for(let left=0;left<bucket.length;left++)for(let right=left+1;right<bucket.length;right++)checkPair(bucket[left]!,bucket[right]!);
  for(const wide of wideEdges)for(let other=0;other<count;other++)checkPair(wide,other);
}

function buildEdgeIndex(edges:readonly Edge[],minY:number,maxY:number):EdgeAccelerationIndex{
  const count=Math.max(1,Math.min(64,Math.ceil(Math.sqrt(edges.length))));
  const binHeight=Math.max(Number.EPSILON,(maxY-minY)/count);
  const bins=Array.from({length:count},()=>[] as number[]);
  const bin=(value:number)=>Math.max(0,Math.min(count-1,Math.floor((value-minY)/binHeight)));
  for(const edge of edges)for(let index=bin(edge.minY);index<=bin(edge.maxY);index++)bins[index]!.push(edge.index);
  return Object.freeze({minY,maxY,binHeight,bins:Object.freeze(bins.map(values=>Object.freeze(values)))});
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
  validateSimpleRingInt(deduped);
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
  const edgeIndex=buildEdgeIndex(edges,metrics.bounds.minY,metrics.bounds.maxY);
  const geometryHash=canonicalHash({schema:'onemo-polygon-v1',quantumMm:options.quantumMm,ring:ringInt.map(p=>[p.x,p.y])});
  return Object.freeze({kind:'PreparedPolygon',quantumMm:options.quantumMm,ringInt:Object.freeze(ringInt),ringMm:Object.freeze(ringMm),edges:Object.freeze(edges),edgeIndex,metrics:Object.freeze(metrics),geometryHash,artifactHash:COMPUTE_ARTIFACT_HASH});
}

export function edgeIndicesNearY(polygon:PreparedPolygon,y:number,maxDistance=Infinity):number[]{
  const index=polygon.edgeIndex;
  if(!Number.isFinite(maxDistance))return polygon.edges.map(edge=>edge.index);
  const min=y-maxDistance,max=y+maxDistance;
  if(max<index.minY||min>index.maxY)return[];
  const first=Math.max(0,Math.min(index.bins.length-1,Math.floor((min-index.minY)/index.binHeight)));
  const last=Math.max(0,Math.min(index.bins.length-1,Math.floor((max-index.minY)/index.binHeight)));
  const found=new Set<number>();for(let bin=first;bin<=last;bin++)for(const edge of index.bins[bin]!)found.add(edge);
  return [...found].sort((a,b)=>a-b);
}

export function pointLocationPreparedNumber(polygon:PreparedPolygon,point:Point):'INSIDE'|'OUTSIDE'|'BOUNDARY'{
  const bounds=polygon.metrics.bounds;if(point.y<bounds.minY||point.y>bounds.maxY||point.x<bounds.minX||point.x>bounds.maxX)return'OUTSIDE';
  let winding=0;for(const index of edgeIndicesNearY(polygon,point.y,0)){
    const {a,b,dx,dy}=polygon.edges[index]!;const cross=dx*(point.y-a.y)-dy*(point.x-a.x);const dot=(point.x-a.x)*dx+(point.y-a.y)*dy;
    if(Math.abs(cross)<=1e-10*Math.max(1,Math.hypot(dx,dy))&&dot>=-1e-10&&dot<=dx*dx+dy*dy+1e-10)return'BOUNDARY';
    if(a.y<=point.y){if(b.y>point.y&&cross>0)winding++;}else if(b.y<=point.y&&cross<0)winding--;
  }return winding===0?'OUTSIDE':'INSIDE';
}

export function pointLocationPreparedInt(polygon:PreparedPolygon,point:IntPoint):'INSIDE'|'OUTSIDE'|'BOUNDARY'{
  const mm=dequantizePoint(point,polygon.quantumMm),bounds=polygon.metrics.bounds;if(mm.y<bounds.minY||mm.y>bounds.maxY||mm.x<bounds.minX||mm.x>bounds.maxX)return'OUTSIDE';
  let winding=0;for(const index of edgeIndicesNearY(polygon,mm.y,0)){
    const a=polygon.ringInt[index]!,b=polygon.ringInt[(index+1)%polygon.ringInt.length]!;
    if(pointOnSegmentInt(point,a,b))return'BOUNDARY';
    if(a.y<=point.y){if(b.y>point.y&&bigIntOrient(a,b,point)>0n)winding++;}else if(b.y<=point.y&&bigIntOrient(a,b,point)<0n)winding--;
  }return winding===0?'OUTSIDE':'INSIDE';
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
