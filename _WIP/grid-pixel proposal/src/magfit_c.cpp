#include "magfit/magfit_c.h"

#include "magfit/magfit.hpp"

#include <algorithm>
#include <cstring>
#include <exception>
#include <limits>
#include <stdexcept>
#include <string>
#include <vector>

namespace {

constexpr const char* kEngineVersion = "magfit-core/0.3.0-grid-pixel-review";

void copy_text(char* destination, std::size_t capacity, const std::string& text) {
    if (destination == nullptr || capacity == 0) return;
    const std::size_t count = std::min(capacity - 1, text.size());
    std::memcpy(destination, text.data(), count);
    destination[count] = '\0';
}

magfit::PhaseMode phase_mode(MagfitPhaseModeC value) {
    switch (value) {
        case MAGFIT_PHASE_DISABLED: return magfit::PhaseMode::Disabled;
        case MAGFIT_PHASE_ANY: return magfit::PhaseMode::Any;
        case MAGFIT_PHASE_ALL: return magfit::PhaseMode::All;
        case MAGFIT_PHASE_FIXED: return magfit::PhaseMode::Fixed;
    }
    throw std::invalid_argument("unknown sparse phase mode");
}

magfit::EnginePolicy to_cpp_policy(const MagfitPolicyC& value) {
    magfit::EnginePolicy out;
    out.dense_pitch_mm = value.dense_pitch_mm;
    out.half_pitch_mm = value.half_pitch_mm;
    out.disc_radius_mm = value.disc_radius_mm;
    out.size_step_mm = value.size_step_mm;
    out.max_field_positions = value.max_field_positions;
    out.max_trace_span_units = value.max_trace_span_units;
    out.require_band_span = value.require_band_span != 0;
    out.sparse.mode = phase_mode(value.sparse_mode);
    out.sparse.engage_from_band = value.sparse_engage_from_band;
    out.sparse.min_active_nodes = value.sparse_min_active_nodes;
    out.sparse.require_96mm_connected = value.sparse_require_96mm_connected != 0;
    out.sparse.fixed_x_residue_mod4 = value.sparse_fixed_x_residue_mod4;
    out.sparse.fixed_y_residue_mod4 = value.sparse_fixed_y_residue_mod4;
    return out;
}

MagfitGridPointC to_c_point(const magfit::GridPoint& p) {
    return {p.x24, p.y24};
}

void copy_side_flap(const magfit::SideFlapEvidence& source,
                    MagfitSideFlapEvidenceC& out) {
    out = {};
    out.extent_reaches_12 = source.extent_reaches_12;
    out.extent_reaches_24 = source.extent_reaches_24;
    out.sampled_tongue_any_12 = source.sampled_tongue_any_12;
    out.sampled_tongue_all_12 = source.sampled_tongue_all_12;
    out.sampled_tongue_any_24 = source.sampled_tongue_any_24;
    out.sampled_tongue_all_24 = source.sampled_tongue_all_24;
    out.narrow_limb_exception_12 = source.narrow_limb_exception_12;
    out.narrow_limb_exception_24 = source.narrow_limb_exception_24;
    if (source.failing_side_points_12.size() > MAGFIT_MAX_NODES ||
        source.failing_side_points_24.size() > MAGFIT_MAX_NODES) {
        throw std::runtime_error("internal error: flap result exceeds C ABI capacity");
    }
    out.failing_side_count_12 =
        static_cast<uint32_t>(source.failing_side_points_12.size());
    for (std::size_t i = 0; i < source.failing_side_points_12.size(); ++i) {
        out.failing_side_points_12[i] = to_c_point(source.failing_side_points_12[i]);
    }
    out.failing_side_count_24 =
        static_cast<uint32_t>(source.failing_side_points_24.size());
    for (std::size_t i = 0; i < source.failing_side_points_24.size(); ++i) {
        out.failing_side_points_24[i] = to_c_point(source.failing_side_points_24[i]);
    }
}

void copy_option(const magfit::LayoutOption& source, MagfitLayoutOptionC& out) {
    out = {};
    out.band = source.band;
    switch (source.layout_kind) {
        case magfit::LayoutKind::Full: out.layout_kind = MAGFIT_LAYOUT_FULL; break;
        case magfit::LayoutKind::Connected:
            out.layout_kind = MAGFIT_LAYOUT_CONNECTED;
            break;
        case magfit::LayoutKind::LinkedThree:
            out.layout_kind = MAGFIT_LAYOUT_LINKED_THREE;
            break;
        case magfit::LayoutKind::Pair: out.layout_kind = MAGFIT_LAYOUT_PAIR; break;
    }
    out.manufactured_size_mm = source.manufactured_size_mm;
    out.manufactured_width_num = source.manufactured_width_num;
    out.manufactured_height_num = source.manufactured_height_num;
    out.manufactured_dimension_den = source.manufactured_dimension_den;
    out.manufactured_width_mm = source.manufactured_width_mm;
    out.manufactured_height_mm = source.manufactured_height_mm;
    if (source.source_windows.size() > MAGFIT_MAX_NODES) {
        throw std::runtime_error("internal error: source-window result exceeds C ABI capacity");
    }
    out.source_window_count = static_cast<uint32_t>(source.source_windows.size());
    for (std::size_t i = 0; i < source.source_windows.size(); ++i) {
        out.source_windows[i] = {source.source_windows[i].runs_x,
                                 source.source_windows[i].runs_y};
    }

    if (source.magnets.size() > MAGFIT_MAX_NODES) {
        throw std::runtime_error("internal error: magnet result exceeds C ABI capacity");
    }
    out.magnet_count = static_cast<uint32_t>(source.magnets.size());
    for (std::size_t i = 0; i < source.magnets.size(); ++i) {
        out.magnets[i] = to_c_point(source.magnets[i]);
    }

    if (source.verified_links.size() > MAGFIT_MAX_LINKS) {
        throw std::runtime_error("internal error: link result exceeds C ABI capacity");
    }
    out.verified_link_count = static_cast<uint32_t>(source.verified_links.size());
    for (std::size_t i = 0; i < source.verified_links.size(); ++i) {
        out.verified_links[i] = {
            to_c_point(source.verified_links[i].first),
            to_c_point(source.verified_links[i].second),
        };
    }

    if (source.sparse_phases.size() > 4) {
        throw std::runtime_error("internal error: sparse phase count exceeds C ABI capacity");
    }
    out.sparse_phase_count = static_cast<uint32_t>(source.sparse_phases.size());
    for (std::size_t phase_index = 0;
         phase_index < source.sparse_phases.size(); ++phase_index) {
        const auto& phase = source.sparse_phases[phase_index];
        if (phase.active_nodes.size() > MAGFIT_MAX_NODES) {
            throw std::runtime_error("internal error: sparse result exceeds C ABI capacity");
        }
        out.sparse_x_residue_mod4[phase_index] = phase.x_residue_mod4;
        out.sparse_y_residue_mod4[phase_index] = phase.y_residue_mod4;
        out.sparse_connected[phase_index] = phase.connected ? 1 : 0;
        out.sparse_active_count[phase_index] =
            static_cast<uint32_t>(phase.active_nodes.size());
        for (std::size_t i = 0; i < phase.active_nodes.size(); ++i) {
            out.sparse_active_nodes[phase_index][i] = to_c_point(phase.active_nodes[i]);
        }
    }

    out.binding.kind = source.binding.kind == magfit::BindingContact::Kind::MagnetDisc
                           ? MAGFIT_BINDING_MAGNET_DISC
                           : MAGFIT_BINDING_DIRECT_CAPSULE;
    out.binding.node_a = to_c_point(source.binding.node_a);
    out.binding.node_b_present = source.binding.node_b.has_value() ? 1 : 0;
    if (source.binding.node_b) out.binding.node_b = to_c_point(*source.binding.node_b);
    out.binding.polygon_edge_index = static_cast<uint32_t>(source.binding.polygon_edge_index);
    out.binding.clearance_mm = source.binding.clearance_mm;
    out.binding.slack_mm = source.binding.slack_mm;
    out.binding.clearance_um_floor = source.binding.clearance_um_floor;
    out.binding.slack_um_floor = source.binding.slack_um_floor;

    out.flap.exact_den = source.flap.exact_den;
    out.flap.left_num = source.flap.left_num;
    out.flap.right_num = source.flap.right_num;
    out.flap.bottom_num = source.flap.bottom_num;
    out.flap.top_num = source.flap.top_num;
    out.flap.left_mm = source.flap.left_mm;
    out.flap.right_mm = source.flap.right_mm;
    out.flap.bottom_mm = source.flap.bottom_mm;
    out.flap.top_mm = source.flap.top_mm;
    out.flap.horizontal_imbalance_mm = source.flap.horizontal_imbalance_mm;
    out.flap.vertical_imbalance_mm = source.flap.vertical_imbalance_mm;
    out.flap.coverage_within_12 = source.flap.coverage_within_12;
    out.flap.coverage_within_24 = source.flap.coverage_within_24;
    copy_side_flap(source.flap.left, out.flap_left);
    copy_side_flap(source.flap.right, out.flap_right);
    copy_side_flap(source.flap.bottom, out.flap_bottom);
    copy_side_flap(source.flap.top, out.flap_top);
}

}  // namespace

extern "C" const char* magfit_engine_version(void) {
    return kEngineVersion;
}

extern "C" void magfit_default_policy(MagfitPolicyC* out_policy) {
    if (out_policy == nullptr) return;
    const magfit::EnginePolicy source;
    *out_policy = {};
    out_policy->dense_pitch_mm = source.dense_pitch_mm;
    out_policy->half_pitch_mm = source.half_pitch_mm;
    out_policy->disc_radius_mm = source.disc_radius_mm;
    out_policy->size_step_mm = source.size_step_mm;
    out_policy->max_field_positions = source.max_field_positions;
    out_policy->max_trace_span_units = source.max_trace_span_units;
    out_policy->require_band_span = source.require_band_span;
    switch (source.sparse.mode) {
        case magfit::PhaseMode::Disabled: out_policy->sparse_mode = MAGFIT_PHASE_DISABLED; break;
        case magfit::PhaseMode::Any: out_policy->sparse_mode = MAGFIT_PHASE_ANY; break;
        case magfit::PhaseMode::All: out_policy->sparse_mode = MAGFIT_PHASE_ALL; break;
        case magfit::PhaseMode::Fixed: out_policy->sparse_mode = MAGFIT_PHASE_FIXED; break;
    }
    out_policy->sparse_engage_from_band = source.sparse.engage_from_band;
    out_policy->sparse_min_active_nodes = source.sparse.min_active_nodes;
    out_policy->sparse_require_96mm_connected = source.sparse.require_96mm_connected;
    out_policy->sparse_fixed_x_residue_mod4 = source.sparse.fixed_x_residue_mod4;
    out_policy->sparse_fixed_y_residue_mod4 = source.sparse.fixed_y_residue_mod4;
}

extern "C" MagfitStatusC magfit_review_bands_i32(
    const int32_t* xy,
    size_t vertex_count,
    const int32_t* bands,
    size_t band_count,
    const MagfitPolicyC* policy,
    MagfitOptionVisitorC visitor,
    void* user_data,
    size_t* out_option_count,
    char* error_message,
    size_t error_message_capacity) {
    if (error_message != nullptr && error_message_capacity > 0) error_message[0] = '\0';
    if (out_option_count != nullptr) *out_option_count = 0;

    try {
        if (xy == nullptr) throw std::invalid_argument("xy must not be null");
        if (vertex_count < 3) throw std::invalid_argument("vertex_count must be at least three");
        if (vertex_count > std::numeric_limits<std::size_t>::max() / 2) {
            throw std::invalid_argument("vertex_count is too large");
        }
        if (bands == nullptr) throw std::invalid_argument("bands must not be null");
        if (band_count == 0) throw std::invalid_argument("band_count must be positive");
        if (visitor == nullptr) throw std::invalid_argument("visitor must not be null");
        if (out_option_count == nullptr) {
            throw std::invalid_argument("out_option_count must not be null");
        }

        magfit::EnginePolicy cpp_policy;
        if (policy != nullptr) cpp_policy = to_cpp_policy(*policy);

        magfit::PolygonInput polygon;
        polygon.vertices.reserve(vertex_count);
        for (std::size_t i = 0; i < vertex_count; ++i) {
            polygon.vertices.push_back({xy[2 * i], xy[2 * i + 1]});
        }

        std::vector<magfit::BandSpec> specs;
        specs.reserve(band_count);
        for (std::size_t i = 0; i < band_count; ++i) {
            specs.push_back(magfit::default_band_spec(bands[i], cpp_policy));
        }
        const magfit::SolveResult solved = magfit::solve(polygon, specs, cpp_policy);
        for (const auto& reviewed_band : solved.bands) {
            for (const auto& option : reviewed_band.options) {
                MagfitLayoutOptionC c_option{};
                copy_option(option, c_option);
                if (visitor(&c_option, user_data) == 0) {
                    throw std::invalid_argument("option visitor stopped enumeration");
                }
                ++*out_option_count;
            }
        }
        return MAGFIT_STATUS_OK;
    } catch (const std::invalid_argument& e) {
        copy_text(error_message, error_message_capacity, e.what());
        return MAGFIT_STATUS_INVALID_ARGUMENT;
    } catch (const std::exception& e) {
        copy_text(error_message, error_message_capacity, e.what());
        return MAGFIT_STATUS_INTERNAL_ERROR;
    } catch (...) {
        copy_text(error_message, error_message_capacity, "unknown internal error");
        return MAGFIT_STATUS_INTERNAL_ERROR;
    }
}

extern "C" MagfitStatusC magfit_review_band_i32(
    const int32_t* xy,
    size_t vertex_count,
    int32_t band,
    const int32_t* legal_sizes_mm,
    size_t legal_size_count,
    int32_t min_nodes,
    const MagfitPolicyC* policy,
    MagfitOptionVisitorC visitor,
    void* user_data,
    size_t* out_option_count,
    char* error_message,
    size_t error_message_capacity) {
    if (error_message != nullptr && error_message_capacity > 0) error_message[0] = '\0';
    if (out_option_count != nullptr) *out_option_count = 0;

    try {
        if (xy == nullptr) throw std::invalid_argument("xy must not be null");
        if (vertex_count < 3) throw std::invalid_argument("vertex_count must be at least three");
        if (vertex_count > std::numeric_limits<std::size_t>::max() / 2) {
            throw std::invalid_argument("vertex_count is too large");
        }
        if (visitor == nullptr) throw std::invalid_argument("visitor must not be null");
        if (out_option_count == nullptr) {
            throw std::invalid_argument("out_option_count must not be null");
        }
        if (legal_size_count > 0 && legal_sizes_mm == nullptr) {
            throw std::invalid_argument("legal_sizes_mm is null but legal_size_count is non-zero");
        }

        MagfitPolicyC default_policy{};
        if (policy == nullptr) {
            magfit_default_policy(&default_policy);
            policy = &default_policy;
        }
        const magfit::EnginePolicy cpp_policy = to_cpp_policy(*policy);

        magfit::PolygonInput polygon;
        polygon.vertices.reserve(vertex_count);
        for (std::size_t i = 0; i < vertex_count; ++i) {
            polygon.vertices.push_back({xy[2 * i], xy[2 * i + 1]});
        }

        magfit::BandSpec spec;
        if (legal_size_count == 0) {
            spec = magfit::default_band_spec(band, cpp_policy);
        } else {
            spec.band = band;
            spec.legal_sizes_mm.assign(legal_sizes_mm, legal_sizes_mm + legal_size_count);
            spec.min_nodes = band == 1 ? 1 : 2;
        }
        if (min_nodes > 0) spec.min_nodes = min_nodes;

        const magfit::SolveResult solved = magfit::solve(polygon, {spec}, cpp_policy);
        for (const auto& option : solved.bands.front().options) {
            MagfitLayoutOptionC c_option{};
            copy_option(option, c_option);
            if (visitor(&c_option, user_data) == 0) {
                throw std::invalid_argument("option visitor stopped enumeration");
            }
            ++*out_option_count;
        }
        return MAGFIT_STATUS_OK;
    } catch (const std::invalid_argument& e) {
        copy_text(error_message, error_message_capacity, e.what());
        return MAGFIT_STATUS_INVALID_ARGUMENT;
    } catch (const std::exception& e) {
        copy_text(error_message, error_message_capacity, e.what());
        return MAGFIT_STATUS_INTERNAL_ERROR;
    } catch (...) {
        copy_text(error_message, error_message_capacity, "unknown internal error");
        return MAGFIT_STATUS_INTERNAL_ERROR;
    }
}
