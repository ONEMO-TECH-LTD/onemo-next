import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptStudioOutline } from '../dist/src/outline-adapter.js';
import { parseManufacturingSpec, serializeManufacturingSpec } from '../dist/src/persistence.js';
import { verifyOnServer } from '../dist/src/server-verifier.js';
import { solutionViewModels } from '../dist/src/solution-view-model.js';
import { certifyAndBindSelectedBand } from '../dist/src/certification.js';
import * as next from '../dist/src/index.js';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import { createReferenceProfile, currentManufacturingVerificationResolver, registerProfile, solveOutline } from '@onemo/magnetic-logic';

const rectangle=(w,h,dx=0,dy=0)=>[{x:-w/2+dx,y:-h/2+dy},{x:w/2+dx,y:-h/2+dy},{x:w/2+dx,y:h/2+dy},{x:-w/2+dx,y:h/2+dy}];
const singleRungProfile=()=>{const profile=structuredClone(createReferenceProfile());delete profile.profileHash;profile.sizeDomain={minMm:48,maxMm:49,stepMm:12,bands:[{id:'B1',class:1,minMm:48,maxMm:49,maxInclusive:true,referenceMm:48}],primaryOffer:'SMALLEST_ACCEPTED_PER_BAND'};profile.permissions=profile.permissions.map(permission=>({...permission,bands:['B1'],allowedAxisClassPairs:[[1,1]]}));profile.translation={...profile.translation,allowX:false,allowY:false};return registerProfile(profile);};

test('studio adapter flips canvas Y and centres bounds',()=>{
  const adapted=adaptStudioOutline([{x:0,y:0},{x:10,y:0},{x:10,y:20},{x:0,y:20}],{inputYAxis:'DOWN',centreOnBounds:true});
  assert.deepEqual(adapted,[{x:-5,y:10},{x:5,y:10},{x:5,y:-10},{x:-5,y:-10}]);
});

test('ManufacturingSpec transport parser rejects wrong schema',()=>{assert.throws(()=>parseManufacturingSpec('{"schema":"wrong"}'));});

test('solution view model preserves band status',()=>{
  const models=solutionViewModels({schema:'onemo-magnetic-solve-v1',profileId:'p',profileHash:'h',computeArtifactHash:'c',logicArtifactHash:'l',sourceGeometryHash:'g',evaluated:[],offers:[{band:'B1',status:'NO_SOLUTION',reasons:['x']}],canonicalHash:'z'});
  assert.equal(models[0].status,'NO_SOLUTION');assert.deepEqual(models[0].reasons,['x']);
});

test('loader memoises the real Logic module',async()=>{
  next.resetMagneticEngineLoaderForTests();const first=next.loadMagneticEngine(),second=next.loadMagneticEngine();
  assert.equal(first,second);assert.equal(typeof (await first).solveOutline,'function');
});

test('overlay renders the exact quantized final ring instead of its bounding rectangle',async()=>{
  const profile=singleRungProfile();const solve=await solveOutline({outlineMm:rectangle(24,24),profile});const solution=solve.offers[0].solution;
  const markup=renderToStaticMarkup(createElement(next.ShapeSolutionOverlay,{solution,coordinateQuantumMm:profile.numeric.coordinateQuantumMm}));
  const points=solution.finalRingInt.map(([x,y])=>`${x*profile.numeric.coordinateQuantumMm},${-y*profile.numeric.coordinateQuantumMm}`).join(' ');
  assert.match(markup,new RegExp(`data-final-geometry-hash="${solution.geometryHash}"`));assert.ok(markup.includes(`points="${points}"`));assert.equal(markup.includes('<rect'),false);
});

test('selection certification rejects heuristic authority and missing smaller-rung proof',()=>{
  const profile=createReferenceProfile();
  const heuristic={targetDominantMm:36,band:'B1',decisionProof:'DETERMINISTIC_CRITICAL_SET_EXACT_LEGALITY'};
  const base={schema:'onemo-magnetic-solve-v1',profileId:profile.id,profileHash:profile.profileHash,computeArtifactHash:'c',logicArtifactHash:'l',sourceGeometryHash:'g',canonicalHash:'z'};
  assert.throws(()=>certifyAndBindSelectedBand({...base,evaluated:[heuristic],offers:[{band:'B1',status:'OFFERED',solution:heuristic,reasons:[]}]},'B1',[],profile),/SELECTED_OFFER_NOT_CERTIFIED/);
  const certified={...heuristic,status:'ACCEPTED',decisionProof:'CERTIFIED_CONTINUOUS_OPTIMUM'};
  assert.throws(()=>certifyAndBindSelectedBand({...base,evaluated:[certified],offers:[{band:'B1',status:'OFFERED',solution:certified,reasons:[]}]},'B1',[],profile),/SMALLEST_ACCEPTED_RUNG_NOT_CERTIFIED/);
});

test('certification preserves one canonical source identity and is the only public binder',async()=>{
  const profile=singleRungProfile();const preview=await solveOutline({outlineMm:rectangle(24,24),profile});
  assert.equal(next.bindSelectedBand,undefined);
  assert.throws(()=>certifyAndBindSelectedBand(preview,'B1',rectangle(24,24,100,100),profile,{inputYAxis:'UP',centreOnBounds:false}),/SOURCE_GEOMETRY_MISMATCH/);
  const bound=certifyAndBindSelectedBand(preview,'B1',rectangle(24,24),profile,{inputYAxis:'UP',centreOnBounds:false});
  assert.equal(bound.manufacturingSpec.sourceGeometryHash,preview.sourceGeometryHash);
  assert.equal(verifyOnServer(bound.manufacturingSpec,currentManufacturingVerificationResolver(profile)).valid,true);
  const serialized=serializeManufacturingSpec(bound.manufacturingSpec);assert.equal(parseManufacturingSpec(serialized).canonicalHash,bound.manufacturingSpec.canonicalHash);
  const tampered=JSON.parse(serialized);tampered.frameId='forged';assert.throws(()=>parseManufacturingSpec(JSON.stringify(tampered)),/CANONICAL_HASH_MISMATCH/);
});
