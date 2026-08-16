import type { BandOffer, SolveResult } from '@onemo/magnetic-logic';
export interface SizeOptionViewModel {readonly band:string;readonly status:BandOffer['status'];readonly label:string;readonly widthMm?:number;readonly heightMm?:number;readonly patternId?:string;readonly reasons:readonly string[];}
export function solutionViewModels(result:SolveResult):SizeOptionViewModel[]{
  return result.offers.map(offer=>offer.solution?{
    band:offer.band,status:offer.status,label:`${offer.band} · ${offer.solution.widthMm.toFixed(2)} × ${offer.solution.heightMm.toFixed(2)} mm`,
    widthMm:offer.solution.widthMm,heightMm:offer.solution.heightMm,patternId:offer.solution.patternId,reasons:offer.reasons
  }:{band:offer.band,status:offer.status,label:`${offer.band} · ${offer.status==='DECISION_INDETERMINATE'?'needs review':'not available'}`,reasons:offer.reasons});
}
