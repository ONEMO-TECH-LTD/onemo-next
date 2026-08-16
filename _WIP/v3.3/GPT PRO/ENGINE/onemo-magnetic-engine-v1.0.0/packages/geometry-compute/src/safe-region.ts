import type { AdaptiveOptions, FeasibleTranslationSet, PreparedPolygon } from './contracts.js';
import { adaptiveFeasibleTranslations } from './adaptive.js';

export function adaptiveSafeRegion(polygon:PreparedPolygon,radiusMm:number,options:AdaptiveOptions):FeasibleTranslationSet{
  return adaptiveFeasibleTranslations(polygon,[{x:0,y:0}],radiusMm,polygon.metrics.bounds,options,polygon.metrics.boundsCenter);
}
