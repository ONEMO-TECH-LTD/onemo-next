import type { EngineManufacturingSpec, RegisteredProfile } from '@onemo/magnetic-logic';
import { verifyEngineManufacturingSpec } from '@onemo/magnetic-logic';
export function verifyOnServer(spec:EngineManufacturingSpec,profile:RegisteredProfile):{valid:true;minimumMarginMm:number}{return verifyEngineManufacturingSpec(spec,profile);}
