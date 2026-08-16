import type { ProductProfile } from './contracts.js';

export interface ProfileValidation {readonly valid:boolean;readonly errors:readonly string[];}

export function validateProfile(profile:ProductProfile):ProfileValidation{
  const errors:string[]=[];
  if(profile.schema!=='onemo-magnetic-profile-v1')errors.push('unsupported profile schema');
  if(!profile.id.trim())errors.push('profile id is required');
  if(!Number.isInteger(profile.version)||profile.version<1)errors.push('profile version must be a positive integer');
  const n=profile.numeric;
  if(!(n.coordinateQuantumMm>0))errors.push('coordinate quantum must be positive');
  if(!(n.approximationToleranceMm>0&&n.approximationToleranceMm<=n.coordinateQuantumMm/4+1e-12))errors.push('approximation tolerance must be positive and <= one quarter quantum');
  if(!(n.feasibilityCoarseToleranceMm>=n.approximationToleranceMm))errors.push('coarse feasibility tolerance must be >= certified approximation tolerance');
  if(!Number.isInteger(n.maxAdaptiveCells)||n.maxAdaptiveCells<100)errors.push('maxAdaptiveCells must be an integer >= 100');
  if(!Number.isInteger(n.maxVertices)||n.maxVertices<3)errors.push('maxVertices must be an integer >= 3');
  if(!(profile.grid.cellMm>0))errors.push('cell size must be positive');
  if(!Number.isInteger(profile.grid.nodeStrideCells)||profile.grid.nodeStrideCells<1)errors.push('node stride must be a positive integer');
  if(!(profile.safety.baseProtectedRadiusMm>0&&profile.safety.effectiveVerificationRadiusMm>=profile.safety.baseProtectedRadiusMm))errors.push('effective verification radius must be >= base protected radius');
  const tolerance=profile.safety.tolerancePolicy;
  for(const [key,value] of Object.entries(tolerance))if(key!=='id'&&(!(typeof value==='number')||value<0||!Number.isFinite(value)))errors.push(`invalid tolerance ${key}`);
  const adverse=tolerance.cutMm+tolerance.placementMm+tolerance.materialMm+tolerance.assemblyMm;
  const expected=tolerance.id==='POST_TOLERANCE_MINIMUM_V1'?profile.safety.baseProtectedRadiusMm+adverse:profile.safety.baseProtectedRadiusMm;
  if(Math.abs(profile.safety.effectiveVerificationRadiusMm-expected)>n.coordinateQuantumMm/2)errors.push('effective verification radius does not match tolerance composition rule');
  const bands=[...profile.sizeDomain.bands].sort((a,b)=>a.minMm-b.minMm);
  if(bands.length===0)errors.push('at least one band is required');
  for(let i=0;i<bands.length;i++){
    const band=bands[i]!;if(!(band.minMm<band.maxMm))errors.push(`invalid band ${band.id}`);
    if(i>0&&Math.abs(bands[i-1]!.maxMm-band.minMm)>1e-12)errors.push(`band gap or overlap before ${band.id}`);
  }
  const populationIds=new Set(profile.grid.populations.map(p=>p.id));
  const patternIds=new Set<string>();
  for(const pattern of profile.patterns){
    if(patternIds.has(pattern.id))errors.push(`duplicate pattern ${pattern.id}`);patternIds.add(pattern.id);
    if(!populationIds.has(pattern.populationId))errors.push(`pattern ${pattern.id} references unknown population`);
    if(pattern.cells.length===0)errors.push(`pattern ${pattern.id} has no nodes`);
  }
  for(const permission of profile.permissions)if(!patternIds.has(permission.patternId))errors.push(`permission references unknown pattern ${permission.patternId}`);
  const criterionIds=new Set<string>();
  for(const criterion of profile.mechanics.criteria){if(criterionIds.has(criterion.id))errors.push(`duplicate criterion ${criterion.id}`);criterionIds.add(criterion.id);}
  if(profile.approvalState==='approved'&&profile.engineeringAssumptions.some(x=>x.startsWith('UNRESOLVED:'))&&profile.productionReady)errors.push('production-ready approved profile may not contain unresolved assumptions');
  return{valid:errors.length===0,errors:Object.freeze(errors)};
}
