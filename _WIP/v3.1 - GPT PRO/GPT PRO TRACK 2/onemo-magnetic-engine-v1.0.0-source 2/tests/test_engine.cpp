#include "onemo/engine.hpp"

#include <algorithm>
#include <cstdlib>
#include <functional>
#include <iostream>
#include <map>
#include <set>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

using namespace onemo::magnetic;

namespace {

int failures = 0;

#define CHECK(condition)                                                                     \
  do {                                                                                       \
    if (!(condition)) {                                                                      \
      std::cerr << __FILE__ << ':' << __LINE__ << ": CHECK failed: " #condition "\n";       \
      ++failures;                                                                            \
    }                                                                                        \
  } while (false)

Point point(std::int64_t x, std::int64_t y) {
  return {Rational(x), Rational(y)};
}

PreparedOutline prepare(std::initializer_list<Point> vertices) {
  return PreparedOutline::prepare(std::vector<Point>(vertices));
}

ArrangementPattern pattern(
    std::string id,
    ArrangementClass arrangement_class,
    std::vector<IntPoint> sites,
    std::vector<PatternEdge> edges = {}) {
  return {std::move(id), arrangement_class, std::move(sites), std::move(edges)};
}

SolveRequest base_request(std::vector<Point> outline) {
  SolveRequest request;
  request.schema = "onemo.magnetic.solve.request/1";
  request.canonical_outline = std::move(outline);
  request.scale_basis = "max_bbox_extent";
  request.magnet_radius_mm = Rational(12);
  request.base_pitch_mm = Rational(48);
  request.field = {-4, 4, -4, 4};
  request.sizes = {{"size-1000", "test-band", Rational(1000)}};
  request.registrations = {{"reg-0", point(0, 0)}};
  request.populations = {{"p48", 1, 0, 0}};
  return request;
}

std::vector<Point> large_square() {
  return {point(-500, -500), point(500, -500), point(500, 500), point(-500, 500)};
}

void test_closed_tangency_passes() {
  const PreparedOutline outline = prepare({
      point(-12, -12), point(12, -12), point(12, 12), point(-12, 12)});
  const SizedOutline sized(outline, Rational(24));
  const SiteFact fact = sized.evaluate_site(point(0, 0), Rational(12));
  CHECK(fact.center_location == PointLocation::kInside);
  CHECK(fact.boundary_clearance_squared_mm2 == Rational(144));
  CHECK(fact.complete_disc_contained);
}

void test_concavity_rejects_disc_that_crosses_reflex_boundary() {
  const PreparedOutline outline = prepare({
      point(-30, -30), point(30, -30), point(30, 0),
      point(0, 0), point(0, 30), point(-30, 30)});
  const SizedOutline sized(outline, Rational(60));
  const SiteFact fact = sized.evaluate_site(point(-5, -5), Rational(12));
  CHECK(fact.center_location == PointLocation::kInside);
  CHECK(fact.boundary_clearance_squared_mm2 == Rational(50));
  CHECK(!fact.complete_disc_contained);
}

void test_endpoint_discs_do_not_prove_direct_corridor() {
  const PreparedOutline outline = prepare({
      point(-100, -100), point(100, -100), point(100, 100),
      point(20, 100), point(20, -20), point(-20, -20),
      point(-20, 100), point(-100, 100)});
  const SizedOutline sized(outline, Rational(200));
  const SiteFact left = sized.evaluate_site(point(-50, 0), Rational(12));
  const SiteFact right = sized.evaluate_site(point(50, 0), Rational(12));
  const CorridorFact corridor = sized.evaluate_corridor(point(-50, 0), point(50, 0), Rational(12));
  CHECK(left.complete_disc_contained);
  CHECK(right.complete_disc_contained);
  CHECK(!corridor.centerline_contained);
  CHECK(!corridor.complete_corridor_contained);
}

void test_non_monotonic_sizes_are_evaluated_independently() {
  std::vector<Point> outline = {
      point(-500, -500), point(500, -500), point(500, 500),
      point(200, 500), point(200, -100), point(60, -100),
      point(60, 500), point(-500, 500)};
  const PreparedOutline prepared_outline = PreparedOutline::prepare(outline);
  const Point fixed_site = point(35, 0);
  CHECK(SizedOutline(prepared_outline, Rational(100)).evaluate_site(fixed_site, Rational(12)).complete_disc_contained);
  CHECK(!SizedOutline(prepared_outline, Rational(300)).evaluate_site(fixed_site, Rational(12)).complete_disc_contained);
  CHECK(SizedOutline(prepared_outline, Rational(900)).evaluate_site(fixed_site, Rational(12)).complete_disc_contained);

  SolveRequest request = base_request(std::move(outline));
  request.sizes = {
      {"size-100", "test-band", Rational(100)},
      {"size-300", "test-band", Rational(300)},
      {"size-900", "test-band", Rational(900)},
  };
  request.registrations = {{"reg-35", point(35, 0)}};
  request.patterns = {pattern("single", ArrangementClass::kSingleSite, {{0, 0}})};
  const SolveResult result = solve(request);

  std::set<std::string> ids;
  for (const Candidate& candidate : result.candidates) ids.insert(candidate.id);
  CHECK(ids.contains("size-100/reg-35/p48/single_site/single/x0.y0"));
  CHECK(!ids.contains("size-300/reg-35/p48/single_site/single/x0.y0"));
  CHECK(ids.contains("size-900/reg-35/p48/single_site/single/x0.y0"));
}

void test_96_population_is_a_subset_of_same_48_lattice_registration() {
  SolveRequest request = base_request(large_square());
  request.registrations = {{"reg-offset", point(24, -24)}};
  request.populations = {
      {"p48", 1, 0, 0},
      {"p96-x1-y0", 2, 1, 0},
  };
  request.patterns = {pattern("single", ArrangementClass::kSingleSite, {{0, 0}})};
  const SolveResult result = solve(request);
  CHECK(result.lattices.size() == 1);
  CHECK(result.lattices.front().base_sites.size() == 81);

  std::size_t dense_count = 0;
  std::size_t sparse_count = 0;
  for (const Candidate& candidate : result.candidates) {
    CHECK(candidate.registration_id == "reg-offset");
    CHECK(candidate.sites.size() == 1);
    const CandidateSite& site = candidate.sites.front();
    const Point expected = {
        Rational(24) + Rational(site.base_index.x) * Rational(48),
        Rational(-24) + Rational(site.base_index.y) * Rational(48),
    };
    CHECK(site.coordinate_mm == expected);
    if (candidate.population_id == "p48") {
      ++dense_count;
    } else {
      ++sparse_count;
      CHECK(((site.base_index.x % 2) + 2) % 2 == 1);
      CHECK(((site.base_index.y % 2) + 2) % 2 == 0);
    }
  }
  CHECK(dense_count == 81);
  CHECK(sparse_count == 20);
}

void test_every_class_and_every_translation_are_enumerated() {
  SolveRequest request = base_request(large_square());
  request.patterns = {
      pattern("single", ArrangementClass::kSingleSite, {{0, 0}}),
      pattern("pair-h", ArrangementClass::kHorizontalPair, {{0, 0}, {1, 0}}, {{0, 1, CorridorMode::kReport}}),
      pattern("pair-v", ArrangementClass::kVerticalPair, {{0, 0}, {0, 1}}, {{0, 1, CorridorMode::kReport}}),
      pattern("pair-d", ArrangementClass::kDiagonalPair, {{0, 0}, {1, 1}}, {{0, 1, CorridorMode::kReport}}),
      pattern("rect-full", ArrangementClass::kCompleteRectangularWindow,
              {{0, 0}, {0, 1}, {1, 0}, {1, 1}}),
      pattern("skip-rows", ArrangementClass::kRowSkipping, {{0, 0}, {0, 2}}, {{0, 1, CorridorMode::kReport}}),
      pattern("skip-cols", ArrangementClass::kColumnSkipping, {{0, 0}, {2, 0}}, {{0, 1, CorridorMode::kReport}}),
      pattern("corner-triangle", ArrangementClass::kCornerTriangle,
              {{0, 0}, {0, 1}, {1, 0}}),
      pattern("corner-rectangle", ArrangementClass::kCornerRectangle,
              {{0, 0}, {0, 1}, {1, 0}, {1, 1}}),
  };
  const SolveResult result = solve(request);
  CHECK(result.metrics.placements_tested == 607);
  CHECK(result.metrics.candidates_emitted == 607);

  std::set<ArrangementClass> classes;
  for (const Candidate& candidate : result.candidates) classes.insert(candidate.arrangement_class);
  CHECK(classes.size() == 9);
  CHECK(classes.contains(ArrangementClass::kSingleSite));
  CHECK(classes.contains(ArrangementClass::kHorizontalPair));
  CHECK(classes.contains(ArrangementClass::kVerticalPair));
  CHECK(classes.contains(ArrangementClass::kDiagonalPair));
  CHECK(classes.contains(ArrangementClass::kCompleteRectangularWindow));
  CHECK(classes.contains(ArrangementClass::kRowSkipping));
  CHECK(classes.contains(ArrangementClass::kColumnSkipping));
  CHECK(classes.contains(ArrangementClass::kCornerTriangle));
  CHECK(classes.contains(ArrangementClass::kCornerRectangle));
}

void test_required_corridor_is_a_grammar_constraint_not_hidden_policy() {
  SolveRequest request = base_request({
      point(-100, -100), point(100, -100), point(100, 100),
      point(20, 100), point(20, -20), point(-20, -20),
      point(-20, 100), point(-100, 100)});
  request.sizes = {{"size-200", "test-band", Rational(200)}};
  request.registrations = {{"reg-0", point(0, 0)}};
  request.base_pitch_mm = Rational(48);
  request.patterns = {
      pattern("report-pair", ArrangementClass::kHorizontalPair,
              {{-1, 0}, {1, 0}}, {{0, 1, CorridorMode::kReport}}),
      pattern("require-pair", ArrangementClass::kHorizontalPair,
              {{-1, 0}, {1, 0}}, {{0, 1, CorridorMode::kRequire}}),
  };
  const SolveResult result = solve(request);
  bool saw_report_crossing = false;
  bool saw_required_crossing = false;
  for (const Candidate& candidate : result.candidates) {
    if (candidate.placement_population_index == IntPoint{0, 0}) {
      if (candidate.pattern_id == "report-pair") {
        saw_report_crossing = true;
        CHECK(!candidate.edges.front().fact.complete_corridor_contained);
      }
      if (candidate.pattern_id == "require-pair") saw_required_crossing = true;
    }
  }
  CHECK(saw_report_crossing);
  CHECK(!saw_required_crossing);
}


void test_semantically_reordered_inputs_have_same_canonical_bytes() {
  SolveRequest first = base_request(large_square());
  first.sizes = {
      {"size-160", "band-a", Rational(160)},
      {"size-200", "band-b", Rational(200)},
  };
  first.registrations = {
      {"reg-a", point(0, 0)},
      {"reg-b", point(24, 24)},
  };
  first.populations = {
      {"p48", 1, 0, 0},
      {"p96", 2, 1, 0},
  };
  first.patterns = {
      pattern("single", ArrangementClass::kSingleSite, {{0, 0}}),
      pattern("pair-h", ArrangementClass::kHorizontalPair,
              {{0, 0}, {1, 0}}, {{0, 1, CorridorMode::kReport}}),
  };

  SolveRequest second = first;
  second.canonical_outline = {
      point(500, 500), point(500, -500), point(-500, -500), point(-500, 500)};
  std::reverse(second.sizes.begin(), second.sizes.end());
  std::reverse(second.registrations.begin(), second.registrations.end());
  std::reverse(second.populations.begin(), second.populations.end());
  std::reverse(second.patterns.begin(), second.patterns.end());

  const std::string first_bytes = serialize_result_json(solve(first));
  const std::string second_bytes = serialize_result_json(solve(second));
  CHECK(first_bytes == second_bytes);
}

void test_canonical_output_is_byte_deterministic() {
  const std::string request = R"JSON({"schema":"onemo.magnetic.solve.request/1","outline":[["-100","-100"],["100","-100"],["100","100"],["-100","100"]],"scale_basis":"max_bbox_extent","magnet_radius_mm":"12","base_pitch_mm":"48","field":{"min_x":-4,"max_x":4,"min_y":-4,"max_y":4},"sizes":[{"id":"size-200","band":"band-test","max_extent_mm":"200"}],"registrations":[{"id":"r0","origin_mm":["0","0"]}],"populations":[{"id":"p48","stride":1,"phase":[0,0]}],"patterns":[{"id":"single","class":"single_site","sites":[[0,0]],"edges":[]}]})JSON";
  const std::string first = solve_json(request);
  const std::string second = solve_json(request);
  CHECK(first == second);
  CHECK(first.find("\"status\":\"ok\"") != std::string::npos);
  CHECK(first.find("\"candidates_emitted\":9") != std::string::npos);
}

void run(std::string_view name, const std::function<void()>& test) {
  const int before = failures;
  try {
    test();
  } catch (const std::exception& error) {
    std::cerr << name << ": unexpected exception: " << error.what() << '\n';
    ++failures;
  }
  if (failures == before) std::cout << "PASS " << name << '\n';
}

}  // namespace

int main() {
  run("closed tangency", test_closed_tangency_passes);
  run("concavity", test_concavity_rejects_disc_that_crosses_reflex_boundary);
  run("endpoint discs versus corridor", test_endpoint_discs_do_not_prove_direct_corridor);
  run("non-monotonic sizes", test_non_monotonic_sizes_are_evaluated_independently);
  run("shared 48/96 registration", test_96_population_is_a_subset_of_same_48_lattice_registration);
  run("all grammar classes and complete translations", test_every_class_and_every_translation_are_enumerated);
  run("explicit corridor grammar mode", test_required_corridor_is_a_grammar_constraint_not_hidden_policy);
  run("semantic canonical bytes", test_semantically_reordered_inputs_have_same_canonical_bytes);
  run("deterministic bytes", test_canonical_output_is_byte_deterministic);

  if (failures != 0) {
    std::cerr << failures << " test assertion(s) failed\n";
    return EXIT_FAILURE;
  }
  std::cout << "All C++ tests passed\n";
  return EXIT_SUCCESS;
}
