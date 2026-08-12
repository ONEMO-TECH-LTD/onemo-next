#ifndef MAGFIT_MAGFIT_C_H
#define MAGFIT_MAGFIT_C_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define MAGFIT_MAX_NODES 81
#define MAGFIT_MAX_LINKS 144
#define MAGFIT_REASON_CAPACITY 192

typedef enum MagfitStatusC {
    MAGFIT_STATUS_OK = 0,
    MAGFIT_STATUS_INVALID_ARGUMENT = 1,
    MAGFIT_STATUS_INTERNAL_ERROR = 2
} MagfitStatusC;

typedef enum MagfitPhaseModeC {
    MAGFIT_PHASE_DISABLED = 0,
    MAGFIT_PHASE_ANY = 1,
    MAGFIT_PHASE_ALL = 2,
    MAGFIT_PHASE_FIXED = 3
} MagfitPhaseModeC;

typedef enum MagfitLayoutTierC {
    MAGFIT_LAYOUT_FULL = 0,
    MAGFIT_LAYOUT_CONNECTED_FALLBACK = 1,
    MAGFIT_LAYOUT_LINKED_THREE = 2,
    MAGFIT_LAYOUT_PAIR = 3
} MagfitLayoutTierC;

typedef enum MagfitBindingKindC {
    MAGFIT_BINDING_MAGNET_DISC = 0,
    MAGFIT_BINDING_DIRECT_CAPSULE = 1
} MagfitBindingKindC;

typedef struct MagfitGridPointC {
    int32_t x24;
    int32_t y24;
} MagfitGridPointC;

typedef struct MagfitLinkC {
    MagfitGridPointC a;
    MagfitGridPointC b;
} MagfitLinkC;

typedef struct MagfitPolicyC {
    int32_t dense_pitch_mm;
    int32_t half_pitch_mm;
    int32_t disc_radius_mm;
    int32_t size_step_mm;
    int32_t max_field_positions;
    int32_t max_trace_span_units;
    int32_t require_band_span;
    MagfitPhaseModeC sparse_mode;
    int32_t sparse_engage_from_band;
    int32_t sparse_min_active_nodes;
    int32_t sparse_require_96mm_connected;
    int32_t sparse_fixed_x_residue_mod4;
    int32_t sparse_fixed_y_residue_mod4;
} MagfitPolicyC;

typedef struct MagfitFlapMetricsC {
    int64_t exact_den;
    int64_t left_num;
    int64_t right_num;
    int64_t bottom_num;
    int64_t top_num;
    double left_mm;
    double right_mm;
    double bottom_mm;
    double top_mm;
    double horizontal_imbalance_mm;
    double vertical_imbalance_mm;
    int32_t coverage_within_12;
    int32_t coverage_within_24;
} MagfitFlapMetricsC;

typedef struct MagfitSideFlapEvidenceC {
    int32_t extent_reaches_12;
    int32_t extent_reaches_24;
    int32_t local_tongue_any_12;
    int32_t local_tongue_all_12;
    int32_t local_tongue_any_24;
    int32_t local_tongue_all_24;
    int32_t narrow_limb_exception_12;
    int32_t narrow_limb_exception_24;
    uint32_t failing_side_count_12;
    MagfitGridPointC failing_side_points_12[MAGFIT_MAX_NODES];
    uint32_t failing_side_count_24;
    MagfitGridPointC failing_side_points_24[MAGFIT_MAX_NODES];
} MagfitSideFlapEvidenceC;

typedef struct MagfitBindingContactC {
    MagfitBindingKindC kind;
    MagfitGridPointC node_a;
    int32_t node_b_present;
    MagfitGridPointC node_b;
    uint32_t polygon_edge_index;
    double clearance_mm;
    double slack_mm;
    int64_t clearance_um_floor;
    int64_t slack_um_floor;
} MagfitBindingContactC;

typedef struct MagfitBandResultC {
    int32_t band;
    MagfitLayoutTierC layout_tier;
    int32_t fit;
    int32_t manufactured_size_mm;
    int64_t manufactured_width_num;
    int64_t manufactured_height_num;
    int64_t manufactured_dimension_den;
    double manufactured_width_mm;
    double manufactured_height_mm;
    int32_t template_runs_x;
    int32_t template_runs_y;

    uint32_t magnet_count;
    MagfitGridPointC magnets[MAGFIT_MAX_NODES];

    uint32_t verified_link_count;
    MagfitLinkC verified_links[MAGFIT_MAX_LINKS];

    int32_t sparse_phase_present;
    int32_t sparse_x_residue_mod4;
    int32_t sparse_y_residue_mod4;
    int32_t sparse_connected;
    uint32_t sparse_active_count;
    MagfitGridPointC sparse_active_nodes[MAGFIT_MAX_NODES];

    MagfitBindingContactC binding;
    MagfitFlapMetricsC flap;
    MagfitSideFlapEvidenceC flap_left;
    MagfitSideFlapEvidenceC flap_right;
    MagfitSideFlapEvidenceC flap_bottom;
    MagfitSideFlapEvidenceC flap_top;
    char reason[MAGFIT_REASON_CAPACITY];
} MagfitBandResultC;

/* Stable textual version for logs, cache keys, and result provenance. */
const char* magfit_engine_version(void);

/* Fill a policy with the normative hardware defaults. */
void magfit_default_policy(MagfitPolicyC* out_policy);

/*
 * Solve exactly one band.
 *
 * xy contains vertex_count pairs [x0,y0,x1,y1,...] in arbitrary integer trace
 * units. The final repeated closing vertex is optional. The engine centres the
 * canonical polygon's axis-aligned bounding box at the lattice origin and
 * uniformly scales its maximum bbox span to each legal manufactured size.
 *
 * legal_sizes_mm may be NULL with legal_size_count == 0 to use the default band
 * interval. Otherwise it must be strictly ascending.
 *
 * Returns MAGFIT_STATUS_OK even when no layout fits; inspect out_result->fit.
 * Exceptions never cross this C boundary. On non-OK status, error_message is
 * populated when a non-null buffer is supplied.
 */
MagfitStatusC magfit_solve_band_i32(
    const int32_t* xy,
    size_t vertex_count,
    int32_t band,
    const int32_t* legal_sizes_mm,
    size_t legal_size_count,
    int32_t min_nodes,
    const MagfitPolicyC* policy,
    MagfitBandResultC* out_result,
    char* error_message,
    size_t error_message_capacity);

/*
 * Solve default specifications for several bands after canonicalising the
 * polygon once. out_results must have at least band_count elements.
 */
MagfitStatusC magfit_solve_bands_i32(
    const int32_t* xy,
    size_t vertex_count,
    const int32_t* bands,
    size_t band_count,
    const MagfitPolicyC* policy,
    MagfitBandResultC* out_results,
    size_t out_result_capacity,
    char* error_message,
    size_t error_message_capacity);

#ifdef __cplusplus
}  /* extern "C" */
#endif

#endif  /* MAGFIT_MAGFIT_C_H */
