export interface MagneticFit {
  band2: BandResult;
  band3: BandResult;
}

export function computeMagneticFit(
  rawPolygon: Polygon,
): MagneticFit {
  const polygon =
    canonicaliseAndValidate(rawPolygon);

  return {
    band2: solveBand(
      polygon,
      getBand(2),
    ),

    band3: solveBand(
      polygon,
      getBand(3),
    ),
  };
}
