import type { Bounds, ComponentHierarchy, Point, PreparedPolygon, SafeComponent, SafeGridCell } from './contracts.js';
import { clearanceAtPoint } from './clearance.js';

function key(ix:number,iy:number):string{return `${ix},${iy}`;}
function componentId(level:number,index:number):string{return `L${level}:C${index}`;}

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
  const cells:SafeGridCell[]=[]; const indexByKey=new Map<string,number>();
  for(let iy=0;iy<ny;iy++)for(let ix=0;ix<nx;ix++){
    const centre:Point={x:b.minX+(ix+0.5)*stepMm,y:b.minY+(iy+0.5)*stepMm};
    const clearance=clearanceAtPoint(polygon,centre).signedClearanceMm;
    let mask=0;
    for(let level=0;level<ordered.length;level++)if(clearance>=ordered[level]!)mask|=(1<<level);
    if(mask!==0){
      const idx=cells.length;cells.push({ix,iy,centre,clearanceMm:clearance,levelMask:mask});indexByKey.set(key(ix,iy),idx);
    }
  }
  const components:SafeComponent[]=[];
  const componentCellsById=new Map<string,Set<number>>();
  const cellComponentAtLevel:Map<number,string>[]=[];
  for(let level=0;level<ordered.length;level++){
    const assignment=new Map<number,string>(); const visited=new Set<number>(); let sequence=0;
    for(let seed=0;seed<cells.length;seed++){
      const seedCell=cells[seed]!; if((seedCell.levelMask&(1<<level))===0||visited.has(seed))continue;
      const queue=[seed];visited.add(seed);const members:number[]=[];
      while(queue.length){
        const index=queue.shift()!;members.push(index);const c=cells[index]!;
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const){
          const neighbour=indexByKey.get(key(c.ix+dx,c.iy+dy));
          if(neighbour===undefined||visited.has(neighbour))continue;
          if(((cells[neighbour]!.levelMask)&(1<<level))===0)continue;
          visited.add(neighbour);queue.push(neighbour);
        }
      }
      members.sort((a,b2)=>a-b2);const id=componentId(level,sequence++);
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,sumX=0,sumY=0,maxClearance=-Infinity;
      for(const index of members){
        const c=cells[index]!;assignment.set(index,id);sumX+=c.centre.x;sumY+=c.centre.y;maxClearance=Math.max(maxClearance,c.clearanceMm);
        minX=Math.min(minX,c.centre.x-stepMm/2);minY=Math.min(minY,c.centre.y-stepMm/2);maxX=Math.max(maxX,c.centre.x+stepMm/2);maxY=Math.max(maxY,c.centre.y+stepMm/2);
      }
      const bounds:Bounds={minX,minY,maxX,maxY};
      const component:SafeComponent={id,levelIndex:level,radiusMm:ordered[level]!,cellCount:members.length,areaEstimateMm2:members.length*stepMm*stepMm,bounds,centroid:{x:sumX/members.length,y:sumY/members.length},maxClearanceMm:maxClearance,cells:Object.freeze(members),childIds:Object.freeze([]),nearToleranceBoundary:maxClearance-ordered[level]!<=stepMm*Math.SQRT2/2};
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
  const frozen=mutable.map(c=>Object.freeze({...c,childIds:Object.freeze([...c.childIds].sort())}));
  return Object.freeze({bounds:b,stepMm,levelsMm:Object.freeze(ordered),cells:Object.freeze(cells),components:Object.freeze(frozen),errorEnvelopeMm:stepMm*Math.SQRT2/2,exactness:'CERTIFIED_APPROXIMATE'});
}

export function componentToRegionEvidence(hierarchy:ComponentHierarchy,component:SafeComponent):{id:string;bounds:Bounds;gridOrigin:Point;cellStepMm:number;occupiedCellKeys:Set<string>}{
  const occupied=new Set<string>();
  for(const index of component.cells){const cell=hierarchy.cells[index]!;occupied.add(key(cell.ix,cell.iy));}
  return{id:component.id,bounds:component.bounds,gridOrigin:{x:hierarchy.bounds.minX,y:hierarchy.bounds.minY},cellStepMm:hierarchy.stepMm,occupiedCellKeys:occupied};
}
