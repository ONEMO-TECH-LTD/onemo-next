import type { EngineManufacturingSpec } from '@onemo/magnetic-logic';
export function serializeManufacturingSpec(spec:EngineManufacturingSpec):string{return JSON.stringify(spec);}
export function parseManufacturingSpec(serialized:string):EngineManufacturingSpec{
  const value=JSON.parse(serialized) as Partial<EngineManufacturingSpec>;
  if(value.schema!=='onemo-engine-manufacturing-spec-v1'||typeof value.canonicalHash!=='string')throw new Error('invalid ManufacturingSpec payload');
  return value as EngineManufacturingSpec;
}
