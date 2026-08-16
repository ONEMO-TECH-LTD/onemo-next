import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCertifiedBandOffers, certifySizeSolution, classifyAxis, completeFulfilmentSpec, createEngineManufacturingSpec, createReferenceProfile,
  LOGIC_ARTIFACT_HASH, registerProfile, selectedOffer, solveOutline, verifyEngineManufacturingSpec
} from '../dist/src/index.js';

const rectangle=(w,h)=>[{x:-w/2,y:-h/2},{x:w/2,y:-h/2},{x:w/2,y:h/2},{x:-w/2,y:h/2}];
const editableReference=()=>{const profile=structuredClone(createReferenceProfile());delete profile.profileHash;return profile;};
const patternsAtStride=(patterns,stride)=>patterns.map(pattern=>{const [x0,y0]=pattern.cells[0];return{...pattern,cells:pattern.cells.map(([x,y])=>[x0+(x-x0)*stride/2,y0+(y-y0)*stride/2])};});
const boundedB1Profile=maxMm=>{const profile=editableReference();profile.sizeDomain={minMm:24,maxMm,stepMm:12,bands:[{id:'B1',class:1,minMm:24,maxMm,maxInclusive:true,referenceMm:24}],primaryOffer:'SMALLEST_ACCEPTED_PER_BAND'};profile.permissions=profile.permissions.map(permission=>({...permission,bands:['B1']}));return registerProfile(profile);};
const singleRungProfile=()=>{const profile=editableReference();profile.sizeDomain={minMm:48,maxMm:49,stepMm:12,bands:[{id:'B1',class:1,minMm:48,maxMm:49,maxInclusive:true,referenceMm:48}],primaryOffer:'SMALLEST_ACCEPTED_PER_BAND'};profile.permissions=profile.permissions.map(permission=>({...permission,bands:['B1']}));profile.translation={...profile.translation,allowX:false,allowY:false};return registerProfile(profile);};

test('profile is immutable and content-addressed',()=>{
  const profile=createReferenceProfile();assert.ok(profile.profileHash.length===64);assert.equal(Object.isFrozen(profile),true);
  assert.throws(()=>{profile.numeric.coordinateQuantumMm=1;},TypeError);
});

test('band thresholds are lower-inclusive and upper-exclusive except final maximum',()=>{
  const p=createReferenceProfile();assert.equal(classifyAxis(71.99,p.sizeDomain.bands),1);assert.equal(classifyAxis(72,p.sizeDomain.bands),2);assert.equal(classifyAxis(120,p.sizeDomain.bands),3);assert.equal(classifyAxis(264,p.sizeDomain.bands),5);
});

test('solve authority comes only from independently certified rungs',async()=>{
  const result=await solveOutline({outlineMm:rectangle(24,24),profile:singleRungProfile()});
  assert.equal(result.evaluated.length,1);assert.equal(result.offers[0].status,'OFFERED');
  assert.equal(result.offers[0].solution.decisionProof,'CERTIFIED_CONTINUOUS_OPTIMUM');
});

test('an unresolved smaller rung blocks a larger accepted offer',()=>{
  const profile=boundedB1Profile(37);
  const accepted={status:'ACCEPTED',targetDominantMm:36,band:'B1',decisionProof:'CERTIFIED_CONTINUOUS_OPTIMUM'};
  const evaluated=[{status:'DECISION_INDETERMINATE',targetDominantMm:24,band:'B1',reasons:['CRITERION_SCORE_UNCERTAIN']},accepted];
  const offers=buildCertifiedBandOffers(evaluated,profile);
  assert.equal(offers[0].status,'DECISION_INDETERMINATE');
});

test('an indeterminate offer cannot be selected for ManufacturingSpec',()=>{
  const preview={schema:'onemo-magnetic-solve-v1',profileId:'p',profileHash:'h',computeArtifactHash:'c',logicArtifactHash:'l',sourceGeometryHash:'g',canonicalHash:'z',evaluated:[],offers:[{band:'B1',status:'DECISION_INDETERMINATE',reasons:['DECISION_INDETERMINATE']}]};
  assert.throws(()=>selectedOffer(preview,'B1'),/no offered solution/);
});

test('same input and artifact identities produce byte-identical canonical result',async()=>{
  const p=singleRungProfile();const a=await solveOutline({outlineMm:rectangle(24,24),profile:p});const b=await solveOutline({outlineMm:rectangle(24,24),profile:p});assert.equal(a.canonicalHash,b.canonicalHash);assert.deepEqual(a.offers,b.offers);
});

test('engine ManufacturingSpec round-trips and exact re-verifies',async()=>{
  const p=singleRungProfile();const result=await solveOutline({outlineMm:rectangle(24,24),profile:p});const solution=selectedOffer(result,'B1');const spec=createEngineManufacturingSpec(result,solution,p);const verified=verifyEngineManufacturingSpec(spec,p);assert.equal(verified.valid,true);assert.equal(spec.proofStatus,'REFERENCE_PROFILE_NOT_PRODUCTION');
});

test('ManufacturingSpec requires certified reconstructed offer authority',async()=>{
  const profile=singleRungProfile();const result=await solveOutline({outlineMm:rectangle(24,24),profile});const certified=selectedOffer(result,'B1');
  const emptySolve={...result,evaluated:[],offers:[]};
  assert.throws(()=>createEngineManufacturingSpec(emptySolve,{...certified,decisionProof:'DETERMINISTIC_CRITICAL_SET_EXACT_LEGALITY'},profile),/MECHANICAL_OPTIMUM_NOT_CERTIFIED/);
  assert.throws(()=>createEngineManufacturingSpec(emptySolve,certified,profile),/CERTIFIED_OFFER_EVIDENCE_MISSING/);
  assert.throws(()=>createEngineManufacturingSpec(result,{...certified,patternId:'forged'},profile),/CERTIFIED_OFFER_SOLUTION_MISMATCH/);

  const twoRungProfile=boundedB1Profile(37);const later={...certified,targetDominantMm:36};
  const missingSmaller={...result,profileHash:twoRungProfile.profileHash,evaluated:[later],offers:[{band:'B1',status:'OFFERED',solution:later,reasons:[]}]};
  assert.throws(()=>createEngineManufacturingSpec(missingSmaller,later,twoRungProfile),/CERTIFIED_OFFER_EVIDENCE_MISSING/);
});

test('reference profile blocks physical fulfilment until tolerances are supplied',async()=>{
  const p=singleRungProfile();const result=await solveOutline({outlineMm:rectangle(24,24),profile:p});const spec=createEngineManufacturingSpec(result,selectedOffer(result,'B1'),p);
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

test('unresolved sampled component structure propagates as decision indeterminate',()=>{
  const raw=editableReference();
  raw.structural={...raw.structural,sampleStepMm:6,forceLargestComponentMajor:false};
  const result=certifySizeSolution({outlineMm:rectangle(34,34),profile:registerProfile(raw),targetDominantMm:34});
  assert.equal(result.status,'DECISION_INDETERMINATE');
  assert.ok(result.reasons.includes('STRUCTURAL_EVIDENCE_UNCERTAIN'));
  assert.ok(result.reasons.includes('COMPONENT_TOPOLOGY_UNCERTAIN'));
});
