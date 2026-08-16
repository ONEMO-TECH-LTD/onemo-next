import type { Bounds, Point, PolygonMetrics } from './contracts.js';

export function measureRing(ring: readonly Point[]): PolygonMetrics {
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  let twiceArea=0,cxNumerator=0,cyNumerator=0;
  for(let i=0;i<ring.length;i++){
    const a=ring[i]!; const b=ring[(i+1)%ring.length]!;
    minX=Math.min(minX,a.x);minY=Math.min(minY,a.y);maxX=Math.max(maxX,a.x);maxY=Math.max(maxY,a.y);
    const cross=a.x*b.y-b.x*a.y;
    twiceArea+=cross;
    cxNumerator+=(a.x+b.x)*cross;
    cyNumerator+=(a.y+b.y)*cross;
  }
  const signedArea=twiceArea/2;
  const area=Math.abs(signedArea);
  const centroid = Math.abs(twiceArea)>1e-18
    ? {x:cxNumerator/(3*twiceArea),y:cyNumerator/(3*twiceArea)}
    : {x:(minX+maxX)/2,y:(minY+maxY)/2};
  const bounds:Bounds={minX,minY,maxX,maxY};
  return {
    bounds,
    width:maxX-minX,
    height:maxY-minY,
    dominantDimension:Math.max(maxX-minX,maxY-minY),
    signedArea,area,centroid,
    boundsCenter:{x:(minX+maxX)/2,y:(minY+maxY)/2},
    centroidInside:false,
    vertexCount:ring.length,
    edgeCount:ring.length
  };
}

const PROJECTION_CACHE_LIMIT=512;
let projectionCache=new WeakMap<readonly Point[],Map<string,{min:number;max:number}>>();
export function clearProjectionCache():void{projectionCache=new WeakMap();}
export function projectRing(ring: readonly Point[], direction: Point): {min:number;max:number} {
  let cache=projectionCache.get(ring);if(!cache){cache=new Map();projectionCache.set(ring,cache);}
  const key=`${direction.x.toFixed(12)},${direction.y.toFixed(12)}`;const cached=cache.get(key);if(cached)return cached;
  let min=Infinity,max=-Infinity;
  for(const point of ring){
    const value=point.x*direction.x+point.y*direction.y;
    min=Math.min(min,value);max=Math.max(max,value);
  }
  const result={min,max};cache.set(key,result);if(cache.size>PROJECTION_CACHE_LIMIT)cache.delete(cache.keys().next().value!);return result;
}
