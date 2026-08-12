#include "magfit/magfit.hpp"

#include <chrono>
#include <cmath>
#include <cstdint>
#include <iostream>
#include <vector>

std::vector<magfit::PointI> circle(int count, std::int64_t radius) {
    std::vector<magfit::PointI> vertices;
    vertices.reserve(count);
    for (int i = 0; i < count; ++i) {
        const long double angle = 2.0L * std::acos(-1.0L) * i / count;
        vertices.push_back({
            static_cast<std::int64_t>(std::llround(radius * std::cos(angle))),
            static_cast<std::int64_t>(std::llround(radius * std::sin(angle))),
        });
    }
    return vertices;
}

int main() {
    constexpr int kVertices = 1000;
    constexpr std::int64_t kRadius = 30000;
    const std::vector<magfit::PointI> vertices = circle(kVertices, kRadius);

    magfit::EnginePolicy policy;
    policy.sparse.mode = magfit::PhaseMode::Any;
    const magfit::PolygonInput input{vertices};
    const auto polygon = magfit::canonicalize_and_validate(input, policy);
    const std::vector<magfit::BandSpec> bands{
        magfit::default_band_spec(2, policy),
        magfit::default_band_spec(3, policy),
    };

    constexpr int kWarmup = 25;
    for (int i = 0; i < kWarmup; ++i) {
        volatile auto result = magfit::solve_canonical(polygon, bands, policy);
        (void)result;
    }

    constexpr int kHotIterations = 1000;
    auto start = std::chrono::steady_clock::now();
    std::size_t hot_checksum = 0;
    for (int i = 0; i < kHotIterations; ++i) {
        const auto result = magfit::solve_canonical(polygon, bands, policy);
        hot_checksum += result.bands[0].magnets.size() + result.bands[1].magnets.size();
    }
    auto end = std::chrono::steady_clock::now();
    const auto hot_us = std::chrono::duration_cast<std::chrono::microseconds>(end - start).count();

    constexpr int kColdIterations = 100;
    start = std::chrono::steady_clock::now();
    std::size_t cold_checksum = 0;
    for (int i = 0; i < kColdIterations; ++i) {
        const auto result = magfit::solve(input, bands, policy);
        cold_checksum += result.bands[0].magnets.size() + result.bands[1].magnets.size();
    }
    end = std::chrono::steady_clock::now();
    const auto cold_us = std::chrono::duration_cast<std::chrono::microseconds>(end - start).count();

    const magfit::PolygonInput heavy_input{circle(8100, kRadius)};
    start = std::chrono::steady_clock::now();
    const auto heavy_polygon = magfit::canonicalize_and_validate(heavy_input, policy);
    end = std::chrono::steady_clock::now();
    const auto prepare_8100_us =
        std::chrono::duration_cast<std::chrono::microseconds>(end - start).count();

    std::cout << "vertices=" << kVertices
              << " hot_iterations=" << kHotIterations
              << " hot_mean_us=" << static_cast<double>(hot_us) / kHotIterations
              << " cold_iterations=" << kColdIterations
              << " cold_mean_us=" << static_cast<double>(cold_us) / kColdIterations
              << " prepare_8100_us=" << prepare_8100_us
              << " canonical_8100_vertices=" << heavy_polygon.vertices.size()
              << " checksum=" << (hot_checksum + cold_checksum) << '\n';
}
