interface BandSpec {
  id: 1 | 2 | 3;
  sizesMm: readonly number[];
  publicLayouts: readonly LayoutId[];
}

const BANDS: readonly BandSpec[] = [
  {
    id: 1,
    sizesMm: [24, 36, 48, 60],
    publicLayouts: ["SINGLE"],
  },
  {
    id: 2,
    sizesMm: [72, 84, 96, 108],
    publicLayouts: [
      "FULL_2X2",
      "PAIR_H",
      "PAIR_V",
    ],
  },
  {
    id: 3,
    sizesMm: [120, 132, 144, 156],
    publicLayouts: [
      "FULL_3X3",
      // explicit approved fallbacks only
    ],
  },
];
