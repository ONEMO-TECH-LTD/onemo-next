// CANON MEMBERSHIP — structural arm. v2, rebuilt after QA FAIL (see ../CANON-MEMBERSHIP-TEST.md).
//
// v1 failed because its predicates tested the SHAPE of an arrangement while Dan's canon states
// exact millimetres, and because "is it in the head / one per wing" was answered by nothing at all.
// v2 fixes what canon text can fix and REFUSES to claim the rest:
//
//   STRUCTURE  — taken verbatim from selection-examples/band-*/description.md, quoted per case.
//                Spans are measured in BASE lattice indices (the kernel indices each position
//                carries), never in population steps, so a four-corner square 96mm on a side is
//                spans (2,2) whether it was emitted on the base or the sparse population.
//   REGION     — where the canon states something computable ("the TOP half", "utmost corners")
//                it is checked. Where it says "the head", "one per wing", "head pair + body pair",
//                nothing headless can decide it: the case reports NEEDS-EYE and the visual arm
//                (render the candidate on the page, compare with Dan's screenshot) closes it.
//
// A reconciled case only reports PRESENT when structure matches AND every region claim it makes is
// confirmed. A description-sourced case is UNTESTABLE in both directions until reconciled and
// promoted to `dan-words` or `screenshot`. Output of this file is a finding, not a verdict, until it
// has been through QA.

import { readFileSync } from "node:fs";
import { measureLattice } from "../engine/magnetic-grid-measurement-kernel/dist/index.js";
import { enumerateCandidates } from "../engine/enumerator/dist/index.js";

const TRACES = JSON.parse(readFileSync(
  "/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s62-grid-canvas/_WIP/grid-engine-v3/evidence/canonical-traces.json",
  "utf8",
));

const UNIT = 1_000_000n;   // trace units per normalised unit
const PITCH = 48n;
const DISC = 24n;
const FIELD = 4n;

// ---------------------------------------------------------------- exact geometry helpers

const toIntegerPolygon = (points) => {
  const out = [];
  for (const [x, y] of points) {
    const px = BigInt(Math.round(x * Number(UNIT)));
    const py = BigInt(Math.round(y * Number(UNIT)));
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

// squared point-to-segment distance as an EXACT rational { n, d } — no truncating division
const dist2Seg = (px, py, ax, ay, bx, by) => {
  const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
  const L = vx * vx + vy * vy;
  if (L === 0n) return { n: wx * wx + wy * wy, d: 1n };
  const h = wx * vx + wy * vy;
  if (h <= 0n) return { n: wx * wx + wy * wy, d: 1n };
  if (h >= L) { const dx = px - bx, dy = py - by; return { n: dx * dx + dy * dy, d: 1n }; }
  const c = vx * wy - vy * wx;
  return { n: c * c, d: L };
};
const ratLess = (a, b) => a.n * b.d < b.n * a.d;          // exact comparison, no floats

const clearance2At = (v, x, y) => {
  let best = null;
  for (let k = 0; k < v.length; k++) {
    const d = dist2Seg(x, y, v[k].x, v[k].y, v[(k + 1) % v.length].x, v[(k + 1) % v.length].y);
    if (best === null || ratLess(d, best)) best = d;
  }
  return best;
};

// O-1's third anchor switch, named for what it is: a DETERMINISTIC REFINED SAMPLE, **not** a
// solved maximum. Each sampled point's clearance is compared exactly, but greedy refinement can
// lock onto the basin the coarse pass happened to find and miss a narrower basin with a higher
// true maximum. A miss under this anchor therefore never establishes absence. Replacing it with a
// real largest-inscribed-circle solver is the only way to claim "maximum clearance" truthfully.
// (QA finding 3, @s62-pixel-grid-pixel.) Reproducible from the three constants below.
const COARSE = 64n, SUBDIV = 8n, REFINEMENTS = 8;
const refinedSampleAnchor = (v) => {
  const b = bboxOf(v);
  let loX = b.minX, hiX = b.maxX, loY = b.minY, hiY = b.maxY;
  let best = null, bestD = null;
  for (let pass = 0; pass <= REFINEMENTS; pass++) {
    const divisions = pass === 0 ? COARSE : SUBDIV;
    let stepX = (hiX - loX) / divisions, stepY = (hiY - loY) / divisions;
    // the surviving best is always re-sampled, so a pass can never regress and truncation to a
    // zero step ends the search instead of stalling on a grid that cannot reach `hi`
    let passBest = best, passBestD = bestD;
    for (let i = 0n; i <= divisions; i++) {
      for (let j = 0n; j <= divisions; j++) {
        const x = loX + stepX * i, y = loY + stepY * j;
        if (!insidePolygon(v, x, y)) continue;
        const d = clearance2At(v, x, y);
        if (passBestD === null || ratLess(passBestD, d)) { passBestD = d; passBest = { x, y }; }
      }
    }
    best = passBest; bestD = passBestD;
    if (!best || (stepX === 0n && stepY === 0n)) break;
    loX = best.x - stepX; hiX = best.x + stepX; loY = best.y - stepY; hiY = best.y + stepY;
  }
  return best ?? centroidOf(v);
};

// ---------------------------------------------------------------- engine invocation

const R = (n, d = 1n) => ({ numerator: n, denominator: d });
const ORIGINS = [["site-site", 0n, 0n], ["gap-site", 24n, 0n], ["site-gap", 0n, 24n], ["gap-gap", 24n, 24n]];

const measureFor = (vertices, anchorPoint, sizeMm, ox, oy) => {
  const b = bboxOf(vertices);
  const spanX = b.maxX - b.minX, spanY = b.maxY - b.minY;
  return measureLattice({
    polygon: { vertices },
    parameters: {
      lattice: {
        pitch: PITCH, origin: { x: R(ox), y: R(oy) },
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

// ---------------------------------------------------------------- canon, quoted

const cols = (c) => c.positions.map((p) => Number(p.column));
const rows = (c) => c.positions.map((p) => Number(p.row));
const baseSpans = (c) => [Math.max(...cols(c)) - Math.min(...cols(c)), Math.max(...rows(c)) - Math.min(...rows(c))];
const isRect = (c, w, h) => { const [a, b] = baseSpans(c); return c.family === "rectangle-corners" && a === w && b === h; };

// held-set extent of the measurement a candidate came from — "utmost" made computable
const heldExtent = (measurement) => {
  const held = measurement.sizes[0].positions.filter((p) => p.fits);
  if (!held.length) return null;
  const cs = held.map((p) => Number(p.column)), rs = held.map((p) => Number(p.row));
  return { minC: Math.min(...cs), maxC: Math.max(...cs), minR: Math.min(...rs), maxR: Math.max(...rs) };
};

// `source` records WHERE each geometric claim comes from, because the descriptions were written by
// this lane from Dan's screenshots and at least two of them were wrong (QA, @s62-pixel-grid-pixel):
//   dan-words   — the numbers are Dan's own, quoted
//   screenshot  — measured off his frame here, with the measurement recorded
//   description — my prose only, NOT yet checked against the frame
// A case whose source is `description` cannot report ABSENT: an unverified predicate failing proves
// nothing about an engine. It reports UNTESTABLE until its claim is reconciled.
const CASES = [
  { shape: "DUCK", size: 60, band: 1, source: "dan-words",
    canon: 'Dan: "1 magnet fits fully in the top half … gravity must not place magnets in the bottom and leave top unprotected"',
    structure: (c) => c.family === "single",
    region: { kind: "computable", label: "centre in the shape's top half", test: (c, ctx) => ctx.isTopHalf(c.positions[0]) } },

  { shape: "PILL", size: 79, band: 2, source: "description",
    canon: 'Dan ruled the diagonal pair lawful; "48mm across, 48mm down" is description prose, unverified',
    structure: (c) => c.family === "run" && c.positions.length === 2
      && Math.abs(cols(c)[0] - cols(c)[1]) === 1 && Math.abs(rows(c)[0] - rows(c)[1]) === 1,
    region: { kind: "structural", label: "adjacency is the whole ruling" } },

  { shape: "PILL", size: 138, band: 3, source: "description",
    canon: 'Dan: "for diagonals better to use diagonal"; chain length and step are description prose',
    structure: (c) => {
      if (c.family !== "run" || c.positions.length < 3) return false;
      const [w, h] = baseSpans(c);
      return w === h && w >= 2;
    },
    region: { kind: "needs-eye", label: "chain lies along the capsule's own axis" } },

  { shape: "DUCK", size: 152, band: 3, source: "description",
    canon: 'Dan: "skipping mid row"; the 48 × 96mm rectangle is description prose, unverified',
    structure: (c) => isRect(c, 1, 2),
    region: { kind: "needs-eye", label: "upper pair in the head, lower pair in the body" } },

  { shape: "BAT-WOMAN", size: 144, band: 3, source: "dan-words",
    canon: 'Dan: "needs essentially 3 magnets utmost corners only mid 2 rows are optional"',
    structure: (c) => c.family === "corner-triangle",
    region: { kind: "computable", label: "one site on the top extreme, two on the base at both horizontal extremes",
      test: (c, ctx) => {
        const e = ctx.extent; if (!e) return false;
        const cc = cols(c), rr = rows(c);
        if (Math.min(...cc) !== e.minC || Math.max(...cc) !== e.maxC) return false;   // utmost horizontally
        if (Math.min(...rr) !== e.minR || Math.max(...rr) !== e.maxR) return false;   // utmost vertically
        const topRow = TOP_IS_MIN_ROW ? Math.min(...rr) : Math.max(...rr);
        const baseRow = TOP_IS_MIN_ROW ? Math.max(...rr) : Math.min(...rr);
        const top = c.positions.filter((p) => Number(p.row) === topRow);
        const base = c.positions.filter((p) => Number(p.row) === baseRow);
        if (top.length !== 1 || base.length !== 2) return false;                       // one up, two down
        const baseCols = base.map((p) => Number(p.column));
        return Math.min(...baseCols) === e.minC && Math.max(...baseCols) === e.maxC;
      } } },

  { shape: "BUTTERFLY", size: 130, band: 3, source: "screenshot",
    canon: 'Dan: "band 2 grid in the band 3 shape". Frame measured 2026-08-13: shape 130 × 107mm at '
      + '4.8 px/mm, the four discs 215–230px apart = 48mm — an ADJACENT square, spans (1,1). '
      + 'The description\'s "96mm apart both ways" was this lane\'s error, and impossible (96+24 > 107).',
    structure: (c) => isRect(c, 1, 1),
    region: { kind: "needs-eye", label: "one disc in each of the four wings" } },

  { shape: "POKE1", size: 123, band: 3, source: "screenshot",
    canon: 'Dan: "same logic as butterfly". Frame measured 2026-08-13: shape 104 × 123mm at '
      + '5.07 px/mm, discs 244px apart = 48mm — adjacent square, spans (1,1), not 96 × 96.',
    structure: (c) => isRect(c, 1, 1),
    region: { kind: "needs-eye", label: "corners land in the full lobes" } },

  { shape: "BOT", size: 144, band: 3, source: "dan-words",
    canon: 'Dan: "this one can do but better to do 96mmx48mm narow 4" — 96mm tall, 48mm wide, spans (1,2)',
    structure: (c) => isRect(c, 1, 2),
    region: { kind: "needs-eye", label: "the column wraps the torso" } },

  { shape: "BOT", size: 236, band: 4, source: "description",
    canon: 'Dan: "similar longer rectangle"; "column one 96mm step wide" is description prose, unverified',
    structure: (c) => { const [w, h] = baseSpans(c); return c.family === "rectangle-corners" && w === 2 && h > 2; },
    region: { kind: "needs-eye", label: "shoulders pair on top, hips pair below" } },

  { shape: "BUTTERFLY", size: 214, band: 4, source: "dan-words",
    canon: 'Dan: "B4 - 4 (96mm) … essentially b3 based on the 96mm grid with 4 points ultimately needed"',
    structure: (c) => isRect(c, 2, 2),
    region: { kind: "needs-eye", label: "one per wing at the larger size" } },
];

// Top direction is an explicit oracle, not a heuristic. Every trace comes from the scaffold's own
// cutout tracer in image coordinates, which the SVG canvas renders y-down (one unit = 1mm), so the
// visual top is minimum y — confirmed against Dan's frames, where each shape's head sits at the top
// of the screen. Kernel rows increase with y, so the top row is the minimum row index.
// (The earlier "narrowest end is the top" heuristic was unsound — it read the butterfly upside
// down, since its narrow end is the tails. QA finding 4, @s62-pixel-grid-pixel.)
const TOP_IS_MIN_Y = true, TOP_IS_MIN_ROW = true;

// ---------------------------------------------------------------- run

let present = 0, needsEye = 0, absent = 0, untestable = 0;
for (const testCase of CASES) {
  const vertices = toIntegerPolygon(TRACES[testCase.shape]);
  const b = bboxOf(vertices);
  const sourceSize = (b.maxX - b.minX) > (b.maxY - b.minY) ? b.maxX - b.minX : b.maxY - b.minY;

  const anchors = {
    "bbox-centre": { x: (b.minX + b.maxX) / 2n, y: (b.minY + b.maxY) / 2n },
    centroid: centroidOf(vertices),
    "refined-sample": refinedSampleAnchor(vertices),
  };

  const hits = [];
  let structuralOnly = 0, candidateTotal = 0;
  for (const [anchorName, anchorPoint] of Object.entries(anchors)) {
    // target-space bbox of the shape under this anchor, for the top-half test
    const lambdaN = BigInt(testCase.size), lambdaD = sourceSize;
    const toTargetY = (sy) => ((sy - anchorPoint.y) * lambdaN) / lambdaD;
    const topY = toTargetY(b.minY), botY = toTargetY(b.maxY);
    const halfY = (topY + botY) / 2n;
    const ctxBase = {
      isTopHalf: (p) => {
        const y = BigInt(p.center.y.numerator) / BigInt(p.center.y.denominator);
        return TOP_IS_MIN_Y ? y < halfY : y > halfY;
      },
    };

    for (const [originName, ox, oy] of ORIGINS) {
      let measurement;
      try { measurement = measureFor(vertices, anchorPoint, testCase.size, ox, oy); }
      catch (error) { hits.push(`${anchorName}/${originName}: KERNEL REJECTED ${error.message}`); continue; }

      const doc = enumerateCandidates({ measurement, grammar: GRAMMAR });
      candidateTotal += doc.candidates.length;
      const ctx = { ...ctxBase, extent: heldExtent(measurement) };

      // EVERY structural match is examined. Stopping at the first one let a candidate that failed
      // a computable region test hide a later one that would have passed — a false absence.
      // (QA finding 1, @s62-pixel-grid-pixel.)
      for (const candidate of doc.candidates) {
        if (!testCase.structure(candidate)) continue;
        const where = candidate.positions.map((p) => `${p.column},${p.row}`).join(" ");
        if (testCase.region.kind === "computable") {
          if (testCase.region.test(candidate, ctx)) { hits.push(`CONFIRMED ${anchorName}/${originName} [${where}]`); break; }
          structuralOnly += 1;
          continue;                                   // keep looking in this measurement
        }
        if (testCase.region.kind === "structural") hits.push(`CONFIRMED ${anchorName}/${originName} [${where}]`);
        else hits.push(`NEEDS-EYE  ${anchorName}/${originName} [${where}]`);
        break;
      }
    }
  }

  const confirmed = hits.filter((h) => h.startsWith("CONFIRMED"));
  const eyed = hits.filter((h) => h.startsWith("NEEDS-EYE"));
  let status = confirmed.length ? "PRESENT" : eyed.length ? "NEEDS-EYE" : "NOT-FOUND";
  // The claim source governs BOTH directions. An unverified claim proves nothing about an engine
  // whether it misses OR hits: a match would merely mean the engine agrees with unchecked prose.
  // Such a case stays UNTESTABLE until its geometry is reconciled and promoted to dan-words or
  // screenshot. (QA, @s62-pixel-grid-pixel — the earlier version guarded only misses.)
  if (testCase.source === "description") status = "UNTESTABLE";
  if (status === "PRESENT") present += 1;
  else if (status === "NEEDS-EYE") needsEye += 1;
  else if (status === "UNTESTABLE") untestable += 1;
  else absent += 1;

  console.log(`\n${status}  ${testCase.shape} @${testCase.size}mm  (band ${testCase.band})  [claim source: ${testCase.source}]`);
  console.log(`   canon: ${testCase.canon}`);
  console.log(`   region claim: ${testCase.region.label}  [${testCase.region.kind}]`);
  console.log(`   candidates examined: ${candidateTotal}${structuralOnly ? `   structural-match-but-region-failed: ${structuralOnly}` : ""}`);
  for (const line of hits.slice(0, 6)) console.log(`   ${line}`);
  if (!hits.length) console.log(`   no candidate matching the canon structure within the tested anchors and origins`
    + (status === "UNTESTABLE" ? " — but the claim itself is unverified, so this is not an engine finding" : ""));
}

console.log(`\n${present} confirmed · ${needsEye} structurally present, region needs the eye · ${absent} NOT FOUND within the tested anchors · ${untestable} untestable (unverified claim) · of ${CASES.length}`);
console.log("NOT-FOUND is never a proven engine failure: the refined-sample anchor is non-exhaustive and the\nlawful origin domain is unsettled, so absence here is absence WITHIN what was tested.");
console.log("NOT A VERDICT until QA'd. NEEDS-EYE closes by rendering the candidate on the page against Dan's screenshot.");
