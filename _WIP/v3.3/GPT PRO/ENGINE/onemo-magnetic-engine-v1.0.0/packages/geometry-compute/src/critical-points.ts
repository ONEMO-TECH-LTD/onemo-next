import type { Bounds, Point, PreparedPolygon, RegionEvidence } from './contracts.js';
import { add, clampPoint, dequantizePoint, dot, normalizeDirection, quantizePoint, squaredDistance, subtract } from './numeric.js';
import { discsContainedExact } from './containment.js';
import { clearanceAtPoint } from './clearance.js';

function lineIntersection(p:Point,d:Point,q:Point,e:Point):Point|null{
  const det=d.x*e.y-d.y*e.x;if(Math.abs(det)<1e-12)return null;
  const r=subtract(q,p);const t=(r.x*e.y-r.y*e.x)/det;return{x:p.x+t*d.x,y:p.y+t*d.y};
}
function inwardNormal(a:Point,b:Point):Point{
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);return len?{x:-dy/len,y:dx/len}:{x:0,y:0};
}
function exactLegal(polygon:PreparedPolygon,offsets:readonly Point[],translation:Point,radiusMm:number):boolean{
  return discsContainedExact(polygon,offsets.map(o=>add(translation,o)),radiusMm).every(r=>r.legal);
}
function fastLegal(polygon:PreparedPolygon,offsets:readonly Point[],translation:Point,radiusMm:number):boolean{
  return minimumMargin(polygon,offsets,translation,radiusMm)>=-1e-9;
}
function snap(point:Point,polygon:PreparedPolygon):Point{return dequantizePoint(quantizePoint(point,polygon.quantumMm),polygon.quantumMm);}
function inDomain(p:Point,d:Bounds):boolean{return p.x>=d.minX-1e-12&&p.x<=d.maxX+1e-12&&p.y>=d.minY-1e-12&&p.y<=d.maxY+1e-12;}

function minimumMargin(polygon:PreparedPolygon,offsets:readonly Point[],translation:Point,radiusMm:number):number{
  let best=Infinity;for(const o of offsets)best=Math.min(best,clearanceAtPoint(polygon,add(translation,o)).signedClearanceMm-radiusMm);return best;
}

function improveMargin(polygon:PreparedPolygon,offsets:readonly Point[],radiusMm:number,domain:Bounds,seed:Point):Point{
  let best=clampPoint(seed,domain),score=minimumMargin(polygon,offsets,best,radiusMm),step=Math.max(domain.maxX-domain.minX,domain.maxY-domain.minY)/4;
  for(let iteration=0;iteration<24&&step>polygon.quantumMm/2;iteration++){
    let changed=false;
    for(const [dx,dy] of [[step,0],[-step,0],[0,step],[0,-step],[step,step],[-step,step],[step,-step],[-step,-step]] as const){
      const p=clampPoint({x:best.x+dx,y:best.y+dy},domain);const s=minimumMargin(polygon,offsets,p,radiusMm);
      if(s>score+1e-10){best=p;score=s;changed=true;}
    }
    if(!changed)step/=2;
  }
  return best;
}

function pushDirection(polygon:PreparedPolygon,offsets:readonly Point[],radiusMm:number,domain:Bounds,seed:Point,directionInput:Point):Point{
  const direction=normalizeDirection(directionInput);let current=seed;
  if(!fastLegal(polygon,offsets,current,radiusMm))return seed;
  const maxDistance=Math.max(domain.maxX-domain.minX,domain.maxY-domain.minY)*2;let low=0,high=0,step=1;
  while(high<maxDistance){
    const next=clampPoint({x:seed.x+direction.x*(high+step),y:seed.y+direction.y*(high+step)},domain);
    const travelled=Math.hypot(next.x-seed.x,next.y-seed.y);
    if(travelled<=high+1e-12){high=travelled;break;}
    if(!fastLegal(polygon,offsets,next,radiusMm)){high=travelled;break;}
    low=travelled;high=travelled;current=next;step*=2;
  }
  if(high<=low+1e-12)return current;
  for(let i=0;i<28;i++){
    const mid=(low+high)/2;const p=clampPoint({x:seed.x+direction.x*mid,y:seed.y+direction.y*mid},domain);
    if(fastLegal(polygon,offsets,p,radiusMm)){low=mid;current=p;}else high=mid;
  }
  return current;
}

export interface CriticalCandidateOptions {
  readonly hints?:readonly Point[];
  readonly regions?:readonly RegionEvidence[];
  readonly includeDirectionalExtrema?:boolean;
  readonly gridDivisions?:number;
  readonly maxCandidates?:number;
}

export function criticalTranslationCandidates(
  polygon:PreparedPolygon,
  offsets:readonly Point[],
  radiusMm:number,
  domain:Bounds,
  options:CriticalCandidateOptions={}
):Point[]{
  const canonical=clampPoint({x:0,y:0},domain);
  const canonicalFeasible=fastLegal(polygon,offsets,canonical,radiusMm);
  const raw:Point[]=[canonical,...(options.hints??[])];
  const divisions=options.gridDivisions??2;
  if(!canonicalFeasible)for(let iy=0;iy<=divisions;iy++)for(let ix=0;ix<=divisions;ix++)raw.push({x:domain.minX+(domain.maxX-domain.minX)*ix/divisions,y:domain.minY+(domain.maxY-domain.minY)*iy/divisions});
  for(const region of options.regions??[]){
    const c={x:(region.bounds.minX+region.bounds.maxX)/2,y:(region.bounds.minY+region.bounds.maxY)/2};
    const reps=[c,{x:c.x,y:region.bounds.maxY},{x:c.x,y:region.bounds.minY},{x:region.bounds.minX,y:c.y},{x:region.bounds.maxX,y:c.y}];
    for(const rep of reps)for(const offset of offsets)raw.push(subtract(rep,offset));
  }
  // Boundary-induced critical points are only needed when region/canonical hints are sparse.
  const ring=polygon.ringMm;
  if((options.regions?.length??0)===0 || !canonicalFeasible){
    const stride=Math.max(1,Math.ceil(ring.length/24));
    for(let i=0;i<ring.length;i+=stride){
      const prev=ring[(i+ring.length-1)%ring.length]!,v=ring[i]!,next=ring[(i+1)%ring.length]!;
      const nPrev=inwardNormal(prev,v),nNext=inwardNormal(v,next);
      const p1=add(v,{x:nPrev.x*radiusMm,y:nPrev.y*radiusMm});
      const p2=add(v,{x:nNext.x*radiusMm,y:nNext.y*radiusMm});
      const corner=lineIntersection(p1,subtract(v,prev),p2,subtract(next,v));
      const edgeMid={x:(v.x+next.x)/2+nNext.x*radiusMm,y:(v.y+next.y)/2+nNext.y*radiusMm};
      for(const centre of corner?[corner,edgeMid]:[edgeMid])for(const offset of offsets)raw.push(subtract(centre,offset));
    }
  }
  if(!canonicalFeasible)raw.push(improveMargin(polygon,offsets,radiusMm,domain,{x:0,y:0}));
  const unique=new Map<string,Point>();
  const addIfLegal=(candidate:Point)=>{
    const clamped=clampPoint(candidate,domain);const p=snap(clamped,polygon);if(!inDomain(p,domain)||!fastLegal(polygon,offsets,p,radiusMm))return;
    unique.set(`${p.x},${p.y}`,p);
  };
  for(const candidate of raw)addIfLegal(candidate);
  if(options.includeDirectionalExtrema!==false){
    const seeds=[...unique.values()].sort((a,b)=>squaredDistance(a,{x:0,y:0})-squaredDistance(b,{x:0,y:0})).slice(0,6);
    for(const seed of seeds)for(const direction of [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}])addIfLegal(pushDirection(polygon,offsets,radiusMm,domain,seed,direction));
  }
  // Add margin-improved versions of the best few raw seeds.
  for(const seed of [...unique.values()].sort((a,b)=>squaredDistance(a,{x:0,y:0})-squaredDistance(b,{x:0,y:0})).slice(0,4))addIfLegal(improveMargin(polygon,offsets,radiusMm,domain,seed));
  return [...unique.values()].sort((a,b)=>a.x-b.x||a.y-b.y).slice(0,options.maxCandidates??512);
}
