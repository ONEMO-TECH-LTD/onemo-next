// The only bridge between the browser and the pure engine. It converts and prints; it decides
// nothing. stdin: {"vertices":[[x,y],...],"bands":[1,2,3,4],"scale":20000}
// stdout: every legal size, every lattice position, supported flag and exact clearance.
#include "magfit/magfit.hpp"
#include <cmath>
#include <iostream>
#include <sstream>
#include <vector>
int main() {
    std::ostringstream in; in << std::cin.rdbuf(); const std::string t = in.str();
    try {
        double scale = 20000.0;
        if (auto k = t.find("\"scale\""); k != std::string::npos)
            scale = std::stod(t.substr(t.find(':', k) + 1));
        std::vector<int> bands;
        if (auto k = t.find("\"bands\""); k != std::string::npos) {
            const auto o = t.find('[', k), c = t.find(']', o);
            std::stringstream b(t.substr(o + 1, c - o - 1)); std::string tok;
            while (std::getline(b, tok, ',')) bands.push_back(std::stoi(tok));
        }
        if (bands.empty()) bands = {1, 2, 3, 4};
        const auto vk = t.find("\"vertices\""); const auto vs = t.find('[', vk);
        int d = 0; std::size_t j = vs;
        for (; j < t.size(); ++j) { if (t[j] == '[') ++d; else if (t[j] == ']' && --d == 0) break; }
        const std::string body = t.substr(vs, j - vs + 1);
        std::vector<magfit::PointI> v; std::size_t p = 0;
        while (true) {
            const auto ps = body.find('[', p + 1); if (ps == std::string::npos) break;
            const auto pe = body.find(']', ps); const std::string pr = body.substr(ps + 1, pe - ps - 1);
            const auto comma = pr.find(',');
            magfit::PointI q{static_cast<long long>(std::llround(std::stod(pr.substr(0, comma)) * scale)),
                             static_cast<long long>(std::llround(std::stod(pr.substr(comma + 1)) * scale))};
            if (v.empty() || !(v.back() == q)) v.push_back(q);
            p = pe;
        }
        while (v.size() >= 2 && v.front() == v.back()) v.pop_back();
        magfit::EnginePolicy pol;
        std::vector<magfit::BandSpec> specs;
        for (int b : bands) specs.push_back(magfit::default_band_spec(b, pol));
        std::ostringstream o;
        o << "{\"ok\":true,\"vertexCount\":" << v.size() << ",\"sizes\":[";
        bool first = true;
        for (const auto& m : magfit::measure_all(magfit::PolygonInput{v}, specs, pol)) {
            if (!first) o << ','; first = false;
            o << "{\"band\":" << m.band << ",\"sizeMm\":" << m.size_mm
              << ",\"widthMm\":" << m.width_mm << ",\"heightMm\":" << m.height_mm
              << ",\"heldCount\":" << m.supported_count << ",\"nodes\":[";
            bool f2 = true;
            for (const auto& n : m.nodes) {
                if (!f2) o << ','; f2 = false;
                o << "{\"xMm\":" << n.x_mm << ",\"yMm\":" << n.y_mm
                  << ",\"held\":" << (n.supported ? "true" : "false")
                  << ",\"clearanceMm\":" << n.clearance_mm << '}';
            }
            o << "]}";
        }
        o << "]}";
        std::cout << o.str() << std::endl;
    } catch (const std::exception& e) {
        std::cout << "{\"ok\":false,\"error\":\"" << e.what() << "\"}" << std::endl;
    }
}
