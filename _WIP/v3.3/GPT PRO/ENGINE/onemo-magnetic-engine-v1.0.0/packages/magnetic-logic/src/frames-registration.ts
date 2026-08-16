import type { AxisClass, Bounds, FrameHypothesis, PatternDefinition, Point, RegisteredProfile } from './contracts.js';
import { cellToMm } from './cell-board.js';

function requiredCapacity(values:readonly number[],strideCells:number):number{
  const min=Math.min(...values),max=Math.max(...values);return Math.round((max-min)/strideCells)+1;
}

export function patternCapacity(pattern:PatternDefinition,populationStrideCells:number):{nx:number;ny:number}{
  return{nx:requiredCapacity(pattern.cells.map(c=>c[0]),populationStrideCells),ny:requiredCapacity(pattern.cells.map(c=>c[1]),populationStrideCells)};
}

export function frameForPattern(pattern:PatternDefinition,populationStrideCells:number,populationOriginParity:readonly [number,number]):FrameHypothesis{
  const {nx,ny}=patternCapacity(pattern,populationStrideCells);
  return{id:pattern.frameId,nx,ny,populationId:pattern.populationId,populationStrideCells,populationOriginParity};
}

export function framesForPattern(profile:RegisteredProfile,pattern:PatternDefinition):FrameHypothesis[]{
  const population=profile.grid.populations.find(candidate=>candidate.id===pattern.populationId);
  if(!population?.enabled)return[];
  return population.originParities.map(parity=>frameForPattern(pattern,population.strideCells,parity));
}

export function frameFits(frame:FrameHypothesis,classX:AxisClass,classY:AxisClass):boolean{return frame.nx<=classX&&frame.ny<=classY;}
export function patternCellsForFrame(profile:RegisteredProfile,pattern:PatternDefinition,frame:FrameHypothesis):readonly (readonly [number,number])[]{
  const [px,py]=frame.populationOriginParity;
  return pattern.cells.map(([x,y])=>Object.freeze([x+px*profile.grid.nodeStrideCells,y+py*profile.grid.nodeStrideCells] as const));
}
export function patternOffsetsMm(profile:RegisteredProfile,pattern:PatternDefinition,frame:FrameHypothesis):Point[]{
  return patternCellsForFrame(profile,pattern,frame).map(cell=>cellToMm(profile,cell));
}

export function translationDomain(profile:RegisteredProfile):Bounds{
  const half=profile.translation.periodMm/2;
  return{
    minX:profile.translation.allowX?-half:0,maxX:profile.translation.allowX?half:0,
    minY:profile.translation.allowY?-half:0,maxY:profile.translation.allowY?half:0
  };
}
