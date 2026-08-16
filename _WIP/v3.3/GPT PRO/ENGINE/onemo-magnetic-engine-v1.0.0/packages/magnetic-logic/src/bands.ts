import type { AxisClass, BandDefinition, BandId, RegisteredProfile } from './contracts.js';

export function classifyAxis(sideMm:number,bands:readonly BandDefinition[]):AxisClass|null{
  for(const band of bands){
    const upperOk=band.maxInclusive?sideMm<=band.maxMm+1e-12:sideMm<band.maxMm-1e-12;
    if(sideMm>=band.minMm-1e-12&&upperOk)return band.class;
  }
  return null;
}

export function overallBand(classX:AxisClass,classY:AxisClass):BandId{
  return `B${Math.max(classX,classY)}` as BandId;
}

export function bandDefinition(profile:RegisteredProfile,id:BandId):BandDefinition{
  const band=profile.sizeDomain.bands.find(b=>b.id===id);if(!band)throw new Error(`missing band ${id}`);return band;
}
