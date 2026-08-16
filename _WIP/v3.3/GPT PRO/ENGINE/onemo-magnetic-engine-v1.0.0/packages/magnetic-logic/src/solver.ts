import { COMPUTE_ARTIFACT_HASH, canonicalHash, preparePolygon } from '@onemo/geometry-compute';
import type { BandOffer, RegisteredProfile, SizeFailure, SizeSolution, SolveInput, SolveResult } from './contracts.js';
import { LOGIC_ARTIFACT_HASH } from './artifact.js';
import { certifySizeSolution } from './certified-solver.js';
import { registerProfile } from './profile-registry.js';
import { candidateSizes } from './size-domain.js';

function solveSizeSequence(input:SolveInput,profile:RegisteredProfile):(SizeSolution|SizeFailure)[]{
  return candidateSizes(profile).map(targetDominantMm=>certifySizeSolution({
    outlineMm:input.outlineMm,
    profile,
    targetDominantMm
  }));
}

/** Applies SMALLEST_ACCEPTED_PER_BAND only after every supplied rung has an
 * independent certified result. An unresolved smaller rung blocks the offer. */
export function buildCertifiedBandOffers(evaluated:readonly (SizeSolution|SizeFailure)[],profile:RegisteredProfile):BandOffer[]{
  const allRungs=candidateSizes(profile);
  return profile.sizeDomain.bands.map(band=>{
    const inBand=evaluated.filter(item=>item.band===band.id).sort((a,b)=>a.targetDominantMm-b.targetDominantMm);
    const requiredRungs=allRungs.filter(size=>size>=band.minMm-1e-12&&(band.maxInclusive?size<=band.maxMm+1e-12:size<band.maxMm-1e-12));
    if(requiredRungs.some(size=>!inBand.some(item=>item.targetDominantMm===size)))return{band:band.id,status:'DECISION_INDETERMINATE',reasons:['DECISION_INDETERMINATE']};
    const accepted=inBand.find((item):item is SizeSolution=>item.status==='ACCEPTED');
    const unresolvedSmaller=inBand.some(item=>item.status==='DECISION_INDETERMINATE'&&(!accepted||item.targetDominantMm<accepted.targetDominantMm));
    if(unresolvedSmaller)return{band:band.id,status:'DECISION_INDETERMINATE',reasons:['DECISION_INDETERMINATE']};
    if(accepted)return{band:band.id,status:'OFFERED',solution:accepted,reasons:[]};
    if(inBand.some(item=>item.status==='DECISION_INDETERMINATE'))return{band:band.id,status:'DECISION_INDETERMINATE',reasons:['DECISION_INDETERMINATE']};
    return{band:band.id,status:'NO_SOLUTION',reasons:[...new Set(inBand.flatMap(item=>item.status==='ACCEPTED'?[]:item.reasons))]};
  });
}

export async function solveOutline(input:SolveInput):Promise<SolveResult>{
  const profile=registerProfile(input.profile);
  if(profile.approvalState!=='approved')throw new Error('PROFILE_UNAPPROVED');
  const source=preparePolygon(input.outlineMm,{quantumMm:profile.numeric.coordinateQuantumMm,maxVertices:profile.numeric.maxVertices});
  const evaluated=solveSizeSequence(input,profile);
  const offers=buildCertifiedBandOffers(evaluated,profile);
  const payload={
    schema:'onemo-magnetic-solve-v1' as const,
    profileId:profile.id,
    profileHash:profile.profileHash,
    computeArtifactHash:COMPUTE_ARTIFACT_HASH,
    logicArtifactHash:LOGIC_ARTIFACT_HASH,
    sourceGeometryHash:source.geometryHash,
    sourceRingInt:Object.freeze(source.ringInt.map(point=>Object.freeze([point.x,point.y] as const))),
    evaluated,
    offers
  };
  return Object.freeze({...payload,canonicalHash:canonicalHash(payload)});
}
