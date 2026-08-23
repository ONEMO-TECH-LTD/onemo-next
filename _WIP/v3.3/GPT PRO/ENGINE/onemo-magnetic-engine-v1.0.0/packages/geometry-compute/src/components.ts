import { Clipper, EndType, JoinType, PointInPolygonResult, type Path64 } from '@countertype/clipper2-ts';
import type { Bounds, ComponentHierarchy, Point, PreparedPolygon, RegionEvidence, SafeComponent, SafeGridCell } from './contracts.js';
import { clearanceAtPoint } from './clearance.js';

function key(ix:number,iy:number):string{return `${ix},${iy}`;}
function componentId(level:number,index:number):string{return `L${level}:C${index}`;}
function codeUnitCompare(a:string,b:string):number{return a<b?-1:a>b?1:0;}
const HIERARCHY_CACHE_LIMIT=32;
const hierarchyCache=new Map<string,ComponentHierarchy>();
let regionEvidenceCache=new WeakMap<ComponentHierarchy,Map<string,RegionEvidence>>();
let certifiedRegionDataCache=new WeakMap<ComponentHierarchy,Map<string,{readonly cells:readonly number[];readonly witnesses:readonly Point[]}>>();
export function clearComponentHierarchyCache():void{hierarchyCache.clear();regionEvidenceCache=new WeakMap();certifiedRegionDataCache=new WeakMap();}
function rememberHierarchy(key:string,value:ComponentHierarchy):ComponentHierarchy{
  hierarchyCache.delete(key);hierarchyCache.set(key,value);
  if(hierarchyCache.size>HIERARCHY_CACHE_LIMIT)hierarchyCache.delete(hierarchyCache.keys().next().value!);
  return value;
}
interface ErosionPath{readonly path:Path64;readonly areaMm2:number;readonly quantumMm:number;}
function certifiedRoundErosion(polygon:PreparedPolygon,radiusMm:number,toleranceMm:number,side:'INNER'|'OUTER'):readonly ErosionPath[]{
  // Arc sagitta is tolerance/8. Scaling the exact canonical integers by at least
  // 64 leaves the arc plus offset/boolean integer rounding below tolerance/2.
  // Offsetting at r +/- tolerance/2 therefore gives outer(C_r) and an inner
  // approximation satisfying C_(r+tolerance) subset inner subset C_r.
  const subdivisions=Math.max(64,Math.ceil(16*polygon.quantumMm/toleranceMm));
  const quantumMm=polygon.quantumMm/subdivisions;
  const totalErrorMm=toleranceMm/8+4*Math.SQRT2*quantumMm;
  if(totalErrorMm>toleranceMm/2)throw new RangeError('round erosion error budget exceeded');
  const compensatedRadius=side==='INNER'?radiusMm+toleranceMm/2:Math.max(0,radiusMm-toleranceMm/2);
  const canonicalPath=Clipper.trimCollinear(polygon.ringInt.map(({x,y})=>({x:x*subdivisions,y:y*subdivisions})));
  const paths=Clipper.inflatePaths(
    [canonicalPath],
    -compensatedRadius/quantumMm,JoinType.Round,EndType.Polygon,2,toleranceMm/(8*quantumMm)
  );
  return paths.filter(path=>path.length>=3&&Math.abs(Clipper.area(path))>=1).map(path=>({path,areaMm2:Math.abs(Clipper.area(path))*quantumMm*quantumMm,quantumMm}));
}
function pathContains(path:ErosionPath,point:Point):boolean{
  return Clipper.pointInPolygon({x:Math.round(point.x/path.quantumMm),y:Math.round(point.y/path.quantumMm)},path.path)!==PointInPolygonResult.IsOutside;
}
function kernelDiscWitness(polygon:PreparedPolygon,radiusMm:number,toleranceMm:number):Point|undefined{
  let kernel:Point[]=[
    {x:polygon.metrics.bounds.minX,y:polygon.metrics.bounds.minY},
    {x:polygon.metrics.bounds.maxX,y:polygon.metrics.bounds.minY},
    {x:polygon.metrics.bounds.maxX,y:polygon.metrics.bounds.maxY},
    {x:polygon.metrics.bounds.minX,y:polygon.metrics.bounds.maxY},
  ];
  const required=radiusMm+toleranceMm;
  for(const edge of polygon.edges){
    const length=Math.sqrt(edge.lengthSquared);if(length<=0)return undefined;
    const signedDistance=(point:Point)=>((edge.b.x-edge.a.x)*(point.y-edge.a.y)-(edge.b.y-edge.a.y)*(point.x-edge.a.x))/length-required;
    const clipped:Point[]=[];
    for(let index=0;index<kernel.length;index++){
      const start=kernel[index]!,end=kernel[(index+1)%kernel.length]!,a=signedDistance(start),b=signedDistance(end);
      if(a>=0)clipped.push(start);
      if((a>=0)!==(b>=0)){const t=a/(a-b);clipped.push({x:start.x+t*(end.x-start.x),y:start.y+t*(end.y-start.y)});}
    }
    kernel=clipped;if(kernel.length===0)return undefined;
  }
  const candidates=[...kernel,{x:kernel.reduce((sum,point)=>sum+point.x,0)/kernel.length,y:kernel.reduce((sum,point)=>sum+point.y,0)/kernel.length}];
  return candidates.find(candidate=>polygon.edges.every(edge=>{
    const length=Math.sqrt(edge.lengthSquared);
    return ((edge.b.x-edge.a.x)*(candidate.y-edge.a.y)-(edge.b.y-edge.a.y)*(candidate.x-edge.a.x))/length>=required-1e-12;
  }));
}

export function buildComponentHierarchy(
  polygon:PreparedPolygon,
  levelsMm:readonly number[],
  stepMm:number,
  approximationToleranceMm=polygon.quantumMm/4,
  maxSamples=250_000
):ComponentHierarchy{
  if(levelsMm.length===0)throw new TypeError('at least one clearance level is required');
  if(!Number.isFinite(approximationToleranceMm)||approximationToleranceMm<=0)throw new TypeError('approximation tolerance must be positive and finite');
  const ordered=[...levelsMm].sort((a,b)=>a-b);
  for(let i=1;i<ordered.length;i++)if(ordered[i]!<=ordered[i-1]!)throw new TypeError('clearance levels must be strictly increasing');
  const cacheKey=`${polygon.geometryHash}:${ordered.join(',')}:${stepMm}:${approximationToleranceMm}:${maxSamples}`;
  const cached=hierarchyCache.get(cacheKey);if(cached){hierarchyCache.delete(cacheKey);hierarchyCache.set(cacheKey,cached);return cached;}
  const b=polygon.metrics.bounds;
  const nx=Math.max(1,Math.ceil((b.maxX-b.minX)/stepMm));
  const ny=Math.max(1,Math.ceil((b.maxY-b.minY)/stepMm));
  if(nx*ny>maxSamples)throw new RangeError(`component sample budget exceeded: ${nx*ny} > ${maxSamples}`);
  const errorEnvelopeMm=stepMm*Math.SQRT2/2;
  const cells:SafeGridCell[]=[];const gridToCell=new Int32Array(nx*ny);gridToCell.fill(-1);
  for(let iy=0;iy<ny;iy++)for(let ix=0;ix<nx;ix++){
    const centre:Point={x:b.minX+(ix+0.5)*stepMm,y:b.minY+(iy+0.5)*stepMm};
    const clearance=clearanceAtPoint(polygon,centre).signedClearanceMm;
    const possibleLevels=ordered.map(radius=>clearance+errorEnvelopeMm>=radius);
    const definiteLevels=ordered.map(radius=>clearance-errorEnvelopeMm>=radius);
    if(possibleLevels.some(Boolean)){
      const idx=cells.length;cells.push({ix,iy,centre,clearanceMm:clearance,possibleLevels:Object.freeze(possibleLevels),definiteLevels:Object.freeze(definiteLevels)});gridToCell[iy*nx+ix]=idx;
    }
  }
  const neighbourAt=(ix:number,iy:number):number=>ix<0||ix>=nx||iy<0||iy>=ny?-1:gridToCell[iy*nx+ix]!;
  const components:SafeComponent[]=[];
  const componentCellsById=new Map<string,Set<number>>();
  const cellComponentAtLevel:Map<number,string>[]=[];
  const innerCoreById=new Map<string,ErosionPath>();
  const sampledAreaBoundsById=new Map<string,{readonly lower:number;readonly upper:number}>();
  for(let level=0;level<ordered.length;level++){
    const levelStart=components.length;
    const assignment=new Map<number,string>(); const visited=new Set<number>(); let sequence=0;
    for(let seed=0;seed<cells.length;seed++){
      const seedCell=cells[seed]!; if(!seedCell.possibleLevels[level]||visited.has(seed))continue;
      const queue=[seed];let cursor=0;visited.add(seed);const members:number[]=[];
      while(cursor<queue.length){
        const index=queue[cursor++]!;members.push(index);const c=cells[index]!;
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const){
          const neighbour=neighbourAt(c.ix+dx,c.iy+dy);
          if(neighbour<0||visited.has(neighbour))continue;
          if(!cells[neighbour]!.possibleLevels[level])continue;
          visited.add(neighbour);queue.push(neighbour);
        }
      }
      members.sort((a,b2)=>a-b2);const id=componentId(level,sequence++);
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,sumX=0,sumY=0,maxClearance=-Infinity;
      const exactWitnessPoints:Point[]=[];let certifiedMaxClearance=0;
      for(const index of members){
        const c=cells[index]!;assignment.set(index,id);sumX+=c.centre.x;sumY+=c.centre.y;maxClearance=Math.max(maxClearance,c.clearanceMm);
        if(c.clearanceMm>=ordered[level]!-1e-12){exactWitnessPoints.push(c.centre);certifiedMaxClearance=Math.max(certifiedMaxClearance,c.clearanceMm);}
        minX=Math.min(minX,c.centre.x-stepMm/2);minY=Math.min(minY,c.centre.y-stepMm/2);maxX=Math.max(maxX,c.centre.x+stepMm/2);maxY=Math.max(maxY,c.centre.y+stepMm/2);
      }
      const definiteMembers=new Set(members.filter(index=>cells[index]!.definiteLevels[level])),definiteVisited=new Set<number>();let definiteCellCount=0;
      for(const seed of definiteMembers){if(definiteVisited.has(seed))continue;const queue=[seed];let cursor=0,count=0;definiteVisited.add(seed);while(cursor<queue.length){const current=queue[cursor++]!,cell=cells[current]!;count++;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const){const neighbour=neighbourAt(cell.ix+dx,cell.iy+dy);if(neighbour>=0&&definiteMembers.has(neighbour)&&!definiteVisited.has(neighbour)){definiteVisited.add(neighbour);queue.push(neighbour);}}}definiteCellCount=Math.max(definiteCellCount,count);}
      for(const witness of [polygon.metrics.boundsCenter,polygon.metrics.centroid]){
        if(clearanceAtPoint(polygon,witness).signedClearanceMm<ordered[level]!-1e-12)continue;
        const ix=Math.max(0,Math.min(nx-1,Math.floor((witness.x-b.minX)/stepMm))),iy=Math.max(0,Math.min(ny-1,Math.floor((witness.y-b.minY)/stepMm)));
        const witnessIndex=neighbourAt(ix,iy);if(witnessIndex>=0&&members.includes(witnessIndex)&&!exactWitnessPoints.some(p=>Math.abs(p.x-witness.x)<=1e-12&&Math.abs(p.y-witness.y)<=1e-12)){exactWitnessPoints.push(witness);certifiedMaxClearance=Math.max(certifiedMaxClearance,clearanceAtPoint(polygon,witness).signedClearanceMm);}
      }
      exactWitnessPoints.sort((a,b2)=>a.x-b2.x||a.y-b2.y);
      const bounds:Bounds={minX,minY,maxX,maxY};
      const topologyCertified=false;
      const component:SafeComponent={id,levelIndex:level,radiusMm:ordered[level]!,cellCount:members.length,areaEstimateMm2:(definiteCellCount+members.length)*stepMm*stepMm/2,areaBoundsMm2:{lower:definiteCellCount*stepMm*stepMm,upper:members.length*stepMm*stepMm},bounds,centroid:{x:sumX/members.length,y:sumY/members.length},maxClearanceMm:certifiedMaxClearance,maxClearanceBoundsMm:{lower:certifiedMaxClearance,upper:maxClearance+errorEnvelopeMm},cells:Object.freeze(members),childIds:Object.freeze([]),nearToleranceBoundary:!topologyCertified,exactWitnessPoints:Object.freeze(exactWitnessPoints),topologyCertified,appearanceLevelIndex:level,disappearanceLevelIndex:level,persistenceLevelInterval:{lower:exactWitnessPoints.length?1:0,upper:1},persistenceRadiusMm:{lower:exactWitnessPoints.length?ordered[level]!:0,upper:ordered[level]!},touchesAnotherComponentOnlyBelowCurrentRadius:false,perimeterMm:null};
      components.push(component);componentCellsById.set(id,new Set(members));sampledAreaBoundsById.set(id,component.areaBoundsMm2);
    }
    const levelComponents=components.slice(levelStart),innerPaths=level===0?certifiedRoundErosion(polygon,ordered[level]!,approximationToleranceMm,'INNER'):Object.freeze([]);
    const pathCell=(path:ErosionPath):number|undefined=>{
      for(const vertex of path.path){const x=vertex.x*path.quantumMm,y=vertex.y*path.quantumMm,ix=Math.max(0,Math.min(nx-1,Math.floor((x-b.minX)/stepMm))),iy=Math.max(0,Math.min(ny-1,Math.floor((y-b.minY)/stepMm))),index=neighbourAt(ix,iy);if(index>=0&&cells[index]!.possibleLevels[level])return index;}
      return undefined;
    };
    const matches=(component:SafeComponent,path:ErosionPath)=>{const mappedCell=pathCell(path);return mappedCell!==undefined?component.cells.includes(mappedCell):component.exactWitnessPoints.some(point=>pathContains(path,point))||component.cells.some(index=>pathContains(path,cells[index]!.centre));};
    for(let index=0;index<levelComponents.length;index++){
      const component=levelComponents[index]!,matched=levelComponents.length===1?innerPaths:innerPaths.filter(path=>matches(component,path));
      const core=[...matched].sort((a,b2)=>b2.areaMm2-a.areaMm2)[0];
      if(core&&core.areaMm2<=component.areaBoundsMm2.upper+1e-12){innerCoreById.set(component.id,core);components[levelStart+index]={...component,areaEstimateMm2:(core.areaMm2+component.areaBoundsMm2.upper)/2,areaBoundsMm2:{lower:core.areaMm2,upper:component.areaBoundsMm2.upper}};}
    }
    if(level===0&&levelComponents.length){
      const outerPaths=certifiedRoundErosion(polygon,ordered[level]!,approximationToleranceMm,'OUTER');
      if(levelComponents.length===1){
        const component=components[levelStart]!,upper=outerPaths.reduce((sum,path)=>sum+path.areaMm2,0);
        if(component.areaBoundsMm2.lower<=upper+1e-12)components[levelStart]={...component,areaEstimateMm2:(component.areaBoundsMm2.lower+upper)/2,areaBoundsMm2:{lower:component.areaBoundsMm2.lower,upper}};
        else{innerCoreById.delete(component.id);const sampled=sampledAreaBoundsById.get(component.id)!;components[levelStart]={...component,areaEstimateMm2:(sampled.lower+sampled.upper)/2,areaBoundsMm2:sampled};}
      }else{
        const assignments=outerPaths.map(path=>levelComponents.map((component,index)=>matches(component,path)?index:-1).filter(index=>index>=0));
        if(assignments.every(indices=>indices.length===1))for(let index=0;index<levelComponents.length;index++){
          const component=components[levelStart+index]!,upper=outerPaths.reduce((sum,path,pathIndex)=>assignments[pathIndex]![0]===index?sum+path.areaMm2:sum,0);
          if(upper>0&&component.areaBoundsMm2.lower<=upper+1e-12)components[levelStart+index]={...component,areaEstimateMm2:(component.areaBoundsMm2.lower+upper)/2,areaBoundsMm2:{lower:component.areaBoundsMm2.lower,upper}};
          else if(upper>0){innerCoreById.delete(component.id);const sampled=sampledAreaBoundsById.get(component.id)!;components[levelStart+index]={...component,areaEstimateMm2:(sampled.lower+sampled.upper)/2,areaBoundsMm2:sampled};}
        }
      }
    }
    const kernelWitness=kernelDiscWitness(polygon,ordered[level]!,approximationToleranceMm);
    if(levelComponents.length===1&&kernelWitness){
      const component=components[levelStart]!,witnesses=[...component.exactWitnessPoints];
      if(!witnesses.some(point=>Math.abs(point.x-kernelWitness.x)<=1e-12&&Math.abs(point.y-kernelWitness.y)<=1e-12))witnesses.push(kernelWitness);
      witnesses.sort((a,b2)=>a.x-b2.x||a.y-b2.y);
      components[levelStart]={...component,exactWitnessPoints:Object.freeze(witnesses),maxClearanceMm:Math.max(component.maxClearanceMm,clearanceAtPoint(polygon,kernelWitness).signedClearanceMm),topologyCertified:true,nearToleranceBoundary:false};
    }
    cellComponentAtLevel.push(assignment);
  }
  const mutable=components.map(c=>({...c,childIds:[] as string[]}));
  const byId=new Map(mutable.map(c=>[c.id,c]));
  for(const component of mutable){
    if(component.levelIndex===0)continue;
    const parentCounts=new Map<string,number>();const shallower=cellComponentAtLevel[component.levelIndex-1]!;
    for(const cell of component.cells){const parent=shallower.get(cell);if(parent)parentCounts.set(parent,(parentCounts.get(parent)??0)+1);}
    const parent=[...parentCounts.entries()].sort((a,b2)=>b2[1]-a[1]||codeUnitCompare(a[0],b2[0]))[0]?.[0];
    if(parent){(component as typeof component & {parentId:string}).parentId=parent;byId.get(parent)?.childIds.push(component.id);}
  }
  const deepest=(component:typeof mutable[number]):number=>Math.max(component.levelIndex,...component.childIds.map(id=>deepest(byId.get(id)!)));
  const certifiedDepth=(component:typeof mutable[number]):number=>{
    const core=innerCoreById.get(component.id);
    const witnesses=component.exactWitnessPoints.filter(point=>component.topologyCertified||Boolean(core&&pathContains(core,point)));
    if(witnesses.length===0)return component.exactWitnessPoints.length?component.levelIndex:component.levelIndex-1;
    const maxClearance=Math.max(...witnesses.map(point=>clearanceAtPoint(polygon,point).signedClearanceMm));
    let depth=component.levelIndex;while(depth+1<ordered.length&&ordered[depth+1]!<=maxClearance+1e-12)depth++;
    return depth;
  };
  const frozen=mutable.map(c=>{const disappearanceLevelIndex=deepest(c),certifiedDisappearanceLevelIndex=certifiedDepth(c),parent=c.parentId?byId.get(c.parentId):undefined;return Object.freeze({...c,childIds:Object.freeze([...c.childIds].sort()),disappearanceLevelIndex,persistenceLevelInterval:{lower:Math.max(0,certifiedDisappearanceLevelIndex-c.levelIndex+1),upper:disappearanceLevelIndex-c.levelIndex+1},persistenceRadiusMm:{lower:certifiedDisappearanceLevelIndex>=c.levelIndex?ordered[certifiedDisappearanceLevelIndex]!:0,upper:ordered[disappearanceLevelIndex]!},touchesAnotherComponentOnlyBelowCurrentRadius:(parent?.childIds.length??0)>1});});
  const exactness=frozen.every(c=>c.topologyCertified)?'CERTIFIED_APPROXIMATE':'INDETERMINATE';
  const hierarchy=Object.freeze({bounds:b,stepMm,levelsMm:Object.freeze(ordered),cells:Object.freeze(cells),components:Object.freeze(frozen),errorEnvelopeMm,exactness});
  const certifiedRegionData=new Map<string,{readonly cells:readonly number[];readonly witnesses:readonly Point[]}>();
  for(const component of frozen){
    const core=innerCoreById.get(component.id);if(!core)continue;
    const coreCells=component.cells.filter(index=>cells[index]!.definiteLevels[component.levelIndex]&&pathContains(core,cells[index]!.centre));
    const witnesses:Point[]=[];
    for(const vertex of core.path){const point={x:vertex.x*core.quantumMm,y:vertex.y*core.quantumMm};if(clearanceAtPoint(polygon,point).signedClearanceMm>=component.radiusMm-1e-12){witnesses.push(point);break;}}
    certifiedRegionData.set(component.id,{cells:Object.freeze(coreCells),witnesses:Object.freeze(witnesses)});
  }
  certifiedRegionDataCache.set(hierarchy,certifiedRegionData);
  return rememberHierarchy(cacheKey,hierarchy);
}

export function componentToRegionEvidence(hierarchy:ComponentHierarchy,component:SafeComponent):RegionEvidence{
  let cachedById=regionEvidenceCache.get(hierarchy);if(!cachedById){cachedById=new Map();regionEvidenceCache.set(hierarchy,cachedById);}
  const cached=cachedById.get(component.id);if(cached)return cached;
  const definitelyOccupiedCellKeys=new Set<string>(),possiblyOccupiedCellKeys=new Set<string>();
  const certifiedData=certifiedRegionDataCache.get(hierarchy)?.get(component.id);
  const certifiedCells=new Set(component.topologyCertified?component.cells:certifiedData?.cells??[]);
  for(const index of component.cells){const cell=hierarchy.cells[index]!,cellKey=key(cell.ix,cell.iy);possiblyOccupiedCellKeys.add(cellKey);if(certifiedCells.has(index)&&cell.definiteLevels[component.levelIndex])definitelyOccupiedCellKeys.add(cellKey);}
  const evidence={id:component.id,bounds:component.bounds,gridOrigin:{x:hierarchy.bounds.minX,y:hierarchy.bounds.minY},cellStepMm:hierarchy.stepMm,radiusMm:component.radiusMm,errorEnvelopeMm:hierarchy.errorEnvelopeMm,definitelyOccupiedCellKeys,possiblyOccupiedCellKeys,exactWitnessPoints:component.topologyCertified?component.exactWitnessPoints:certifiedData?.witnesses??Object.freeze([])};
  cachedById.set(component.id,evidence);return evidence;
}
