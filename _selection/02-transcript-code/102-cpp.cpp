bool distance_ge_radius(const DistanceSquared& d, i128 radius) {
    return d.num >= radius * radius * d.den;
}
