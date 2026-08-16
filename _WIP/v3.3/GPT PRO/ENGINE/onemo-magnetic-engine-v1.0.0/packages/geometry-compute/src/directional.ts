import type { DirectionalCapMetrics, Point, PreparedPolygon } from './contracts.js';
import { capMoment } from './halfplane.js';
import { dot, normalizeDirection } from './numeric.js';
import { projectRing } from './measure.js';

export function directionalMetrics(polygon:PreparedPolygon,anchors:readonly Point[],directionInput:Point):DirectionalCapMetrics{
  const direction=normalizeDirection(directionInput); const projection=projectRing(polygon.ringMm,direction);
  let anchorMin=Infinity,anchorMax=-Infinity;
  for(const anchor of anchors){const v=dot(anchor,direction);anchorMin=Math.min(anchorMin,v);anchorMax=Math.max(anchorMax,v);}
  if(anchors.length===0){anchorMin=0;anchorMax=0;}
  const positive=capMoment(polygon.ringMm,direction,anchorMax,true);
  const negative=capMoment(polygon.ringMm,direction,anchorMin,false);
  return{
    direction,
    polygonMin:projection.min,polygonMax:projection.max,anchorMin,anchorMax,
    positiveUnsupportedExtentMm:Math.max(0,projection.max-anchorMax),
    negativeUnsupportedExtentMm:Math.max(0,anchorMin-projection.min),
    positiveCapAreaMm2:positive.areaMm2,negativeCapAreaMm2:negative.areaMm2,
    positiveCapCentroid:positive.centroid,negativeCapCentroid:negative.centroid,
    positiveFirstMomentMm3:positive.firstMomentMm3,negativeFirstMomentMm3:negative.firstMomentMm3
  };
}
