import {
  createEngineManufacturingSpec,
  createReferenceProfile,
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

const selected=result.offers.find(offer=>offer.status==='OFFERED')?.solution;
if(selected){
  // The bundled reference profile intentionally permits a non-production integration
  // specimen so persistence and verification can be wired before calibration closes.
  const spec=createEngineManufacturingSpec(result,selected,profile);
  console.log('\nEngine ManufacturingSpec (reference/non-production profile):');
  console.log(JSON.stringify(spec,null,2));
}else{
  console.log('\nNo Engine ManufacturingSpec: every affected offer is blocked by certified uncertainty.');
}
