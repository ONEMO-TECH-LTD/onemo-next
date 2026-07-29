# KAI-9836 — silent-approximation audit

## Authority and scope

Source authority was read before edits:

- `grid-laws.md` — 859 lines;
- `briefs.md` — 1,409 lines;
- `ERRORS.md` — 148 lines;
- every inventoried engine, vector, preset, generator, editor, render, payload
  and export producer plus its immediate consumer.

The governing physical limit is imported from source:
`MANUFACTURING_TOLERANCE_MM = 0.05`. This task classifies every candidate:

- **A** — proved within authority, or proved not to replace manufacturing truth;
- **B** — bounded correction with a failing witness before the edit;
- **C** — unbounded or definitional work, named and left out of this build.

No generator, solver, curated preset or imported SVG was silently rewritten.

## Full-read record

Engine and vector sources read in full:

- `grid-core.ts`, `grid-prepared.ts`, `geometry-truth.ts`,
  `effect-calibration.ts`, `rounded-square.ts`, `offset.ts`, `mesh.ts`,
  `contour.ts`, `payload.ts`, `outline-resolve.ts`, `prepare-effect.ts`,
  `grid-audit.ts`;
- `vector-core/path.ts`, `ops.ts`, `clipper-kernel.ts`, `paper-kernel.ts`;
- `shape-library/bake.ts`, `baked.ts`, `defs.ts`, `index.ts`;
- `export/svg-mm.ts`, `svg-import.ts`, `index.ts`;
- v5.3.1 `shapes.ts`, `producers.ts`, `shape-pick.ts`, `OutlineEditor.tsx`,
  `ShapedModel.tsx`, and the grid-lab page and renderer.

The affected test files and immediate adjacent tests were also read in full
before RED design.

## Executable inventory

Run:

```bash
npx tsx --tsconfig tsconfig.json scripts/grid-remediation/kai-9836-approximation-audit.ts
```

The command fails loud if a bounded path exceeds the imported tolerance or if a
named C witness disappears without being reclassified.

## Dispositions

| Candidate | Type | Evidence and disposition |
|---|---:|---|
| Manufacturing vector flatten | B | At 310mm, a 100px product-circle source measured `0.05051778174642748mm` against the public contour path. Removing the pixel floor reduces the same witness to `0.012668180355855223mm`. |
| Shaped-model display flatten | B | The renderer repeated the same scale error with a `0.01px` floor. It now derives only from `DISPLAY_TOLERANCE_MM / mmPerPx`; the boundary guard fails if the pixel floor returns. The heart path independently measures `0.002988321769784527mm` maximum error against the imported `0.004mm` display limit. |
| Product-circle small-size point floor | B | Output remains 96 points through Ø174. The value moved from an inline engine literal to `DEFAULT_CIRCLE_TESSELLATION_CALIBRATION`, and enters the policy signature. No circle geometry changed. |
| Manufacturing round offsets | B | Clipper's default angular resolution measured `0.1402208617147096mm` sagitta at a legal 70mm round offset and `0.620247mm` at 310mm. The imported physical budget now drives Clipper; the 70mm witness is `0.025210679131021152mm`. |
| Adaptive cubic flatten depth 18 | A | Production manufacturing and display calls now supply physical tolerances. The public-path witnesses terminate by flatness, not the depth ceiling, and remain within their imported budgets. |
| Circle cubic source plus manufacturing flatten | A | At the 310mm ceiling, final true-circle radial error is `0.049510337mm`, within authority. KAI-9827's tolerance-derived grid circle remains the plan definition. |
| Grid candidate de-duplication at 0.01mm | A | `toFixed(2)` is a 0.01mm engine-space identity threshold, below the 0.05mm authority. It does not replace the contour. |
| Payload integer-micron quantization | A | Geometry and physical fields quantize at `0.001mm`, fifty times finer than authority; the integer representation is the canonical payload contract. |
| SVG manufacturing serialization | A | Path coordinates emit at `0.0001mm`; document dimensions emit at `0.001mm`. The `0.5px` flatten is used only to decide winding and never replaces emitted Bézier curves. |
| Grid-lab `toFixed(2)` paths and readouts | A | Render-only strings and SVG display coordinates. Worker plans and manufacturing payloads retain the source mm values. |
| Mesh edge-profile segments | A / non-authority | They tessellate the visible 3D lip from the already-authoritative contour and do not feed sizing, grid planning or manufacturing cut geometry. |
| Marching-squares half-pixel points | A / source fact | The binary pixel mask is the source for uploaded raster/Magic contours; half-pixel crossings are its defined boundary, not a hidden polygon replacing an analytic shape. |
| Editor straighten/radius polygon operations | A / authored output | These are explicit user operations whose resulting path becomes the shared preview/manufacturing source. Their display-space sampling does not masquerade as a separate analytic product shape. |
| Frozen curated preset vectors | A / product data | Runtime uses committed, reviewed vectors. Against retired formula generators at 310mm, differences are pinched `0.146851mm`, sparkle `0.145768mm`, teardrop `0.217619mm`, asterisk `0.198669mm`, bowtie `0.134590mm`; those formulas are bake provenance, not live truth. Replacing the vectors would redefine approved products. |
| Procedural generators | C — KAI-9839 | Actual Creator vector→contour worst witnesses at 180mm: form `0.7317219968555039mm`, blob `0.448468028311269mm`, daisy `0.8043453136258882mm`, pinwheel `0.5940254606861878mm`. Both fixed source rings and later curve fitting contribute; raising counts alone would be false. Dan must settle formula truth versus accepted WYSIWYG output. |
| SVG-import bbox normalization | C — KAI-9841 | `shapeBBox(shape, 0.1)` uses arbitrary uploaded-source units. A valid asymmetric cubic fits to `725.793px` instead of the `720px` box: `2.494345053095458mm` overshoot at a 310mm placement. Exact cubic extrema or a separately scoped physical fit contract is required. |
| `deepestPoint` bbox/24 scan | C — KAI-9840 | Unbounded scan, but its only source consumer is the single-anchor fallback. It stays out of this build and is checked against the single-anchor removal before any solver work. |
| `grid-audit.ts` synthetic blob and stale fixtures | C — KAI-9828 | Characterization/audit data, not the Creator producer. Rebuilding the audit is already owned last in the sprint. |

## RED → green record

### Manufacturing flatten

Before:

```text
geometry-truth.test.ts
1 failed / 10 passed
expected 0.05051778174642748 to be <= 0.05
```

After: `0.012668180355855223mm`.

### Display flatten

Before:

```text
grid-boundary.test.ts
1 failed / 11 passed
found Math.max(0.01, DISPLAY_TOLERANCE_MM / k)
```

After: source guard and render tests pass with only the physical expression.
The render-cost test also samples every heart Bézier against the emitted display
polyline and measures `0.002988321769784527mm` maximum error.

### Manufacturing round offset

Before:

```text
offset.test.ts
1 failed / 6 passed
expected 0.1402208617147096 to be <= 0.05
```

After: `0.025210679131021152mm`.

## Product behavior

- Manufacturing curves and large round offsets no longer exceed the physical
  approximation authority.
- Circle output is byte-identical; only the representation calibration's
  provenance and cache policy identity changed.
- Generator, imported-SVG and single-anchor questions remain visible as named
  work, not hidden behind green tests.

## Per-shape optimal-size gate

The executable inventory re-resolves every published Auto/light geometric rung
with growth disabled. Every multi-anchor rung has `uncoveredMM = 0`:

| Shape | Published ladder |
|---|---|
| square | `22/1 · 70/4 · 118/8 · 166/12 · 214/16 · 262/20 · 310/25` |
| circle | `23/1 · 71/2 · 119/4 · 174/8 · 215/9 · 263/14 · 310/16` |
| triangle | `39/1 · 135/4 · 231/9` |
| diamond-shape | `32/1 · 80/2 · 128/5 · 176/8 · 224/12 · 272/16` |

Format is `sizeMM/points`. The task changes no rung or anchor count.

## Historical proof status

The frozen pre-split parity, T2 lattice oracle and T4 projection artifact are
not current gates for this build:

- `t2-literal-parity.ts` reports 960 differences against the 399adf
  pre-remediation engine;
- `t2-lattice.ts` expects 412 multi-anchor passes but staging already produces
  428;
- `t4-manufacturing-readiness.ts --verify` reports that its tracked artifact
  does not match the current engine.

The latter two reproduce unchanged at clean staging `a83e0ac`, before this
task's edits. They were not edited to manufacture green; KAI-9828 owns the
permanent audit rebuild after the remaining engine work.

## Live bench observation

The profiled Chrome extension was installed and enabled in its selected profile,
and its native host was valid, but the browser channel remained unavailable
after the required retry. The standing fallback was therefore used and is not
misreported as Chrome evidence.

Playwright observed `http://localhost:3970/effect-creator/grid-lab` from source
commit `271fbd6`:

- server PID `38475`, cwd = the `grid-lab` worktree;
- Circle S rendered at `71mm`, standard/48, `tier 2pt · seated 2`;
- the curve was visibly smooth, both panels rendered, and the page returned no
  console errors or warnings;
- screenshot:
  `.playwright-cli/page-2026-07-29T19-37-19-971Z.png`.

## Gates

- [x] executable approximation inventory — PASS;
- [x] targeted tests — 68 passed, 1 todo;
- [x] full suite — 452 passed, 10 skipped, 1 todo;
- [x] TypeScript — exit 0;
- [x] lint — exit 0, 214 pre-existing warnings, 0 errors;
- [x] production build — exit 0;
- [x] device performance — T1/T2 PASS on all three WebKit scenarios;
- [x] per-shape optimal-size confirmation — every multi-anchor rung has zero
  uncovered millimetres;
- [x] post-edit self-audit — every changed source, test, script and this ledger
  re-read in full;
- [x] live bench observation on `:3970` from named source commit `271fbd6` —
  Playwright fallback, explicitly not profiled-Chrome evidence.
