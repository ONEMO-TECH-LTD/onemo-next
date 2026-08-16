import type { AdaptiveBox, CompoundScoreInterval, CriterionEvaluation, GeometryCriterionDescriptor, Point, PreparedPolygon, RegionEvidence, ScoreInterval } from './contracts.js';
import { capMoment } from './halfplane.js';
import { dot, normalizeDirection } from './numeric.js';
import { projectRing } from './measure.js';

function interval(lower:number,upper:number):ScoreInterval{return{lower:Math.min(lower,upper),upper:Math.max(lower,upper)};}
function compound(...components:ScoreInterval[]):CompoundScoreInterval{return{components};}

function translatedProjectionInterval(box:AdaptiveBox,direction:Point):ScoreInterval{
  const values=[
    box.minX*direction.x+box.minY*direction.y,
    box.maxX*direction.x+box.minY*direction.y,
    box.minX*direction.x+box.maxY*direction.y,
    box.maxX*direction.x+box.maxY*direction.y
  ];
  return interval(Math.min(...values),Math.max(...values));
}

function offsetProjectionMax(offsets:readonly Point[],direction:Point):number{
  let max=-Infinity;for(const o of offsets)max=Math.max(max,dot(o,direction));return offsets.length?max:0;
}

function offsetCentroid(offsets:readonly Point[]):Point{
  if(offsets.length===0)return{x:0,y:0};
  let x=0,y=0;for(const o of offsets){x+=o.x;y+=o.y;}return{x:x/offsets.length,y:y/offsets.length};
}

function overlappedCellRange(region:RegionEvidence,box:{minX:number;minY:number;maxX:number;maxY:number}):{minI:number;maxI:number;minJ:number;maxJ:number}{
  const s=region.cellStepMm,o=region.gridOrigin;
  const pointX=Math.abs(box.maxX-box.minX)<=1e-12;
  const pointY=Math.abs(box.maxY-box.minY)<=1e-12;
  return{
    minI:Math.floor((box.minX-o.x)/s),maxI:Math.floor(((pointX?box.maxX:box.maxX-1e-12)-o.x)/s),
    minJ:Math.floor((box.minY-o.y)/s),maxJ:Math.floor(((pointY?box.maxY:box.maxY-1e-12)-o.y)/s)
  };
}

function anchorRegionState(box:AdaptiveBox,offset:Point,region:RegionEvidence):'ALL'|'SOME'|'NONE'{
  const translated={minX:box.minX+offset.x,minY:box.minY+offset.y,maxX:box.maxX+offset.x,maxY:box.maxY+offset.y};
  const pad=region.cellStepMm*Math.SQRT2/2;
  if(translated.maxX<region.bounds.minX-pad||translated.minX>region.bounds.maxX+pad||translated.maxY<region.bounds.minY-pad||translated.minY>region.bounds.maxY+pad)return'NONE';
  if(Math.abs(translated.maxX-translated.minX)<=1e-12&&Math.abs(translated.maxY-translated.minY)<=1e-12){
    const s=region.cellStepMm,o=region.gridOrigin;const x=(translated.minX-o.x)/s,y=(translated.minY-o.y)/s;
    const candidates=[Math.floor(x),Math.ceil(x)-1,Math.round(x-0.5)];const rows=[Math.floor(y),Math.ceil(y)-1,Math.round(y-0.5)];
    for(const j of rows)for(const i of candidates)if(region.occupiedCellKeys.has(`${i},${j}`))return'ALL';
    return'NONE';
  }
  const range=overlappedCellRange(region,translated);let any=false,all=true;
  for(let j=range.minJ;j<=range.maxJ;j++)for(let i=range.minI;i<=range.maxI;i++){
    const occupied=region.occupiedCellKeys.has(`${i},${j}`);any ||= occupied;all &&= occupied;
  }
  return all&&any?'ALL':any?'SOME':'NONE';
}

function coverageIntervals(box:AdaptiveBox,offsets:readonly Point[],regions:readonly RegionEvidence[],subset?:ReadonlySet<string>):{coverage:ScoreInterval;outside:ScoreInterval;loads:{lower:number;upper:number}[]}{
  const selected=regions.filter(r=>!subset||subset.has(r.id));
  const states=offsets.map(offset=>selected.map(region=>anchorRegionState(box,offset,region)));
  let coverageLower=0,coverageUpper=0; const loads:{lower:number;upper:number}[]=[];
  for(let r=0;r<selected.length;r++){
    let definite=0,possible=0;
    for(let a=0;a<offsets.length;a++){
      const state=states[a]?.[r]??'NONE';if(state==='ALL'){definite++;possible++;}else if(state==='SOME')possible++;
    }
    if(definite>0)coverageLower++;if(possible>0)coverageUpper++;
    loads.push({lower:definite,upper:possible});
  }
  let outsideLower=0,outsideUpper=0;
  for(let a=0;a<offsets.length;a++){
    const row=states[a]??[];
    if(row.every(s=>s==='NONE')){outsideLower++;outsideUpper++;}
    else if(!row.some(s=>s==='ALL'))outsideUpper++;
  }
  return{coverage:interval(coverageLower,coverageUpper),outside:interval(outsideLower,outsideUpper),loads};
}

export function evaluateCriterionOnBox(
  polygon:PreparedPolygon,
  offsets:readonly Point[],
  box:AdaptiveBox,
  descriptor:GeometryCriterionDescriptor
):CriterionEvaluation{
  switch(descriptor.id){
    case 'REGION_COVERAGE_V1':{
      const c=coverageIntervals(box,offsets,descriptor.regions);
      return{descriptorId:descriptor.id,score:compound(c.coverage,c.outside),exactness:c.coverage.lower===c.coverage.upper&&c.outside.lower===c.outside.upper?'EXACT':'CERTIFIED_APPROXIMATE',unit:'regions,points'};
    }
    case 'REGION_SUBSET_COVERAGE_V1':{
      const c=coverageIntervals(box,offsets,descriptor.regions,new Set(descriptor.subsetIds));
      return{descriptorId:descriptor.id,score:c.coverage,exactness:c.coverage.lower===c.coverage.upper?'EXACT':'CERTIFIED_APPROXIMATE',unit:'regions'};
    }
    case 'CAP_FIRST_MOMENT_V1':{
      const u=normalizeDirection(descriptor.direction);const t=translatedProjectionInterval(box,u);const offsetMax=offsetProjectionMax(offsets,u);
      const high=capMoment(polygon.ringMm,u,t.upper+offsetMax,true).firstMomentMm3;
      const low=capMoment(polygon.ringMm,u,t.lower+offsetMax,true).firstMomentMm3;
      return{descriptorId:descriptor.id,score:interval(high,low),exactness:Math.abs(high-low)<1e-12?'EXACT':'CERTIFIED_APPROXIMATE',unit:'mm^3'};
    }
    case 'MAX_DIRECTIONAL_OVERHANG_V1':{
      let lower=0,upper=0;
      for(const raw of descriptor.directions){
        const u=normalizeDirection(raw);const p=projectRing(polygon.ringMm,u);const t=translatedProjectionInterval(box,u);const offsetMax=offsetProjectionMax(offsets,u);
        lower=Math.max(lower,Math.max(0,p.max-(t.upper+offsetMax)));
        upper=Math.max(upper,Math.max(0,p.max-(t.lower+offsetMax)));
      }
      return{descriptorId:descriptor.id,score:interval(lower,upper),exactness:Math.abs(lower-upper)<1e-12?'EXACT':'CERTIFIED_APPROXIMATE',unit:'mm'};
    }
    case 'DISCRETE_SCALAR_V1': return{descriptorId:descriptor.id,score:interval(descriptor.value,descriptor.value),exactness:'EXACT',unit:'scalar'};
    case 'REGION_MAX_LOAD_V1':{
      const c=coverageIntervals(box,offsets,descriptor.regions);const lower=Math.max(c.outside.lower,...c.loads.map(l=>l.lower),0);const upper=Math.max(c.outside.upper,...c.loads.map(l=>l.upper),0);
      return{descriptorId:descriptor.id,score:interval(lower,upper),exactness:lower===upper?'EXACT':'CERTIFIED_APPROXIMATE',unit:'points'};
    }
    case 'ANCHOR_CENTROID_BALANCE_V1':{
      const lateral=normalizeDirection(descriptor.lateralDirection);const oc=offsetCentroid(offsets);const target={x:descriptor.materialCentroid.x-oc.x,y:descriptor.materialCentroid.y-oc.y};
      const proj=translatedProjectionInterval(box,lateral);const targetProj=dot(target,lateral);const a=proj.lower-targetProj,b=proj.upper-targetProj;
      const lateralLower=a<=0&&b>=0?0:Math.min(Math.abs(a),Math.abs(b));const lateralUpper=Math.max(Math.abs(a),Math.abs(b));
      const cx=Math.max(box.minX,Math.min(box.maxX,target.x)),cy=Math.max(box.minY,Math.min(box.maxY,target.y));
      const sqLower=(cx-target.x)**2+(cy-target.y)**2;
      const sqUpper=Math.max(...[
        (box.minX-target.x)**2+(box.minY-target.y)**2,(box.maxX-target.x)**2+(box.minY-target.y)**2,
        (box.minX-target.x)**2+(box.maxY-target.y)**2,(box.maxX-target.x)**2+(box.maxY-target.y)**2
      ]);
      return{descriptorId:descriptor.id,score:compound(interval(lateralLower,lateralUpper),interval(sqLower,sqUpper)),exactness:lateralLower===lateralUpper&&sqLower===sqUpper?'EXACT':'CERTIFIED_APPROXIMATE',unit:'mm,mm^2'};
    }
    case 'POINT_COUNT_V1':return{descriptorId:descriptor.id,score:interval(descriptor.count,descriptor.count),exactness:'EXACT',unit:'points'};
    case 'DISCRETE_KEY_V1':{
      // Numeric interval is only a placeholder; canonical key comparison is performed by Logic.
      return{descriptorId:descriptor.id,score:interval(0,0),exactness:'EXACT',unit:'canonical-key'};
    }
    case 'FINAL_REGISTRATION_ORDER_V1':{
      const target=descriptor.canonicalTarget;
      const cx=Math.max(box.minX,Math.min(box.maxX,target.x)),cy=Math.max(box.minY,Math.min(box.maxY,target.y));
      const lower=(cx-target.x)**2+(cy-target.y)**2;
      const upper=Math.max(...[
        (box.minX-target.x)**2+(box.minY-target.y)**2,(box.maxX-target.x)**2+(box.minY-target.y)**2,
        (box.minX-target.x)**2+(box.maxY-target.y)**2,(box.maxX-target.x)**2+(box.maxY-target.y)**2
      ]);
      return{descriptorId:descriptor.id,score:compound(interval(lower,upper),interval(box.minX,box.maxX),interval(box.minY,box.maxY)),exactness:box.minX===box.maxX&&box.minY===box.maxY?'EXACT':'CERTIFIED_APPROXIMATE',unit:'mm^2,mm,mm'};
    }
    default:{const neverDescriptor:never=descriptor;throw new TypeError(`unsupported descriptor ${(neverDescriptor as {id?:string}).id??'unknown'}`);}
  }
}
