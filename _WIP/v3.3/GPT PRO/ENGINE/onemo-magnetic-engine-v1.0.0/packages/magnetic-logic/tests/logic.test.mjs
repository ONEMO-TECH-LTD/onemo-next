import test from 'node:test';
import assert from 'node:assert/strict';
import {
  certifySizeSolution, classifyAxis, completeFulfilmentSpec, createEngineManufacturingSpec, createReferenceProfile,
  LOGIC_ARTIFACT_HASH, registerProfile, selectedOffer, solveOutline, verifyEngineManufacturingSpec
} from '../dist/src/index.js';

const rectangle=(w,h)=>[{x:-w/2,y:-h/2},{x:w/2,y:-h/2},{x:w/2,y:h/2},{x:-w/2,y:h/2}];
const circle=(diameter,segments=64)=>Array.from({length:segments},(_,i)=>{const a=2*Math.PI*i/segments;return{x:Math.cos(a)*diameter/2,y:Math.sin(a)*diameter/2};});

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
  const base=createReferenceProfile();const draft=structuredClone(base);delete draft.profileHash;draft.id='alternate-grid';draft.version=1;draft.grid.cellMm=20;draft.grid.nodeStrideCells=3;draft.grid.populations=[{id:'grid60',strideCells:3,enabled:true,originParities:[[0,0]]}];draft.patterns=draft.patterns.map(pattern=>({...pattern,populationId:'grid60'}));const alternate=registerProfile(draft);assert.equal(alternate.grid.cellMm,20);assert.notEqual(alternate.profileHash,base.profileHash);
});

test('selected B1 size can complete the certified physical pipeline under an explicitly production-ready profile',async()=>{
  const base=createReferenceProfile();const {profileHash:_hash,...raw}=structuredClone(base);raw.id='technical-production-test';raw.productionReady=true;
  const profile=registerProfile(raw);const outline=rectangle(24,24);const preview=await solveOutline({outlineMm:outline,profile});
  assert.match(LOGIC_ARTIFACT_HASH,/^[0-9a-f]{64}$/);
  const certified=certifySizeSolution({outlineMm:outline,profile,targetDominantMm:24});assert.equal(certified.status,'ACCEPTED');assert.equal(certified.decisionProof,'CERTIFIED_CONTINUOUS_OPTIMUM');
  const spec=createEngineManufacturingSpec(preview,certified,profile);assert.equal(spec.proofStatus,'CERTIFIED_CONTINUOUS_OPTIMUM_EXACT_AT_QUANTUM');
  const physical={id:'test-magnet',version:1,magnetDiameterMm:8,magnetThicknessMm:1,cutToleranceMm:0,placementToleranceMm:0,materialToleranceMm:0,assemblyToleranceMm:0,assemblyProfileId:'test-assembly'};
  assert.equal(completeFulfilmentSpec(spec,profile,physical).verificationStatus,'VERIFIED');
});

test('continuous certification reports indeterminate instead of guessing when mechanics cannot be proved',()=>{
  const result=certifySizeSolution({outlineMm:rectangle(72,72),profile:createReferenceProfile(),targetDominantMm:72});
  assert.equal(result.status,'DECISION_INDETERMINATE');
  assert.ok(result.reasons.includes('CRITERION_SCORE_UNCERTAIN'));
});

