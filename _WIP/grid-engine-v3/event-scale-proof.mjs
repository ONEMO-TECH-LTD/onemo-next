import assert from "node:assert/strict";

const EPS = 1e-8;
const cross = ([ax, ay], [bx, by]) => ax * by - ay * bx;
const sub = ([ax, ay], [bx, by]) => [ax - bx, ay - by];
const dot = ([ax, ay], [bx, by]) => ax * bx + ay * by;

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
  const ab = sub(b, a);
  const length2 = dot(ab, ab);
  if (length2 === 0) return Math.hypot(point[0] - a[0], point[1] - a[1]);
  const t = Math.max(0, Math.min(1, dot(sub(point, a), ab) / length2));
  return Math.hypot(
    point[0] - (a[0] + t * ab[0]),
    point[1] - (a[1] + t * ab[1]),
  );
}

function discIsSupported(polygon, scale, centre, radius) {
  const scaled = polygon.map(([x, y]) => [x * scale, y * scale]);
  if (!pointInPolygon(centre, scaled)) return false;
  let clearance = Infinity;
  for (let i = 0; i < scaled.length; i++) {
    clearance = Math.min(
      clearance,
      pointSegmentDistance(centre, scaled[i], scaled[(i + 1) % scaled.length]),
    );
  }
  return clearance + EPS >= radius;
}

function layoutIsSupported(polygon, scale, centres, radius) {
  return centres.every((centre) =>
    discIsSupported(polygon, scale, centre, radius),
  );
}

function positiveRoot(roots, value, ceiling) {
  if (Number.isFinite(value) && value > EPS && value <= ceiling + EPS)
    roots.push(value);
}

// A legality change can only occur when a fixed disc is tangent to a scaled edge/vertex,
// or when its centre crosses the scaled boundary. These roots partition all possible scales
// into intervals on which the complete containment verdict is constant.
function contactScales(polygon, centres, radius, ceiling) {
  const roots = [0, ceiling];
  for (const q of centres) {
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      const d = sub(b, a);

      // Tangency to a scaled vertex: |s*a - q| = radius (quadratic).
      const aa = dot(a, a);
      const bb = -2 * dot(a, q);
      const cc = dot(q, q) - radius * radius;
      const discriminant = bb * bb - 4 * aa * cc;
      if (aa > EPS && discriminant >= -EPS) {
        const root = Math.sqrt(Math.max(0, discriminant));
        positiveRoot(roots, (-bb - root) / (2 * aa), ceiling);
        positiveRoot(roots, (-bb + root) / (2 * aa), ceiling);
      }

      // Tangency to the supporting line of a scaled edge. Projection filtering is unnecessary:
      // over-generating roots is safe; the full predicate rejects irrelevant line contacts.
      const denominator = cross(d, a);
      if (Math.abs(denominator) > EPS) {
        const numerator = cross(d, q);
        const edgeLength = Math.hypot(d[0], d[1]);
        positiveRoot(
          roots,
          (numerator - radius * edgeLength) / denominator,
          ceiling,
        );
        positiveRoot(
          roots,
          (numerator + radius * edgeLength) / denominator,
          ceiling,
        );
        // Centre crossing, required because inside/outside can change without radius tangency.
        positiveRoot(roots, numerator / denominator, ceiling);
      }
    }
  }
  return [
    ...new Set(roots.map((value) => Math.round(value * 1e10) / 1e10)),
  ].sort((a, b) => a - b);
}

function solveByEvents(polygon, centres, radius, floor, ceiling) {
  const events = contactScales(polygon, centres, radius, ceiling).filter(
    (s) => s >= floor - EPS,
  );
  if (!events.includes(floor)) events.push(floor);
  events.sort((a, b) => a - b);

  for (let i = 0; i < events.length; i++) {
    const at = events[i];
    if (layoutIsSupported(polygon, at, centres, radius))
      return { scale: at, events: events.length };
    const next = events[i + 1];
    if (next === undefined) break;
    const middle = (at + next) / 2;
    if (layoutIsSupported(polygon, middle, centres, radius)) {
      // Closed-disc containment makes the lawful interval boundary itself lawful. Numerical proof
      // checks just inside the interval and returns the analytic boundary.
      const justInside = at + Math.max(1e-7, (next - at) * 1e-7);
      assert(layoutIsSupported(polygon, justInside, centres, radius));
      return { scale: at, events: events.length };
    }
  }
  return null;
}

function solvePublishedEvenByEvents(polygon, centres, radius, floor, ceiling) {
  const events = contactScales(polygon, centres, radius, ceiling).filter(
    (s) => s >= floor - EPS,
  );
  if (!events.includes(floor)) events.push(floor);
  events.sort((a, b) => a - b);

  for (let i = 0; i < events.length; i++) {
    const at = events[i];
    const roundedEvent = Math.round(at / 2) * 2;
    if (
      Math.abs(roundedEvent - at) < EPS &&
      layoutIsSupported(polygon, roundedEvent, centres, radius)
    )
      return roundedEvent;

    const next = events[i + 1];
    if (next === undefined || next - at < EPS) continue;
    if (!layoutIsSupported(polygon, (at + next) / 2, centres, radius)) continue;
    const candidate = Math.max(
      Math.ceil((at - EPS) / 2) * 2,
      Math.ceil(floor / 2) * 2,
    );
    if (
      candidate <= next + EPS &&
      layoutIsSupported(polygon, candidate, centres, radius)
    )
      return candidate;
  }
  return null;
}

function solvePublishedEvenOracle(polygon, centres, radius, floor, ceiling) {
  for (let scale = Math.ceil(floor / 2) * 2; scale <= ceiling; scale += 2) {
    if (layoutIsSupported(polygon, scale, centres, radius)) return scale;
  }
  return null;
}

function solveByDenseOracle(
  polygon,
  centres,
  radius,
  floor,
  ceiling,
  step = 0.002,
) {
  for (let scale = floor; scale <= ceiling + EPS; scale += step) {
    if (layoutIsSupported(polygon, scale, centres, radius)) return scale;
  }
  return null;
}

const shapes = {
  square: [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
  ],
  diamond: [
    [0, -0.65],
    [0.65, 0],
    [0, 0.65],
    [-0.65, 0],
  ],
  asymmetricConcave: [
    [-0.6, -0.5],
    [0.65, -0.5],
    [0.65, -0.05],
    [0.1, -0.05],
    [0.1, 0.55],
    [-0.2, 0.55],
    [-0.2, 0.05],
    [-0.6, 0.05],
  ],
  cShape: [
    [-0.65, -0.6],
    [0.65, -0.6],
    [0.65, -0.25],
    [-0.25, -0.25],
    [-0.25, 0.25],
    [0.65, 0.25],
    [0.65, 0.6],
    [-0.65, 0.6],
  ],
  steppedLimb: [
    [-0.65, -0.55],
    [0.2, -0.55],
    [0.2, -0.18],
    [0.65, -0.18],
    [0.65, 0.18],
    [-0.05, 0.18],
    [-0.05, 0.55],
    [-0.65, 0.55],
  ],
};

const bands = {
  twoByTwo: [
    [-24, -24],
    [-24, 24],
    [24, -24],
    [24, 24],
  ],
  threeByThree: [-48, 0, 48].flatMap((x) => [-48, 0, 48].map((y) => [x, y])),
  pair: [
    [-24, 0],
    [24, 0],
  ],
};

const cases = [];
for (const [shapeName, polygon] of Object.entries(shapes)) {
  for (const [bandName, centres] of Object.entries(bands)) {
    const event = solveByEvents(polygon, centres, 12, 24, 310);
    const dense = solveByDenseOracle(polygon, centres, 12, 24, 310);
    const published = solvePublishedEvenByEvents(polygon, centres, 12, 24, 310);
    const publishedOracle = solvePublishedEvenOracle(
      polygon,
      centres,
      12,
      24,
      310,
    );
    assert.equal(
      Boolean(event),
      dense !== null,
      `${shapeName}/${bandName}: existence mismatch`,
    );
    assert.equal(
      published,
      publishedOracle,
      `${shapeName}/${bandName}: published mismatch`,
    );
    if (event && dense !== null) {
      assert(
        Math.abs(event.scale - dense) <= 0.004,
        `${shapeName}/${bandName}: event=${event.scale}, dense=${dense}`,
      );
      assert(
        layoutIsSupported(polygon, event.scale + 1e-6, centres, 12),
        `${shapeName}/${bandName}: returned boundary is not supported`,
      );
    }
    cases.push({
      shape: shapeName,
      band: bandName,
      eventMM: event?.scale ?? null,
      publishedMM: published,
      denseMM: dense,
      eventCount: event?.events ?? null,
    });
  }
}

// The released square control has a known exact answer: 2x2 centres at +/-24 plus 12mm radius.
const square = cases.find(
  ({ shape, band }) => shape === "square" && band === "twoByTwo",
);
assert(
  Math.abs(square.eventMM - 72) < 1e-7,
  `square control should be exactly 72mm, got ${square.eventMM}`,
);

// Coordinate rotation must rotate the complete answer without changing its physical size.
const rotate = ([x, y], angle) => [
  x * Math.cos(angle) - y * Math.sin(angle),
  x * Math.sin(angle) + y * Math.cos(angle),
];
let rotationChecks = 0;
for (const polygon of Object.values(shapes)) {
  for (const centres of Object.values(bands)) {
    const baseline =
      solveByEvents(polygon, centres, 12, 24, 310)?.scale ?? null;
    for (const angle of [Math.PI / 7, Math.PI / 3, Math.PI * 0.91]) {
      const rotated =
        solveByEvents(
          polygon.map((p) => rotate(p, angle)),
          centres.map((p) => rotate(p, angle)),
          12,
          24,
          310,
        )?.scale ?? null;
      assert.equal(
        rotated === null,
        baseline === null,
        "rotation changed solution existence",
      );
      if (baseline !== null)
        assert(
          Math.abs(rotated - baseline) < 1e-7,
          `rotation changed ${baseline} to ${rotated}`,
        );
      rotationChecks++;
    }
  }
}

// Released values are genuine inputs: changing padding or pitch must rederive the answer.
const squareAtPadding = [6, 12, 18].map((padding) => ({
  padding,
  scale: solveByEvents(shapes.square, bands.twoByTwo, padding, 1, 310).scale,
}));
assert.deepEqual(
  squareAtPadding.map(({ scale }) => scale),
  [60, 72, 84],
);
const bandForPitch = (pitch) => [
  [-pitch / 2, -pitch / 2],
  [-pitch / 2, pitch / 2],
  [pitch / 2, -pitch / 2],
  [pitch / 2, pitch / 2],
];
const squareAtPitch = [48, 96].map((pitch) => ({
  pitch,
  scale: solveByEvents(shapes.square, bandForPitch(pitch), 12, 1, 310).scale,
}));
assert.deepEqual(
  squareAtPitch.map(({ scale }) => scale),
  [72, 120],
);

// Verify the event partition itself: no verdict may change between consecutive events.
let intervalChecks = 0;
for (const polygon of Object.values(shapes)) {
  for (const centres of Object.values(bands)) {
    const events = contactScales(polygon, centres, 12, 310).filter(
      (s) => s >= 24,
    );
    for (let i = 0; i + 1 < events.length; i++) {
      const a = events[i];
      const b = events[i + 1];
      if (b - a < 1e-6) continue;
      const verdicts = [0.2, 0.5, 0.8].map((t) =>
        layoutIsSupported(polygon, a + (b - a) * t, centres, 12),
      );
      assert.equal(
        new Set(verdicts).size,
        1,
        `verdict changed without an event in (${a}, ${b})`,
      );
      intervalChecks++;
    }
  }
}

// Deterministic fuzzing over concave C/notch contours and arbitrary fixed magnet populations.
// This is independent of the hand-picked controls above and compares against the dense oracle.
let seed = 0x62c0ffee;
const random = () => (seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32;
let fuzzChecks = 0;
for (let trial = 0; trial < 120; trial++) {
  const notchX = -0.35 + random() * 0.7;
  const notchHalf = 0.06 + random() * 0.32;
  const polygon = [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, -notchHalf],
    [notchX, -notchHalf],
    [notchX, notchHalf],
    [0.5, notchHalf],
    [0.5, 0.5],
    [-0.5, 0.5],
  ];
  const count = 1 + Math.floor(random() * 4);
  const centres = Array.from({ length: count }, () => [
    (random() - 0.5) * 120,
    (random() - 0.5) * 120,
  ]);
  const event = solveByEvents(polygon, centres, 12, 24, 310)?.scale ?? null;
  const dense = solveByDenseOracle(polygon, centres, 12, 24, 310, 0.01);
  const published = solvePublishedEvenByEvents(polygon, centres, 12, 24, 310);
  const publishedOracle = solvePublishedEvenOracle(
    polygon,
    centres,
    12,
    24,
    310,
  );
  assert.equal(
    event === null,
    dense === null,
    `fuzz ${trial}: existence mismatch`,
  );
  if (event !== null)
    assert(
      Math.abs(event - dense) <= 0.011,
      `fuzz ${trial}: event=${event}, dense=${dense}`,
    );
  assert.equal(published, publishedOracle, `fuzz ${trial}: published mismatch`);
  fuzzChecks++;
}

// Exhibit the non-monotonic case that invalidates a one-shot "largest first-cover scale" rule.
let nonMonotonicExample = null;
outer: for (let qx = -60; qx <= 60; qx += 6) {
  for (let qy = -60; qy <= 60; qy += 6) {
    const verdicts = [];
    for (let scale = 24; scale <= 310; scale += 0.25)
      verdicts.push(discIsSupported(shapes.cShape, scale, [qx, qy], 12));
    let transitions = 0;
    for (let i = 1; i < verdicts.length; i++)
      if (verdicts[i] !== verdicts[i - 1]) transitions++;
    if (transitions >= 2) {
      nonMonotonicExample = { centre: [qx, qy], transitions };
      break outer;
    }
  }
}
assert(nonMonotonicExample, "expected a concave enter/leave support example");

console.log(
  JSON.stringify(
    {
      cases,
      intervalChecks,
      rotationChecks,
      fuzzChecks,
      nonMonotonicExample,
      squareAtPadding,
      squareAtPitch,
    },
    null,
    2,
  ),
);
