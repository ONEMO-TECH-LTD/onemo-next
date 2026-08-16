import type { RegisteredProfile } from './contracts.js';

export function candidateSizes(profile:RegisteredProfile):number[]{
  const result:number[]=[];const {minMm,maxMm,stepMm}=profile.sizeDomain;
  for(let value=minMm;value<=maxMm+1e-9;value+=stepMm)result.push(Number(value.toFixed(9)));
  return result;
}
