# Shape-Layout Library — Technical Specification
(lands as src/lib/effect/library/shape-layout-lib-spec.md, beside the law)

The LAW (shape-layout-lib-architecture.md) says what must hold and how it is enforced.
THIS document says how the library works and what it emits. Written at 11af898e against the
source as read, not as planned.

## 1. Purpose

A catalogue of magnet-disk layouts materialised at an explicit 24, 48 or 96mm lattice pitch.
Current frames contain up to six lattice lines on one axis (rectangle includes 4x6 and 5x6).
Each layout emits disk centres plus a derived outline for review and classifier matching.
CatalogueEntry is the library's frozen output contract. The admin Library and Bench reuse the
same Stage/canvas shell; Bench does not consume CatalogueEntry. Engine consumption is pending.

## 2. Module map (zone -> files)

  0 contracts   types.ts (FrameExtent, LibraryFrame/Layout, LibraryTransform, LibrarySelection,
                PointMM, LibraryFamily) · class-contract.ts (OutlineRecipe, ClassVariant,
                ClassSpec, ClassControls, LibraryClass, DraftShape/Identity)
  1 corpus      corpus-square/rectangle/diamond/triangle.ts — literal readonly data
  2 geometry    transforms.ts (transformLayout, canonicalNode, viewName) · geometry.ts
                (convexHull, rotateAround) · outline.ts (THE producer) · rules.ts
                (spacing samplers box96/ring96/sample96, withSpacingModes)
  3 classes     registry-class.ts (shared constructor) · square/rectangle/diamond-class.ts ·
                triangle-class.ts + triangle-types.ts + triangle-frames.ts +
                triangle-geometry.ts (the triangle package's own lattice math)
  4 registry    class-registry.ts — CLASS_SPECS (sole registration source), derived
                LIBRARY_FAMILIES, fail-loud specOf()
  5 services    selection.ts (resolveSelection, selectVariant, draft naming) ·
                materialize.ts (materializeResolved -> MaterializedLibrary) ·
                options.ts (panelOptionsResolved -> PanelOptions) · authoring.ts
                (startAdd/startEdit/saveEdit/deleteEdit/toggleNodeAt) · drafts.ts ·
                catalogue.ts · integrity.ts
  6 surface     surface.ts — librarySurface(): the ONE call the page makes
  7 barrel      index.ts — the exact public export list
  8 shells      LibraryPanel.tsx (options in, chips out) · page.tsx library region (React
                state only) · grid-magnet-library-bridge.ts (record -> engine Contour/GridResult)

Imports flow downward only; enforced by the AST gate in architecture-gates.test.ts.

## 3. Core concepts

- FRAME: a cols x rows lattice patch carrying named LAYOUTS (populations of disk nodes,
  y-DOWN integer lattice coordinates). Registry classes list frames literally in their corpus;
  the triangle materialises one frame per geometry (its three vertices + derived populations:
  corners / perimeter / full).
- PITCH: physical lattice spacing in mm (24/48/96 supported). Frames are only meaningful AT a
  pitch: the 96mm spacing mode is a physical distance, sampled per pitch by the class's
  sampler (box96 for rings, ring96 for the diamond, sample96 runs). PITCH is explicit for every
  physical lattice-to-mm conversion and pitch-dependent population; dimensionless topology
  remains pitch-free by design (law 5).
- VIEW: one of 8 lattice symmetries (transpose/flipX/flipY). Presented view IS 0 degrees;
  button names are relative turns, plainest transform wins.
- SELECTION { classId, frameKey, layoutId, geometryId?, view }: stable IDs only, never
  indices. Unknown ids throw (law 13).
- VARIANT: one offer of a class — its frame, presented view, OutlineRecipe
  { corners: sharp|round|bevel, pointRotationDeg? } and the selection fragment reaching it.
- DRAFT: a hand-authored population, browser-local (localStorage DRAFT_STORE_KEY), identity
  draft:<class>:<frame>[:<geometryId>]:<name>. Never mutates the corpus.

## 4. Data flow

  selection
    -> specOf(classId).variantOf(sel, pitch)          fail-loud identity, frame at THIS pitch
    -> resolveSelection: + draft lookup, safe layoutId
    -> materializeResolved:
         transformLayout(frame, layout, view)          integer, view space
         y-flip to mm: [ix*pitch, (rows-1-iy)*pitch]   mm, y-UP from here on
         outlineFromLayout(nodesMM, recipe, boundaryOf?)
    -> MaterializedLibrary { classId, sourceFrameKey, frameKey, frameCols/Rows, layoutId,
         nodesMM, outlineMM, error, seedMM }
  page: ONE librarySurface() = { classId, materialized, options, isDraft }
        ONE libraryStageModel(materialized) via the bridge -> Stage render
  authoring: pure transitions in authoring.ts; save validates via the class
        (bounds/duplicates everywhere; triangle also requires exactly 3 hull corners).

## 5. THE OUTLINE RULE (one producer)

outlineFromLayout(nodesMM, recipe, boundaryMM?):
  path   = boundaryMM (ordered, for concave shapes like the future H) else convexHull(nodesMM)
  1 pt   -> Clipper open-path cap: round => circle (r = 12mm), square => 24mm square;
            pointRotationDeg rotates the square cap about the disk (square class 0deg,
            diamond class 45deg -> 33.94mm corner-up) — Dan's ruling: same disks under a
            different outline orientation are DIFFERENT products.
  2 pts  -> open path with caps (round => pill)
  >=3    -> closed polygon offset
  offset = RELEASED_PADDING_MM (12mm — built into the magnet, the only padding, one home in
           grid-magnet-spec.ts). Joins: sharp = miter, UNBOUNDED limit (a triangle corner is a
           real 3-point corner, clearance exactly 12.000mm); round; bevel. offset.ts
           SCALE = 1000 (integer microns), manufacturing tolerance 0.05mm.

## 6. THE CATALOGUE — classifier input format (FROZEN, V1)

CATALOGUE_FORMAT_VERSION = 1. catalogue(pitchMM) enumerates every class x type x variant x
layout through the SAME materialisation path and returns readonly, Object.frozen records:

  CatalogueEntry = Readonly<{
    classId:  string     registered class ('square'|'rectangle'|'diamond'|'triangle'|...)
    typeId:   string     product type within the class (e.g. 'pyramid', 'slim', 'box')
    id:       string     STABLE identity: classId/typeId/variantId/layoutName/T/X/Y
                         (view flags t|n, x|n, y|n), each part URI-encoded.
                         163 ids at V1; identical set at every pitch; never reused.
    label:    string     human chip text: '<variant label> · <layout>'
    pitchMM:  number     lattice pitch this record was materialised at (24|48|96)
    corners:  'sharp'|'round'|'bevel'
    nodesMM:  readonly [x,y][]   disk CENTRES, mm, y-UP, origin = frame node (0, rows-1)
    outlineMM: readonly [x,y][]  closed ring, mm, y-UP, same space as nodesMM; offset 12mm
                                 from the hull/boundary — boundary disks attain the 12mm
                                 minimum exactly, interior disks sit farther in
    widthMM:  number     outline bounds (max-min x)
    heightMM: number     outline bounds (max-min y)
    frameCols: number    frame identity AFTER the view transform
    frameRows: number
  }>

Guarantees, each with a standing executable gate: exact compile-time shape (Equal<> +
readonly); exact 12 runtime keys on every record; recursively data-only + JSON round-trip
clean; per-id semantic identity frozen in __tests__/fixtures/catalogue-identity.v1.json
(id, classId, typeId, corners, frameCols/Rows, sorted 48mm nodesMM) — list ORDER is not
identity; matcher round-trip. Changing ANY of these is a Dan ruling.

## 7. Classifier consumption (engine side)

grid-magnet-library-catalogue.ts:
  classifiedLibraryCatalogue(pitch) -> [{ entry, shapeClass: classifyShape(outlineMM, pitch),
                                          shapeFamily: shapeFamilyOf(outlineMM) }]
  catalogueCandidates(outer, pitch) -> entries whose (shapeFamily, cx, cy) equal the query's.
classifyShape reads the outline's bounding box into axis classes cx/cy (class n floors at
24 + (n-1)*pitch); shapeFamilyOf splits square/round/triangle by fill ratio + corner
occupancy. KNOWN LIMITS (classifier audit 2026-08-26): the match key is coarse (avg 9.5
candidates per query, diamonds ~16); a pill classifies family 'square'; half of ShapeClass's
fields have no consumer. Classifier repair is a separate, unstarted lane.
STATUS (verbatim constant): "catalogue contract landed; runtime consumption pending" — the
solver does NOT consume the catalogue until Dan authorises that wiring.

## 8. Adding a class (the whole recipe)

1. One class package: its corpus (literal readonly data) + one file exporting a LibraryClass —
   registry classes via registryClass(config); a geometry class implements the contract
   directly (triangle-class.ts is the model). Concave shapes state boundaryOf (ordered ring);
   round shapes state corners:'round' in the recipe.
2. One line in class-registry.ts CLASS_SPECS.
Nothing else: LIBRARY_FAMILIES derives, the zone gate recognises class packages by filename
convention, forbidden class-id comparisons derive from CLASS_SPECS keys, the UI renders it,
and the catalogue enumerates it. The gates fail anything that reaches wider.
