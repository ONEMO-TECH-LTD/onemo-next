import type { AdaptiveBox, AdaptiveOptions, CompoundScoreInterval, GeometryCriterionDescriptor, OptimizationResult, Point, PreparedPolygon, ScoreInterval } from './contracts.js';
import { classifyFeasibleBox, splitBox, boxCentre } from './adaptive.js';
import { evaluateCriterionOnBox } from './criteria.js';
import { boxKey, boundsHeight, boundsWidth } from './numeric.js';
import { discsContainedExact } from './containment.js';
import { add } from './numeric.js';

export type Direction = 'MIN'|'MAX';
const CAP_CUTOFF_CACHE_LIMIT=512;
let capCutoffCache=new WeakMap<PreparedPolygon,Map<string,number>>();
export function clearOptimizationCaches():void{capCutoffCache=new WeakMap();}

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

function symmetricEquivalent(a:ScoreInterval,b:ScoreInterval,direction:Direction,tolerance:number):boolean{
  return direction==='MIN'
    ?a.upper<=b.lower+tolerance&&b.upper<=a.lower+tolerance
    :a.lower>=b.upper-tolerance&&b.lower>=a.upper-tolerance;
}

/** Candidate-to-candidate comparison. Unlike anchored restriction, equivalence
 * is symmetric and no later component may decide while an earlier one is uncertain. */
export function compareCertifiedScores(
  aScore:ScoreInterval|CompoundScoreInterval,
  bScore:ScoreInterval|CompoundScoreInterval,
  directions:readonly Direction[],
  tolerances:readonly number[]
):-1|0|1|null{
  const a=asComponents(aScore),b=asComponents(bScore);
  for(let i=0;i<directions.length;i++){
    const direction=directions[i]!,tolerance=tolerances[i]??0,x=a[i]!,y=b[i]!;
    if(symmetricEquivalent(x,y,direction,tolerance))continue;
    if(direction==='MIN'){
      if(x.upper<y.lower-tolerance)return-1;
      if(y.upper<x.lower-tolerance)return 1;
    }else{
      if(x.lower>y.upper+tolerance)return-1;
      if(y.lower>x.upper+tolerance)return 1;
    }
    return null;
  }
  return 0;
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
    const equivalent=active.filter(item=>{
      const value=asComponents(item.score)[component]!;
      return certifiedEquivalentToAnchor(value,anchor,directions[component]!,tolerances[component]??0);
    });
    if(equivalent.length>0)active=equivalent;
    else active=active.filter(item=>{
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

function axisAlignedCapRestriction(
  polygon:PreparedPolygon,
  offsets:readonly Point[],
  boxes:readonly AdaptiveBox[],
  descriptor:Extract<GeometryCriterionDescriptor,{id:'CAP_FIRST_MOMENT_V1'}>,
  limit:number
):readonly AdaptiveBox[]|undefined{
  if(boxes.some(box=>box.status!=='INSIDE'))return undefined;
  const length=Math.hypot(descriptor.direction.x,descriptor.direction.y);
  if(length<=1e-12)return undefined;
  const direction={x:descriptor.direction.x/length,y:descriptor.direction.y/length};
  const axis=Math.abs(direction.x)>=1-1e-12?'x':Math.abs(direction.y)>=1-1e-12?'y':undefined;
  if(!axis)return undefined;
  const sign=axis==='x'?Math.sign(direction.x):Math.sign(direction.y);
  const projectionBounds=(box:AdaptiveBox):readonly[number,number]=>axis==='x'
    ?sign>0?[box.minX,box.maxX]:[-box.maxX,-box.minX]
    :sign>0?[box.minY,box.maxY]:[-box.maxY,-box.minY];
  const pointAt=(projection:number):AdaptiveBox=>axis==='x'
    ?makeBox({minX:sign*projection,maxX:sign*projection,minY:0,maxY:0},0,'INSIDE')
    :makeBox({minX:0,maxX:0,minY:sign*projection,maxY:sign*projection},0,'INSIDE');
  const rectangle=polygon.ringMm.length===4&&polygon.edges.every(edge=>Math.abs(edge.dx)<=1e-12||Math.abs(edge.dy)<=1e-12);
  const offsetProjections=offsets.map(offset=>offset.x*direction.x+offset.y*direction.y);
  const offsetMaximum=offsetProjections.length?Math.max(...offsetProjections):0;
  const extreme=axis==='x'?(sign>0?polygon.metrics.bounds.maxX:-polygon.metrics.bounds.minX):(sign>0?polygon.metrics.bounds.maxY:-polygon.metrics.bounds.minY);
  const parallelLength=axis==='x'?polygon.metrics.width:polygon.metrics.height;
  const perpendicularLength=axis==='x'?polygon.metrics.height:polygon.metrics.width;
  const scoreAt=(projection:number):number=>{
    if(!rectangle)return asComponents(evaluateCriterionOnBox(polygon,offsets,pointAt(projection),descriptor).score)[0]!.upper;
    const depth=Math.max(0,Math.min(parallelLength,extreme-projection-offsetMaximum));
    return perpendicularLength*depth*depth/2;
  };
  const globalMin=Math.min(...boxes.map(box=>projectionBounds(box)[0]));
  const globalMax=Math.max(...boxes.map(box=>projectionBounds(box)[1]));
  let cache=capCutoffCache.get(polygon);if(!cache){cache=new Map();capCutoffCache.set(polygon,cache);}
  const cutoffKey=`${axis}:${sign}:${offsetMaximum}:${globalMin}:${globalMax}:${limit}`;
  let cutoff=cache.get(cutoffKey);
  if(cutoff===undefined){
    if(scoreAt(globalMax)>limit+1e-12)return Object.freeze([]);
    cutoff=globalMin;
    if(scoreAt(globalMin)>limit+1e-12){
      if(rectangle)cutoff=Math.max(globalMin,extreme-offsetMaximum-Math.sqrt(Math.max(0,2*limit/perpendicularLength)));
      else{
        let low=globalMin,high=globalMax;
        for(let iteration=0;iteration<64;iteration++){
          const middle=(low+high)/2;
          if(scoreAt(middle)<=limit+1e-12)high=middle;else low=middle;
        }
        cutoff=high;
      }
    }
    cache.set(cutoffKey,cutoff);if(cache.size>CAP_CUTOFF_CACHE_LIMIT)cache.delete(cache.keys().next().value!);
  }
  const restricted:AdaptiveBox[]=[];
  for(const box of boxes){
    const [,maximum]=projectionBounds(box);if(maximum<cutoff-1e-12)continue;
    const bounds={minX:box.minX,minY:box.minY,maxX:box.maxX,maxY:box.maxY};
    if(axis==='x'){if(sign>0)bounds.minX=Math.max(bounds.minX,cutoff);else bounds.maxX=Math.min(bounds.maxX,-cutoff);}
    else{if(sign>0)bounds.minY=Math.max(bounds.minY,cutoff);else bounds.maxY=Math.min(bounds.maxY,-cutoff);}
    restricted.push(makeBox(bounds,box.depth,'INSIDE'));
  }
  return Object.freeze(restricted);
}

function cardinalOverhangConstants(
  polygon:PreparedPolygon,
  offsets:readonly Point[],
  descriptor:Extract<GeometryCriterionDescriptor,{id:'MAX_DIRECTIONAL_OVERHANG_V1'}>
):{right:number;left:number;top:number;bottom:number}|undefined{
  const keys=new Set(descriptor.directions.map(raw=>{
    const length=Math.hypot(raw.x,raw.y);if(length<=1e-12)return'invalid';
    const x=raw.x/length,y=raw.y/length;
    if(Math.abs(x-1)<=1e-12&&Math.abs(y)<=1e-12)return'right';
    if(Math.abs(x+1)<=1e-12&&Math.abs(y)<=1e-12)return'left';
    if(Math.abs(y-1)<=1e-12&&Math.abs(x)<=1e-12)return'top';
    if(Math.abs(y+1)<=1e-12&&Math.abs(x)<=1e-12)return'bottom';
    return'invalid';
  }));
  if(keys.size!==4||!(['right','left','top','bottom'] as const).every(key=>keys.has(key)))return undefined;
  const xs=offsets.map(offset=>offset.x),ys=offsets.map(offset=>offset.y);
  const minX=xs.length?Math.min(...xs):0,maxX=xs.length?Math.max(...xs):0,minY=ys.length?Math.min(...ys):0,maxY=ys.length?Math.max(...ys):0;
  return{
    right:polygon.metrics.bounds.maxX-maxX,
    left:minX-polygon.metrics.bounds.minX,
    top:polygon.metrics.bounds.maxY-maxY,
    bottom:minY-polygon.metrics.bounds.minY
  };
}

function cardinalOverhangRestriction(
  boxes:readonly AdaptiveBox[],
  constants:{right:number;left:number;top:number;bottom:number},
  limit:number
):readonly AdaptiveBox[]{
  const restricted:AdaptiveBox[]=[];
  for(const box of boxes){
    if(box.status!=='INSIDE')return Object.freeze([]);
    const bounds={
      minX:Math.max(box.minX,constants.right-limit),maxX:Math.min(box.maxX,limit-constants.left),
      minY:Math.max(box.minY,constants.top-limit),maxY:Math.min(box.maxY,limit-constants.bottom)
    };
    if(bounds.minX<=bounds.maxX+1e-12&&bounds.minY<=bounds.maxY+1e-12)restricted.push(makeBox(bounds,box.depth,'INSIDE'));
  }
  return Object.freeze(restricted);
}

function cardinalOverhangOptimum(
  polygon:PreparedPolygon,
  offsets:readonly Point[],
  boxes:readonly AdaptiveBox[],
  descriptor:Extract<GeometryCriterionDescriptor,{id:'MAX_DIRECTIONAL_OVERHANG_V1'}>,
  constants:{right:number;left:number;top:number;bottom:number}
):ScoreInterval{
  let optimum=Infinity;
  const idealX=(constants.right-constants.left)/2,idealY=(constants.top-constants.bottom)/2;
  for(const box of boxes){
    const x=Math.max(box.minX,Math.min(box.maxX,idealX)),y=Math.max(box.minY,Math.min(box.maxY,idealY));
    const point=makeBox({minX:x,maxX:x,minY:y,maxY:y},0,'INSIDE');
    optimum=Math.min(optimum,asComponents(evaluateCriterionOnBox(polygon,offsets,point,descriptor).score)[0]!.upper);
  }
  return{lower:optimum,upper:optimum};
}

function axisAlignedBalanceTarget(
  offsets:readonly Point[],
  descriptor:Extract<GeometryCriterionDescriptor,{id:'ANCHOR_CENTROID_BALANCE_V1'}>
):{target:Point;axis:'x'|'y'}|undefined{
  const length=Math.hypot(descriptor.lateralDirection.x,descriptor.lateralDirection.y);
  if(length<=1e-12)return undefined;
  const direction={x:descriptor.lateralDirection.x/length,y:descriptor.lateralDirection.y/length};
  const axis=Math.abs(direction.x)>=1-1e-12?'x':Math.abs(direction.y)>=1-1e-12?'y':undefined;
  if(!axis)return undefined;
  let x=0,y=0;for(const offset of offsets){x+=offset.x;y+=offset.y;}
  const count=offsets.length||1;
  return{target:{x:descriptor.materialCentroid.x-x/count,y:descriptor.materialCentroid.y-y/count},axis};
}

function intervalDistance(minimum:number,maximum:number,target:number):number{
  return target<minimum?minimum-target:target>maximum?target-maximum:0;
}

function axisAlignedBalanceRestriction(
  boxes:readonly AdaptiveBox[],
  target:Point,
  axis:'x'|'y',
  firstLimit:number,
  secondLimit:number
):{boxes:readonly AdaptiveBox[];certified:boolean}{
  const radius=Math.sqrt(Math.max(0,secondLimit));const restricted:AdaptiveBox[]=[];let certified=true;
  for(const box of boxes){
    if(box.status!=='INSIDE')return{boxes:Object.freeze([]),certified:false};
    const bounds={minX:Math.max(box.minX,target.x-radius),maxX:Math.min(box.maxX,target.x+radius),minY:Math.max(box.minY,target.y-radius),maxY:Math.min(box.maxY,target.y+radius)};
    if(axis==='x'){bounds.minX=Math.max(bounds.minX,target.x-firstLimit);bounds.maxX=Math.min(bounds.maxX,target.x+firstLimit);}
    else{bounds.minY=Math.max(bounds.minY,target.y-firstLimit);bounds.maxY=Math.min(bounds.maxY,target.y+firstLimit);}
    if(bounds.minX>bounds.maxX+1e-12||bounds.minY>bounds.maxY+1e-12)continue;
    const farX=Math.max(Math.abs(bounds.minX-target.x),Math.abs(bounds.maxX-target.x));
    const farY=Math.max(Math.abs(bounds.minY-target.y),Math.abs(bounds.maxY-target.y));
    if(farX*farX+farY*farY>secondLimit+1e-12)certified=false;
    restricted.push(makeBox(bounds,box.depth,'INSIDE'));
  }
  return{boxes:Object.freeze(restricted),certified};
}

function axisAlignedBalanceOptimum(
  boxes:readonly AdaptiveBox[],
  target:Point,
  axis:'x'|'y',
  firstTolerance:number
):{score:CompoundScoreInterval;firstRestricted:readonly AdaptiveBox[]}{
  const first=Math.min(...boxes.map(box=>axis==='x'?intervalDistance(box.minX,box.maxX,target.x):intervalDistance(box.minY,box.maxY,target.y)));
  const firstRestricted=boxes.flatMap(box=>{
    const bounds={minX:box.minX,minY:box.minY,maxX:box.maxX,maxY:box.maxY};
    if(axis==='x'){bounds.minX=Math.max(bounds.minX,target.x-first-firstTolerance);bounds.maxX=Math.min(bounds.maxX,target.x+first+firstTolerance);}
    else{bounds.minY=Math.max(bounds.minY,target.y-first-firstTolerance);bounds.maxY=Math.min(bounds.maxY,target.y+first+firstTolerance);}
    return bounds.minX<=bounds.maxX+1e-12&&bounds.minY<=bounds.maxY+1e-12?[makeBox(bounds,box.depth,'INSIDE')]:[];
  });
  const second=Math.min(...firstRestricted.map(box=>{
    const dx=intervalDistance(box.minX,box.maxX,target.x),dy=intervalDistance(box.minY,box.maxY,target.y);return dx*dx+dy*dy;
  }));
  return{score:{components:[{lower:first,upper:first},{lower:second,upper:second}]},firstRestricted:Object.freeze(firstRestricted)};
}

export function optimizeCriterion(
  polygon:PreparedPolygon,
  offsets:readonly Point[],
  radiusMm:number,
  initialBoxes:readonly AdaptiveBox[],
  descriptor:GeometryCriterionDescriptor,
  tolerances:readonly number[],
  options:AdaptiveOptions,
  collectWitnesses=true
):OptimizationResult{
  const directions=descriptorDirections(descriptor);
  let boxes=[...initialBoxes];let refinements=0;let visited=boxes.length;
  const maxDepth=options.maxDepth??32;
  if(descriptor.id==='CAP_FIRST_MOMENT_V1'){
    const length=Math.hypot(descriptor.direction.x,descriptor.direction.y);
    if(length>1e-12){
      const direction={x:descriptor.direction.x/length,y:descriptor.direction.y/length};
      const projection=(box:AdaptiveBox)=>Math.max(
        box.minX*direction.x+box.minY*direction.y,box.maxX*direction.x+box.minY*direction.y,
        box.minX*direction.x+box.maxY*direction.y,box.maxX*direction.x+box.maxY*direction.y
      );
      const maximum=Math.max(...boxes.map(projection));
      const point=direction.x===0?makeBox({minX:0,maxX:0,minY:direction.y*maximum,maxY:direction.y*maximum},0,'INSIDE')
        :makeBox({minX:direction.x*maximum,maxX:direction.x*maximum,minY:0,maxY:0},0,'INSIDE');
      const optimum=asComponents(evaluateCriterionOnBox(polygon,offsets,point,descriptor).score)[0]!;
      const restricted=axisAlignedCapRestriction(polygon,offsets,boxes,descriptor,optimum.lower+(tolerances[0]??0));
      if(restricted)return{descriptorId:descriptor.id,survivingBoxes:restricted,witnessPoints:Object.freeze(collectWitnesses?restricted.map(boxCentre):[]),optimum,status:'CERTIFIED',refinements:0};
    }
  }
  if(descriptor.id==='MAX_DIRECTIONAL_OVERHANG_V1'&&boxes.every(box=>box.status==='INSIDE')){
    const constants=cardinalOverhangConstants(polygon,offsets,descriptor);
    if(constants){
      const optimum=cardinalOverhangOptimum(polygon,offsets,boxes,descriptor,constants);
      const restricted=cardinalOverhangRestriction(boxes,constants,optimum.lower+(tolerances[0]??0));
      return{descriptorId:descriptor.id,survivingBoxes:restricted,witnessPoints:Object.freeze(collectWitnesses?restricted.map(boxCentre):[]),optimum,status:'CERTIFIED',refinements:0};
    }
  }
  if(descriptor.id==='ANCHOR_CENTROID_BALANCE_V1'&&boxes.every(box=>box.status==='INSIDE')){
    const data=axisAlignedBalanceTarget(offsets,descriptor);
    if(data){
      const optimum=axisAlignedBalanceOptimum(boxes,data.target,data.axis,tolerances[0]??0);
      const restricted=axisAlignedBalanceRestriction(optimum.firstRestricted,data.target,data.axis,optimum.score.components[0]!.lower+(tolerances[0]??0),optimum.score.components[1]!.lower+(tolerances[1]??0));
      return{descriptorId:descriptor.id,survivingBoxes:restricted.boxes,witnessPoints:Object.freeze(collectWitnesses?restricted.boxes.map(boxCentre):[]),optimum:optimum.score,status:restricted.certified?'CERTIFIED':'INDETERMINATE_WITHIN_TOLERANCE',refinements:0};
    }
  }
  for(;;){
    if(boxes.length===0)return{descriptorId:descriptor.id,survivingBoxes:[],witnessPoints:[],optimum:{lower:Infinity,upper:Infinity},status:'INDETERMINATE_WITHIN_TOLERANCE',refinements};
    const evaluations=boxes.map(box=>({box,evaluation:evaluateCriterionOnBox(polygon,offsets,box,descriptor)}));
    const anchor=computeGlobalAnchor(evaluations.map(item=>item.evaluation.score),directions,tolerances);
    const survivingEvaluations=evaluations.filter(item=>possiblyEquivalentToAnchor(item.evaluation.score,anchor,directions,tolerances));
    const survivors=survivingEvaluations.map(item=>item.box);
    const refinable=survivingEvaluations.filter(({box,evaluation})=>{
      const values=asComponents(evaluation.score),anchors=asComponents(anchor);
      const equivalent=directions.every((direction,index)=>certifiedEquivalentToAnchor(values[index]!,anchors[index]!,direction,tolerances[index]??0));
      return !equivalent&&Math.max(boundsWidth(box),boundsHeight(box))>options.toleranceMm&&box.depth<maxDepth;
    }).map(item=>item.box);
    // Stop if every surviving score is certified equivalent to the global anchor and spatial cells are at tolerance.
    const allEquivalent=survivingEvaluations.every(({evaluation})=>{
      const components=asComponents(evaluation.score),anchors=asComponents(anchor);
      return directions.every((direction,index)=>certifiedEquivalentToAnchor(components[index]!,anchors[index]!,direction,tolerances[index]??0));
    });
    if(refinable.length===0||allEquivalent){
      const witnesses:Point[]=[];
      if(collectWitnesses)for(const box of survivors){const p=boxCentre(box);if(exactLegal(polygon,offsets,p,radiusMm))witnesses.push(p);}
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
  options:AdaptiveOptions,
  collectWitnesses=true
):OptimizationResult{
  const directions=descriptorDirections(descriptor);let boxes=[...initialBoxes];let refinements=0;let visited=boxes.length;
  const maxDepth=options.maxDepth??32;
  if(descriptor.id==='CAP_FIRST_MOMENT_V1'&&!('components'in anchor)){
    const restricted=axisAlignedCapRestriction(polygon,offsets,boxes,descriptor,anchor.lower+(tolerances[0]??0));
    if(restricted)return{descriptorId:descriptor.id,survivingBoxes:restricted,witnessPoints:Object.freeze(collectWitnesses?restricted.map(boxCentre):[]),optimum:anchor,status:'CERTIFIED',refinements:0};
  }
  if(descriptor.id==='MAX_DIRECTIONAL_OVERHANG_V1'&&!('components'in anchor)&&boxes.every(box=>box.status==='INSIDE')){
    const constants=cardinalOverhangConstants(polygon,offsets,descriptor);
    if(constants){
      const restricted=cardinalOverhangRestriction(boxes,constants,anchor.lower+(tolerances[0]??0));
      return{descriptorId:descriptor.id,survivingBoxes:restricted,witnessPoints:Object.freeze(collectWitnesses?restricted.map(boxCentre):[]),optimum:anchor,status:'CERTIFIED',refinements:0};
    }
  }
  if(descriptor.id==='ANCHOR_CENTROID_BALANCE_V1'&&'components'in anchor&&boxes.every(box=>box.status==='INSIDE')){
    const data=axisAlignedBalanceTarget(offsets,descriptor);
    if(data){
      const first=anchor.components[0]!,second=anchor.components[1]!;
      const restricted=axisAlignedBalanceRestriction(boxes,data.target,data.axis,first.lower+(tolerances[0]??0),second.lower+(tolerances[1]??0));
      return{descriptorId:descriptor.id,survivingBoxes:restricted.boxes,witnessPoints:Object.freeze(collectWitnesses?restricted.boxes.map(boxCentre):[]),optimum:anchor,status:restricted.certified?'CERTIFIED':'INDETERMINATE_WITHIN_TOLERANCE',refinements:0};
    }
  }
  for(;;){
    const evaluations=boxes.map(box=>({box,evaluation:evaluateCriterionOnBox(polygon,offsets,box,descriptor)}));
    const survivingEvaluations=evaluations.filter(item=>possiblyEquivalentToAnchor(item.evaluation.score,anchor,directions,tolerances));
    const survivors=survivingEvaluations.map(item=>item.box);
    if(survivors.length===0)return{descriptorId:descriptor.id,survivingBoxes:[],witnessPoints:[],optimum:anchor,status:'CERTIFIED',refinements};
    const uncertain=survivingEvaluations.filter(({box,evaluation})=>{
      const values=asComponents(evaluation.score),anchors=asComponents(anchor);
      const equivalent=directions.every((direction,index)=>certifiedEquivalentToAnchor(values[index]!,anchors[index]!,direction,tolerances[index]??0));
      return !equivalent&&Math.max(boundsWidth(box),boundsHeight(box))>options.toleranceMm&&box.depth<maxDepth;
    }).map(item=>item.box);
    if(uncertain.length===0){
      const status=survivingEvaluations.every(({evaluation})=>{
        const values=asComponents(evaluation.score),anchors=asComponents(anchor);
        return directions.every((direction,index)=>certifiedEquivalentToAnchor(values[index]!,anchors[index]!,direction,tolerances[index]??0));
      })?'CERTIFIED':'INDETERMINATE_WITHIN_TOLERANCE';
      const witnesses=collectWitnesses?survivors.map(boxCentre).filter(point=>exactLegal(polygon,offsets,point,radiusMm)):[];
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
