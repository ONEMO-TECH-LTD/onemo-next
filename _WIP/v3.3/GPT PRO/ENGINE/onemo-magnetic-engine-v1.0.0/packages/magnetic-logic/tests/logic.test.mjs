import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCertifiedBandOffers, buildEngineManufacturingPayload, buildStructuralEvidence, certifySizeSolution, classifyAxis, clearSolverCaches, completeFulfilmentSpec, createEngineManufacturingSpec, createReferenceProfile,
  criterionDescriptor, currentManufacturingVerificationResolver, LOGIC_ARTIFACT_HASH, permittedPatterns, ProfileRegistry, registerProfile, selectedOffer,
  selectDiscreteIdentity, solveOutline, validatePhysicalComponentProfile, verifyEngineManufacturingSpec
} from '../dist/src/index.js';
import * as logic from '../dist/src/index.js';
import {canonicalHash,preparePolygon} from '../../geometry-compute/dist/src/index.js';

const rectangle=(w,h)=>[{x:-w/2,y:-h/2},{x:w/2,y:-h/2},{x:w/2,y:h/2},{x:-w/2,y:h/2}];
const dumbbell=[{x:-50,y:-30},{x:-10,y:-30},{x:-10,y:-11.9},{x:20,y:-11.9},{x:20,y:-12},{x:44,y:-12},{x:44,y:12},{x:20,y:12},{x:20,y:11.9},{x:-10,y:11.9},{x:-10,y:30},{x:-50,y:30}];
const editableReference=()=>{const profile=structuredClone(createReferenceProfile());delete profile.profileHash;return profile;};
const patternsAtStride=(patterns,stride)=>patterns.map(pattern=>{const [x0,y0]=pattern.cells[0];return{...pattern,cells:pattern.cells.map(([x,y])=>[x0+(x-x0)*stride/2,y0+(y-y0)*stride/2])};});
const boundedB1Profile=maxMm=>{const profile=editableReference();profile.sizeDomain={minMm:24,maxMm,stepMm:12,bands:[{id:'B1',class:1,minMm:24,maxMm,maxInclusive:true,referenceMm:24}],primaryOffer:'SMALLEST_ACCEPTED_PER_BAND'};profile.permissions=profile.permissions.map(permission=>({...permission,bands:['B1'],allowedAxisClassPairs:[[1,1]]}));return registerProfile(profile);};
const singleRungProfile=()=>{const profile=editableReference();profile.sizeDomain={minMm:48,maxMm:49,stepMm:12,bands:[{id:'B1',class:1,minMm:48,maxMm:49,maxInclusive:true,referenceMm:48}],primaryOffer:'SMALLEST_ACCEPTED_PER_BAND'};profile.permissions=profile.permissions.map(permission=>({...permission,bands:['B1'],allowedAxisClassPairs:[[1,1]]}));profile.translation={...profile.translation,allowX:false,allowY:false};return registerProfile(profile);};

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

test('warm solves reuse only prepared source data and recompute certified rungs',async()=>{
  const profile=singleRungProfile(),outline=rectangle(24,24);clearSolverCaches();
  const cold=await solveOutline({outlineMm:outline,profile});
  const warm=await solveOutline({outlineMm:structuredClone(outline),profile});
  assert.notEqual(warm,cold);assert.deepEqual(warm,cold);
  assert.throws(()=>warm.offers.push({}),TypeError);
  clearSolverCaches();
  const rebuilt=await solveOutline({outlineMm:outline,profile});
  assert.notEqual(rebuilt,cold);assert.deepEqual(rebuilt,cold);
});

test('engine ManufacturingSpec round-trips and exact re-verifies',async()=>{
  const p=singleRungProfile();const result=await solveOutline({outlineMm:rectangle(24,24),profile:p});const solution=selectedOffer(result,'B1');const spec=createEngineManufacturingSpec(result,solution,p);const verified=verifyEngineManufacturingSpec(spec,p);assert.equal(verified.valid,true);assert.equal(spec.proofStatus,'REFERENCE_PROFILE_NOT_PRODUCTION');
  assert.deepEqual(spec.sourceRingInt,result.sourceRingInt);assert.equal(spec.targetDominantMm,solution.targetDominantMm);
  assert.equal(spec.canonicalOrigin,'SOURCE_BOUNDS_CENTER');assert.equal(spec.axisConvention,'X_RIGHT_Y_UP');
  assert.equal(spec.populationStrideCells,2);assert.deepEqual(spec.populationOriginParity,[0,0]);
  assert.equal(spec.patternVersion,1);assert.equal(spec.patternVariantId,'default');assert.equal(spec.approximationErrorEnvelopeMm,0);
  assert.equal(spec.centreCoordinatesInt.length,spec.centres.length);
  assert.deepEqual(spec.decisionTrace.slice(-2).map(trace=>trace.criterionId),['M09_DISCRETE_ID','M10_REGISTRATION_ID']);
});

test('manufacturing verification rejects a certified rung that was not the band offer',async()=>{
  const raw=editableReference();
  raw.sizeDomain={minMm:48,maxMm:61,stepMm:12,bands:[{id:'B1',class:1,minMm:48,maxMm:61,maxInclusive:true,referenceMm:48}],primaryOffer:'SMALLEST_ACCEPTED_PER_BAND'};
  raw.permissions=raw.permissions.map(permission=>({...permission,bands:['B1'],allowedAxisClassPairs:[[1,1]]}));
  raw.translation={...raw.translation,allowX:false,allowY:false};
  const profile=registerProfile(raw);const solve=await solveOutline({outlineMm:rectangle(24,24),profile});
  assert.deepEqual(solve.evaluated.map(item=>[item.targetDominantMm,item.status]),[[48,'ACCEPTED'],[60,'ACCEPTED']]);
  const offered=selectedOffer(solve,'B1');assert.equal(offered.targetDominantMm,48);
  assert.equal(verifyEngineManufacturingSpec(createEngineManufacturingSpec(solve,offered,profile),profile).valid,true);
  const nonOffer=solve.evaluated.find(item=>item.targetDominantMm===60);assert.equal(nonOffer.status,'ACCEPTED');
  const payload=buildEngineManufacturingPayload(solve,nonOffer,profile);
  assert.throws(()=>verifyEngineManufacturingSpec({...payload,canonicalHash:canonicalHash(payload)},profile),/MANUFACTURING_OFFER_MISMATCH/);
});

test('recomputed canonical hash cannot legitimise inconsistent manufacturing evidence',async()=>{
  const profile=singleRungProfile();const result=await solveOutline({outlineMm:rectangle(24,24),profile});const spec=createEngineManufacturingSpec(result,selectedOffer(result,'B1'),profile);
  const forge=changes=>{const value={...structuredClone(spec),...changes};const {canonicalHash:_old,...payload}=value;return{...value,canonicalHash:canonicalHash(payload)};};
  assert.throws(()=>verifyEngineManufacturingSpec(forge({sourceGeometryHash:'0'.repeat(64)}),profile),/SOURCE_GEOMETRY_MISMATCH/);
  assert.throws(()=>verifyEngineManufacturingSpec(forge({frameId:'forged',patternId:'forged',populationId:'forged',registration:{x:999,y:999},selectedCellAddresses:[[999,999]],decisionTrace:[]}),profile),/MANUFACTURING_EVIDENCE_MISMATCH/);
  assert.throws(()=>verifyEngineManufacturingSpec(forge({widthMm:999,heightMm:999,scale:999}),profile),/MANUFACTURING_EVIDENCE_MISMATCH/);
  assert.throws(()=>verifyEngineManufacturingSpec(forge({effectiveVerificationRadiusMm:0,toleranceCompositionRuleId:''}),profile),/PHYSICAL_TOLERANCE_POLICY_MISSING/);
  assert.equal('timestamp' in spec,false);
});

test('historical verification resolves every pinned profile and artifact explicitly',async()=>{
  const profile=singleRungProfile();const result=await solveOutline({outlineMm:rectangle(24,24),profile});const spec=createEngineManufacturingSpec(result,selectedOffer(result,'B1'),profile);
  const current=currentManufacturingVerificationResolver(profile);const profiles=new ProfileRegistry();profiles.add(profile);
  const resolver={...current,resolveProfile:(id,hash)=>profiles.resolvePinned(id,hash)};
  assert.equal(verifyEngineManufacturingSpec(spec,resolver).valid,true);
  const historicalCompute='1'.repeat(64),historicalLogic='2'.repeat(64);
  const historicalPayload={...structuredClone(spec),computeArtifactHash:historicalCompute,logicArtifactHash:historicalLogic};delete historicalPayload.canonicalHash;
  const historicalSpec={...historicalPayload,canonicalHash:canonicalHash(historicalPayload)};
  const currentLogic=current.resolveLogicArtifact(spec.logicArtifactHash);
  const historicalResolver={
    resolveProfile:(id,hash)=>profiles.resolvePinned(id,hash),
    resolveComputeArtifact:hash=>hash===historicalCompute?{artifactHash:historicalCompute}:undefined,
    resolveLogicArtifact:hash=>hash===historicalLogic?{...currentLogic,artifactHash:historicalLogic,computeArtifactHash:historicalCompute}:undefined
  };
  assert.throws(()=>verifyEngineManufacturingSpec(historicalSpec,profile),/COMPUTE_ARTIFACT_UNRESOLVABLE/);
  assert.equal(verifyEngineManufacturingSpec(historicalSpec,historicalResolver).valid,true);
  assert.throws(()=>verifyEngineManufacturingSpec(spec,{...resolver,resolveProfile:()=>undefined}),/PROFILE_UNRESOLVABLE/);
  assert.throws(()=>verifyEngineManufacturingSpec(spec,{...resolver,resolveComputeArtifact:()=>undefined}),/COMPUTE_ARTIFACT_UNRESOLVABLE/);
  assert.throws(()=>verifyEngineManufacturingSpec(spec,{...resolver,resolveComputeArtifact:()=>({artifactHash:'0'.repeat(64)})}),/COMPUTE_ARTIFACT_HASH_MISMATCH/);
  assert.throws(()=>verifyEngineManufacturingSpec(spec,{...resolver,resolveLogicArtifact:()=>undefined}),/LOGIC_ARTIFACT_UNRESOLVABLE/);
  const drifted=structuredClone(profile);drifted.grid.cellMm=20;
  assert.throws(()=>verifyEngineManufacturingSpec(spec,{...resolver,resolveProfile:()=>drifted}),/PROFILE_HASH_MISMATCH/);
});

test('physical component dimensions and tolerances fail closed',()=>{
  const valid={id:'magnet-8',version:1,magnetDiameterMm:8,magnetThicknessMm:1,cutToleranceMm:0,placementToleranceMm:0,materialToleranceMm:0,assemblyToleranceMm:0,assemblyProfileId:'assembly-v1'};
  assert.doesNotThrow(()=>validatePhysicalComponentProfile(valid));
  assert.throws(()=>validatePhysicalComponentProfile(undefined),/COMPONENT_REFERENCE_MISSING/);
  for(const mutation of [
    {magnetDiameterMm:0},{magnetThicknessMm:Infinity},{cutToleranceMm:-1},{placementToleranceMm:NaN},{id:' '},{version:0},{assemblyProfileId:' '}
  ])assert.throws(()=>validatePhysicalComponentProfile({...valid,...mutation}),/COMPONENT_/);
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
  const physical={id:'demo',version:1,magnetDiameterMm:8,magnetThicknessMm:1,cutToleranceMm:0,placementToleranceMm:0,materialToleranceMm:0,assemblyToleranceMm:0,assemblyProfileId:'demo'};
  assert.throws(()=>completeFulfilmentSpec(spec,p,physical),/REFERENCE_PROFILE_NOT_PRODUCTION/);
  assert.throws(()=>completeFulfilmentSpec(spec,p,{...physical,magnetDiameterMm:25}),/COMPONENT_TOLERANCE_INCOMPATIBLE/);
  assert.throws(()=>completeFulfilmentSpec(spec,p,{...physical,cutToleranceMm:.01}),/COMPONENT_TOLERANCE_INCOMPATIBLE/);
  assert.throws(()=>completeFulfilmentSpec(spec,p,{...physical,magnetThicknessMm:0}),/COMPONENT_DIMENSIONS_INVALID/);
});

test('alternate calibrated values reuse the same Compute engine',()=>{
  const base=createReferenceProfile();const draft=structuredClone(base);delete draft.profileHash;draft.id='alternate-grid';draft.version=1;draft.grid.cellMm=20;draft.grid.nodeStrideCells=3;draft.grid.populations=[{id:'grid60',strideCells:3,enabled:true,originParities:[[0,0]]}];draft.patterns=patternsAtStride(draft.patterns,3).map(pattern=>({...pattern,populationId:'grid60'}));draft.permissions=draft.permissions.map(permission=>({...permission,allowedPopulationIds:['grid60']}));const alternate=registerProfile(draft);assert.equal(alternate.grid.cellMm,20);assert.notEqual(alternate.profileHash,base.profileHash);
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
  const raw=editableReference();raw.permissions=raw.permissions.map(permission=>({...permission,marginalNodesAllowed:true,requiredMajorRegionsCovered:0}));
  const result=certifySizeSolution({outlineMm:rectangle(72,72),profile:registerProfile(raw),targetDominantMm:72});
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

test('possible-cell bridge makes structural region authority indeterminate',()=>{
  const raw=editableReference();
  raw.structural={...raw.structural,sampleStepMm:6,clearanceSurplusLevelsMm:[0],majorMinAreaDiscRatio:0,majorMinAreaShapeFraction:0,majorMinPersistenceLevels:1,forceLargestComponentMajor:true};
  const evidence=buildStructuralEvidence(preparePolygon(dumbbell,{quantumMm:.01}),registerProfile(raw));
  assert.equal(evidence.status,'INDETERMINATE');
  assert.ok(evidence.reasons.includes('COMPONENT_TOPOLOGY_UNCERTAIN'));
});

test('registered 33-level policy cannot create an impossible structural component',()=>{
  const raw=editableReference();
  raw.structural={...raw.structural,clearanceSurplusLevelsMm:Array.from({length:33},(_,index)=>index),sampleStepMm:5};
  const polygon=preparePolygon(rectangle(40,40),{quantumMm:.01});
  const evidence=buildStructuralEvidence(polygon,registerProfile(raw));
  assert.equal(evidence.hierarchy.components.some(component=>component.levelIndex===32),false);
});

test('every configured population parity becomes a distinct applied frame hypothesis',()=>{
  const raw=editableReference();
  raw.grid.populations[0].strideCells=4;
  raw.grid.populations[0].originParities=[[0,0],[1,0]];
  raw.patterns=patternsAtStride(raw.patterns,4);
  const profile=registerProfile(raw);
  assert.equal(typeof logic.framesForPattern,'function');
  const pattern=profile.patterns.find(candidate=>candidate.id==='single');
  const frames=logic.framesForPattern(profile,pattern);
  assert.deepEqual(frames.map(frame=>frame.populationOriginParity),[[0,0],[1,0]]);
  assert.deepEqual(logic.patternCellsForFrame(profile,pattern,frames[0]),[[0,0]]);
  assert.deepEqual(logic.patternCellsForFrame(profile,pattern,frames[1]),[[2,0]]);
  const row=profile.patterns.find(candidate=>candidate.id==='row.3');
  assert.equal(logic.framesForPattern(profile,row)[0].nx,3);
});

test('permission records enforce exact axis and population authority',()=>{
  const raw=editableReference();
  raw.permissions=raw.permissions.map(permission=>permission.patternId==='pair.vertical'?{
    ...permission,bands:['B2'],allowedAxisClassPairs:[[1,2]],allowedPopulationIds:['grid48']
  }:permission);
  const profile=registerProfile(raw);
  assert.equal(permittedPatterns(profile,'B2',2,2).some(item=>item.pattern.id==='pair.vertical'),false);
});

test('permission authority requires every PD-19 dimension',()=>{
  for(const field of ['allowedAxisClassPairs','allowedPopulationIds','requiredMajorRegionsCovered','alternativeOrientationsConsidered','primaryOfferAllowed','fallbackAllowed']){
    const raw=editableReference();delete raw.permissions[0][field];
    assert.throws(()=>registerProfile(raw),new RegExp(field));
  }
});

test('alternative-orientation permission expands only its declared symmetry family',()=>{
  const raw=editableReference();
  raw.permissions=raw.permissions.map(permission=>permission.patternId==='l.bottom-left'
    ?{...permission,bands:['B2'],allowedAxisClassPairs:[[2,2]],alternativeOrientationsConsidered:true}
    :permission.patternId.startsWith('l.')?{...permission,bands:['B3'],allowedAxisClassPairs:[[3,3]]}:permission);
  const allowed=permittedPatterns(registerProfile(raw),'B2',2,2).filter(item=>item.pattern.symmetryFamily==='l.3');
  assert.deepEqual(allowed.map(item=>item.pattern.id),['l.bottom-left','l.bottom-right','l.top-left','l.top-right']);
});

test('major-coverage and marginal-node permissions constrain certified registrations',()=>{
  const coverage=structuredClone(singleRungProfile());delete coverage.profileHash;
  coverage.permissions=coverage.permissions.map(permission=>permission.patternId==='single'?{...permission,requiredMajorRegionsCovered:2}:permission);
  const denied=certifySizeSolution({outlineMm:rectangle(24,24),profile:registerProfile(coverage),targetDominantMm:48});
  assert.equal(denied.status,'REJECTED');assert.ok(denied.reasons.some(reason=>reason.includes('PATTERN_PERMISSION_DENIED')));

  const marginal=structuredClone(singleRungProfile());delete marginal.profileHash;
  marginal.structural={...marginal.structural,clearanceSurplusLevelsMm:[0],majorMinAreaDiscRatio:999,majorMinAreaShapeFraction:999,majorMinPersistenceLevels:2,forceLargestComponentMajor:false};
  marginal.permissions=marginal.permissions.map(permission=>({...permission,requiredMajorRegionsCovered:0,marginalNodesAllowed:false}));
  assert.equal(certifySizeSolution({outlineMm:rectangle(24,24),profile:registerProfile(marginal),targetDominantMm:48}).status,'REJECTED');
  marginal.permissions=marginal.permissions.map(permission=>({...permission,marginalNodesAllowed:true}));
  assert.equal(certifySizeSolution({outlineMm:rectangle(24,24),profile:registerProfile(marginal),targetDominantMm:48}).status,'ACCEPTED');
});

test('primary eligibility outranks fallback rank, and fallback is used only when needed',()=>{
  const fixture=primaryAllowed=>{const raw=structuredClone(singleRungProfile());delete raw.profileHash;
    const original=raw.patterns.find(pattern=>pattern.id==='single');raw.patterns.push({...original,id:'single.fallback'});
    const primaryPermission=raw.permissions.find(permission=>permission.patternId==='single');
    Object.assign(primaryPermission,{patternRank:10,primaryOfferAllowed:primaryAllowed,fallbackAllowed:true});
    raw.permissions.push({...primaryPermission,patternId:'single.fallback',patternRank:0,primaryOfferAllowed:false,fallbackAllowed:true});return registerProfile(raw);};
  const primary=certifySizeSolution({outlineMm:rectangle(24,24),profile:fixture(true),targetDominantMm:48});
  assert.equal(primary.status,'ACCEPTED');assert.equal(primary.patternId,'single');

  const fallback=certifySizeSolution({outlineMm:rectangle(24,24),profile:fixture(false),targetDominantMm:48});
  assert.equal(fallback.status,'ACCEPTED');assert.equal(fallback.patternId,'single.fallback');
});

test('M02 upper-region identity follows registered topDirection projection',()=>{
  const raw=editableReference();raw.mechanics={...raw.mechanics,topDirection:{x:1,y:0}};
  const profile=registerProfile(raw);
  const region=(id,bounds)=>({id,bounds,gridOrigin:{x:0,y:0},cellStepMm:1,radiusMm:12,errorEnvelopeMm:0,definitelyOccupiedCellKeys:new Set(),possiblyOccupiedCellKeys:new Set(),exactWitnessPoints:[]});
  const regions=[region('high-y',{minX:-10,maxX:-9,minY:0,maxY:100}),region('right',{minX:9,maxX:10,minY:0,maxY:1})];
  const descriptor=criterionDescriptor(profile.mechanics.criteria[1],{},profile,regions);
  assert.deepEqual(descriptor.subsetIds,['right']);
});

test('discrete identity uses canonical code-unit ordering instead of locale',()=>{
  const candidate=populationId=>({frame:{populationId,populationStrideCells:2,populationOriginParity:[0,0],id:'1x1'},pattern:{id:'single',version:1,populationId,cells:[[0,0]],variantId:'default',frameId:'1x1'}});
  assert.equal(selectDiscreteIdentity([candidate('ä'),candidate('z')]).frame.populationId,'z');
});

test('certified solution trace includes M09 discrete and M10 registration identity',()=>{
  const result=certifySizeSolution({outlineMm:rectangle(24,24),profile:singleRungProfile(),targetDominantMm:48});
  assert.equal(result.status,'ACCEPTED');
  assert.deepEqual(result.scoreTrace.slice(-2).map(trace=>trace.criterionId),['M09_DISCRETE_ID','M10_REGISTRATION_ID']);
  assert.deepEqual(result.scoreTrace.at(-2).identityKey,[result.frame.populationId,0,0,result.frame.id,result.patternId,'default']);
  assert.deepEqual(result.scoreTrace.at(-1).registration,result.registration);
});
