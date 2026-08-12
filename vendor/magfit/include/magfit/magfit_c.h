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

typedef enum MagfitSelectionC {
    MAGFIT_SELECTION_LAYOUT_FIRST = 0,
    MAGFIT_SELECTION_SIZE_FIRST = 1
} MagfitSelectionC;

typedef enum MagfitBindingKindC {
    MAGFIT_BINDING_MAGNET_DISC = 0,
    MAGFIT_BINDING_LINK_CAPSULE = 1
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
    int32_t require_24mm_links;
    MagfitSelectionC selection;

    MagfitPhaseModeC sparse_mode;
    int32_t sparse_min_band;
    int32_t sparse_min_active_nodes;
    int32_t sparse_require_96mm_connected;
    int32_t sparse_fixed_x_residue_mod4;
    int32_t sparse_fixed_y_residue_mod4;
} MagfitPolicyC;

/*
 * Flap limits are MAXIMA (L14): within_* means the side's overhang is at most that many
 * millimetres. broad_beyond_* reports whether a full 24mm-wide fabric tongue anchored at
 * an outer-row magnet reaches past the limit — the trivial-limb witness. Evidence for a
 * reported exception, never an automatic approval.
 */
typedef struct MagfitFlapSideC {
    int64_t num;
    double mm;
    int32_t within_12;
    int32_t within_24;
    int32_t broad_beyond_12;
    int32_t broad_beyond_24;
} MagfitFlapSideC;

typedef struct MagfitFlapMetricsC {
    int64_t exact_den;
    MagfitFlapSideC left;
    MagfitFlapSideC right;
    MagfitFlapSideC bottom;
    MagfitFlapSideC top;
    double horizontal_imbalance_mm;
    double vertical_imbalance_mm;
} MagfitFlapMetricsC;

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

#ifdef __cplusplus
}  /* extern "C" */
#endif

#endif  /* MAGFIT_MAGFIT_C_H */
