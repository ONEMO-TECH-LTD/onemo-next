import {
  COMPUTE_ARTIFACT_HASH,
  adaptiveFeasibleTranslations,
  canonicalHash,
  criticalTranslationCandidates,
  discContainedExact,
  evaluateCriterionOnBox,
  preparePolygon,
  scaleToDominantDimension,
  descriptorDirections,
  squaredDistance,
  type AdaptiveBox,
  type CompoundScoreInterval,
  type GeometryCriterionDescriptor,
  type Point,
  type RegionEvidence,
  type ScoreInterval
} from '@onemo/geometry-compute';
import type {
  BandId, BandOffer, CandidateHypothesis, CandidateScoreTrace, MechanicsCriterionPolicy, RegisteredProfile,
  SizeFailure, SizeSolution, SolveInput, SolveResult
} from './contracts.js';
import { registerProfile } from './profile-registry.js';
import { LOGIC_ARTIFACT_HASH } from './artifact.js';
import { candidateSizes } from './size-domain.js';
import { classifyAxis, overallBand } from './bands.js';
import { permittedPatterns } from './patterns-permissions.js';
import { frameFits, frameForPattern, patternOffsetsMm, translationDomain } from './frames-registration.js';
import { buildStructuralEvidence, majorRegionEvidence } from './region-policy.js';
import { candidateDiscreteKey, criterionDescriptor, criterionTolerances } from './mechanics.js';

interface PointCandidate {
  readonly hypothesis:CandidateHypothesis;
  readonly translation:Point;
  readonly trace:readonly CandidateScoreTrace[];
  readonly policies:readonly MechanicsCriterionPolicy[];
  readonly descriptors:readonly GeometryCriterionDescriptor[];
  readonly tolerances:readonly (readonly number[])[];
}

function asComponents(score:ScoreInterval|CompoundScoreInterval):readonly ScoreInterval[]{return'components'in score?score.components:[score];}
function exactValue(interval:ScoreInterval):number{return(interval.lower+interval.upper)/2;}

function compareKeys(a:readonly (string|number)[],b:readonly (string|number)[]):number{
  const n=Math.max(a.length,b.length);for(let i=0;i<n;i++){const x=a[i],y=b[i];if(x===y)continue;if(x===undefined)return-1;if(y===undefined)return 1;if(typeof x==='number'&&typeof y==='number')return x-y;return String(x).localeCompare(String(y));}return 0;
}

function comparePointCandidates(a:PointCandidate,b:PointCandidate,profile:RegisteredProfile):number{
  for(let i=0;i<a.trace.length;i++){
    const ac=asComponents(a.trace[i]!.score),bc=asComponents(b.trace[i]!.score);const directions=descriptorDirections(a.descriptors[i]!);const tolerances=a.tolerances[i]!;
    for(let j=0;j<directions.length;j++){
      const av=exactValue(ac[j]!),bv=exactValue(bc[j]!),t=tolerances[j]??0;
      if(Math.abs(av-bv)<=t)continue;
      return directions[j]==='MIN'?(av<bv?-1:1):(av>bv?-1:1);
    }
  }
  const discrete=compareKeys(candidateDiscreteKey(a.hypothesis),candidateDiscreteKey(b.hypothesis));if(discrete!==0)return discrete;
  const da=squaredDistance(a.translation,{x:0,y:0}),db=squaredDistance(b.translation,{x:0,y:0});
  if(Math.abs(da-db)>profile.numeric.coordinateQuantumMm**2/2)return da-db;
  return a.translation.x-b.translation.x||a.translation.y-b.translation.y;
}

function degenerateBox(point:Point):AdaptiveBox{return{minX:point.x,minY:point.y,maxX:point.x,maxY:point.y,depth:0,status:'INSIDE',id:`P:${point.x},${point.y}`};}

function scorePointCandidate(hypothesis:CandidateHypothesis,translation:Point,regions:readonly RegionEvidence[],profile:RegisteredProfile):PointCandidate{
  const trace:CandidateScoreTrace[]=[];const descriptors:GeometryCriterionDescriptor[]=[];const tolerances:number[][]=[];
  for(const policy of profile.mechanics.criteria){
    const descriptor=criterionDescriptor(policy,hypothesis,profile,regions);const tolerance=criterionTolerances(policy,hypothesis,profile);const evaluation=evaluateCriterionOnBox(hypothesis.polygon,hypothesis.offsetsMm,degenerateBox(translation),descriptor);
    trace.push({criterionId:policy.id,descriptorId:descriptor.id,score:evaluation.score,status:'CERTIFIED'});descriptors.push(descriptor);tolerances.push([...tolerance]);
  }
  return{hypothesis,translation,trace,policies:profile.mechanics.criteria,descriptors,tolerances};
}

function buildPointCandidates(
  polygon:ReturnType<typeof scaleToDominantDimension>,target:number,band:BandId,
  classX:NonNullable<ReturnType<typeof classifyAxis>>,classY:NonNullable<ReturnType<typeof classifyAxis>>,
  profile:RegisteredProfile
):{points:PointCandidate[];reasons:string[]}{
  const structural=buildStructuralEvidence(polygon,profile);const regions=majorRegionEvidence(structural);const patterns=permittedPatterns(profile,band,classX,classY);const result:PointCandidate[]=[];const reasons:string[]=[];const domain=translationDomain(profile);const radius=profile.safety.effectiveVerificationRadiusMm;
  for(const {pattern,permission} of patterns){
    const frame=frameForPattern(pattern);if(!frameFits(frame,classX,classY))continue;const offsets=patternOffsetsMm(profile,pattern);
    const witnesses=criticalTranslationCandidates(polygon,offsets,radius,domain,{regions,includeDirectionalExtrema:true,gridDivisions:2,maxCandidates:64});
    if(witnesses.length===0){
      const fallback=adaptiveFeasibleTranslations(polygon,offsets,radius,domain,{toleranceMm:Math.max(profile.numeric.feasibilityCoarseToleranceMm,0.5),maxCells:6000,quantumMm:profile.numeric.coordinateQuantumMm,maxDepth:22,witnessIterations:16},{x:0,y:0});
      witnesses.push(...fallback.witnessPoints);
    }
    if(witnesses.length===0){reasons.push(`${pattern.id}:NO_ROBUST_FEASIBLE_REGISTRATION`);continue;}
    const feasible={domain,insideBoxes:[],boundaryBoxes:[],witnessPoints:witnesses,status:'FEASIBLE' as const,toleranceMm:profile.numeric.feasibilityCoarseToleranceMm,cellsVisited:0,maxDepthReached:0,exactness:'EXACT' as const};
    const hypothesis:CandidateHypothesis={id:`${target}:${pattern.id}`,sizeMm:target,band,classX,classY,frame,pattern,permission,offsetsMm:offsets,feasible,boxes:[],scoreTrace:[],polygon};
    for(const translation of witnesses)result.push(scorePointCandidate(hypothesis,translation,regions,profile));
  }
  return{points:result,reasons};
}

function solveOneSize(source:ReturnType<typeof preparePolygon>,target:number,profile:RegisteredProfile):SizeSolution|SizeFailure{
  const polygon=scaleToDominantDimension(source,target);const classX=classifyAxis(polygon.metrics.width,profile.sizeDomain.bands);const classY=classifyAxis(polygon.metrics.height,profile.sizeDomain.bands);
  const expectedBand=profile.sizeDomain.bands.find(b=>target>=b.minMm-1e-12&&(b.maxInclusive?target<=b.maxMm+1e-12:target<b.maxMm-1e-12))?.id;
  if(!classX||!classY)return expectedBand?{status:'REJECTED',targetDominantMm:target,band:expectedBand,reasons:['NO_AXIS_CLASS']}:{status:'REJECTED',targetDominantMm:target,reasons:['NO_AXIS_CLASS']};
  const band=overallBand(classX,classY);const built=buildPointCandidates(polygon,target,band,classX,classY,profile);
  if(built.points.length===0)return{status:'REJECTED',targetDominantMm:target,band,reasons:built.reasons.length?built.reasons:['NO_PERMITTED_PATTERN']};
  built.points.sort((a,b)=>comparePointCandidates(a,b,profile));const radius=profile.safety.effectiveVerificationRadiusMm;
  let winner:PointCandidate|undefined;let centres:ReadonlyArray<{cell:readonly [number,number];xMm:number;yMm:number;clearanceMm:number;marginMm:number}>=[];
  for(const candidate of built.points){
    const proofs=candidate.hypothesis.pattern.cells.map((cell,index)=>{
      const offset=candidate.hypothesis.offsetsMm[index]!;const point={x:candidate.translation.x+offset.x,y:candidate.translation.y+offset.y};const proof=discContainedExact(polygon,point,radius);
      return{cell,xMm:proof.point.x,yMm:proof.point.y,clearanceMm:proof.clearanceMm,marginMm:proof.marginMm,legal:proof.legal};
    });
    if(proofs.every(p=>p.legal)){winner=candidate;centres=proofs.map(({legal:_legal,...rest})=>rest);break;}
  }
  if(!winner)return{status:'REJECTED',targetDominantMm:target,band,reasons:['EXACT_REVALIDATION_FAILED']};
  return{status:'ACCEPTED',targetDominantMm:target,widthMm:polygon.metrics.width,heightMm:polygon.metrics.height,scale:polygon.metrics.dominantDimension/source.metrics.dominantDimension,classX,classY,band,frame:winner.hypothesis.frame,patternId:winner.hypothesis.pattern.id,registration:winner.translation,centres:Object.freeze(centres),minimumMarginMm:Math.min(...centres.map(c=>c.marginMm)),scoreTrace:Object.freeze(winner.trace),geometryHash:polygon.geometryHash,decisionProof:'DETERMINISTIC_CRITICAL_SET_EXACT_LEGALITY',finalRingInt:Object.freeze(polygon.ringInt.map(p=>Object.freeze([p.x,p.y] as const)))};
}

function solveSizeSequence(source:ReturnType<typeof preparePolygon>,profile:RegisteredProfile,full:boolean):(SizeSolution|SizeFailure)[]{
  const all=candidateSizes(profile);if(full)return all.map(size=>solveOneSize(source,size,profile));
  const evaluated:(SizeSolution|SizeFailure)[]=[];
  for(const band of profile.sizeDomain.bands){
    const sizes=all.filter(size=>size>=band.minMm-1e-12&&(band.maxInclusive?size<=band.maxMm+1e-12:size<band.maxMm-1e-12));
    for(const size of sizes){const result=solveOneSize(source,size,profile);evaluated.push(result);if(result.status==='ACCEPTED'||result.status==='DECISION_INDETERMINATE')break;}
  }
  return evaluated;
}

function buildOffers(evaluated:readonly (SizeSolution|SizeFailure)[],profile:RegisteredProfile):BandOffer[]{
  return profile.sizeDomain.bands.map(band=>{const inBand=evaluated.filter(item=>item.band===band.id).sort((a,b)=>a.targetDominantMm-b.targetDominantMm);const accepted=inBand.find((x):x is SizeSolution=>x.status==='ACCEPTED');if(accepted)return{band:band.id,status:'OFFERED',solution:accepted,reasons:[]};if(inBand.some(x=>x.status==='DECISION_INDETERMINATE'))return{band:band.id,status:'DECISION_INDETERMINATE',reasons:['DECISION_INDETERMINATE']};return{band:band.id,status:'NO_SOLUTION',reasons:[...new Set(inBand.flatMap(x=>x.status==='ACCEPTED'?[]:x.reasons))]};});
}

export async function solveOutline(input:SolveInput):Promise<SolveResult>{
  const profile='profileHash'in input.profile&&input.profile.profileHash?input.profile as RegisteredProfile:registerProfile(input.profile);if(profile.approvalState!=='approved')throw new Error('PROFILE_UNAPPROVED');const source=preparePolygon(input.outlineMm,{quantumMm:profile.numeric.coordinateQuantumMm,maxVertices:profile.numeric.maxVertices});const evaluated=solveSizeSequence(source,profile,input.diagnosticLevel==='full');const offers=buildOffers(evaluated,profile);const payload={schema:'onemo-magnetic-solve-v1' as const,profileId:profile.id,profileHash:profile.profileHash,computeArtifactHash:COMPUTE_ARTIFACT_HASH,logicArtifactHash:LOGIC_ARTIFACT_HASH,sourceGeometryHash:source.geometryHash,evaluated,offers};return Object.freeze({...payload,canonicalHash:canonicalHash(payload)});
}
