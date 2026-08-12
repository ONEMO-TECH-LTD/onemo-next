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

void test_sparse_any_accepts_pair_as_one_active_node() {
    PolygonInput rectangle{{{-36, -12}, {36, -12}, {36, 12}, {-36, 12}}};
    EnginePolicy policy;
    policy.sparse.mode = PhaseMode::Any;
    policy.sparse.min_active_nodes = 1;
    const BandResult band = only_band(
        magfit::solve(rectangle, {magfit::default_band_spec(2, policy)}, policy));
    require(band.fit, "sparse-any with one active node should accept band 2 pair");
    require(band.sparse_phase.has_value(), "selected sparse phase should be reported");
    require(band.sparse_phase->active_nodes.size() == 1,
            "band 2 pair exposes one active node on a compatible 96 mm phase");
}

void test_sparse_all_rejects_narrow_pair() {
    PolygonInput rectangle{{{-36, -12}, {36, -12}, {36, 12}, {-36, 12}}};
    EnginePolicy policy;
    policy.sparse.mode = PhaseMode::All;
    policy.sparse.min_active_nodes = 1;
    const BandResult band = only_band(
        magfit::solve(rectangle, {magfit::default_band_spec(2, policy)}, policy));
    require(!band.fit,
            "a 2x1 pair cannot engage under all four 96 mm thinning phase combinations");
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
    require(result.flap.left_ge_12 && result.flap.right_ge_12 &&
            result.flap.bottom_ge_12 && result.flap.top_ge_12,
            "exact 12 mm flap tangency must pass all switches");
    require_near(result.flap.left_mm, 12.0, 1e-9, "exact left flap");
    require(result.flap.left_num == 12 * result.flap.exact_den,
            "flap serialization must retain the exact rational");
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
        test_sparse_any_accepts_pair_as_one_active_node();
        test_sparse_all_rejects_narrow_pair();
        test_collinear_backtracking_rejected();
        test_large_coordinate_origin_is_safe();
        test_flap_switches_use_exact_rationals();
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
