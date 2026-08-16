import type { EngineManufacturingSpec, RegisteredProfile, SizeSolution, SolveResult } from '@onemo/magnetic-logic';
import { certifySizeSolution, createEngineManufacturingSpec, selectedOffer } from '@onemo/magnetic-logic';
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
  const certified = certifySizeSolution({
    outlineMm: adaptStudioOutline(studioOutline, adapter),
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
