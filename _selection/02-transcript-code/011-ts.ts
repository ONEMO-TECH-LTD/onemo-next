const PITCH = 48;
const HALF = 24;

const LAYOUTS = {
  SINGLE: [
    [0, 0],
  ],

  PAIR_H: [
    [-HALF, 0],
    [+HALF, 0],
  ],

  PAIR_V: [
    [0, -HALF],
    [0, +HALF],
  ],

  FULL_2X2: [
    [-HALF, -HALF],
    [+HALF, -HALF],
    [-HALF, +HALF],
    [+HALF, +HALF],
  ],
} as const;
