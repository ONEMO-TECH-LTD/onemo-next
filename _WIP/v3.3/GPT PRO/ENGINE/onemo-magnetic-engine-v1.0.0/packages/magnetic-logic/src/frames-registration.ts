import type { AxisClass, Bounds, FrameHypothesis, PatternDefinition, Point, RegisteredProfile } from './contracts.js';
import { cellToMm } from './cell-board.js';

function requiredCapacity(values:readonly number[]):number{
  const min=Math.min(...values),max=Math.max(...values);return Math.round((max-min)/2)+1;
}

export function patternCapacity(pattern:PatternDefinition):{nx:number;ny:number}{
  return{nx:requiredCapacity(pattern.cells.map(c=>c[0])),ny:requiredCapacity(pattern.cells.map(c=>c[1]))};
}

export function frameForPattern(pattern:PatternDefinition):FrameHypothesis{
  const {nx,ny}=patternCapacity(pattern);
  return{id:pattern.frameId,nx,ny,populationId:pattern.populationId};
}

export function frameFits(frame:FrameHypothesis,classX:AxisClass,classY:AxisClass):boolean{return frame.nx<=classX&&frame.ny<=classY;}
export function patternOffsetsMm(profile:RegisteredProfile,pattern:PatternDefinition):Point[]{return pattern.cells.map(cell=>cellToMm(profile,cell));}

export function translationDomain(profile:RegisteredProfile):Bounds{
  const half=profile.translation.periodMm/2;
  return{
    minX:profile.translation.allowX?-half:0,maxX:profile.translation.allowX?half:0,
    minY:profile.translation.allowY?-half:0,maxY:profile.translation.allowY?half:0
  };
}
