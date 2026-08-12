function solveBand(
  source: Polygon,
  band: BandSpec,
): BandFit | null {
  for (const tier of band.layoutTiers) {
    const results = tier.templates
      .map(template =>
        solveTemplate(source, band, template),
      )
      .filter(isNotNull);

    if (results.length === 0) {
      continue;
    }

    return chooseDeterministically(results);
  }

  return null;
}
