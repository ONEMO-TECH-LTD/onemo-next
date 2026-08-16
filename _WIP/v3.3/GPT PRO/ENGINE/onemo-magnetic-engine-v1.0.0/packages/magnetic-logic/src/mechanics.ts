import type { GeometryCriterionDescriptor, Point, RegionEvidence } from '@onemo/geometry-compute';
import type { CandidateHypothesis, MechanicsCriterionPolicy, RegisteredProfile } from './contracts.js';

function lateral(top:Point):Point{return{x:top.y,y:-top.x};}

export function criterionDescriptor(
  policy:MechanicsCriterionPolicy,
  candidate:CandidateHypothesis,
  profile:RegisteredProfile,
  regions:readonly RegionEvidence[]
):GeometryCriterionDescriptor{
  const top=profile.mechanics.topDirection;const upperMax=Math.max(...regions.map(r=>r.bounds.maxY),-Infinity);
  const upperIds=regions.filter(r=>Math.abs(r.bounds.maxY-upperMax)<=profile.structural.sampleStepMm/2).map(r=>r.id);
  switch(policy.id){
    case 'M01_MAJOR_COVERAGE':return{id:'REGION_COVERAGE_V1',regions};
    case 'M02_UPPER_REGION':return{id:'REGION_SUBSET_COVERAGE_V1',regions,subsetIds:upperIds};
    case 'M03_UPPER_MOMENT':return{id:'CAP_FIRST_MOMENT_V1',direction:top};
    case 'M04_MAX_OVERHANG':{const x=lateral(top);return{id:'MAX_DIRECTIONAL_OVERHANG_V1',directions:[top,{x:-top.x,y:-top.y},x,{x:-x.x,y:-x.y}]};}
    case 'M05_PATTERN_RANK':return{id:'DISCRETE_SCALAR_V1',value:candidate.permission.patternRank,comparator:'MIN'};
    case 'M06_REGION_LOAD':return{id:'REGION_MAX_LOAD_V1',regions};
    case 'M07_BALANCE':return{id:'ANCHOR_CENTROID_BALANCE_V1',materialCentroid:candidate.polygon.metrics.centroid,lateralDirection:lateral(top)};
    case 'M08_ANCHOR_COUNT':return{id:'POINT_COUNT_V1',count:candidate.offsetsMm.length};
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
  return[candidate.frame.populationId,candidate.frame.populationOriginParity?.[0]??-1,candidate.frame.populationOriginParity?.[1]??-1,candidate.frame.id,candidate.pattern.id];
}
