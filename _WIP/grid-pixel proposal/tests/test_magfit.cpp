#include "magfit/magfit.hpp"

#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <iostream>
#include <random>
#include <stdexcept>
#include <string>
#include <vector>

using magfit::BandReview;
using magfit::EnginePolicy;
using magfit::GridPoint;
using magfit::LayoutKind;
using magfit::LayoutOption;
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

BandReview only_band(const magfit::SolveResult& result) {
    require(result.bands.size() == 1, "expected one reviewed band");
    return result.bands.front();
}

PolygonInput square(std::int64_t min, std::int64_t max) {
    return {{{min, min}, {max, min}, {max, max}, {min, max}}};
}

PolygonInput circle(int radius, int vertex_count = 720) {
    PolygonInput out;
    out.vertices.reserve(vertex_count);
    for (int i = 0; i < vertex_count; ++i) {
        const long double angle = 2.0L * std::acos(-1.0L) * i / vertex_count;
        out.vertices.push_back({
            static_cast<std::int64_t>(std::llround(radius * std::cos(angle))),
            static_cast<std::int64_t>(std::llround(radius * std::sin(angle))),
        });
    }
    return out;
}

const LayoutOption* find_option(const BandReview& band, int size,
                                const std::vector<GridPoint>& magnets) {
    const auto found = std::find_if(band.options.begin(), band.options.end(),
                                    [&](const LayoutOption& option) {
        return option.manufactured_size_mm == size && option.magnets == magnets;
    });
    return found == band.options.end() ? nullptr : &*found;
}

void test_square_exposes_all_band2_sizes_and_layouts() {
    const BandReview band = only_band(
        magfit::solve(square(-36, 36), {magfit::default_band_spec(2)}));
    const LayoutOption* full = find_option(
        band, 72, {{-1, -1}, {-1, 1}, {1, -1}, {1, 1}});
    const LayoutOption* horizontal = find_option(band, 72, {{-1, 0}, {1, 0}});
    const LayoutOption* vertical = find_option(band, 72, {{0, -1}, {0, 1}});
    require(full != nullptr && horizontal != nullptr && vertical != nullptr,
            "review must retain full square and both pair registrations at 72 mm");
    require(full->layout_kind == LayoutKind::Full && full->verified_links.size() == 4,
            "full square topology must be descriptive evidence");
    require_near(full->binding.clearance_mm, 12.0, 1e-9, "tangency clearance");
    require(full->binding.slack_um_floor == 0,
            "closed tangency must serialize as zero slack");
    for (int size : {72, 84, 96, 108}) {
        require(std::any_of(band.options.begin(), band.options.end(), [&](const auto& option) {
            return option.manufactured_size_mm == size;
        }), "every legal passing band-2 size must remain visible");
    }
}

void test_connected_subsets_are_not_collapsed_to_maximal_component() {
    magfit::BandSpec band = magfit::default_band_spec(3);
    band.legal_sizes_mm = {120};
    const BandReview review = only_band(magfit::solve(circle(10'000), {band}));
    const LayoutOption* cross = find_option(
        review, 120, {{-2, 0}, {0, -2}, {0, 0}, {0, 2}, {2, 0}});
    const LayoutOption* run = find_option(review, 120, {{-2, 0}, {0, 0}, {2, 0}});
    const LayoutOption* four_node_l = find_option(
        review, 120, {{-2, 0}, {0, -2}, {0, 0}, {2, 0}});
    require(cross != nullptr && run != nullptr && four_node_l != nullptr,
            "cross, run and L subsets must coexist in the review result");
    require(cross->layout_kind == LayoutKind::Connected &&
            run->layout_kind == LayoutKind::LinkedThree &&
            four_node_l->layout_kind == LayoutKind::Connected,
            "layout kinds must label topology without selecting a winner");
}

void test_overlapping_parent_windows_deduplicate_physical_options() {
    magfit::BandSpec band = magfit::default_band_spec(3);
    band.legal_sizes_mm = {120};
    const BandReview review = only_band(magfit::solve(circle(10'000), {band}));
    const LayoutOption* vertical = find_option(review, 120, {{0, -2}, {0, 0}, {0, 2}});
    require(vertical != nullptr, "vertical three-run must exist");
    require(vertical->source_windows.size() >= 2,
            "deduped option must retain every source-window provenance");
    require(std::count_if(review.options.begin(), review.options.end(), [&](const auto& option) {
        return option.manufactured_size_mm == 120 && option.magnets == vertical->magnets;
    }) == 1, "identical physical options must appear exactly once");
}

void test_band2_sparse_is_disengaged_and_band3_lists_phases() {
    EnginePolicy policy;
    const BandReview band2 = only_band(magfit::solve(
        square(-36, 36), {magfit::default_band_spec(2, policy)}, policy));
    require(std::all_of(band2.options.begin(), band2.options.end(),
                        [](const auto& option) { return option.sparse_phases.empty(); }),
            "band 2 must not invent sparse engagement");

    PolygonInput rectangle{{{-60, -12}, {60, -12}, {60, 12}, {-60, 12}}};
    const BandReview band3 = only_band(magfit::solve(
        rectangle, {magfit::default_band_spec(3, policy)}, policy));
    require(!band3.options.empty(), "band 3 must expose sparse-compatible options");
    require(std::all_of(band3.options.begin(), band3.options.end(), [](const auto& option) {
        return !option.sparse_phases.empty() &&
               std::all_of(option.sparse_phases.begin(), option.sparse_phases.end(),
                           [](const auto& phase) {
            return phase.active_nodes.size() >= 2 && phase.connected;
        });
    }), "ANY mode must report every passing phase on each physical option");
}

void test_sparse_all_requires_every_phase() {
    PolygonInput rectangle{{{-60, -12}, {60, -12}, {60, 12}, {-60, 12}}};
    EnginePolicy policy;
    policy.sparse.mode = PhaseMode::All;
    const BandReview band = only_band(magfit::solve(
        rectangle, {magfit::default_band_spec(3, policy)}, policy));
    require(band.options.empty(),
            "ALL mode must expose no option when one phase lacks a connected pair");
}

void test_flap_evidence_is_per_option() {
    magfit::BandSpec band = magfit::default_band_spec(2);
    band.legal_sizes_mm = {108};
    const BandReview review = only_band(magfit::solve(circle(10'000), {band}));
    const LayoutOption* full = find_option(
        review, 108, {{-1, -1}, {-1, 1}, {1, -1}, {1, 1}});
    require(full != nullptr, "108 mm circle full layout must remain visible");
    require_near(full->flap.left_mm, 18.0, 0.01, "circle left overhang");
    require(!full->flap.coverage_within_12 && full->flap.coverage_within_24,
            "18 mm overhang must fail 12 and pass 24 coverage");
    require(full->flap.left.sampled_tongue_any_12 &&
            !full->flap.left.sampled_tongue_all_12 &&
            !full->flap.left.narrow_limb_exception_12,
            "smooth circle must expose partial tongue evidence, not a narrow limb");
}

void test_u_corridor_retains_nonfull_four_node_option() {
    PolygonInput u_corridor{{
        {-60, -60}, {60, -60}, {60, 60}, {12, 60},
        {12, 0}, {-12, 0}, {-12, 60}, {-60, 60},
    }};
    magfit::BandSpec band = magfit::default_band_spec(2);
    band.legal_sizes_mm = {96};
    const BandReview review = only_band(magfit::solve(u_corridor, {band}));
    const auto found = std::find_if(review.options.begin(), review.options.end(),
                                    [](const auto& option) {
        return option.magnets.size() == 4 && option.verified_links.size() == 3;
    });
    require(found != review.options.end() && found->layout_kind == LayoutKind::Connected,
            "four supported discs with one missing capsule must remain visible as connected");
}

void test_exact_threshold_narrow_limb_is_reported() {
    PolygonInput antenna{{
        {-48, -48}, {48, -48}, {48, 36}, {5, 36},
        {5, 48}, {-5, 48}, {-5, 36}, {-48, 36},
    }};
    magfit::BandSpec band = magfit::default_band_spec(2);
    band.legal_sizes_mm = {96};
    const BandReview review = only_band(magfit::solve(antenna, {band}));
    const LayoutOption* full = find_option(
        review, 96, {{-1, -1}, {-1, 1}, {1, -1}, {1, 1}});
    require(full != nullptr, "threshold antenna full layout must remain reviewable");
    require(full->flap.top.extent_reaches_12 &&
            !full->flap.top.sampled_tongue_any_12 &&
            full->flap.top.narrow_limb_exception_12,
            "exact 12 mm overhang without a sampled full-width tongue is a limb exception");
}

void test_band4_is_exercised() {
    magfit::BandSpec band = magfit::default_band_spec(4);
    band.legal_sizes_mm = {168};
    const BandReview review = only_band(magfit::solve(square(-84, 84), {band}));
    require(std::any_of(review.options.begin(), review.options.end(), [](const auto& option) {
        return option.manufactured_size_mm == 168 && option.magnets.size() == 16 &&
               option.layout_kind == LayoutKind::Full;
    }), "band 4 fixture must expose its complete 4x4 layout");
}

void test_deterministic_retrace_invariance_corpus() {
    std::mt19937 rng(0x4D414746U);
    std::uniform_int_distribution<int> jitter(-2500, 2500);
    const std::vector<magfit::BandSpec> bands{
        magfit::default_band_spec(2), magfit::default_band_spec(3),
    };
    for (int case_index = 0; case_index < 30; ++case_index) {
        std::vector<PointI> vertices;
        for (int i = 0; i < 48; ++i) {
            const long double angle = 2.0L * std::acos(-1.0L) * i / 48;
            const long double radius = 20000.0L + jitter(rng);
            vertices.push_back({
                static_cast<std::int64_t>(std::llround(radius * std::cos(angle))),
                static_cast<std::int64_t>(std::llround(radius * std::sin(angle))),
            });
        }
        std::vector<PointI> transformed = vertices;
        std::reverse(transformed.begin(), transformed.end());
        std::rotate(transformed.begin(), transformed.begin() + (case_index % 48),
                    transformed.end());
        for (PointI& p : transformed) {
            p.x += 1'000'000;
            p.y -= 2'000'000;
        }
        const auto a = magfit::solve(PolygonInput{vertices}, bands);
        const auto b = magfit::solve(PolygonInput{transformed}, bands);
        require(a.bands.size() == b.bands.size(), "corpus band count mismatch");
        for (std::size_t i = 0; i < a.bands.size(); ++i) {
            require(a.bands[i].options.size() == b.bands[i].options.size(),
                    "retrace changed option count");
            for (std::size_t j = 0; j < a.bands[i].options.size(); ++j) {
                const auto& x = a.bands[i].options[j];
                const auto& y = b.bands[i].options[j];
                require(x.manufactured_size_mm == y.manufactured_size_mm &&
                        x.magnets == y.magnets && x.verified_links == y.verified_links &&
                        x.source_windows == y.source_windows,
                        "retrace changed canonical option order or identity");
                require(x.binding.slack_um_floor >= 0,
                        "lawful option must have non-negative exact slack");
            }
        }
    }
}

void test_invalid_inputs_remain_rejected() {
    bool threw = false;
    try {
        (void)magfit::solve(PolygonInput{{{0, 0}, {10, 10}, {0, 10}, {10, 0}}},
                            {magfit::default_band_spec(2)});
    } catch (const std::invalid_argument&) {
        threw = true;
    }
    require(threw, "self-intersection must be rejected");

    magfit::BandSpec bad = magfit::default_band_spec(2);
    bad.legal_sizes_mm = {74};
    threw = false;
    try {
        (void)magfit::solve(square(-36, 36), {bad});
    } catch (const std::invalid_argument&) {
        threw = true;
    }
    require(threw, "off-ladder size must be rejected");
}

}  // namespace

int main() {
    try {
        test_square_exposes_all_band2_sizes_and_layouts();
        test_connected_subsets_are_not_collapsed_to_maximal_component();
        test_overlapping_parent_windows_deduplicate_physical_options();
        test_band2_sparse_is_disengaged_and_band3_lists_phases();
        test_sparse_all_requires_every_phase();
        test_flap_evidence_is_per_option();
        test_u_corridor_retains_nonfull_four_node_option();
        test_exact_threshold_narrow_limb_is_reported();
        test_band4_is_exercised();
        test_deterministic_retrace_invariance_corpus();
        test_invalid_inputs_remain_rejected();
        std::cout << "all magfit review tests passed\n";
        return EXIT_SUCCESS;
    } catch (const std::exception& error) {
        std::cerr << "test failure: " << error.what() << '\n';
        return EXIT_FAILURE;
    }
}
