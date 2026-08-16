import type { AdaptiveBox, AdaptiveOptions, Bounds, FeasibleTranslationSet, Point, PreparedPolygon } from './contracts.js';
import { ComputeError } from './contracts.js';
import { clearanceAtPoint } from './clearance.js';
import { discsContainedExact } from './containment.js';
import { add, boxHalfDiagonal, boxKey, boundsHeight, boundsWidth, clampPoint, quantizePoint, dequantizePoint } from './numeric.js';

interface ClassifiedBox {
  readonly status: 'INSIDE' | 'OUTSIDE' | 'BOUNDARY';
  readonly lowerMargin: number;
  readonly upperMargin: number;
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
  const maxDepth=options.maxDepth??32;
  const queue:{bounds:Bounds;depth:number}[]=[{bounds:domain,depth:0}];
  const inside:AdaptiveBox[]=[]; const boundary:AdaptiveBox[]=[];
  let visited=0,maxDepthReached=0,resourceExhausted=false;
  while(queue.length>0){
    if(visited>=options.maxCells){resourceExhausted=true;break;}
    const current=queue.shift()!; visited++; maxDepthReached=Math.max(maxDepthReached,current.depth);
    const classification=classifyFeasibleBox(polygon,offsets,radiusMm,current.bounds);
    if(classification.status==='INSIDE'){inside.push(makeBox(current.bounds,current.depth,'INSIDE'));continue;}
    if(classification.status==='OUTSIDE')continue;
    const terminal=Math.max(boundsWidth(current.bounds),boundsHeight(current.bounds))<=options.toleranceMm||current.depth>=maxDepth;
    if(terminal){boundary.push(makeBox(current.bounds,current.depth,'BOUNDARY'));continue;}
    for(const child of splitBox(current.bounds))queue.push({bounds:child,depth:current.depth+1});
  }
  if(resourceExhausted){
    for(const item of queue)boundary.push(makeBox(item.bounds,item.depth,'BOUNDARY'));
  }
  const witnesses:Point[]=[]; const seen=new Set<string>();
  const witnessIterations=options.witnessIterations??12;
  for(const box of [...inside,...boundary]){
    const seeds=candidatePointsForBox(box,canonicalTarget);
    if(box.status==='BOUNDARY')seeds.unshift(improveWitness(polygon,offsets,radiusMm,box,boxCentre(box),witnessIterations));
    for(const seed of seeds){
      const point=snappedPoint(seed,polygon); const key=`${point.x},${point.y}`;
      if(seen.has(key))continue; seen.add(key);
      if(exactPatternLegal(polygon,offsets,point,radiusMm))witnesses.push(point);
    }
  }
  witnesses.sort((a,b)=>a.x-b.x||a.y-b.y);
  let status:FeasibleTranslationSet['status'];
  if(inside.length>0||witnesses.length>0)status='FEASIBLE';
  else if(boundary.length===0&&!resourceExhausted)status='INFEASIBLE_CERTIFIED';
  else status='INDETERMINATE_WITHIN_TOLERANCE';
  return Object.freeze({
    domain,
    insideBoxes:Object.freeze(inside),
    boundaryBoxes:Object.freeze(boundary),
    witnessPoints:Object.freeze(witnesses),
    status,
    toleranceMm:options.toleranceMm,
    cellsVisited:visited,
    maxDepthReached,
    exactness:boundary.length===0&&!resourceExhausted?'EXACT':status==='INDETERMINATE_WITHIN_TOLERANCE'?'INDETERMINATE':'CERTIFIED_APPROXIMATE'
  });
}
