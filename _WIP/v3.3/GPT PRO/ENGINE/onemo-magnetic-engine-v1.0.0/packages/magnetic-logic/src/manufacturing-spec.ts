import { canonicalHash } from '@onemo/geometry-compute';
import type { EngineManufacturingSpec, RegisteredProfile, SizeSolution, SolveResult } from './contracts.js';
import { buildCertifiedBandOffers } from './solver.js';

function assertCertifiedOfferAuthority(solve:SolveResult,solution:SizeSolution,profile:RegisteredProfile):void{
  if(solution.decisionProof!=='CERTIFIED_CONTINUOUS_OPTIMUM')throw new Error('MECHANICAL_OPTIMUM_NOT_CERTIFIED');
  const reconstructed=buildCertifiedBandOffers(solve.evaluated,profile).find(offer=>offer.band===solution.band);
  const declared=solve.offers.find(offer=>offer.band===solution.band);
  if(reconstructed?.status!=='OFFERED'||!reconstructed.solution||declared?.status!=='OFFERED'||!declared.solution)throw new Error('CERTIFIED_OFFER_EVIDENCE_MISSING');
  if(reconstructed.solution.decisionProof!=='CERTIFIED_CONTINUOUS_OPTIMUM')throw new Error('MECHANICAL_OPTIMUM_NOT_CERTIFIED');
  const selectedHash=canonicalHash(solution);
  if(canonicalHash(reconstructed.solution)!==selectedHash||canonicalHash(declared.solution)!==selectedHash)throw new Error('CERTIFIED_OFFER_SOLUTION_MISMATCH');
}

export function createEngineManufacturingSpec(
  solve:SolveResult,
  solution:SizeSolution,
  profile:RegisteredProfile
):EngineManufacturingSpec{
  if(solve.profileHash!==profile.profileHash)throw new Error('PROFILE_HASH_MISMATCH');
  if(solve.computeArtifactHash.length===0||solve.logicArtifactHash.length===0)throw new Error('ENGINE_ARTIFACT_UNRESOLVABLE');
  assertCertifiedOfferAuthority(solve,solution,profile);
  const payload=Object.freeze({
    schema:'onemo-engine-manufacturing-spec-v1' as const,schemaVersion:1 as const,
    computeArtifactHash:solve.computeArtifactHash,logicArtifactHash:solve.logicArtifactHash,
    profileId:profile.id,profileHash:profile.profileHash,sourceGeometryHash:solve.sourceGeometryHash,
    finalGeometryHash:solution.geometryHash,finalRingInt:solution.finalRingInt,widthMm:solution.widthMm,heightMm:solution.heightMm,scale:solution.scale,
    coordinateQuantumMm:profile.numeric.coordinateQuantumMm,band:solution.band,populationId:solution.frame.populationId,
    populationStrideCells:solution.frame.populationStrideCells,populationOriginParity:solution.frame.populationOriginParity,frameId:solution.frame.id,
    patternId:solution.patternId,registration:solution.registration,selectedCellAddresses:solution.centres.map(c=>c.cell),centres:solution.centres,
    baseProtectedRadiusMm:profile.safety.baseProtectedRadiusMm,effectiveVerificationRadiusMm:profile.safety.effectiveVerificationRadiusMm,
    toleranceCompositionRuleId:profile.safety.tolerancePolicy.id,approximationToleranceMm:profile.numeric.approximationToleranceMm,
    minimumMarginMm:solution.minimumMarginMm,decisionTrace:solution.scoreTrace,decisionProof:solution.decisionProof,
    proofStatus:profile.productionReady
      ? 'CERTIFIED_CONTINUOUS_OPTIMUM_EXACT_AT_QUANTUM' as const
      : 'REFERENCE_PROFILE_NOT_PRODUCTION' as const
  });
  return Object.freeze({...payload,canonicalHash:canonicalHash(payload)});
}

export function selectedOffer(solve:SolveResult,band:string):SizeSolution{
  const offer=solve.offers.find(o=>o.band===band);if(!offer?.solution||offer.status!=='OFFERED')throw new Error(`no offered solution for ${band}`);return offer.solution;
}
