// The only bridge between the caller and the pure kernel. It converts and prints; it decides
// nothing. The caller supplies EVERYTHING: outline, law values (pitch, radius), and per-job
// positions — the kernel generates no lattice of its own.
//
// Request:
//   {"vertices":[[x,y],...], "scale":20000, "pitchMm":48, "radiusMm":12,
//    "jobs":[{"band":3,"sizeMm":132,"runsX":3,"runsY":2,"positions":[[xMm,yMm],...]}, ...]}
// Response: {"ok":true,"vertexCount":N,"sizes":[ ...one entry per job, every position reported... ]}

#include "magfit/magfit.hpp"

#include <cmath>
#include <cstdlib>
#include <iostream>
#include <optional>
#include <sstream>
#include <string>
#include <vector>

namespace {

std::optional<double> number_field(const std::string& text, const std::string& key, std::size_t from = 0) {
    const std::string needle = "\"" + key + "\"";
    const std::size_t at = text.find(needle, from);
    if (at == std::string::npos) return std::nullopt;
    std::size_t i = text.find(':', at + needle.size());
    if (i == std::string::npos) return std::nullopt;
    ++i;
    while (i < text.size() && (text[i] == ' ' || text[i] == '\n' || text[i] == '\t')) ++i;
    std::size_t end = i;
    while (end < text.size() && (std::isdigit(static_cast<unsigned char>(text[end])) ||
                                 text[end] == '-' || text[end] == '+' || text[end] == '.' ||
                                 text[end] == 'e' || text[end] == 'E')) ++end;
    if (end == i) return std::nullopt;
    return std::stod(text.substr(i, end - i));
}

/** The [[a,b],...] array that follows "<key>": at/after `from`. Returns [start,end] indices. */
std::optional<std::pair<std::size_t, std::size_t>> array_span(const std::string& text,
                                                              const std::string& key,
                                                              std::size_t from = 0) {
    const std::size_t at = text.find("\"" + key + "\"", from);
    if (at == std::string::npos) return std::nullopt;
    const std::size_t open = text.find('[', at);
    if (open == std::string::npos) return std::nullopt;
    int depth = 0;
    for (std::size_t j = open; j < text.size(); ++j) {
        if (text[j] == '[') ++depth;
        else if (text[j] == ']' && --depth == 0) return std::make_pair(open, j);
    }
    return std::nullopt;
}

std::vector<std::pair<double, double>> read_pairs(const std::string& body) {
    std::vector<std::pair<double, double>> out;
    std::size_t p = 0;
    while (true) {
        const std::size_t ps = body.find('[', p + 1);
        if (ps == std::string::npos) break;
        const std::size_t pe = body.find(']', ps);
        if (pe == std::string::npos) break;
        const std::string pair = body.substr(ps + 1, pe - ps - 1);
        const std::size_t comma = pair.find(',');
        if (comma != std::string::npos) {
            out.push_back({std::stod(pair.substr(0, comma)), std::stod(pair.substr(comma + 1))});
        }
        p = pe;
    }
    return out;
}

}  // namespace

/** The whole measurement as a function: JSON request in, JSON measurement out. */
std::string measure_to_json(const std::string& t) {
    try {
        const double scale = number_field(t, "scale").value_or(20000.0);
        magfit::EnginePolicy policy;
        policy.dense_pitch_mm = static_cast<int>(number_field(t, "pitchMm").value_or(48.0));
        policy.half_pitch_mm = policy.dense_pitch_mm / 2;
        policy.disc_radius_mm = static_cast<int>(number_field(t, "radiusMm").value_or(12.0));

        const auto vspan = array_span(t, "vertices");
        if (!vspan) throw std::invalid_argument("request has no vertices");
        std::vector<magfit::PointI> vertices;
        for (const auto& [x, y] : read_pairs(t.substr(vspan->first, vspan->second - vspan->first + 1))) {
            const magfit::PointI q{static_cast<magfit::i64>(std::llround(x * scale)),
                                   static_cast<magfit::i64>(std::llround(y * scale))};
            if (vertices.empty() || !(vertices.back() == q)) vertices.push_back(q);
        }
        while (vertices.size() >= 2 && vertices.front() == vertices.back()) vertices.pop_back();

        std::vector<magfit::MeasureJob> jobs;
        const auto jspan = array_span(t, "jobs");
        if (!jspan) throw std::invalid_argument("request has no jobs");
        std::size_t cursor = jspan->first + 1;
        while (cursor < jspan->second) {
            const std::size_t obj = t.find('{', cursor);
            if (obj == std::string::npos || obj > jspan->second) break;
            magfit::MeasureJob job;
            job.band = static_cast<int>(number_field(t, "band", obj).value_or(0));
            job.size_mm = static_cast<int>(number_field(t, "sizeMm", obj).value_or(0));
            job.runs_x = static_cast<int>(number_field(t, "runsX", obj).value_or(0));
            job.runs_y = static_cast<int>(number_field(t, "runsY", obj).value_or(0));
            const auto pspan = array_span(t, "positions", obj);
            if (!pspan) throw std::invalid_argument("job has no positions");
            for (const auto& [x, y] : read_pairs(t.substr(pspan->first, pspan->second - pspan->first + 1))) {
                job.positions_mm.push_back({static_cast<int>(std::llround(x)),
                                            static_cast<int>(std::llround(y))});
            }
            jobs.push_back(std::move(job));
            cursor = pspan->second + 1;
        }

        const auto polygon = magfit::canonicalize_and_validate(magfit::PolygonInput{vertices}, policy);
        const auto measured = magfit::measure_jobs(polygon, jobs, policy);

        std::ostringstream o;
        o << "{\"ok\":true,\"vertexCount\":" << vertices.size() << ",\"sizes\":[";
        bool first = true;
        for (const auto& m : measured) {
            if (!first) o << ','; first = false;
            o << "{\"band\":" << m.band << ",\"sizeMm\":" << m.size_mm
              << ",\"runsX\":" << m.runs_x << ",\"runsY\":" << m.runs_y
              << ",\"widthMm\":" << m.width_mm << ",\"heightMm\":" << m.height_mm
              << ",\"heldCount\":" << m.supported_count << ",\"nodes\":[";
            bool f2 = true;
            for (const auto& n : m.nodes) {
                if (!f2) o << ','; f2 = false;
                o << "{\"xMm\":" << n.x_mm << ",\"yMm\":" << n.y_mm
                  << ",\"held\":" << (n.supported ? "true" : "false")
                  << ",\"clearanceMm\":" << n.clearance_mm << '}';
            }
            o << "],\"links\":[";
            bool f3 = true;
            for (const auto& l : m.links) {
                if (!f3) o << ','; f3 = false;
                o << "{\"axMm\":" << l.ax_mm << ",\"ayMm\":" << l.ay_mm
                  << ",\"bxMm\":" << l.bx_mm << ",\"byMm\":" << l.by_mm
                  << ",\"direct\":" << (l.direct ? "true" : "false") << '}';
            }
            o << ']';
            if (m.has_overhang) {
                o << ",\"overhangMm\":{\"left\":" << m.overhang_left_mm
                  << ",\"right\":" << m.overhang_right_mm
                  << ",\"bottom\":" << m.overhang_bottom_mm
                  << ",\"top\":" << m.overhang_top_mm << '}';
            }
            o << '}';
        }
        o << "]}";
        return o.str();
    } catch (const std::exception& e) {
        std::ostringstream err;
        err << "{\"ok\":false,\"error\":\"" << e.what() << "\"}";
        return err.str();
    }
}

#ifndef MEASURE_CLI_NO_MAIN
int main() {
    std::ostringstream in;
    in << std::cin.rdbuf();
    std::cout << measure_to_json(in.str()) << std::endl;
}
#endif
