import type { Point } from './contracts.js';
import { dot } from './numeric.js';
import { measureRing } from './measure.js';

export interface ClippedMoment {
  readonly ring: readonly Point[];
  readonly areaMm2: number;
  readonly centroid: Point | null;
  readonly firstMomentMm3: number;
}

export function clipRingHalfPlane(ring:readonly Point[],direction:Point,threshold:number,keepAbove:boolean):Point[]{
  const output:Point[]=[];
  const inside=(p:Point)=>keepAbove?dot(p,direction)>=threshold-1e-12:dot(p,direction)<=threshold+1e-12;
  const intersect=(a:Point,b:Point):Point=>{
    const av=dot(a,direction)-threshold,bv=dot(b,direction)-threshold;
    const denom=av-bv; const t=Math.abs(denom)<1e-18?0:av/denom;
    return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
  };
  for(let i=0;i<ring.length;i++){
    const current=ring[i]!,previous=ring[(i+ring.length-1)%ring.length]!;
    const ci=inside(current),pi=inside(previous);
    if(ci){if(!pi)output.push(intersect(previous,current));output.push(current);}
    else if(pi)output.push(intersect(previous,current));
  }
  // Remove adjacent numerical duplicates.
  const clean:Point[]=[];
  for(const p of output){const q=clean[clean.length-1];if(!q||Math.hypot(p.x-q.x,p.y-q.y)>1e-10)clean.push(p);}
  if(clean.length>1&&Math.hypot(clean[0]!.x-clean[clean.length-1]!.x,clean[0]!.y-clean[clean.length-1]!.y)<=1e-10)clean.pop();
  return clean;
}

const MOMENT_CACHE_LIMIT=512;
let momentCache=new WeakMap<readonly Point[],Map<string,ClippedMoment>>();
export function clearCapMomentCache():void{momentCache=new WeakMap();}
function rememberMoment(cache:Map<string,ClippedMoment>,key:string,value:ClippedMoment):ClippedMoment{
  cache.set(key,value);if(cache.size>MOMENT_CACHE_LIMIT)cache.delete(cache.keys().next().value!);return value;
}
export function capMoment(ring:readonly Point[],direction:Point,threshold:number,keepAbove=true):ClippedMoment{
  let cache=momentCache.get(ring);if(!cache){cache=new Map();momentCache.set(ring,cache);}
  const key=`${direction.x.toFixed(12)},${direction.y.toFixed(12)},${threshold.toFixed(9)},${keepAbove?1:0}`;
  const cached=cache.get(key);if(cached)return cached;
  const clipped=clipRingHalfPlane(ring,direction,threshold,keepAbove);
  if(clipped.length<3)return rememberMoment(cache,key,{ring:clipped,areaMm2:0,centroid:null,firstMomentMm3:0});
  const metrics=measureRing(clipped); const area=metrics.area;
  if(area<=1e-12)return rememberMoment(cache,key,{ring:clipped,areaMm2:0,centroid:null,firstMomentMm3:0});
  const signedDistance=keepAbove?dot(metrics.centroid,direction)-threshold:threshold-dot(metrics.centroid,direction);
  return rememberMoment(cache,key,{ring:clipped,areaMm2:area,centroid:metrics.centroid,firstMomentMm3:Math.max(0,area*signedDistance)});
}
