#include "magfit/magfit.hpp"

#include <algorithm>
#include <array>
#include <cmath>
#include <limits>
#include <map>
#include <queue>
#include <set>
#include <sstream>
#include <stdexcept>
#include <tuple>


namespace magfit {
namespace {

using i128 = __int128_t;
using u128 = __uint128_t;

struct P128 {
    i128 x{};
    i128 y{};
};

struct ScaledPolygon {
    std::vector<P128> vertices;
    i128 coordinate_denominator{};  // Divide internal coordinates by this to obtain mm.
    // Exact pruning index (§B10 performance): 24mm cells over the scaled bbox. An edge
    // is registered in every cell its own bbox overlaps. Any geometry in a cell at
    // Chebyshev distance ≥ 2 from a query's cell is provably ≥ 24mm away, so 12mm
    // queries only visit the 3×3 ring; point-in-polygon only needs edges whose
    // y-interval straddles the query row. Pruning by proven bound — the predicates on
    // the surviving edges are the same exact routines.
    i128 cell_size{};
    i128 grid_min_x{};
    i128 grid_min_y{};
    int cols{};
    int rows{};
    std::vector<std::vector<int>> cell_edges;
    std::vector<std::vector<int>> row_edges;
};

struct DistanceSquared {
    // Squared distance in internal numerator-coordinate units.
    // Actual squared mm distance is (num / den) / coordinate_denominator^2.
    i128 num{};
    i128 den{1};
};

struct Candidate {
    int size_mm{};
    int runs_x{};
    int runs_y{};
    std::vector<GridPoint> nodes;
    std::vector<std::pair<GridPoint, GridPoint>> links;
    std::optional<SparsePhaseResult> sparse_phase;
    int sparse_active_count{};
    i64 centre_bias{};
    // Balance evidence for selection (§B9): exact numerators over the polygon's common
    // denominator 2·max_span — comparable across sizes of the same solve. worst_flap is
    // the largest side overhang; imbalance the larger of the two axis unevennesses
    // (L14a's "flap evened out on all sides").
    i64 worst_flap_num{};
    i64 imbalance_num{};
    int off_x{};
    int off_y{};
};

[[noreturn]] void fail(const std::string& message) {
    throw std::invalid_argument(message);
}

constexpr int kExactTraceSpanLimit = 65'536;
constexpr int kCAbiFieldLimit = 9;

void validate_policy(const EnginePolicy& policy) {
    if (policy.dense_pitch_mm <= 0 || policy.half_pitch_mm <= 0 ||
        policy.disc_radius_mm <= 0 || policy.size_step_mm <= 0) {
        fail("pitch, radius, and size step must be positive");
    }
    if (policy.half_pitch_mm * 2 != policy.dense_pitch_mm) {
        fail("half_pitch_mm must equal dense_pitch_mm / 2");
    }
    if ((policy.disc_radius_mm * 2) % policy.size_step_mm != 0 ||
        policy.dense_pitch_mm % policy.size_step_mm != 0) {
        fail("size_step_mm must divide both disc diameter and dense pitch");
    }
    if (policy.max_field_positions < 1 || policy.max_field_positions > kCAbiFieldLimit) {
        fail("max_field_positions must be between 1 and 9");
    }
    if (policy.max_trace_span_units < 1 ||
        policy.max_trace_span_units > kExactTraceSpanLimit) {
        fail("max_trace_span_units must be between 1 and 65536");
    }
    if (policy.sparse.mode != PhaseMode::Disabled && policy.sparse.min_active_nodes < 1) {
        fail("sparse_min_active_nodes must be at least one when sparse mode is enabled");
    }
    if (policy.sparse.min_band < 1 || policy.sparse.min_band > kCAbiFieldLimit + 1) {
        fail("sparse_min_band must be between 1 and 10");
    }
}

int band_span_mm(int band, const EnginePolicy& policy) {
    return policy.disc_radius_mm * 2 + (band - 1) * policy.dense_pitch_mm;
}

void validate_band_spec(const BandSpec& band, const EnginePolicy& policy) {
    if (band.band < 1 || band.band > policy.max_field_positions) {
        fail("band outside field ceiling");
    }
    if (band.min_nodes < 1 || band.min_nodes > band.band * band.band) {
        fail("band min_nodes is outside the template capacity");
    }
    if (band.legal_sizes_mm.empty()) fail("band has no legal sizes");
    if (!std::is_sorted(band.legal_sizes_mm.begin(), band.legal_sizes_mm.end()) ||
        std::adjacent_find(band.legal_sizes_mm.begin(), band.legal_sizes_mm.end()) !=
            band.legal_sizes_mm.end()) {
        fail("legal sizes must be strictly ascending");
    }
    const int lower = band_span_mm(band.band, policy);
    const int upper = band_span_mm(band.band + 1, policy);
    for (int size : band.legal_sizes_mm) {
        if (size < lower || size >= upper || size % policy.size_step_mm != 0) {
            fail("legal size lies outside its band interval or size step");
        }
    }
}

i128 square128(i128 value) {
    return value * value;
}

i128 dot(const P128& a, const P128& b) {
    return a.x * b.x + a.y * b.y;
}

i128 cross(const P128& a, const P128& b) {
    return a.x * b.y - a.y * b.x;
}

P128 sub(const P128& a, const P128& b) {
    return {a.x - b.x, a.y - b.y};
}

i128 orient(const P128& a, const P128& b, const P128& c) {
    return cross(sub(b, a), sub(c, a));
}

i128 orient_i64(const PointI& a, const PointI& b, const PointI& c) {
    const P128 aa{a.x, a.y};
    const P128 bb{b.x, b.y};
    const P128 cc{c.x, c.y};
    return orient(aa, bb, cc);
}

bool between_inclusive(i128 value, i128 a, i128 b) {
    if (a > b) std::swap(a, b);
    return value >= a && value <= b;
}

bool on_segment(const P128& p, const P128& a, const P128& b) {
    return orient(a, b, p) == 0 &&
           between_inclusive(p.x, a.x, b.x) &&
           between_inclusive(p.y, a.y, b.y);
}

bool on_segment_i64(const PointI& p, const PointI& a, const PointI& b) {
    return orient_i64(a, b, p) == 0 &&
           between_inclusive(p.x, a.x, b.x) &&
           between_inclusive(p.y, a.y, b.y);
}

int sign128(i128 value) {
    return (value > 0) - (value < 0);
}

bool segments_intersect_inclusive(const P128& a, const P128& b,
                                  const P128& c, const P128& d) {
    const i128 o1 = orient(a, b, c);
    const i128 o2 = orient(a, b, d);
    const i128 o3 = orient(c, d, a);
    const i128 o4 = orient(c, d, b);

    if (o1 == 0 && on_segment(c, a, b)) return true;
    if (o2 == 0 && on_segment(d, a, b)) return true;
    if (o3 == 0 && on_segment(a, c, d)) return true;
    if (o4 == 0 && on_segment(b, c, d)) return true;

    return sign128(o1) != sign128(o2) && sign128(o3) != sign128(o4);
}

bool segments_intersect_inclusive_i64(const PointI& a, const PointI& b,
                                      const PointI& c, const PointI& d) {
    const i128 o1 = orient_i64(a, b, c);
    const i128 o2 = orient_i64(a, b, d);
    const i128 o3 = orient_i64(c, d, a);
    const i128 o4 = orient_i64(c, d, b);

    if (o1 == 0 && on_segment_i64(c, a, b)) return true;
    if (o2 == 0 && on_segment_i64(d, a, b)) return true;
    if (o3 == 0 && on_segment_i64(a, c, d)) return true;
    if (o4 == 0 && on_segment_i64(b, c, d)) return true;

    return sign128(o1) != sign128(o2) && sign128(o3) != sign128(o4);
}

bool point_between_collinear(const PointI& a, const PointI& b, const PointI& c) {
    if (orient_i64(a, b, c) != 0) return false;
    return between_inclusive(b.x, a.x, c.x) && between_inclusive(b.y, a.y, c.y);
}

std::string point_string(const PointI& p) {
    std::ostringstream oss;
    oss << '(' << p.x << ',' << p.y << ')';
    return oss.str();
}

void validate_no_duplicate_vertices(const std::vector<PointI>& vertices) {
    std::set<PointI> seen;
    for (const PointI& p : vertices) {
        if (!seen.insert(p).second) {
            fail("polygon repeats vertex " + point_string(p));
        }
    }
}

void validate_simple_polygon(const std::vector<PointI>& v) {
    const std::size_t n = v.size();
    for (std::size_t i = 0; i < n; ++i) {
        const std::size_t i2 = (i + 1) % n;
        for (std::size_t j = i + 1; j < n; ++j) {
            const std::size_t j2 = (j + 1) % n;
            const bool adjacent = i == j || i2 == j || j2 == i;
            if (adjacent) continue;
            if (segments_intersect_inclusive_i64(v[i], v[i2], v[j], v[j2])) {
                std::ostringstream oss;
                oss << "polygon is not simple: edges " << i << " and " << j << " intersect";
                fail(oss.str());
            }
        }
    }
}

i128 signed_area2(const std::vector<PointI>& v) {
    // Translate before applying the shoelace formula. Area is translation invariant,
    // and this keeps products bounded by the validated trace span rather than by
    // the absolute coordinate origin supplied by an upstream tracer.
    const i128 origin_x = v.front().x;
    const i128 origin_y = v.front().y;
    i128 area = 0;
    for (std::size_t i = 0; i < v.size(); ++i) {
        const PointI& a0 = v[i];
        const PointI& b0 = v[(i + 1) % v.size()];
        const i128 ax = static_cast<i128>(a0.x) - origin_x;
        const i128 ay = static_cast<i128>(a0.y) - origin_y;
        const i128 bx = static_cast<i128>(b0.x) - origin_x;
        const i128 by = static_cast<i128>(b0.y) - origin_y;
        area += ax * by - ay * bx;
    }
    return area;
}

void remove_redundant_collinear(std::vector<PointI>& v) {
    bool changed = true;
    while (changed && v.size() >= 3) {
        changed = false;
        std::vector<PointI> next;
        next.reserve(v.size());
        const std::size_t n = v.size();
        for (std::size_t i = 0; i < n; ++i) {
            const PointI& prev = v[(i + n - 1) % n];
            const PointI& cur = v[i];
            const PointI& following = v[(i + 1) % n];
            if (point_between_collinear(prev, cur, following)) {
                changed = true;
                continue;
            }
            next.push_back(cur);
        }
        v.swap(next);
    }
}

void validate_no_collinear_backtracking(const std::vector<PointI>& v) {
    for (std::size_t i = 0; i < v.size(); ++i) {
        const PointI& prev = v[(i + v.size() - 1) % v.size()];
        const PointI& cur = v[i];
        const PointI& next = v[(i + 1) % v.size()];
        if (orient_i64(prev, cur, next) == 0) {
            fail("polygon contains a collinear reversal or overlapping adjacent edges at " +
                 point_string(cur));
        }
    }
}

i128 floor_div(i128 a, i128 b) {
    i128 q = a / b;
    if ((a % b != 0) && ((a < 0) != (b < 0))) --q;
    return q;
}

ScaledPolygon scale_polygon(const CanonicalPolygon& polygon, int size_mm) {
    ScaledPolygon out;
    out.coordinate_denominator = static_cast<i128>(2) * polygon.max_span;
    out.vertices.reserve(polygon.vertices.size());

    const i128 centre2_x = static_cast<i128>(polygon.min_x) + polygon.max_x;
    const i128 centre2_y = static_cast<i128>(polygon.min_y) + polygon.max_y;
    for (const PointI& p : polygon.vertices) {
        const i128 relative2_x = static_cast<i128>(2) * p.x - centre2_x;
        const i128 relative2_y = static_cast<i128>(2) * p.y - centre2_y;
        out.vertices.push_back({static_cast<i128>(size_mm) * relative2_x,
                                static_cast<i128>(size_mm) * relative2_y});
    }

    // Build the exact pruning index: 24mm cells in internal units.
    const std::size_t n = out.vertices.size();
    out.cell_size = static_cast<i128>(24) * out.coordinate_denominator;
    i128 min_x = out.vertices.front().x;
    i128 max_x = min_x;
    i128 min_y = out.vertices.front().y;
    i128 max_y = min_y;
    for (const P128& v : out.vertices) {
        min_x = std::min(min_x, v.x);
        max_x = std::max(max_x, v.x);
        min_y = std::min(min_y, v.y);
        max_y = std::max(max_y, v.y);
    }
    out.grid_min_x = min_x;
    out.grid_min_y = min_y;
    out.cols = static_cast<int>(floor_div(max_x - min_x, out.cell_size)) + 1;
    out.rows = static_cast<int>(floor_div(max_y - min_y, out.cell_size)) + 1;
    out.cell_edges.assign(static_cast<std::size_t>(out.cols) * out.rows, {});
    out.row_edges.assign(out.rows, {});
    for (std::size_t i = 0; i < n; ++i) {
        const P128& a = out.vertices[i];
        const P128& b = out.vertices[(i + 1) % n];
        const i128 lo_x = std::min(a.x, b.x);
        const i128 hi_x = std::max(a.x, b.x);
        const i128 lo_y = std::min(a.y, b.y);
        const i128 hi_y = std::max(a.y, b.y);
        const int c0 = static_cast<int>(floor_div(lo_x - min_x, out.cell_size));
        const int c1 = static_cast<int>(floor_div(hi_x - min_x, out.cell_size));
        const int r0 = static_cast<int>(floor_div(lo_y - min_y, out.cell_size));
        const int r1 = static_cast<int>(floor_div(hi_y - min_y, out.cell_size));
        for (int r = r0; r <= r1; ++r) {
            out.row_edges[r].push_back(static_cast<int>(i));
            for (int c = c0; c <= c1; ++c) {
                out.cell_edges[static_cast<std::size_t>(r) * out.cols + c].push_back(
                    static_cast<int>(i));
            }
        }
    }
    return out;
}

P128 grid_to_internal(const GridPoint& grid, int off_x, int off_y,
                      const ScaledPolygon& polygon, const EnginePolicy& policy) {
    const i128 x_mm = static_cast<i128>(off_x) +
                      static_cast<i128>(grid.x24) * policy.dense_pitch_mm;
    const i128 y_mm = static_cast<i128>(off_y) +
                      static_cast<i128>(grid.y24) * policy.dense_pitch_mm;
    return {x_mm * polygon.coordinate_denominator,
            y_mm * polygon.coordinate_denominator};
}

enum class PointLocation { Outside, Inside, Boundary };

PointLocation locate_point(const P128& p, const ScaledPolygon& polygon) {
    // Only edges whose y-interval straddles p.y can cross the winding ray or carry p;
    // the row index lists exactly those (plus row-mates, harmless to re-test).
    int row = static_cast<int>(floor_div(p.y - polygon.grid_min_y, polygon.cell_size));
    if (row < 0 || row >= polygon.rows) return PointLocation::Outside;
    int winding = 0;
    const std::size_t n = polygon.vertices.size();
    for (int index : polygon.row_edges[static_cast<std::size_t>(row)]) {
        const P128& a = polygon.vertices[static_cast<std::size_t>(index)];
        const P128& b = polygon.vertices[(static_cast<std::size_t>(index) + 1) % n];
        if (on_segment(p, a, b)) return PointLocation::Boundary;

        if (a.y <= p.y) {
            if (b.y > p.y && orient(a, b, p) > 0) ++winding;
        } else {
            if (b.y <= p.y && orient(a, b, p) < 0) --winding;
        }
    }
    return winding == 0 ? PointLocation::Outside : PointLocation::Inside;
}

DistanceSquared point_segment_distance2(const P128& p, const P128& a, const P128& b) {
    const P128 ab = sub(b, a);
    const P128 ap = sub(p, a);
    const i128 len2 = dot(ab, ab);
    if (len2 == 0) {
        return {dot(ap, ap), 1};
    }
    const i128 projection = dot(ap, ab);
    if (projection <= 0) {
        return {dot(ap, ap), 1};
    }
    if (projection >= len2) {
        const P128 bp = sub(p, b);
        return {dot(bp, bp), 1};
    }
    const i128 area2 = cross(ab, ap);
    return {square128(area2), len2};
}

struct U256 {
    // Little-endian 64-bit limbs.
    std::array<std::uint64_t, 4> limb{};
};

U256 multiply_u128(u128 a, u128 b) {
    const std::array<std::uint64_t, 2> aa{
        static_cast<std::uint64_t>(a),
        static_cast<std::uint64_t>(a >> 64),
    };
    const std::array<std::uint64_t, 2> bb{
        static_cast<std::uint64_t>(b),
        static_cast<std::uint64_t>(b >> 64),
    };

    U256 out;
    for (std::size_t i = 0; i < aa.size(); ++i) {
        u128 carry = 0;
        for (std::size_t j = 0; j < bb.size(); ++j) {
            const std::size_t k = i + j;
            const u128 cur = static_cast<u128>(aa[i]) * bb[j] + out.limb[k] + carry;
            out.limb[k] = static_cast<std::uint64_t>(cur);
            carry = cur >> 64;
        }
        out.limb[i + 2] = static_cast<std::uint64_t>(carry);
    }
    return out;
}

int compare_u256(const U256& a, const U256& b) {
    for (std::size_t i = a.limb.size(); i-- > 0;) {
        if (a.limb[i] < b.limb[i]) return -1;
        if (a.limb[i] > b.limb[i]) return 1;
    }
    return 0;
}

int compare_distance2(const DistanceSquared& a, const DistanceSquared& b) {
    if (a.num < 0 || a.den <= 0 || b.num < 0 || b.den <= 0) {
        fail("internal error: invalid squared-distance rational");
    }
    const U256 lhs = multiply_u128(static_cast<u128>(a.num), static_cast<u128>(b.den));
    const U256 rhs = multiply_u128(static_cast<u128>(b.num), static_cast<u128>(a.den));
    return compare_u256(lhs, rhs);
}

bool distance_ge_radius(const DistanceSquared& distance2, i128 radius) {
    return distance2.num >= square128(radius) * distance2.den;
}

// The 3×3 cell ring around a query cell contains every edge that can lie within one
// cell size (24mm) of the query — anything outside is provably ≥ 24mm > 12mm away.
template <typename Visit>
void for_ring_edges(const ScaledPolygon& polygon, const P128& lo, const P128& hi,
                    Visit&& visit) {
    const int c0 = std::max<int>(
        0, static_cast<int>(floor_div(lo.x - polygon.grid_min_x, polygon.cell_size)) - 1);
    const int c1 = std::min<int>(
        polygon.cols - 1,
        static_cast<int>(floor_div(hi.x - polygon.grid_min_x, polygon.cell_size)) + 1);
    const int r0 = std::max<int>(
        0, static_cast<int>(floor_div(lo.y - polygon.grid_min_y, polygon.cell_size)) - 1);
    const int r1 = std::min<int>(
        polygon.rows - 1,
        static_cast<int>(floor_div(hi.y - polygon.grid_min_y, polygon.cell_size)) + 1);
    // Stamp-free dedupe: rings are ≤ 4×4 cells; edges may repeat across cells, and the
    // predicates tolerate re-testing. Correctness needs coverage, not uniqueness.
    for (int r = r0; r <= r1; ++r) {
        for (int c = c0; c <= c1; ++c) {
            for (int index :
                 polygon.cell_edges[static_cast<std::size_t>(r) * polygon.cols + c]) {
                visit(index);
            }
        }
    }
}

bool disc_supported(const P128& centre, const ScaledPolygon& polygon,
                    const EnginePolicy& policy) {
    const i128 radius = static_cast<i128>(policy.disc_radius_mm) *
                        polygon.coordinate_denominator;
    const std::size_t n = polygon.vertices.size();
    bool clear = true;
    for_ring_edges(polygon, centre, centre, [&](int index) {
        if (!clear) return;
        const P128& a = polygon.vertices[static_cast<std::size_t>(index)];
        const P128& b = polygon.vertices[(static_cast<std::size_t>(index) + 1) % n];
        if (!distance_ge_radius(point_segment_distance2(centre, a, b), radius)) {
            clear = false;
        }
    });
    if (!clear) return false;
    return locate_point(centre, polygon) != PointLocation::Outside;
}

DistanceSquared segment_segment_distance2(const P128& a, const P128& b,
                                          const P128& c, const P128& d) {
    if (segments_intersect_inclusive(a, b, c, d)) return {0, 1};
    std::array<DistanceSquared, 4> distances{
        point_segment_distance2(a, c, d),
        point_segment_distance2(b, c, d),
        point_segment_distance2(c, a, b),
        point_segment_distance2(d, a, b),
    };
    DistanceSquared best = distances[0];
    for (std::size_t i = 1; i < distances.size(); ++i) {
        if (compare_distance2(distances[i], best) < 0) best = distances[i];
    }
    return best;
}

bool capsule_supported(const P128& a, const P128& b, const ScaledPolygon& polygon,
                       const EnginePolicy& policy) {
    if (locate_point(a, polygon) == PointLocation::Outside ||
        locate_point(b, polygon) == PointLocation::Outside) {
        return false;
    }
    const i128 radius = static_cast<i128>(policy.disc_radius_mm) *
                        polygon.coordinate_denominator;
    const P128 lo{std::min(a.x, b.x), std::min(a.y, b.y)};
    const P128 hi{std::max(a.x, b.x), std::max(a.y, b.y)};
    const std::size_t n = polygon.vertices.size();
    bool clear = true;
    for_ring_edges(polygon, lo, hi, [&](int index) {
        if (!clear) return;
        const P128& c = polygon.vertices[static_cast<std::size_t>(index)];
        const P128& d = polygon.vertices[(static_cast<std::size_t>(index) + 1) % n];
        if (!distance_ge_radius(segment_segment_distance2(a, b, c, d), radius)) {
            clear = false;
        }
    });
    return clear;
}

// §B10 — the FIELD SCAN. Dan's law, demonstrated on the duck: the garment lattice is
// FIXED and the shape sits against it at a placement offset; the fit is every lattice
// point the material backs, wherever it falls. A node's position in the shape frame is
// offset + 48·index per axis; the scan covers every such point inside the shape's own
// bbox, up to the 9-positions-per-axis field ceiling.
std::vector<GridPoint> field_nodes(const CanonicalPolygon& polygon, int size_mm,
                                   int off_x, int off_y,
                                   const EnginePolicy& policy) {
    std::vector<GridPoint> out;
    const i128 den2 = static_cast<i128>(2) * polygon.max_span;
    const i128 half_w_rhs = static_cast<i128>(size_mm) * (polygon.max_x - polygon.min_x);
    const i128 half_h_rhs = static_cast<i128>(size_mm) * (polygon.max_y - polygon.min_y);
    for (int iy = -4; iy <= 4; ++iy) {
        const i128 y_mm = static_cast<i128>(off_y) +
                          static_cast<i128>(iy) * policy.dense_pitch_mm;
        const i128 y_lhs = (y_mm < 0 ? -y_mm : y_mm) * den2;
        if (y_lhs > half_h_rhs) continue;
        for (int ix = -4; ix <= 4; ++ix) {
            const i128 x_mm = static_cast<i128>(off_x) +
                              static_cast<i128>(ix) * policy.dense_pitch_mm;
            const i128 x_lhs = (x_mm < 0 ? -x_mm : x_mm) * den2;
            if (x_lhs > half_w_rhs) continue;
            out.push_back({ix, iy});
        }
    }
    return out;
}

bool adjacent_48(const GridPoint& a, const GridPoint& b) {
    return std::abs(a.x24 - b.x24) + std::abs(a.y24 - b.y24) == 1;
}

bool adjacent_96(const GridPoint& a, const GridPoint& b) {
    return std::abs(a.x24 - b.x24) + std::abs(a.y24 - b.y24) == 2;
}

int mod4(int value) {
    // Historic name; residues are mod 2 on lattice indices — the 96 garment keeps
    // every second lattice point per axis.
    int r = value % 2;
    return r < 0 ? r + 2 : r;
}

std::vector<std::pair<int, int>> possible_sparse_phases(const std::vector<GridPoint>& nodes) {
    if (nodes.empty()) return {};
    return {{0, 0}, {0, 1}, {1, 0}, {1, 1}};
}

struct SparseEvaluation {
    bool pass{};
    SparsePhaseResult representative;
    int active_count{};
};

SparseEvaluation evaluate_one_sparse_phase(const std::vector<GridPoint>& nodes,
                                            int rx, int ry, int off_x, int off_y,
                                            const ScaledPolygon& polygon,
                                            const EnginePolicy& policy) {
    SparseEvaluation out;
    out.representative.x_residue_mod4 = mod4(rx);
    out.representative.y_residue_mod4 = mod4(ry);
    for (const GridPoint& node : nodes) {
        if (mod4(node.x24) == mod4(rx) && mod4(node.y24) == mod4(ry)) {
            out.representative.active_nodes.push_back(node);
        }
    }
    out.active_count = static_cast<int>(out.representative.active_nodes.size());
    if (out.active_count < policy.sparse.min_active_nodes) return out;

    if (!policy.sparse.require_96mm_connected || out.active_count <= 1) {
        out.representative.connected = true;
        out.pass = true;
        return out;
    }

    const int n = out.active_count;
    std::vector<std::vector<int>> adjacency(n);
    for (int i = 0; i < n; ++i) {
        for (int j = i + 1; j < n; ++j) {
            if (!adjacent_96(out.representative.active_nodes[i],
                             out.representative.active_nodes[j])) {
                continue;
            }
            const P128 a = grid_to_internal(out.representative.active_nodes[i], off_x, off_y,
                                            polygon, policy);
            const P128 b = grid_to_internal(out.representative.active_nodes[j], off_x, off_y,
                                            polygon, policy);
            if (!capsule_supported(a, b, polygon, policy)) continue;
            adjacency[i].push_back(j);
            adjacency[j].push_back(i);
        }
    }
    std::vector<bool> seen(n, false);
    std::queue<int> q;
    q.push(0);
    seen[0] = true;
    int reached = 0;
    while (!q.empty()) {
        const int cur = q.front();
        q.pop();
        ++reached;
        for (int next : adjacency[cur]) {
            if (!seen[next]) {
                seen[next] = true;
                q.push(next);
            }
        }
    }
    out.representative.connected = reached == n;
    out.pass = out.representative.connected;
    return out;
}

SparseEvaluation evaluate_sparse(const std::vector<GridPoint>& nodes,
                                 int off_x, int off_y,
                                 const ScaledPolygon& polygon,
                                 const EnginePolicy& policy) {
    if (policy.sparse.mode == PhaseMode::Disabled) {
        SparseEvaluation out;
        out.pass = true;
        return out;
    }

    std::vector<std::pair<int, int>> phases;
    if (policy.sparse.mode == PhaseMode::Fixed) {
        phases.push_back({mod4(policy.sparse.fixed_x_residue_mod4),
                          mod4(policy.sparse.fixed_y_residue_mod4)});
    } else {
        phases = possible_sparse_phases(nodes);
    }

    std::vector<SparseEvaluation> evaluations;
    evaluations.reserve(phases.size());
    for (const auto& [rx, ry] : phases) {
        evaluations.push_back(
            evaluate_one_sparse_phase(nodes, rx, ry, off_x, off_y, polygon, policy));
    }

    if (policy.sparse.mode == PhaseMode::All) {
        for (const auto& evaluation : evaluations) {
            if (!evaluation.pass) return {};
        }
        // Return the weakest passing phase so the explanation is conservative.
        auto worst = std::min_element(evaluations.begin(), evaluations.end(),
                                      [](const SparseEvaluation& a, const SparseEvaluation& b) {
            if (a.active_count != b.active_count) return a.active_count < b.active_count;
            return std::tie(a.representative.x_residue_mod4,
                            a.representative.y_residue_mod4) <
                   std::tie(b.representative.x_residue_mod4,
                            b.representative.y_residue_mod4);
        });
        return *worst;
    }

    SparseEvaluation best;
    bool found = false;
    for (const auto& evaluation : evaluations) {
        if (!evaluation.pass) continue;
        if (!found || evaluation.active_count > best.active_count ||
            (evaluation.active_count == best.active_count &&
             std::tie(evaluation.representative.x_residue_mod4,
                      evaluation.representative.y_residue_mod4) <
                 std::tie(best.representative.x_residue_mod4,
                          best.representative.y_residue_mod4))) {
            best = evaluation;
            found = true;
        }
    }
    if (!found) return {};
    return best;
}

bool component_spans_band(const std::vector<GridPoint>& nodes, int band) {
    if (nodes.empty()) return false;
    int min_x = nodes.front().x24;
    int max_x = min_x;
    int min_y = nodes.front().y24;
    int max_y = min_y;
    for (const GridPoint& p : nodes) {
        min_x = std::min(min_x, p.x24);
        max_x = std::max(max_x, p.x24);
        min_y = std::min(min_y, p.y24);
        max_y = std::max(max_y, p.y24);
    }
    const int required = band - 1;
    return std::max(max_x - min_x, max_y - min_y) == required;
}



// §B9 — approximate the fit. The square's precise wrap at the band anchor is the perfect
// case; a free shape can never be perfect, so it scales within the band range to create
// more placement options and the assembly is centred and balanced inside it. Order:
// strongest support first (nodes, links, full square, 96 engagement), then Dan's draft
// made law — most even (imbalance), fewest flap (worst side), snuggest (smallest size) —
// then the deterministic tail. One total order used both within a size and across the
// band's whole range.
bool better_candidate(const Candidate& a, const Candidate& b) {
    if (a.nodes.size() != b.nodes.size()) return a.nodes.size() > b.nodes.size();
    if (a.links.size() != b.links.size()) return a.links.size() > b.links.size();
    if (a.sparse_active_count != b.sparse_active_count) {
        return a.sparse_active_count > b.sparse_active_count;
    }
    if (a.imbalance_num != b.imbalance_num) return a.imbalance_num < b.imbalance_num;
    if (a.worst_flap_num != b.worst_flap_num) return a.worst_flap_num < b.worst_flap_num;
    if (a.size_mm != b.size_mm) return a.size_mm < b.size_mm;
    if (a.centre_bias != b.centre_bias) return a.centre_bias < b.centre_bias;
    if (a.off_x != b.off_x) return a.off_x < b.off_x;
    if (a.off_y != b.off_y) return a.off_y < b.off_y;
    return a.nodes < b.nodes;
}

std::optional<Candidate> best_candidate_at_size(const CanonicalPolygon& polygon,
                                                const BandSpec& band,
                                                int size_mm,
                                                const EnginePolicy& policy) {
    // Addendum §B2: the 96mm lattice only engages from sparse.min_band up.
    const bool sparse_gate =
        policy.sparse.mode != PhaseMode::Disabled && band.band >= policy.sparse.min_band;
    const ScaledPolygon scaled = scale_polygon(polygon, size_mm);
    std::optional<Candidate> best;

    // §B10: solve the actual placement. An explicit offset (the canvas pan) is solved
    // as-is; otherwise the BEST PLACEMENT is searched — every even-mm position of the
    // shape against the fixed lattice, one period per axis. (The duck proved four
    // canonical registrations are not enough: its band-2 pair lives at (24,−12).)
    std::vector<std::pair<int, int>> offsets;
    if (policy.explicit_offset) {
        offsets.push_back({policy.offset_x_mm, policy.offset_y_mm});
    } else {
        for (int ox = -policy.half_pitch_mm + policy.size_step_mm;
             ox <= policy.half_pitch_mm; ox += policy.size_step_mm) {
            for (int oy = -policy.half_pitch_mm + policy.size_step_mm;
                 oy <= policy.half_pitch_mm; oy += policy.size_step_mm) {
                offsets.push_back({ox, oy});
            }
        }
    }

    for (const auto& [off_x, off_y] : offsets) {
        const std::vector<GridPoint> grid_nodes =
            field_nodes(polygon, size_mm, off_x, off_y, policy);
        const int n = static_cast<int>(grid_nodes.size());
        if (n < band.min_nodes) continue;

        std::vector<bool> supported(n, false);
        std::vector<P128> centres(n);
        int supported_count = 0;
        for (int i = 0; i < n; ++i) {
            centres[i] = grid_to_internal(grid_nodes[i], off_x, off_y, scaled, policy);
            supported[i] = disc_supported(centres[i], scaled, policy);
            if (supported[i]) ++supported_count;
        }
        // Pure mathematics, no floors (Dan 2026-08-12): a single holding spot is a fact
        // the engine reports. Product minimums are a later policy layer, never the
        // kernel's business.
        if (supported_count < 1) continue;

        std::vector<std::vector<int>> adjacency(n);
        for (int i = 0; i < n; ++i) {
            if (!supported[i]) continue;
            for (int j = i + 1; j < n; ++j) {
                if (!supported[j] || !adjacent_48(grid_nodes[i], grid_nodes[j])) continue;
                if (policy.require_24mm_links &&
                    !capsule_supported(centres[i], centres[j], scaled, policy)) {
                    continue;
                }
                adjacency[i].push_back(j);
                adjacency[j].push_back(i);
            }
        }

        std::vector<GridPoint> nodes;
        nodes.reserve(supported_count);
        i64 sum_x = 0;
        i64 sum_y = 0;
        for (int i = 0; i < n; ++i) {
            if (!supported[i]) continue;
            nodes.push_back(grid_nodes[i]);
            sum_x += 2 * (off_x + grid_nodes[i].x24 * policy.dense_pitch_mm);
            sum_y += 2 * (off_y + grid_nodes[i].y24 * policy.dense_pitch_mm);
        }
        std::sort(nodes.begin(), nodes.end());
        if (policy.require_band_span && !component_spans_band(nodes, band.band)) continue;

        SparseEvaluation sparse;
        if (sparse_gate) {
            sparse = evaluate_sparse(nodes, off_x, off_y, scaled, policy);
            if (!sparse.pass) continue;
        } else {
            sparse.pass = true;
        }

        std::vector<std::pair<GridPoint, GridPoint>> links;
        for (int i = 0; i < n; ++i) {
            for (int j : adjacency[i]) {
                if (i < j) {
                    GridPoint a = grid_nodes[i];
                    GridPoint b = grid_nodes[j];
                    if (b < a) std::swap(a, b);
                    links.push_back({a, b});
                }
            }
        }
        std::sort(links.begin(), links.end());

        Candidate candidate;
        candidate.size_mm = size_mm;
        candidate.nodes = std::move(nodes);
        candidate.links = std::move(links);
        candidate.sparse_active_count = sparse.active_count;
        candidate.centre_bias = sum_x * sum_x + sum_y * sum_y;
        candidate.off_x = off_x;
        candidate.off_y = off_y;
        if (sparse_gate) {
            candidate.sparse_phase = sparse.representative;
        }
        {
            int min_ix = candidate.nodes.front().x24;
            int max_ix = min_ix;
            int min_iy = candidate.nodes.front().y24;
            int max_iy = min_iy;
            for (const GridPoint& node : candidate.nodes) {
                min_ix = std::min(min_ix, node.x24);
                max_ix = std::max(max_ix, node.x24);
                min_iy = std::min(min_iy, node.y24);
                max_iy = std::max(max_iy, node.y24);
            }
            candidate.runs_x = max_ix - min_ix + 1;
            candidate.runs_y = max_iy - min_iy + 1;
            // Balance evidence (§B9): side flaps of the assembly's padded box, exact
            // numerators over 2·max_span.
            const i128 den = static_cast<i128>(2) * polygon.max_span;
            const i128 half_w = static_cast<i128>(size_mm) * (polygon.max_x - polygon.min_x);
            const i128 half_h = static_cast<i128>(size_mm) * (polygon.max_y - polygon.min_y);
            const i128 left =
                half_w + (static_cast<i128>(off_x) + static_cast<i128>(min_ix) * policy.dense_pitch_mm -
                          policy.disc_radius_mm) * den;
            const i128 right =
                half_w - (static_cast<i128>(off_x) + static_cast<i128>(max_ix) * policy.dense_pitch_mm +
                          policy.disc_radius_mm) * den;
            const i128 bottom =
                half_h + (static_cast<i128>(off_y) + static_cast<i128>(min_iy) * policy.dense_pitch_mm -
                          policy.disc_radius_mm) * den;
            const i128 top =
                half_h - (static_cast<i128>(off_y) + static_cast<i128>(max_iy) * policy.dense_pitch_mm +
                          policy.disc_radius_mm) * den;
            const i128 worst = std::max(std::max(left, right), std::max(bottom, top));
            const i128 imb_x = left >= right ? left - right : right - left;
            const i128 imb_y = bottom >= top ? bottom - top : top - bottom;
            candidate.worst_flap_num = static_cast<i64>(worst);
            candidate.imbalance_num = static_cast<i64>(std::max(imb_x, imb_y));
        }
        if (!best || better_candidate(candidate, *best)) best = std::move(candidate);
    }
    return best;
}

long double to_long_double(i128 value) {
    return static_cast<long double>(value);
}

double distance_mm(const DistanceSquared& d, i128 coordinate_denominator) {
    const long double value = to_long_double(d.num) / to_long_double(d.den);
    return static_cast<double>(std::sqrt(value) / to_long_double(coordinate_denominator));
}

std::int64_t distance_um_floor(const DistanceSquared& d,
                               i128 coordinate_denominator,
                               int upper_bound_mm) {
    // Find the greatest integer k (micrometres) satisfying:
    // k^2 * d.den * coordinate_denominator^2 <= d.num * 1,000,000.
    // All comparisons are exact 256-bit integer comparisons.
    const i128 base = d.den * square128(coordinate_denominator);
    const U256 rhs = multiply_u128(static_cast<u128>(d.num), 1'000'000U);
    std::int64_t low = 0;
    std::int64_t high = static_cast<std::int64_t>(upper_bound_mm + 1) * 1000;
    while (low + 1 < high) {
        const std::int64_t mid = low + (high - low) / 2;
        const u128 mid2 = static_cast<u128>(mid) * static_cast<u128>(mid);
        const U256 lhs = multiply_u128(static_cast<u128>(base), mid2);
        if (compare_u256(lhs, rhs) <= 0) {
            low = mid;
        } else {
            high = mid;
        }
    }
    return low;
}

struct ContactCandidate {
    BindingContact::Kind kind{BindingContact::Kind::MagnetDisc};
    GridPoint a{};
    std::optional<GridPoint> b;
    std::size_t edge{};
    DistanceSquared distance2;
};

bool better_contact(const ContactCandidate& a, const ContactCandidate& b) {
    const int cmp = compare_distance2(a.distance2, b.distance2);
    if (cmp != 0) return cmp < 0;
    if (a.kind != b.kind) return a.kind == BindingContact::Kind::MagnetDisc;
    if (a.a != b.a) return a.a < b.a;
    if (a.b != b.b) return a.b < b.b;
    return a.edge < b.edge;
}

BindingContact binding_contact(const CanonicalPolygon& polygon,
                               const Candidate& candidate,
                               const EnginePolicy& policy) {
    const ScaledPolygon scaled = scale_polygon(polygon, candidate.size_mm);
    std::optional<ContactCandidate> best;

    for (const GridPoint& node : candidate.nodes) {
        const P128 p = grid_to_internal(node, candidate.off_x, candidate.off_y, scaled, policy);
        for (std::size_t edge = 0; edge < scaled.vertices.size(); ++edge) {
            ContactCandidate contact;
            contact.kind = BindingContact::Kind::MagnetDisc;
            contact.a = node;
            contact.edge = edge;
            contact.distance2 = point_segment_distance2(
                p, scaled.vertices[edge], scaled.vertices[(edge + 1) % scaled.vertices.size()]);
            if (!best || better_contact(contact, *best)) best = std::move(contact);
        }
    }

    for (const auto& link : candidate.links) {
        const P128 a = grid_to_internal(link.first, candidate.off_x, candidate.off_y,
                                        scaled, policy);
        const P128 b = grid_to_internal(link.second, candidate.off_x, candidate.off_y,
                                        scaled, policy);
        for (std::size_t edge = 0; edge < scaled.vertices.size(); ++edge) {
            ContactCandidate contact;
            contact.kind = BindingContact::Kind::LinkCapsule;
            contact.a = link.first;
            contact.b = link.second;
            contact.edge = edge;
            contact.distance2 = segment_segment_distance2(
                a, b, scaled.vertices[edge], scaled.vertices[(edge + 1) % scaled.vertices.size()]);
            if (!best || better_contact(contact, *best)) best = std::move(contact);
        }
    }

    if (!best) fail("internal error: selected layout has no contact candidates");
    BindingContact out;
    out.kind = best->kind;
    out.node_a = best->a;
    out.node_b = best->b;
    out.polygon_edge_index = best->edge;
    out.clearance_mm = distance_mm(best->distance2, scaled.coordinate_denominator);
    out.slack_mm = out.clearance_mm - policy.disc_radius_mm;
    out.clearance_um_floor = distance_um_floor(best->distance2,
                                               scaled.coordinate_denominator,
                                               candidate.size_mm);
    out.slack_um_floor = out.clearance_um_floor -
                         static_cast<std::int64_t>(policy.disc_radius_mm) * 1000;
    return out;
}

// Addendum v1.1 §B3. A broad tongue on a side: a full 24mm-wide capsule anchored at an
// outer-row magnet, extending depth+1 mm beyond the padded box on that side, entirely
// supported by fabric. A capsule segment of length h reaches exactly h beyond the box
// edge (the box edge sits one radius past the magnet centre, and the capsule cap adds
// the same radius back). Witness only — it never auto-approves an exception.
bool broad_tongue_on_side(const std::vector<GridPoint>& nodes, int off_x, int off_y,
                          int outward_x, int outward_y, int depth_mm,
                          const ScaledPolygon& scaled, const EnginePolicy& policy) {
    // Outer row = nodes with the extreme coordinate on the outward axis.
    int extreme = 0;
    bool first = true;
    for (const GridPoint& node : nodes) {
        const int along = outward_x != 0 ? node.x24 * outward_x : node.y24 * outward_y;
        if (first || along > extreme) {
            extreme = along;
            first = false;
        }
    }
    const i128 reach = static_cast<i128>(depth_mm + 1) * scaled.coordinate_denominator;
    for (const GridPoint& node : nodes) {
        const int along = outward_x != 0 ? node.x24 * outward_x : node.y24 * outward_y;
        if (along != extreme) continue;
        const P128 a = grid_to_internal(node, off_x, off_y, scaled, policy);
        const P128 b{a.x + reach * outward_x, a.y + reach * outward_y};
        if (capsule_supported(a, b, scaled, policy)) return true;
    }
    return false;
}

FlapMetrics flap_metrics(const CanonicalPolygon& polygon,
                         const Candidate& candidate,
                         const EnginePolicy& policy) {
    int min_ix = candidate.nodes.front().x24;
    int max_ix = min_ix;
    int min_iy = candidate.nodes.front().y24;
    int max_iy = min_iy;
    for (const GridPoint& node : candidate.nodes) {
        min_ix = std::min(min_ix, node.x24);
        max_ix = std::max(max_ix, node.x24);
        min_iy = std::min(min_iy, node.y24);
        max_iy = std::max(max_iy, node.y24);
    }

    const i128 den = static_cast<i128>(2) * polygon.max_span;
    const i128 shape_half_width_num =
        static_cast<i128>(candidate.size_mm) * (polygon.max_x - polygon.min_x);
    const i128 shape_half_height_num =
        static_cast<i128>(candidate.size_mm) * (polygon.max_y - polygon.min_y);

    const i128 padded_min_x_mm = static_cast<i128>(candidate.off_x) +
        static_cast<i128>(min_ix) * policy.dense_pitch_mm - policy.disc_radius_mm;
    const i128 padded_max_x_mm = static_cast<i128>(candidate.off_x) +
        static_cast<i128>(max_ix) * policy.dense_pitch_mm + policy.disc_radius_mm;
    const i128 padded_min_y_mm = static_cast<i128>(candidate.off_y) +
        static_cast<i128>(min_iy) * policy.dense_pitch_mm - policy.disc_radius_mm;
    const i128 padded_max_y_mm = static_cast<i128>(candidate.off_y) +
        static_cast<i128>(max_iy) * policy.dense_pitch_mm + policy.disc_radius_mm;

    // Shape bbox is centred on the lattice origin. Each flap is represented over
    // the common exact denominator 2*max_span.
    const i128 left_num = shape_half_width_num + padded_min_x_mm * den;
    const i128 right_num = shape_half_width_num - padded_max_x_mm * den;
    const i128 bottom_num = shape_half_height_num + padded_min_y_mm * den;
    const i128 top_num = shape_half_height_num - padded_max_y_mm * den;

    const auto mm = [den](i128 numerator) {
        return static_cast<double>(static_cast<long double>(numerator) /
                                   static_cast<long double>(den));
    };
    // L14: flap limits are MAXIMA — a side passes a limit when its overhang is AT MOST
    // that many millimetres. (The base engine had this reversed.)
    const auto within = [den](i128 numerator, int limit_mm) {
        return numerator <= static_cast<i128>(limit_mm) * den;
    };

    const ScaledPolygon scaled = scale_polygon(polygon, candidate.size_mm);
    const auto side = [&](i128 numerator, int ox, int oy) {
        FlapSide out;
        out.num = static_cast<i64>(numerator);
        out.mm = mm(numerator);
        out.within_12 = within(numerator, 12);
        out.within_24 = within(numerator, 24);
        // The broad-tongue witness is only meaningful past a limit; inside it the side
        // already passes and no exception is in play.
        out.broad_beyond_12 =
            !out.within_12 &&
            broad_tongue_on_side(candidate.nodes, candidate.off_x, candidate.off_y,
                                 ox, oy, 12, scaled, policy);
        out.broad_beyond_24 =
            !out.within_24 &&
            broad_tongue_on_side(candidate.nodes, candidate.off_x, candidate.off_y,
                                 ox, oy, 24, scaled, policy);
        return out;
    };

    FlapMetrics out;
    out.exact_den = static_cast<i64>(den);
    out.left = side(left_num, -1, 0);
    out.right = side(right_num, 1, 0);
    out.bottom = side(bottom_num, 0, -1);
    out.top = side(top_num, 0, 1);
    out.horizontal_imbalance_mm = mm(left_num >= right_num ? left_num - right_num
                                                           : right_num - left_num);
    out.vertical_imbalance_mm = mm(bottom_num >= top_num ? bottom_num - top_num
                                                         : top_num - bottom_num);
    return out;
}

// Addendum v1.1 §B1 (as sharpened by the MAGFIT v2 correction spec) — LayoutFirst is
// layout-TIER-first: the strongest support the material can carry anywhere in the band
// governs, and within that tier the smallest legal size wins. The full b×b square is the
// top tier (Dan's quadrant calibration — a circle publishes 96/four-disc, not 72/pair);
// a linked L outranks a pair; nothing below a pair is public. Tier strength is the
// supported node count, which is exactly the better_candidate leading key, so the winner
// at each size already carries that size's strongest tier. SizeFirst preserves the base
// contract's single ascending scan for corpus comparison.
std::optional<Candidate> select_candidate(const CanonicalPolygon& polygon,
                                          const BandSpec& band,
                                          const EnginePolicy& policy) {
    if (policy.selection == Selection::LayoutFirst) {
        // §B9: one total order across the band's whole range — strongest support, then
        // most even, fewest flap, snuggest. The per-size winner feeds the same
        // comparator, so the global winner is the band's best approximate fit.
        std::optional<Candidate> best;
        for (int size_mm : band.legal_sizes_mm) {
            std::optional<Candidate> at_size =
                best_candidate_at_size(polygon, band, size_mm, policy);
            if (!at_size) continue;
            if (!best || better_candidate(*at_size, *best)) {
                best = std::move(at_size);
            }
        }
        return best;
    }
    for (int size_mm : band.legal_sizes_mm) {
        std::optional<Candidate> any =
            best_candidate_at_size(polygon, band, size_mm, policy);
        if (any) return any;
    }
    return std::nullopt;
}

BandResult solve_band(const CanonicalPolygon& polygon,
                      const BandSpec& band,
                      const EnginePolicy& policy) {
    BandResult result;
    result.band = band.band;
    {
        const std::optional<Candidate> candidate = select_candidate(polygon, band, policy);
        if (!candidate) {
            result.fit = false;
            result.reason = "no legal size supports the minimum band-spanning layout";
            return result;
        }
        const int size_mm = candidate->size_mm;

        result.fit = true;
        result.offset_x_mm = candidate->off_x;
        result.offset_y_mm = candidate->off_y;
        result.manufactured_size_mm = size_mm;
        result.manufactured_width_num =
            static_cast<i64>(size_mm) * (polygon.max_x - polygon.min_x);
        result.manufactured_height_num =
            static_cast<i64>(size_mm) * (polygon.max_y - polygon.min_y);
        result.manufactured_dimension_den = polygon.max_span;
        result.manufactured_width_mm =
            static_cast<double>(result.manufactured_width_num) /
            static_cast<double>(result.manufactured_dimension_den);
        result.manufactured_height_mm =
            static_cast<double>(result.manufactured_height_num) /
            static_cast<double>(result.manufactured_dimension_den);
        result.template_runs_x = candidate->runs_x;
        result.template_runs_y = candidate->runs_y;
        result.magnets = candidate->nodes;
        result.verified_links = candidate->links;
        result.sparse_phase = candidate->sparse_phase;
        result.binding = binding_contact(polygon, *candidate, policy);
        result.flap = flap_metrics(polygon, *candidate, policy);
        result.reason = policy.selection == Selection::LayoutFirst
                            ? "strongest, most balanced support in the band range (field scan)"
                            : "first size in the band range with a valid assembly";
        return result;
    }
}

}  // namespace

CanonicalPolygon canonicalize_and_validate(const PolygonInput& input,
                                           const EnginePolicy& policy) {
    validate_policy(policy);
    std::vector<PointI> v = input.vertices;
    if (v.size() >= 2 && v.front() == v.back()) v.pop_back();
    if (v.size() < 3) fail("polygon must contain at least three distinct vertices");

    std::vector<PointI> deduplicated;
    deduplicated.reserve(v.size());
    for (const PointI& p : v) {
        if (deduplicated.empty() || !(deduplicated.back() == p)) deduplicated.push_back(p);
    }
    if (deduplicated.size() >= 2 && deduplicated.front() == deduplicated.back()) {
        deduplicated.pop_back();
    }
    v.swap(deduplicated);
    if (v.size() < 3) fail("polygon collapses after duplicate removal");

    // Validate the coordinate span before any products are formed. Absolute
    // coordinates may be large, but all exact predicates depend only on local
    // differences bounded by this span.
    i64 pre_min_x = v.front().x;
    i64 pre_max_x = v.front().x;
    i64 pre_min_y = v.front().y;
    i64 pre_max_y = v.front().y;
    for (const PointI& p : v) {
        pre_min_x = std::min(pre_min_x, p.x);
        pre_max_x = std::max(pre_max_x, p.x);
        pre_min_y = std::min(pre_min_y, p.y);
        pre_max_y = std::max(pre_max_y, p.y);
    }
    const i128 pre_span_x = static_cast<i128>(pre_max_x) - pre_min_x;
    const i128 pre_span_y = static_cast<i128>(pre_max_y) - pre_min_y;
    if (pre_span_x <= 0 || pre_span_y < 0 ||
        std::max(pre_span_x, pre_span_y) > policy.max_trace_span_units) {
        fail("canonical trace span is degenerate or exceeds engine bound; normalize before solving");
    }

    validate_no_duplicate_vertices(v);
    remove_redundant_collinear(v);
    if (v.size() < 3) fail("polygon collapses after collinear cleanup");
    validate_no_duplicate_vertices(v);
    validate_no_collinear_backtracking(v);
    validate_simple_polygon(v);

    i128 area2 = signed_area2(v);
    if (area2 == 0) fail("polygon area is zero");
    if (area2 < 0) std::reverse(v.begin(), v.end());

    const auto first = std::min_element(v.begin(), v.end());
    std::rotate(v.begin(), first, v.end());

    i64 min_x = v.front().x;
    i64 max_x = v.front().x;
    i64 min_y = v.front().y;
    i64 max_y = v.front().y;
    for (const PointI& p : v) {
        min_x = std::min(min_x, p.x);
        max_x = std::max(max_x, p.x);
        min_y = std::min(min_y, p.y);
        max_y = std::max(max_y, p.y);
    }
    const i64 max_span = std::max(max_x - min_x, max_y - min_y);
    if (max_span <= 0) fail("polygon bounding box is degenerate");
    if (max_span > policy.max_trace_span_units) {
        fail("canonical trace span exceeds engine bound; normalize before solving");
    }

    return {std::move(v), min_x, min_y, max_x, max_y, max_span};
}

BandSpec default_band_spec(int band, const EnginePolicy& policy) {
    validate_policy(policy);
    if (band < 1 || band > policy.max_field_positions) {
        fail("band must be between 1 and max_field_positions");
    }
    const int span = band_span_mm(band, policy);
    const int next_span = band_span_mm(band + 1, policy);
    BandSpec out;
    out.band = band;
    out.min_nodes = band == 1 ? 1 : 2;
    for (int size = span; size < next_span; size += policy.size_step_mm) {
        out.legal_sizes_mm.push_back(size);
    }
    return out;
}

SolveResult solve_canonical(const CanonicalPolygon& polygon,
                            const std::vector<BandSpec>& bands,
                            const EnginePolicy& policy) {
    validate_policy(policy);
    if (polygon.vertices.size() < 3 || polygon.max_span <= 0 ||
        polygon.max_span > policy.max_trace_span_units) {
        fail("canonical polygon is invalid");
    }

    SolveResult out;
    out.polygon = polygon;
    out.bands.reserve(bands.size());
    for (const BandSpec& band : bands) {
        validate_band_spec(band, policy);
        out.bands.push_back(solve_band(out.polygon, band, policy));
    }
    return out;
}

SolveResult solve(const PolygonInput& input,
                  const std::vector<BandSpec>& bands,
                  const EnginePolicy& policy) {
    return solve_canonical(canonicalize_and_validate(input, policy), bands, policy);
}

ProbeFacts probe_placement(const CanonicalPolygon& polygon, int size_mm,
                           int offset_x_mm, int offset_y_mm,
                           const EnginePolicy& policy) {
    validate_policy(policy);
    if (size_mm <= 0) fail("probe size must be positive");
    const ScaledPolygon scaled = scale_polygon(polygon, size_mm);
    const std::vector<GridPoint> grid_nodes =
        field_nodes(polygon, size_mm, offset_x_mm, offset_y_mm, policy);
    const i128 radius =
        static_cast<i128>(policy.disc_radius_mm) * scaled.coordinate_denominator;

    ProbeFacts out;
    std::vector<bool> holds(grid_nodes.size(), false);
    std::vector<P128> centres(grid_nodes.size());
    for (std::size_t i = 0; i < grid_nodes.size(); ++i) {
        const GridPoint& node = grid_nodes[i];
        centres[i] = grid_to_internal(node, offset_x_mm, offset_y_mm, scaled, policy);
        ProbeNode fact;
        fact.x_mm = offset_x_mm + node.x24 * policy.dense_pitch_mm;
        fact.y_mm = offset_y_mm + node.y24 * policy.dense_pitch_mm;
        fact.inside = locate_point(centres[i], scaled) != PointLocation::Outside;
        // Exact minimum boundary distance — the full scan, because the probe reports
        // the clearance NUMBER, near-misses included.
        std::optional<DistanceSquared> best;
        const std::size_t n = scaled.vertices.size();
        for (std::size_t e = 0; e < n; ++e) {
            const DistanceSquared d = point_segment_distance2(
                centres[i], scaled.vertices[e], scaled.vertices[(e + 1) % n]);
            if (!best || compare_distance2(d, *best) < 0) best = d;
        }
        fact.clearance_mm = best ? distance_mm(*best, scaled.coordinate_denominator) : 0.0;
        fact.holds = fact.inside && best && distance_ge_radius(*best, radius);
        holds[i] = fact.holds;
        out.nodes.push_back(fact);
    }
    for (std::size_t i = 0; i < grid_nodes.size(); ++i) {
        if (!holds[i]) continue;
        for (std::size_t j = i + 1; j < grid_nodes.size(); ++j) {
            if (!holds[j] || !adjacent_48(grid_nodes[i], grid_nodes[j])) continue;
            if (policy.require_24mm_links &&
                !capsule_supported(centres[i], centres[j], scaled, policy)) {
                continue;
            }
            out.links.push_back({out.nodes[i].x_mm, out.nodes[i].y_mm,
                                 out.nodes[j].x_mm, out.nodes[j].y_mm});
        }
    }
    return out;
}

}  // namespace magfit
