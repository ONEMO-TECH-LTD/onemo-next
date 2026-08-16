import type { DiscContainmentResult, Point, PreparedPolygon } from './contracts.js';
import { ComputeError } from './contracts.js';
import { exactClearanceAtQuantizedPoint, exactDistanceComparison } from './clearance.js';
import { pointLocationInt } from './polygon.js';
import { quantizeNonNegativeCeiling, quantizePoint } from './numeric.js';

export function discContainedExact(polygon:PreparedPolygon,centre:Point,radiusMm:number):DiscContainmentResult{
  if(!Number.isFinite(radiusMm)||radiusMm<0)throw new ComputeError('INVALID_RADIUS','radius must be finite and non-negative',{radiusMm});
  const centreInt=quantizePoint(centre,polygon.quantumMm);
  const radiusInt=quantizeNonNegativeCeiling(radiusMm,polygon.quantumMm);
  const location=pointLocationInt(polygon.ringInt,centreInt);
  let legal=location!=='OUTSIDE';
  if(legal){
    for(let i=0;i<polygon.ringInt.length;i++){
      const a=polygon.ringInt[i]!,b=polygon.ringInt[(i+1)%polygon.ringInt.length]!;
      if(!exactDistanceComparison(centreInt,a,b,radiusInt).atLeast){legal=false;break;}
    }
  }
  const clearance=exactClearanceAtQuantizedPoint(polygon,centre);
  return{...clearance,radiusMm,marginMm:clearance.clearanceMm-radiusMm,legal,exactAtQuantum:true};
}

export function discsContainedExact(polygon:PreparedPolygon,centres:readonly Point[],radiusMm:number):DiscContainmentResult[]{
  return centres.map(c=>discContainedExact(polygon,c,radiusMm));
}
