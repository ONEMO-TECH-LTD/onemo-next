type Int = number;

export interface Point {
  x: Int;
  y: Int;
}

export interface Polygon {
  vertices: readonly Point[];
}

export type BandId = 1 | 2 | 3;

export type LayoutId =
  | "SINGLE"
  | "PAIR_H"
  | "PAIR_V"
  | "FULL_2X2"
  | "ELBOW_NE"
  | "ELBOW_NW"
  | "ELBOW_SE"
  | "ELBOW_SW"
  | "FULL_3X3";

export interface MagnetResult {
  gridX: number;
  gridY: number;

  xMm: number;
  yMm: number;

  clearanceMm: number;

  bindingEdge: number;
}

export interface FitResult {
  band: BandId;
  sizeMm: number;

  layout: LayoutId;

  magnets: readonly MagnetResult[];

  minimumClearanceMm: number;

  bindingMagnetIndex: number;
  bindingEdgeIndex: number;

  shapeWidthMm: number;
  shapeHeightMm: number;

  flap: {
    leftMm: number;
    rightMm: number;
    topMm: number;
    bottomMm: number;
  };
}
