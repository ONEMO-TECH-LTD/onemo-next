// magfit_cli — the only bridge between the browser surface and the unmodified reference core.
//
// Reads one JSON request on stdin, writes one JSON result on stdout. It performs NO geometry:
// it converts, calls magfit::solve, and serialises whatever the core returned. Every number in
// the output is the core's own.
//
// Request:
//   {"vertices":[[x,y],...],            // any numeric units; scaled to integers below
//    "bands":[2,3],
//    "scale":20000,                     // optional, integer trace units per input unit
//    "sparseMode":"ANY"|"ALL"|"FIXED"|"DISABLED",
//    "sparseMinActive":1,
//    "requireLinks":true,
//    "requireBandSpan":true}

#include "magfit/magfit.hpp"

#include <cmath>
#include <cstdlib>
#include <iostream>
#include <optional>
#include <sstream>
#include <string>
#include <vector>

namespace {

std::string slurp_stdin() {
    std::ostringstream out;
    out << std::cin.rdbuf();
    return out.str();
}

std::optional<std::string> string_field(const std::string& text, const std::string& key) {
    const std::string needle = "\"" + key + "\"";
    const std::size_t at = text.find(needle);
    if (at == std::string::npos) return std::nullopt;
    const std::size_t colon = text.find(':', at + needle.size());
    if (colon == std::string::npos) return std::nullopt;
    const std::size_t open = text.find('"', colon);
    if (open == std::string::npos) return std::nullopt;
    const std::size_t close = text.find('"', open + 1);
    if (close == std::string::npos) return std::nullopt;
    return text.substr(open + 1, close - open - 1);
}

std::optional<long double> number_field(const std::string& text, const std::string& key) {
    const std::string needle = "\"" + key + "\"";
    const std::size_t at = text.find(needle);
    if (at == std::string::npos) return std::nullopt;
    const std::size_t colon = text.find(':', at + needle.size());
    if (colon == std::string::npos) return std::nullopt;
    std::size_t i = colon + 1;
    while (i < text.size() && (text[i] == ' ' || text[i] == '\n' || text[i] == '\t')) ++i;
    if (i < text.size() && (text.compare(i, 4, "true") == 0)) return 1.0L;
    if (i < text.size() && (text.compare(i, 5, "false") == 0)) return 0.0L;
    std::size_t end = i;
    while (end < text.size() && (std::isdigit(static_cast<unsigned char>(text[end])) ||
                                 text[end] == '-' || text[end] == '+' || text[end] == '.' ||
                                 text[end] == 'e' || text[end] == 'E')) {
        ++end;
    }
    if (end == i) return std::nullopt;
    return std::stold(text.substr(i, end - i));
}

// Reads the array that follows "vertices": as pairs of numbers.
std::vector<std::pair<long double, long double>> read_vertices(const std::string& text) {
    std::vector<std::pair<long double, long double>> out;
    const std::size_t at = text.find("\"vertices\"");
    if (at == std::string::npos) return out;
    const std::size_t array_start = text.find('[', at);
    if (array_start == std::string::npos) return out;
    int depth = 0;
    std::size_t end = array_start;
    for (; end < text.size(); ++end) {
        if (text[end] == '[') ++depth;
        else if (text[end] == ']') {
            --depth;
            if (depth == 0) break;
        }
    }
    const std::string body = text.substr(array_start, end - array_start + 1);
    std::size_t p = 0;
    while (true) {
        const std::size_t pair_start = body.find('[', p + 1);
        if (pair_start == std::string::npos) break;
        const std::size_t pair_end = body.find(']', pair_start);
        if (pair_end == std::string::npos) break;
        const std::string pair = body.substr(pair_start + 1, pair_end - pair_start - 1);
        const std::size_t comma = pair.find(',');
        if (comma != std::string::npos) {
            out.push_back({std::stold(pair.substr(0, comma)), std::stold(pair.substr(comma + 1))});
        }
        p = pair_end;
    }
    return out;
}

std::vector<int> read_bands(const std::string& text) {
    std::vector<int> out;
    const std::size_t at = text.find("\"bands\"");
    if (at == std::string::npos) return {2, 3};
    const std::size_t open = text.find('[', at);
    const std::size_t close = text.find(']', open);
    if (open == std::string::npos || close == std::string::npos) return {2, 3};
    std::stringstream body(text.substr(open + 1, close - open - 1));
    std::string token;
    while (std::getline(body, token, ',')) {
        try {
            out.push_back(std::stoi(token));
        } catch (...) {
        }
    }
    if (out.empty()) return {2, 3};
    return out;
}

std::string json_escape(const std::string& text) {
    std::string out;
    for (char c : text) {
        if (c == '"' || c == '\\') out += '\\';
        out += c;
    }
    return out;
}

void print_points(std::ostream& os, const std::vector<magfit::GridPoint>& points, int half_pitch) {
    os << '[';
    for (std::size_t i = 0; i < points.size(); ++i) {
        if (i) os << ',';
        os << "{\"x24\":" << points[i].x24 << ",\"y24\":" << points[i].y24
           << ",\"xMm\":" << points[i].x24 * half_pitch
           << ",\"yMm\":" << points[i].y24 * half_pitch << '}';
    }
    os << ']';
}

}  // namespace

int main() {
    const std::string request = slurp_stdin();
    try {
        const long double scale = number_field(request, "scale").value_or(20000.0L);
        const auto raw = read_vertices(request);
        if (raw.size() < 3) throw std::invalid_argument("request needs at least three vertices");

        std::vector<magfit::PointI> vertices;
        vertices.reserve(raw.size());
        for (const auto& [x, y] : raw) {
            const magfit::PointI p{static_cast<magfit::i64>(std::llroundl(x * scale)),
                                   static_cast<magfit::i64>(std::llroundl(y * scale))};
            if (vertices.empty() || !(vertices.back() == p)) vertices.push_back(p);
        }
        while (vertices.size() >= 2 && vertices.front() == vertices.back()) vertices.pop_back();

        magfit::EnginePolicy policy;
        const std::string mode = string_field(request, "sparseMode").value_or("ANY");
        if (mode == "ALL") policy.sparse.mode = magfit::PhaseMode::All;
        else if (mode == "FIXED") policy.sparse.mode = magfit::PhaseMode::Fixed;
        else if (mode == "DISABLED") policy.sparse.mode = magfit::PhaseMode::Disabled;
        else policy.sparse.mode = magfit::PhaseMode::Any;
        policy.sparse.min_active_nodes =
            static_cast<int>(number_field(request, "sparseMinActive").value_or(1.0L));
        policy.require_24mm_links = number_field(request, "requireLinks").value_or(1.0L) != 0.0L;
        policy.require_band_span = number_field(request, "requireBandSpan").value_or(1.0L) != 0.0L;

        std::vector<magfit::BandSpec> bands;
        for (int band : read_bands(request)) bands.push_back(magfit::default_band_spec(band, policy));

        const magfit::SolveResult solved =
            magfit::solve(magfit::PolygonInput{vertices}, bands, policy);

        std::ostringstream os;
        os << "{\"ok\":true,\"engine\":\"magfit-core/0.1.0\",\"vertexCount\":" << vertices.size()
           << ",\"bands\":[";
        for (std::size_t i = 0; i < solved.bands.size(); ++i) {
            const magfit::BandResult& band = solved.bands[i];
            if (i) os << ',';
            os << "{\"band\":" << band.band << ",\"fit\":" << (band.fit ? "true" : "false")
               << ",\"reason\":\"" << json_escape(band.reason) << '"';
            if (band.fit) {
                os << ",\"sizeMm\":" << band.manufactured_size_mm
                   << ",\"widthMm\":" << band.manufactured_width_mm
                   << ",\"heightMm\":" << band.manufactured_height_mm
                   << ",\"templateRunsX\":" << band.template_runs_x
                   << ",\"templateRunsY\":" << band.template_runs_y
                   << ",\"magnets\":";
                print_points(os, band.magnets, policy.half_pitch_mm);
                os << ",\"links\":[";
                for (std::size_t k = 0; k < band.verified_links.size(); ++k) {
                    if (k) os << ',';
                    const auto& [a, b] = band.verified_links[k];
                    os << "{\"ax\":" << a.x24 * policy.half_pitch_mm
                       << ",\"ay\":" << a.y24 * policy.half_pitch_mm
                       << ",\"bx\":" << b.x24 * policy.half_pitch_mm
                       << ",\"by\":" << b.y24 * policy.half_pitch_mm << '}';
                }
                os << ']';
                os << ",\"binding\":{\"kind\":\""
                   << (band.binding.kind == magfit::BindingContact::Kind::MagnetDisc
                           ? "MAGNET_DISC"
                           : "LINK_CAPSULE")
                   << "\",\"nodeXMm\":" << band.binding.node_a.x24 * policy.half_pitch_mm
                   << ",\"nodeYMm\":" << band.binding.node_a.y24 * policy.half_pitch_mm
                   << ",\"edgeIndex\":" << band.binding.polygon_edge_index
                   << ",\"clearanceMm\":" << band.binding.clearance_mm
                   << ",\"slackMm\":" << band.binding.slack_mm
                   << ",\"clearanceUm\":" << band.binding.clearance_um_floor << '}';
                os << ",\"flap\":{\"leftMm\":" << band.flap.left_mm
                   << ",\"rightMm\":" << band.flap.right_mm
                   << ",\"bottomMm\":" << band.flap.bottom_mm
                   << ",\"topMm\":" << band.flap.top_mm
                   << ",\"left12\":" << (band.flap.left_ge_12 ? "true" : "false")
                   << ",\"right12\":" << (band.flap.right_ge_12 ? "true" : "false")
                   << ",\"bottom12\":" << (band.flap.bottom_ge_12 ? "true" : "false")
                   << ",\"top12\":" << (band.flap.top_ge_12 ? "true" : "false")
                   << ",\"left24\":" << (band.flap.left_ge_24 ? "true" : "false")
                   << ",\"right24\":" << (band.flap.right_ge_24 ? "true" : "false")
                   << ",\"bottom24\":" << (band.flap.bottom_ge_24 ? "true" : "false")
                   << ",\"top24\":" << (band.flap.top_ge_24 ? "true" : "false") << '}';
                if (band.sparse_phase) {
                    os << ",\"sparse\":{\"xResidue\":" << band.sparse_phase->x_residue_mod4
                       << ",\"yResidue\":" << band.sparse_phase->y_residue_mod4
                       << ",\"connected\":" << (band.sparse_phase->connected ? "true" : "false")
                       << ",\"activeNodes\":";
                    print_points(os, band.sparse_phase->active_nodes, policy.half_pitch_mm);
                    os << '}';
                }
            }
            os << '}';
        }
        os << "]}";
        std::cout << os.str() << std::endl;
        return EXIT_SUCCESS;
    } catch (const std::exception& e) {
        std::cout << "{\"ok\":false,\"error\":\"" << json_escape(e.what()) << "\"}" << std::endl;
        return EXIT_SUCCESS;
    }
}
