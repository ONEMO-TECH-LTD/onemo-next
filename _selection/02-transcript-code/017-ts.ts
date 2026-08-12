interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function getBounds(vertices: readonly Point[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of vertices) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  return { minX, minY, maxX, maxY };
}

function scaleToManufacturedSize(
  source: Polygon,
  sizeMm: number,
): Polygon {
  const b = getBounds(source.vertices);

  const width = b.maxX - b.minX;
  const height = b.maxY - b.minY;

  const dimension = Math.max(width, height);

  if (!(dimension > 0)) {
    throw new Error("DEGENERATE_POLYGON");
  }

  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;

  const scale = sizeMm / dimension;

  return {
    vertices: source.vertices.map(p => ({
      x: (p.x - cx) * scale,
      y: (p.y - cy) * scale,
    })),
  };
}
