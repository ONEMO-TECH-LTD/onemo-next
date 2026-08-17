import type { AdaptiveBox, AdaptiveOptions, Bounds, FeasibleTranslationSet, Point, PreparedPolygon } from './contracts.js';
import { ComputeError } from './contracts.js';
import { clearanceAtPoint } from './clearance.js';
import { discsContainedExact } from './containment.js';
import { add, boxHalfDiagonal, boxKey, boundsHeight, boundsWidth, clampPoint, quantizeNonNegativeCeiling, quantizePoint, dequantizePoint } from './numeric.js';

interface ClassifiedBox {
  readonly status: 'INSIDE' | 'OUTSIDE' | 'BOUNDARY';
  readonly lowerMargin: number;
  readonly upperMargin: number;
}

const FEASIBILITY_CACHE_LIMIT=512;
const feasibilityCache=new Map<string,FeasibleTranslationSet>();
export function clearAdaptiveFeasibilityCache():void{feasibilityCache.clear();}
function rememberFeasibility(key:string,value:FeasibleTranslationSet):FeasibleTranslationSet{
  feasibilityCache.delete(key);feasibilityCache.set(key,value);
  if(feasibilityCache.size>FEASIBILITY_CACHE_LIMIT)feasibilityCache.delete(feasibilityCache.keys().next().value!);
  return value;
}

function makeBox(bounds: Bounds, depth: number, status: AdaptiveBox['status']): AdaptiveBox {
  return Object.freeze({ ...bounds, depth, status, id: boxKey(bounds, depth) });
}

export function boxCentre(box: Bounds): Point {
  return { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
}

export function splitBox(box: Bounds): Bounds[] {
  const c=boxCentre(box);
  return [
    {minX:box.minX,minY:box.minY,maxX:c.x,maxY:c.y},
    {minX:c.x,minY:box.minY,maxX:box.maxX,maxY:c.y},
    {minX:box.minX,minY:c.y,maxX:c.x,maxY:box.maxY},
    {minX:c.x,minY:c.y,maxX:box.maxX,maxY:box.maxY}
  ];
}

export function classifyFeasibleBox(
  polygon: PreparedPolygon,
  offsets: readonly Point[],
  radiusMm: number,
  box: Bounds
): ClassifiedBox {
  if (offsets.length===0) return {status:'INSIDE',lowerMargin:Infinity,upperMargin:Infinity};
  const centre=boxCentre(box); const delta=boxHalfDiagonal(box);
  let lower=Infinity,upper=Infinity; let allInside=true;
  for(const offset of offsets){
    const evidence=clearanceAtPoint(polygon,add(centre,offset));
    const signed=evidence.signedClearanceMm;
    lower=Math.min(lower,signed-delta-radiusMm);
    upper=Math.min(upper,signed+delta-radiusMm);
    if(signed-delta<radiusMm)allInside=false;
    if(signed+delta<radiusMm)return{status:'OUTSIDE',lowerMargin:lower,upperMargin:upper};
  }
  return allInside?{status:'INSIDE',lowerMargin:lower,upperMargin:upper}:{status:'BOUNDARY',lowerMargin:lower,upperMargin:upper};
}

function candidatePointsForBox(box: Bounds, canonical: Point): Point[] {
  const c=boxCentre(box); const clamped=clampPoint(canonical,box);
  return [
    clamped,c,
    {x:box.minX,y:box.minY},{x:box.maxX,y:box.minY},{x:box.minX,y:box.maxY},{x:box.maxX,y:box.maxY},
    {x:c.x,y:box.minY},{x:c.x,y:box.maxY},{x:box.minX,y:c.y},{x:box.maxX,y:c.y}
  ];
}

function minimumMargin(polygon:PreparedPolygon,offsets:readonly Point[],translation:Point,radiusMm:number):number{
  let margin=Infinity;
  for(const offset of offsets){
    const c=clearanceAtPoint(polygon,add(translation,offset));
    margin=Math.min(margin,c.signedClearanceMm-radiusMm);
  }
  return margin;
}

function improveWitness(
  polygon:PreparedPolygon,
  offsets:readonly Point[],
  radiusMm:number,
  box:Bounds,
  seed:Point,
  iterations:number
):Point{
  let best=clampPoint(seed,box); let bestScore=minimumMargin(polygon,offsets,best,radiusMm);
  let step=Math.max(boundsWidth(box),boundsHeight(box))/2;
  for(let iteration=0;iteration<iterations&&step>polygon.quantumMm/2;iteration++){
    let changed=false;
    for(const [dx,dy] of [[step,0],[-step,0],[0,step],[0,-step],[step,step],[-step,step],[step,-step],[-step,-step]] as const){
      const candidate=clampPoint({x:best.x+dx,y:best.y+dy},box);
      const score=minimumMargin(polygon,offsets,candidate,radiusMm);
      if(score>bestScore+1e-12){best=candidate;bestScore=score;changed=true;}
    }
    if(!changed)step/=2;
  }
  return best;
}

function exactPatternLegal(polygon:PreparedPolygon,offsets:readonly Point[],translation:Point,radiusMm:number):boolean{
  return discsContainedExact(polygon,offsets.map(o=>add(translation,o)),radiusMm).every(r=>r.legal);
}

function snappedPoint(point:Point,polygon:PreparedPolygon):Point{
  return dequantizePoint(quantizePoint(point,polygon.quantumMm),polygon.quantumMm);
}

function rectangularFeasibleTranslations(polygon:PreparedPolygon,offsets:readonly Point[],radiusMm:number,domain:Bounds,toleranceMm:number,canonicalTarget:Point):FeasibleTranslationSet|undefined{
  if(polygon.ringMm.length!==4||!polygon.edges.every(edge=>Math.abs(edge.dx)<=1e-12||Math.abs(edge.dy)<=1e-12))return undefined;
  const radius=quantizeNonNegativeCeiling(radiusMm,polygon.quantumMm)*polygon.quantumMm;
  let minX=domain.minX,minY=domain.minY,maxX=domain.maxX,maxY=domain.maxY;
  for(const offset of offsets){minX=Math.max(minX,polygon.metrics.bounds.minX+radius-offset.x);maxX=Math.min(maxX,polygon.metrics.bounds.maxX-radius-offset.x);minY=Math.max(minY,polygon.metrics.bounds.minY+radius-offset.y);maxY=Math.min(maxY,polygon.metrics.bounds.maxY-radius-offset.y);}
  if(minX>maxX+1e-12||minY>maxY+1e-12)return Object.freeze({domain,insideBoxes:Object.freeze([]),boundaryBoxes:Object.freeze([]),witnessPoints:Object.freeze([]),status:'INFEASIBLE_CERTIFIED',toleranceMm,cellsVisited:1,maxDepthReached:0,exactness:'EXACT'});
  const bounds={minX:Math.min(minX,maxX),minY:Math.min(minY,maxY),maxX:Math.max(minX,maxX),maxY:Math.max(minY,maxY)},box=makeBox(bounds,0,'INSIDE');
  const witnesses:Point[]=[];for(const candidate of candidatePointsForBox(bounds,canonicalTarget)){const point=snappedPoint(candidate,polygon);if(exactPatternLegal(polygon,offsets,point,radiusMm)){witnesses.push(point);break;}}
  return Object.freeze({domain,insideBoxes:Object.freeze([box]),boundaryBoxes:Object.freeze([]),witnessPoints:Object.freeze(witnesses),status:witnesses.length?'FEASIBLE':'INDETERMINATE_WITHIN_TOLERANCE',toleranceMm,cellsVisited:1,maxDepthReached:0,exactness:witnesses.length?'EXACT':'INDETERMINATE'});
}

export function adaptiveFeasibleTranslations(
  polygon: PreparedPolygon,
  offsets: readonly Point[],
  radiusMm: number,
  domain: Bounds,
  options: AdaptiveOptions,
  canonicalTarget: Point={x:0,y:0}
): FeasibleTranslationSet {
  if(!Number.isFinite(radiusMm)||radiusMm<0)throw new ComputeError('INVALID_RADIUS','radius must be finite and non-negative',{radiusMm});
  if(options.toleranceMm<=0||options.maxCells<1)throw new ComputeError('BACKEND_FAILURE','invalid adaptive options',{options});
  const cacheKey=`${polygon.geometryHash}:${offsets.map(offset=>`${offset.x},${offset.y}`).join(';')}:${radiusMm}:${domain.minX},${domain.minY},${domain.maxX},${domain.maxY}:${options.toleranceMm}:${options.maxCells}:${options.maxDepth??32}:${options.witnessIterations??12}:${canonicalTarget.x},${canonicalTarget.y}`;
  const cached=feasibilityCache.get(cacheKey);if(cached){feasibilityCache.delete(cacheKey);feasibilityCache.set(cacheKey,cached);return cached;}
  const rectangle=rectangularFeasibleTranslations(polygon,offsets,radiusMm,domain,options.toleranceMm,canonicalTarget);if(rectangle)return rememberFeasibility(cacheKey,rectangle);
  const maxDepth=options.maxDepth??32;
  const queue:{bounds:Bounds;depth:number}[]=[{bounds:domain,depth:0}];
  const inside:AdaptiveBox[]=[]; const boundary:AdaptiveBox[]=[];
  let visited=0,cursor=0,maxDepthReached=0,resourceExhausted=false;
  while(cursor<queue.length){
    if(visited>=options.maxCells){resourceExhausted=true;break;}
    const current=queue[cursor++]!; visited++; maxDepthReached=Math.max(maxDepthReached,current.depth);
    const classification=classifyFeasibleBox(polygon,offsets,radiusMm,current.bounds);
    if(classification.status==='INSIDE'){inside.push(makeBox(current.bounds,current.depth,'INSIDE'));continue;}
    if(classification.status==='OUTSIDE')continue;
    const terminal=Math.max(boundsWidth(current.bounds),boundsHeight(current.bounds))<=options.toleranceMm||current.depth>=maxDepth;
    if(terminal){boundary.push(makeBox(current.bounds,current.depth,'BOUNDARY'));continue;}
    for(const child of splitBox(current.bounds))queue.push({bounds:child,depth:current.depth+1});
  }
  if(resourceExhausted){
    for(let index=cursor;index<queue.length;index++){const item=queue[index]!;boundary.push(makeBox(item.bounds,item.depth,'BOUNDARY'));}
  }
  const witnesses:Point[]=[];
  const witnessIterations=options.witnessIterations??12;
  const witnessBoxes=inside.length?[inside[0]!]:boundary;
  witnessSearch:for(const box of witnessBoxes){
    const seeds=candidatePointsForBox(box,canonicalTarget);
    if(box.status==='BOUNDARY')seeds.unshift(improveWitness(polygon,offsets,radiusMm,box,boxCentre(box),witnessIterations));
    for(const seed of seeds){
      const point=snappedPoint(seed,polygon);
      if(exactPatternLegal(polygon,offsets,point,radiusMm)){witnesses.push(point);break witnessSearch;}
    }
  }
  let status:FeasibleTranslationSet['status'];
  if(inside.length>0||witnesses.length>0)status='FEASIBLE';
  else if(boundary.length===0&&!resourceExhausted)status='INFEASIBLE_CERTIFIED';
  else status='INDETERMINATE_WITHIN_TOLERANCE';
  return rememberFeasibility(cacheKey,Object.freeze({
    domain,
    insideBoxes:Object.freeze(inside),
    boundaryBoxes:Object.freeze(boundary),
    witnessPoints:Object.freeze(witnesses),
    status,
    toleranceMm:options.toleranceMm,
    cellsVisited:visited,
    maxDepthReached,
    exactness:boundary.length===0&&!resourceExhausted?'EXACT':status==='INDETERMINATE_WITHIN_TOLERANCE'?'INDETERMINATE':'CERTIFIED_APPROXIMATE'
  }));
}
