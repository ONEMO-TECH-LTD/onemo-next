const BAND_2_TEMPLATES = [
  {
    id: "PAIR_H",
    envelopeWidthMm: 72,
    envelopeHeightMm: 24,
    magnets: [
      [-24, 0],
      [24, 0],
    ],
  },

  {
    id: "PAIR_V",
    envelopeWidthMm: 24,
    envelopeHeightMm: 72,
    magnets: [
      [0, -24],
      [0, 24],
    ],
  },

  {
    id: "SQUARE_2X2",
    envelopeWidthMm: 72,
    envelopeHeightMm: 72,
    magnets: [
      [-24, -24],
      [24, -24],
      [-24, 24],
      [24, 24],
    ],
  },
];
