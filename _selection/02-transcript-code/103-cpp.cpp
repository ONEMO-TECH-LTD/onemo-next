bool capsule_supported(
    const P128& a,
    const P128& b,
    const ScaledPolygon& polygon,
    const EnginePolicy& policy)
{
    if (locate_point(a, polygon.vertices) == PointLocation::Outside ||
        locate_point(b, polygon.vertices) == PointLocation::Outside) {
        return false;
    }

    const i128 radius =
        static_cast<i128>(policy.disc_radius_mm) *
        polygon.coordinate_denominator;

    for (each polygon edge [c,d]) {
        if (segment_segment_distance(a, b, c, d) < radius) {
            return false;
        }
    }
    return true;
}
