function evaluateMagnet(
  polygon: Polygon,
  magnet: Point,
): MagnetResult | null {
  if (!pointInClosedPolygon(magnet, polygon)) {
    return null;
  }

  let minimumD2 = Infinity;
  let bindingEdge = -1;

  const v = polygon.vertices;

  for (let i = 0; i < v.length; i++) {
    const a = v[i];
    const b = v[(i + 1) % v.length];

    const d2 = squaredDistancePointToSegment(
      magnet.x,
      magnet.y,
      a.x,
      a.y,
      b.x,
      b.y,
    );

    if (d2 < minimumD2) {
      minimumD2 = d2;
      bindingEdge = i;
    }
  }

  if (minimumD2 < 12 * 12) {
    return null;
  }

  return {
    gridX: 0,
    gridY: 0,
    xMm: magnet.x,
    yMm: magnet.y,
    clearanceMm: Math.sqrt(minimumD2),
    bindingEdge,
  };
}
