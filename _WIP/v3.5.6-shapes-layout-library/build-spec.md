# [Kai][BUILD] Library root-fix — THE sole executable prescription

Your ONLY instruction sources are this file and /tmp/s62-architecture-draft.md (the law; you
land it as src/lib/effect/library/shape-layout-lib-architecture.md). Historical files
(s62-library-root-fix-proposal-1fa641a5.md, s62-lead-adoption-of-root-fix.md,
s62-qa-d94152a1-and-architecture-hardening.md, s62-qa audit) are EVIDENCE for context only —
nothing in them is executable by reference. If THIS spec conflicts with source at head, stop
that block and report; never improvise.

## Protocol
- HARD (Dan, 2026-08-26): you may NEVER stop at the prompt without first sending your report —
  DONE with sha + pasted gates, or BLOCKED with evidence. Finished-but-silent is the same
  violation as stalling. The lead runs a pane/branch monitor; an idle lane without a sent
  report is nudged, then escalated.
- You are @s62-pixel-builder. Report only to @s62-lead, prefix [Builder]. No Linear writes. No
  scope beyond this spec.
- Own clone: from ~/Dev/onemo-dev/onemo-next run
  `git worktree add .codex/worktrees/pixel-builder-rootfix -b session62-task/library-rootfix d94152a1`.
  You own its removal at end of run. NEVER edit .claude/worktrees/v3.5.6-lead; NEVER touch the
  server on port 4046.
- One commit per step, push each to origin session62-task/library-rootfix only. Never
  staging/main; no --squash/--admin/--auto.
- Pre-commit gates, every step: full `npx vitest run src/lib/effect` green, `npx tsc --noEmit`
  clean, eslint clean on touched files, ALL ACTIVE architecture gates green. A gate whose
  production prerequisite arrives in a later named step is test.todo with that step number in
  its title, activated in that step's commit. After Step 5: zero todos. Report wording: "all
  active gates green", never "fully green" while todos remain. Paste real output.

## STEP 1 (commit A) — the law, its gates, and current-head repairs, one commit
Land src/lib/effect/library/shape-layout-lib-architecture.md (verbatim from the draft) and
src/lib/effect/__tests__/architecture-gates.test.ts implementing every gate the law names:
AST import matrix (zones per the law, typescript.createSourceFile, resolved paths, type-only
edges distinguished, external allowlists), constant-ownership gate, registration invariant
(for each Object.entries(CLASS_SPECS): spec.classId === key, types nonempty, variants nonempty
at 24/48/96; LIBRARY_FAMILIES is derived and is never compared back to CLASS_SPECS), exact
retired-token list, tautology meta-gate over test files,
no React/Next/JSX in zones 0-6. Activation schedule is fixed, not inferred:
- STEP 1 active: retired-token gate, AST-tautology gate, current exact-position proof,
  and the bounded dead-export/comment/test repairs listed in STEP 1.
- STEP 2 activates contracts/classes/registry/service zones 0-5, registration invariants,
  class-policy isolation, fail-loud variant identity, readonly corpus/no sentinels,
  no React/Next/JSX in zones 0-5, and no runtime pitch default.
- STEP 3 activates constant ownership/no padMM, one outline producer, topology/size/clearance.
- STEP 4 activates LAW 0 C1-C5 and catalogue identity/matcher gates.
- STEP 5 activates surface/barrel/shell/bridge/CSS gates and the full caller-equality gate.
Every not-yet-active test title names exactly that owning step; split matrix/identity gates by
owned zone/capability where necessary — no single giant todo held until STEP 5.
Run the gates against the untouched head; record expected failures in the commit message.
Repair in the same commit, bounded to:
- grid-layout-library.test.ts:655-662: replace the tautology with
    expect(Object.keys(RAW_CLASS_FRAMES).sort()).toEqual([...REGISTRY_FAMILIES].sort())
    expect(Object.prototype.hasOwnProperty.call(RAW_CLASS_FRAMES, 'triangle')).toBe(false)
  (imports adjusted; this test is transitional and is replaced in STEP 2 when the table dies)
- grid-layout-library.test.ts:339-356: replace the count-only assertion with verbatim
  positions:
    const transformed = transformLayout(v.frame, layout, s.view)
    const expected = transformed.nodes.map(([x, y]) =>
      [x * pitch, (transformed.rows - 1 - y) * pitch] as const)
    expect(materializeSelection(s, pitch, 12).nodesMM,
      `${fam} ${v.id} ${layout.name} @${pitch}`).toEqual(expected)
  (delete the now-unused `resolved`)
- stale text: delete/replace mentions of prim:<name> (types.ts:36), LAYOUT_LIBRARY
  (drafts.ts:19), Peak/Wedge/Sail 14/17/48 (corpus-triangle.ts:5-6), "ten types"
  (triangle-frames.ts docblock), the classifier-bridge claim (rules.ts:1-2), the test-file
  header primitive promise, Peak/Sail in test names/comments
- the non-proving edge-node test (grid-layout-library.test.ts:638-651): replace with
    it('moving one corner changes the derived triangle outline', () => {
      const selection = triSel('tri:0,0;0,2;2,0', 'corners')
      const before = materializeDraft(selection, [[0, 0], [0, 2], [2, 0]], 48, 12)
      const after = materializeDraft(selection, [[0, 0], [0, 2], [2, 1]], 48, 12)
      expect(before.error).toBeNull(); expect(after.error).toBeNull()
      expect(after.outlineMM).not.toEqual(before.outlineMM)
    })
- rename libraryIntegrity to registryIntegrity (and its test title)
- delete dead exports kindOf, orientationOf; delete bridge aliases libraryArrangement and
  libraryPreview (test-only)

## STEP 2 (commit B) — class packages; contracts split from registry; OutlineRecipe
Move existing policy/helper bodies verbatim wherever their signature and ownership remain
valid. Make only the contract and identity edits explicitly listed below; preserve behaviour
through the move. Do not reimplement working geometry or population algorithms. Final owners:
  types.ts                shared domain data only
  class-contract.ts       OutlineRecipe, ClassVariant, ClassSpec, ClassControls, LibraryClass
  class-registry.ts       CLASS_SPECS + derived LIBRARY_FAMILIES + fail-loud specOf only
  registry-class.ts       shared constructor; accepts a complete class config
  square-class.ts         square policy + its corpus/config
  rectangle-class.ts      rectangle policy + its corpus/config
  diamond-class.ts        diamond policy + its corpus/config
  triangle-class.ts       triangle policy, importing its support modules
  (corpus-*.ts stay literal data; triangle support modules keep their owners)
Contracts:
  export interface OutlineRecipe {
    corners: CornerMode
    /** Square cap orientation for a single point; ignored for round points and paths. */
    pointRotationDeg?: number
  }
  export interface ClassVariant {
    id: string; label: string; accessibleLabel?: string
    frame: LibraryFrame; view: LibraryTransform
    outline: OutlineRecipe
    selection: Pick<LibrarySelection, 'classId' | 'frameKey' | 'geometryId'>
  }
  export interface ClassSpec {
    classId: LibraryFamily
    types: readonly ClassType[]
    variants(typeId: string, pitchMM: number): readonly ClassVariant[]
    variantOf(sel: LibrarySelection, pitchMM: number): ClassVariant   // fail-loud, the ONE lookup
    boundaryOf?(sel: LibrarySelection, nodesMM: readonly PointMM[]): readonly PointMM[] | undefined
    validateDraft(draft: DraftShape, frame: LibraryFrame): string[]
  }
  export interface ClassControls {
    typeOf(sel: LibrarySelection, pitchMM: number): string
    open(current: LibrarySelection, pitchMM: number): LibrarySelection
    orientations: readonly { id: string; view: LibraryTransform }[]
    baseView(sel: LibrarySelection, pitchMM: number): LibraryTransform
    draftMatches(draft: DraftIdentity, sel: LibrarySelection, frameKey: string): boolean
    draftIdParts(sel: LibrarySelection, frameKey: string): DraftIdentity
  }
  selectVariant is one STANDALONE generic transition, not a ClassControls member. It lives in
  selection.ts beside pickLayout — it calls pickLayout, so it is a zone-5 service;
  class-contract.ts contains declarations only:
    export const selectVariant = (current: LibrarySelection, v: ClassVariant): LibrarySelection =>
      ({ ...current, ...v.selection, layoutId: pickLayout(v.frame, current.layoutId),
         view: { ...v.view } })
Recipes: square singleton { corners: 'sharp', pointRotationDeg: 0 }; diamond singleton
{ corners: 'sharp', pointRotationDeg: 45 }; all current sharp multi-point variants
{ corners: 'sharp' }.
Rename shapeId -> classId on LibrarySelection AND on MaterializedLibrary:
  export interface MaterializedLibrary {
    classId: LibraryFamily
    // existing geometry fields unchanged
  }
Delete shapeId and declaredFamily from MaterializedLibrary and ALL callers — one class
identity survives everywhere. Delete LIBRARY_SHAPES, LibraryShapeId, LibraryShape.
ONE REGISTRATION SOURCE (law 4): delete the literal LIBRARY_FAMILIES array and the closed
LibraryFamily union from types.ts. In types.ts: `export type LibraryFamily = string` — the
stable external identity; validity is owned by the fail-loud registry. In class-registry.ts:
  export const CLASS_SPECS = {
    square: squareClass, rectangle: rectangleClass,
    diamond: diamondClass, triangle: triangleClass,
  } as const satisfies Record<string, LibraryClass>
  type RegisteredClassId = keyof typeof CLASS_SPECS
  export const LIBRARY_FAMILIES: readonly LibraryFamily[] =
    Object.freeze(Object.keys(CLASS_SPECS))
  export function specOf(classId: LibraryFamily): LibraryClass {
    const spec = CLASS_SPECS[classId as RegisteredClassId]
    if (!spec) throw new Error('library: unknown classId ' + classId)
    return spec
  }
Catalogue/services iterate the derived list or registry values. The registration invariant is
the non-tautological sweep (never a keys-equal-list check):
  for (const [classId, spec] of Object.entries(CLASS_SPECS)) {
    expect(spec.classId).toBe(classId)
    expect(spec.types.length).toBeGreaterThan(0)
    for (const pitchMM of [24, 48, 96])
      for (const type of spec.types)
        expect(spec.variants(type.id, pitchMM).length).toBeGreaterThan(0)
  }
Selection resolution starts from specOf(sel.classId) + spec.variantOf; delete
ClassSpec.frameOf, ClassControls.variantIdOf, per-class select.
DELETE the transitional global tables: RegistryFamily-keyed RAW_CLASS_FRAMES, REGISTRY_RULES,
registryFramesAt — their data/policy moves into the owning class packages (pitch-authoritative
behaviour preserved inside each class or the shared constructor). Replace the transitional
STEP-1 registry-key test with the non-tautological CLASS_SPECS sweep above; delete every
REGISTRY_FAMILIES / RAW-table assertion. Preserve CURRENT outline behaviour in this step
(existing outline members move, not change). The exact-position 24/48/96 test must stay green.

## STEP 3 (commit C) — the one outline producer; fixed padding
offset.ts: extract the general capability, insetRingMM delegating unchanged:
  export type OffsetEnd = 'polygon' | 'round' | 'square'
  export function offsetPathMM(pathMM, deltaMM, join: OffsetJoin, end: OffsetEnd): Pt[] | null
  — Clipper.inflatePaths, joins Miter/Bevel/Round, ends Polygon/Round/Square, SCALE 1000,
  miter limit Number.MAX_SAFE_INTEGER when join === 'sharp' (no bevel fallback), else 2;
  null on empty/degenerate.
library/geometry.ts: convexHull moved verbatim (zone 2 must not import a triangle module).
library/outline.ts:
  export function outlineFromLayout(nodesMM, recipe: OutlineRecipe, boundaryMM?): PointMM[] {
    const path = boundaryMM?.length ? [...boundaryMM] : convexHull(nodesMM)
    if (!path.length) throw new Error('library: empty population has no outline')
    const end = path.length >= 3 ? 'polygon' : recipe.corners === 'round' ? 'round' : 'square'
    const raw = offsetPathMM(path, RELEASED_PADDING_MM, recipe.corners, end)
    if (!raw) throw new Error('library: population has no outline')
    return path.length === 1 && recipe.pointRotationDeg
      ? rotateAround(raw, path[0], recipe.pointRotationDeg) : raw
  }
  (rotateAround: standard rotation about the disk centre.)
Materialisation calls exactly:
  const boundaryMM = spec.boundaryOf?.(sel, placed.nodesMM)
  const outlineMM = outlineFromLayout(placed.nodesMM, variant.outline, boundaryMM)
DELETE: stored unit outlines and their scaling, aspect handling, boxMM/boxByClassFloor,
hullOutlineMM, every padMM parameter/field on outline members, materializeSelection,
materializeDraft, bridge and page (they import RELEASED_PADDING_MM where needed;
spotRadiusOf(RELEASED_PADDING_MM) in the bridge). Triangle chip size measures
outlineFromLayout output.
Preserved sizes (manufacturing tolerance on derived/round): 1x1 square 24x24 edge-up; 1x1
diamond 24 * Math.SQRT2 corner-up; slim 1x5 216x24; square 3x3 120x120; diamond 3x3 raw size
= 2 * (48 + RELEASED_PADDING_MM * Math.SQRT2) (= 129.9411…, rounded UI label 130x130); every
triangle exactly 3 corners clearing 12mm. Activate the topology gate:
point-round (circle 24), point-square 0deg, point-square 45deg (edge-vs-corner
counterexample, outputs unequal), line-round (pill 72x24), convex, acute 3-corner, ordered
concave H (notches intact, >4 vertices). Route the existing triangle clearance sweep through
outlineFromLayout.

## STEP 4 (commit D) — the frozen catalogue and the matcher
library/catalogue.ts:
  export const CATALOGUE_FORMAT_VERSION = 1
  export type CatalogueEntry = Readonly<{
    classId: LibraryFamily
    typeId: string
    id: string
    label: string
    pitchMM: number
    corners: CornerMode
    nodesMM: readonly PointMM[]
    outlineMM: readonly PointMM[]
    widthMM: number
    heightMM: number
    frameCols: number
    frameRows: number
  }>   // exact V1 — identical to the law's declaration
  export function catalogue(pitchMM: number): readonly CatalogueEntry[]
  — enumerate LIBRARY_FAMILIES x types x variants x frame.layouts through the SAME
  materialisation path (law 12); id = encodeURIComponent parts joined '/'; corners =
  variant.outline.corners (the recipe itself is internal — no thirteenth field);
  width/height from outlineMM bounds.
Engine side grid-magnet-library-catalogue.ts: classifiedLibraryCatalogue(pitchMM) mapping each
entry through classifyShape + shapeFamilyOf, and catalogueCandidates(outer, pitchMM) filtering
by shapeFamily + cx/cy equality. NO solve.worker changes. Status wording exactly:
"catalogue contract landed; runtime consumption pending".
Activate LAW 0's five gates: Equal<> exact-type + readonly-keys assertion; exact runtime keys
on every entry at 24/48/96; recursive data-only + JSON round-trip; the checked-in manifest
src/lib/effect/__tests__/fixtures/catalogue-identity.v1.json (id, classId, typeId, corners,
frameCols, frameRows, sorted 48mm nodesMM; unique ids, same id set at all pitches); matcher
round-trip (finite classifier fields AND catalogueCandidates(...).some(id)). Delete the
test-local ENGINE_FAMILY map. Do NOT assert shapeFamily === classId.

## STEP 5 (commit E) — surface, conversion-only bridge, narrow barrel
library/surface.ts:
  export function librarySurface(sel, drafts, edit, pitchMM): LibrarySurface
  — resolves once; materialises draft nodes (edit ?? saved draft) or the selection; returns
  { classId, materialized, options: panelOptions(...), isDraft }.
Bridge: export function libraryStageModel(materialized, pitchMM) only; delete
draftStageModel. Page: one librarySurface useMemo + one libraryStageModel useMemo; family-tab
active from surface.classId; page imports no resolver/materialiser/options/spec. Panel:
receives options + isDraft; loses sel/drafts/pitch props and its panelOptions import; ONE Type
block class — wrapping is CSS, never option-count markup switching (law 14).
Barrel (exact, law 8): types CornerMode/LibraryFamily/LibrarySelection/CatalogueEntry/
LibrarySurface/PanelOption/PanelOptions/LibraryEdit/LibraryDraft/MaterializedLibrary; values
DEFAULT_LIBRARY_SELECTION, LIBRARY_FAMILIES, CATALOGUE_FORMAT_VERSION, catalogue,
librarySurface, selectionForFamily, startAdd, startEdit, saveEdit, deleteEdit, toggleNodeAt,
DRAFT_STORE_KEY. Tests import internals by path. Zero architecture-gate todos remain.

## Report
[Builder][STEP n DONE] per step: commit sha, gate outputs (counts, tsc, lint, active
architecture gates), deviations. After STEP 5: full summary. The lead runs the visual 4046
gate after landing; you never claim visual verification.
