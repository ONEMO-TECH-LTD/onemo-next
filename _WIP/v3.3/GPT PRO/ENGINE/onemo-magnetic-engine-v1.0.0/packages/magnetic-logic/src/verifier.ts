import { canonicalHash, dequantizePoint, discContainedExact, preparePolygon } from '@onemo/geometry-compute';
import type { EngineManufacturingSpec, FulfilmentManufacturingSpec, PhysicalComponentProfile, RegisteredProfile } from './contracts.js';
import { COMPUTE_ARTIFACT_HASH } from '@onemo/geometry-compute';
import { LOGIC_ARTIFACT_HASH } from './artifact.js';

function withoutHash<T extends {canonicalHash:string}>(value:T):Omit<T,'canonicalHash'>{const {canonicalHash:_hash,...rest}=value;return rest;}

export function verifyEngineManufacturingSpec(spec:EngineManufacturingSpec,profile:RegisteredProfile):{valid:true;minimumMarginMm:number}{
  if(spec.computeArtifactHash!==COMPUTE_ARTIFACT_HASH)throw new Error('COMPUTE_ARTIFACT_HASH_MISMATCH');
  if(spec.logicArtifactHash!==LOGIC_ARTIFACT_HASH)throw new Error('LOGIC_ARTIFACT_HASH_MISMATCH');
  if(spec.profileHash!==profile.profileHash||spec.profileId!==profile.id)throw new Error('PROFILE_HASH_MISMATCH');
  if(canonicalHash(withoutHash(spec))!==spec.canonicalHash)throw new Error('CANONICAL_HASH_MISMATCH');
  if(spec.effectiveVerificationRadiusMm!==profile.safety.effectiveVerificationRadiusMm)throw new Error('PHYSICAL_TOLERANCE_POLICY_MISSING');
  if(profile.productionReady&&(spec.decisionProof!=='CERTIFIED_CONTINUOUS_OPTIMUM'||spec.proofStatus!=='CERTIFIED_CONTINUOUS_OPTIMUM_EXACT_AT_QUANTUM'))throw new Error('MECHANICAL_OPTIMUM_NOT_CERTIFIED');
  const ring=spec.finalRingInt.map(([x,y])=>dequantizePoint({x,y},spec.coordinateQuantumMm));
  const polygon=preparePolygon(ring,{quantumMm:spec.coordinateQuantumMm,maxVertices:profile.numeric.maxVertices});
  if(polygon.geometryHash!==spec.finalGeometryHash)throw new Error('GEOMETRY_HASH_MISMATCH');
  let minimum=Infinity;
  for(const centre of spec.centres){const proof=discContainedExact(polygon,{x:centre.xMm,y:centre.yMm},spec.effectiveVerificationRadiusMm);if(!proof.legal)throw new Error('FULFILMENT_VERIFICATION_FAILED');minimum=Math.min(minimum,proof.marginMm);}
  if(Math.abs(minimum-spec.minimumMarginMm)>spec.coordinateQuantumMm*2)throw new Error('FULFILMENT_VERIFICATION_FAILED');
  return{valid:true,minimumMarginMm:minimum};
}

export function completeFulfilmentSpec(
  engineSpec:EngineManufacturingSpec,
  profile:RegisteredProfile,
  physical:PhysicalComponentProfile
):FulfilmentManufacturingSpec{
  verifyEngineManufacturingSpec(engineSpec,profile);
  if(!profile.productionReady)throw new Error('REFERENCE_PROFILE_NOT_PRODUCTION');
  const budget=profile.safety.tolerancePolicy;
  if(physical.cutToleranceMm>budget.cutMm||physical.placementToleranceMm>budget.placementMm||physical.materialToleranceMm>budget.materialMm||physical.assemblyToleranceMm>budget.assemblyMm)throw new Error('COMPONENT_TOLERANCE_INCOMPATIBLE');
  const adverse=physical.cutToleranceMm+physical.placementToleranceMm+physical.materialToleranceMm+physical.assemblyToleranceMm;
  const required=budget.id==='POST_TOLERANCE_MINIMUM_V1'?profile.safety.baseProtectedRadiusMm+adverse:profile.safety.baseProtectedRadiusMm;
  if(required>engineSpec.effectiveVerificationRadiusMm+engineSpec.coordinateQuantumMm/2)throw new Error('COMPONENT_TOLERANCE_INCOMPATIBLE');
  const payload={schema:'onemo-fulfilment-manufacturing-spec-v1' as const,engineSpec,physicalComponent:physical,verificationStatus:'VERIFIED' as const};
  return Object.freeze({...payload,canonicalHash:canonicalHash(payload)});
}

export function verifyFulfilmentSpec(spec:FulfilmentManufacturingSpec,profile:RegisteredProfile):{valid:true}{
  if(canonicalHash(withoutHash(spec))!==spec.canonicalHash)throw new Error('CANONICAL_HASH_MISMATCH');
  verifyEngineManufacturingSpec(spec.engineSpec,profile);
  const completed=completeFulfilmentSpec(spec.engineSpec,profile,spec.physicalComponent);
  if(completed.canonicalHash!==spec.canonicalHash)throw new Error('FULFILMENT_VERIFICATION_FAILED');
  return{valid:true};
}
