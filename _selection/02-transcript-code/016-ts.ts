function testLayout(
  polygon: Polygon,
  layout: readonly (readonly [number, number])[],
): MagnetResult[] | null {
  const magnets: MagnetResult[] = [];

  for (const [x, y] of layout) {
    const result = evaluateMagnet(polygon, { x, y });

    if (!result) {
      return null;
    }

    magnets.push(result);
  }

  return magnets;
}
