// FAILED QA — see QA-VERDICT.md in this folder. Its output is NOT evidence about any engine:
// the predicates test arrangement structure only, never the ruled location, so passes may be
// false and failures are not engine findings. Do not cite a run of this file.
//
// CANON MEMBERSHIP HARNESS — the test that decides whether an engine is the keeper.
//
// For each placement Dan accepted during his walkthrough, ask one question of the raw
// candidate set: is it in there? Nothing about ranking, nothing about preference. An
// engine that cannot produce his answer is wrong however elegant it is.
//
// Runs against the assembled parts 1 + 2 (kernel -> enumerator). The expectation table
// comes from ../gpt-pro/part-2-candidate-enumerator/ACCEPTANCE-GATE.md, written before
// any delivery existed.

import { readFileSync } from "node:fs";
import { measureLattice } from "../engine/magnetic-grid-measurement-kernel/dist/index.js";
import { enumerateCandidates } from "../engine/enumerator/dist/index.js";

const TRACES = JSON.parse(readFileSync(
  "/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s62-grid-canvas/_WIP/grid-engine-v3/evidence/canonical-traces.json",
  "utf8",
));

const UNIT = 1_000_000;        // trace units per normalised unit
const PITCH = 48n;             // base lattice pitch, mm
const DISC = 24n;              // full support disc, mm
const FIELD = 4n;              // field extent, +/- positions

// ---------------------------------------------------------------- shape preparation

const toIntegerPolygon = (points) => {
  const out = [];
  for (const [x, y] of points) {
    const px = BigInt(Math.round(x * UNIT));
    const py = BigInt(Math.round(y * UNIT));
    const last = out[out.length - 1];
    if (!last || last.x !== px || last.y !== py) out.push({ x: px, y: py });
  }
  while (out.length > 1 && out[0].x === out.at(-1).x && out[0].y === out.at(-1).y) out.pop();
  return out;
};

const bboxOf = (v) => v.reduce((b, p) => ({
  minX: p.x < b.minX ? p.x : b.minX, maxX: p.x > b.maxX ? p.x : b.maxX,
  minY: p.y < b.minY ? p.y : b.minY, maxY: p.y > b.maxY ? p.y : b.maxY,
}), { minX: v[0].x, maxX: v[0].x, minY: v[0].y, maxY: v[0].y });

// exact integer shoelace centroid, in source units
const centroidOf = (v) => {
  let a2 = 0n, cx = 0n, cy = 0n;
  for (let i = 0; i < v.length; i++) {
    const p = v[i], q = v[(i + 1) % v.length];
    const cr = p.x * q.y - q.x * p.y;
    a2 += cr; cx += (p.x + q.x) * cr; cy += (p.y + q.y) * cr;
  }
  if (a2 === 0n) { const b = bboxOf(v); return { x: (b.minX + b.maxX) / 2n, y: (b.minY + b.maxY) / 2n }; }
  return { x: cx / (3n * a2), y: cy / (3n * a2) };
};

// max-clearance point, sampled — an anchor choice, never a fit decision
const insidePolygon = (v, x, y) => {
  let inside = false;
  for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
    const yi = v[i].y, yj = v[j].y, xi = v[i].x, xj = v[j].x;
    if ((yi > y) !== (yj > y)) {
      const den = yj - yi;
      const lhs = (x - xi) * den, rhs = (xj - xi) * (y - yi);
      if (den > 0n ? lhs < rhs : lhs > rhs) inside = !inside;
    }
  }
  return inside;
};
const dist2Seg = (px, py, ax, ay, bx, by) => {
  const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
  const L = vx * vx + vy * vy;
  if (L === 0n) return wx * wx + wy * wy;
  const h = wx * vx + wy * vy;
  if (h <= 0n) return wx * wx + wy * wy;
  if (h >= L) { const dx = px - bx, dy = py - by; return dx * dx + dy * dy; }
  const c = vx * wy - vy * wx;
  return (c * c) / L;                       // sample only: never decides a fit
};
const maxClearanceOf = (v, samples = 48n) => {
  const b = bboxOf(v);
  let best = null, bestD = -1n;
  for (let i = 0n; i <= samples; i++) {
    for (let j = 0n; j <= samples; j++) {
      const x = b.minX + ((b.maxX - b.minX) * i) / samples;
      const y = b.minY + ((b.maxY - b.minY) * j) / samples;
      if (!insidePolygon(v, x, y)) continue;
      let m = null;
      for (let k = 0; k < v.length; k++) {
        const d = dist2Seg(x, y, v[k].x, v[k].y, v[(k + 1) % v.length].x, v[(k + 1) % v.length].y);
        if (m === null || d < m) m = d;
      }
      if (m > bestD) { bestD = m; best = { x, y }; }
    }
  }
  return best ?? centroidOf(v);
};

// ---------------------------------------------------------------- engine invocation

const R = (n, d = 1n) => ({ numerator: n, denominator: d });

const ORIGINS = [
  ["site-site", 0n, 0n],
  ["gap-site", 24n, 0n],
  ["site-gap", 0n, 24n],
  ["gap-gap", 24n, 24n],
];

const measureFor = (vertices, anchorPoint, sizeMm, originX = 0n, originY = 0n) => {
  const b = bboxOf(vertices);
  const spanX = b.maxX - b.minX, spanY = b.maxY - b.minY;
  return measureLattice({
    polygon: { vertices },
    parameters: {
      lattice: {
        pitch: PITCH,
        origin: { x: R(originX), y: R(originY) },
        fieldExtent: { minColumn: -FIELD, maxColumn: FIELD, minRow: -FIELD, maxRow: FIELD },
      },
      discDiameter: DISC,
      sizeTransform: {
        sourceSize: spanX > spanY ? spanX : spanY,
        sourceAnchor: { x: R(anchorPoint.x), y: R(anchorPoint.y) },
        targetAnchor: { x: R(0n), y: R(0n) },
      },
    },
    sizes: [BigInt(sizeMm)],
  });
};

const GRAMMAR = {
  schema: "magnetic-grid-candidate-enumerator/grammar/v1",
  populations: [
    { id: "base", origin: { column: "0", row: "0" }, indexStep: "1" },
    { id: "sparse", origin: { column: "0", row: "0" }, indexStep: "2" },
  ],
  families: {
    single: {},
    run: { stepDomain: "any-positive-whole-population-step" },
    "rectangle-corners": {},
    "corner-triangle": {},
    "full-window": { oneByOne: "include" },
  },
};

// ---------------------------------------------------------------- canon expectations

const isDiagonalRun = (c) => {
  const cols = new Set(c.positions.map((p) => p.column));
  const rows = new Set(c.positions.map((p) => p.row));
  return c.family === "run" && cols.size > 1 && rows.size > 1;
};
const spans = (c) => {
  const cols = c.positions.map((p) => Number(p.column));
  const rows = c.positions.map((p) => Number(p.row));
  return [Math.max(...cols) - Math.min(...cols), Math.max(...rows) - Math.min(...rows)];
};

const CASES = [
  { shape: "DUCK", size: 60, canon: "band 1 — one disc, head, tight wrap",
    want: (c) => c.family === "single" },
  { shape: "PILL", size: 79, canon: "band 2 — diagonal pair",
    want: (c) => isDiagonalRun(c) && c.positions.length === 2 },
  { shape: "PILL", size: 138, canon: "band 3 — diagonal chain of three or more",
    want: (c) => isDiagonalRun(c) && c.positions.length >= 3 },
  { shape: "DUCK", size: 152, canon: "band 3 — head pair + body pair, mid row skipped",
    want: (c) => { const [w, h] = spans(c); return c.family === "rectangle-corners" && w !== h && (w > 1 || h > 1); } },
  { shape: "BAT-WOMAN", size: 144, canon: "band 3 — three utmost corners",
    want: (c) => c.family === "corner-triangle" },
  { shape: "BUTTERFLY", size: 130, canon: "band 3 — four corners, centre row and column unused",
    want: (c) => { const [w, h] = spans(c); return c.family === "rectangle-corners" && w >= 2 && h >= 2; } },
  { shape: "POKE1", size: 123, canon: "band 3 — corner square",
    want: (c) => { const [w, h] = spans(c); return c.family === "rectangle-corners" && w >= 2 && h >= 2; } },
  { shape: "BOT", size: 144, canon: "band 3 — narrow four, tall rectangle",
    want: (c) => { const [w, h] = spans(c); return c.family === "rectangle-corners" && h > w; } },
  { shape: "BOT", size: 236, canon: "band 4 — same rectangle, longer",
    want: (c) => { const [w, h] = spans(c); return c.family === "rectangle-corners" && h > w; } },
  { shape: "BUTTERFLY", size: 214, canon: "band 4 — four points on the sparse population",
    want: (c) => c.family === "rectangle-corners" && c.population === "sparse" },
];

// ---------------------------------------------------------------- run

const anchors = (v) => ({ "bbox-centre": (() => { const b = bboxOf(v); return { x: (b.minX + b.maxX) / 2n, y: (b.minY + b.maxY) / 2n }; })(),
  centroid: centroidOf(v), "max-clearance": maxClearanceOf(v) });

let pass = 0, fail = 0;
for (const testCase of CASES) {
  const vertices = toIntegerPolygon(TRACES[testCase.shape]);
  const found = [];
  let totalCandidates = 0;
  for (const [anchorName, anchorPoint] of Object.entries(anchors(vertices))) {
    for (const [originName, ox, oy] of ORIGINS) {
      let measurement;
      try {
        measurement = measureFor(vertices, anchorPoint, testCase.size, ox, oy);
      } catch (error) {
        found.push(`${anchorName}/${originName}: KERNEL REJECTED ${error.message}`);
        continue;
      }
      const document = enumerateCandidates({ measurement, grammar: GRAMMAR });
      totalCandidates += document.candidates.length;
      const hit = document.candidates.find(testCase.want);
      if (hit) {
        const where = hit.positions.map((p) => `${p.column},${p.row}`).join(" ");
        found.push(`${anchorName}/${originName}: ${hit.family}/${hit.population} [${where}]`);
      }
    }
  }
  const ok = found.some((line) => !line.includes("REJECTED") && line.includes("/"));
  if (ok) pass += 1; else fail += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${testCase.shape} @${testCase.size}mm — ${testCase.canon}`);
  console.log(`      candidates across anchors: ${totalCandidates}`);
  for (const line of found) console.log(`      ${line}`);
  if (!found.length) console.log("      no candidate of the required shape at any anchor");
}
console.log(`\ncanon membership: ${pass} present, ${fail} missing, of ${CASES.length}`);
