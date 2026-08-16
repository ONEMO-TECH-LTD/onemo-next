import type { MechanicsCriterionPolicy, ProductProfile } from './contracts.js';

export interface ProfileValidation {readonly valid:boolean;readonly errors:readonly string[];}

const mechanicsRegistry:readonly Readonly<MechanicsCriterionPolicy>[]=[
  {id:'M01_MAJOR_COVERAGE',descriptorId:'REGION_COVERAGE_V1',tolerances:[0,0]},
  {id:'M02_UPPER_REGION',descriptorId:'REGION_SUBSET_COVERAGE_V1',tolerances:[0]},
  {id:'M03_UPPER_MOMENT',descriptorId:'CAP_FIRST_MOMENT_V1',tolerances:[0],toleranceRule:'Q_TIMES_AREA'},
  {id:'M04_MAX_OVERHANG',descriptorId:'MAX_DIRECTIONAL_OVERHANG_V1',tolerances:[0],toleranceRule:'Q'},
  {id:'M05_PATTERN_RANK',descriptorId:'DISCRETE_SCALAR_V1',tolerances:[0]},
  {id:'M06_REGION_LOAD',descriptorId:'REGION_MAX_LOAD_V1',tolerances:[0]},
  {id:'M07_BALANCE',descriptorId:'ANCHOR_CENTROID_BALANCE_V1',tolerances:[0,0],toleranceRule:'Q_AND_CENTROID_SQUARED'},
  {id:'M08_ANCHOR_COUNT',descriptorId:'POINT_COUNT_V1',tolerances:[0]},
  {id:'M09_DISCRETE_ID',descriptorId:'DISCRETE_KEY_V1',tolerances:[]},
  {id:'M10_REGISTRATION_ID',descriptorId:'FINAL_REGISTRATION_ORDER_V1',tolerances:[]}
];

function finitePositive(value:number):boolean{return Number.isFinite(value)&&value>0;}
function finiteNonNegative(value:number):boolean{return Number.isFinite(value)&&value>=0;}
function nonEmpty(value:string):boolean{return typeof value==='string'&&value.trim().length>0;}
function duplicate(values:readonly string[]):string|undefined{const seen=new Set<string>();for(const value of values){if(seen.has(value))return value;seen.add(value);}return undefined;}

export function validateProfile(profile:ProductProfile):ProfileValidation{
  const errors:string[]=[];
  if(profile.schema!=='onemo-magnetic-profile-v1')errors.push('unsupported profile schema');
  if(!nonEmpty(profile.id))errors.push('profile id is required');
  if(!Number.isInteger(profile.version)||profile.version<1)errors.push('profile version must be a positive integer');
  if(!['draft','approved','retired'].includes(profile.approvalState))errors.push('invalid approval state');
  if(typeof profile.productionReady!=='boolean')errors.push('productionReady must be boolean');

  const n=profile.numeric;
  if(!finitePositive(n.coordinateQuantumMm))errors.push('coordinate quantum must be finite and positive');
  if(!(finitePositive(n.approximationToleranceMm)&&n.approximationToleranceMm<=n.coordinateQuantumMm/4+1e-12))errors.push('approximation tolerance must be finite, positive, and <= one quarter quantum');
  if(!(Number.isFinite(n.feasibilityCoarseToleranceMm)&&n.feasibilityCoarseToleranceMm>=n.approximationToleranceMm))errors.push('coarse feasibility tolerance must be finite and >= certified approximation tolerance');
  if(!Number.isInteger(n.maxAdaptiveCells)||n.maxAdaptiveCells<100)errors.push('maxAdaptiveCells must be an integer >= 100');
  if(!Number.isInteger(n.maxVertices)||n.maxVertices<3)errors.push('maxVertices must be an integer >= 3');

  const grid=profile.grid;
  if(!finitePositive(grid.cellMm))errors.push('cell size must be finite and positive');
  if(!Number.isInteger(grid.nodeStrideCells)||grid.nodeStrideCells<1)errors.push('node stride must be a positive integer');
  if(!Number.isInteger(grid.displayViewportCells)||grid.displayViewportCells<1)errors.push('display viewport must be a positive integer');
  if(grid.populations.length===0)errors.push('at least one population is required');
  const duplicatePopulation=duplicate(grid.populations.map(population=>population.id));
  if(duplicatePopulation!==undefined)errors.push(`duplicate population ${duplicatePopulation}`);
  for(const population of grid.populations){
    if(!nonEmpty(population.id))errors.push('population id is required');
    if(!Number.isInteger(population.strideCells)||population.strideCells<1)errors.push(`population ${population.id} stride must be a positive integer`);
    if(typeof population.enabled!=='boolean')errors.push(`population ${population.id} enabled must be boolean`);
    if(population.enabled&&population.originParities.length===0)errors.push(`population ${population.id} requires an origin parity`);
    const parityKeys=new Set<string>();
    for(const parity of population.originParities){
      const valid=parity.length===2&&parity.every(value=>Number.isInteger(value)&&(value===0||value===1));
      if(!valid)errors.push(`population ${population.id} has invalid parity`);
      const key=parity.join(',');if(parityKeys.has(key))errors.push(`population ${population.id} has duplicate parity ${key}`);parityKeys.add(key);
    }
  }

  const safety=profile.safety;
  if(!(finitePositive(safety.baseProtectedRadiusMm)&&finitePositive(safety.effectiveVerificationRadiusMm)&&safety.effectiveVerificationRadiusMm>=safety.baseProtectedRadiusMm))errors.push('effective verification radius must be finite and >= a positive base protected radius');
  const tolerance=safety.tolerancePolicy;
  if(!['POST_TOLERANCE_MINIMUM_V1','NOMINAL_ACCEPTED_RISK_V1'].includes(tolerance.id))errors.push('invalid tolerance policy id');
  for(const [key,value] of Object.entries(tolerance))if(key!=='id'&&(typeof value!=='number'||!finiteNonNegative(value)))errors.push(`invalid tolerance ${key}`);
  const adverse=tolerance.cutMm+tolerance.placementMm+tolerance.materialMm+tolerance.assemblyMm;
  const expected=tolerance.id==='POST_TOLERANCE_MINIMUM_V1'?safety.baseProtectedRadiusMm+adverse:safety.baseProtectedRadiusMm;
  if(Number.isFinite(expected)&&Math.abs(safety.effectiveVerificationRadiusMm-expected)>n.coordinateQuantumMm/2)errors.push('effective verification radius does not match tolerance composition rule');

  const domain=profile.sizeDomain;
  if(!(finitePositive(domain.minMm)&&finitePositive(domain.maxMm)&&domain.maxMm>=domain.minMm))errors.push('size domain bounds must be finite, positive, and ordered');
  if(!finitePositive(domain.stepMm))errors.push('size domain step must be finite and positive');
  if(domain.primaryOffer!=='SMALLEST_ACCEPTED_PER_BAND')errors.push('unsupported primary offer policy');
  if(domain.bands.length===0)errors.push('at least one band is required');
  const duplicateBand=duplicate(domain.bands.map(band=>band.id));if(duplicateBand!==undefined)errors.push(`duplicate band ${duplicateBand}`);
  for(let i=0;i<domain.bands.length;i++){
    const band=domain.bands[i]!;
    if(!(finitePositive(band.minMm)&&finitePositive(band.maxMm)&&band.minMm<band.maxMm&&Number.isFinite(band.referenceMm)&&band.referenceMm>=band.minMm&&band.referenceMm<=band.maxMm))errors.push(`invalid band ${band.id}`);
    if(band.class!==i+1)errors.push(`band ${band.id} has invalid class order`);
    if(i===0&&band.minMm!==domain.minMm)errors.push(`first band must start at size domain minimum`);
    if(i>0&&Math.abs(domain.bands[i-1]!.maxMm-band.minMm)>1e-12)errors.push(`band gap, overlap, or order error before ${band.id}`);
    if(i<domain.bands.length-1&&band.maxInclusive)errors.push(`only the final band may include its maximum`);
  }
  if(domain.bands.length>0&&domain.bands.at(-1)!.maxMm!==domain.maxMm)errors.push('final band must end at size domain maximum');

  if(!finitePositive(profile.translation.periodMm))errors.push('translation period must be finite and positive');
  if(typeof profile.translation.allowX!=='boolean'||typeof profile.translation.allowY!=='boolean')errors.push('translation axis policies must be boolean');
  const structural=profile.structural;
  if(!finitePositive(structural.sampleStepMm))errors.push('structural sample step must be finite and positive');
  if(structural.clearanceSurplusLevelsMm.length===0||structural.clearanceSurplusLevelsMm.some((value,index,values)=>!finiteNonNegative(value)||(index>0&&value<=values[index-1]!)))errors.push('clearance surplus levels must be finite, non-negative, and strictly increasing');
  if(!finiteNonNegative(structural.majorMinAreaDiscRatio)||!finiteNonNegative(structural.majorMinAreaShapeFraction))errors.push('structural area thresholds must be finite and non-negative');
  if(!Number.isInteger(structural.majorMinPersistenceLevels)||structural.majorMinPersistenceLevels<1)errors.push('major persistence levels must be a positive integer');
  if(typeof structural.forceLargestComponentMajor!=='boolean')errors.push('largest-component policy must be boolean');

  const populationById=new Map(grid.populations.map(population=>[population.id,population]));
  const duplicatePattern=duplicate(profile.patterns.map(pattern=>pattern.id));if(duplicatePattern!==undefined)errors.push(`duplicate pattern ${duplicatePattern}`);
  if(profile.patterns.length===0)errors.push('at least one pattern is required');
  for(const pattern of profile.patterns){
    if(!nonEmpty(pattern.id)||!Number.isInteger(pattern.version)||pattern.version<1||!nonEmpty(pattern.variantId)||!nonEmpty(pattern.frameId))errors.push(`invalid pattern identity ${pattern.id}`);
    const population=populationById.get(pattern.populationId);
    if(!population||!population.enabled)errors.push(`pattern ${pattern.id} references unknown or disabled population`);
    if(pattern.cells.length===0)errors.push(`pattern ${pattern.id} has no nodes`);
    const cells=new Set<string>();
    for(const cell of pattern.cells){
      if(cell.length!==2||!cell.every(Number.isSafeInteger))errors.push(`pattern ${pattern.id} has invalid cell coordinates`);
      const key=cell.join(',');if(cells.has(key))errors.push(`pattern ${pattern.id} has duplicate cell ${key}`);cells.add(key);
    }
    if(population&&pattern.cells.length>0){
      const [x0,y0]=pattern.cells[0]!;
      if(pattern.cells.some(([x,y])=>(x-x0)%population.strideCells!==0||(y-y0)%population.strideCells!==0))errors.push(`pattern ${pattern.id} violates population stride ${population.strideCells}`);
    }
  }

  const patternIds=new Set(profile.patterns.map(pattern=>pattern.id));
  const duplicatePermission=duplicate(profile.permissions.map(permission=>permission.patternId));if(duplicatePermission!==undefined)errors.push(`duplicate permission ${duplicatePermission}`);
  for(const permission of profile.permissions){
    if(!patternIds.has(permission.patternId))errors.push(`permission references unknown pattern ${permission.patternId}`);
    if(permission.bands.length===0||permission.bands.some(band=>!domain.bands.some(candidate=>candidate.id===band)))errors.push(`permission ${permission.patternId} has invalid bands`);
    if(!Array.isArray(permission.allowedAxisClassPairs)||permission.allowedAxisClassPairs.length===0||permission.allowedAxisClassPairs.some(pair=>pair.length!==2||pair.some((value:number)=>!Number.isInteger(value)||value<1||value>5)))errors.push(`permission ${permission.patternId} has invalid allowedAxisClassPairs`);
    if(Array.isArray(permission.allowedAxisClassPairs)&&new Set(permission.allowedAxisClassPairs.map(pair=>pair.join(','))).size!==permission.allowedAxisClassPairs.length)errors.push(`permission ${permission.patternId} has duplicate allowedAxisClassPairs`);
    if(Array.isArray(permission.allowedAxisClassPairs)&&permission.allowedAxisClassPairs.some(([x,y])=>!permission.bands.includes(`B${Math.max(x,y)}` as ProductProfile['sizeDomain']['bands'][number]['id'])))errors.push(`permission ${permission.patternId} has axis classes outside its bands`);
    if(Array.isArray(permission.allowedAxisClassPairs)&&permission.bands.some(band=>!permission.allowedAxisClassPairs.some(([x,y])=>band===`B${Math.max(x,y)}`)))errors.push(`permission ${permission.patternId} has a band without an axis-class pair`);
    if(!Array.isArray(permission.allowedPopulationIds)||permission.allowedPopulationIds.length===0||permission.allowedPopulationIds.some(id=>!populationById.get(id)?.enabled))errors.push(`permission ${permission.patternId} has invalid allowedPopulationIds`);
    if(Array.isArray(permission.allowedPopulationIds)&&new Set(permission.allowedPopulationIds).size!==permission.allowedPopulationIds.length)errors.push(`permission ${permission.patternId} has duplicate allowedPopulationIds`);
    const permittedPattern=profile.patterns.find(pattern=>pattern.id===permission.patternId);
    if(permittedPattern&&Array.isArray(permission.allowedPopulationIds)&&!permission.allowedPopulationIds.includes(permittedPattern.populationId))errors.push(`permission ${permission.patternId} excludes its pattern population`);
    if(typeof permission.marginalNodesAllowed!=='boolean')errors.push(`permission ${permission.patternId} has invalid marginalNodesAllowed`);
    if(!Number.isInteger(permission.requiredMajorRegionsCovered)||permission.requiredMajorRegionsCovered<0)errors.push(`permission ${permission.patternId} has invalid requiredMajorRegionsCovered`);
    if(typeof permission.alternativeOrientationsConsidered!=='boolean')errors.push(`permission ${permission.patternId} has invalid alternativeOrientationsConsidered`);
    if(permission.alternativeOrientationsConsidered&&!permittedPattern?.symmetryFamily)errors.push(`permission ${permission.patternId} cannot consider alternatives without a symmetry family`);
    if(typeof permission.primaryOfferAllowed!=='boolean')errors.push(`permission ${permission.patternId} has invalid primaryOfferAllowed`);
    if(typeof permission.fallbackAllowed!=='boolean')errors.push(`permission ${permission.patternId} has invalid fallbackAllowed`);
    if(permission.primaryOfferAllowed===false&&permission.fallbackAllowed===false)errors.push(`permission ${permission.patternId} allows neither primary nor fallback use`);
    if(!Number.isInteger(permission.patternRank)||permission.patternRank<0)errors.push(`permission ${permission.patternId} has invalid pattern rank`);
  }
  for(const patternId of patternIds)if(!profile.permissions.some(permission=>permission.patternId===patternId))errors.push(`pattern ${patternId} has no permission`);

  const mechanics=profile.mechanics;
  if(mechanics.registryId!=='onemo-mechanics-v1')errors.push('unsupported mechanics registry');
  if(!Number.isFinite(mechanics.topDirection.x)||!Number.isFinite(mechanics.topDirection.y)||Math.abs(Math.hypot(mechanics.topDirection.x,mechanics.topDirection.y)-1)>1e-12)errors.push('mechanics top direction must be a finite unit vector');
  if(mechanics.criteria.length!==mechanicsRegistry.length)errors.push('mechanics registry is incomplete');
  mechanicsRegistry.forEach((expectedCriterion,index)=>{
    const criterion=mechanics.criteria[index];
    if(!criterion||criterion.id!==expectedCriterion.id||criterion.descriptorId!==expectedCriterion.descriptorId||criterion.toleranceRule!==expectedCriterion.toleranceRule)errors.push(`invalid mechanics criterion ${expectedCriterion.id}`);
    if(criterion&&(criterion.tolerances.length!==expectedCriterion.tolerances.length||criterion.tolerances.some(value=>!finiteNonNegative(value))))errors.push(`invalid mechanics tolerances ${expectedCriterion.id}`);
  });

  if(profile.subQuantumPolicy!=='DECISION_INDETERMINATE')errors.push('unsupported sub-quantum policy');
  if(profile.b1Guarantee!=='ONLY_WHEN_LAWFUL_IN_B1')errors.push('unsupported B1 guarantee');
  if(Object.keys(profile.provenance).length===0||Object.entries(profile.provenance).some(([key,value])=>!nonEmpty(key)||!nonEmpty(value)))errors.push('profile provenance must contain non-empty source facts');
  if(profile.engineeringAssumptions.some(value=>!nonEmpty(value)))errors.push('engineering assumptions must be non-empty strings');
  if(profile.productionReady){
    if(profile.approvalState!=='approved'||profile.engineeringAssumptions.length>0)errors.push('unresolved production assumptions prevent production readiness');
    errors.push('production profile incomplete R3 authority: later Regression and approval-trace groups are not implemented');
  }
  return{valid:errors.length===0,errors:Object.freeze(errors)};
}
