interface MagFitOutput {
  engineVersion: "magfit-1";

  sourceShapeHash: string;

  bands: {
    2: BandFit | null;
    3: BandFit | null;
  };
}

interface BandFit {
  band: 2 | 3;

  sizeMm: number;

  shape: {
    widthMm: number;
    heightMm: number;

    scale: number;

    centre: {
      xMm: 0;
      yMm: 0;
    };
  };

  layout: {
    id: LayoutId;

    magnets: {
      xMm: number;
      yMm: number;
      clearanceMm: number;
      limitingEdgeIndex: number;
    }[];
  };

  binding: {
    magnetIndex: number;
    edgeIndex: number;
    clearanceMm: number;
  };

  flap: {
    leftMm: number;
    rightMm: number;
    topMm: number;
    bottomMm: number;

    passes12: {
      left: boolean;
      right: boolean;
      top: boolean;
      bottom: boolean;
    };

    passes24: {
      left: boolean;
      right: boolean;
      top: boolean;
      bottom: boolean;
    };

    imbalanceMm: {
      horizontal: number;
      vertical: number;
    };
  };
}
