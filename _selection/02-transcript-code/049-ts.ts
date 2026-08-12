interface ShapeGeometry {
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
    centreX: number;
    centreY: number;
  };

  aspect: {
    widthOverHeight: number;
    normalizedWidth: number;
    normalizedHeight: number;
  };

  innerBounds: Bounds | null;

  extremeNodes: readonly Point[];

  polygon: readonly Point[];
}
