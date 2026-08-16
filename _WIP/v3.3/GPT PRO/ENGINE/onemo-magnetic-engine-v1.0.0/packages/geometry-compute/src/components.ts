import type { Bounds, ComponentHierarchy, Point, PreparedPolygon, SafeComponent, SafeGridCell } from './contracts.js';
import { clearanceAtPoint } from './clearance.js';

function key(ix:number,iy:number):string{return `${ix},${iy}`;}
function componentId(level:number,index:number):string{return `L${level}:C${index}`;}
function isConvex(ring:readonly Point[]):boolean{
  let direction=0;
  for(let index=0;index<ring.length;index++){
    const a=ring[index]!,b=ring[(index+1)%ring.length]!,c=ring[(index+2)%ring.length]!;
    const cross=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
    if(Math.abs(cross)<=1e-12)continue;
    const sign=Math.sign(cross);if(direction!==0&&sign!==direction)return false;direction=sign;
  }
  return direction!==0;
}

export function buildComponentHierarchy(
  polygon:PreparedPolygon,
  levelsMm:readonly number[],
  stepMm:number,
  maxSamples=250_000
):ComponentHierarchy{
  if(levelsMm.length===0)throw new TypeError('at least one clearance level is required');
  const ordered=[...levelsMm].sort((a,b)=>a-b);
  for(let i=1;i<ordered.length;i++)if(ordered[i]!<=ordered[i-1]!)throw new TypeError('clearance levels must be strictly increasing');
  const b=polygon.metrics.bounds;
  const nx=Math.max(1,Math.ceil((b.maxX-b.minX)/stepMm));
  const ny=Math.max(1,Math.ceil((b.maxY-b.minY)/stepMm));
  if(nx*ny>maxSamples)throw new RangeError(`component sample budget exceeded: ${nx*ny} > ${maxSamples}`);
  const errorEnvelopeMm=stepMm*Math.SQRT2/2;
  const convex=isConvex(polygon.ringMm);
  const cells:SafeGridCell[]=[]; const indexByKey=new Map<string,number>();
  for(let iy=0;iy<ny;iy++)for(let ix=0;ix<nx;ix++){
    const centre:Point={x:b.minX+(ix+0.5)*stepMm,y:b.minY+(iy+0.5)*stepMm};
    const clearance=clearanceAtPoint(polygon,centre).signedClearanceMm;
    const possibleLevels=ordered.map(radius=>clearance+errorEnvelopeMm>=radius);
    const definiteLevels=ordered.map(radius=>clearance-errorEnvelopeMm>=radius);
    if(possibleLevels.some(Boolean)){
      const idx=cells.length;cells.push({ix,iy,centre,clearanceMm:clearance,possibleLevels:Object.freeze(possibleLevels),definiteLevels:Object.freeze(definiteLevels)});indexByKey.set(key(ix,iy),idx);
    }
  }
  const components:SafeComponent[]=[];
  const componentCellsById=new Map<string,Set<number>>();
  const cellComponentAtLevel:Map<number,string>[]=[];
  for(let level=0;level<ordered.length;level++){
    const assignment=new Map<number,string>(); const visited=new Set<number>(); let sequence=0;
    for(let seed=0;seed<cells.length;seed++){
      const seedCell=cells[seed]!; if(!seedCell.possibleLevels[level]||visited.has(seed))continue;
      const queue=[seed];visited.add(seed);const members:number[]=[];
      while(queue.length){
        const index=queue.shift()!;members.push(index);const c=cells[index]!;
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const){
          const neighbour=indexByKey.get(key(c.ix+dx,c.iy+dy));
          if(neighbour===undefined||visited.has(neighbour))continue;
          if(!cells[neighbour]!.possibleLevels[level])continue;
          visited.add(neighbour);queue.push(neighbour);
        }
      }
      members.sort((a,b2)=>a-b2);const id=componentId(level,sequence++);
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,sumX=0,sumY=0,maxClearance=-Infinity,definiteCellCount=0;
      const exactWitnessPoints:Point[]=[];
      for(const index of members){
        const c=cells[index]!;assignment.set(index,id);sumX+=c.centre.x;sumY+=c.centre.y;maxClearance=Math.max(maxClearance,c.clearanceMm);
        if(c.definiteLevels[level])definiteCellCount++;
        if(c.clearanceMm>=ordered[level]!-1e-12)exactWitnessPoints.push(c.centre);
        minX=Math.min(minX,c.centre.x-stepMm/2);minY=Math.min(minY,c.centre.y-stepMm/2);maxX=Math.max(maxX,c.centre.x+stepMm/2);maxY=Math.max(maxY,c.centre.y+stepMm/2);
      }
      for(const witness of [polygon.metrics.boundsCenter,polygon.metrics.centroid]){
        if(clearanceAtPoint(polygon,witness).signedClearanceMm<ordered[level]!-1e-12)continue;
        const ix=Math.max(0,Math.min(nx-1,Math.floor((witness.x-b.minX)/stepMm))),iy=Math.max(0,Math.min(ny-1,Math.floor((witness.y-b.minY)/stepMm)));
        const witnessIndex=indexByKey.get(key(ix,iy));if(witnessIndex!==undefined&&members.includes(witnessIndex)&&!exactWitnessPoints.some(p=>Math.abs(p.x-witness.x)<=1e-12&&Math.abs(p.y-witness.y)<=1e-12))exactWitnessPoints.push(witness);
      }
      const definiteMembers=new Set(members.filter(index=>cells[index]!.definiteLevels[level]));let definiteGroups=0;const definiteVisited=new Set<number>();
      for(const seed of definiteMembers){if(definiteVisited.has(seed))continue;definiteGroups++;const queue=[seed];definiteVisited.add(seed);while(queue.length){const current=queue.shift()!,cell=cells[current]!;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const){const neighbour=indexByKey.get(key(cell.ix+dx,cell.iy+dy));if(neighbour!==undefined&&definiteMembers.has(neighbour)&&!definiteVisited.has(neighbour)){definiteVisited.add(neighbour);queue.push(neighbour);}}}}
      exactWitnessPoints.sort((a,b2)=>a.x-b2.x||a.y-b2.y);
      const bounds:Bounds={minX,minY,maxX,maxY};
      const sameCellPartition=definiteGroups===1&&definiteCellCount===members.length;
      // A non-empty erosion of a convex polygon is convex, so it has one component.
      const convexSinglePartition=convex&&definiteGroups===1&&exactWitnessPoints.length>0;
      const topologyCertified=sameCellPartition||convexSinglePartition;
      const certifiedMaxClearance=exactWitnessPoints.length?Math.max(...exactWitnessPoints.map(point=>clearanceAtPoint(polygon,point).signedClearanceMm)):0;
      const component:SafeComponent={id,levelIndex:level,radiusMm:ordered[level]!,cellCount:members.length,areaEstimateMm2:(definiteCellCount+members.length)*stepMm*stepMm/2,areaBoundsMm2:{lower:definiteCellCount*stepMm*stepMm,upper:members.length*stepMm*stepMm},bounds,centroid:{x:sumX/members.length,y:sumY/members.length},maxClearanceMm:certifiedMaxClearance,maxClearanceBoundsMm:{lower:certifiedMaxClearance,upper:maxClearance+errorEnvelopeMm},cells:Object.freeze(members),childIds:Object.freeze([]),nearToleranceBoundary:!topologyCertified,exactWitnessPoints:Object.freeze(exactWitnessPoints),topologyCertified,appearanceLevelIndex:level,disappearanceLevelIndex:level,persistenceLevelInterval:{lower:exactWitnessPoints.length?1:0,upper:1},persistenceRadiusMm:{lower:exactWitnessPoints.length?ordered[level]!:0,upper:ordered[level]!},touchesAnotherComponentOnlyBelowCurrentRadius:false,perimeterMm:null};
      components.push(component);componentCellsById.set(id,new Set(members));
    }
    cellComponentAtLevel.push(assignment);
  }
  const mutable=components.map(c=>({...c,childIds:[] as string[]}));
  const byId=new Map(mutable.map(c=>[c.id,c]));
  for(const component of mutable){
    if(component.levelIndex===0)continue;
    const parentCounts=new Map<string,number>();const shallower=cellComponentAtLevel[component.levelIndex-1]!;
    for(const cell of component.cells){const parent=shallower.get(cell);if(parent)parentCounts.set(parent,(parentCounts.get(parent)??0)+1);}
    const parent=[...parentCounts.entries()].sort((a,b2)=>b2[1]-a[1]||a[0].localeCompare(b2[0]))[0]?.[0];
    if(parent){(component as typeof component & {parentId:string}).parentId=parent;byId.get(parent)?.childIds.push(component.id);}
  }
  const deepest=(component:typeof mutable[number]):number=>Math.max(component.levelIndex,...component.childIds.map(id=>deepest(byId.get(id)!)));
  const frozen=mutable.map(c=>{const disappearanceLevelIndex=deepest(c),parent=c.parentId?byId.get(c.parentId):undefined;return Object.freeze({...c,childIds:Object.freeze([...c.childIds].sort()),disappearanceLevelIndex,persistenceLevelInterval:{lower:c.exactWitnessPoints.length?1:0,upper:disappearanceLevelIndex-c.levelIndex+1},persistenceRadiusMm:{lower:c.exactWitnessPoints.length?c.radiusMm:0,upper:ordered[disappearanceLevelIndex]!},touchesAnotherComponentOnlyBelowCurrentRadius:(parent?.childIds.length??0)>1});});
  const exactness=frozen.every(c=>c.topologyCertified)?'CERTIFIED_APPROXIMATE':'INDETERMINATE';
  return Object.freeze({bounds:b,stepMm,levelsMm:Object.freeze(ordered),cells:Object.freeze(cells),components:Object.freeze(frozen),errorEnvelopeMm,exactness});
}

export function componentToRegionEvidence(hierarchy:ComponentHierarchy,component:SafeComponent):{id:string;bounds:Bounds;gridOrigin:Point;cellStepMm:number;radiusMm:number;errorEnvelopeMm:number;definitelyOccupiedCellKeys:Set<string>;possiblyOccupiedCellKeys:Set<string>;exactWitnessPoints:readonly Point[]}{
  const definitelyOccupiedCellKeys=new Set<string>(),possiblyOccupiedCellKeys=new Set<string>();
  for(const index of component.cells){const cell=hierarchy.cells[index]!,cellKey=key(cell.ix,cell.iy);possiblyOccupiedCellKeys.add(cellKey);if(cell.definiteLevels[component.levelIndex])definitelyOccupiedCellKeys.add(cellKey);}
  return{id:component.id,bounds:component.bounds,gridOrigin:{x:hierarchy.bounds.minX,y:hierarchy.bounds.minY},cellStepMm:hierarchy.stepMm,radiusMm:component.radiusMm,errorEnvelopeMm:hierarchy.errorEnvelopeMm,definitelyOccupiedCellKeys,possiblyOccupiedCellKeys,exactWitnessPoints:component.exactWitnessPoints};
}
