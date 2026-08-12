#pragma once

#include <cstdint>
#include <optional>
#include <string>
#include <tuple>
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

enum class LayoutKind {
    Full,
    Connected,
    LinkedThree,
    Pair,
};

enum class SparseStatus {
    NotEngaged,
    Compatible,
    Incompatible,
};

struct TemplateWindow {
    int runs_x{};
    int runs_y{};

    friend bool operator==(const TemplateWindow&, const TemplateWindow&) = default;
    friend bool operator<(const TemplateWindow& a, const TemplateWindow& b) {
        return std::tie(a.runs_x, a.runs_y) < std::tie(b.runs_x, b.runs_y);
    }
};

struct SparsePolicy {
    PhaseMode mode{PhaseMode::Any};
    int engage_from_band{3};
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
    bool compatible{};

    friend bool operator==(const SparsePhaseResult&, const SparsePhaseResult&) = default;
};

struct BindingContact {
    enum class Kind {
        MagnetDisc,
        DirectCapsule,
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

struct SideFlapEvidence {
    bool extent_reaches_12{};
    bool extent_reaches_24{};
    // Finite outer-node and gap-midpoint witnesses, not a continuous side proof.
    bool sampled_tongue_any_12{};
    bool sampled_tongue_all_12{};
    bool sampled_tongue_any_24{};
    bool sampled_tongue_all_24{};
    bool narrow_limb_exception_12{};
    bool narrow_limb_exception_24{};
    // Outer magnets plus the midpoint of each adjacent side gap, all in the
    // same 24 mm coordinate unit used by GridPoint.
    std::vector<GridPoint> failing_side_points_12;
    std::vector<GridPoint> failing_side_points_24;
};

struct FlapMetrics {
    // Exact flap values are numerator / exact_den millimetres.
    i64 exact_den{1};
    i64 left_num{};
    i64 right_num{};
    i64 bottom_num{};
    i64 top_num{};
    double left_mm{};
    double right_mm{};
    double bottom_mm{};
    double top_mm{};
    double horizontal_imbalance_mm{};
    double vertical_imbalance_mm{};
    bool coverage_within_12{};
    bool coverage_within_24{};
    SideFlapEvidence left;
    SideFlapEvidence right;
    SideFlapEvidence bottom;
    SideFlapEvidence top;
};

struct LayoutOption {
    int band{};
    LayoutKind layout_kind{LayoutKind::Connected};
    int manufactured_size_mm{};
    // Exact dimensions are numerator / manufactured_dimension_den millimetres.
    i64 manufactured_width_num{};
    i64 manufactured_height_num{};
    i64 manufactured_dimension_den{1};
    double manufactured_width_mm{};
    double manufactured_height_mm{};
    // A physical option may be discovered through overlapping parent windows.
    // They are provenance only and do not create duplicate options.
    std::vector<TemplateWindow> source_windows;
    std::vector<GridPoint> magnets;
    std::vector<std::pair<GridPoint, GridPoint>> verified_links;
    SparseStatus sparse_status{SparseStatus::NotEngaged};
    // Empty means sparse is not engaged. Otherwise every evaluated phase is
    // reported, including incompatible phases; sparse policy is evidence only.
    std::vector<SparsePhaseResult> sparse_phases;
    BindingContact binding;
    FlapMetrics flap;
};

struct BandReview {
    int band{};
    std::vector<LayoutOption> options;
    std::string reason;
};

struct SolveResult {
    CanonicalPolygon polygon;
    std::vector<BandReview> bands;
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
