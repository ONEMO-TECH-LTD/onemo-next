#include "magfit/magfit.hpp"

#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <exception>
#include <iostream>
#include <random>
#include <stdexcept>
#include <string>
#include <vector>

using magfit::BandResult;
using magfit::EnginePolicy;
using magfit::GridPoint;
using magfit::PhaseMode;
using magfit::PointI;
using magfit::PolygonInput;

namespace {

void require(bool condition, const std::string& message) {
    if (!condition) throw std::runtime_error(message);
}

void require_near(double actual, double expected, double tolerance,
                  const std::string& message) {
    if (std::abs(actual - expected) > tolerance) {
        throw std::runtime_error(message + ": actual=" + std::to_string(actual) +
                                 " expected=" + std::to_string(expected));
    }
}

using i64_t = magfit::i64;

BandResult only_band(const magfit::SolveResult& result) {
    require(result.bands.size() == 1, "expected one band result");
    return result.bands.front();
}

PolygonInput square(i64_t min, i64_t max) {
    return {{{min, min}, {max, min}, {max, max}, {min, max}}};
}

PolygonInput circle(int radius, int vertex_count = 256) {
    PolygonInput out;
    out.vertices.reserve(vertex_count);
    for (int i = 0; i < vertex_count; ++i) {
        const long double angle = 2.0L * std::acos(-1.0L) * i / vertex_count;
        out.vertices.push_back({
            static_cast<i64_t>(std::llround(radius * std::cos(angle))),
            static_cast<i64_t>(std::llround(radius * std::sin(angle))),
        });
    }
    return out;
}


void test_band2_square_tangent_full_four() {
    const auto result = magfit::solve(square(-36, 36), {magfit::default_band_spec(2)});
    const BandResult band = only_band(result);
    require(band.fit, "72 mm square should fit band 2");
    require(band.manufactured_size_mm == 72, "square should choose 72 mm");
    require(band.magnets.size() == 4, "square should choose four magnets");
    require(band.verified_links.size() == 4, "square should verify four adjacent links");
    require_near(band.binding.clearance_mm, 12.0, 1e-9, "tangency clearance");
    require_near(band.binding.slack_mm, 0.0, 1e-9, "tangency slack");
    require(band.binding.clearance_um_floor == 12'000,
            "tangency clearance must serialize deterministically");
    require(band.binding.slack_um_floor == 0,
            "tangency slack must serialize deterministically");
    require(band.manufactured_width_num == 72 * 72 &&
            band.manufactured_dimension_den == 72,
            "manufactured dimensions must retain an exact rational");
    require_near(band.flap.left_mm, 0.0, 1e-9, "left flap");
    require_near(band.flap.right_mm, 0.0, 1e-9, "right flap");
    require(!band.flap.left.extent_reaches_12 &&
            !band.flap.left.extent_reaches_24,
            "zero overhang must remain neutral raw extent evidence");
    require(!band.flap.left.local_tongue_all_12,
            "a flush square has no 12 mm outward material tongue");
}

void test_band2_narrow_pair() {
    PolygonInput rectangle{{{-36, -12}, {36, -12}, {36, 12}, {-36, 12}}};
    const BandResult band = only_band(
        magfit::solve(rectangle, {magfit::default_band_spec(2)}));
    require(band.fit, "72x24 rectangle should fit band 2");
    require(band.manufactured_size_mm == 72, "narrow rectangle should choose 72 mm");
    require(band.magnets.size() == 2, "narrow rectangle should choose a pair");
    require(band.verified_links.size() == 1, "pair should have one verified link");
    require(band.template_runs_x == 2 && band.template_runs_y == 1,
            "pair should use 2x1 parity template");
}

void test_band2_l_three_nodes_two_links() {
    PolygonInput l_shape{{
        {-36, -36}, {36, -36}, {36, -12}, {-12, -12},
        {-12, 36}, {-36, 36},
    }};
    const BandResult band = only_band(
        magfit::solve(l_shape, {magfit::default_band_spec(2)}));
    require(band.fit, "L shape should fit band 2");
    require(band.manufactured_size_mm == 72, "L shape should choose 72 mm");
    require(band.magnets.size() == 3, "L shape should select three linked nodes");
    require(band.verified_links.size() == 2, "L shape should have two verified links");
}

void test_first_legal_size_not_continuous_rounding() {
    PolygonInput rectangle{{{0, 0}, {72, 0}, {72, 23}, {0, 23}}};
    const BandResult band = only_band(
        magfit::solve(rectangle, {magfit::default_band_spec(2)}));
    require(band.fit, "23:72 rectangle should eventually fit band 2 pair");
    require(band.manufactured_size_mm == 84,
            "72 mm must fail and the first legal passing size must be 84 mm");
}

void test_band3_narrow_three_node_run() {
    PolygonInput rectangle{{{-60, -12}, {60, -12}, {60, 12}, {-60, 12}}};
    const BandResult band = only_band(
        magfit::solve(rectangle, {magfit::default_band_spec(3)}));
    require(band.fit, "120x24 rectangle should fit band 3");
    require(band.manufactured_size_mm == 120, "band 3 line should choose 120 mm");
    require(band.magnets.size() == 3, "band 3 line should use three nodes");
    require(band.verified_links.size() == 2, "band 3 line should use two links");
    require(band.template_runs_x == 3 && band.template_runs_y == 1,
            "band 3 line should use 3x1 parity template");
}

void test_source_scale_and_vertex_order_invariance() {
    PolygonInput a{{{-36, -36}, {36, -36}, {36, 36}, {-36, 36}}};
    PolygonInput b{{{3600, 3600}, {3600, -3600}, {-3600, -3600}, {-3600, 3600}}};
    const auto ra = magfit::solve(a, {magfit::default_band_spec(2)});
    const auto rb = magfit::solve(b, {magfit::default_band_spec(2)});
    const BandResult ba = only_band(ra);
    const BandResult bb = only_band(rb);
    require(ba.manufactured_size_mm == bb.manufactured_size_mm,
            "source coordinate scale must not change result");
    require(ba.magnets == bb.magnets, "winding/start vertex must not change layout");
    require(ra.polygon.vertices.front() == PointI{-36, -36},
            "canonical start vertex should be lexicographically smallest");
    require(rb.polygon.vertices.front() == PointI{-3600, -3600},
            "canonical start vertex should be lexicographically smallest after scaling");
}

void test_sparse_is_not_engaged_in_band2() {
    PolygonInput rectangle{{{-36, -12}, {36, -12}, {36, 12}, {-36, 12}}};
    EnginePolicy policy;
    policy.sparse.mode = PhaseMode::Any;
    const BandResult band = only_band(
        magfit::solve(rectangle, {magfit::default_band_spec(2, policy)}, policy));
    require(band.fit, "band 2 pair must not be rejected by a disengaged 96 mm population");
    require(!band.sparse_phase.has_value(),
            "band 2 must not report a 96 mm phase that is not engaged");
}

void test_sparse_band3_requires_a_connected_pair() {
    PolygonInput rectangle{{{-60, -12}, {60, -12}, {60, 12}, {-60, 12}}};
    EnginePolicy policy;
    const BandResult band = only_band(
        magfit::solve(rectangle, {magfit::default_band_spec(3, policy)}, policy));
    require(band.fit, "band 3 must support a connected sparse pair");
    require(band.sparse_phase.has_value(), "engaged sparse phase must be reported");
    require(band.sparse_phase->active_nodes.size() >= 2,
            "engaged sparse phase must contain at least two nodes");
    require(band.sparse_phase->connected,
            "engaged sparse nodes must form a verified 96 mm connection");
}

void test_sparse_all_rejects_band3_when_one_phase_has_only_one_node() {
    PolygonInput rectangle{{{-60, -12}, {60, -12}, {60, 12}, {-60, 12}}};
    EnginePolicy policy;
    policy.sparse.mode = PhaseMode::All;
    const BandResult band = only_band(
        magfit::solve(rectangle, {magfit::default_band_spec(3, policy)}, policy));
    require(!band.fit,
            "band 3 run cannot engage when every thinning phase must hold a pair");
}


void test_collinear_backtracking_rejected() {
    PolygonInput backtrack{{{0, 0}, {10, 0}, {5, 0}, {5, 10}, {0, 10}}};
    bool threw = false;
    try {
        (void)magfit::solve(backtrack, {magfit::default_band_spec(2)});
    } catch (const std::invalid_argument&) {
        threw = true;
    }
    require(threw, "overlapping adjacent edges must be rejected");
}

void test_large_coordinate_origin_is_safe() {
    constexpr i64_t o = 9'000'000'000'000'000'000LL;
    PolygonInput translated{{{o - 72, o - 72}, {o, o - 72}, {o, o}, {o - 72, o}}};
    const BandResult band = only_band(
        magfit::solve(translated, {magfit::default_band_spec(2)}));
    require(band.fit && band.manufactured_size_mm == 72,
            "large absolute origin must not alter local exact geometry");
}

void test_flap_switches_use_exact_rationals() {
    // At 96 mm, a 2x2 layout has exactly 12 mm bbox flap on every side.
    PolygonInput square_shape{{{-48, -48}, {48, -48}, {48, 48}, {-48, 48}}};
    magfit::BandSpec band = magfit::default_band_spec(2);
    band.legal_sizes_mm = {96};
    const BandResult result = only_band(magfit::solve(square_shape, {band}));
    require(result.fit, "96 mm square should fit");
    require(result.flap.left.extent_reaches_12 &&
            !result.flap.left.extent_reaches_24,
            "exact 12 mm extent must be reported without a policy label");
    require(result.flap.left.local_tongue_all_12,
            "a 12 mm-wide square overhang must contain every local 12 mm tongue");
    require_near(result.flap.left_mm, 12.0, 1e-9, "exact left flap");
    require(result.flap.left_num == 12 * result.flap.exact_den,
            "flap serialization must retain the exact rational");
}

void test_flap_thresholds_are_neutral_geometry_evidence() {
    magfit::BandSpec band = magfit::default_band_spec(2);
    band.legal_sizes_mm = {108};
    const BandResult result = only_band(magfit::solve(circle(10'000), {band}));
    require(result.fit && result.magnets.size() == 4,
            "108 mm circle must expose the four-disc flap case");
    require_near(result.flap.left_mm, 18.0, 0.01, "circle left overhang");
    require(result.flap.left.extent_reaches_12,
            "18 mm overhang must reach the 12 mm threshold");
    require(!result.flap.left.extent_reaches_24,
            "18 mm overhang must not reach the 24 mm threshold");
    require(result.flap.left.local_tongue_any_12,
            "circle side midpoint must prove a local 12 mm tongue");
    require(!result.flap.left.local_tongue_all_12,
            "circle corners may fail while the side midpoint still passes");
    require(!result.flap.left.narrow_limb_exception_12,
            "a smooth circle must not be classified as a narrow limb");
    require(!result.flap.coverage_within_12 && result.flap.coverage_within_24,
            "18 mm circle overhang must fail 12 mm coverage and pass 24 mm coverage");
}

void test_thin_antenna_reports_narrow_limb_exception() {
    PolygonInput antenna{{
        {-60, -36}, {60, -36}, {60, 36}, {6, 36},
        {6, 72}, {-6, 72}, {-6, 36}, {-60, 36},
    }};
    magfit::BandSpec band = magfit::default_band_spec(2);
    band.legal_sizes_mm = {108};
    const BandResult result = only_band(magfit::solve(antenna, {band}));
    require(result.fit, "antenna body must still support the band-2 layout");
    require(result.flap.top.extent_reaches_12,
            "thin antenna must create a top bbox extent");
    require(!result.flap.top.local_tongue_all_12,
            "thin antenna must fail at least one full-width local tongue");
    require(result.flap.top.narrow_limb_exception_12,
            "extent without all local tongues must be reported as a narrow-limb exception");
    require(!result.flap.top.failing_side_points_12.empty(),
            "narrow-limb exception must name the failing side witnesses");
}

void test_cove_is_visible_to_local_flap_evidence() {
    PolygonInput cove{{
        {-54, -54}, {54, -54}, {54, 54}, {36, 54},
        {36, 42}, {12, 42}, {12, 54}, {-54, 54},
    }};
    magfit::BandSpec band = magfit::default_band_spec(2);
    band.legal_sizes_mm = {108};
    const BandResult result = only_band(magfit::solve(cove, {band}));
    require(result.fit && result.magnets.size() == 4,
            "cove fixture must retain the four supported magnet discs");
    require(result.flap.top.extent_reaches_12,
            "cove bbox must still report its top extent");
    require(result.flap.top.local_tongue_any_12 &&
            !result.flap.top.local_tongue_all_12,
            "local evidence must distinguish the cove from the intact top side");
    require(!result.flap.top.narrow_limb_exception_12,
            "a partial cove is evidence, not an automatic narrow-limb exception");
    require(std::find(result.flap.top.failing_side_points_12.begin(),
                      result.flap.top.failing_side_points_12.end(),
                      GridPoint{1, 1}) != result.flap.top.failing_side_points_12.end(),
            "cove evidence must name the affected top-right witness");
}

void test_u_corridor_is_not_a_direct_full_layout() {
    PolygonInput u_corridor{{
        {-60, -60}, {60, -60}, {60, 60}, {12, 60},
        {12, 0}, {-12, 0}, {-12, 60}, {-60, 60},
    }};
    magfit::BandSpec band = magfit::default_band_spec(2);
    band.legal_sizes_mm = {96};
    const BandResult result = only_band(magfit::solve(u_corridor, {band}));
    require(result.fit && result.magnets.size() == 4,
            "U corridor must preserve the four individually supported discs");
    require(result.verified_links.size() == 3,
            "direct-capsule mode must reject the link that crosses the open cove");
    require(result.layout_tier == magfit::LayoutTier::ConnectedFallback,
            "four discs with a missing direct link must not be classified as full");
}

void test_full_layout_precedes_smaller_pair() {
    const PolygonInput round = circle(10'000);
    const BandResult wrapped = only_band(
        magfit::solve(round, {magfit::default_band_spec(2)}));
    require(wrapped.manufactured_size_mm == 96 && wrapped.magnets.size() == 4,
            "band 2 must prefer the four-disc wrap over a smaller pair");
}

void test_band4_is_exercised() {
    const BandResult band = only_band(
        magfit::solve(square(-84, 84), {magfit::default_band_spec(4)}));
    require(band.fit && band.manufactured_size_mm == 168,
            "band 4 square must fit its 168 mm canonical size");
    require(band.magnets.size() == 16,
            "band 4 square must expose the full 4x4 layout");
}


void test_illegal_custom_band_size_rejected() {
    magfit::BandSpec band = magfit::default_band_spec(2);
    band.legal_sizes_mm = {74};
    bool threw = false;
    try {
        (void)magfit::solve(square(-36, 36), {band});
    } catch (const std::invalid_argument&) {
        threw = true;
    }
    require(threw, "custom sizes must remain inside the band and on the 12 mm step");
}

void test_duplicate_legal_sizes_rejected() {
    magfit::BandSpec band = magfit::default_band_spec(2);
    band.legal_sizes_mm = {72, 72};
    bool threw = false;
    try {
        (void)magfit::solve(square(-36, 36), {band});
    } catch (const std::invalid_argument&) {
        threw = true;
    }
    require(threw, "legal sizes must form a strict sequence");
}


void test_deterministic_retrace_invariance_corpus() {
    std::mt19937 rng(0x4D414746U);
    std::uniform_int_distribution<int> jitter(-2500, 2500);
    constexpr int kCases = 100;
    constexpr int kVertices = 48;

    const std::vector<magfit::BandSpec> bands{
        magfit::default_band_spec(2),
        magfit::default_band_spec(3),
    };

    for (int case_index = 0; case_index < kCases; ++case_index) {
        std::vector<PointI> vertices;
        vertices.reserve(kVertices);
        for (int i = 0; i < kVertices; ++i) {
            const long double angle = 2.0L * std::acos(-1.0L) * i / kVertices;
            const long double radius = 20000.0L + jitter(rng);
            vertices.push_back({
                static_cast<i64_t>(std::llround(radius * std::cos(angle))),
                static_cast<i64_t>(std::llround(radius * std::sin(angle))),
            });
        }

        PolygonInput a{vertices};
        std::vector<PointI> transformed = vertices;
        std::reverse(transformed.begin(), transformed.end());
        std::rotate(transformed.begin(), transformed.begin() + (case_index % kVertices),
                    transformed.end());
        for (PointI& p : transformed) {
            p.x += 1'000'000;
            p.y -= 2'000'000;
        }
        PolygonInput b{transformed};

        const auto ra = magfit::solve(a, bands);
        const auto rb = magfit::solve(b, bands);
        require(ra.bands.size() == rb.bands.size(), "corpus band count mismatch");
        for (std::size_t i = 0; i < ra.bands.size(); ++i) {
            const BandResult& ba = ra.bands[i];
            const BandResult& bb = rb.bands[i];
            require(ba.fit == bb.fit, "translation/winding changed fit decision");
            require(ba.manufactured_size_mm == bb.manufactured_size_mm,
                    "translation/winding changed manufactured size");
            require(ba.magnets == bb.magnets,
                    "translation/winding changed selected magnet layout");
            if (ba.fit) {
                require(ba.binding.slack_mm >= -1e-9,
                        "selected corpus layout has negative binding slack");
            }
        }
    }
}

void test_invalid_self_intersection_rejected() {
    PolygonInput bowtie{{{0, 0}, {10, 10}, {0, 10}, {10, 0}}};
    bool threw = false;
    try {
        (void)magfit::solve(bowtie, {magfit::default_band_spec(2)});
    } catch (const std::invalid_argument&) {
        threw = true;
    }
    require(threw, "self-intersecting trace must be rejected, not repaired silently");
}

}  // namespace

int main() {
    try {
        test_band2_square_tangent_full_four();
        test_band2_narrow_pair();
        test_band2_l_three_nodes_two_links();
        test_first_legal_size_not_continuous_rounding();
        test_band3_narrow_three_node_run();
        test_source_scale_and_vertex_order_invariance();
        test_sparse_is_not_engaged_in_band2();
        test_sparse_band3_requires_a_connected_pair();
        test_sparse_all_rejects_band3_when_one_phase_has_only_one_node();
        test_collinear_backtracking_rejected();
        test_large_coordinate_origin_is_safe();
        test_flap_switches_use_exact_rationals();
        test_flap_thresholds_are_neutral_geometry_evidence();
        test_thin_antenna_reports_narrow_limb_exception();
        test_cove_is_visible_to_local_flap_evidence();
        test_u_corridor_is_not_a_direct_full_layout();
        test_full_layout_precedes_smaller_pair();
        test_band4_is_exercised();
        test_illegal_custom_band_size_rejected();
        test_duplicate_legal_sizes_rejected();
        test_deterministic_retrace_invariance_corpus();
        test_invalid_self_intersection_rejected();
        std::cout << "all magfit tests passed\n";
        return EXIT_SUCCESS;
    } catch (const std::exception& e) {
        std::cerr << "test failure: " << e.what() << '\n';
        return EXIT_FAILURE;
    }
}
