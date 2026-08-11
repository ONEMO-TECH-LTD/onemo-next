import assert from "node:assert/strict";

const EPS = 1e-8;

function aabbCenter(points) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
  ];
}

// Uniform-area polygon centroid via the signed shoelace moments.
function areaCentroid(points) {
  let twiceArea = 0;
  let xMoment = 0;
  let yMoment = 0;
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    const cross = x0 * y1 - x1 * y0;
    twiceArea += cross;
    xMoment += (x0 + x1) * cross;
    yMoment += (y0 + y1) * cross;
  }
  if (Math.abs(twiceArea) < EPS)
    throw new RangeError("Polygon area must be non-zero.");
  return [xMoment / (3 * twiceArea), yMoment / (3 * twiceArea)];
}

function pointInPolygon([x, y], polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

function pointSegmentDistance(point, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length2 = dx * dx + dy * dy;
  const t =
    length2 === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length2,
          ),
        );
  return Math.hypot(point[0] - (a[0] + t * dx), point[1] - (a[1] + t * dy));
}

// Exhaustive even-size oracle for comparing centre definitions only; not production logic.
function publishedSizeOracle(
  points,
  center,
  magnets,
  padding = 12,
  ceiling = 310,
) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const sourceLongest = Math.max(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
  );
  for (let longest = 24; longest <= ceiling; longest += 2) {
    const scale = longest / sourceLongest;
    const polygon = points.map(([x, y]) => [
      (x - center[0]) * scale,
      (y - center[1]) * scale,
    ]);
    const legal = magnets.every((magnet) => {
      if (!pointInPolygon(magnet, polygon)) return false;
      let clearance = Infinity;
      for (let i = 0; i < polygon.length; i++) {
        clearance = Math.min(
          clearance,
          pointSegmentDistance(
            magnet,
            polygon[i],
            polygon[(i + 1) % polygon.length],
          ),
        );
      }
      return clearance + EPS >= padding;
    });
    if (legal) return longest;
  }
  return null;
}

function convexHull(points) {
  const sorted = [...points].sort(([ax, ay], [bx, by]) => ax - bx || ay - by);
  const turn = (a, b, c) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const half = (input) => {
    const out = [];
    for (const p of input) {
      while (out.length >= 2 && turn(out.at(-2), out.at(-1), p) <= 0) out.pop();
      out.push(p);
    }
    return out;
  };
  return [...half(sorted).slice(0, -1), ...half(sorted.reverse()).slice(0, -1)];
}

const rotate = ([x, y], angle) => [
  x * Math.cos(angle) - y * Math.sin(angle),
  x * Math.sin(angle) + y * Math.cos(angle),
];

// Exact 2D minimum-area enclosing rectangle by testing every convex-hull edge orientation.
function minimumAreaBoxCenter(points) {
  const hull = convexHull(points);
  let best = null;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const angle = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    const local = hull.map((point) => rotate(point, angle));
    const xs = local.map(([x]) => x);
    const ys = local.map(([, y]) => y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const candidate = {
      area: (maxX - minX) * (maxY - minY),
      center: rotate([(minX + maxX) / 2, (minY + maxY) / 2], -angle),
    };
    if (!best || candidate.area < best.area - EPS) best = candidate;
  }
  return best.center;
}

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const shapes = {
  rectangle: [
    [-60, -30],
    [60, -30],
    [60, 30],
    [-60, 30],
  ],
  scalene: [
    [-70, -45],
    [80, -10],
    [-15, 65],
  ],
  asymmetricConcave: [
    [-60, -50],
    [65, -50],
    [65, -5],
    [10, -5],
    [10, 55],
    [-20, 55],
    [-20, 5],
    [-60, 5],
  ],
  cShape: [
    [-65, -60],
    [65, -60],
    [65, -25],
    [-25, -25],
    [-25, 25],
    [65, 25],
    [65, 60],
    [-65, 60],
  ],
  lShape: [
    [-60, -60],
    [20, -60],
    [20, 20],
    [60, 20],
    [60, 60],
    [-60, 60],
  ],
};

const bands = {
  pair: [
    [-24, 0],
    [24, 0],
  ],
  band2: [-24, 24].flatMap((x) => [-24, 24].map((y) => [x, y])),
  band3: [-48, 0, 48].flatMap((x) => [-48, 0, 48].map((y) => [x, y])),
  band4: [-72, -24, 24, 72].flatMap((x) =>
    [-72, -24, 24, 72].map((y) => [x, y]),
  ),
};

const results = [];
for (const [name, polygon] of Object.entries(shapes)) {
  const base = {
    aabb: aabbCenter(polygon),
    orientedBox: minimumAreaBoxCenter(polygon),
    area: areaCentroid(polygon),
  };
  results.push({
    shape: name,
    centers: base,
    inside: Object.fromEntries(
      Object.entries(base).map(([key, point]) => [
        key,
        pointInPolygon(point, polygon),
      ]),
    ),
    aabbAreaSeparationMM: distance(base.aabb, base.area),
    orientedAreaSeparationMM: distance(base.orientedBox, base.area),
    publishedByCenter: Object.fromEntries(
      Object.entries(base).map(([centerName, center]) => [
        centerName,
        Object.fromEntries(
          Object.entries(bands).map(([bandName, magnets]) => [
            bandName,
            publishedSizeOracle(polygon, center, magnets),
          ]),
        ),
      ]),
    ),
  });
}

// The asymmetric fixtures must prove these are genuinely different definitions.
assert(results.some(({ aabbAreaSeparationMM }) => aabbAreaSeparationMM > 10));
assert(results.some(({ inside }) => !inside.area));

console.log(JSON.stringify({ results }, null, 2));
