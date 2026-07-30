# KAI-9843 Builder Ledger

Status: Building
Base: `8b88e410a09301700bae8f4d770d6bd4180dceb3` (KAI-9790 head)

## Mission

Replace size-first millimetre scanning with grid-first construction derivation for geometric catalogue rungs. Every rung must carry the full construction that the delivered plan uses. Preserve the law-true lattice, padding, coverage, gravity and edge-classification machinery.

## Acceptance

- Independent QA harness: A2/A3 baseline `5/1`; A1 was withdrawn as a pre-condition
  after Builder proved its scalar population proxy false. A1 returns as a full-construction
  post-condition.
- Square canon byte-identical: `22 · 70 · 118 · 166 · 214 · 262 · 310`.
- Circle, triangle and diamond-shape changes reported as explicit before/after construction tables.
- Scanner and its “not grid-first” markers removed.
- Full suites, typecheck, lint, production build, device performance, real browser Worker oracle and live `:3970` observation executed by Builder.

## Full-read checklist

- [x] `ERRORS.md`
- [x] Current `grid-laws.md`
- [x] Current `briefs.md`
- [x] QA-owned `kai-9843-solver-acceptance.ts`
- [x] `src/lib/effect/grid-core.ts`
- [x] Direct engine/transport callers
- [x] Page/hook consumers
- [x] All affected tests and evidence scripts
- [x] Post-edit full re-read of every changed file

## Checkpoints

### 2026-07-29 — Start

- Linear KAI-9843 read in full and moved to Building.
- Branch starts at the exact KAI-9790 implementation head while its independent Meta/merge gate runs.
- No product source edited before full hydration.

### 2026-07-29 — Baseline and oracle correction

- Independent harness reproduced its filed baseline: A1 `2/18`, A2 `5/18`, A3 `1/18`.
- Tracked report: `scripts/grid-remediation/kai-9843-solver-report.ts`.
- The A1 proxy was false. It equated population with count + pattern + pitch:
  - circle `173→174`: strict sizing stays `8pt standard/48` but its grid extent changes `118→166`.
  - circle `219→220`: strict sizing changes `8pt/166 → 10pt/214`; delivery re-solving masks both as `8pt/166`.
- Expert and QA accepted the finding. A1 is withdrawn until the rung exposes the full population.
- The remaining defect is sharp: ladder sizing uses strict `pad+frame=11`, while the plan independently
  re-solves at the `10mm` delivery floor and may choose a different pitch, population or translation.

### 2026-07-29 — Minimal implementation decision

- Rejected: copying the scanner's selected anchors forward while keeping the `sizeMM++` scan.
- Selected: enumerate canonical lattice extents, solve the first legal construction across the
  configured production domain, and serialize pattern + pitch + origin + integer population.
- The existing grid, padding, coverage, gravity and edge-classification machinery stays authoritative.
- RED established in `grid.test.ts`: `square/ONE has no construction`.

### 2026-07-29 — Monotonicity checkpoint

- New acceptance: a larger geometric shape cannot produce a smaller derived grid extent. Published
  construction extents must be monotonic non-decreasing across the full supported size range.
- Exact pre-solver diagnostic output at `8b88e410a09301700bae8f4d770d6bd4180dceb3`:

```text
MONOTONIC	square	67:22->68:0,287:262->288:214
MONOTONIC	circle	144:118->145:0,163:118.00000000000001->164:118,168:118.00000000000001->169:118,170:118.00000000000001->171:118,172:118.00000000000001->173:118,174:166->175:118.00000000000001,175:118.00000000000001->176:118,179:166->180:118.00000000000001,181:118.00000000000001->182:118,183:166->184:118.00000000000001,184:118.00000000000001->185:118,186:166->187:118,188:118.00000000000001->189:118,225:214->226:166,269:262->270:214,299:262->300:0
MONOTONIC	triangle	83:22->84:0,186:118.00000000000001->187:118,188:118.00000000000001->189:118,199:118.00000000000001->200:118,203:118.00000000000001->204:118,207:118.00000000000001->208:118,212:118.00000000000001->213:118,221:118.00000000000001->222:118,223:118->224:0
MONOTONIC	diamondShape	96:70->97:0,135:118->136:70,144:70->145:0,174:118->175:0,192:166->193:0,231:214->232:166,240:166->241:0,270:214->271:0,288:262->289:0
```

- The tiny `118.00000000000001 -> 118` entries are representation noise. The zero collapses and
  `166 -> 118`, `262 -> 214`, `118 -> 70`, and `214 -> 166` drops are real scanner failures.
- The earlier peer readback attributed `135→136` and `231→232` to triangle. The executable output
  shows those two drops belong to `diamondShape`; the ledger preserves the executed source of truth.

### 2026-07-29 — Grid-first construction checkpoint

- Catalogue derivation now enumerates extents `22 + n·48`, then exhausts the configured integer-mm
  production domain for the first covered construction. The old size-first catalogue scanner and its
  characterization test are gone.
- Every rung carries `pattern`, `pitchMM`, `originMM`, two basis vectors and whole-number population
  indices. Plan delivery validates and consumes that exact construction; worker warm seeds carry it.
- Acceptance report: construction identity `0`, advertised/delivered mismatch `0`, off-lattice extent
  `0`; monotonic `yes` for square, circle, triangle and diamond-shape.

Visible product Auto/light before → after:

| Shape | Rung | Before | After |
|---|---|---|---|
| square | ONE | 22 · 1 · std48 | 22 · 1 · std48 |
| square | S | 70 · 4 · std48 | 70 · 4 · std48 |
| square | M | 118 · 8 advertised / 4 delivered | 118 · 4 · std96 |
| square | L | 166 · 12 · std48 | 166 · 12 · std48 |
| square | XL | 214 · 16 advertised / 8 delivered | 214 · 8 · std96 |
| circle | ONE | 23 · 1 · std48 | 24 · 1 · std48 |
| circle | S | 71 · 2 · std48 | 72 · 2 · std48 |
| circle | M | 130 · 6 · std48 | 158 · 4 · std96 |
| circle | L | 174 · 8 advertised / 4 delivered | 168 · 6 · std48 |
| circle | XL | 220 · 10 advertised / 8 delivered | 224 · 4 · std96 |
| triangle | ONE | 39 · 1 · std48 | 40 · 1 · std48 |
| triangle | S | 135 · 4 · std48 | 136 · 4 · std48 |
| triangle | M | 231 · 9 advertised / 5 delivered | 260 · 4 · std96 |
| diamond-shape | ONE | 32 · 1 · std48 | 32 · 1 · std48 |
| diamond-shape | S | 80 · 2 · std48 | 80 · 2 · std48 |
| diamond-shape | M | 128 · 5 · std48 | 128 · 5 · std48 |
| diamond-shape | L | 176 · 8 · std48 | 176 · 8 · std48 |
| diamond-shape | XL | 224 · 12 · std48 | 224 · 4 · std96 |

- Square physical canon remains byte-identical: `22 · 70 · 118 · 166 · 214 · 262 · 310`.
- Rectangle combines its two axis rungs into one exact serialized construction; the full reachable
  axis matrix has a construction.

### 2026-07-29 — Cross-engine construction identity

- The first full-suite run exposed one real representation defect: Node and WebKit produced the
  same circle rung outcomes but different serialized constructions. At `L`, equal-law phases chose
  90° twins; other rungs carried identical point sets in different order with last-bit origins.
- This was not re-baselined away. Candidate coverage/balance comparisons and construction
  coordinates now canonicalize at `MANUFACTURING_TOLERANCE_MM / 1000` — one thousandth of the
  source tolerance, representation-only. Population indices sort lexicographically.
- Direct Node and WebKit ladder JSON now match byte-for-byte. After Dan's even-size ruling the
  intentional catalogue change moved the shared hash to:
  `sha256 f3135936d08b27c1b74ca3685e59792fe035331fd5c2983079b29b1f93d5a51f`.
- The complete 4-shape × 6-mode/pitch × 2-density construction suite remains green after
  canonicalization; no product rung or square-canon size moved.

### 2026-07-29 — Consumer self-audit

- Found before commit: the page forwarded the nearest catalogue construction even when the admin
  `Snap test size to grid` control was off. That would have forced an arbitrary/freeform contour
  onto a rung instead of using adaptive resolution.
- Fixed at the ownership seam: exact construction is sent only while snapping is enabled. A boundary
  guard pins the condition. Live Generator verification with snapping off returned ready at
  `design 180mm + 3mm margin (+3 auto)`, proving the adaptive path remains reachable.

### 2026-07-30 — Solver self-falsification

- The mandatory post-edit read rejected the first optimization before commit. It assumed each fixed
  extent's acceptance predicate was one false→true interval and used exponential probes + bisection.
- A temporary exhaustive probe across four geometric shapes × five explicit pattern/pitch families ×
  two densities proved seven disjoint predicates. Witness: circle Light, Standard/48, extent `118`
  accepts `130–144`, rejects `145–157`, then accepts again `158–165`.
- The probe also disproved the initial `extent + 47` search ceiling in seven cases. Witnesses:
  square Light, Diamond/48, extent `118` first accepts at `192` (old ceiling `165`);
  diamond-shape Light, Diamond/48, extent `70` first accepts at `128` (old ceiling `117`).
- The unsound optimization and false ceiling are deleted. The extent is still the outer catalogue
  authority; each legal combo now exhausts the ordered integer sizes through `maxRungMM` and takes
  the first covered construction. Re-running the exhaustive oracle reports `missingFirst: 0`.
- The probe/export were temporary and removed from the land set.
- Authority gap escalated rather than invented: neither `grid-laws.md` nor `briefs.md` specified
  physical catalogue-size quantization. Dan ruled directly: publish **upward to the next even whole
  millimetre**. A shape must never be smaller than its grid; an odd size puts its centre on a
  half-millimetre that cannot be placed repeatably on fabric. Exact geometry stays internal, while
  seating and coverage are re-evaluated at the published even size.
- RED proved the gap materially: circle `ONE` published at odd `23mm`. After the ruling, the complete
  geometric catalogue publishes even sizes; square canon is unchanged, circle becomes
  `24 · 72 · 158 · 168 · 224…`, and triangle becomes `40 · 136 · 260…`.

### 2026-07-29 — Executed gates

- Acceptance report: `A1 construction identity 0`, `A2 advertised/delivered 0`,
  `A3 off-lattice extent 0`; all four shapes `MONOTONIC yes`.
- Full suite: `457 passed / 10 skipped`, 47 passed files + 1 intentionally skipped integration file.
- Typecheck: exit `0`. Lint: exit `0`, `0` errors / `214` pre-existing warnings.
- Production build: exit `0`, `/effect-creator/grid-lab` generated.
- Device performance, real WebKit 26.0:
  - canonical circle ladder: `269ms cold / 0ms warm`, T1/T2 PASS;
  - dense real-AI plan: `78ms / 1ms`, T1/T2 PASS;
  - small square plan: `37ms / 0ms`, T1/T2 PASS.
- Real headed Chromium Worker oracle: PASS `6/6`, including seeded plan cache hits for all
  attachments and physical pre-emption.
- Mutation 1: bypassing exact-construction delivery failed the construction-identity test on the
  first mismatched population; restored green.
- Mutation 2: collapsing the 118mm extent to 22 failed the monotonic test with
  `square/standard/48 collapsed 70 -> 22`; restored green.
- Live headed Chrome on `localhost:3970`, served from this grid-lab worktree:
  - square S `70mm / 4 / standard`;
  - circle S `72mm / 2 / standard`;
  - triangle S `136mm / 4 / standard`;
  - diamond-shape S `80mm / 2 / standard`;
  - diamond-shape XL `224mm / tier 4 / seated 4 / standard`, screenshot
    `output/playwright/kai-9843/kai-9843-diamond-xl.png`;
  - Dan-ruling follow-up: circle S `72mm / 2 / standard`, triangle S
    `136mm / 4 / standard`, screenshot
    `output/playwright/kai-9843/kai-9843-even-triangle.png`;
  - zero console errors on the valid `localhost` origin.
