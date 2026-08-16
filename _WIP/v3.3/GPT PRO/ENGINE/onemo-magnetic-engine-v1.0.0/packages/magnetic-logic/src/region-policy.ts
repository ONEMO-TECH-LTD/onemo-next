import {
  buildComponentHierarchy, componentToRegionEvidence, type PreparedPolygon, type RegionEvidence, type SafeComponent
} from '@onemo/geometry-compute';
import type { RegionClassification, RegisteredProfile, StructuralEvidence } from './contracts.js';

function persistenceLevels(component:SafeComponent,byId:Map<string,SafeComponent>):number{
  let best=1;const stack=component.childIds.map(id=>({id,depth:2}));
  while(stack.length){const item=stack.pop()!;best=Math.max(best,item.depth);const child=byId.get(item.id);if(child)for(const id of child.childIds)stack.push({id,depth:item.depth+1});}
  return best;
}

export function buildStructuralEvidence(polygon:PreparedPolygon,profile:RegisteredProfile):StructuralEvidence{
  const levels=profile.structural.clearanceSurplusLevelsMm.map(x=>profile.safety.effectiveVerificationRadiusMm+x);
  const hierarchy=buildComponentHierarchy(polygon,levels,profile.structural.sampleStepMm);
  const base=hierarchy.components.filter(c=>c.levelIndex===0);const byId=new Map(hierarchy.components.map(c=>[c.id,c]));
  const discArea=Math.PI*profile.safety.effectiveVerificationRadiusMm**2;
  let largest:string|undefined;let largestArea=-Infinity;for(const c of base)if(c.areaEstimateMm2>largestArea){largestArea=c.areaEstimateMm2;largest=c.id;}
  const classifications:RegionClassification[]=base.map(component=>{
    const persistence=persistenceLevels(component,byId);const areaDiscRatio=component.areaEstimateMm2/discArea;const areaShapeFraction=component.areaEstimateMm2/polygon.metrics.area;
    let cls:RegionClassification['class'];
    if(component.nearToleranceBoundary)cls='UNCLASSIFIED_NEAR_TOLERANCE';
    else if((areaDiscRatio>=profile.structural.majorMinAreaDiscRatio||areaShapeFraction>=profile.structural.majorMinAreaShapeFraction)&&persistence>=profile.structural.majorMinPersistenceLevels)cls='MAJOR';
    else cls='MARGINAL';
    if(profile.structural.forceLargestComponentMajor&&component.id===largest&&cls!=='UNCLASSIFIED_NEAR_TOLERANCE')cls='MAJOR';
    return{component,class:cls,persistenceLevels:persistence,areaDiscRatio,areaShapeFraction};
  });
  return{hierarchy,classifications:Object.freeze(classifications)};
}

export function majorRegionEvidence(evidence:StructuralEvidence):RegionEvidence[]{
  return evidence.classifications.filter(c=>c.class==='MAJOR').map(c=>componentToRegionEvidence(evidence.hierarchy,c.component));
}
