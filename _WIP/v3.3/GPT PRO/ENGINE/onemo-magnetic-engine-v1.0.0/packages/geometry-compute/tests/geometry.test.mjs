import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adaptiveFeasibleTranslations, buildComponentHierarchy, canonicalHash, capMoment, clearCapMomentCache, clearComponentHierarchyCache, clearCriterionCaches, clearProjectionCache, compareCertifiedScores, componentToRegionEvidence, computeGlobalAnchor,
  criticalTranslationCandidates, discContainedExact, finalRegistrationTieBreak, generateLattice, possiblyEquivalentToAnchor,
  evaluateCriterionOnBox, evaluateRegionCriterionOnBoxes, optimizeCriterion, preparePolygon, projectRing, scaleToDominantDimension
} from '../dist/src/index.js';

const q=0.01;
const dumbbell=[{x:-50,y:-30},{x:-10,y:-30},{x:-10,y:-11.9},{x:20,y:-11.9},{x:20,y:-12},{x:44,y:-12},{x:44,y:12},{x:20,y:12},{x:20,y:11.9},{x:-10,y:11.9},{x:-10,y:30},{x:-50,y:30}];

test('closed tangency is legal and one-quantum intrusion is illegal',()=>{
  const p=preparePolygon([{x:-12,y:-12},{x:12,y:-12},{x:12,y:12},{x:-12,y:12}],{quantumMm:q});
  assert.equal(discContainedExact(p,{x:0,y:0},12).legal,true);
  assert.equal(discContainedExact(p,{x:0.01,y:0},12).legal,false);
  assert.equal(discContainedExact(p,{x:0,y:12},0).location,'BOUNDARY');
});

test('non-aligned safety radius rounds upward and cannot approve negative margin',()=>{
  const p=preparePolygon([{x:-12,y:-12},{x:12,y:-12},{x:12,y:12},{x:-12,y:12}],{quantumMm:q});
  const proof=discContainedExact(p,{x:0,y:0},12.004);
  assert.equal(proof.legal,false);
  assert.ok(proof.marginMm<0);
});

test('irregular concave boundary invalidates a centre-inside disc',()=>{
  const p=preparePolygon([{x:-50,y:-50},{x:50,y:-50},{x:50,y:50},{x:10,y:50},{x:10,y:0},{x:-10,y:0},{x:-10,y:50},{x:-50,y:50}],{quantumMm:q});
  const proof=discContainedExact(p,{x:0,y:-10},15);
  assert.equal(proof.location,'INSIDE');
  assert.equal(proof.legal,false);
});

test('canonical polygon hash is independent of winding and starting vertex',()=>{
  const a=preparePolygon([{x:0,y:0},{x:40,y:0},{x:40,y:30},{x:0,y:30}],{quantumMm:q});
  const b=preparePolygon([{x:40,y:30},{x:40,y:0},{x:0,y:0},{x:0,y:30}],{quantumMm:q});
  assert.equal(a.geometryHash,b.geometryHash);
});

test('accelerated validation preserves high-vertex geometry and rejects distant crossings',()=>{
  const ring=Array.from({length:1024},(_,index)=>{const angle=2*Math.PI*index/1024;return{x:100*Math.cos(angle),y:100*Math.sin(angle)};});
  const polygon=preparePolygon(ring,{quantumMm:q,maxVertices:4096});
  assert.equal(polygon.ringInt.length,1024);
  assert.equal(discContainedExact(polygon,{x:0,y:0},99).legal,true);
  assert.throws(()=>preparePolygon([{x:-10,y:-10},{x:10,y:10},{x:-10,y:10},{x:10,y:-10}],{quantumMm:q}),/simple polygon/);
});

test('adaptive translation preserves continuous vertical pair feasibility',()=>{
  const p=preparePolygon([{x:-20,y:-50},{x:20,y:-50},{x:20,y:50},{x:-20,y:50}],{quantumMm:q});
  const set=adaptiveFeasibleTranslations(p,[{x:0,y:-24},{x:0,y:24}],12,{minX:-24,minY:-24,maxX:24,maxY:24},{toleranceMm:0.05,maxCells:20000,quantumMm:q});
  assert.equal(set.status,'FEASIBLE');
  assert.equal(set.exactness,'EXACT');assert.equal(set.cellsVisited,1);
  assert.deepEqual(set.insideBoxes.map(({minX,minY,maxX,maxY})=>({minX,minY,maxX,maxY})),[{minX:-8,minY:-14,maxX:8,maxY:14}]);
  assert.ok(set.witnessPoints.some(point=>Math.abs(point.x)<q&&Math.abs(point.y)<q));
});

test('axis-aligned mechanics use exact closed-form optimum restrictions',()=>{
  const polygon=preparePolygon([{x:-50,y:-50},{x:50,y:-50},{x:50,y:50},{x:-50,y:50}],{quantumMm:q});
  const boxes=[{minX:-10,minY:-10,maxX:10,maxY:10,depth:0,status:'INSIDE',id:'domain'}];
  const options={toleranceMm:.01,maxCells:20000,quantumMm:q};
  const cap=optimizeCriterion(polygon,[{x:0,y:0}],0,boxes,{id:'CAP_FIRST_MOMENT_V1',direction:{x:0,y:1}},[100],options);
  assert.equal(cap.status,'CERTIFIED');assert.equal(cap.refinements,0);assert.deepEqual(cap.optimum,{lower:80000,upper:80000});
  const overhang=optimizeCriterion(polygon,[{x:0,y:0}],0,boxes,{id:'MAX_DIRECTIONAL_OVERHANG_V1',directions:[{x:0,y:1},{x:0,y:-1},{x:1,y:0},{x:-1,y:0}]},[q],options);
  assert.equal(overhang.status,'CERTIFIED');assert.equal(overhang.refinements,0);assert.deepEqual(overhang.optimum,{lower:50,upper:50});
  const balance=optimizeCriterion(polygon,[{x:0,y:0}],0,boxes,{id:'ANCHOR_CENTROID_BALANCE_V1',materialCentroid:{x:0,y:0},lateralDirection:{x:1,y:0}},[q,2.01],options);
  assert.deepEqual(balance.optimum,{components:[{lower:0,upper:0},{lower:0,upper:0}]});
});

test('cap-moment measurement cache evicts deterministically and clears without changing results',()=>{
  const ring=[{x:-20,y:-20},{x:20,y:-20},{x:20,y:20},{x:-20,y:20}];clearCapMomentCache();
  const first=capMoment(ring,{x:0,y:1},0),warm=capMoment(ring,{x:0,y:1},0);assert.equal(warm,first);
  for(let threshold=1;threshold<=512;threshold++)capMoment(ring,{x:0,y:1},threshold);
  const evicted=capMoment(ring,{x:0,y:1},0);assert.notEqual(evicted,first);assert.deepEqual(evicted,first);
  clearCapMomentCache();const rebuilt=capMoment(ring,{x:0,y:1},0);assert.notEqual(rebuilt,evicted);assert.deepEqual(rebuilt,first);
});

test('projection measurement cache evicts deterministically and clears without changing results',()=>{
  const ring=[{x:-20,y:-20},{x:20,y:-20},{x:20,y:20},{x:-20,y:20}];clearProjectionCache();
  const first=projectRing(ring,{x:1,y:0}),warm=projectRing(ring,{x:1,y:0});assert.equal(warm,first);
  for(let index=1;index<=512;index++)projectRing(ring,{x:1,y:index/1000});
  const evicted=projectRing(ring,{x:1,y:0});assert.notEqual(evicted,first);assert.deepEqual(evicted,first);
  clearProjectionCache();const rebuilt=projectRing(ring,{x:1,y:0});assert.notEqual(rebuilt,evicted);assert.deepEqual(rebuilt,first);
});

test('multi-clearance hierarchy removes narrow branches before broad mass',()=>{
  const p=preparePolygon([{x:-40,y:-30},{x:40,y:-30},{x:40,y:30},{x:8,y:30},{x:8,y:70},{x:-8,y:70},{x:-8,y:30},{x:-40,y:30}],{quantumMm:q});
  const hierarchy=buildComponentHierarchy(p,[12,16,20],2);
  assert.ok(hierarchy.components.some(c=>c.levelIndex===0));
  assert.ok(hierarchy.components.filter(c=>c.levelIndex===2).length<=hierarchy.components.filter(c=>c.levelIndex===0).length);
});

test('component hierarchy cache is bounded intermediate evidence and explicitly clearable',()=>{
  const p=preparePolygon(dumbbell,{quantumMm:q});clearComponentHierarchyCache();
  const first=buildComponentHierarchy(p,[12,16,20],2),warm=buildComponentHierarchy(p,[12,16,20],2);
  assert.equal(warm,first);
  clearComponentHierarchyCache();const rebuilt=buildComponentHierarchy(p,[12,16,20],2);
  assert.notEqual(rebuilt,first);assert.deepEqual(rebuilt,first);
});

test('lower-dimensional safe point remains explicit in the component hierarchy',()=>{
  const p=preparePolygon([{x:-12,y:-12},{x:12,y:-12},{x:12,y:12},{x:-12,y:12}],{quantumMm:q});
  const hierarchy=buildComponentHierarchy(p,[12],6);
  assert.equal(hierarchy.components.length,1);
  const component=hierarchy.components[0];
  assert.ok(component.exactWitnessPoints.some(point=>point.x===0&&point.y===0));
  assert.deepEqual(component.areaBoundsMm2,{lower:0,upper:144});
  assert.deepEqual(component.persistenceLevelInterval,{lower:1,upper:1});
  assert.equal(hierarchy.exactness,'INDETERMINATE');
  assert.equal(component.perimeterMm,null);
});

test('possibly occupied sampling cells cannot fabricate exact region membership',()=>{
  const p=preparePolygon([{x:-17,y:-17},{x:17,y:-17},{x:17,y:17},{x:-17,y:17}],{quantumMm:q});
  const hierarchy=buildComponentHierarchy(p,[12],6);
  const region=componentToRegionEvidence(hierarchy,hierarchy.components[0]);
  assert.equal(discContainedExact(p,{x:6,y:0},12).legal,false);
  const result=evaluateCriterionOnBox(p,[{x:0,y:0}],{minX:6,minY:0,maxX:6,maxY:0,depth:0,status:'BOUNDARY',id:'probe'},{id:'REGION_COVERAGE_V1',regions:[region]});
  assert.deepEqual(result.score,{components:[{lower:0,upper:1},{lower:0,upper:1}]});
  assert.equal(result.exactness,'CERTIFIED_APPROXIMATE');
});

test('criterion cache keys equivalent region and offset arrays by stable content',()=>{
  const p=preparePolygon([{x:-17,y:-17},{x:17,y:-17},{x:17,y:17},{x:-17,y:17}],{quantumMm:q});
  const hierarchy=buildComponentHierarchy(p,[12],6),region=componentToRegionEvidence(hierarchy,hierarchy.components[0]);
  const box={minX:0,minY:0,maxX:0,maxY:0,depth:0,status:'INSIDE',id:'stable-cache-key'};clearCriterionCaches();
  const first=evaluateCriterionOnBox(p,[{x:0,y:0}],box,{id:'REGION_COVERAGE_V1',regions:[region]});
  const equivalent=evaluateCriterionOnBox(p,[{x:0,y:0}],box,{id:'REGION_COVERAGE_V1',regions:[region]});assert.equal(equivalent,first);
  clearCriterionCaches();const rebuilt=evaluateCriterionOnBox(p,[{x:0,y:0}],box,{id:'REGION_COVERAGE_V1',regions:[region]});assert.notEqual(rebuilt,first);assert.deepEqual(rebuilt,first);
});

test('batched region measurements preserve scalar order and evict and clear deterministically',()=>{
  const p=preparePolygon([{x:-17,y:-17},{x:17,y:-17},{x:17,y:17},{x:-17,y:17}],{quantumMm:q});
  const hierarchy=buildComponentHierarchy(p,[12],6),region=componentToRegionEvidence(hierarchy,hierarchy.components[0]);
  const offsets=Object.freeze([{x:0,y:0}]),boxes=Object.freeze([
    {minX:0,minY:0,maxX:0,maxY:0,depth:0,status:'INSIDE',id:'batch-a'},
    {minX:6,minY:0,maxX:6,maxY:0,depth:0,status:'BOUNDARY',id:'batch-b'}
  ]),descriptor={id:'REGION_COVERAGE_V1',regions:[region]};clearCriterionCaches();
  const scalar=boxes.map(box=>evaluateCriterionOnBox(p,offsets,box,descriptor));
  const first=evaluateRegionCriterionOnBoxes(p,offsets,boxes,descriptor);assert.deepEqual(first,scalar);
  assert.equal(evaluateRegionCriterionOnBoxes(p,offsets,boxes,descriptor),first);
  for(let index=0;index<512;index++)evaluateRegionCriterionOnBoxes(p,offsets,Object.freeze([...boxes]),descriptor);
  const evicted=evaluateRegionCriterionOnBoxes(p,offsets,boxes,descriptor);assert.notEqual(evicted,first);assert.deepEqual(evicted,first);
  clearCriterionCaches();const rebuilt=evaluateRegionCriterionOnBoxes(p,offsets,boxes,descriptor);assert.notEqual(rebuilt,evicted);assert.deepEqual(rebuilt,first);
});

test('possible-cell bridge cannot certify two exact safe components as one',()=>{
  const p=preparePolygon(dumbbell,{quantumMm:q});
  assert.equal(discContainedExact(p,{x:32,y:0},12).legal,true);
  const hierarchy=buildComponentHierarchy(p,[12],6);
  assert.equal(hierarchy.components.length,1);
  assert.equal(hierarchy.components[0].exactWitnessPoints.some(point=>point.x===32&&point.y===0),false);
  assert.equal(hierarchy.components[0].topologyCertified,false);
  assert.equal(hierarchy.exactness,'INDETERMINATE');
});

test('per-level occupancy does not alias after 32 clearance levels',()=>{
  const p=preparePolygon([{x:-20,y:-20},{x:20,y:-20},{x:20,y:20},{x:-20,y:20}],{quantumMm:q});
  const hierarchy=buildComponentHierarchy(p,Array.from({length:33},(_,index)=>12+index),5);
  assert.equal(hierarchy.components.some(component=>component.levelIndex===32),false);
  assert.equal(hierarchy.cells.every(cell=>cell.possibleLevels.length===33&&cell.definiteLevels.length===33),true);
});

test('neutral lattice is deterministic',()=>{
  const points=generateLattice({x:0,y:0},{x:24,y:0},{x:0,y:24},{minI:-1,maxI:1,minJ:-1,maxJ:1});
  assert.equal(points.length,9);assert.deepEqual(points[0],{i:-1,j:-1,x:-24,y:-24});assert.deepEqual(points[8],{i:1,j:1,x:24,y:24});
});

test('critical witness generation finds canonical and directional extrema',()=>{
  const p=preparePolygon([{x:-36,y:-36},{x:36,y:-36},{x:36,y:36},{x:-36,y:36}],{quantumMm:q});
  const points=criticalTranslationCandidates(p,[{x:0,y:0}],12,{minX:-24,minY:-24,maxX:24,maxY:24},{gridDivisions:2});
  assert.ok(points.some(x=>x.x===0&&x.y===0));
  assert.ok(points.some(x=>x.y>=23.99));
});

test('dominance-safe interval handling retains overlapping legal contender',()=>{
  const anchor=computeGlobalAnchor([{lower:10,upper:10},{lower:9,upper:11}],['MIN'],[0]);
  assert.equal(possiblyEquivalentToAnchor({lower:9,upper:11},anchor,['MIN'],[0]),true);
});

test('global-anchor restriction excludes locally tolerated but globally inferior score',()=>{
  const global={lower:0,upper:0};
  assert.equal(possiblyEquivalentToAnchor({lower:1.9,upper:1.9},global,['MIN'],[1]),false);
  assert.equal(possiblyEquivalentToAnchor({lower:0.9,upper:0.9},global,['MIN'],[1]),true);
});

test('compound anchor cannot advance while an earlier component is uncertain',()=>{
  const a={components:[{lower:0,upper:0},{lower:100,upper:100}]};
  const b={components:[{lower:0.5,upper:1.5},{lower:0,upper:0}]};
  const anchor=computeGlobalAnchor([a,b],['MIN','MIN'],[1,1]);
  assert.deepEqual(anchor,{components:[{lower:0,upper:0},{lower:100,upper:100}]});
  assert.equal(possiblyEquivalentToAnchor(a,anchor,['MIN','MIN'],[1,1]),true);
  assert.equal(possiblyEquivalentToAnchor(b,anchor,['MIN','MIN'],[1,1]),true);
});

test('candidate equivalence is symmetric and cannot use a later compound component',()=>{
  const uncertain={components:[{lower:0.5,upper:1.5},{lower:0,upper:0}]};
  const exact={components:[{lower:0,upper:0},{lower:100,upper:100}]};
  assert.equal(compareCertifiedScores(exact,uncertain,['MIN','MIN'],[1,1]),null);
  assert.equal(compareCertifiedScores(
    {components:[{lower:0,upper:0},{lower:100,upper:100}]},
    {components:[{lower:10,upper:10},{lower:0,upper:0}]},
    ['MIN','MIN'],[1,1]
  ),-1);
});

test('final tie-break searches the representable optimum set beyond five samples',()=>{
  const polygon=preparePolygon([{x:-11.75,y:-12},{x:12.25,y:-12},{x:12.25,y:12},{x:-11.75,y:12}],{quantumMm:q});
  const result=finalRegistrationTieBreak(polygon,[{x:0,y:0}],12,[{minX:-1,minY:-1,maxX:1,maxY:1,depth:0,status:'BOUNDARY',id:'probe'}],{x:0,y:0},q);
  assert.equal(result.status,'SELECTED');
  assert.deepEqual(result.point,{x:0.25,y:0});
  assert.ok(result.attemptedPoints>5);
});

test('canonical hash is stable',()=>{assert.equal(canonicalHash({b:2,a:1}),canonicalHash({a:1,b:2}));});

test('Compute artifact identity is a generated executable digest',async()=>{
  const engine=await import('../dist/src/index.js');
  assert.match(engine.COMPUTE_ARTIFACT_HASH,/^[0-9a-f]{64}$/);
  assert.notEqual(engine.COMPUTE_ARTIFACT_HASH,'UNBUILT');
  assert.equal(engine.preparePolygon([{x:0,y:0},{x:10,y:0},{x:0,y:10}],{quantumMm:q}).artifactHash,engine.COMPUTE_ARTIFACT_HASH);
});
