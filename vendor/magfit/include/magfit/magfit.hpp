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
    // LATTICE INDICES (§B10): the garment lattice is fixed; a node's physical position
    // is offset + 48·index per axis, where the offset is the shape's placement against
    // the lattice. Adjacent nodes differ by 1 in one index. (Field names keep their
    // historic spelling for ABI stability; they are indices, not 24mm units.)
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
    // The 96 garment keeps every second lattice point per axis: residues are MOD 2 on
    // the lattice index. (Field names keep the historic mod4 spelling; values are 0/1.)
    // Addendum §B2/§B8: the 96mm lattice engages from this band up (Dan 2026-08-12:
    // "band 2 = 48mm grid only. 96 participates from band 3 up"). Below it no sparse
    // evaluation at all. From it up, participation is MEASURED AND PREFERRED, not a
    // hard gate: the best phase's engagement is reported with every answer and ranks
    // candidates (more engaging nodes win ties). The strict pair gate — two active
    // nodes 96mm apart with a supported corridor — is an optional mode
    // (min_active_nodes=2 + require_96mm_connected), never the default; a band answer
    // is not refused for lacking 96 coupling.
    int min_band{3};
    int min_active_nodes{1};
    bool require_96mm_connected{false};
    int fixed_x_residue_mod4{0};
    int fixed_y_residue_mod4{0};
};

struct EnginePolicy {
    int dense_pitch_mm{48};
    int half_pitch_mm{24};
    int disc_radius_mm{12};
    // Addendum §B6 — Dan's ruling: the size is ANY; nothing restricts it to a grid
    // ladder. Sizes publish as whole even millimetres, so the candidate step is 2mm.
    // The shape normalises to its own touch-point and FALLS INTO the band whose range
    // that size lands in. (The 12mm ladder was the admin instrument's discretisation,
    // wrongly hardened into law by the reference package — the law book's own circle
    // row, band 2 at 92mm, is the witness.)
    int size_step_mm{2};
    int max_field_positions{9};
    int max_trace_span_units{65'536};
    // Addendum §B7 — Dan, 2026-08-12: the band-span requirement was the reference
    // package's invention, "never said and never locked as law or limitation." Retired
    // as a default; retained only as an optional diagnostic filter.
    bool require_band_span{false};
    bool require_24mm_links{true};
    Selection selection{Selection::LayoutFirst};
    // §B10 placement: the shape's position against the fixed garment lattice, in whole
    // millimetres per axis, range (-24, 24]. When unset (auto), the engine scans the
    // four canonical registrations (offsets 0/24 per axis) and reports the best.
    bool explicit_offset{false};
    int offset_x_mm{0};
    int offset_y_mm{0};
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
    // The placement this answer was computed at (§B10) — mm offsets of the lattice
    // against the shape's bbox centre.
    int offset_x_mm{};
    int offset_y_mm{};
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

inline constexpr const char* kEngineVersionTag = "magfit-core/0.2.0";

// §B11 — the probe: pure facts at ONE size and placement, no selection, no floors.
// Every lattice point inside the shape's box with its exact clearance; holds means the
// full 24mm spot is backed (clearance ≥ 12, touching lawful); links are the verified
// corridors among holders. The instrument the engine proves itself with.
struct ProbeNode {
    int x_mm{};
    int y_mm{};
    bool inside{};
    double clearance_mm{};
    bool holds{};
};

struct ProbeLink {
    int ax_mm{};
    int ay_mm{};
    int bx_mm{};
    int by_mm{};
};

struct ProbeFacts {
    std::vector<ProbeNode> nodes;
    std::vector<ProbeLink> links;
};

ProbeFacts probe_placement(const CanonicalPolygon& polygon, int size_mm,
                           int offset_x_mm, int offset_y_mm,
                           const EnginePolicy& policy = {});

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
