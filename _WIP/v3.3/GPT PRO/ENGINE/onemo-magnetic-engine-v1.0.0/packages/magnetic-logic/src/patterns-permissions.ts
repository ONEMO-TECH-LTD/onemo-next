import type { AxisClass, BandId, PatternDefinition, PatternPermission, RegisteredProfile } from './contracts.js';

export function permittedPatterns(profile:RegisteredProfile,band:BandId,classX:AxisClass,classY:AxisClass):{pattern:PatternDefinition;permission:PatternPermission}[]{
  const byId=new Map(profile.patterns.map(p=>[p.id,p]));const result:{pattern:PatternDefinition;permission:PatternPermission}[]=[];
  for(const permission of profile.permissions){
    if(!permission.bands.includes(band)||classX<permission.minClassX||classY<permission.minClassY)continue;
    const pattern=byId.get(permission.patternId);if(!pattern)continue;
    const population=profile.grid.populations.find(p=>p.id===pattern.populationId);
    if(!population?.enabled)continue;
    result.push({pattern,permission});
  }
  return result.sort((a,b)=>a.permission.patternRank-b.permission.patternRank||a.pattern.id.localeCompare(b.pattern.id));
}
