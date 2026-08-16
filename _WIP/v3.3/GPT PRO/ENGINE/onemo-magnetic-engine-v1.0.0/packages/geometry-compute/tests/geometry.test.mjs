import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adaptiveFeasibleTranslations, buildComponentHierarchy, canonicalHash, compareCertifiedScores, computeGlobalAnchor,
  criticalTranslationCandidates, discContainedExact, finalRegistrationTieBreak, generateLattice, possiblyEquivalentToAnchor,
  preparePolygon, scaleToDominantDimension
} from '../dist/src/index.js';

const q=0.01;

test('closed tangency is legal and one-quantum intrusion is illegal',()=>{
  const p=preparePolygon([{x:-12,y:-12},{x:12,y:-12},{x:12,y:12},{x:-12,y:12}],{quantumMm:q});
  assert.equal(discContainedExact(p,{x:0,y:0},12).legal,true);
  assert.equal(discContainedExact(p,{x:0.01,y:0},12).legal,false);
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

test('adaptive translation preserves continuous vertical pair feasibility',()=>{
  const p=preparePolygon([{x:-20,y:-50},{x:20,y:-50},{x:20,y:50},{x:-20,y:50}],{quantumMm:q});
  const set=adaptiveFeasibleTranslations(p,[{x:0,y:-24},{x:0,y:24}],12,{minX:-24,minY:-24,maxX:24,maxY:24},{toleranceMm:0.05,maxCells:20000,quantumMm:q});
  assert.equal(set.status,'FEASIBLE');
  assert.ok(set.witnessPoints.some(point=>Math.abs(point.x)<q&&Math.abs(point.y)<q));
});

test('multi-clearance hierarchy removes narrow branches before broad mass',()=>{
  const p=preparePolygon([{x:-40,y:-30},{x:40,y:-30},{x:40,y:30},{x:8,y:30},{x:8,y:70},{x:-8,y:70},{x:-8,y:30},{x:-40,y:30}],{quantumMm:q});
  const hierarchy=buildComponentHierarchy(p,[12,16,20],2);
  assert.ok(hierarchy.components.some(c=>c.levelIndex===0));
  assert.ok(hierarchy.components.filter(c=>c.levelIndex===2).length<=hierarchy.components.filter(c=>c.levelIndex===0).length);
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
