# The Shape-Layout Library Law (lands as src/lib/effect/library/shape-layout-lib-architecture.md)

Dan, 2026-08-26: "establish clean coding anti-noodle-soup rules, define the scaffold for the
library and bench that can be tested and QA'd against, so I don't repeat the structural
portable/modular separation conventions." And on scope: "it cannot be architecture for all —
the build has 2 pages, library and bench; they are structured separately, pursuing different
goals. The output of the library is input into the classifier — the final, most important
artifact — needs to follow the format."

## Scope
This law governs the LIBRARY only: src/lib/effect/library/**, its panel, the library parts of
the shared page, the engine bridge, and the classifier catalogue adapter. The BENCH is a
separate structure with different goals and gets its own law when its structure is next touched.
What binds them is the CONTRACT below, not shared structure.

## LAW 0 — THE OUTPUT CONTRACT OUTRANKS EVERYTHING
The catalogue record is the product of the library and the input to the classifier. Its V3
shape is frozen:

    type CatalogueEntry = Readonly<{
      classId: LibraryFamily; typeId: string; id: string; label: string
      pitchMM: number; corners: CornerMode
      nodesMM: readonly PointMM[]; outlineMM: readonly PointMM[]
      widthMM: number; heightMM: number; frameCols: number; frameRows: number
      bandId: number; legalWidthMM: number; legalHeightMM: number
    }>

V3 added no capability the classifier has to interpret: bandId and the legal box are MEASURED off
nodesMM by one owner (rules.ts) so no consumer re-derives them, and bandId is never null because a
frame the board cannot hold at that lattice is not published at all.

Five standing gates (activated when the catalogue lands):
1. EXACT TYPE — compile-time equality of CatalogueEntry against the V3 shape via an Equal<>
   type assertion in the gate file (catches added/removed/optionalised/widened fields), plus a
   readonly-keys assertion.
2. EXACT KEYS — every produced record at 24/48/96 has exactly the fifteen keys.
3. DATA ONLY — recursive validation: no undefined, functions, symbols, bigint, getters,
   non-finite numbers or non-plain objects; JSON.parse(JSON.stringify(entry)) equals entry.
4. VERSIONED IDENTITY — CATALOGUE_FORMAT_VERSION = 3 and a checked-in manifest
   (catalogue-identity.v3.json) freezing per entry: id, classId, typeId, corners,
   frameCols, frameRows, and lexicographically sorted nodesMM. Unique ids, and the manifest is
   keyed BY PITCH: the board is a fixed 384 x 480mm of legal area, so 24mm holds 17 x 21
   positions, 48mm holds 9 x 11 and 96mm holds 5 x 6 — the three pitches legitimately publish
   different sets, and the V1 claim of one identical set across pitches described a library that
   generated frames the board could not hold. Changing type, keys, version or manifest is a DAN
   RULING, never a refactor.
5. MATCHER ROUND-TRIP — every entry's outline classifies with finite fields AND
   catalogueCandidates(entry.outlineMM, pitch) returns that entry's id. shapeFamily is NOT
   asserted equal to classId — product taxonomy and engine geometry taxonomy intentionally
   differ; the round-trip is the compatibility contract.

## Zones — one import direction, enforced on the TypeScript AST

| zone | contains | runtime imports allowed |
|---|---|---|
| 0 contracts | types.ts, class-contract.ts | type-only imports from zone 0 and approved external type modules; no runtime imports |
| 1 corpus | literal corpus-*.ts — the authored triangle geometries only; square, rectangle and diamond canon is GENERATED from the board (canon.ts, zone 2) | zone 0, type-only |
| 2 pure mechanics | geometry.ts, transforms.ts, outline.ts, rules.ts, canon.ts, selection-transition.ts | zone 0; grid-magnet-spec constants; offset.ts |
| 3 classes | one self-contained class package per class + shared constructor | zones 0-2; NEVER another concrete class package |
| 4 registry | class-registry.ts only | zones 0 and 3, registration only |
| 5 services | selection/options/authoring/materialize/catalogue/drafts | zones 0, 2, 4, same-zone services; never corpus or concrete classes |
| 6 surface | surface.ts | zones 0 and 5 |
| 7 barrel | index.ts | exact public exports from zones 0, 5, 6, plus the readonly LIBRARY_FAMILIES view derived by class-registry.ts |
| 8 shell/adapter | LibraryPanel.tsx, library parts of page.tsx, grid-magnet-library-bridge.ts, grid-magnet-library-catalogue.ts | page/panel: barrel only. Bridge: barrel, engine types, and named physical constants from grid-magnet-spec. Catalogue adapter: barrel, classifier functions, and type-only engine point types. No library internals. |

Gate mechanics: every governed file assigned to exactly one zone (unassigned or doubly
assigned fails); imports read via typescript.createSourceFile — ImportDeclaration,
ExportDeclaration with specifier, dynamic import() — type-only edges distinguished; relative
and @/ aliases resolved to real files; per-zone external allowlist, unknown externals fail.
page.tsx is gated ONLY on imports resolving into library/** or the bridge; its bench imports
are out of scope. Never regex over source lines.

## The laws

1. ONE PRODUCER PER FACT — outline: outlineFromLayout only; population: the class's
   pitch-aware frames only; size: measured from producer output, never recomputed;
   lattice-to-mm placement: placeMM/nodeAtMM only; layout-carry and variant selection:
   selection-transition.ts only. A fact needed by two zones moves to the zone both may
   import — it is never copied, and never parked in a module whose job it is not.
2. CONSTANT OWNERSHIP — identifiers matching /(PAD|PADDING|PITCH|DIAMETER|DIA).*MM/ are
   declared only in grid-magnet-spec.ts. No runtime padMM parameter or field anywhere in
   library/surface/bridge. No runtime numeric default for pitchMM.
3. NO CLASS NAME OUTSIDE ITS CLASS PACKAGE — no 'triangle'/'square'/'rectangle'/'diamond'
   comparison outside zone 3.
4. ADDING A CLASS = one self-contained class package (its corpus + policy object) + one
   class-registry.ts line. CLASS_SPECS is the ONLY class-id registration source;
   LIBRARY_FAMILIES is derived from its keys, never stored independently. Generic shared
   constructors may be reused; no global per-class switch or table may require another edit.
5. NO IMPLICIT PHYSICAL SCALE — every lattice-to-mm conversion and pitch-dependent population
   takes pitchMM explicitly; dimensionless topology takes no fake pitch; nothing
   scale-dependent computes at module load.
6. NO SENTINELS — absence is typed absence, never an empty placeholder.
7. SHELLS AND ADAPTERS STAY AT THE BOUNDARY — page/panel import the library barrel only.
   Bridge imports are limited to the barrel, engine types, and grid-magnet-spec constants.
   The catalogue adapter imports the barrel, classifier functions, and type-only engine point
   types. None may reach into library internals or repeat selection/materialisation policy.
8. THE BARREL IS THE RUNTIME CONTRACT — exact export whitelist; tests import internals by
   direct path.
9. ONE FILE, ONE JOB — enforced structurally: the zone matrix plus a ban on React/Next/JSX in
   zones 0-6. (Line counts are review guidance, not machine law.)
10. PRESENT TRUTH ONLY — an exact retired-token list greps to zero over runtime and test
    source (LAYOUT_LIBRARY, prim:, applicability, deleted type ids — maintained in the gate
    file); an AST meta-gate over test files rejects structural tautologies (expect(X).toEqual(X),
    literal-truth assertions). Comment truth beyond these exact checks is QA responsibility and
    is never claimed as machine-proven.
11. DATA IS LITERAL AND READONLY WHERE IT IS AUTHORED — corpus entries immutable (readonly
    types, as-const); derived values never stored beside their sources. What is AUTHORED is what
    a person chose: the triangle's three vertices. A frame's canon population is arithmetic off
    rows and columns and is generated, never typed out — "written out, never generated" was our
    own sentence, not a ruling (Dan, 2026-08-29: "the library can be easier set ... they can be
    generated no problem just by inputting number of rows and columns"). The gate proves the
    generator by reproducing every population it replaced, record for record.
12. ONE MATERIALISATION PATH — corpus layouts, drafts, admin preview and catalogue share the
    same variant lookup, transform, y-flip, outline producer and size measurement; gated by
    exact node/outline equality through each caller at 24/48/96.
13. IDENTITY NEVER GUESSES — unknown class/variant/frame/layout/draft ids throw; only the
    documented admin layout-carry falls back; two geometries sharing one frame and name stay
    distinct.
14. CSS, NOT DATA, CONTROLS LAYOUT — option count never chooses JSX or class names; every
    class renders the same block structure; wrapping is CSS.
15. COMPATIBLE IS NOT INTEGRATED — until the real engine caller consumes the matcher, the only
    permitted status wording is: "catalogue contract landed; runtime consumption pending".

## Product rulings encoded (Dan, 2026-08-26)
- Entry identity = disk layout + outline IN ORIENTATION. Never dedupe across classes by disks
  alone: the 1x1 square (edge-up, 24x24) and 1x1 diamond (corner-up, 24*sqrt2 = 33.94mm) are
  distinct products. Mechanism: OutlineRecipe.pointRotationDeg (0 / 45) applied by the one
  producer around the disk.
- The magnet's 12mm padding is built in and universal: one constant, no per-entry or per-call
  padding.
- (2026-08-28) THE OUTLINE IS ALWAYS THE DISKS' OWN HULL. A T, an L, an H or a plus is a
  canonical class with disks taken out, not a shape of its own — "the specifics like T and L is
  just same basic canon classes with some disks taken out". So there is no stated-boundary
  path and no concave outline: a notched population reads as the hull its extreme disks span.
  Unknown shapes are answered by the solver placing magnets into the customer's real outline,
  never by enumerating more entries; the catalogue's job is to be the CERTIFIED SET that
  generation is checked against.

Every machine-checkable rule above has a named gate in architecture-gates.test.ts. Residual
semantic claims are marked QA responsibility and are not presented as machine-proven. Change a
law and its gate together, or not at all.
