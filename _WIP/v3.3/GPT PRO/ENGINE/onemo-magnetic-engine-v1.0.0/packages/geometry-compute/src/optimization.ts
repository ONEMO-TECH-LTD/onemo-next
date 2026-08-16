import type { AdaptiveBox, AdaptiveOptions, CompoundScoreInterval, GeometryCriterionDescriptor, OptimizationResult, Point, PreparedPolygon, ScoreInterval } from './contracts.js';
import { classifyFeasibleBox, splitBox, boxCentre } from './adaptive.js';
import { evaluateCriterionOnBox } from './criteria.js';
import { boxKey, boundsHeight, boundsWidth } from './numeric.js';
import { discsContainedExact } from './containment.js';
import { add } from './numeric.js';

export type Direction = 'MIN'|'MAX';

function asComponents(score:ScoreInterval|CompoundScoreInterval):readonly ScoreInterval[]{
  return 'components' in score?score.components:[score];
}

export function descriptorDirections(descriptor:GeometryCriterionDescriptor):readonly Direction[]{
  switch(descriptor.id){
    case 'REGION_COVERAGE_V1':return['MAX','MIN'];
    case 'REGION_SUBSET_COVERAGE_V1':return['MAX'];
    case 'CAP_FIRST_MOMENT_V1':return['MIN'];
    case 'MAX_DIRECTIONAL_OVERHANG_V1':return['MIN'];
    case 'DISCRETE_SCALAR_V1':return[descriptor.comparator];
    case 'REGION_MAX_LOAD_V1':return['MIN'];
    case 'ANCHOR_CENTROID_BALANCE_V1':return['MIN','MIN'];
    case 'POINT_COUNT_V1':return['MIN'];
    case 'DISCRETE_KEY_V1':return['MIN'];
    case 'FINAL_REGISTRATION_ORDER_V1':return['MIN','MIN','MIN'];
  }
}

function globalScalarAnchor(intervals:readonly ScoreInterval[],direction:Direction):ScoreInterval{
  if(direction==='MIN')return{lower:Math.min(...intervals.map(i=>i.lower)),upper:Math.min(...intervals.map(i=>i.upper))};
  return{lower:Math.max(...intervals.map(i=>i.lower)),upper:Math.max(...intervals.map(i=>i.upper))};
}

function certifiedEquivalentToAnchor(value:ScoreInterval,anchor:ScoreInterval,direction:Direction,tolerance:number):boolean{
  return direction==='MIN'?value.upper<=anchor.lower+tolerance:value.lower>=anchor.upper-tolerance;
}

function certifiedWorseThanAnchor(value:ScoreInterval,anchor:ScoreInterval,direction:Direction,tolerance:number):boolean{
  return direction==='MIN'?value.lower>anchor.upper+tolerance:value.upper<anchor.lower-tolerance;
}

export function possiblyEquivalentToAnchor(
  score:ScoreInterval|CompoundScoreInterval,
  anchor:ScoreInterval|CompoundScoreInterval,
  directions:readonly Direction[],
  tolerances:readonly number[]
):boolean{
  const values=asComponents(score),anchors=asComponents(anchor);
  for(let i=0;i<directions.length;i++){
    const value=values[i]!,a=anchors[i]!,direction=directions[i]!,tolerance=tolerances[i]??0;
    if(certifiedEquivalentToAnchor(value,a,direction,tolerance))continue;
    if(certifiedWorseThanAnchor(value,a,direction,tolerance))return false;
    return true; // uncertain or potentially better: retain.
  }
  return true;
}

export function computeGlobalAnchor(
  scores:readonly (ScoreInterval|CompoundScoreInterval)[],
  directions:readonly Direction[],
  tolerances:readonly number[]
):ScoreInterval|CompoundScoreInterval{
  let active=scores.map((score,index)=>({score,index})); const anchors:ScoreInterval[]=[];
  for(let component=0;component<directions.length;component++){
    const intervals=active.map(item=>asComponents(item.score)[component]!);
    const anchor=globalScalarAnchor(intervals,directions[component]!);anchors.push(anchor);
    active=active.filter(item=>{
      const value=asComponents(item.score)[component]!;
      return !certifiedWorseThanAnchor(value,anchor,directions[component]!,tolerances[component]??0);
    });
  }
  return anchors.length===1?anchors[0]!:Object.freeze({components:Object.freeze(anchors)});
}

function makeBox(bounds:{minX:number;minY:number;maxX:number;maxY:number},depth:number,status:AdaptiveBox['status']):AdaptiveBox{
  return Object.freeze({...bounds,depth,status,id:boxKey(bounds,depth)});
}

function exactLegal(polygon:PreparedPolygon,offsets:readonly Point[],translation:Point,radiusMm:number):boolean{
  return discsContainedExact(polygon,offsets.map(o=>add(translation,o)),radiusMm).every(r=>r.legal);
}

export function optimizeCriterion(
  polygon:PreparedPolygon,
  offsets:readonly Point[],
  radiusMm:number,
  initialBoxes:readonly AdaptiveBox[],
  descriptor:GeometryCriterionDescriptor,
  tolerances:readonly number[],
  options:AdaptiveOptions
):OptimizationResult{
  const directions=descriptorDirections(descriptor);
  let boxes=[...initialBoxes];let refinements=0;let visited=boxes.length;
  const maxDepth=options.maxDepth??32;
  for(;;){
    if(boxes.length===0)return{descriptorId:descriptor.id,survivingBoxes:[],witnessPoints:[],optimum:{lower:Infinity,upper:Infinity},status:'INDETERMINATE_WITHIN_TOLERANCE',refinements};
    const evaluations=boxes.map(box=>evaluateCriterionOnBox(polygon,offsets,box,descriptor));
    const anchor=computeGlobalAnchor(evaluations.map(e=>e.score),directions,tolerances);
    let survivors=boxes.filter((_,index)=>possiblyEquivalentToAnchor(evaluations[index]!.score,anchor,directions,tolerances));
    const refinable=survivors.filter(box=>
      Math.max(boundsWidth(box),boundsHeight(box))>options.toleranceMm&&box.depth<maxDepth
    );
    // Stop if every surviving score is certified equivalent to the global anchor and spatial cells are at tolerance.
    const allEquivalent=survivors.every(box=>{
      const evaluation=evaluateCriterionOnBox(polygon,offsets,box,descriptor);
      const components=asComponents(evaluation.score),anchors=asComponents(anchor);
      return directions.every((direction,index)=>certifiedEquivalentToAnchor(components[index]!,anchors[index]!,direction,tolerances[index]??0));
    });
    if(refinable.length===0||allEquivalent){
      const witnesses:Point[]=[];
      for(const box of survivors){const p=boxCentre(box);if(exactLegal(polygon,offsets,p,radiusMm))witnesses.push(p);}
      const status=allEquivalent?'CERTIFIED':'INDETERMINATE_WITHIN_TOLERANCE';
      return{descriptorId:descriptor.id,survivingBoxes:Object.freeze(survivors),witnessPoints:Object.freeze(witnesses),optimum:anchor,status,refinements};
    }
    const keep=new Set(refinable.map(b=>b.id));const next:AdaptiveBox[]=survivors.filter(b=>!keep.has(b.id));
    for(const box of refinable){
      for(const child of splitBox(box)){
        if(visited++>=options.maxCells){
          return{descriptorId:descriptor.id,survivingBoxes:Object.freeze(survivors),witnessPoints:Object.freeze([]),optimum:anchor,status:'INDETERMINATE_WITHIN_TOLERANCE',refinements};
        }
        const classification=box.status==='INSIDE'?{status:'INSIDE' as const}:classifyFeasibleBox(polygon,offsets,radiusMm,child);
        if(classification.status==='OUTSIDE')continue;
        next.push(makeBox(child,box.depth+1,classification.status));
      }
      refinements++;
    }
    boxes=next;
  }
}

export function restrictCriterionToAnchor(
  polygon:PreparedPolygon,
  offsets:readonly Point[],
  radiusMm:number,
  initialBoxes:readonly AdaptiveBox[],
  descriptor:GeometryCriterionDescriptor,
  anchor:ScoreInterval|CompoundScoreInterval,
  tolerances:readonly number[],
  options:AdaptiveOptions
):OptimizationResult{
  const directions=descriptorDirections(descriptor);let boxes=[...initialBoxes];let refinements=0;let visited=boxes.length;
  const maxDepth=options.maxDepth??32;
  for(;;){
    const evaluations=boxes.map(box=>evaluateCriterionOnBox(polygon,offsets,box,descriptor));
    const survivors=boxes.filter((_,index)=>possiblyEquivalentToAnchor(evaluations[index]!.score,anchor,directions,tolerances));
    if(survivors.length===0)return{descriptorId:descriptor.id,survivingBoxes:[],witnessPoints:[],optimum:anchor,status:'CERTIFIED',refinements};
    const uncertain=survivors.filter(box=>{
      const evaluation=evaluateCriterionOnBox(polygon,offsets,box,descriptor);
      const values=asComponents(evaluation.score),anchors=asComponents(anchor);
      const equivalent=directions.every((direction,index)=>certifiedEquivalentToAnchor(values[index]!,anchors[index]!,direction,tolerances[index]??0));
      return !equivalent&&Math.max(boundsWidth(box),boundsHeight(box))>options.toleranceMm&&box.depth<maxDepth;
    });
    if(uncertain.length===0){
      const status=survivors.every(box=>{
        const evaluation=evaluateCriterionOnBox(polygon,offsets,box,descriptor);const values=asComponents(evaluation.score),anchors=asComponents(anchor);
        return directions.every((direction,index)=>certifiedEquivalentToAnchor(values[index]!,anchors[index]!,direction,tolerances[index]??0));
      })?'CERTIFIED':'INDETERMINATE_WITHIN_TOLERANCE';
      const witnesses=survivors.map(boxCentre).filter(point=>exactLegal(polygon,offsets,point,radiusMm));
      return{descriptorId:descriptor.id,survivingBoxes:Object.freeze(survivors),witnessPoints:Object.freeze(witnesses),optimum:anchor,status,refinements};
    }
    const splitIds=new Set(uncertain.map(b=>b.id));const next=survivors.filter(b=>!splitIds.has(b.id));
    for(const box of uncertain){
      for(const child of splitBox(box)){
        if(visited++>=options.maxCells)return{descriptorId:descriptor.id,survivingBoxes:Object.freeze(survivors),witnessPoints:Object.freeze([]),optimum:anchor,status:'INDETERMINATE_WITHIN_TOLERANCE',refinements};
        const classification=box.status==='INSIDE'?{status:'INSIDE' as const}:classifyFeasibleBox(polygon,offsets,radiusMm,child);
        if(classification.status!=='OUTSIDE')next.push(makeBox(child,box.depth+1,classification.status));
      }
      refinements++;
    }
    boxes=next;
  }
}
