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
// tangency against the flats while the 2x2 square first holds at 94mm (needs
// 100·s/144 ≥ 48+24√2 ≈ 64.97 → s ≥ 93.6, first even size 94) — the circle-calibration
// case in deterministic integer form, at the freed any-even-mm sizes of §B6.
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
    // §B6: sizes are any whole even mm. The 23:72 aspect needs 24mm of height for the
    // pair: 23·s/72 ≥ 24 → s ≥ 75.13 → first even size 76 (the 12mm ladder would have
    // said 84 — the freed law finds the honest touch-point).
    PolygonInput rectangle{{{0, 0}, {72, 0}, {72, 23}, {0, 23}}};
    const BandResult band = only_band(
        magfit::solve(rectangle, {magfit::default_band_spec(2)}));
    require(band.fit, "23:72 rectangle should eventually fit band 2 pair");
    require(band.manufactured_size_mm == 76,
            "72 must fail and the first even passing size must be 76 mm");
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

void test_band3_strict_sparse_mode() {
    // §B8: 96 engagement is advisory by default — the STRICT pair gate (two active
    // nodes, connected) is an explicit mode. Under it, a FIXED phase that keeps no
    // nodes rejects; the compatible phase passes with a connected pair.
    // Residues are mod 2 on lattice indices (§B10): the ribbon's single row sits at
    // index 0, so a fixed phase demanding odd rows keeps nothing; odd columns keep the
    // two outer nodes of a three-run — the 96mm pair.
    PolygonInput rectangle{{{-60, -12}, {60, -12}, {60, 12}, {-60, 12}}};
    EnginePolicy wrong_phase;
    wrong_phase.sparse.mode = PhaseMode::Fixed;
    wrong_phase.sparse.min_active_nodes = 2;
    wrong_phase.sparse.require_96mm_connected = true;
    wrong_phase.sparse.fixed_x_residue_mod4 = 0;
    wrong_phase.sparse.fixed_y_residue_mod4 = 1;
    const BandResult rejected = only_band(magfit::solve(
        rectangle, {magfit::default_band_spec(3, wrong_phase)}, wrong_phase));
    require(!rejected.fit,
            "strict mode: a fixed phase keeping no active nodes rejects band 3");

    EnginePolicy right_phase;
    right_phase.sparse.mode = PhaseMode::Fixed;
    right_phase.sparse.min_active_nodes = 2;
    right_phase.sparse.require_96mm_connected = true;
    right_phase.sparse.fixed_x_residue_mod4 = 1;
    right_phase.sparse.fixed_y_residue_mod4 = 0;
    const BandResult accepted = only_band(magfit::solve(
        rectangle, {magfit::default_band_spec(3, right_phase)}, right_phase));
    require(accepted.fit && accepted.manufactured_size_mm == 120,
            "the compatible fixed phase keeps the 120 mm three-node run");
    require(accepted.sparse_phase.has_value() &&
                accepted.sparse_phase->active_nodes.size() == 2 &&
                accepted.sparse_phase->connected,
            "strict band 3 exposes a connected 96 mm pair");
}

void test_layout_first_calibration_octagon() {
    // The circle case in integer form: the pair fits at 72, but the full square is the
    // band's calibration and first holds at 94 (the law book's own circle row says 92
    // for a true circle — same law, this chamfer). LayoutFirst answers the square,
    // SizeFirst answers 72/pair.
    const BandResult calibrated = only_band(
        magfit::solve(octagon(), {magfit::default_band_spec(2)}));
    require(calibrated.fit, "octagon should fit band 2");
    require(calibrated.manufactured_size_mm == 94,
            "layout-first must pick the smallest even size holding the full square");
    require(calibrated.magnets.size() == 4 && calibrated.verified_links.size() == 4,
            "layout-first band 2 answer is the complete 2x2 square");

    EnginePolicy size_first;
    size_first.selection = magfit::Selection::SizeFirst;
    const BandResult snug = only_band(magfit::solve(
        octagon(), {magfit::default_band_spec(2, size_first)}, size_first));
    require(snug.fit && snug.manufactured_size_mm == 72 && snug.magnets.size() == 2,
            "size-first must keep the 72 mm pair");
}

void test_layout_first_band3_octagon_tier() {
    // §B6 frees the sizes, so the full 3x3 square (needs 100·s/144 ≥ 96+24√2·... →
    // s ≥ 162.7) fits INSIDE band 3 at 164 mm — the 12mm ladder would have pushed it
    // past the band to 168. Strongest tier anywhere in the range wins: 164/nine-disc,
    // perfectly balanced, with four nodes engaging the 96 garment on its best phase.
    const BandResult band = only_band(
        magfit::solve(octagon(), {magfit::default_band_spec(3)}));
    require(band.fit && band.manufactured_size_mm == 164,
            "octagon band 3 should hold the full 3x3 square at 164 mm");
    require(band.magnets.size() == 9, "octagon band 3 layout is the full square");
    require(band.sparse_phase.has_value() &&
                band.sparse_phase->active_nodes.size() == 4,
            "the best 96 phase keeps the four corners");
}

void test_band4_square_regression() {
    // Pins the shipped fact against the earlier "band 4 missing" claim.
    const BandResult band = only_band(
        magfit::solve(square(-36, 36), {magfit::default_band_spec(4)}));
    require(band.fit && band.manufactured_size_mm == 168,
            "a square publishes band 4 at 168 mm");
    require(band.magnets.size() == 16, "band 4 full square carries 16 magnets");
}

void test_u_shape_curved_connection_via_adjacent_links() {
    // GPT's own U counterexample (team-review validation §4), run against the real
    // lattice: outer square [-60,60]^2 with an open top notch (-18,18)x[-20,60]. The
    // straight span across the notch is not a link — but the layout graph connects the
    // two legs AROUND the notch through adjacent supported nodes, so the engine
    // represents the curved corridor at lattice resolution. The notch node (0,48) is
    // honestly absent.
    PolygonInput u_shape{{{-60, -60}, {60, -60}, {60, 60}, {18, 60},
                          {18, -20}, {-18, -20}, {-18, 60}, {-60, 60}}};
    const BandResult band = only_band(
        magfit::solve(u_shape, {magfit::default_band_spec(3)}));
    require(band.fit && band.manufactured_size_mm == 120, "U shape fits band 3 at 120 mm");
    // The notch cavity spans (-18,18)x(-20,60): it swallows (0,0) and (0,48); the seven
    // remaining nodes survive as ONE component joined around the bottom.
    require(band.magnets.size() == 7, "U keeps seven nodes — both cavity nodes are out");
    for (const GridPoint& m : band.magnets) {
        require(!(m.x24 == 0 && (m.y24 == 0 || m.y24 == 2)),
                "no magnet may sit in the open notch cavity");
    }
    require(band.verified_links.size() == 6,
            "the two legs connect around the bottom through six adjacent links");
}

void test_prepared_equals_one_shot() {
    // v2 acceptance gate: canonicalise-once + solve_canonical must equal the one-shot
    // solve on every decision field.
    const PolygonInput shape = octagon();
    const std::vector<magfit::BandSpec> bands{
        magfit::default_band_spec(2), magfit::default_band_spec(3)};
    const auto one_shot = magfit::solve(shape, bands);
    const auto canonical = magfit::canonicalize_and_validate(shape, {});
    const auto prepared = magfit::solve_canonical(canonical, bands, {});
    require(one_shot.bands.size() == prepared.bands.size(), "band count must match");
    for (std::size_t i = 0; i < one_shot.bands.size(); ++i) {
        const BandResult& a = one_shot.bands[i];
        const BandResult& b = prepared.bands[i];
        require(a.fit == b.fit && a.manufactured_size_mm == b.manufactured_size_mm &&
                    a.magnets == b.magnets && a.verified_links == b.verified_links,
                "prepared and one-shot answers must be identical");
    }
}

void test_cross_l_support_and_flap_facts() {
    // §B10: the placement search finds the strongest support the material carries — for
    // the cross that is a three-magnet L through its arms at 108 mm (one node per arm
    // reach), outranking the centred 72 mm pair by tier. The far arms then read as
    // genuine broad overhangs (the 36 mm-wide arm carries a full 24 mm tongue past the
    // limit), while the covered sides sit at zero.
    const BandResult band = only_band(
        magfit::solve(cross_shape(), {magfit::default_band_spec(2)}));
    require(band.fit && band.manufactured_size_mm == 108 && band.magnets.size() == 3,
            "cross should hold the three-node L at 108 mm");
    require(band.verified_links.size() == 2, "the L is two linked pairs sharing a node");
    require_near(band.flap.right.mm, 0.0, 1e-9, "covered side has zero flap");
    require(band.flap.right.within_12, "zero flap passes the 12 limit");
    require(!band.flap.left.within_24 && band.flap.left.broad_beyond_24,
            "the far arm is a genuine broad overhang, not a trivial limb");
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
    // §B6: the size is any whole EVEN millimetre inside the band range. 74 is legal;
    // an odd size and an out-of-band size are not.
    magfit::BandSpec even_size = magfit::default_band_spec(2);
    even_size.legal_sizes_mm = {74};
    const BandResult ok = only_band(magfit::solve(square(-36, 36), {even_size}));
    require(ok.fit && ok.manufactured_size_mm == 74,
            "any even size inside the band is manufacturable");

    magfit::BandSpec odd_size = magfit::default_band_spec(2);
    odd_size.legal_sizes_mm = {75};
    bool threw = false;
    try {
        (void)magfit::solve(square(-36, 36), {odd_size});
    } catch (const std::invalid_argument&) {
        threw = true;
    }
    require(threw, "odd sizes are off the even-mm publication step");

    magfit::BandSpec outside = magfit::default_band_spec(2);
    outside.legal_sizes_mm = {130};
    threw = false;
    try {
        (void)magfit::solve(square(-36, 36), {outside});
    } catch (const std::invalid_argument&) {
        threw = true;
    }
    require(threw, "a size outside the band interval is not that band's size");
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
        test_band3_strict_sparse_mode();
        test_layout_first_calibration_octagon();
        test_layout_first_band3_octagon_tier();
        test_band4_square_regression();
        test_u_shape_curved_connection_via_adjacent_links();
        test_prepared_equals_one_shot();
        test_cross_l_support_and_flap_facts();
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
