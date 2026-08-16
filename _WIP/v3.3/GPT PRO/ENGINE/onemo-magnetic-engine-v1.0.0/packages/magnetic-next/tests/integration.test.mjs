import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptStudioOutline } from '../dist/src/outline-adapter.js';
import { parseManufacturingSpec, serializeManufacturingSpec } from '../dist/src/persistence.js';
import { solutionViewModels } from '../dist/src/solution-view-model.js';

test('studio adapter flips canvas Y and centres bounds',()=>{
  const adapted=adaptStudioOutline([{x:0,y:0},{x:10,y:0},{x:10,y:20},{x:0,y:20}],{inputYAxis:'DOWN',centreOnBounds:true});
  assert.deepEqual(adapted,[{x:-5,y:10},{x:5,y:10},{x:5,y:-10},{x:-5,y:-10}]);
});

test('ManufacturingSpec transport parser rejects wrong schema',()=>{assert.throws(()=>parseManufacturingSpec('{"schema":"wrong"}'));});

test('solution view model preserves band status',()=>{
  const models=solutionViewModels({schema:'onemo-magnetic-solve-v1',profileId:'p',profileHash:'h',computeArtifactHash:'c',logicArtifactHash:'l',sourceGeometryHash:'g',evaluated:[],offers:[{band:'B1',status:'NO_SOLUTION',reasons:['x']}],canonicalHash:'z'});
  assert.equal(models[0].status,'NO_SOLUTION');assert.deepEqual(models[0].reasons,['x']);
});
