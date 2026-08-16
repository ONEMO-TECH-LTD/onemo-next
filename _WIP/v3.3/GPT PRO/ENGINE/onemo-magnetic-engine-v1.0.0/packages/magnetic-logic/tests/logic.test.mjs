import test from 'node:test';
import assert from 'node:assert/strict';
import {
  certifySizeSolution, classifyAxis, completeFulfilmentSpec, createEngineManufacturingSpec, createReferenceProfile,
  LOGIC_ARTIFACT_HASH, registerProfile, selectedOffer, solveOutline, verifyEngineManufacturingSpec
} from '../dist/src/index.js';

const rectangle=(w,h)=>[{x:-w/2,y:-h/2},{x:w/2,y:-h/2},{x:w/2,y:h/2},{x:-w/2,y:h/2}];
const circle=(diameter,segments=64)=>Array.from({length:segments},(_,i)=>{const a=2*Math.PI*i/segments;return{x:Math.cos(a)*diameter/2,y:Math.sin(a)*diameter/2};});
const editableReference=()=>{const profile=structuredClone(createReferenceProfile());delete profile.profileHash;return profile;};
const patternsAtStride=(patterns,stride)=>patterns.map(pattern=>{const [x0,y0]=pattern.cells[0];return{...pattern,cells:pattern.cells.map(([x,y])=>[x0+(x-x0)*stride/2,y0+(y-y0)*stride/2])};});

test('profile is immutable and content-addressed',()=>{
  const profile=createReferenceProfile();assert.ok(profile.profileHash.length===64);assert.equal(Object.isFrozen(profile),true);
  assert.throws(()=>{profile.numeric.coordinateQuantumMm=1;},TypeError);
});

test('band thresholds are lower-inclusive and upper-exclusive except final maximum',()=>{
  const p=createReferenceProfile();assert.equal(classifyAxis(71.99,p.sizeDomain.bands),1);assert.equal(classifyAxis(72,p.sizeDomain.bands),2);assert.equal(classifyAxis(120,p.sizeDomain.bands),3);assert.equal(classifyAxis(264,p.sizeDomain.bands),5);
});

test('square produces one deterministic primary offer per band',async()=>{
  const p=createReferenceProfile();const result=await solveOutline({outlineMm:rectangle(120,120),profile:p});
  assert.deepEqual(result.offers.map(o=>o.status),['OFFERED','OFFERED','OFFERED','OFFERED','OFFERED']);
  assert.equal(result.offers[0].solution.patternId,'single');assert.equal(result.offers[2].solution.patternId,'t.top1-bottom3');
});

test('long rectangles select the lawful pair orientation',async()=>{
  const p=createReferenceProfile();const tall=await solveOutline({outlineMm:rectangle(36,72),profile:p});const wide=await solveOutline({outlineMm:rectangle(72,36),profile:p});
  assert.equal(tall.offers.find(o=>o.band==='B2')?.solution?.patternId,'pair.vertical');
  assert.equal(wide.offers.find(o=>o.band==='B2')?.solution?.patternId,'pair.horizontal');
});

test('rounded shape does not assume square-corner occupancy',async()=>{
  const p=createReferenceProfile();const result=await solveOutline({outlineMm:circle(72),profile:p});const b2=result.offers.find(o=>o.band==='B2')?.solution;
  assert.ok(b2);assert.notEqual(b2.patternId,'square.4');
});

test('same input and artifact identities produce byte-identical canonical result',async()=>{
  const p=createReferenceProfile();const a=await solveOutline({outlineMm:rectangle(72,36),profile:p});const b=await solveOutline({outlineMm:rectangle(72,36),profile:p});assert.equal(a.canonicalHash,b.canonicalHash);assert.deepEqual(a.offers,b.offers);
});

test('engine ManufacturingSpec round-trips and exact re-verifies',async()=>{
  const p=createReferenceProfile();const result=await solveOutline({outlineMm:rectangle(120,120),profile:p});const solution=selectedOffer(result,'B3');const spec=createEngineManufacturingSpec(result,solution,p);const verified=verifyEngineManufacturingSpec(spec,p);assert.equal(verified.valid,true);assert.equal(spec.proofStatus,'REFERENCE_PROFILE_NOT_PRODUCTION');
});

test('reference profile blocks physical fulfilment until tolerances are supplied',async()=>{
  const p=createReferenceProfile();const result=await solveOutline({outlineMm:rectangle(120,120),profile:p});const spec=createEngineManufacturingSpec(result,selectedOffer(result,'B3'),p);
  assert.throws(()=>completeFulfilmentSpec(spec,p,{id:'demo',version:1,magnetDiameterMm:8,magnetThicknessMm:1,cutToleranceMm:0,placementToleranceMm:0,materialToleranceMm:0,assemblyToleranceMm:0,assemblyProfileId:'demo'}),/REFERENCE_PROFILE_NOT_PRODUCTION/);
});

test('alternate calibrated values reuse the same Compute engine',()=>{
  const base=createReferenceProfile();const draft=structuredClone(base);delete draft.profileHash;draft.id='alternate-grid';draft.version=1;draft.grid.cellMm=20;draft.grid.nodeStrideCells=3;draft.grid.populations=[{id:'grid60',strideCells:3,enabled:true,originParities:[[0,0]]}];draft.patterns=patternsAtStride(draft.patterns,3).map(pattern=>({...pattern,populationId:'grid60'}));const alternate=registerProfile(draft);assert.equal(alternate.grid.cellMm,20);assert.notEqual(alternate.profileHash,base.profileHash);
});

test('solve revalidates a supplied registered-profile hash',async()=>{
  const profile=structuredClone(createReferenceProfile());
  profile.grid.cellMm=20;
  await assert.rejects(()=>solveOutline({outlineMm:rectangle(72,36),profile}),/profile hash mismatch/);
});

test('selected-size certification revalidates a supplied registered-profile hash',()=>{
  const profile=structuredClone(createReferenceProfile());
  profile.grid.cellMm=20;
  assert.throws(()=>certifySizeSolution({outlineMm:rectangle(24,24),profile,targetDominantMm:24}),/profile hash mismatch/);
});

test('profile registration rejects non-executable domains and policies',async(t)=>{
  const cases=[
    ['zero size step',profile=>{profile.sizeDomain.stepMm=0;}],
    ['non-finite translation period',profile=>{profile.translation.periodMm=Infinity;}],
    ['unordered clearance levels',profile=>{profile.structural.clearanceSurplusLevelsMm=[0,8,4];}],
    ['population parity remains binary at stride 3',profile=>{profile.grid.populations[0].strideCells=3;profile.grid.populations[0].originParities=[[2,0]];profile.patterns=patternsAtStride(profile.patterns,3);}],
    ['duplicate population id',profile=>{profile.grid.populations.push(structuredClone(profile.grid.populations[0]));}],
    ['off-population pattern coordinates',profile=>{profile.patterns[0].cells=[[0,0],[1,0]];}],
    ['incomplete mechanics registry',profile=>{profile.mechanics.criteria=profile.mechanics.criteria.slice(0,-1);}],
    ['non-finite mechanics tolerance',profile=>{profile.mechanics.criteria[0].tolerances=[NaN,0];}],
    ['unresolved production assumptions',profile=>{profile.productionReady=true;}]
  ];
  for(const [name,mutate] of cases){
    await t.test(name,()=>{const profile=editableReference();mutate(profile);assert.throws(()=>registerProfile(profile),/invalid profile/);});
  }
});

test('reference profile cannot be promoted to production while product inputs remain unresolved',()=>{
  const raw=editableReference();raw.id='technical-production-test';raw.productionReady=true;
  assert.throws(()=>registerProfile(raw),/unresolved production assumptions/);
});

test('productionReady remains closed until later R3 authority groups are implemented',()=>{
  const profile=editableReference();profile.productionReady=true;profile.engineeringAssumptions=[];profile.provenance={ONLY:'one unscoped note'};
  assert.throws(()=>registerProfile(profile),/production profile incomplete R3 authority/);
});

test('patterns use their population stride rather than a hard-coded parity',()=>{
  const invalid=editableReference();invalid.grid.nodeStrideCells=3;invalid.grid.populations[0].strideCells=3;
  assert.throws(()=>registerProfile(invalid),/population stride/);

  const valid=editableReference();valid.grid.nodeStrideCells=3;valid.grid.populations[0].strideCells=3;
  valid.patterns=patternsAtStride(valid.patterns,3);
  assert.doesNotThrow(()=>registerProfile(valid));
});

test('continuous certification reports indeterminate instead of guessing when mechanics cannot be proved',()=>{
  const result=certifySizeSolution({outlineMm:rectangle(72,72),profile:createReferenceProfile(),targetDominantMm:72});
  assert.equal(result.status,'DECISION_INDETERMINATE');
  assert.ok(result.reasons.includes('CRITERION_SCORE_UNCERTAIN'));
});
