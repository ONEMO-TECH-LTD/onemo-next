#include "onemo/engine.hpp"

#include <algorithm>
#include <array>
#include <cctype>
#include <cmath>
#include <cstdlib>
#include <limits>
#include <map>
#include <set>
#include <sstream>
#include <stdexcept>
#include <string>
#include <tuple>
#include <utility>

namespace onemo::magnetic {
namespace {

BigInt abs_big(BigInt value) {
  return value < 0 ? -value : value;
}

BigInt gcd_big(BigInt lhs, BigInt rhs) {
  lhs = abs_big(std::move(lhs));
  rhs = abs_big(std::move(rhs));
  while (rhs != 0) {
    BigInt remainder = lhs % rhs;
    lhs = std::move(rhs);
    rhs = std::move(remainder);
  }
  return lhs;
}

Rational abs_rational(const Rational& value) {
  return value.sign() < 0 ? -value : value;
}

Point add(const Point& lhs, const Point& rhs) {
  return {lhs.x + rhs.x, lhs.y + rhs.y};
}

Point subtract(const Point& lhs, const Point& rhs) {
  return {lhs.x - rhs.x, lhs.y - rhs.y};
}

Point multiply(const Point& point, const Rational& scale) {
  return {point.x * scale, point.y * scale};
}

Rational dot(const Point& lhs, const Point& rhs) {
  return lhs.x * rhs.x + lhs.y * rhs.y;
}

Rational cross_vectors(const Point& lhs, const Point& rhs) {
  return lhs.x * rhs.y - lhs.y * rhs.x;
}

Rational orientation_value(const Point& a, const Point& b, const Point& c) {
  return cross_vectors(subtract(b, a), subtract(c, a));
}

Rational squared_distance(const Point& lhs, const Point& rhs) {
  const Point delta = subtract(lhs, rhs);
  return dot(delta, delta);
}

bool between_closed(const Rational& value, const Rational& low, const Rational& high) {
  return low <= value && value <= high;
}

bool point_on_segment(const Point& point, const Point& a, const Point& b) {
  if (!orientation_value(a, b, point).is_zero()) {
    return false;
  }
  return between_closed(point.x, std::min(a.x, b.x), std::max(a.x, b.x)) &&
         between_closed(point.y, std::min(a.y, b.y), std::max(a.y, b.y));
}

bool segments_intersect_closed(const Point& a, const Point& b, const Point& c, const Point& d) {
  const int o1 = orientation_value(a, b, c).sign();
  const int o2 = orientation_value(a, b, d).sign();
  const int o3 = orientation_value(c, d, a).sign();
  const int o4 = orientation_value(c, d, b).sign();

  if (o1 == 0 && point_on_segment(c, a, b)) return true;
  if (o2 == 0 && point_on_segment(d, a, b)) return true;
  if (o3 == 0 && point_on_segment(a, c, d)) return true;
  if (o4 == 0 && point_on_segment(b, c, d)) return true;
  return o1 * o2 < 0 && o3 * o4 < 0;
}

struct PointSegmentDistance {
  Rational squared;
  Point witness;
};

PointSegmentDistance point_segment_distance(const Point& point, const Point& a, const Point& b) {
  const Point edge = subtract(b, a);
  const Rational edge_length_squared = dot(edge, edge);
  if (edge_length_squared.is_zero()) {
    throw std::logic_error("zero-length edge reached distance kernel");
  }

  const Rational projection = dot(subtract(point, a), edge);
  if (projection <= Rational(0)) {
    return {squared_distance(point, a), a};
  }
  if (projection >= edge_length_squared) {
    return {squared_distance(point, b), b};
  }

  const Rational t = projection / edge_length_squared;
  const Point witness = add(a, multiply(edge, t));
  return {squared_distance(point, witness), witness};
}

struct SegmentIntersectionParameters {
  bool intersects = false;
  std::vector<Rational> first_segment_parameters;
};

SegmentIntersectionParameters segment_intersection_parameters(
    const Point& a,
    const Point& b,
    const Point& c,
    const Point& d) {
  const Point r = subtract(b, a);
  const Point s = subtract(d, c);
  const Point q_minus_p = subtract(c, a);
  const Rational r_cross_s = cross_vectors(r, s);
  const Rational q_cross_r = cross_vectors(q_minus_p, r);

  if (!r_cross_s.is_zero()) {
    const Rational t = cross_vectors(q_minus_p, s) / r_cross_s;
    const Rational u = cross_vectors(q_minus_p, r) / r_cross_s;
    if (between_closed(t, Rational(0), Rational(1)) &&
        between_closed(u, Rational(0), Rational(1))) {
      return {true, {t}};
    }
    return {};
  }

  if (!q_cross_r.is_zero()) {
    return {};
  }

  const bool use_x = abs_rational(r.x) >= abs_rational(r.y);
  const Rational axis_delta = use_x ? r.x : r.y;
  if (axis_delta.is_zero()) {
    throw std::logic_error("degenerate first segment reached intersection kernel");
  }

  const Rational t0 = ((use_x ? c.x : c.y) - (use_x ? a.x : a.y)) / axis_delta;
  const Rational t1 = ((use_x ? d.x : d.y) - (use_x ? a.x : a.y)) / axis_delta;
  const Rational low = std::max(Rational(0), std::min(t0, t1));
  const Rational high = std::min(Rational(1), std::max(t0, t1));
  if (low > high) {
    return {};
  }
  if (low == high) {
    return {true, {low}};
  }
  return {true, {low, high}};
}

struct SegmentSegmentDistance {
  Rational squared;
  Point first_witness;
  Point second_witness;
};

SegmentSegmentDistance segment_segment_distance(
    const Point& a,
    const Point& b,
    const Point& c,
    const Point& d) {
  const SegmentIntersectionParameters intersection =
      segment_intersection_parameters(a, b, c, d);
  if (intersection.intersects) {
    const Rational t = intersection.first_segment_parameters.front();
    const Point witness = add(a, multiply(subtract(b, a), t));
    return {Rational(0), witness, witness};
  }

  struct CandidateDistance {
    Rational squared;
    Point first;
    Point second;
    int tie_order = 0;
  };

  std::array<CandidateDistance, 4> candidates;
  {
    const auto value = point_segment_distance(a, c, d);
    candidates[0] = {value.squared, a, value.witness, 0};
  }
  {
    const auto value = point_segment_distance(b, c, d);
    candidates[1] = {value.squared, b, value.witness, 1};
  }
  {
    const auto value = point_segment_distance(c, a, b);
    candidates[2] = {value.squared, value.witness, c, 2};
  }
  {
    const auto value = point_segment_distance(d, a, b);
    candidates[3] = {value.squared, value.witness, d, 3};
  }

  const auto best = std::min_element(
      candidates.begin(), candidates.end(), [](const CandidateDistance& lhs, const CandidateDistance& rhs) {
        if (lhs.squared != rhs.squared) return lhs.squared < rhs.squared;
        return lhs.tie_order < rhs.tie_order;
      });
  return {best->squared, best->first, best->second};
}

BoundingBox compute_bounding_box(const std::vector<Point>& vertices) {
  if (vertices.empty()) {
    throw std::invalid_argument("outline has no vertices");
  }
  BoundingBox box{vertices.front().x, vertices.front().y, vertices.front().x, vertices.front().y};
  for (const Point& point : vertices) {
    box.min_x = std::min(box.min_x, point.x);
    box.min_y = std::min(box.min_y, point.y);
    box.max_x = std::max(box.max_x, point.x);
    box.max_y = std::max(box.max_y, point.y);
  }
  return box;
}

Rational signed_double_area(const std::vector<Point>& vertices) {
  Rational area(0);
  for (std::size_t i = 0; i < vertices.size(); ++i) {
    const Point& a = vertices[i];
    const Point& b = vertices[(i + 1) % vertices.size()];
    area = area + (a.x * b.y - a.y * b.x);
  }
  return area;
}

bool lexicographic_point_less(const Point& lhs, const Point& rhs) {
  if (lhs.x != rhs.x) return lhs.x < rhs.x;
  return lhs.y < rhs.y;
}

bool edges_are_adjacent(std::size_t lhs, std::size_t rhs, std::size_t edge_count) {
  return lhs == rhs || ((lhs + 1) % edge_count == rhs) || ((rhs + 1) % edge_count == lhs);
}

void validate_simple_polygon(const std::vector<Point>& vertices) {
  const std::size_t count = vertices.size();
  for (std::size_t i = 0; i < count; ++i) {
    const Point& prev = vertices[(i + count - 1) % count];
    const Point& current = vertices[i];
    const Point& next = vertices[(i + 1) % count];
    if (current == next) {
      throw std::invalid_argument("outline contains a zero-length edge");
    }
    const Point to_prev = subtract(prev, current);
    const Point to_next = subtract(next, current);
    if (cross_vectors(to_prev, to_next).is_zero() && dot(to_prev, to_next) > Rational(0)) {
      throw std::invalid_argument("outline contains an adjacent backtracking overlap");
    }
  }

  struct EdgeBox {
    std::size_t index = 0;
    Rational min_x;
    Rational max_x;
    Rational min_y;
    Rational max_y;
  };

  std::vector<EdgeBox> edges;
  edges.reserve(count);
  for (std::size_t i = 0; i < count; ++i) {
    const Point& a = vertices[i];
    const Point& b = vertices[(i + 1) % count];
    edges.push_back({i, std::min(a.x, b.x), std::max(a.x, b.x),
                     std::min(a.y, b.y), std::max(a.y, b.y)});
  }
  std::sort(edges.begin(), edges.end(), [](const EdgeBox& lhs, const EdgeBox& rhs) {
    if (lhs.min_x != rhs.min_x) return lhs.min_x < rhs.min_x;
    if (lhs.min_y != rhs.min_y) return lhs.min_y < rhs.min_y;
    return lhs.index < rhs.index;
  });

  std::vector<EdgeBox> active;
  for (const EdgeBox& edge : edges) {
    active.erase(
        std::remove_if(active.begin(), active.end(), [&](const EdgeBox& value) {
          return value.max_x < edge.min_x;
        }),
        active.end());

    for (const EdgeBox& other : active) {
      if (edges_are_adjacent(edge.index, other.index, count)) continue;
      if (other.max_y < edge.min_y || edge.max_y < other.min_y) continue;
      const Point& a = vertices[edge.index];
      const Point& b = vertices[(edge.index + 1) % count];
      const Point& c = vertices[other.index];
      const Point& d = vertices[(other.index + 1) % count];
      if (segments_intersect_closed(a, b, c, d)) {
        throw std::invalid_argument("outline is self-intersecting or self-touching");
      }
    }
    active.push_back(edge);
  }
}

PointLocation locate_point(const std::vector<Point>& vertices, const Point& point) {
  int winding_number = 0;
  for (std::size_t i = 0; i < vertices.size(); ++i) {
    const Point& a = vertices[i];
    const Point& b = vertices[(i + 1) % vertices.size()];
    if (point_on_segment(point, a, b)) {
      return PointLocation::kBoundary;
    }

    if (a.y <= point.y) {
      if (b.y > point.y && orientation_value(a, b, point) > Rational(0)) {
        ++winding_number;
      }
    } else if (b.y <= point.y && orientation_value(a, b, point) < Rational(0)) {
      --winding_number;
    }
  }
  return winding_number == 0 ? PointLocation::kOutside : PointLocation::kInside;
}

struct BoundaryDistanceResult {
  Rational squared;
  BoundaryWitness witness;
};

BoundaryDistanceResult point_boundary_distance(
    const std::vector<Point>& vertices,
    const Point& point) {
  std::optional<BoundaryDistanceResult> best;
  for (std::size_t i = 0; i < vertices.size(); ++i) {
    const Point& a = vertices[i];
    const Point& b = vertices[(i + 1) % vertices.size()];
    const PointSegmentDistance current = point_segment_distance(point, a, b);
    if (!best || current.squared < best->squared ||
        (current.squared == best->squared && i < best->witness.edge_index)) {
      best = BoundaryDistanceResult{current.squared, {i, current.witness}};
    }
  }
  return *best;
}

bool segment_contained_in_polygon(
    const std::vector<Point>& vertices,
    const Point& from,
    const Point& to) {
  if (from == to) {
    return locate_point(vertices, from) != PointLocation::kOutside;
  }

  std::vector<Rational> parameters{Rational(0), Rational(1)};
  for (std::size_t i = 0; i < vertices.size(); ++i) {
    const Point& a = vertices[i];
    const Point& b = vertices[(i + 1) % vertices.size()];
    const auto intersection = segment_intersection_parameters(from, to, a, b);
    for (const Rational& value : intersection.first_segment_parameters) {
      parameters.push_back(value);
    }
  }
  std::sort(parameters.begin(), parameters.end());
  parameters.erase(std::unique(parameters.begin(), parameters.end()), parameters.end());

  const Point direction = subtract(to, from);
  for (const Rational& parameter : parameters) {
    const Point point = add(from, multiply(direction, parameter));
    if (locate_point(vertices, point) == PointLocation::kOutside) {
      return false;
    }
  }
  for (std::size_t i = 1; i < parameters.size(); ++i) {
    if (parameters[i - 1] == parameters[i]) continue;
    const Rational midpoint = (parameters[i - 1] + parameters[i]) / Rational(2);
    const Point point = add(from, multiply(direction, midpoint));
    if (locate_point(vertices, point) == PointLocation::kOutside) {
      return false;
    }
  }
  return true;
}

struct SegmentBoundaryDistanceResult {
  Rational squared;
  CorridorWitness witness;
};

SegmentBoundaryDistanceResult segment_boundary_distance(
    const std::vector<Point>& vertices,
    const Point& from,
    const Point& to) {
  std::optional<SegmentBoundaryDistanceResult> best;
  for (std::size_t i = 0; i < vertices.size(); ++i) {
    const Point& a = vertices[i];
    const Point& b = vertices[(i + 1) % vertices.size()];
    const SegmentSegmentDistance current = segment_segment_distance(from, to, a, b);
    if (!best || current.squared < best->squared ||
        (current.squared == best->squared && i < best->witness.boundary_edge_index)) {
      best = SegmentBoundaryDistanceResult{
          current.squared, {i, current.first_witness, current.second_witness}};
    }
  }
  return *best;
}

std::int64_t floor_div(std::int64_t numerator, std::int64_t denominator) {
  if (denominator <= 0) throw std::logic_error("floor_div requires positive denominator");
  std::int64_t quotient = numerator / denominator;
  const std::int64_t remainder = numerator % denominator;
  if (remainder != 0 && numerator < 0) --quotient;
  return quotient;
}

std::int64_t ceil_div(std::int64_t numerator, std::int64_t denominator) {
  if (denominator <= 0) throw std::logic_error("ceil_div requires positive denominator");
  return -floor_div(-numerator, denominator);
}

int checked_int(std::int64_t value, std::string_view context) {
  if (value < std::numeric_limits<int>::min() || value > std::numeric_limits<int>::max()) {
    throw std::invalid_argument(std::string(context) + " is outside the supported integer range");
  }
  return static_cast<int>(value);
}

bool valid_token(std::string_view value) {
  if (value.empty()) return false;
  for (const char raw_ch : value) {
    const unsigned char ch = static_cast<unsigned char>(raw_ch);
    const bool ascii_alphanumeric =
        (ch >= static_cast<unsigned char>('0') && ch <= static_cast<unsigned char>('9')) ||
        (ch >= static_cast<unsigned char>('A') && ch <= static_cast<unsigned char>('Z')) ||
        (ch >= static_cast<unsigned char>('a') && ch <= static_cast<unsigned char>('z'));
    if (!(ascii_alphanumeric || ch == '.' || ch == '_' || ch == '-')) return false;
  }
  return true;
}

ArrangementClass parse_arrangement_class(std::string_view value) {
  if (value == "single_site") return ArrangementClass::kSingleSite;
  if (value == "horizontal_pair") return ArrangementClass::kHorizontalPair;
  if (value == "vertical_pair") return ArrangementClass::kVerticalPair;
  if (value == "diagonal_pair") return ArrangementClass::kDiagonalPair;
  if (value == "complete_rectangular_window") return ArrangementClass::kCompleteRectangularWindow;
  if (value == "row_skipping") return ArrangementClass::kRowSkipping;
  if (value == "column_skipping") return ArrangementClass::kColumnSkipping;
  if (value == "corner_triangle") return ArrangementClass::kCornerTriangle;
  if (value == "corner_rectangle") return ArrangementClass::kCornerRectangle;
  throw std::invalid_argument("unknown arrangement class: " + std::string(value));
}

CorridorMode parse_corridor_mode(std::string_view value) {
  if (value == "report") return CorridorMode::kReport;
  if (value == "require") return CorridorMode::kRequire;
  throw std::invalid_argument("unknown corridor mode: " + std::string(value));
}

int arrangement_class_order(ArrangementClass value) {
  return static_cast<int>(value);
}

// Minimal JSON reader. Physical quantities are strings by contract, so JSON
// number tokens are only used for bounded integer indices and counts.
class JsonValue {
 public:
  enum class Type { kNull, kBool, kNumber, kString, kArray, kObject };
  using Array = std::vector<JsonValue>;
  using Object = std::map<std::string, JsonValue>;

  JsonValue() = default;
  explicit JsonValue(bool value) : type_(Type::kBool), bool_value_(value) {}
  JsonValue(Type type, std::string text) : type_(type), text_(std::move(text)) {}
  explicit JsonValue(Array value) : type_(Type::kArray), array_(std::move(value)) {}
  explicit JsonValue(Object value) : type_(Type::kObject), object_(std::move(value)) {}

  Type type() const noexcept { return type_; }
  bool bool_value() const { require(Type::kBool); return bool_value_; }
  const std::string& text() const {
    if (type_ != Type::kNumber && type_ != Type::kString) throw std::invalid_argument("JSON type mismatch");
    return text_;
  }
  const Array& array() const { require(Type::kArray); return array_; }
  const Object& object() const { require(Type::kObject); return object_; }

 private:
  Type type_ = Type::kNull;
  bool bool_value_ = false;
  std::string text_;
  Array array_;
  Object object_;

  void require(Type expected) const {
    if (type_ != expected) throw std::invalid_argument("JSON type mismatch");
  }
};

class JsonParser {
 public:
  explicit JsonParser(std::string_view input) : input_(input) {}

  JsonValue parse() {
    skip_space();
    JsonValue value = parse_value();
    skip_space();
    if (position_ != input_.size()) throw error("trailing data");
    return value;
  }

 private:
  std::string_view input_;
  std::size_t position_ = 0;

  std::invalid_argument error(std::string_view message) const {
    return std::invalid_argument("invalid JSON at byte " + std::to_string(position_) + ": " + std::string(message));
  }

  void skip_space() {
    while (position_ < input_.size() &&
           (input_[position_] == ' ' || input_[position_] == '\n' ||
            input_[position_] == '\r' || input_[position_] == '\t')) {
      ++position_;
    }
  }

  char peek() const {
    if (position_ >= input_.size()) throw error("unexpected end of input");
    return input_[position_];
  }

  bool consume(char expected) {
    if (position_ < input_.size() && input_[position_] == expected) {
      ++position_;
      return true;
    }
    return false;
  }

  void expect(char expected) {
    if (!consume(expected)) throw error(std::string("expected '") + expected + "'");
  }

  JsonValue parse_value() {
    skip_space();
    const char ch = peek();
    if (ch == 'n') return parse_literal("null", JsonValue());
    if (ch == 't') return parse_literal("true", JsonValue(true));
    if (ch == 'f') return parse_literal("false", JsonValue(false));
    if (ch == '"') return JsonValue(JsonValue::Type::kString, parse_string());
    if (ch == '[') return parse_array();
    if (ch == '{') return parse_object();
    if (ch == '-' || std::isdigit(static_cast<unsigned char>(ch))) return parse_number();
    throw error("unexpected token");
  }

  JsonValue parse_literal(std::string_view literal, JsonValue value) {
    if (input_.substr(position_, literal.size()) != literal) throw error("invalid literal");
    position_ += literal.size();
    return value;
  }

  static void append_utf8(std::string& output, unsigned codepoint) {
    if (codepoint <= 0x7F) {
      output.push_back(static_cast<char>(codepoint));
    } else if (codepoint <= 0x7FF) {
      output.push_back(static_cast<char>(0xC0 | (codepoint >> 6)));
      output.push_back(static_cast<char>(0x80 | (codepoint & 0x3F)));
    } else {
      output.push_back(static_cast<char>(0xE0 | (codepoint >> 12)));
      output.push_back(static_cast<char>(0x80 | ((codepoint >> 6) & 0x3F)));
      output.push_back(static_cast<char>(0x80 | (codepoint & 0x3F)));
    }
  }

  static int hex_value(char ch) {
    if (ch >= '0' && ch <= '9') return ch - '0';
    if (ch >= 'a' && ch <= 'f') return 10 + ch - 'a';
    if (ch >= 'A' && ch <= 'F') return 10 + ch - 'A';
    return -1;
  }

  std::string parse_string() {
    expect('"');
    std::string output;
    while (position_ < input_.size()) {
      const char ch = input_[position_++];
      if (ch == '"') return output;
      if (static_cast<unsigned char>(ch) < 0x20) throw error("control character in string");
      if (ch != '\\') {
        output.push_back(ch);
        continue;
      }
      if (position_ >= input_.size()) throw error("unterminated escape");
      const char escaped = input_[position_++];
      switch (escaped) {
        case '"': output.push_back('"'); break;
        case '\\': output.push_back('\\'); break;
        case '/': output.push_back('/'); break;
        case 'b': output.push_back('\b'); break;
        case 'f': output.push_back('\f'); break;
        case 'n': output.push_back('\n'); break;
        case 'r': output.push_back('\r'); break;
        case 't': output.push_back('\t'); break;
        case 'u': {
          if (position_ + 4 > input_.size()) throw error("short unicode escape");
          unsigned codepoint = 0;
          for (int i = 0; i < 4; ++i) {
            const int value = hex_value(input_[position_++]);
            if (value < 0) throw error("invalid unicode escape");
            codepoint = (codepoint << 4) | static_cast<unsigned>(value);
          }
          if (codepoint >= 0xD800 && codepoint <= 0xDFFF) {
            throw error("surrogate unicode escapes are not accepted by the narrow protocol");
          }
          append_utf8(output, codepoint);
          break;
        }
        default: throw error("invalid escape");
      }
    }
    throw error("unterminated string");
  }

  JsonValue parse_number() {
    const std::size_t start = position_;
    consume('-');
    if (consume('0')) {
      if (position_ < input_.size() && std::isdigit(static_cast<unsigned char>(input_[position_]))) {
        throw error("leading zero in number");
      }
    } else {
      if (position_ >= input_.size() || !std::isdigit(static_cast<unsigned char>(input_[position_]))) {
        throw error("invalid number");
      }
      while (position_ < input_.size() && std::isdigit(static_cast<unsigned char>(input_[position_]))) ++position_;
    }
    if (consume('.')) {
      if (position_ >= input_.size() || !std::isdigit(static_cast<unsigned char>(input_[position_]))) {
        throw error("invalid number fraction");
      }
      while (position_ < input_.size() && std::isdigit(static_cast<unsigned char>(input_[position_]))) ++position_;
    }
    if (position_ < input_.size() && (input_[position_] == 'e' || input_[position_] == 'E')) {
      ++position_;
      if (position_ < input_.size() && (input_[position_] == '+' || input_[position_] == '-')) ++position_;
      if (position_ >= input_.size() || !std::isdigit(static_cast<unsigned char>(input_[position_]))) {
        throw error("invalid number exponent");
      }
      while (position_ < input_.size() && std::isdigit(static_cast<unsigned char>(input_[position_]))) ++position_;
    }
    return JsonValue(JsonValue::Type::kNumber, std::string(input_.substr(start, position_ - start)));
  }

  JsonValue parse_array() {
    expect('[');
    skip_space();
    JsonValue::Array values;
    if (consume(']')) return JsonValue(std::move(values));
    while (true) {
      values.push_back(parse_value());
      skip_space();
      if (consume(']')) break;
      expect(',');
      skip_space();
    }
    return JsonValue(std::move(values));
  }

  JsonValue parse_object() {
    expect('{');
    skip_space();
    JsonValue::Object values;
    if (consume('}')) return JsonValue(std::move(values));
    while (true) {
      if (peek() != '"') throw error("object key must be a string");
      std::string key = parse_string();
      skip_space();
      expect(':');
      skip_space();
      auto [it, inserted] = values.emplace(std::move(key), parse_value());
      if (!inserted) throw error("duplicate object key");
      skip_space();
      if (consume('}')) break;
      expect(',');
      skip_space();
    }
    return JsonValue(std::move(values));
  }
};

const JsonValue& require_member(const JsonValue::Object& object, std::string_view key) {
  const auto it = object.find(std::string(key));
  if (it == object.end()) throw std::invalid_argument("missing request member: " + std::string(key));
  return it->second;
}

void require_only_members(
    const JsonValue::Object& object,
    std::initializer_list<std::string_view> allowed) {
  std::set<std::string> names;
  for (std::string_view value : allowed) names.emplace(value);
  for (const auto& [key, ignored] : object) {
    (void)ignored;
    if (!names.contains(key)) throw std::invalid_argument("unknown request member: " + key);
  }
}

std::string require_string(const JsonValue& value, std::string_view context) {
  if (value.type() != JsonValue::Type::kString) {
    throw std::invalid_argument(std::string(context) + " must be a string");
  }
  return value.text();
}

int require_int(const JsonValue& value, std::string_view context) {
  if (value.type() != JsonValue::Type::kNumber) {
    throw std::invalid_argument(std::string(context) + " must be an integer JSON number");
  }
  const std::string& text = value.text();
  if (text.find_first_of(".eE") != std::string::npos) {
    throw std::invalid_argument(std::string(context) + " must be an integer");
  }
  std::size_t consumed = 0;
  long long parsed = 0;
  try {
    parsed = std::stoll(text, &consumed, 10);
  } catch (...) {
    throw std::invalid_argument(std::string(context) + " is outside the supported integer range");
  }
  if (consumed != text.size() || parsed < std::numeric_limits<int>::min() ||
      parsed > std::numeric_limits<int>::max()) {
    throw std::invalid_argument(std::string(context) + " is outside the supported integer range");
  }
  return static_cast<int>(parsed);
}

Point parse_decimal_point(const JsonValue& value, std::string_view context) {
  if (value.type() != JsonValue::Type::kArray || value.array().size() != 2) {
    throw std::invalid_argument(std::string(context) + " must be a two-element array");
  }
  return {
      Rational::from_decimal(require_string(value.array()[0], std::string(context) + "[0]")),
      Rational::from_decimal(require_string(value.array()[1], std::string(context) + "[1]")),
  };
}

IntPoint parse_int_point(const JsonValue& value, std::string_view context) {
  if (value.type() != JsonValue::Type::kArray || value.array().size() != 2) {
    throw std::invalid_argument(std::string(context) + " must be a two-element array");
  }
  return {
      require_int(value.array()[0], std::string(context) + "[0]"),
      require_int(value.array()[1], std::string(context) + "[1]"),
  };
}

void append_json_string(std::string& output, std::string_view value) {
  output.push_back('"');
  static constexpr char kHex[] = "0123456789abcdef";
  for (const char raw_ch : value) {
    const unsigned char ch = static_cast<unsigned char>(raw_ch);
    switch (ch) {
      case '"': output += "\\\""; break;
      case '\\': output += "\\\\"; break;
      case '\b': output += "\\b"; break;
      case '\f': output += "\\f"; break;
      case '\n': output += "\\n"; break;
      case '\r': output += "\\r"; break;
      case '\t': output += "\\t"; break;
      default:
        if (ch < 0x20) {
          output += "\\u00";
          output.push_back(kHex[(ch >> 4) & 0x0F]);
          output.push_back(kHex[ch & 0x0F]);
        } else {
          output.push_back(static_cast<char>(ch));
        }
    }
  }
  output.push_back('"');
}

void append_rational(std::string& output, const Rational& value) {
  append_json_string(output, value.to_fraction_string());
}

void append_point(std::string& output, const Point& point) {
  output.push_back('[');
  append_rational(output, point.x);
  output.push_back(',');
  append_rational(output, point.y);
  output.push_back(']');
}

void append_int_point(std::string& output, const IntPoint& point) {
  output += '[' + std::to_string(point.x) + ',' + std::to_string(point.y) + ']';
}

struct EdgeKey {
  IntPoint first;
  IntPoint second;

  friend bool operator<(const EdgeKey& lhs, const EdgeKey& rhs) noexcept {
    return std::tie(lhs.first.x, lhs.first.y, lhs.second.x, lhs.second.y) <
           std::tie(rhs.first.x, rhs.first.y, rhs.second.x, rhs.second.y);
  }
};

EdgeKey canonical_edge_key(IntPoint lhs, IntPoint rhs) {
  if (rhs < lhs) std::swap(lhs, rhs);
  return {lhs, rhs};
}

Point coordinate_for(
    const RegistrationSpec& registration,
    const IntPoint& base_index,
    const Rational& pitch) {
  return {
      registration.origin_mm.x + Rational(base_index.x) * pitch,
      registration.origin_mm.y + Rational(base_index.y) * pitch,
  };
}

std::string candidate_id(
    const PhysicalSizeSpec& size,
    const RegistrationSpec& registration,
    const PopulationSpec& population,
    const ArrangementPattern& pattern,
    int translation_x,
    int translation_y) {
  return size.id + "/" + registration.id + "/" + population.id + "/" +
         arrangement_class_name(pattern.arrangement_class) + "/" + pattern.id +
         "/x" + std::to_string(translation_x) + ".y" + std::to_string(translation_y);
}

void validate_request_structure(const SolveRequest& request) {
  if (request.schema != "onemo.magnetic.solve.request/1") {
    throw std::invalid_argument("unsupported request schema");
  }
  if (request.scale_basis != "max_bbox_extent") {
    throw std::invalid_argument("scale_basis must be max_bbox_extent");
  }
  if (request.magnet_radius_mm <= Rational(0)) {
    throw std::invalid_argument("magnet_radius_mm must be positive");
  }
  if (request.base_pitch_mm <= Rational(0)) {
    throw std::invalid_argument("base_pitch_mm must be positive");
  }
  if (request.field.min_x > request.field.max_x || request.field.min_y > request.field.max_y) {
    throw std::invalid_argument("field bounds are inverted");
  }
  const std::int64_t field_width =
      static_cast<std::int64_t>(request.field.max_x) - request.field.min_x + 1;
  const std::int64_t field_height =
      static_cast<std::int64_t>(request.field.max_y) - request.field.min_y + 1;
  if (field_width != 9 || field_height != 9) {
    throw std::invalid_argument("released field must contain exactly 9 x 9 base-lattice positions");
  }
  if (request.sizes.empty()) throw std::invalid_argument("at least one physical size is required");
  if (request.registrations.empty()) throw std::invalid_argument("at least one registration is required");
  if (request.populations.empty()) throw std::invalid_argument("at least one population is required");
  if (request.patterns.empty()) throw std::invalid_argument("at least one explicit arrangement pattern is required");

  std::set<std::string> ids;
  for (const auto& size : request.sizes) {
    if (!valid_token(size.id) || !valid_token(size.band)) {
      throw std::invalid_argument("size id and band must be stable ASCII tokens");
    }
    if (!ids.emplace(size.id).second) throw std::invalid_argument("duplicate size id: " + size.id);
    if (size.max_extent_mm <= Rational(0)) throw std::invalid_argument("physical size must be positive");
  }

  ids.clear();
  std::set<std::pair<std::string, std::string>> origins;
  for (const auto& registration : request.registrations) {
    if (!valid_token(registration.id)) throw std::invalid_argument("registration id must be a stable ASCII token");
    if (!ids.emplace(registration.id).second) throw std::invalid_argument("duplicate registration id: " + registration.id);
    const auto key = std::make_pair(
        registration.origin_mm.x.to_fraction_string(),
        registration.origin_mm.y.to_fraction_string());
    if (!origins.emplace(key).second) throw std::invalid_argument("duplicate lattice registration origin");
  }

  ids.clear();
  std::set<std::tuple<int, int, int>> population_keys;
  for (const auto& population : request.populations) {
    if (!valid_token(population.id)) throw std::invalid_argument("population id must be a stable ASCII token");
    if (!ids.emplace(population.id).second) throw std::invalid_argument("duplicate population id: " + population.id);
    if (population.stride <= 0) throw std::invalid_argument("population stride must be positive");
    if (population.phase_x < 0 || population.phase_x >= population.stride ||
        population.phase_y < 0 || population.phase_y >= population.stride) {
      throw std::invalid_argument("population phase must be in [0, stride)");
    }
    if (!population_keys.emplace(population.stride, population.phase_x, population.phase_y).second) {
      throw std::invalid_argument("duplicate population stride/phase registration");
    }
  }

  ids.clear();
  for (const auto& pattern : request.patterns) {
    if (!valid_token(pattern.id)) throw std::invalid_argument("pattern id must be a stable ASCII token");
    if (!ids.emplace(pattern.id).second) throw std::invalid_argument("duplicate pattern id: " + pattern.id);
    if (pattern.sites.empty()) throw std::invalid_argument("pattern has no sites: " + pattern.id);
    if (!std::is_sorted(pattern.sites.begin(), pattern.sites.end())) {
      throw std::invalid_argument("pattern sites must be lexicographically sorted: " + pattern.id);
    }
    if (std::adjacent_find(pattern.sites.begin(), pattern.sites.end()) != pattern.sites.end()) {
      throw std::invalid_argument("pattern contains duplicate sites: " + pattern.id);
    }
    std::set<std::pair<std::size_t, std::size_t>> edge_keys;
    for (const auto& edge : pattern.edges) {
      if (edge.from_site >= pattern.sites.size() || edge.to_site >= pattern.sites.size() ||
          edge.from_site == edge.to_site) {
        throw std::invalid_argument("pattern edge references an invalid site: " + pattern.id);
      }
      const auto key = std::minmax(edge.from_site, edge.to_site);
      if (!edge_keys.emplace(key.first, key.second).second) {
        throw std::invalid_argument("pattern contains a duplicate edge: " + pattern.id);
      }
    }
  }
}

}  // namespace

Rational::Rational() : numerator_(0), denominator_(1) {}
Rational::Rational(std::int64_t value) : numerator_(value), denominator_(1) {}
Rational::Rational(BigInt numerator, BigInt denominator)
    : numerator_(std::move(numerator)), denominator_(std::move(denominator)) {
  normalize();
}

Rational Rational::from_decimal(std::string_view text) {
  if (text.empty()) throw std::invalid_argument("empty decimal string");
  std::size_t position = 0;
  bool negative = false;
  if (text[position] == '+' || text[position] == '-') {
    negative = text[position] == '-';
    ++position;
  }
  if (position >= text.size() || !std::isdigit(static_cast<unsigned char>(text[position]))) {
    throw std::invalid_argument("invalid decimal string: " + std::string(text));
  }

  BigInt numerator = 0;
  while (position < text.size() && std::isdigit(static_cast<unsigned char>(text[position]))) {
    numerator *= 10;
    numerator += text[position] - '0';
    ++position;
  }

  BigInt denominator = 1;
  if (position < text.size() && text[position] == '.') {
    ++position;
    const std::size_t fraction_start = position;
    while (position < text.size() && std::isdigit(static_cast<unsigned char>(text[position]))) {
      numerator *= 10;
      numerator += text[position] - '0';
      denominator *= 10;
      ++position;
    }
    if (position == fraction_start) {
      throw std::invalid_argument("decimal point must be followed by digits: " + std::string(text));
    }
  }
  if (position != text.size()) {
    throw std::invalid_argument("decimal strings do not accept exponent notation: " + std::string(text));
  }
  if (negative) numerator = -numerator;
  return Rational(std::move(numerator), std::move(denominator));
}

int Rational::sign() const noexcept {
  return numerator_ == 0 ? 0 : (numerator_ < 0 ? -1 : 1);
}

bool Rational::is_zero() const noexcept {
  return numerator_ == 0;
}

std::string Rational::to_fraction_string() const {
  const std::string numerator = numerator_.convert_to<std::string>();
  if (denominator_ == 1) return numerator;
  return numerator + "/" + denominator_.convert_to<std::string>();
}

long double Rational::to_long_double() const {
  return numerator_.convert_to<long double>() / denominator_.convert_to<long double>();
}

void Rational::normalize() {
  if (denominator_ == 0) throw std::invalid_argument("rational denominator is zero");
  if (denominator_ < 0) {
    numerator_ = -numerator_;
    denominator_ = -denominator_;
  }
  if (numerator_ == 0) {
    denominator_ = 1;
    return;
  }
  const BigInt divisor = gcd_big(numerator_, denominator_);
  numerator_ /= divisor;
  denominator_ /= divisor;
}

Rational operator+(const Rational& lhs, const Rational& rhs) {
  return Rational(lhs.numerator_ * rhs.denominator_ + rhs.numerator_ * lhs.denominator_,
                  lhs.denominator_ * rhs.denominator_);
}
Rational operator-(const Rational& lhs, const Rational& rhs) {
  return Rational(lhs.numerator_ * rhs.denominator_ - rhs.numerator_ * lhs.denominator_,
                  lhs.denominator_ * rhs.denominator_);
}
Rational operator*(const Rational& lhs, const Rational& rhs) {
  return Rational(lhs.numerator_ * rhs.numerator_, lhs.denominator_ * rhs.denominator_);
}
Rational operator/(const Rational& lhs, const Rational& rhs) {
  if (rhs.numerator_ == 0) throw std::invalid_argument("division by zero rational");
  return Rational(lhs.numerator_ * rhs.denominator_, lhs.denominator_ * rhs.numerator_);
}
Rational operator-(const Rational& value) {
  return Rational(-value.numerator_, value.denominator_);
}
bool operator==(const Rational& lhs, const Rational& rhs) noexcept {
  return lhs.numerator_ == rhs.numerator_ && lhs.denominator_ == rhs.denominator_;
}
bool operator!=(const Rational& lhs, const Rational& rhs) noexcept { return !(lhs == rhs); }
bool operator<(const Rational& lhs, const Rational& rhs) {
  return lhs.numerator_ * rhs.denominator_ < rhs.numerator_ * lhs.denominator_;
}
bool operator<=(const Rational& lhs, const Rational& rhs) { return !(rhs < lhs); }
bool operator>(const Rational& lhs, const Rational& rhs) { return rhs < lhs; }
bool operator>=(const Rational& lhs, const Rational& rhs) { return !(lhs < rhs); }

PreparedOutline PreparedOutline::prepare(std::vector<Point> vertices) {
  if (vertices.size() >= 2 && vertices.front() == vertices.back()) {
    vertices.pop_back();
  }
  if (vertices.size() < 3) throw std::invalid_argument("outline requires at least three vertices");
  validate_simple_polygon(vertices);

  Rational area = signed_double_area(vertices);
  if (area.is_zero()) throw std::invalid_argument("outline area is zero");
  if (area < Rational(0)) std::reverse(vertices.begin(), vertices.end());

  const auto first = std::min_element(vertices.begin(), vertices.end(), lexicographic_point_less);
  std::rotate(vertices.begin(), first, vertices.end());

  PreparedOutline prepared;
  prepared.vertices_ = std::move(vertices);
  prepared.bounding_box_ = compute_bounding_box(prepared.vertices_);
  const Rational width = prepared.bounding_box_.max_x - prepared.bounding_box_.min_x;
  const Rational height = prepared.bounding_box_.max_y - prepared.bounding_box_.min_y;
  if (width <= Rational(0) || height <= Rational(0)) {
    throw std::invalid_argument("outline bounding box must have positive width and height");
  }
  prepared.bounding_box_center_ = {
      (prepared.bounding_box_.min_x + prepared.bounding_box_.max_x) / Rational(2),
      (prepared.bounding_box_.min_y + prepared.bounding_box_.max_y) / Rational(2),
  };
  prepared.max_bbox_extent_ = std::max(width, height);
  return prepared;
}

SizedOutline::SizedOutline(const PreparedOutline& canonical, Rational target_max_extent_mm)
    : target_max_extent_mm_(std::move(target_max_extent_mm)) {
  if (target_max_extent_mm_ <= Rational(0)) throw std::invalid_argument("target physical size must be positive");
  canonical_to_physical_scale_ = target_max_extent_mm_ / canonical.max_bbox_extent();
  physical_to_canonical_scale_ = canonical.max_bbox_extent() / target_max_extent_mm_;
  vertices_.reserve(canonical.vertices().size());
  for (const Point& point : canonical.vertices()) {
    vertices_.push_back(multiply(subtract(point, canonical.bounding_box_center()), canonical_to_physical_scale_));
  }
}

PointLocation SizedOutline::locate(const Point& point) const {
  return locate_point(vertices_, point);
}

SiteFact SizedOutline::evaluate_site(const Point& center, const Rational& radius_mm) const {
  if (radius_mm < Rational(0)) throw std::invalid_argument("disc radius cannot be negative");
  const PointLocation location = locate(center);
  const BoundaryDistanceResult distance = point_boundary_distance(vertices_, center);
  const Rational radius_squared = radius_mm * radius_mm;
  return {
      center,
      location,
      distance.squared,
      distance.witness,
      location != PointLocation::kOutside && distance.squared >= radius_squared,
  };
}

CorridorFact SizedOutline::evaluate_corridor(
    const Point& from,
    const Point& to,
    const Rational& radius_mm) const {
  if (radius_mm < Rational(0)) throw std::invalid_argument("corridor radius cannot be negative");
  if (from == to) throw std::invalid_argument("corridor endpoints must be distinct");
  const bool centerline_contained = segment_contained_in_polygon(vertices_, from, to);
  const SegmentBoundaryDistanceResult distance = segment_boundary_distance(vertices_, from, to);
  const Rational radius_squared = radius_mm * radius_mm;
  return {
      from,
      to,
      centerline_contained,
      distance.squared,
      distance.witness,
      centerline_contained && distance.squared >= radius_squared,
  };
}

std::string arrangement_class_name(ArrangementClass value) {
  switch (value) {
    case ArrangementClass::kSingleSite: return "single_site";
    case ArrangementClass::kHorizontalPair: return "horizontal_pair";
    case ArrangementClass::kVerticalPair: return "vertical_pair";
    case ArrangementClass::kDiagonalPair: return "diagonal_pair";
    case ArrangementClass::kCompleteRectangularWindow: return "complete_rectangular_window";
    case ArrangementClass::kRowSkipping: return "row_skipping";
    case ArrangementClass::kColumnSkipping: return "column_skipping";
    case ArrangementClass::kCornerTriangle: return "corner_triangle";
    case ArrangementClass::kCornerRectangle: return "corner_rectangle";
  }
  throw std::logic_error("unknown arrangement class enum");
}

std::string corridor_mode_name(CorridorMode value) {
  switch (value) {
    case CorridorMode::kReport: return "report";
    case CorridorMode::kRequire: return "require";
  }
  throw std::logic_error("unknown corridor mode enum");
}

std::string point_location_name(PointLocation value) {
  switch (value) {
    case PointLocation::kOutside: return "outside";
    case PointLocation::kBoundary: return "boundary";
    case PointLocation::kInside: return "inside";
  }
  throw std::logic_error("unknown point location enum");
}

SolveRequest parse_request_json(std::string_view json) {
  const JsonValue root = JsonParser(json).parse();
  if (root.type() != JsonValue::Type::kObject) throw std::invalid_argument("request root must be an object");
  const auto& object = root.object();
  require_only_members(object, {
      "schema", "outline", "scale_basis", "magnet_radius_mm", "base_pitch_mm",
      "field", "sizes", "registrations", "populations", "patterns"});

  SolveRequest request;
  request.schema = require_string(require_member(object, "schema"), "schema");
  request.scale_basis = require_string(require_member(object, "scale_basis"), "scale_basis");
  request.magnet_radius_mm = Rational::from_decimal(
      require_string(require_member(object, "magnet_radius_mm"), "magnet_radius_mm"));
  request.base_pitch_mm = Rational::from_decimal(
      require_string(require_member(object, "base_pitch_mm"), "base_pitch_mm"));

  const JsonValue& outline = require_member(object, "outline");
  if (outline.type() != JsonValue::Type::kArray) throw std::invalid_argument("outline must be an array");
  request.canonical_outline.reserve(outline.array().size());
  for (std::size_t i = 0; i < outline.array().size(); ++i) {
    request.canonical_outline.push_back(parse_decimal_point(outline.array()[i], "outline point"));
  }

  const JsonValue& field = require_member(object, "field");
  if (field.type() != JsonValue::Type::kObject) throw std::invalid_argument("field must be an object");
  require_only_members(field.object(), {"min_x", "max_x", "min_y", "max_y"});
  request.field = {
      require_int(require_member(field.object(), "min_x"), "field.min_x"),
      require_int(require_member(field.object(), "max_x"), "field.max_x"),
      require_int(require_member(field.object(), "min_y"), "field.min_y"),
      require_int(require_member(field.object(), "max_y"), "field.max_y"),
  };

  const JsonValue& sizes = require_member(object, "sizes");
  if (sizes.type() != JsonValue::Type::kArray) throw std::invalid_argument("sizes must be an array");
  for (const JsonValue& value : sizes.array()) {
    if (value.type() != JsonValue::Type::kObject) throw std::invalid_argument("size must be an object");
    require_only_members(value.object(), {"id", "band", "max_extent_mm"});
    request.sizes.push_back({
        require_string(require_member(value.object(), "id"), "size.id"),
        require_string(require_member(value.object(), "band"), "size.band"),
        Rational::from_decimal(require_string(require_member(value.object(), "max_extent_mm"), "size.max_extent_mm")),
    });
  }

  const JsonValue& registrations = require_member(object, "registrations");
  if (registrations.type() != JsonValue::Type::kArray) throw std::invalid_argument("registrations must be an array");
  for (const JsonValue& value : registrations.array()) {
    if (value.type() != JsonValue::Type::kObject) throw std::invalid_argument("registration must be an object");
    require_only_members(value.object(), {"id", "origin_mm"});
    request.registrations.push_back({
        require_string(require_member(value.object(), "id"), "registration.id"),
        parse_decimal_point(require_member(value.object(), "origin_mm"), "registration.origin_mm"),
    });
  }

  const JsonValue& populations = require_member(object, "populations");
  if (populations.type() != JsonValue::Type::kArray) throw std::invalid_argument("populations must be an array");
  for (const JsonValue& value : populations.array()) {
    if (value.type() != JsonValue::Type::kObject) throw std::invalid_argument("population must be an object");
    require_only_members(value.object(), {"id", "stride", "phase"});
    const IntPoint phase = parse_int_point(require_member(value.object(), "phase"), "population.phase");
    request.populations.push_back({
        require_string(require_member(value.object(), "id"), "population.id"),
        require_int(require_member(value.object(), "stride"), "population.stride"),
        phase.x,
        phase.y,
    });
  }

  const JsonValue& patterns = require_member(object, "patterns");
  if (patterns.type() != JsonValue::Type::kArray) throw std::invalid_argument("patterns must be an array");
  for (const JsonValue& value : patterns.array()) {
    if (value.type() != JsonValue::Type::kObject) throw std::invalid_argument("pattern must be an object");
    require_only_members(value.object(), {"id", "class", "sites", "edges"});
    ArrangementPattern pattern;
    pattern.id = require_string(require_member(value.object(), "id"), "pattern.id");
    pattern.arrangement_class = parse_arrangement_class(
        require_string(require_member(value.object(), "class"), "pattern.class"));

    const JsonValue& sites_value = require_member(value.object(), "sites");
    if (sites_value.type() != JsonValue::Type::kArray) throw std::invalid_argument("pattern.sites must be an array");
    for (const JsonValue& site : sites_value.array()) {
      pattern.sites.push_back(parse_int_point(site, "pattern site"));
    }

    const JsonValue& edges_value = require_member(value.object(), "edges");
    if (edges_value.type() != JsonValue::Type::kArray) throw std::invalid_argument("pattern.edges must be an array");
    for (const JsonValue& edge_value : edges_value.array()) {
      if (edge_value.type() != JsonValue::Type::kObject) throw std::invalid_argument("pattern edge must be an object");
      require_only_members(edge_value.object(), {"from", "to", "corridor"});
      const int from = require_int(require_member(edge_value.object(), "from"), "edge.from");
      const int to = require_int(require_member(edge_value.object(), "to"), "edge.to");
      if (from < 0 || to < 0) throw std::invalid_argument("pattern edge indices cannot be negative");
      pattern.edges.push_back({
          static_cast<std::size_t>(from),
          static_cast<std::size_t>(to),
          parse_corridor_mode(require_string(require_member(edge_value.object(), "corridor"), "edge.corridor")),
      });
    }
    request.patterns.push_back(std::move(pattern));
  }

  validate_request_structure(request);
  return request;
}

SolveResult solve(const SolveRequest& request) {
  validate_request_structure(request);
  PreparedOutline prepared = PreparedOutline::prepare(request.canonical_outline);

  std::vector<PhysicalSizeSpec> sizes = request.sizes;
  std::sort(sizes.begin(), sizes.end(), [](const auto& lhs, const auto& rhs) {
    if (lhs.max_extent_mm != rhs.max_extent_mm) return lhs.max_extent_mm < rhs.max_extent_mm;
    if (lhs.band != rhs.band) return lhs.band < rhs.band;
    return lhs.id < rhs.id;
  });
  std::vector<RegistrationSpec> registrations = request.registrations;
  std::sort(registrations.begin(), registrations.end(), [](const auto& lhs, const auto& rhs) {
    return lhs.id < rhs.id;
  });
  std::vector<PopulationSpec> populations = request.populations;
  std::sort(populations.begin(), populations.end(), [](const auto& lhs, const auto& rhs) {
    return std::tie(lhs.stride, lhs.phase_x, lhs.phase_y, lhs.id) <
           std::tie(rhs.stride, rhs.phase_x, rhs.phase_y, rhs.id);
  });
  std::vector<ArrangementPattern> patterns = request.patterns;
  std::sort(patterns.begin(), patterns.end(), [](const auto& lhs, const auto& rhs) {
    const int lhs_order = arrangement_class_order(lhs.arrangement_class);
    const int rhs_order = arrangement_class_order(rhs.arrangement_class);
    if (lhs_order != rhs_order) return lhs_order < rhs_order;
    return lhs.id < rhs.id;
  });

  SolveResult result{
      std::move(prepared),
      request.magnet_radius_mm,
      request.base_pitch_mm,
      request.field,
      populations,
      {},
      {},
      {},
      {},
  };
  result.metrics.prepared_vertex_count = result.prepared_outline.vertices().size();

  for (const RegistrationSpec& registration : registrations) {
    LatticeResult lattice;
    lattice.registration_id = registration.id;
    lattice.origin_mm = registration.origin_mm;
    for (int y = request.field.min_y; y <= request.field.max_y; ++y) {
      for (int x = request.field.min_x; x <= request.field.max_x; ++x) {
        const IntPoint index{x, y};
        lattice.base_sites.push_back({index, coordinate_for(registration, index, request.base_pitch_mm)});
      }
    }
    result.lattices.push_back(std::move(lattice));
  }

  for (const PhysicalSizeSpec& size : sizes) {
    const std::size_t first_candidate = result.candidates.size();
    SizedOutline sized(result.prepared_outline, size.max_extent_mm);

    for (const RegistrationSpec& registration : registrations) {
      std::map<IntPoint, SiteFact> site_cache;
      std::map<EdgeKey, CorridorFact> corridor_cache;

      const auto get_site = [&](const IntPoint& base_index) -> const SiteFact& {
        auto it = site_cache.find(base_index);
        if (it != site_cache.end()) return it->second;
        const Point coordinate = coordinate_for(registration, base_index, request.base_pitch_mm);
        SiteFact fact = sized.evaluate_site(coordinate, request.magnet_radius_mm);
        ++result.metrics.site_facts_computed;
        return site_cache.emplace(base_index, std::move(fact)).first->second;
      };

      const auto get_corridor = [&](const IntPoint& lhs, const IntPoint& rhs) -> const CorridorFact& {
        const EdgeKey key = canonical_edge_key(lhs, rhs);
        auto it = corridor_cache.find(key);
        if (it != corridor_cache.end()) return it->second;
        const Point from = coordinate_for(registration, key.first, request.base_pitch_mm);
        const Point to = coordinate_for(registration, key.second, request.base_pitch_mm);
        CorridorFact fact = sized.evaluate_corridor(from, to, request.magnet_radius_mm);
        ++result.metrics.corridor_facts_computed;
        return corridor_cache.emplace(key, std::move(fact)).first->second;
      };

      for (const PopulationSpec& population : populations) {
        const int population_min_x = checked_int(
            ceil_div(static_cast<std::int64_t>(request.field.min_x) - population.phase_x,
                     population.stride),
            "population minimum x index");
        const int population_max_x = checked_int(
            floor_div(static_cast<std::int64_t>(request.field.max_x) - population.phase_x,
                      population.stride),
            "population maximum x index");
        const int population_min_y = checked_int(
            ceil_div(static_cast<std::int64_t>(request.field.min_y) - population.phase_y,
                     population.stride),
            "population minimum y index");
        const int population_max_y = checked_int(
            floor_div(static_cast<std::int64_t>(request.field.max_y) - population.phase_y,
                      population.stride),
            "population maximum y index");

        for (const ArrangementPattern& pattern : patterns) {
          int pattern_min_x = pattern.sites.front().x;
          int pattern_max_x = pattern.sites.front().x;
          int pattern_min_y = pattern.sites.front().y;
          int pattern_max_y = pattern.sites.front().y;
          for (const IntPoint& site : pattern.sites) {
            pattern_min_x = std::min(pattern_min_x, site.x);
            pattern_max_x = std::max(pattern_max_x, site.x);
            pattern_min_y = std::min(pattern_min_y, site.y);
            pattern_max_y = std::max(pattern_max_y, site.y);
          }

          const std::int64_t translation_min_x_wide =
              static_cast<std::int64_t>(population_min_x) - pattern_min_x;
          const std::int64_t translation_max_x_wide =
              static_cast<std::int64_t>(population_max_x) - pattern_max_x;
          const std::int64_t translation_min_y_wide =
              static_cast<std::int64_t>(population_min_y) - pattern_min_y;
          const std::int64_t translation_max_y_wide =
              static_cast<std::int64_t>(population_max_y) - pattern_max_y;
          if (translation_min_x_wide > translation_max_x_wide ||
              translation_min_y_wide > translation_max_y_wide) {
            continue;
          }
          const int translation_min_x = checked_int(translation_min_x_wide, "translation minimum x");
          const int translation_max_x = checked_int(translation_max_x_wide, "translation maximum x");
          const int translation_min_y = checked_int(translation_min_y_wide, "translation minimum y");
          const int translation_max_y = checked_int(translation_max_y_wide, "translation maximum y");

          for (int translation_y = translation_min_y; translation_y <= translation_max_y; ++translation_y) {
            for (int translation_x = translation_min_x; translation_x <= translation_max_x; ++translation_x) {
              ++result.metrics.placements_tested;
              std::vector<CandidateSite> candidate_sites;
              candidate_sites.reserve(pattern.sites.size());
              bool sites_lawful = true;
              for (std::size_t site_index = 0; site_index < pattern.sites.size(); ++site_index) {
                const IntPoint population_index{
                    checked_int(
                        static_cast<std::int64_t>(pattern.sites[site_index].x) + translation_x,
                        "translated population x index"),
                    checked_int(
                        static_cast<std::int64_t>(pattern.sites[site_index].y) + translation_y,
                        "translated population y index"),
                };
                const IntPoint base_index{
                    checked_int(
                        static_cast<std::int64_t>(population.phase_x) +
                            static_cast<std::int64_t>(population.stride) * population_index.x,
                        "base-lattice x index"),
                    checked_int(
                        static_cast<std::int64_t>(population.phase_y) +
                            static_cast<std::int64_t>(population.stride) * population_index.y,
                        "base-lattice y index"),
                };
                if (base_index.x < request.field.min_x || base_index.x > request.field.max_x ||
                    base_index.y < request.field.min_y || base_index.y > request.field.max_y) {
                  throw std::logic_error("enumerator produced a base index outside the released field");
                }
                const SiteFact& fact = get_site(base_index);
                if (!fact.complete_disc_contained) {
                  sites_lawful = false;
                  break;
                }
                candidate_sites.push_back({
                    site_index,
                    pattern.sites[site_index],
                    base_index,
                    fact.center,
                    fact,
                });
              }
              if (!sites_lawful) continue;

              std::vector<CandidateEdge> candidate_edges;
              candidate_edges.reserve(pattern.edges.size());
              bool edges_lawful = true;
              for (std::size_t edge_index = 0; edge_index < pattern.edges.size(); ++edge_index) {
                const PatternEdge& edge = pattern.edges[edge_index];
                const IntPoint& from_index = candidate_sites[edge.from_site].base_index;
                const IntPoint& to_index = candidate_sites[edge.to_site].base_index;
                const CorridorFact& fact = get_corridor(from_index, to_index);
                if (edge.corridor_mode == CorridorMode::kRequire && !fact.complete_corridor_contained) {
                  edges_lawful = false;
                  break;
                }
                candidate_edges.push_back({
                    edge_index,
                    edge.from_site,
                    edge.to_site,
                    edge.corridor_mode,
                    fact,
                });
              }
              if (!edges_lawful) continue;

              Candidate candidate;
              candidate.id = candidate_id(size, registration, population, pattern, translation_x, translation_y);
              candidate.size_id = size.id;
              candidate.band = size.band;
              candidate.physical_size_mm = size.max_extent_mm;
              candidate.population_id = population.id;
              candidate.population_stride = population.stride;
              candidate.population_phase_x = population.phase_x;
              candidate.population_phase_y = population.phase_y;
              candidate.registration_id = registration.id;
              candidate.arrangement_class = pattern.arrangement_class;
              candidate.pattern_id = pattern.id;
              candidate.placement_population_index = {translation_x, translation_y};
              candidate.sites = std::move(candidate_sites);
              candidate.edges = std::move(candidate_edges);
              result.candidates.push_back(std::move(candidate));
            }
          }
        }
      }
    }

    result.sizes.push_back({
        size.id,
        size.band,
        size.max_extent_mm,
        sized.canonical_to_physical_scale(),
        sized.physical_to_canonical_scale(),
        result.candidates.size() - first_candidate,
    });
  }

  result.metrics.candidates_emitted = result.candidates.size();
  return result;
}

std::string serialize_result_json(const SolveResult& result) {
  std::string output;
  output.reserve(4096 + result.candidates.size() * 768);
  output += "{\"schema\":\"onemo.magnetic.solve.result/1\",\"status\":\"ok\",";

  output += "\"outline\":{";
  output += "\"vertex_count\":" + std::to_string(result.prepared_outline.vertices().size()) + ',';
  output += "\"canonical_orientation\":\"counter_clockwise\",";
  output += "\"scale_basis\":\"max_bbox_extent\",";
  output += "\"bbox_canonical\":{";
  output += "\"min\":";
  append_point(output, {result.prepared_outline.bounding_box().min_x, result.prepared_outline.bounding_box().min_y});
  output += ",\"max\":";
  append_point(output, {result.prepared_outline.bounding_box().max_x, result.prepared_outline.bounding_box().max_y});
  output += ",\"center\":";
  append_point(output, result.prepared_outline.bounding_box_center());
  output += ",\"max_extent\":";
  append_rational(output, result.prepared_outline.max_bbox_extent());
  output += "}},";

  output += "\"physical_spec\":{";
  output += "\"magnet_radius_mm\":";
  append_rational(output, result.magnet_radius_mm);
  output += ",\"base_pitch_mm\":";
  append_rational(output, result.base_pitch_mm);
  output += ",\"field\":{";
  output += "\"min_x\":" + std::to_string(result.field.min_x) + ',';
  output += "\"max_x\":" + std::to_string(result.field.max_x) + ',';
  output += "\"min_y\":" + std::to_string(result.field.min_y) + ',';
  output += "\"max_y\":" + std::to_string(result.field.max_y) + "},";
  output += "\"populations\":[";
  for (std::size_t i = 0; i < result.populations.size(); ++i) {
    if (i) output.push_back(',');
    const auto& population = result.populations[i];
    output += "{\"id\":";
    append_json_string(output, population.id);
    output += ",\"stride\":" + std::to_string(population.stride) + ",\"phase\":[" +
              std::to_string(population.phase_x) + ',' + std::to_string(population.phase_y) + "]}";
  }
  output += "]},";

  output += "\"sizes\":[";
  for (std::size_t i = 0; i < result.sizes.size(); ++i) {
    if (i) output.push_back(',');
    const auto& size = result.sizes[i];
    output += "{\"id\":";
    append_json_string(output, size.id);
    output += ",\"band\":";
    append_json_string(output, size.band);
    output += ",\"max_extent_mm\":";
    append_rational(output, size.max_extent_mm);
    output += ",\"canonical_to_physical_scale\":";
    append_rational(output, size.canonical_to_physical_scale);
    output += ",\"physical_to_canonical_scale\":";
    append_rational(output, size.physical_to_canonical_scale);
    output += ",\"candidate_count\":" + std::to_string(size.candidate_count) + '}';
  }
  output += "],";

  output += "\"lattices\":[";
  for (std::size_t i = 0; i < result.lattices.size(); ++i) {
    if (i) output.push_back(',');
    const auto& lattice = result.lattices[i];
    output += "{\"registration_id\":";
    append_json_string(output, lattice.registration_id);
    output += ",\"origin_mm\":";
    append_point(output, lattice.origin_mm);
    output += ",\"base_sites\":[";
    for (std::size_t j = 0; j < lattice.base_sites.size(); ++j) {
      if (j) output.push_back(',');
      output += "{\"index\":";
      append_int_point(output, lattice.base_sites[j].base_index);
      output += ",\"coordinate_mm\":";
      append_point(output, lattice.base_sites[j].coordinate_mm);
      output.push_back('}');
    }
    output += "]}";
  }
  output += "],";

  output += "\"candidates\":[";
  for (std::size_t i = 0; i < result.candidates.size(); ++i) {
    if (i) output.push_back(',');
    const Candidate& candidate = result.candidates[i];
    output += "{\"id\":";
    append_json_string(output, candidate.id);
    output += ",\"size_id\":";
    append_json_string(output, candidate.size_id);
    output += ",\"band\":";
    append_json_string(output, candidate.band);
    output += ",\"physical_size_mm\":";
    append_rational(output, candidate.physical_size_mm);
    output += ",\"population\":{";
    output += "\"id\":";
    append_json_string(output, candidate.population_id);
    output += ",\"stride\":" + std::to_string(candidate.population_stride) + ",\"phase\":[" +
              std::to_string(candidate.population_phase_x) + ',' +
              std::to_string(candidate.population_phase_y) + "]},";
    output += "\"registration_id\":";
    append_json_string(output, candidate.registration_id);
    output += ",\"arrangement_class\":";
    append_json_string(output, arrangement_class_name(candidate.arrangement_class));
    output += ",\"pattern_id\":";
    append_json_string(output, candidate.pattern_id);
    output += ",\"placement_population_index\":";
    append_int_point(output, candidate.placement_population_index);

    output += ",\"sites\":[";
    for (std::size_t j = 0; j < candidate.sites.size(); ++j) {
      if (j) output.push_back(',');
      const CandidateSite& site = candidate.sites[j];
      output += "{\"pattern_site_index\":" + std::to_string(site.pattern_site_index) + ',';
      output += "\"pattern_index\":";
      append_int_point(output, site.pattern_index);
      output += ",\"base_index\":";
      append_int_point(output, site.base_index);
      output += ",\"coordinate_mm\":";
      append_point(output, site.coordinate_mm);
      output += ",\"center_location\":";
      append_json_string(output, point_location_name(site.fact.center_location));
      output += ",\"boundary_clearance_mm_exact\":{";
      output += "\"squared_mm2\":";
      append_rational(output, site.fact.boundary_clearance_squared_mm2);
      output += "},\"limiting_witness\":{";
      output += "\"edge_index\":" + std::to_string(site.fact.limiting_witness.edge_index) + ',';
      output += "\"boundary_point_mm\":";
      append_point(output, site.fact.limiting_witness.boundary_point);
      output += "},\"complete_disc_contained\":";
      output += site.fact.complete_disc_contained ? "true" : "false";
      output.push_back('}');
    }
    output += "],\"edges\":[";
    for (std::size_t j = 0; j < candidate.edges.size(); ++j) {
      if (j) output.push_back(',');
      const CandidateEdge& edge = candidate.edges[j];
      output += "{\"pattern_edge_index\":" + std::to_string(edge.pattern_edge_index) + ',';
      output += "\"from_site\":" + std::to_string(edge.from_site) + ',';
      output += "\"to_site\":" + std::to_string(edge.to_site) + ',';
      output += "\"corridor_mode\":";
      append_json_string(output, corridor_mode_name(edge.corridor_mode));
      output += ",\"centerline_contained\":";
      output += edge.fact.centerline_contained ? "true" : "false";
      output += ",\"centerline_boundary_clearance_mm_exact\":{";
      output += "\"squared_mm2\":";
      append_rational(output, edge.fact.centerline_boundary_clearance_squared_mm2);
      output += "},\"limiting_witness\":{";
      output += "\"boundary_edge_index\":" + std::to_string(edge.fact.limiting_witness.boundary_edge_index) + ',';
      output += "\"centerline_point_mm\":";
      append_point(output, edge.fact.limiting_witness.centerline_point);
      output += ",\"boundary_point_mm\":";
      append_point(output, edge.fact.limiting_witness.boundary_point);
      output += "},\"complete_corridor_contained\":";
      output += edge.fact.complete_corridor_contained ? "true" : "false";
      output.push_back('}');
    }
    output += "]}";
  }
  output += "],";

  output += "\"metrics\":{";
  output += "\"prepared_vertex_count\":" + std::to_string(result.metrics.prepared_vertex_count) + ',';
  output += "\"site_facts_computed\":" + std::to_string(result.metrics.site_facts_computed) + ',';
  output += "\"corridor_facts_computed\":" + std::to_string(result.metrics.corridor_facts_computed) + ',';
  output += "\"placements_tested\":" + std::to_string(result.metrics.placements_tested) + ',';
  output += "\"candidates_emitted\":" + std::to_string(result.metrics.candidates_emitted) + "}}";
  return output;
}

std::string serialize_error_json(std::string_view code, std::string_view message) {
  std::string output = "{\"schema\":\"onemo.magnetic.solve.result/1\",\"status\":\"error\",\"error\":{\"code\":";
  append_json_string(output, code);
  output += ",\"message\":";
  append_json_string(output, message);
  output += "}}";
  return output;
}

std::string solve_json(std::string_view request_json) noexcept {
  try {
    return serialize_result_json(solve(parse_request_json(request_json)));
  } catch (const std::invalid_argument& error) {
    return serialize_error_json("invalid_request", error.what());
  } catch (const std::exception& error) {
    return serialize_error_json("engine_error", error.what());
  } catch (...) {
    return serialize_error_json("engine_error", "unknown non-standard exception");
  }
}

}  // namespace onemo::magnetic
