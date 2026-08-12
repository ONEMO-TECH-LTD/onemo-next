#pragma once

#include <cstdint>
#include <optional>
#include <string>
#include <utility>
#include <vector>

namespace magfit {

using i64 = std::int64_t;

struct PointI {
    i64 x{};
    i64 y{};

    friend bool operator==(const PointI&, const PointI&) = default;
    friend bool operator<(const PointI& a, const PointI& b) {
        return (a.x < b.x) || (a.x == b.x && a.y < b.y);
    }
};

struct GridPoint {
    // Coordinates in 24 mm half-pitch units. Adjacent 48 mm nodes differ by 2.
    int x24{};
    int y24{};

    friend bool operator==(const GridPoint&, const GridPoint&) = default;
    friend bool operator<(const GridPoint& a, const GridPoint& b) {
        return (a.x24 < b.x24) || (a.x24 == b.x24 && a.y24 < b.y24);
    }
};

enum class PhaseMode {
    Disabled,
    Any,
    All,
    Fixed,
};

// Addendum v1.1 §B1: LayoutFirst = the full b×b square is the band's calibration; the
// smallest legal size holding it wins. Only when no size in the band holds the square does
// the engine fall back to the smallest size with any valid layout. SizeFirst = the base
// contract's first-passing-size behaviour, kept selectable for corpus comparison.
enum class Selection {
    LayoutFirst,
    SizeFirst,
};

struct SparsePolicy {
    PhaseMode mode{PhaseMode::Any};
    // Addendum v1.1 §B2: the 96mm lattice engages from this band up (Dan 2026-08-12:
    // "band 2 = 48mm grid only. 96 participates from band 3 up"). Below it no sparse
    // gate is applied.
    int min_band{3};
    // L14: the minimum pair must hold on the sparse population too — two active nodes,
    // 96mm apart, joined by a supported capsule.
    int min_active_nodes{2};
    bool require_96mm_connected{true};
    int fixed_x_residue_mod4{0};
    int fixed_y_residue_mod4{0};
};

struct EnginePolicy {
    int dense_pitch_mm{48};
    int half_pitch_mm{24};
    int disc_radius_mm{12};
    int size_step_mm{12};
    int max_field_positions{9};
    int max_trace_span_units{65'536};
    bool require_band_span{true};
    bool require_24mm_links{true};
    Selection selection{Selection::LayoutFirst};
    SparsePolicy sparse{};
};

struct BandSpec {
    int band{};
    std::vector<int> legal_sizes_mm;
    int min_nodes{2};
};

struct PolygonInput {
    // One closed solid polygon without holes. The final repeated closing vertex is optional.
    // Coordinates must already be canonical integer trace units.
    std::vector<PointI> vertices;
};

struct CanonicalPolygon {
    std::vector<PointI> vertices;
    i64 min_x{};
    i64 min_y{};
    i64 max_x{};
    i64 max_y{};
    i64 max_span{};
};

struct SparsePhaseResult {
    int x_residue_mod4{};
    int y_residue_mod4{};
    std::vector<GridPoint> active_nodes;
    bool connected{};
};

struct BindingContact {
    enum class Kind {
        MagnetDisc,
        LinkCapsule,
    };

    Kind kind{Kind::MagnetDisc};
    GridPoint node_a{};
    std::optional<GridPoint> node_b;
    std::size_t polygon_edge_index{};
    double clearance_mm{};
    double slack_mm{};
    std::int64_t clearance_um_floor{};
    std::int64_t slack_um_floor{};
};

// Addendum v1.1 §B3. Flap = the shape's overhang beyond the padded magnet box, per side —
// Dan's ruled measure. The 12/24 values are MAXIMA (L14: "no flap zone greater than
// 12–24mm on any side"): a side passes a limit when its flap is AT MOST that limit.
// When a side exceeds a limit, `broad_beyond_*` says whether a full 24mm-wide tongue of
// fabric (capsule anchored at an outer-row magnet) actually reaches past that limit:
// true → genuine oversized flap; false → the overhang is a thin feature — the ruled
// trivial-limb exception, reported and never auto-approved.
struct FlapSide {
    i64 num{};
    double mm{};
    bool within_12{};
    bool within_24{};
    bool broad_beyond_12{};
    bool broad_beyond_24{};
};

struct FlapMetrics {
    // Exact flap values are numerator / exact_den millimetres.
    i64 exact_den{1};
    FlapSide left;
    FlapSide right;
    FlapSide bottom;
    FlapSide top;
    double horizontal_imbalance_mm{};
    double vertical_imbalance_mm{};
};

struct BandResult {
    int band{};
    bool fit{};
    int manufactured_size_mm{};
    // Exact dimensions are numerator / manufactured_dimension_den millimetres.
    i64 manufactured_width_num{};
    i64 manufactured_height_num{};
    i64 manufactured_dimension_den{1};
    double manufactured_width_mm{};
    double manufactured_height_mm{};
    int template_runs_x{};
    int template_runs_y{};
    std::vector<GridPoint> magnets;
    std::vector<std::pair<GridPoint, GridPoint>> verified_links;
    std::optional<SparsePhaseResult> sparse_phase;
    BindingContact binding;
    FlapMetrics flap;
    std::string reason;
};

struct SolveResult {
    CanonicalPolygon polygon;
    std::vector<BandResult> bands;
};

CanonicalPolygon canonicalize_and_validate(const PolygonInput& input,
                                           const EnginePolicy& policy = {});

BandSpec default_band_spec(int band, const EnginePolicy& policy = {});

SolveResult solve_canonical(const CanonicalPolygon& polygon,
                            const std::vector<BandSpec>& bands,
                            const EnginePolicy& policy = {});

SolveResult solve(const PolygonInput& input,
                  const std::vector<BandSpec>& bands,
                  const EnginePolicy& policy = {});

}  // namespace magfit
