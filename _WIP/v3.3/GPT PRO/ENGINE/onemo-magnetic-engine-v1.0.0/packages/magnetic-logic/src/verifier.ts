import { canonicalHash, dequantizePoint } from '@onemo/geometry-compute';
import type {
  EngineManufacturingSpec,FulfilmentManufacturingSpec,PhysicalComponentProfile,ProductProfile,RegisteredProfile,SolveInput,SolveResult
} from './contracts.js';
import { COMPUTE_ARTIFACT_HASH } from '@onemo/geometry-compute';
import { LOGIC_ARTIFACT_HASH } from './artifact.js';
import { assertEngineManufacturingSpecCanonicalHash, buildEngineManufacturingPayload } from './manufacturing-spec.js';
import { registerProfile } from './profile-registry.js';
import { solveOutlineSync } from './solver.js';

export interface ResolvedArtifact {readonly artifactHash:string;}
export interface ResolvedLogicArtifact extends ResolvedArtifact {
  readonly computeArtifactHash:string;
  readonly solveOutline:(input:SolveInput)=>SolveResult;
}
export interface ManufacturingVerificationResolver {
  resolveProfile(profileId:string,profileHash:string):ProductProfile|RegisteredProfile|undefined;
  resolveComputeArtifact(artifactHash:string):ResolvedArtifact|undefined;
  resolveLogicArtifact(artifactHash:string):ResolvedLogicArtifact|undefined;
}

function withoutHash<T extends {canonicalHash:string}>(value:T):Omit<T,'canonicalHash'>{const {canonicalHash:_hash,...rest}=value;return rest;}

export function currentManufacturingVerificationResolver(profileInput:ProductProfile|RegisteredProfile):ManufacturingVerificationResolver{
  const profile=registerProfile(profileInput);
  return Object.freeze({
    resolveProfile:(id:string,hash:string)=>id===profile.id&&hash===profile.profileHash?profile:undefined,
    resolveComputeArtifact:(hash:string)=>hash===COMPUTE_ARTIFACT_HASH?{artifactHash:COMPUTE_ARTIFACT_HASH}:undefined,
    resolveLogicArtifact:(hash:string)=>hash===LOGIC_ARTIFACT_HASH?{artifactHash:LOGIC_ARTIFACT_HASH,computeArtifactHash:COMPUTE_ARTIFACT_HASH,solveOutline:solveOutlineSync}:undefined
  });
}

function asResolver(input:RegisteredProfile|ManufacturingVerificationResolver):ManufacturingVerificationResolver{
  return 'resolveProfile' in input?input:currentManufacturingVerificationResolver(input);
}

function resolvePinned(spec:EngineManufacturingSpec,resolver:ManufacturingVerificationResolver):{
  readonly profile:RegisteredProfile;readonly logic:ResolvedLogicArtifact;
}{
  const profileInput=resolver.resolveProfile(spec.profileId,spec.profileHash);
  if(!profileInput)throw new Error('PROFILE_UNRESOLVABLE');
  let profile:RegisteredProfile;
  try{profile=registerProfile(profileInput);}catch{throw new Error('PROFILE_HASH_MISMATCH');}
  if(profile.id!==spec.profileId||profile.profileHash!==spec.profileHash)throw new Error('PROFILE_HASH_MISMATCH');
  const compute=resolver.resolveComputeArtifact(spec.computeArtifactHash);
  if(!compute)throw new Error('COMPUTE_ARTIFACT_UNRESOLVABLE');
  if(compute.artifactHash!==spec.computeArtifactHash)throw new Error('COMPUTE_ARTIFACT_HASH_MISMATCH');
  const logic=resolver.resolveLogicArtifact(spec.logicArtifactHash);
  if(!logic)throw new Error('LOGIC_ARTIFACT_UNRESOLVABLE');
  if(logic.artifactHash!==spec.logicArtifactHash)throw new Error('LOGIC_ARTIFACT_HASH_MISMATCH');
  if(logic.computeArtifactHash!==spec.computeArtifactHash)throw new Error('COMPUTE_ARTIFACT_HASH_MISMATCH');
  return{profile,logic};
}

export function verifyEngineManufacturingSpec(
  spec:EngineManufacturingSpec,
  profileOrResolver:RegisteredProfile|ManufacturingVerificationResolver
):{valid:true;minimumMarginMm:number}{
  const resolver=asResolver(profileOrResolver);
  const {profile,logic}=resolvePinned(spec,resolver);
  assertEngineManufacturingSpecCanonicalHash(spec);
  if(!Number.isFinite(spec.baseProtectedRadiusMm)||spec.baseProtectedRadiusMm<=0||!Number.isFinite(spec.effectiveVerificationRadiusMm)||spec.effectiveVerificationRadiusMm<=0||typeof spec.toleranceCompositionRuleId!=='string'||spec.toleranceCompositionRuleId.length===0||spec.effectiveVerificationRadiusMm!==profile.safety.effectiveVerificationRadiusMm||spec.toleranceCompositionRuleId!==profile.safety.tolerancePolicy.id)throw new Error('PHYSICAL_TOLERANCE_POLICY_MISSING');
  const sourceRingMm=spec.sourceRingInt.map(([x,y])=>dequantizePoint({x,y},spec.coordinateQuantumMm));
  const solve=logic.solveOutline({outlineMm:sourceRingMm,profile});
  const offer=solve.offers.find(candidate=>candidate.band===spec.band);
  if(offer?.status!=='OFFERED'||!offer.solution||offer.solution.targetDominantMm!==spec.targetDominantMm)throw new Error('MANUFACTURING_OFFER_MISMATCH');
  const certified=offer.solution;
  const rebuilt=buildEngineManufacturingPayload({
    computeArtifactHash:spec.computeArtifactHash,logicArtifactHash:spec.logicArtifactHash,
    sourceGeometryHash:spec.sourceGeometryHash,sourceRingInt:spec.sourceRingInt
  },certified,profile);
  if(canonicalHash(rebuilt)!==spec.canonicalHash)throw new Error('MANUFACTURING_EVIDENCE_MISMATCH');
  return{valid:true,minimumMarginMm:certified.minimumMarginMm};
}

export function validatePhysicalComponentProfile(physical:PhysicalComponentProfile):void{
  if(!physical||typeof physical.id!=='string'||physical.id.trim().length===0||!Number.isInteger(physical.version)||physical.version<=0||typeof physical.assemblyProfileId!=='string'||physical.assemblyProfileId.trim().length===0)throw new Error('COMPONENT_REFERENCE_MISSING');
  if(!Number.isFinite(physical.magnetDiameterMm)||physical.magnetDiameterMm<=0||!Number.isFinite(physical.magnetThicknessMm)||physical.magnetThicknessMm<=0)throw new Error('COMPONENT_DIMENSIONS_INVALID');
  for(const value of [physical.cutToleranceMm,physical.placementToleranceMm,physical.materialToleranceMm,physical.assemblyToleranceMm]){
    if(!Number.isFinite(value)||value<0)throw new Error('COMPONENT_TOLERANCE_INVALID');
  }
}

function assertPhysicalCompatibility(engineSpec:EngineManufacturingSpec,profile:RegisteredProfile,physical:PhysicalComponentProfile):void{
  validatePhysicalComponentProfile(physical);
  if(physical.magnetDiameterMm>profile.safety.baseProtectedRadiusMm*2+engineSpec.coordinateQuantumMm/2)throw new Error('COMPONENT_TOLERANCE_INCOMPATIBLE');
  const budget=profile.safety.tolerancePolicy;
  if(physical.cutToleranceMm>budget.cutMm||physical.placementToleranceMm>budget.placementMm||physical.materialToleranceMm>budget.materialMm||physical.assemblyToleranceMm>budget.assemblyMm)throw new Error('COMPONENT_TOLERANCE_INCOMPATIBLE');
  const adverse=physical.cutToleranceMm+physical.placementToleranceMm+physical.materialToleranceMm+physical.assemblyToleranceMm;
  const required=budget.id==='POST_TOLERANCE_MINIMUM_V1'?profile.safety.baseProtectedRadiusMm+adverse:profile.safety.baseProtectedRadiusMm;
  if(required>engineSpec.effectiveVerificationRadiusMm+engineSpec.coordinateQuantumMm/2)throw new Error('COMPONENT_TOLERANCE_INCOMPATIBLE');
}

export function completeFulfilmentSpec(
  engineSpec:EngineManufacturingSpec,
  profileInput:RegisteredProfile,
  physical:PhysicalComponentProfile
):FulfilmentManufacturingSpec{
  const profile=registerProfile(profileInput);
  verifyEngineManufacturingSpec(engineSpec,currentManufacturingVerificationResolver(profile));
  assertPhysicalCompatibility(engineSpec,profile,physical);
  if(!profile.productionReady)throw new Error('REFERENCE_PROFILE_NOT_PRODUCTION');
  const payload={
    schema:'onemo-fulfilment-manufacturing-spec-v1' as const,engineSpec,physicalComponent:physical,
    verifierComputeArtifactHash:COMPUTE_ARTIFACT_HASH,verifierLogicArtifactHash:LOGIC_ARTIFACT_HASH,verificationStatus:'VERIFIED' as const
  };
  return Object.freeze({...payload,canonicalHash:canonicalHash(payload)});
}

export function verifyFulfilmentSpec(
  spec:FulfilmentManufacturingSpec,
  profileOrResolver:RegisteredProfile|ManufacturingVerificationResolver
):{valid:true}{
  if(canonicalHash(withoutHash(spec))!==spec.canonicalHash)throw new Error('CANONICAL_HASH_MISMATCH');
  const resolver=asResolver(profileOrResolver);
  verifyEngineManufacturingSpec(spec.engineSpec,resolver);
  const profileInput=resolver.resolveProfile(spec.engineSpec.profileId,spec.engineSpec.profileHash);
  if(!profileInput)throw new Error('PROFILE_UNRESOLVABLE');
  const profile=registerProfile(profileInput);
  if(!profile.productionReady)throw new Error('REFERENCE_PROFILE_NOT_PRODUCTION');
  assertPhysicalCompatibility(spec.engineSpec,profile,spec.physicalComponent);
  const compute=resolver.resolveComputeArtifact(spec.verifierComputeArtifactHash);
  if(!compute)throw new Error('COMPUTE_ARTIFACT_UNRESOLVABLE');
  if(compute.artifactHash!==spec.verifierComputeArtifactHash)throw new Error('COMPUTE_ARTIFACT_HASH_MISMATCH');
  const logic=resolver.resolveLogicArtifact(spec.verifierLogicArtifactHash);
  if(!logic)throw new Error('LOGIC_ARTIFACT_UNRESOLVABLE');
  if(logic.artifactHash!==spec.verifierLogicArtifactHash)throw new Error('LOGIC_ARTIFACT_HASH_MISMATCH');
  return{valid:true};
}
