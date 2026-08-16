import { canonicalHash, dequantizePoint, preparePolygon, quantizePoint } from '@onemo/geometry-compute';
import type { EngineManufacturingSpec, Point, ProductProfile, RegisteredProfile, SizeSolution, SolveResult } from './contracts.js';
import { registerProfile } from './profile-registry.js';
import { buildCertifiedBandOffers } from './solver.js';

type EngineManufacturingPayload=Omit<EngineManufacturingSpec,'canonicalHash'>;
type SourceIdentity=Pick<SolveResult,'computeArtifactHash'|'logicArtifactHash'|'sourceGeometryHash'|'sourceRingInt'>;

function assertCertifiedOfferAuthority(solve:SolveResult,solution:SizeSolution,profile:RegisteredProfile):void{
  if(solution.decisionProof!=='CERTIFIED_CONTINUOUS_OPTIMUM')throw new Error('MECHANICAL_OPTIMUM_NOT_CERTIFIED');
  const reconstructed=buildCertifiedBandOffers(solve.evaluated,profile).find(offer=>offer.band===solution.band);
  const declared=solve.offers.find(offer=>offer.band===solution.band);
  if(reconstructed?.status!=='OFFERED'||!reconstructed.solution||declared?.status!=='OFFERED'||!declared.solution)throw new Error('CERTIFIED_OFFER_EVIDENCE_MISSING');
  if(reconstructed.solution.decisionProof!=='CERTIFIED_CONTINUOUS_OPTIMUM')throw new Error('MECHANICAL_OPTIMUM_NOT_CERTIFIED');
  const selectedHash=canonicalHash(solution);
  if(canonicalHash(reconstructed.solution)!==selectedHash||canonicalHash(declared.solution)!==selectedHash)throw new Error('CERTIFIED_OFFER_SOLUTION_MISMATCH');
}

export function sourceGeometryIdentity(outlineMm:readonly Point[],profileInput:ProductProfile|RegisteredProfile):Pick<SolveResult,'sourceGeometryHash'|'sourceRingInt'>{
  const profile=registerProfile(profileInput);
  const source=preparePolygon(outlineMm,{quantumMm:profile.numeric.coordinateQuantumMm,maxVertices:profile.numeric.maxVertices});
  return Object.freeze({
    sourceGeometryHash:source.geometryHash,
    sourceRingInt:Object.freeze(source.ringInt.map(point=>Object.freeze([point.x,point.y] as const)))
  });
}

export function buildEngineManufacturingPayload(
  source:SourceIdentity,
  solution:SizeSolution,
  profile:RegisteredProfile
):EngineManufacturingPayload{
  const sourceRingMm=source.sourceRingInt.map(([x,y])=>dequantizePoint({x,y},profile.numeric.coordinateQuantumMm));
  const sourcePolygon=preparePolygon(sourceRingMm,{quantumMm:profile.numeric.coordinateQuantumMm,maxVertices:profile.numeric.maxVertices});
  const canonicalSourceRing=sourcePolygon.ringInt.map(point=>[point.x,point.y]);
  if(sourcePolygon.geometryHash!==source.sourceGeometryHash||canonicalHash(canonicalSourceRing)!==canonicalHash(source.sourceRingInt))throw new Error('SOURCE_GEOMETRY_MISMATCH');
  const pattern=profile.patterns.find(candidate=>candidate.id===solution.patternId&&candidate.populationId===solution.frame.populationId&&candidate.frameId===solution.frame.id);
  if(!pattern)throw new Error('CERTIFIED_PATTERN_UNRESOLVABLE');
  const centreCoordinatesInt=solution.centres.map(centre=>{
    const point=quantizePoint({x:centre.xMm,y:centre.yMm},profile.numeric.coordinateQuantumMm);
    const restored=dequantizePoint(point,profile.numeric.coordinateQuantumMm);
    if(Math.abs(restored.x-centre.xMm)>1e-12||Math.abs(restored.y-centre.yMm)>1e-12)throw new Error('CENTRE_NOT_REPRESENTABLE_AT_QUANTUM');
    return Object.freeze([point.x,point.y] as const);
  });
  return Object.freeze({
    schema:'onemo-engine-manufacturing-spec-v1' as const,schemaVersion:1 as const,
    computeArtifactHash:source.computeArtifactHash,logicArtifactHash:source.logicArtifactHash,
    profileId:profile.id,profileHash:profile.profileHash,sourceGeometryHash:source.sourceGeometryHash,sourceRingInt:source.sourceRingInt,
    finalGeometryHash:solution.geometryHash,finalRingInt:solution.finalRingInt,targetDominantMm:solution.targetDominantMm,
    widthMm:solution.widthMm,heightMm:solution.heightMm,scale:solution.scale,
    coordinateQuantumMm:profile.numeric.coordinateQuantumMm,canonicalOrigin:'SOURCE_BOUNDS_CENTER' as const,axisConvention:'X_RIGHT_Y_UP' as const,
    band:solution.band,populationId:solution.frame.populationId,populationStrideCells:solution.frame.populationStrideCells,
    populationOriginParity:solution.frame.populationOriginParity,frameId:solution.frame.id,
    patternId:solution.patternId,patternVersion:pattern.version,patternVariantId:pattern.variantId,
    registration:solution.registration,selectedCellAddresses:solution.centres.map(centre=>centre.cell),centreCoordinatesInt:Object.freeze(centreCoordinatesInt),centres:solution.centres,
    baseProtectedRadiusMm:profile.safety.baseProtectedRadiusMm,effectiveVerificationRadiusMm:profile.safety.effectiveVerificationRadiusMm,
    toleranceCompositionRuleId:profile.safety.tolerancePolicy.id,approximationToleranceMm:profile.numeric.approximationToleranceMm,
    approximationErrorEnvelopeMm:0 as const,minimumMarginMm:solution.minimumMarginMm,decisionTrace:solution.scoreTrace,decisionProof:solution.decisionProof,
    proofStatus:profile.productionReady
      ? 'CERTIFIED_CONTINUOUS_OPTIMUM_EXACT_AT_QUANTUM' as const
      : 'REFERENCE_PROFILE_NOT_PRODUCTION' as const
  });
}

export function assertEngineManufacturingSpecCanonicalHash(spec:EngineManufacturingSpec):void{
  const {canonicalHash:recorded,...payload}=spec;
  if(canonicalHash(payload)!==recorded)throw new Error('CANONICAL_HASH_MISMATCH');
}

export function createEngineManufacturingSpec(
  solve:SolveResult,
  solution:SizeSolution,
  profileInput:RegisteredProfile
):EngineManufacturingSpec{
  const profile=registerProfile(profileInput);
  if(solve.profileHash!==profile.profileHash||solve.profileId!==profile.id)throw new Error('PROFILE_HASH_MISMATCH');
  if(solve.computeArtifactHash.length===0||solve.logicArtifactHash.length===0)throw new Error('ENGINE_ARTIFACT_UNRESOLVABLE');
  assertCertifiedOfferAuthority(solve,solution,profile);
  const payload=buildEngineManufacturingPayload(solve,solution,profile);
  return Object.freeze({...payload,canonicalHash:canonicalHash(payload)});
}

export function selectedOffer(solve:SolveResult,band:string):SizeSolution{
  const offer=solve.offers.find(o=>o.band===band);if(!offer?.solution||offer.status!=='OFFERED')throw new Error(`no offered solution for ${band}`);return offer.solution;
}
