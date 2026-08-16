import type { PatternDefinition, PatternPermission, ProductProfile } from './contracts.js';
import { registerProfile } from './profile-registry.js';

const patterns:PatternDefinition[]=[
  {id:'single',version:1,populationId:'grid48',cells:[[0,0]],variantId:'default',frameId:'1x1'},
  {id:'pair.vertical',version:1,populationId:'grid48',cells:[[0,-1],[0,1]],variantId:'vertical',frameId:'1x2'},
  {id:'pair.horizontal',version:1,populationId:'grid48',cells:[[-1,0],[1,0]],variantId:'horizontal',frameId:'2x1'},
  {id:'row.3',version:1,populationId:'grid48',cells:[[-2,0],[0,0],[2,0]],variantId:'horizontal',frameId:'3x1'},
  {id:'column.3',version:1,populationId:'grid48',cells:[[0,-2],[0,0],[0,2]],variantId:'vertical',frameId:'1x3'},
  {id:'square.4',version:1,populationId:'grid48',cells:[[-1,-1],[1,-1],[-1,1],[1,1]],variantId:'default',frameId:'2x2'},
  {id:'l.bottom-left',version:1,populationId:'grid48',cells:[[-1,-1],[1,-1],[-1,1]],symmetryFamily:'l.3',variantId:'bottom-left',frameId:'2x2'},
  {id:'l.bottom-right',version:1,populationId:'grid48',cells:[[-1,-1],[1,-1],[1,1]],symmetryFamily:'l.3',variantId:'bottom-right',frameId:'2x2'},
  {id:'l.top-left',version:1,populationId:'grid48',cells:[[-1,-1],[-1,1],[1,1]],symmetryFamily:'l.3',variantId:'top-left',frameId:'2x2'},
  {id:'l.top-right',version:1,populationId:'grid48',cells:[[1,-1],[-1,1],[1,1]],symmetryFamily:'l.3',variantId:'top-right',frameId:'2x2'},
  {id:'t.top1-bottom3',version:1,populationId:'grid48',cells:[[0,2],[-2,-2],[0,-2],[2,-2]],variantId:'default',frameId:'3x3'}
];

function permission(patternId:string,bands:PatternPermission['bands'],minimumX:PatternPermission['allowedAxisClassPairs'][number][0],minimumY:PatternPermission['allowedAxisClassPairs'][number][1],patternRank:number):PatternPermission{
  const allowedAxisClassPairs:(readonly [PatternPermission['allowedAxisClassPairs'][number][0],PatternPermission['allowedAxisClassPairs'][number][1]])[]=[];
  for(let x=minimumX;x<=5;x++)for(let y=minimumY;y<=5;y++)if(bands.includes(`B${Math.max(x,y)}` as PatternPermission['bands'][number]))allowedAxisClassPairs.push([x as typeof minimumX,y as typeof minimumY] as const);
  return{patternId,bands,allowedAxisClassPairs,allowedPopulationIds:['grid48'],marginalNodesAllowed:false,requiredMajorRegionsCovered:1,alternativeOrientationsConsidered:false,primaryOfferAllowed:true,fallbackAllowed:true,patternRank};
}
const permissions:PatternPermission[]=[
  permission('single',['B1'],1,1,0),
  permission('pair.vertical',['B2','B3','B4','B5'],1,2,0),
  permission('pair.horizontal',['B2','B3','B4','B5'],2,1,0),
  permission('square.4',['B2','B3','B4','B5'],2,2,2),
  ...['l.bottom-left','l.bottom-right','l.top-left','l.top-right'].map(patternId=>permission(patternId,['B2','B3','B4','B5'],2,2,1)),
  permission('row.3',['B3','B4','B5'],3,1,1),
  permission('column.3',['B3','B4','B5'],1,3,1),
  permission('t.top1-bottom3',['B3','B4','B5'],3,3,0)
];

export function createReferenceProfile():ReturnType<typeof registerProfile>{
  const q=0.01;
  const profile:ProductProfile={
    schema:'onemo-magnetic-profile-v1',id:'onemo-magnetic-v1-reference',version:1,approvalState:'approved',productionReady:false,
    numeric:{coordinateQuantumMm:q,approximationToleranceMm:q/4,feasibilityCoarseToleranceMm:0.25,maxAdaptiveCells:120000,maxVertices:4096},
    grid:{cellMm:24,nodeStrideCells:2,displayViewportCells:10,populations:[{id:'grid48',strideCells:2,enabled:true,originParities:[[0,0]]}]},
    safety:{baseProtectedRadiusMm:12,effectiveVerificationRadiusMm:12,tolerancePolicy:{id:'POST_TOLERANCE_MINIMUM_V1',cutMm:0,placementMm:0,materialMm:0,assemblyMm:0}},
    sizeDomain:{minMm:24,maxMm:264,stepMm:12,bands:[
      {id:'B1',class:1,minMm:24,maxMm:72,referenceMm:24},
      {id:'B2',class:2,minMm:72,maxMm:120,referenceMm:72},
      {id:'B3',class:3,minMm:120,maxMm:168,referenceMm:120},
      {id:'B4',class:4,minMm:168,maxMm:216,referenceMm:168},
      {id:'B5',class:5,minMm:216,maxMm:264,maxInclusive:true,referenceMm:216}
    ],primaryOffer:'SMALLEST_ACCEPTED_PER_BAND'},
    translation:{periodMm:48,allowX:true,allowY:true},
    structural:{sampleStepMm:6,clearanceSurplusLevelsMm:[0,4,8,12],majorMinAreaDiscRatio:0.05,majorMinAreaShapeFraction:0.01,majorMinPersistenceLevels:2,forceLargestComponentMajor:true},
    patterns,permissions,
    mechanics:{registryId:'onemo-mechanics-v1',topDirection:{x:0,y:1},criteria:[
      {id:'M01_MAJOR_COVERAGE',descriptorId:'REGION_COVERAGE_V1',tolerances:[0,0]},
      {id:'M02_UPPER_REGION',descriptorId:'REGION_SUBSET_COVERAGE_V1',tolerances:[0]},
      {id:'M03_UPPER_MOMENT',descriptorId:'CAP_FIRST_MOMENT_V1',tolerances:[0],toleranceRule:'Q_TIMES_AREA'},
      {id:'M04_MAX_OVERHANG',descriptorId:'MAX_DIRECTIONAL_OVERHANG_V1',tolerances:[q],toleranceRule:'Q'},
      {id:'M05_PATTERN_RANK',descriptorId:'DISCRETE_SCALAR_V1',tolerances:[0]},
      {id:'M06_REGION_LOAD',descriptorId:'REGION_MAX_LOAD_V1',tolerances:[0]},
      {id:'M07_BALANCE',descriptorId:'ANCHOR_CENTROID_BALANCE_V1',tolerances:[q,0],toleranceRule:'Q_AND_CENTROID_SQUARED'},
      {id:'M08_ANCHOR_COUNT',descriptorId:'POINT_COUNT_V1',tolerances:[0]},
      {id:'M09_DISCRETE_ID',descriptorId:'DISCRETE_KEY_V1',tolerances:[]},
      {id:'M10_REGISTRATION_ID',descriptorId:'FINAL_REGISTRATION_ORDER_V1',tolerances:[]}
    ]},
    subQuantumPolicy:'DECISION_INDETERMINATE',b1Guarantee:'ONLY_WHEN_LAWFUL_IN_B1',
    provenance:{
      PD01:'24 mm protected disc / 12 mm radius',PD02:'24 mm base cell',PD03:'48 mm master-node pitch',PD05:'24/72/120/168/216 references',PD06:'dominant-side band',PD11:'B1 bbox-centre start',PD12:'odd/even parity',PD13:'continuous registration',PD28:'Batwoman outcome constraints'
    },
    engineeringAssumptions:[
      '96 mm sparse population is disabled because PD-04/PD-34 has no verified product approval in the source files.',
      'Structural thresholds and pattern permissions are conservative reference defaults because PD-17 and PD-19 contain no numeric/matrix values.',
      'Sub-quantum feasibility returns DECISION_INDETERMINATE.',
      'No universal B1 guarantee is made.',
      'Physical tolerances are zero in this reference profile; productionReady is false until real process tolerances and a component profile are supplied.',
      'The canonical Batwoman vector fixture is not bundled because the approved source geometry was not supplied.'
    ]
  };
  return registerProfile(profile);
}
