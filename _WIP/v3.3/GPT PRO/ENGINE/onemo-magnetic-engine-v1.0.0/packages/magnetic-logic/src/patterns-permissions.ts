import type { AxisClass, BandId, PatternDefinition, PatternPermission, RegisteredProfile } from './contracts.js';
import { canonicalCodeUnitCompare } from './selection.js';

export function permittedPatterns(profile:RegisteredProfile,band:BandId,classX:AxisClass,classY:AxisClass):{pattern:PatternDefinition;permission:PatternPermission}[]{
  const byId=new Map(profile.patterns.map(p=>[p.id,p]));const result=new Map<string,{pattern:PatternDefinition;permission:PatternPermission}>();
  for(const permission of profile.permissions){
    if(!permission.bands.includes(band)||!permission.allowedAxisClassPairs.some(([x,y])=>x===classX&&y===classY))continue;
    const pattern=byId.get(permission.patternId);if(!pattern)continue;
    const variants=permission.alternativeOrientationsConsidered&&pattern.symmetryFamily
      ?profile.patterns.filter(candidate=>candidate.symmetryFamily===pattern.symmetryFamily)
      :[pattern];
    for(const variant of variants){
      if(!permission.allowedPopulationIds.includes(variant.populationId))continue;
      const population=profile.grid.populations.find(p=>p.id===variant.populationId);
      if(population?.enabled&&!result.has(variant.id))result.set(variant.id,{pattern:variant,permission});
    }
  }
  return[...result.values()].sort((a,b)=>a.permission.patternRank-b.permission.patternRank||canonicalCodeUnitCompare(a.pattern.id,b.pattern.id));
}
