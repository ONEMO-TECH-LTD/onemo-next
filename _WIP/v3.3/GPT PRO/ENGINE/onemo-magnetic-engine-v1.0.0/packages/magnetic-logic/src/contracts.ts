import type {
  Bounds, ComponentHierarchy, CompoundScoreInterval, FeasibleTranslationSet, GeometryCriterionDescriptor,
  Point, PreparedPolygon, SafeComponent, ScoreInterval
} from '@onemo/geometry-compute';
export type { Bounds, Point } from '@onemo/geometry-compute';

export type ApprovalState='draft'|'approved'|'retired';
export type BandId='B1'|'B2'|'B3'|'B4'|'B5';
export type AxisClass=1|2|3|4|5;

export interface BandDefinition {readonly id:BandId;readonly class:AxisClass;readonly minMm:number;readonly maxMm:number;readonly maxInclusive?:boolean;readonly referenceMm:number;}
export interface PopulationDefinition {readonly id:string;readonly strideCells:number;readonly enabled:boolean;readonly originParities:readonly (readonly [number,number])[];}
export interface PatternDefinition {
  readonly id:string;readonly version:number;readonly populationId:string;
  readonly cells:readonly (readonly [number,number])[];
  readonly symmetryFamily?:string;readonly frameId:string;
}
export interface PatternPermission {
  readonly patternId:string;readonly bands:readonly BandId[];
  readonly minClassX:AxisClass;readonly minClassY:AxisClass;
  readonly marginalNodesAllowed:boolean;readonly patternRank:number;
}
export interface StructuralPolicy {
  readonly sampleStepMm:number;
  readonly clearanceSurplusLevelsMm:readonly number[];
  readonly majorMinAreaDiscRatio:number;
  readonly majorMinAreaShapeFraction:number;
  readonly majorMinPersistenceLevels:number;
  readonly forceLargestComponentMajor:boolean;
}
export interface TolerancePolicy {
  readonly id:'POST_TOLERANCE_MINIMUM_V1'|'NOMINAL_ACCEPTED_RISK_V1';
  readonly cutMm:number;readonly placementMm:number;readonly materialMm:number;readonly assemblyMm:number;
}
export interface MechanicsCriterionPolicy {
  readonly id:string;
  readonly descriptorId:GeometryCriterionDescriptor['id'];
  readonly tolerances:readonly number[];
  readonly toleranceRule?:'Q_TIMES_AREA'|'Q'|'Q_AND_CENTROID_SQUARED';
}
export interface ProductProfile {
  readonly schema:'onemo-magnetic-profile-v1';
  readonly id:string;readonly version:number;readonly approvalState:ApprovalState;readonly productionReady:boolean;
  readonly numeric:{readonly coordinateQuantumMm:number;readonly approximationToleranceMm:number;readonly feasibilityCoarseToleranceMm:number;readonly maxAdaptiveCells:number;readonly maxVertices:number};
  readonly grid:{readonly cellMm:number;readonly nodeStrideCells:number;readonly displayViewportCells:number;readonly populations:readonly PopulationDefinition[]};
  readonly safety:{readonly baseProtectedRadiusMm:number;readonly effectiveVerificationRadiusMm:number;readonly tolerancePolicy:TolerancePolicy};
  readonly sizeDomain:{readonly minMm:number;readonly maxMm:number;readonly stepMm:number;readonly bands:readonly BandDefinition[];readonly primaryOffer:'SMALLEST_ACCEPTED_PER_BAND'};
  readonly translation:{readonly periodMm:number;readonly allowX:boolean;readonly allowY:boolean};
  readonly structural:StructuralPolicy;
  readonly patterns:readonly PatternDefinition[];
  readonly permissions:readonly PatternPermission[];
  readonly mechanics:{readonly registryId:'onemo-mechanics-v1';readonly topDirection:Point;readonly criteria:readonly MechanicsCriterionPolicy[]};
  readonly subQuantumPolicy:'DECISION_INDETERMINATE';
  readonly b1Guarantee:'ONLY_WHEN_LAWFUL_IN_B1';
  readonly provenance:Readonly<Record<string,string>>;
  readonly engineeringAssumptions:readonly string[];
  readonly profileHash?:string;
}

export interface RegisteredProfile extends ProductProfile {readonly profileHash:string;}

export interface RegionClassification {
  readonly component:SafeComponent;
  readonly class:'MAJOR'|'MARGINAL'|'CONNECTOR_ONLY'|'UNCLASSIFIED_NEAR_TOLERANCE';
  readonly persistenceLevels:ScoreInterval;
  readonly areaDiscRatio:ScoreInterval;
  readonly areaShapeFraction:ScoreInterval;
}

export interface FrameHypothesis {
  readonly id:string;readonly nx:number;readonly ny:number;readonly populationId:string;
  readonly populationOriginParity?:readonly [number,number];
}

export interface CandidateHypothesis {
  readonly id:string;readonly sizeMm:number;readonly band:BandId;readonly classX:AxisClass;readonly classY:AxisClass;
  readonly frame:FrameHypothesis;readonly pattern:PatternDefinition;readonly permission:PatternPermission;
  readonly offsetsMm:readonly Point[];readonly feasible:FeasibleTranslationSet;
  readonly boxes:readonly import('@onemo/geometry-compute').AdaptiveBox[];
  readonly scoreTrace:readonly CandidateScoreTrace[];
  readonly polygon:PreparedPolygon;
}

export interface CandidateScoreTrace {
  readonly criterionId:string;readonly descriptorId:string;
  readonly score:ScoreInterval|CompoundScoreInterval;
  readonly status:'CERTIFIED'|'INDETERMINATE_WITHIN_TOLERANCE';
}

export interface MagnetCentre {
  readonly cell:readonly [number,number];readonly xMm:number;readonly yMm:number;
  readonly clearanceMm:number;readonly marginMm:number;
}

export interface SizeSolution {
  readonly status:'ACCEPTED';readonly targetDominantMm:number;readonly widthMm:number;readonly heightMm:number;
  readonly scale:number;readonly classX:AxisClass;readonly classY:AxisClass;readonly band:BandId;
  readonly frame:FrameHypothesis;readonly patternId:string;readonly registration:Point;
  readonly centres:readonly MagnetCentre[];readonly minimumMarginMm:number;
  readonly scoreTrace:readonly CandidateScoreTrace[];readonly geometryHash:string;
  readonly decisionProof:'DETERMINISTIC_CRITICAL_SET_EXACT_LEGALITY'|'CERTIFIED_CONTINUOUS_OPTIMUM';
  readonly finalRingInt:readonly (readonly [number,number])[];
}

export interface SizeFailure {
  readonly status:'REJECTED'|'DECISION_INDETERMINATE';readonly targetDominantMm:number;readonly band?:BandId;
  readonly reasons:readonly string[];readonly diagnostics?:Readonly<Record<string,unknown>>;
}

export interface BandOffer {readonly band:BandId;readonly solution?:SizeSolution;readonly status:'OFFERED'|'NO_SOLUTION'|'DECISION_INDETERMINATE';readonly reasons:readonly string[];}

export interface SolveResult {
  readonly schema:'onemo-magnetic-solve-v1';readonly profileId:string;readonly profileHash:string;
  readonly computeArtifactHash:string;readonly logicArtifactHash:string;readonly sourceGeometryHash:string;
  readonly evaluated:readonly (SizeSolution|SizeFailure)[];readonly offers:readonly BandOffer[];
  readonly canonicalHash:string;
}

export interface SolveInput {readonly outlineMm:readonly Point[];readonly profile:ProductProfile|RegisteredProfile;readonly diagnosticLevel?:'none'|'summary'|'full';}

export interface EngineManufacturingSpec {
  readonly schema:'onemo-engine-manufacturing-spec-v1';readonly schemaVersion:1;
  readonly computeArtifactHash:string;readonly logicArtifactHash:string;readonly profileId:string;readonly profileHash:string;
  readonly sourceGeometryHash:string;readonly finalGeometryHash:string;readonly finalRingInt:readonly (readonly [number,number])[];
  readonly widthMm:number;readonly heightMm:number;readonly scale:number;readonly coordinateQuantumMm:number;
  readonly band:BandId;readonly populationId:string;readonly frameId:string;readonly patternId:string;
  readonly registration:Point;readonly selectedCellAddresses:readonly (readonly [number,number])[];
  readonly centres:readonly MagnetCentre[];readonly baseProtectedRadiusMm:number;readonly effectiveVerificationRadiusMm:number;
  readonly toleranceCompositionRuleId:string;readonly approximationToleranceMm:number;readonly minimumMarginMm:number;
  readonly decisionTrace:readonly CandidateScoreTrace[];readonly decisionProof:SizeSolution['decisionProof'];
  readonly proofStatus:'CERTIFIED_CONTINUOUS_OPTIMUM_EXACT_AT_QUANTUM'|'REFERENCE_PROFILE_NOT_PRODUCTION'|'INTERACTIVE_RESULT_NOT_CERTIFIED_FOR_PRODUCTION';
  readonly canonicalHash:string;
}

export interface PhysicalComponentProfile {
  readonly id:string;readonly version:number;readonly magnetDiameterMm:number;readonly magnetThicknessMm:number;
  readonly cutToleranceMm:number;readonly placementToleranceMm:number;readonly materialToleranceMm:number;readonly assemblyToleranceMm:number;
  readonly assemblyProfileId:string;
}

export interface FulfilmentManufacturingSpec {
  readonly schema:'onemo-fulfilment-manufacturing-spec-v1';readonly engineSpec:EngineManufacturingSpec;
  readonly physicalComponent:PhysicalComponentProfile;readonly verificationStatus:'VERIFIED';readonly canonicalHash:string;
}

export interface SolverContext {
  readonly profile:RegisteredProfile;readonly source:PreparedPolygon;
}

export interface StructuralEvidence {
  readonly hierarchy:ComponentHierarchy;readonly classifications:readonly RegionClassification[];
  readonly status:'CERTIFIED'|'INDETERMINATE';readonly reasons:readonly string[];
}
