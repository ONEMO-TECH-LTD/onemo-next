#pragma once

#include <boost/multiprecision/cpp_int.hpp>

#include <cstddef>
#include <cstdint>
#include <map>
#include <optional>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace onemo::magnetic {

using BigInt = boost::multiprecision::cpp_int;

class Rational {
 public:
  Rational();
  Rational(std::int64_t value);
  Rational(BigInt numerator, BigInt denominator);

  static Rational from_decimal(std::string_view text);

  const BigInt& numerator() const noexcept { return numerator_; }
  const BigInt& denominator() const noexcept { return denominator_; }
  int sign() const noexcept;
  bool is_zero() const noexcept;
  std::string to_fraction_string() const;
  long double to_long_double() const;

  friend Rational operator+(const Rational& lhs, const Rational& rhs);
  friend Rational operator-(const Rational& lhs, const Rational& rhs);
  friend Rational operator*(const Rational& lhs, const Rational& rhs);
  friend Rational operator/(const Rational& lhs, const Rational& rhs);
  friend Rational operator-(const Rational& value);

  friend bool operator==(const Rational& lhs, const Rational& rhs) noexcept;
  friend bool operator!=(const Rational& lhs, const Rational& rhs) noexcept;
  friend bool operator<(const Rational& lhs, const Rational& rhs);
  friend bool operator<=(const Rational& lhs, const Rational& rhs);
  friend bool operator>(const Rational& lhs, const Rational& rhs);
  friend bool operator>=(const Rational& lhs, const Rational& rhs);

 private:
  BigInt numerator_;
  BigInt denominator_;
  void normalize();
};

struct Point {
  Rational x;
  Rational y;

  friend bool operator==(const Point& lhs, const Point& rhs) noexcept {
    return lhs.x == rhs.x && lhs.y == rhs.y;
  }
  friend bool operator!=(const Point& lhs, const Point& rhs) noexcept {
    return !(lhs == rhs);
  }
};

struct IntPoint {
  int x = 0;
  int y = 0;

  friend bool operator==(const IntPoint& lhs, const IntPoint& rhs) noexcept {
    return lhs.x == rhs.x && lhs.y == rhs.y;
  }
  friend bool operator!=(const IntPoint& lhs, const IntPoint& rhs) noexcept {
    return !(lhs == rhs);
  }
  friend bool operator<(const IntPoint& lhs, const IntPoint& rhs) noexcept {
    return lhs.x < rhs.x || (lhs.x == rhs.x && lhs.y < rhs.y);
  }
};

struct BoundingBox {
  Rational min_x;
  Rational min_y;
  Rational max_x;
  Rational max_y;
};

enum class PointLocation { kOutside, kBoundary, kInside };

struct BoundaryWitness {
  std::size_t edge_index = 0;
  Point boundary_point;
};

struct SiteFact {
  Point center;
  PointLocation center_location = PointLocation::kOutside;
  Rational boundary_clearance_squared_mm2;
  BoundaryWitness limiting_witness;
  bool complete_disc_contained = false;
};

struct CorridorWitness {
  std::size_t boundary_edge_index = 0;
  Point centerline_point;
  Point boundary_point;
};

struct CorridorFact {
  Point from;
  Point to;
  bool centerline_contained = false;
  Rational centerline_boundary_clearance_squared_mm2;
  CorridorWitness limiting_witness;
  bool complete_corridor_contained = false;
};

class PreparedOutline {
 public:
  static PreparedOutline prepare(std::vector<Point> vertices);

  const std::vector<Point>& vertices() const noexcept { return vertices_; }
  const BoundingBox& bounding_box() const noexcept { return bounding_box_; }
  const Point& bounding_box_center() const noexcept { return bounding_box_center_; }
  const Rational& max_bbox_extent() const noexcept { return max_bbox_extent_; }

 private:
  std::vector<Point> vertices_;
  BoundingBox bounding_box_;
  Point bounding_box_center_;
  Rational max_bbox_extent_;
};

class SizedOutline {
 public:
  SizedOutline(const PreparedOutline& canonical, Rational target_max_extent_mm);

  const std::vector<Point>& vertices() const noexcept { return vertices_; }
  const Rational& target_max_extent_mm() const noexcept { return target_max_extent_mm_; }
  const Rational& canonical_to_physical_scale() const noexcept { return canonical_to_physical_scale_; }
  const Rational& physical_to_canonical_scale() const noexcept { return physical_to_canonical_scale_; }

  PointLocation locate(const Point& point) const;
  SiteFact evaluate_site(const Point& center, const Rational& radius_mm) const;
  CorridorFact evaluate_corridor(const Point& from, const Point& to, const Rational& radius_mm) const;

 private:
  std::vector<Point> vertices_;
  Rational target_max_extent_mm_;
  Rational canonical_to_physical_scale_;
  Rational physical_to_canonical_scale_;
};

struct PhysicalSizeSpec {
  std::string id;
  std::string band;
  Rational max_extent_mm;
};

struct FieldSpec {
  int min_x = -4;
  int max_x = 4;
  int min_y = -4;
  int max_y = 4;
};

struct RegistrationSpec {
  std::string id;
  Point origin_mm;
};

struct PopulationSpec {
  std::string id;
  int stride = 1;
  int phase_x = 0;
  int phase_y = 0;
};

enum class ArrangementClass {
  kSingleSite,
  kHorizontalPair,
  kVerticalPair,
  kDiagonalPair,
  kCompleteRectangularWindow,
  kRowSkipping,
  kColumnSkipping,
  kCornerTriangle,
  kCornerRectangle,
};

enum class CorridorMode { kReport, kRequire };

struct PatternEdge {
  std::size_t from_site = 0;
  std::size_t to_site = 0;
  CorridorMode corridor_mode = CorridorMode::kReport;
};

struct ArrangementPattern {
  std::string id;
  ArrangementClass arrangement_class = ArrangementClass::kSingleSite;
  std::vector<IntPoint> sites;
  std::vector<PatternEdge> edges;
};

struct SolveRequest {
  std::string schema;
  std::vector<Point> canonical_outline;
  std::string scale_basis;
  Rational magnet_radius_mm;
  Rational base_pitch_mm;
  FieldSpec field;
  std::vector<PhysicalSizeSpec> sizes;
  std::vector<RegistrationSpec> registrations;
  std::vector<PopulationSpec> populations;
  std::vector<ArrangementPattern> patterns;
};

struct LatticeSite {
  IntPoint base_index;
  Point coordinate_mm;
};

struct LatticeResult {
  std::string registration_id;
  Point origin_mm;
  std::vector<LatticeSite> base_sites;
};

struct CandidateSite {
  std::size_t pattern_site_index = 0;
  IntPoint pattern_index;
  IntPoint base_index;
  Point coordinate_mm;
  SiteFact fact;
};

struct CandidateEdge {
  std::size_t pattern_edge_index = 0;
  std::size_t from_site = 0;
  std::size_t to_site = 0;
  CorridorMode corridor_mode = CorridorMode::kReport;
  CorridorFact fact;
};

struct Candidate {
  std::string id;
  std::string size_id;
  std::string band;
  Rational physical_size_mm;
  std::string population_id;
  int population_stride = 1;
  int population_phase_x = 0;
  int population_phase_y = 0;
  std::string registration_id;
  ArrangementClass arrangement_class = ArrangementClass::kSingleSite;
  std::string pattern_id;
  IntPoint placement_population_index;
  std::vector<CandidateSite> sites;
  std::vector<CandidateEdge> edges;
};

struct SizeResult {
  std::string id;
  std::string band;
  Rational max_extent_mm;
  Rational canonical_to_physical_scale;
  Rational physical_to_canonical_scale;
  std::size_t candidate_count = 0;
};

struct SolveMetrics {
  std::size_t prepared_vertex_count = 0;
  std::size_t site_facts_computed = 0;
  std::size_t corridor_facts_computed = 0;
  std::size_t placements_tested = 0;
  std::size_t candidates_emitted = 0;
};

struct SolveResult {
  PreparedOutline prepared_outline;
  Rational magnet_radius_mm;
  Rational base_pitch_mm;
  FieldSpec field;
  std::vector<PopulationSpec> populations;
  std::vector<LatticeResult> lattices;
  std::vector<SizeResult> sizes;
  std::vector<Candidate> candidates;
  SolveMetrics metrics;
};

SolveRequest parse_request_json(std::string_view json);
SolveResult solve(const SolveRequest& request);
std::string serialize_result_json(const SolveResult& result);
std::string serialize_error_json(std::string_view code, std::string_view message);
std::string solve_json(std::string_view request_json) noexcept;

std::string arrangement_class_name(ArrangementClass value);
std::string corridor_mode_name(CorridorMode value);
std::string point_location_name(PointLocation value);

}  // namespace onemo::magnetic
