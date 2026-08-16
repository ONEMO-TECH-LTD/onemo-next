import {
  certifySizeSolution,
  createEngineManufacturingSpec,
  createReferenceProfile,
  selectedOffer,
  solveOutline
} from '@onemo/magnetic-logic';

const profile=createReferenceProfile();
const outline=[
  {x:-60,y:-60},{x:60,y:-60},{x:60,y:60},{x:-60,y:60}
];
const result=await solveOutline({outlineMm:outline,profile,diagnosticLevel:'summary'});
console.log('Interactive band offers:');
console.log(JSON.stringify(result.offers.map(offer=>({
  band:offer.band,status:offer.status,size:offer.solution&&[offer.solution.widthMm,offer.solution.heightMm],
  pattern:offer.solution?.patternId,decisionProof:offer.solution?.decisionProof,centres:offer.solution?.centres
})),null,2));

const b3=selectedOffer(result,'B3');
const certification=certifySizeSolution({outlineMm:outline,profile,targetDominantMm:b3.targetDominantMm});
console.log('\nSelected-size continuous certification:');
console.log(JSON.stringify(certification,null,2));

// The bundled reference profile intentionally permits a non-production integration
// specimen so persistence and verification can be wired before calibration closes.
const spec=createEngineManufacturingSpec(result,b3,profile);
console.log('\nEngine ManufacturingSpec (reference/non-production profile):');
console.log(JSON.stringify(spec,null,2));
