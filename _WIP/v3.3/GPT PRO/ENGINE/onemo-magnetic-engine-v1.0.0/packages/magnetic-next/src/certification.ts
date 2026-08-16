import type { EngineManufacturingSpec, RegisteredProfile, SizeSolution, SolveResult } from '@onemo/magnetic-logic';
import { candidateSizes, certifySizeSolution, createEngineManufacturingSpec, selectedOffer, sourceGeometryIdentity } from '@onemo/magnetic-logic';
import type { StudioPoint } from './outline-adapter.js';
import { adaptStudioOutline } from './outline-adapter.js';

export interface CertifiedSelection {
  readonly solution: SizeSolution;
  readonly manufacturingSpec: EngineManufacturingSpec;
}

/** Re-evaluates the selected preview size through the continuous-domain
 * certification path before creating a manufacturing specification. */
export function certifyAndBindSelectedBand(
  preview: SolveResult,
  band: string,
  studioOutline: readonly StudioPoint[],
  profile: RegisteredProfile,
  adapter: Parameters<typeof adaptStudioOutline>[1] = { inputYAxis: 'DOWN', centreOnBounds: true }
): CertifiedSelection {
  const selected = selectedOffer(preview, band);
  if(selected.decisionProof!=='CERTIFIED_CONTINUOUS_OPTIMUM')throw new Error('SELECTED_OFFER_NOT_CERTIFIED');
  const selectedEvidence=preview.evaluated.find(item=>item.band===selected.band&&item.targetDominantMm===selected.targetDominantMm);
  if(!selectedEvidence||selectedEvidence.status!=='ACCEPTED'||selectedEvidence.decisionProof!=='CERTIFIED_CONTINUOUS_OPTIMUM')throw new Error('SELECTED_RUNG_NOT_CERTIFIED');
  const bandDefinition=profile.sizeDomain.bands.find(candidate=>candidate.id===selected.band);
  const smallerRungs=candidateSizes(profile).filter(size=>size<selected.targetDominantMm&&bandDefinition&&size>=bandDefinition.minMm-1e-12&&(bandDefinition.maxInclusive?size<=bandDefinition.maxMm+1e-12:size<bandDefinition.maxMm-1e-12));
  if(smallerRungs.some(size=>!preview.evaluated.some(item=>item.band===selected.band&&item.targetDominantMm===size&&item.status==='REJECTED')))throw new Error('SMALLEST_ACCEPTED_RUNG_NOT_CERTIFIED');
  const outlineMm=adaptStudioOutline(studioOutline, adapter);
  const source=sourceGeometryIdentity(outlineMm,profile);
  if(source.sourceGeometryHash!==preview.sourceGeometryHash||JSON.stringify(source.sourceRingInt)!==JSON.stringify(preview.sourceRingInt))throw new Error('SOURCE_GEOMETRY_MISMATCH');
  const certified = certifySizeSolution({
    outlineMm,
    profile,
    targetDominantMm: selected.targetDominantMm
  });
  if (certified.status !== 'ACCEPTED') {
    throw new Error(`SELECTED_SIZE_NOT_CERTIFIED:${certified.reasons.join(',')}`);
  }
  return Object.freeze({
    solution: certified,
    manufacturingSpec: createEngineManufacturingSpec(preview, certified, profile)
  });
}
