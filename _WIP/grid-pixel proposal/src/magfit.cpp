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
};

struct DistanceSquared {
    // Squared distance in internal numerator-coordinate units.
    // Actual squared mm distance is (num / den) / coordinate_denominator^2.
    i128 num{};
    i128 den{1};
};

struct TemplateGrid {
    int runs_x{};
    int runs_y{};
    std::vector<GridPoint> nodes;
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
    if (policy.sparse.engage_from_band < 1 ||
        policy.sparse.engage_from_band > policy.max_field_positions) {
        fail("sparse_engage_from_band must be inside the field ceiling");
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
    struct EdgeBounds {
        std::size_t index{};
        i64 min_x{};
        i64 max_x{};
        i64 min_y{};
        i64 max_y{};
    };
    std::vector<EdgeBounds> edges;
    edges.reserve(n);
    for (std::size_t i = 0; i < n; ++i) {
        const PointI& a = v[i];
        const PointI& b = v[(i + 1) % n];
        edges.push_back({i, std::min(a.x, b.x), std::max(a.x, b.x),
                         std::min(a.y, b.y), std::max(a.y, b.y)});
    }
    std::sort(edges.begin(), edges.end(), [](const EdgeBounds& a, const EdgeBounds& b) {
        return std::tie(a.min_x, a.max_x, a.min_y, a.max_y, a.index) <
               std::tie(b.min_x, b.max_x, b.min_y, b.max_y, b.index);
    });

    std::vector<EdgeBounds> active;
    for (const EdgeBounds& edge : edges) {
        active.erase(std::remove_if(active.begin(), active.end(),
                                    [&edge](const EdgeBounds& candidate) {
                                        return candidate.max_x < edge.min_x;
                                    }),
                     active.end());
        for (const EdgeBounds& candidate : active) {
            if (candidate.max_y < edge.min_y || edge.max_y < candidate.min_y) continue;
            const std::size_t i = candidate.index;
            const std::size_t j = edge.index;
            const std::size_t i2 = (i + 1) % n;
            const std::size_t j2 = (j + 1) % n;
            if (i == j || i2 == j || j2 == i) continue;
            if (segments_intersect_inclusive_i64(v[i], v[i2], v[j], v[j2])) {
                std::ostringstream oss;
                oss << "polygon is not simple: edges " << i << " and " << j << " intersect";
                fail(oss.str());
            }
        }
        active.push_back(edge);
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
    return out;
}

P128 grid_to_internal(const GridPoint& grid, const ScaledPolygon& polygon,
                      const EnginePolicy& policy) {
    const i128 x_mm = static_cast<i128>(grid.x24) * policy.half_pitch_mm;
    const i128 y_mm = static_cast<i128>(grid.y24) * policy.half_pitch_mm;
    return {x_mm * polygon.coordinate_denominator,
            y_mm * polygon.coordinate_denominator};
}

enum class PointLocation { Outside, Inside, Boundary };

PointLocation locate_point(const P128& p, const std::vector<P128>& polygon) {
    int winding = 0;
    for (std::size_t i = 0; i < polygon.size(); ++i) {
        const P128& a = polygon[i];
        const P128& b = polygon[(i + 1) % polygon.size()];
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

bool disc_supported(const P128& centre, const ScaledPolygon& polygon,
                    const EnginePolicy& policy) {
    if (locate_point(centre, polygon.vertices) == PointLocation::Outside) return false;
    const i128 radius = static_cast<i128>(policy.disc_radius_mm) *
                        polygon.coordinate_denominator;
    for (std::size_t i = 0; i < polygon.vertices.size(); ++i) {
        const P128& a = polygon.vertices[i];
        const P128& b = polygon.vertices[(i + 1) % polygon.vertices.size()];
        if (!distance_ge_radius(point_segment_distance2(centre, a, b), radius)) {
            return false;
        }
    }
    return true;
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
    if (locate_point(a, polygon.vertices) == PointLocation::Outside ||
        locate_point(b, polygon.vertices) == PointLocation::Outside) {
        return false;
    }
    const i128 radius = static_cast<i128>(policy.disc_radius_mm) *
                        polygon.coordinate_denominator;
    for (std::size_t i = 0; i < polygon.vertices.size(); ++i) {
        const P128& c = polygon.vertices[i];
        const P128& d = polygon.vertices[(i + 1) % polygon.vertices.size()];
        if (!distance_ge_radius(segment_segment_distance2(a, b, c, d), radius)) {
            return false;
        }
    }
    return true;
}

std::vector<int> run_coordinates(int count) {
    std::vector<int> out;
    out.reserve(count);
    for (int i = 0; i < count; ++i) out.push_back(-(count - 1) + 2 * i);
    return out;
}

std::vector<TemplateGrid> templates_for_band(int band) {
    std::vector<TemplateGrid> templates;
    for (int runs_x = 1; runs_x <= band; ++runs_x) {
        for (int runs_y = 1; runs_y <= band; ++runs_y) {
            if (std::max(runs_x, runs_y) != band) continue;
            TemplateGrid grid;
            grid.runs_x = runs_x;
            grid.runs_y = runs_y;
            const auto xs = run_coordinates(runs_x);
            const auto ys = run_coordinates(runs_y);
            for (int y : ys) {
                for (int x : xs) grid.nodes.push_back({x, y});
            }
            templates.push_back(std::move(grid));
        }
    }
    std::sort(templates.begin(), templates.end(), [](const TemplateGrid& a,
                                                      const TemplateGrid& b) {
        const int count_a = a.runs_x * a.runs_y;
        const int count_b = b.runs_x * b.runs_y;
        if (count_a != count_b) return count_a > count_b;
        const int imbalance_a = std::abs(a.runs_x - a.runs_y);
        const int imbalance_b = std::abs(b.runs_x - b.runs_y);
        if (imbalance_a != imbalance_b) return imbalance_a < imbalance_b;
        if (a.runs_x != b.runs_x) return a.runs_x > b.runs_x;
        return a.runs_y > b.runs_y;
    });
    return templates;
}

bool adjacent_48(const GridPoint& a, const GridPoint& b) {
    return std::abs(a.x24 - b.x24) + std::abs(a.y24 - b.y24) == 2;
}

bool adjacent_96(const GridPoint& a, const GridPoint& b) {
    return std::abs(a.x24 - b.x24) + std::abs(a.y24 - b.y24) == 4;
}

int mod4(int value) {
    int r = value % 4;
    return r < 0 ? r + 4 : r;
}

std::vector<std::pair<int, int>> possible_sparse_phases(const std::vector<GridPoint>& nodes) {
    if (nodes.empty()) return {};
    const int parity_x = mod4(nodes.front().x24) % 2;
    const int parity_y = mod4(nodes.front().y24) % 2;
    return {
        {parity_x, parity_y},
        {parity_x, parity_y + 2},
        {parity_x + 2, parity_y},
        {parity_x + 2, parity_y + 2},
    };
}

struct SparseEvaluation {
    bool pass{};
    bool engaged{};
    SparsePhaseResult representative;
    int active_count{};
};

SparseEvaluation evaluate_one_sparse_phase(const std::vector<GridPoint>& nodes,
                                            int rx, int ry,
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
            const P128 a = grid_to_internal(out.representative.active_nodes[i], polygon, policy);
            const P128 b = grid_to_internal(out.representative.active_nodes[j], polygon, policy);
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
                                 const ScaledPolygon& polygon,
                                 int band,
                                 const EnginePolicy& policy) {
    if (policy.sparse.mode == PhaseMode::Disabled ||
        band < policy.sparse.engage_from_band) {
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
        SparseEvaluation evaluation =
            evaluate_one_sparse_phase(nodes, rx, ry, polygon, policy);
        evaluation.engaged = true;
        evaluations.push_back(std::move(evaluation));
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
    const int required = 2 * (band - 1);
    return std::max(max_x - min_x, max_y - min_y) == required;
}

std::vector<std::vector<int>> connected_components(
    const std::vector<bool>& supported,
    const std::vector<std::vector<int>>& adjacency) {
    const int n = static_cast<int>(supported.size());
    std::vector<bool> seen(n, false);
    std::vector<std::vector<int>> components;
    for (int start = 0; start < n; ++start) {
        if (!supported[start] || seen[start]) continue;
        std::vector<int> component;
        std::queue<int> q;
        q.push(start);
        seen[start] = true;
        while (!q.empty()) {
            const int cur = q.front();
            q.pop();
            component.push_back(cur);
            for (int next : adjacency[cur]) {
                if (supported[next] && !seen[next]) {
                    seen[next] = true;
                    q.push(next);
                }
            }
        }
        components.push_back(std::move(component));
    }
    return components;
}

std::vector<std::pair<GridPoint, GridPoint>> links_for_component(
    const std::vector<GridPoint>& template_nodes,
    const std::vector<int>& component,
    const std::vector<std::vector<int>>& adjacency) {
    std::set<int> in_component(component.begin(), component.end());
    std::vector<std::pair<GridPoint, GridPoint>> links;
    for (int i : component) {
        for (int j : adjacency[i]) {
            if (i < j && in_component.count(j)) {
                GridPoint a = template_nodes[i];
                GridPoint b = template_nodes[j];
                if (b < a) std::swap(a, b);
                links.push_back({a, b});
            }
        }
    }
    std::sort(links.begin(), links.end());
    return links;
}

bool is_complete_full_layout(const Candidate& candidate) {
    if (candidate.runs_x != candidate.runs_y ||
        static_cast<int>(candidate.nodes.size()) !=
            candidate.runs_x * candidate.runs_y) {
        return false;
    }
    const int required_links =
        2 * candidate.runs_x * candidate.runs_y - candidate.runs_x - candidate.runs_y;
    return static_cast<int>(candidate.links.size()) == required_links;
}

bool better_candidate(const Candidate& a, const Candidate& b) {
    if (a.nodes.size() != b.nodes.size()) return a.nodes.size() > b.nodes.size();
    if (a.links.size() != b.links.size()) return a.links.size() > b.links.size();
    const bool a_full_square = is_complete_full_layout(a);
    const bool b_full_square = is_complete_full_layout(b);
    if (a_full_square != b_full_square) return a_full_square;
    if (a.sparse_active_count != b.sparse_active_count) {
        return a.sparse_active_count > b.sparse_active_count;
    }
    if (a.centre_bias != b.centre_bias) return a.centre_bias < b.centre_bias;
    const int area_a = a.runs_x * a.runs_y;
    const int area_b = b.runs_x * b.runs_y;
    if (area_a != area_b) return area_a < area_b;
    if (a.runs_x != b.runs_x) return a.runs_x > b.runs_x;
    if (a.runs_y != b.runs_y) return a.runs_y > b.runs_y;
    return a.nodes < b.nodes;
}

LayoutTier layout_tier(const Candidate& candidate) {
    if (is_complete_full_layout(candidate)) return LayoutTier::Full;
    if (candidate.nodes.size() == 2 && candidate.links.size() == 1) {
        return LayoutTier::Pair;
    }
    if (candidate.nodes.size() == 3 && candidate.links.size() >= 2) {
        return LayoutTier::LinkedThree;
    }
    return LayoutTier::ConnectedFallback;
}

bool better_across_sizes(const Candidate& a, const Candidate& b) {
    const LayoutTier tier_a = layout_tier(a);
    const LayoutTier tier_b = layout_tier(b);
    if (tier_a != tier_b) return tier_a < tier_b;
    if (a.size_mm != b.size_mm) return a.size_mm < b.size_mm;
    return better_candidate(a, b);
}

std::optional<Candidate> best_candidate_at_size(const CanonicalPolygon& polygon,
                                                const BandSpec& band,
                                                int size_mm,
                                                const EnginePolicy& policy) {
    const ScaledPolygon scaled = scale_polygon(polygon, size_mm);
    std::optional<Candidate> best;
    std::map<GridPoint, P128> centre_cache;
    std::map<GridPoint, bool> disc_cache;
    std::map<std::pair<GridPoint, GridPoint>, bool> link_cache;

    const auto centre_for = [&](const GridPoint& node) {
        const auto found = centre_cache.find(node);
        if (found != centre_cache.end()) return found->second;
        const P128 centre = grid_to_internal(node, scaled, policy);
        centre_cache.emplace(node, centre);
        return centre;
    };

    const auto disc_for = [&](const GridPoint& node) {
        const auto found = disc_cache.find(node);
        if (found != disc_cache.end()) return found->second;
        const bool supported = disc_supported(centre_for(node), scaled, policy);
        disc_cache.emplace(node, supported);
        return supported;
    };

    const auto link_for = [&](GridPoint a, GridPoint b) {
        if (b < a) std::swap(a, b);
        const std::pair<GridPoint, GridPoint> key{a, b};
        const auto found = link_cache.find(key);
        if (found != link_cache.end()) return found->second;
        const bool supported = capsule_supported(centre_for(a), centre_for(b), scaled, policy);
        link_cache.emplace(key, supported);
        return supported;
    };

    for (const TemplateGrid& grid : templates_for_band(band.band)) {
        const int n = static_cast<int>(grid.nodes.size());
        std::vector<bool> supported(n, false);
        for (int i = 0; i < n; ++i) {
            supported[i] = disc_for(grid.nodes[i]);
        }

        std::vector<std::vector<int>> adjacency(n);
        for (int i = 0; i < n; ++i) {
            if (!supported[i]) continue;
            for (int j = i + 1; j < n; ++j) {
                if (!supported[j] || !adjacent_48(grid.nodes[i], grid.nodes[j])) continue;
                if (!link_for(grid.nodes[i], grid.nodes[j])) {
                    continue;
                }
                adjacency[i].push_back(j);
                adjacency[j].push_back(i);
            }
        }

        for (const std::vector<int>& component : connected_components(supported, adjacency)) {
            if (static_cast<int>(component.size()) < band.min_nodes) continue;
            std::vector<GridPoint> nodes;
            nodes.reserve(component.size());
            i64 sum_x = 0;
            i64 sum_y = 0;
            for (int index : component) {
                nodes.push_back(grid.nodes[index]);
                sum_x += grid.nodes[index].x24;
                sum_y += grid.nodes[index].y24;
            }
            std::sort(nodes.begin(), nodes.end());
            if (policy.require_band_span && !component_spans_band(nodes, band.band)) continue;

            const SparseEvaluation sparse = evaluate_sparse(nodes, scaled, band.band, policy);
            if (!sparse.pass) continue;

            Candidate candidate;
            candidate.size_mm = size_mm;
            candidate.runs_x = grid.runs_x;
            candidate.runs_y = grid.runs_y;
            candidate.nodes = std::move(nodes);
            candidate.links = links_for_component(grid.nodes, component, adjacency);
            candidate.sparse_active_count = sparse.active_count;
            candidate.centre_bias = sum_x * sum_x + sum_y * sum_y;
            if (sparse.engaged) {
                candidate.sparse_phase = sparse.representative;
            }
            if (!best || better_candidate(candidate, *best)) best = std::move(candidate);
        }
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

bool better_contact(const ContactCandidate& a, const ContactCandidate& b);

enum class FlapSide { Left, Right, Bottom, Top };

std::vector<GridPoint> side_witness_points(const Candidate& candidate, FlapSide side) {
    int extreme = side == FlapSide::Left || side == FlapSide::Right
                      ? candidate.nodes.front().x24
                      : candidate.nodes.front().y24;
    for (const GridPoint& node : candidate.nodes) {
        const int value = side == FlapSide::Left || side == FlapSide::Right
                              ? node.x24
                              : node.y24;
        if (side == FlapSide::Left || side == FlapSide::Bottom) {
            extreme = std::min(extreme, value);
        } else {
            extreme = std::max(extreme, value);
        }
    }
    std::vector<GridPoint> outer;
    for (const GridPoint& node : candidate.nodes) {
        const int value = side == FlapSide::Left || side == FlapSide::Right
                              ? node.x24
                              : node.y24;
        if (value == extreme) outer.push_back(node);
    }
    std::sort(outer.begin(), outer.end(), [side](const GridPoint& a, const GridPoint& b) {
        return side == FlapSide::Left || side == FlapSide::Right
                   ? std::tie(a.y24, a.x24) < std::tie(b.y24, b.x24)
                   : std::tie(a.x24, a.y24) < std::tie(b.x24, b.y24);
    });

    std::vector<GridPoint> witnesses = outer;
    for (std::size_t i = 1; i < outer.size(); ++i) {
        witnesses.push_back({
            (outer[i - 1].x24 + outer[i].x24) / 2,
            (outer[i - 1].y24 + outer[i].y24) / 2,
        });
    }
    std::sort(witnesses.begin(), witnesses.end());
    witnesses.erase(std::unique(witnesses.begin(), witnesses.end()), witnesses.end());
    return witnesses;
}

P128 tongue_end(const P128& start, FlapSide side, int threshold_mm,
                const ScaledPolygon& polygon) {
    const i128 offset = static_cast<i128>(threshold_mm) * polygon.coordinate_denominator;
    switch (side) {
        case FlapSide::Left: return {start.x - offset, start.y};
        case FlapSide::Right: return {start.x + offset, start.y};
        case FlapSide::Bottom: return {start.x, start.y - offset};
        case FlapSide::Top: return {start.x, start.y + offset};
    }
    fail("internal error: unknown flap side");
}

SideFlapEvidence side_flap_evidence(const Candidate& candidate,
                                    const ScaledPolygon& polygon,
                                    const EnginePolicy& policy,
                                    FlapSide side,
                                    i128 extent_num,
                                    i128 extent_den) {
    SideFlapEvidence out;
    out.extent_reaches_12 = extent_num >= static_cast<i128>(12) * extent_den;
    out.extent_reaches_24 = extent_num >= static_cast<i128>(24) * extent_den;
    const std::vector<GridPoint> witnesses = side_witness_points(candidate, side);

    auto evaluate = [&](int threshold_mm,
                        bool& any, bool& all, bool& exception,
                        std::vector<GridPoint>& failing) {
        all = !witnesses.empty();
        for (const GridPoint& witness : witnesses) {
            const P128 start = grid_to_internal(witness, polygon, policy);
            const P128 end = tongue_end(start, side, threshold_mm, polygon);
            const bool supported = capsule_supported(start, end, polygon, policy);
            any = any || supported;
            all = all && supported;
            if (!supported) failing.push_back(witness);
        }
        exception = extent_num > static_cast<i128>(threshold_mm) * extent_den && !any;
    };

    evaluate(12, out.local_tongue_any_12,
             out.local_tongue_all_12, out.narrow_limb_exception_12,
             out.failing_side_points_12);
    evaluate(24, out.local_tongue_any_24,
             out.local_tongue_all_24, out.narrow_limb_exception_24,
             out.failing_side_points_24);
    return out;
}

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
        const P128 p = grid_to_internal(node, scaled, policy);
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
        const P128 a = grid_to_internal(link.first, scaled, policy);
        const P128 b = grid_to_internal(link.second, scaled, policy);
        for (std::size_t edge = 0; edge < scaled.vertices.size(); ++edge) {
            ContactCandidate contact;
            contact.kind = BindingContact::Kind::DirectCapsule;
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

FlapMetrics flap_metrics(const CanonicalPolygon& polygon,
                         const Candidate& candidate,
                         const EnginePolicy& policy) {
    int min_x24 = candidate.nodes.front().x24;
    int max_x24 = min_x24;
    int min_y24 = candidate.nodes.front().y24;
    int max_y24 = min_y24;
    for (const GridPoint& node : candidate.nodes) {
        min_x24 = std::min(min_x24, node.x24);
        max_x24 = std::max(max_x24, node.x24);
        min_y24 = std::min(min_y24, node.y24);
        max_y24 = std::max(max_y24, node.y24);
    }

    const i128 den = static_cast<i128>(2) * polygon.max_span;
    const i128 shape_half_width_num =
        static_cast<i128>(candidate.size_mm) * (polygon.max_x - polygon.min_x);
    const i128 shape_half_height_num =
        static_cast<i128>(candidate.size_mm) * (polygon.max_y - polygon.min_y);

    const i128 padded_min_x_mm =
        static_cast<i128>(min_x24) * policy.half_pitch_mm - policy.disc_radius_mm;
    const i128 padded_max_x_mm =
        static_cast<i128>(max_x24) * policy.half_pitch_mm + policy.disc_radius_mm;
    const i128 padded_min_y_mm =
        static_cast<i128>(min_y24) * policy.half_pitch_mm - policy.disc_radius_mm;
    const i128 padded_max_y_mm =
        static_cast<i128>(max_y24) * policy.half_pitch_mm + policy.disc_radius_mm;

    // Shape bbox is centred on the lattice origin. Each flap is represented over
    // the common exact denominator 2*max_span.
    const auto nonnegative = [](i128 value) { return std::max<i128>(0, value); };
    const i128 left_num = nonnegative(shape_half_width_num + padded_min_x_mm * den);
    const i128 right_num = nonnegative(shape_half_width_num - padded_max_x_mm * den);
    const i128 bottom_num = nonnegative(shape_half_height_num + padded_min_y_mm * den);
    const i128 top_num = nonnegative(shape_half_height_num - padded_max_y_mm * den);

    const auto mm = [den](i128 numerator) {
        return static_cast<double>(static_cast<long double>(numerator) /
                                   static_cast<long double>(den));
    };
    FlapMetrics out;
    out.exact_den = static_cast<i64>(den);
    out.left_num = static_cast<i64>(left_num);
    out.right_num = static_cast<i64>(right_num);
    out.bottom_num = static_cast<i64>(bottom_num);
    out.top_num = static_cast<i64>(top_num);
    out.left_mm = mm(left_num);
    out.right_mm = mm(right_num);
    out.bottom_mm = mm(bottom_num);
    out.top_mm = mm(top_num);
    out.horizontal_imbalance_mm = mm(left_num >= right_num ? left_num - right_num
                                                           : right_num - left_num);
    out.vertical_imbalance_mm = mm(bottom_num >= top_num ? bottom_num - top_num
                                                         : top_num - bottom_num);
    out.coverage_within_12 = left_num <= 12 * den && right_num <= 12 * den &&
                             bottom_num <= 12 * den && top_num <= 12 * den;
    out.coverage_within_24 = left_num <= 24 * den && right_num <= 24 * den &&
                             bottom_num <= 24 * den && top_num <= 24 * den;
    const ScaledPolygon scaled = scale_polygon(polygon, candidate.size_mm);
    out.left = side_flap_evidence(candidate, scaled, policy, FlapSide::Left,
                                  left_num, den);
    out.right = side_flap_evidence(candidate, scaled, policy, FlapSide::Right,
                                   right_num, den);
    out.bottom = side_flap_evidence(candidate, scaled, policy, FlapSide::Bottom,
                                    bottom_num, den);
    out.top = side_flap_evidence(candidate, scaled, policy, FlapSide::Top,
                                 top_num, den);
    return out;
}

BandResult solve_band(const CanonicalPolygon& polygon,
                      const BandSpec& band,
                      const EnginePolicy& policy) {
    BandResult result;
    result.band = band.band;
    std::optional<Candidate> selected;
    for (int size_mm : band.legal_sizes_mm) {
        std::optional<Candidate> candidate =
            best_candidate_at_size(polygon, band, size_mm, policy);
        if (!candidate) continue;

        if (!selected || better_across_sizes(*candidate, *selected)) {
            selected = std::move(candidate);
        }
    }
    if (selected) {
        const Candidate& candidate = *selected;
        result.fit = true;
        result.layout_tier = layout_tier(candidate);
        result.manufactured_size_mm = candidate.size_mm;
        result.manufactured_width_num =
            static_cast<i64>(candidate.size_mm) * (polygon.max_x - polygon.min_x);
        result.manufactured_height_num =
            static_cast<i64>(candidate.size_mm) * (polygon.max_y - polygon.min_y);
        result.manufactured_dimension_den = polygon.max_span;
        result.manufactured_width_mm =
            static_cast<double>(result.manufactured_width_num) /
            static_cast<double>(result.manufactured_dimension_den);
        result.manufactured_height_mm =
            static_cast<double>(result.manufactured_height_num) /
            static_cast<double>(result.manufactured_dimension_den);
        result.template_runs_x = candidate.runs_x;
        result.template_runs_y = candidate.runs_y;
        result.magnets = candidate.nodes;
        result.verified_links = candidate.links;
        result.sparse_phase = candidate.sparse_phase;
        result.binding = binding_contact(polygon, candidate, policy);
        result.flap = flap_metrics(polygon, candidate, policy);
        result.reason =
            "highest-quality band-spanning, capsule-connected layout; smallest size on ties";
        return result;
    }
    result.fit = false;
    result.reason = "no legal size supports the minimum band-spanning layout";
    return result;
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

}  // namespace magfit
