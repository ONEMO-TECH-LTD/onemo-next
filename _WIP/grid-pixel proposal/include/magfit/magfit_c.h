#ifndef MAGFIT_MAGFIT_C_H
#define MAGFIT_MAGFIT_C_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define MAGFIT_MAX_NODES 81
#define MAGFIT_MAX_LINKS 144

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

typedef enum MagfitLayoutKindC {
    MAGFIT_LAYOUT_FULL = 0,
    MAGFIT_LAYOUT_CONNECTED = 1,
    MAGFIT_LAYOUT_LINKED_THREE = 2,
    MAGFIT_LAYOUT_PAIR = 3
} MagfitLayoutKindC;

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
    int32_t sampled_tongue_any_12;
    int32_t sampled_tongue_all_12;
    int32_t sampled_tongue_any_24;
    int32_t sampled_tongue_all_24;
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

typedef struct MagfitTemplateWindowC {
    int32_t runs_x;
    int32_t runs_y;
} MagfitTemplateWindowC;

typedef struct MagfitLayoutOptionC {
    int32_t band;
    MagfitLayoutKindC layout_kind;
    int32_t manufactured_size_mm;
    int64_t manufactured_width_num;
    int64_t manufactured_height_num;
    int64_t manufactured_dimension_den;
    double manufactured_width_mm;
    double manufactured_height_mm;
    uint32_t source_window_count;
    MagfitTemplateWindowC source_windows[MAGFIT_MAX_NODES];

    uint32_t magnet_count;
    MagfitGridPointC magnets[MAGFIT_MAX_NODES];

    uint32_t verified_link_count;
    MagfitLinkC verified_links[MAGFIT_MAX_LINKS];

    uint32_t sparse_phase_count;
    int32_t sparse_x_residue_mod4[4];
    int32_t sparse_y_residue_mod4[4];
    int32_t sparse_connected[4];
    uint32_t sparse_active_count[4];
    MagfitGridPointC sparse_active_nodes[4][MAGFIT_MAX_NODES];

    MagfitBindingContactC binding;
    MagfitFlapMetricsC flap;
    MagfitSideFlapEvidenceC flap_left;
    MagfitSideFlapEvidenceC flap_right;
    MagfitSideFlapEvidenceC flap_bottom;
    MagfitSideFlapEvidenceC flap_top;
} MagfitLayoutOptionC;

typedef int32_t (*MagfitOptionVisitorC)(const MagfitLayoutOptionC* option,
                                       void* user_data);

/* Stable textual version for logs, cache keys, and result provenance. */
const char* magfit_engine_version(void);

/* Fill a policy with the normative hardware defaults. */
void magfit_default_policy(MagfitPolicyC* out_policy);

/*
 * Enumerate every lawful option for exactly one band in canonical order.
 *
 * xy contains vertex_count pairs [x0,y0,x1,y1,...] in arbitrary integer trace
 * units. The final repeated closing vertex is optional. The engine centres the
 * canonical polygon's axis-aligned bounding box at the lattice origin and
 * uniformly scales its maximum bbox span to each legal manufactured size.
 *
 * legal_sizes_mm may be NULL with legal_size_count == 0 to use the default band
 * interval. Otherwise it must be strictly ascending.
 *
 * The visitor is called once per option. Returning zero stops enumeration and
 * reports an invalid argument. Zero options is a successful NO_FIT review.
 * Exceptions never cross this C boundary. On non-OK status, error_message is
 * populated when a non-null buffer is supplied.
 */
MagfitStatusC magfit_review_band_i32(
    const int32_t* xy,
    size_t vertex_count,
    int32_t band,
    const int32_t* legal_sizes_mm,
    size_t legal_size_count,
    int32_t min_nodes,
    const MagfitPolicyC* policy,
    MagfitOptionVisitorC visitor,
    void* user_data,
    size_t* out_option_count,
    char* error_message,
    size_t error_message_capacity);

/*
 * Review default specifications for several bands after canonicalising the
 * polygon once. Options remain band-scoped and are visited in requested-band
 * order, then canonical option order.
 */
MagfitStatusC magfit_review_bands_i32(
    const int32_t* xy,
    size_t vertex_count,
    const int32_t* bands,
    size_t band_count,
    const MagfitPolicyC* policy,
    MagfitOptionVisitorC visitor,
    void* user_data,
    size_t* out_option_count,
    char* error_message,
    size_t error_message_capacity);

#ifdef __cplusplus
}  /* extern "C" */
#endif

#endif  /* MAGFIT_MAGFIT_C_H */
