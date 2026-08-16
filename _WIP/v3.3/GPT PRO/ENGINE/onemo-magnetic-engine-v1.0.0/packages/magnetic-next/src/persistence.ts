import type { EngineManufacturingSpec } from '@onemo/magnetic-logic';
import { assertEngineManufacturingSpecCanonicalHash } from '@onemo/magnetic-logic';
export function serializeManufacturingSpec(spec:EngineManufacturingSpec):string{return JSON.stringify(spec);}
export function parseManufacturingSpec(serialized:string):EngineManufacturingSpec{
  const value=JSON.parse(serialized) as Partial<EngineManufacturingSpec>;
  if(value.schema!=='onemo-engine-manufacturing-spec-v1'||value.schemaVersion!==1||typeof value.canonicalHash!=='string'||!Array.isArray(value.sourceRingInt)||!Array.isArray(value.finalRingInt))throw new Error('invalid ManufacturingSpec payload');
  assertEngineManufacturingSpecCanonicalHash(value as EngineManufacturingSpec);
  return Object.freeze(value as EngineManufacturingSpec);
}
