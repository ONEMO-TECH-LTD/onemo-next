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

struct SparsePolicy {
    PhaseMode mode{PhaseMode::Any};
    int min_active_nodes{1};
    bool require_96mm_connected{false};
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
    bool left_ge_12{};
    bool right_ge_12{};
    bool bottom_ge_12{};
    bool top_ge_12{};
    bool left_ge_24{};
    bool right_ge_24{};
    bool bottom_ge_24{};
    bool top_ge_24{};
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


// ---------------------------------------------------------------------------
// PURE MEASUREMENT — added for the all-options directive (Dan, 2026-08-12).
// Reports every lattice position at every legal size. Nothing is required,
// filtered, ranked or discarded; no policy is consulted. The geometry below is
// GPT Pro's, unchanged — this only exposes it without a selector in front.
// ---------------------------------------------------------------------------

struct NodeMeasurement {
    GridPoint node{};
    int x_mm{};
    int y_mm{};
    bool supported{};              // whole 24mm disc on fabric; tangency holds
    double clearance_mm{};         // to the nearest outline edge; negative when outside
    std::int64_t clearance_um_floor{};
};

struct SizeMeasurement {
    int band{};
    int size_mm{};
    double width_mm{};
    double height_mm{};
    std::vector<NodeMeasurement> nodes;
    int supported_count{};
};

std::vector<SizeMeasurement> measure_all(const CanonicalPolygon& polygon,
                                         const std::vector<BandSpec>& bands,
                                         const EnginePolicy& policy = {});

std::vector<SizeMeasurement> measure_all(const PolygonInput& input,
                                         const std::vector<BandSpec>& bands,
                                         const EnginePolicy& policy = {});

SolveResult solve(const PolygonInput& input,
                  const std::vector<BandSpec>& bands,
                  const EnginePolicy& policy = {});

}  // namespace magfit
