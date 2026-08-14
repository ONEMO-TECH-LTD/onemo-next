export type DecimalString = string;
export type ExactRationalString = string;
export type IntPair = readonly [number, number];
export type ExactPoint = readonly [ExactRationalString, ExactRationalString];
export type DecimalPoint = readonly [DecimalString, DecimalString];

export type ArrangementClass =
  | "single_site"
  | "horizontal_pair"
  | "vertical_pair"
  | "diagonal_pair"
  | "complete_rectangular_window"
  | "row_skipping"
  | "column_skipping"
  | "corner_triangle"
  | "corner_rectangle";

export type CorridorMode = "report" | "require";

export interface PhysicalSizeSpec {
  readonly id: string;
  readonly band: string;
  readonly max_extent_mm: DecimalString;
}

export interface FieldSpec {
  readonly min_x: number;
  readonly max_x: number;
  readonly min_y: number;
  readonly max_y: number;
}

export interface RegistrationSpec {
  readonly id: string;
  readonly origin_mm: DecimalPoint;
}

export interface PopulationSpec {
  readonly id: string;
  readonly stride: number;
  readonly phase: IntPair;
}

export interface PatternEdgeSpec {
  readonly from: number;
  readonly to: number;
  readonly corridor: CorridorMode;
}

export interface ArrangementPatternSpec {
  readonly id: string;
  readonly class: ArrangementClass;
  readonly sites: readonly IntPair[];
  readonly edges: readonly PatternEdgeSpec[];
}

export interface SolveRequest {
  readonly schema: "onemo.magnetic.solve.request/1";
  readonly outline: readonly DecimalPoint[];
  readonly scale_basis: "max_bbox_extent";
  readonly magnet_radius_mm: DecimalString;
  readonly base_pitch_mm: DecimalString;
  readonly field: FieldSpec;
  readonly sizes: readonly PhysicalSizeSpec[];
  readonly registrations: readonly RegistrationSpec[];
  readonly populations: readonly PopulationSpec[];
  readonly patterns: readonly ArrangementPatternSpec[];
}

export interface EngineErrorResult {
  readonly schema: "onemo.magnetic.solve.result/1";
  readonly status: "error";
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

export interface BoundaryWitnessResult {
  readonly edge_index: number;
  readonly boundary_point_mm: ExactPoint;
}

export interface SiteFactResult {
  readonly pattern_site_index: number;
  readonly pattern_index: IntPair;
  readonly base_index: IntPair;
  readonly coordinate_mm: ExactPoint;
  readonly center_location: "inside" | "boundary" | "outside";
  readonly boundary_clearance_mm_exact: {
    readonly squared_mm2: ExactRationalString;
  };
  readonly limiting_witness: BoundaryWitnessResult;
  readonly complete_disc_contained: boolean;
}

export interface CorridorFactResult {
  readonly pattern_edge_index: number;
  readonly from_site: number;
  readonly to_site: number;
  readonly corridor_mode: CorridorMode;
  readonly centerline_contained: boolean;
  readonly centerline_boundary_clearance_mm_exact: {
    readonly squared_mm2: ExactRationalString;
  };
  readonly limiting_witness: {
    readonly boundary_edge_index: number;
    readonly centerline_point_mm: ExactPoint;
    readonly boundary_point_mm: ExactPoint;
  };
  readonly complete_corridor_contained: boolean;
}

export interface CandidateResult {
  readonly id: string;
  readonly size_id: string;
  readonly band: string;
  readonly physical_size_mm: ExactRationalString;
  readonly population: {
    readonly id: string;
    readonly stride: number;
    readonly phase: IntPair;
  };
  readonly registration_id: string;
  readonly arrangement_class: ArrangementClass;
  readonly pattern_id: string;
  readonly placement_population_index: IntPair;
  readonly sites: readonly SiteFactResult[];
  readonly edges: readonly CorridorFactResult[];
}

export interface SizeResult {
  readonly id: string;
  readonly band: string;
  readonly max_extent_mm: ExactRationalString;
  readonly canonical_to_physical_scale: ExactRationalString;
  readonly physical_to_canonical_scale: ExactRationalString;
  readonly candidate_count: number;
}

export interface LatticeResult {
  readonly registration_id: string;
  readonly origin_mm: ExactPoint;
  readonly base_sites: readonly {
    readonly index: IntPair;
    readonly coordinate_mm: ExactPoint;
  }[];
}

export interface EngineOkResult {
  readonly schema: "onemo.magnetic.solve.result/1";
  readonly status: "ok";
  readonly outline: {
    readonly vertex_count: number;
    readonly canonical_orientation: "counter_clockwise";
    readonly scale_basis: "max_bbox_extent";
    readonly bbox_canonical: {
      readonly min: ExactPoint;
      readonly max: ExactPoint;
      readonly center: ExactPoint;
      readonly max_extent: ExactRationalString;
    };
  };
  readonly physical_spec: {
    readonly magnet_radius_mm: ExactRationalString;
    readonly base_pitch_mm: ExactRationalString;
    readonly field: FieldSpec;
    readonly populations: readonly {
      readonly id: string;
      readonly stride: number;
      readonly phase: IntPair;
    }[];
  };
  readonly sizes: readonly SizeResult[];
  readonly lattices: readonly LatticeResult[];
  readonly candidates: readonly CandidateResult[];
  readonly metrics: {
    readonly prepared_vertex_count: number;
    readonly site_facts_computed: number;
    readonly corridor_facts_computed: number;
    readonly placements_tested: number;
    readonly candidates_emitted: number;
  };
}

export type EngineResult = EngineOkResult | EngineErrorResult;

export interface GuardedPhysicalSpec {
  readonly magnet_radius_mm: DecimalString;
  readonly base_pitch_mm: DecimalString;
  readonly field: FieldSpec;
  readonly sizes: readonly PhysicalSizeSpec[];
  readonly registrations: readonly RegistrationSpec[];
  readonly populations: readonly PopulationSpec[];
}
