import type { EngineManufacturingSpec, RegisteredProfile, SolveResult } from '@onemo/magnetic-logic';
import { createEngineManufacturingSpec, selectedOffer } from '@onemo/magnetic-logic';
export function bindSelectedBand(result:SolveResult,band:string,profile:RegisteredProfile):EngineManufacturingSpec{return createEngineManufacturingSpec(result,selectedOffer(result,band),profile);}
