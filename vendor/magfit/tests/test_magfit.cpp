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

// Octagon with axis-aligned flats: 144 units across flats, corners chamfered back to
// |x|+|y| <= 100. Integer coordinates, so the band-2 pair at 72mm sits at EXACT closed
// tangency against the flats while the 2x2 square first holds at 96mm (needs
// 100·s/144 ≥ 48+24√2 ≈ 64.97 → s ≥ 93.6) — the addendum's circle-calibration case in
// deterministic integer form.
PolygonInput octagon() {
    return {{{-72, -28}, {-28, -72}, {28, -72}, {72, -28},
             {72, 28}, {28, 72}, {-28, 72}, {-72, 28}}};
}

// Plus/cross: arms 24 units wide, 72 across. The pair fits at 72mm; the perpendicular
// flaps measure exactly 24mm and no 24mm-wide tongue passes through an outer magnet —
// the ruled trivial-limb exception case.
PolygonInput cross_shape() {
    return {{{-12, -36}, {12, -36}, {12, -12}, {36, -12}, {36, 12}, {12, 12},
             {12, 36}, {-12, 36}, {-12, 12}, {-36, 12}, {-36, -12}, {-12, -12}}};
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
    require_near(band.flap.left.mm, 0.0, 1e-9, "left flap");
    require_near(band.flap.right.mm, 0.0, 1e-9, "right flap");
    // L14: zero overhang is the canonical PASS — the square IS the box.
    require(band.flap.left.within_12 && band.flap.right.within_12 &&
            band.flap.bottom.within_12 && band.flap.top.within_12,
            "zero flap must pass the 12mm maximum");
    require(band.flap.left.within_24 && band.flap.top.within_24,
            "zero flap must pass the 24mm maximum");
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

void test_band2_carries_no_sparse_gate() {
    // Addendum §B2: the 96 lattice is not engaged at band 2 — even the strictest sparse
    // policy must not gate a band-2 answer. (The base engine's ANY+min-1 default was a
    // provable no-op; the honest form is no gate at all.)
    PolygonInput rectangle{{{-36, -12}, {36, -12}, {36, 12}, {-36, 12}}};
    EnginePolicy policy;
    policy.sparse.mode = PhaseMode::All;
    policy.sparse.min_active_nodes = 2;
    policy.sparse.require_96mm_connected = true;
    const BandResult band = only_band(
        magfit::solve(rectangle, {magfit::default_band_spec(2, policy)}, policy));
    require(band.fit, "band 2 must not be gated by any sparse policy");
    require(band.manufactured_size_mm == 72, "band 2 pair stays at 72 mm");
    require(!band.sparse_phase.has_value(),
            "band 2 reports no sparse phase — 96 engages from band 3");
}

void test_band3_requires_a_sparse_pair() {
    // L14: from band 3 up the layout must hold on the sparse population too — two active
    // nodes 96 mm apart with a supported capsule. A FIXED phase that keeps no nodes
    // rejects; the compatible phase passes.
    PolygonInput rectangle{{{-60, -12}, {60, -12}, {60, 12}, {-60, 12}}};
    EnginePolicy wrong_phase;
    wrong_phase.sparse.mode = PhaseMode::Fixed;
    wrong_phase.sparse.fixed_x_residue_mod4 = 0;
    wrong_phase.sparse.fixed_y_residue_mod4 = 2;
    const BandResult rejected = only_band(magfit::solve(
        rectangle, {magfit::default_band_spec(3, wrong_phase)}, wrong_phase));
    require(!rejected.fit, "a fixed phase keeping no active nodes must reject band 3");

    EnginePolicy right_phase;
    right_phase.sparse.mode = PhaseMode::Fixed;
    right_phase.sparse.fixed_x_residue_mod4 = 2;
    right_phase.sparse.fixed_y_residue_mod4 = 0;
    const BandResult accepted = only_band(magfit::solve(
        rectangle, {magfit::default_band_spec(3, right_phase)}, right_phase));
    require(accepted.fit && accepted.manufactured_size_mm == 120,
            "the compatible fixed phase keeps the 120 mm three-node run");
    require(accepted.sparse_phase.has_value() &&
                accepted.sparse_phase->active_nodes.size() == 2 &&
                accepted.sparse_phase->connected,
            "band 3 must expose a connected 96 mm pair");
}

void test_layout_first_calibration_octagon() {
    // The addendum's circle case in integer form: the pair fits at 72, but the full
    // square is the band's calibration and first holds at 96 — LayoutFirst answers
    // 96/four-disc, SizeFirst answers 72/pair.
    const BandResult calibrated = only_band(
        magfit::solve(octagon(), {magfit::default_band_spec(2)}));
    require(calibrated.fit, "octagon should fit band 2");
    require(calibrated.manufactured_size_mm == 96,
            "layout-first must pick the smallest size holding the full square");
    require(calibrated.magnets.size() == 4 && calibrated.verified_links.size() == 4,
            "layout-first band 2 answer is the complete 2x2 square");

    EnginePolicy size_first;
    size_first.selection = magfit::Selection::SizeFirst;
    const BandResult snug = only_band(magfit::solve(
        octagon(), {magfit::default_band_spec(2, size_first)}, size_first));
    require(snug.fit && snug.manufactured_size_mm == 72 && snug.magnets.size() == 2,
            "size-first must keep the base contract's 72 mm pair");
}

void test_layout_first_band3_octagon_plus() {
    // No size in band 3 holds the full 3x3 square for the octagon (needs ~163 mm), so
    // the fallback applies: smallest size with a valid layout — the five-node plus at
    // 120 mm, whose sparse phase keeps a connected 96 mm pair.
    const BandResult band = only_band(
        magfit::solve(octagon(), {magfit::default_band_spec(3)}));
    require(band.fit && band.manufactured_size_mm == 120,
            "octagon band 3 should fall back to 120 mm");
    require(band.magnets.size() == 5, "octagon band 3 layout is the five-node plus");
    require(band.sparse_phase.has_value() &&
                band.sparse_phase->active_nodes.size() == 2,
            "the plus keeps a 96 mm sparse pair");
}

void test_band4_square_regression() {
    // Pins the shipped fact against the earlier "band 4 missing" claim.
    const BandResult band = only_band(
        magfit::solve(square(-36, 36), {magfit::default_band_spec(4)}));
    require(band.fit && band.manufactured_size_mm == 168,
            "a square publishes band 4 at 168 mm");
    require(band.magnets.size() == 16, "band 4 full square carries 16 magnets");
}

void test_cross_trivial_limb_reported() {
    // The cross fits a pair at 72; the perpendicular flaps measure exactly 24 mm. Under
    // L14 they pass the 24 limit, fail the 12 limit — and no 24 mm-wide tongue passes
    // through an outer magnet, so the 12-limit excess is the reported trivial-limb
    // exception, not a broad flap.
    const BandResult band = only_band(
        magfit::solve(cross_shape(), {magfit::default_band_spec(2)}));
    require(band.fit && band.manufactured_size_mm == 72 && band.magnets.size() == 2,
            "cross should hold a 72 mm pair");
    const bool horizontal = band.template_runs_x == 2;
    const magfit::FlapSide& far_a = horizontal ? band.flap.top : band.flap.right;
    const magfit::FlapSide& far_b = horizontal ? band.flap.bottom : band.flap.left;
    require_near(far_a.mm, 24.0, 1e-9, "perpendicular flap measures 24 mm");
    require(far_a.within_24 && far_b.within_24, "24 mm overhang passes the 24 limit");
    require(!far_a.within_12 && !far_b.within_12, "24 mm overhang exceeds the 12 limit");
    require(!far_a.broad_beyond_12 && !far_b.broad_beyond_12,
            "no broad tongue through an outer magnet — trivial-limb exception reported");
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
    // At 96 mm, a 2x2 layout has exactly 12 mm bbox flap on every side. L14 limits are
    // inclusive maxima, so exactly 12 passes the 12 switch.
    PolygonInput square_shape{{{-48, -48}, {48, -48}, {48, 48}, {-48, 48}}};
    magfit::BandSpec band = magfit::default_band_spec(2);
    band.legal_sizes_mm = {96};
    const BandResult result = only_band(magfit::solve(square_shape, {band}));
    require(result.fit, "96 mm square should fit");
    require(result.flap.left.within_12 && result.flap.right.within_12 &&
            result.flap.bottom.within_12 && result.flap.top.within_12,
            "exactly 12 mm of flap sits within the inclusive 12 mm maximum");
    require_near(result.flap.left.mm, 12.0, 1e-9, "exact left flap");
    require(result.flap.left.num == 12 * result.flap.exact_den,
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
        test_band2_carries_no_sparse_gate();
        test_band3_requires_a_sparse_pair();
        test_layout_first_calibration_octagon();
        test_layout_first_band3_octagon_plus();
        test_band4_square_regression();
        test_cross_trivial_limb_reported();
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
