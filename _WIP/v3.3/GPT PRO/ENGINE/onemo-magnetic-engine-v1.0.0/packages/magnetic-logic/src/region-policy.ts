import {
  buildComponentHierarchy, componentToRegionEvidence, type PreparedPolygon, type RegionEvidence
} from '@onemo/geometry-compute';
import type { RegionClassification, RegisteredProfile, StructuralEvidence } from './contracts.js';

export function buildStructuralEvidence(polygon:PreparedPolygon,profile:RegisteredProfile):StructuralEvidence{
  const levels=profile.structural.clearanceSurplusLevelsMm.map(x=>profile.safety.effectiveVerificationRadiusMm+x);
  const hierarchy=buildComponentHierarchy(polygon,levels,profile.structural.sampleStepMm);
  const base=hierarchy.components.filter(c=>c.levelIndex===0);
  const discArea=Math.PI*profile.safety.effectiveVerificationRadiusMm**2;
  const certifiedLargestId=base.filter(component=>component.topologyCertified&&base.every(other=>other.id===component.id||component.areaBoundsMm2.lower>=other.areaBoundsMm2.upper)).map(component=>component.id).sort()[0];
  const classifications:RegionClassification[]=base.map(component=>{
    const persistence=component.persistenceLevelInterval;
    const areaDiscRatio={lower:component.areaBoundsMm2.lower/discArea,upper:component.areaBoundsMm2.upper/discArea};
    const areaShapeFraction={lower:component.areaBoundsMm2.lower/polygon.metrics.area,upper:component.areaBoundsMm2.upper/polygon.metrics.area};
    const definitelyMajor=(areaDiscRatio.lower>=profile.structural.majorMinAreaDiscRatio||areaShapeFraction.lower>=profile.structural.majorMinAreaShapeFraction)&&persistence.lower>=profile.structural.majorMinPersistenceLevels;
    const definitelyMarginal=(areaDiscRatio.upper<profile.structural.majorMinAreaDiscRatio&&areaShapeFraction.upper<profile.structural.majorMinAreaShapeFraction)||persistence.upper<profile.structural.majorMinPersistenceLevels;
    let cls:RegionClassification['class'];
    if(!component.topologyCertified)cls='UNCLASSIFIED_NEAR_TOLERANCE';
    else if(profile.structural.forceLargestComponentMajor&&component.id===certifiedLargestId)cls='MAJOR';
    else if(definitelyMajor)cls='MAJOR';
    else if(definitelyMarginal)cls='MARGINAL';
    else cls='UNCLASSIFIED_NEAR_TOLERANCE';
    return{component,class:cls,persistenceLevels:persistence,areaDiscRatio,areaShapeFraction};
  });
  const reasons:string[]=[];
  if(classifications.some(c=>c.class==='UNCLASSIFIED_NEAR_TOLERANCE'))reasons.push('COMPONENT_TOPOLOGY_UNCERTAIN','REGION_CLASSIFICATION_UNCERTAIN');
  return{hierarchy,classifications:Object.freeze(classifications),status:reasons.length?'INDETERMINATE':'CERTIFIED',reasons:Object.freeze(reasons)};
}

export function majorRegionEvidence(evidence:StructuralEvidence):RegionEvidence[]{
  return evidence.classifications.filter(c=>c.class==='MAJOR').map(c=>componentToRegionEvidence(evidence.hierarchy,c.component));
}
