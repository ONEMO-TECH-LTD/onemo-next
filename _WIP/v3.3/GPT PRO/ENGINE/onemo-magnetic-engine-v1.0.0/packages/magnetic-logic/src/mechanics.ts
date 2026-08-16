import type { GeometryCriterionDescriptor, Point, RegionEvidence } from '@onemo/geometry-compute';
import type { CandidateHypothesis, MechanicsCriterionPolicy, RegisteredProfile } from './contracts.js';

function lateral(top:Point):Point{return{x:top.y,y:-top.x};}
function projectedMaximum(bounds:RegionEvidence['bounds'],direction:Point):number{
  return Math.max(
    direction.x*bounds.minX+direction.y*bounds.minY,
    direction.x*bounds.minX+direction.y*bounds.maxY,
    direction.x*bounds.maxX+direction.y*bounds.minY,
    direction.x*bounds.maxX+direction.y*bounds.maxY
  );
}

export function criterionDescriptor(
  policy:MechanicsCriterionPolicy,
  candidate:CandidateHypothesis,
  profile:RegisteredProfile,
  regions:readonly RegionEvidence[]
):GeometryCriterionDescriptor{
  const top=profile.mechanics.topDirection;const supports=regions.map(region=>({id:region.id,value:projectedMaximum(region.bounds,top)}));
  const upperMax=Math.max(...supports.map(support=>support.value),-Infinity);
  const upperIds=supports.filter(support=>Math.abs(support.value-upperMax)<=1e-12).map(support=>support.id);
  switch(policy.id){
    case 'M01_MAJOR_COVERAGE':return{id:'REGION_COVERAGE_V1',regions};
    case 'M02_UPPER_REGION':return{id:'REGION_SUBSET_COVERAGE_V1',regions,subsetIds:upperIds};
    case 'M03_UPPER_MOMENT':return{id:'CAP_FIRST_MOMENT_V1',direction:top};
    case 'M04_MAX_OVERHANG':{const x=lateral(top);return{id:'MAX_DIRECTIONAL_OVERHANG_V1',directions:[top,{x:-top.x,y:-top.y},x,{x:-x.x,y:-x.y}]};}
    case 'M05_PATTERN_RANK':return{id:'DISCRETE_SCALAR_V1',value:candidate.permission.patternRank,comparator:'MIN'};
    case 'M06_REGION_LOAD':return{id:'REGION_MAX_LOAD_V1',regions};
    case 'M07_BALANCE':return{id:'ANCHOR_CENTROID_BALANCE_V1',materialCentroid:candidate.polygon.metrics.centroid,lateralDirection:lateral(top)};
    case 'M08_ANCHOR_COUNT':return{id:'POINT_COUNT_V1',count:candidate.offsetsMm.length};
    case 'M09_DISCRETE_ID':return{id:'DISCRETE_KEY_V1',key:candidateDiscreteKey(candidate)};
    case 'M10_REGISTRATION_ID':return{id:'FINAL_REGISTRATION_ORDER_V1',canonicalTarget:{x:0,y:0}};
    default:throw new Error(`unsupported mechanics criterion ${policy.id}`);
  }
}

export function criterionTolerances(policy:MechanicsCriterionPolicy,candidate:CandidateHypothesis,profile:RegisteredProfile):number[]{
  const q=profile.numeric.coordinateQuantumMm;
  switch(policy.toleranceRule){
    case 'Q_TIMES_AREA':return[q*candidate.polygon.metrics.area];
    case 'Q':return[q];
    case 'Q_AND_CENTROID_SQUARED':{
      const d=candidate.polygon.metrics.dominantDimension;return[q,2*d*q+q*q];
    }
    default:return[...policy.tolerances];
  }
}

export function candidateDiscreteKey(candidate:CandidateHypothesis):readonly (string|number)[]{
  const parity=candidate.frame.populationOriginParity;
  return Object.freeze([
    candidate.frame.populationId,
    parity[0],parity[1],
    candidate.frame.id,
    candidate.pattern.id,
    candidate.pattern.variantId
  ]);
}
