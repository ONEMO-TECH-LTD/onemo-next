import type { EngineManufacturingSpec, ManufacturingVerificationResolver } from '@onemo/magnetic-logic';
import { verifyEngineManufacturingSpec } from '@onemo/magnetic-logic';
export function verifyOnServer(spec:EngineManufacturingSpec,resolver:ManufacturingVerificationResolver):{valid:true;minimumMarginMm:number}{return verifyEngineManufacturingSpec(spec,resolver);}
