import assert from 'node:assert/strict';

// Independent numerical falsification harness for blueprint v2. Production uses
// the exact predicates specified in the blueprint; this runner deliberately does
// not share production code because no production engine exists yet.

const CROSS = (a, b) => a[0] * b[1] - a[1] * b[0];
const SUB = (a, b) => [a[0] - b[0], a[1] - b[1]];
const SCALE = (p, s) => [p[0] * s, p[1] * s];

function onSegment(p, a, b) {
  if (CROSS(SUB(b, a), SUB(p, a)) !== 0) return false;
  return p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0])
    && p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1]);
}

function pointInClosedPolygon(p, polygon) {
  let inside = false;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    if (onSegment(p, a, b)) return true;
    if ((a[1] > p[1]) !== (b[1] > p[1])) {
      const x = a[0] + ((p[1] - a[1]) * (b[0] - a[0])) / (b[1] - a[1]);
      if (x > p[0]) inside = !inside;
    }
  }
  return inside;
}

function properIntersection(a, b, c, d) {
  const ab = SUB(b, a);
  const cd = SUB(d, c);
  const c1 = CROSS(ab, SUB(c, a));
  const c2 = CROSS(ab, SUB(d, a));
  const c3 = CROSS(cd, SUB(a, c));
  const c4 = CROSS(cd, SUB(b, c));
  return ((c1 < 0 && c2 > 0) || (c1 > 0 && c2 < 0))
    && ((c3 < 0 && c4 > 0) || (c3 > 0 && c4 < 0));
}

function boxVertices(box) {
  return [
    [box.left, box.top],
    [box.right, box.top],
    [box.right, box.bottom],
    [box.left, box.bottom],
  ];
}

function boxContained(box, sourcePolygon, scale) {
  const polygon = sourcePolygon.map((p) => SCALE(p, scale));
  const corners = boxVertices(box);
  if (!corners.every((p) => pointInClosedPolygon(p, polygon))) return false;

  for (let i = 0; i < corners.length; i += 1) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    for (let j = 0; j < polygon.length; j += 1) {
      const c = polygon[j];
      const d = polygon[(j + 1) % polygon.length];
      if (properIntersection(a, b, c, d)) return false;
    }
  }
  return true;
}

function contactRoots(box, polygon, ceiling) {
  const roots = new Set([0, ceiling]);
  const corners = boxVertices(box);

  for (const b of corners) {
    for (let i = 0; i < polygon.length; i += 1) {
      const v = polygon[i];
      const w = polygon[(i + 1) % polygon.length];
      const d = SUB(w, v);
      const denominator = CROSS(d, v);
      if (denominator === 0) continue;
      const scale = CROSS(d, b) / denominator;
      if (scale <= 0 || scale > ceiling) continue;
      if (onSegment(b, SCALE(v, scale), SCALE(w, scale))) roots.add(scale);
    }
  }

  for (const v of polygon) {
    for (let i = 0; i < corners.length; i += 1) {
      const b = corners[i];
      const c = corners[(i + 1) % corners.length];
      const e = SUB(c, b);
      const denominator = CROSS(e, v);
      if (denominator === 0) continue;
      const scale = CROSS(e, b) / denominator;
      if (scale <= 0 || scale > ceiling) continue;
      if (onSegment(SCALE(v, scale), b, c)) roots.add(scale);
    }
  }

  return [...roots].sort((a, b) => a - b);
}

function labelledPieces(box, polygon, ceiling) {
  const roots = contactRoots(box, polygon, ceiling);
  const pieces = [];
  for (let i = 0; i < roots.length; i += 1) {
    pieces.push({ lo: roots[i], hi: roots[i], lawful: boxContained(box, polygon, roots[i]) });
    if (i + 1 < roots.length) {
      const lo = roots[i];
      const hi = roots[i + 1];
      pieces.push({ lo, hi, lawful: boxContained(box, polygon, (lo + hi) / 2) });
    }
  }
  return pieces;
}

function predicted(pieces, scale) {
  const point = pieces.find((piece) => piece.lo === scale && piece.hi === scale);
  if (point) return point.lawful;
  return pieces.find((piece) => piece.lo < scale && scale < piece.hi)?.lawful ?? false;
}

function activeComponents(vertices, edges, active) {
  const adjacency = new Map(vertices.map((vertex) => [vertex, []]));
  for (let i = 0; i < edges.length; i += 1) {
    if (!active[i]) continue;
    const [a, b] = edges[i];
    adjacency.get(a).push(b);
    adjacency.get(b).push(a);
  }
  const seen = new Set();
  const components = [];
  for (const vertex of vertices) {
    if (seen.has(vertex) || adjacency.get(vertex).length === 0) continue;
    const stack = [vertex];
    const component = [];
    seen.add(vertex);
    while (stack.length > 0) {
      const current = stack.pop();
      component.push(current);
      for (const next of adjacency.get(current)) {
        if (seen.has(next)) continue;
        seen.add(next);
        stack.push(next);
      }
    }
    components.push(component.sort());
  }
  return components;
}

const square = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const pairBox = { left: -36, right: 36, top: -12, bottom: 12 };
const squareBox = { left: -36, right: 36, top: -36, bottom: 36 };
const notch = [[-60, -60], [60, -60], [60, 60], [10, 60], [10, -10], [-10, -10], [-10, 60], [-60, 60]];

assert.equal(boxContained(squareBox, square, 35), false);
assert.equal(boxContained(squareBox, square, 36), true);
assert.equal(boxContained(pairBox, square, 36), true);
assert.equal(boxContained({ left: -30, right: 30, top: -20, bottom: 20 }, notch, 1), false,
  'all corners can be inside while a concave notch crosses a box edge');

const windowVertices = ['tl', 'tr', 'bl', 'br'];
const windowEdges = [['tl', 'tr'], ['bl', 'br'], ['tl', 'bl'], ['tr', 'br']];
assert.deepEqual(activeComponents(windowVertices, windowEdges, [true, false, true, false]),
  [['bl', 'tl', 'tr']], 'two joined active pair boxes derive an L without naming it');
assert.deepEqual(activeComponents(windowVertices, windowEdges, [true, true, false, false]),
  [['tl', 'tr'], ['bl', 'br']], 'disconnected active pairs remain distinct arrangements');

for (const fixture of [
  { name: 'square-pair', polygon: square, box: pairBox, ceiling: 80 },
  { name: 'square-2x2', polygon: square, box: squareBox, ceiling: 80 },
  { name: 'concave-notch', polygon: notch, box: { left: -30, right: 30, top: -20, bottom: 20 }, ceiling: 4 },
]) {
  const pieces = labelledPieces(fixture.box, fixture.polygon, fixture.ceiling);
  for (let i = 1; i < 2000; i += 1) {
    const scale = (fixture.ceiling * i) / 2000;
    assert.equal(predicted(pieces, scale), boxContained(fixture.box, fixture.polygon, scale),
      `${fixture.name} mismatch at scale ${scale}`);
  }
  console.log(`${fixture.name}: ${pieces.length} labelled pieces, dense oracle matched`);
}

console.log('pair-box containment proof: PASS');
