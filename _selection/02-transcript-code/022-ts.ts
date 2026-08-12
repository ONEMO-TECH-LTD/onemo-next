function magnetFootprintBounds(
  magnets: readonly MagnetResult[],
): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const m of magnets) {
    minX = Math.min(minX, m.xMm - 12);
    minY = Math.min(minY, m.yMm - 12);
    maxX = Math.max(maxX, m.xMm + 12);
    maxY = Math.max(maxY, m.yMm + 12);
  }

  return { minX, minY, maxX, maxY };
}
