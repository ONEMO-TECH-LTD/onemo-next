# [Codex][QA-REJECT + BRAINSTORM] d94152a1 and library scaffold

## A. Step 1 gate — production fix accepted; commit not QA-clear

The production change is the right root fix. `registryFramesAt(family, pitchMM)` now composes the physical mode before selection, `layoutAt` is deleted, and materialisation consumes the selected frame's layout directly. No second pitch repair remains.

Independent proof at exact `d94152a1`:

- `src/lib/effect`: 39 files, 530/530 passed.
- `tsc --noEmit`: clean.
- Scoped ESLint: clean.
- PID 20467 serves the exact lead worktree at `d94152a1` on 4046.
- Live square 5x5 / 96mm mode produced the actual positions required by the pitch: 24mm = four corners `[[0,-96],[96,-96],[0,0],[96,0]]`; 48mm = eight positions at 96mm spacing; 96mm = all sixteen perimeter nodes. Zero console errors. Screenshots: `/tmp/s62-d94152a1-5x5-96mode-pitch24.png`, `/tmp/s62-d94152a1-5x5-96mode-pitch48.png`, `/tmp/s62-d94152a1-5x5-96mode-pitch96.png`.

Two proof defects block CLEAR:

### F1 — the commit introduced a test that cannot fail

`grid-layout-library.test.ts:655-660` now asserts:

```ts
expect([...REGISTRY_FAMILIES]).toEqual([...REGISTRY_FAMILIES])
```

That replaced the old check that triangle had no frame-registry sentinel. It proves nothing and directly violates the conformance brief.

Minimal fix:

```ts
// add to the existing import
RAW_CLASS_FRAMES,

expect(Object.keys(RAW_CLASS_FRAMES).sort()).toEqual([...REGISTRY_FAMILIES].sort())
expect(Object.prototype.hasOwnProperty.call(RAW_CLASS_FRAMES, 'triangle')).toBe(false)
```

### F2 — “same magnets” checks only the count

`grid-layout-library.test.ts:339-356` says the resolved population is the same as the rendered population, but compares only `.length`. A wrong set of positions with the same count passes.

Replace lines 353-356 with the verbatim-position gate already prescribed:

```ts
const transformed = transformLayout(v.frame, layout, s.view)
const expected = transformed.nodes.map(([x, y]) =>
  [x * pitch, (transformed.rows - 1 - y) * pitch] as const,
)
expect(materializeSelection(s, pitch, 12).nodesMM,
  `${fam} ${v.id} ${layout.name} @${pitch}`).toEqual(expected)
```

Delete `resolved`; it becomes unused. This is subtraction plus a stronger assertion, not another test layer.

**Necessity — no production change required; shrink the non-proof and strengthen the existing counterexample in place.**

**Sufficiency — Step 1 logic is delivered, but its claimed conformance proof is incomplete until F1-F2 pass. QA-REJECT.**

## B. 1x1 diamond mechanism — keep the product; counter `boundaryOf`

The ruling is correct: the 1x1 edge-up square and 1x1 corner-up diamond are distinct products even with the same single disk.

`boundaryOf` is not the clean mechanism for the diamond singleton. It represents ordered topology before padding. A one-node layout has no polygon boundary or orientation; four coincident points are degenerate, while a non-zero synthetic diamond adds an invented pre-padding size. H/double-T genuinely have ordered concave topology, so `boundaryOf` is right for them and should keep that one meaning.

The generic missing datum is orientation of a square point-cap. Add it to the variant's internal outline recipe:

```ts
export interface OutlineRecipe {
  corners: CornerMode
  /** Orientation of a square produced from one point. Ignored for round points and paths. */
  pointRotationDeg?: number
}

export interface ClassVariant {
  // existing fields...
  outline: OutlineRecipe
}
```

The one producer remains the only geometry algorithm:

```ts
const rotateAround = (
  points: readonly PointMM[], [cx, cy]: PointMM, degrees: number,
): PointMM[] => {
  const a = degrees * Math.PI / 180, c = Math.cos(a), s = Math.sin(a)
  return points.map(([x, y]) => {
    const dx = x - cx, dy = y - cy
    return [cx + dx * c - dy * s, cy + dx * s + dy * c] as PointMM
  })
}

export function outlineFromLayout(
  nodesMM: readonly PointMM[], recipe: OutlineRecipe,
  boundaryMM?: readonly PointMM[],
): PointMM[] {
  const path = boundaryMM?.length ? [...boundaryMM] : convexHull(nodesMM)
  if (!path.length) throw new Error('library: empty population has no outline')
  const end = path.length >= 3 ? 'polygon' : recipe.corners === 'round' ? 'round' : 'square'
  const raw = offsetPathMM(path, RELEASED_PADDING_MM, recipe.corners, end)
  if (!raw) throw new Error('library: population has no outline')
  return path.length === 1 && recipe.pointRotationDeg
    ? rotateAround(raw, path[0], recipe.pointRotationDeg)
    : raw
}
```

Class data:

```ts
// 1x1 square
outline: { corners: 'sharp', pointRotationDeg: 0 }

// 1x1 diamond
outline: { corners: 'sharp', pointRotationDeg: 45 }
```

For a 12mm square point-cap this yields 24x24 edge-up at 0 degrees and `24 * sqrt(2)` = 33.94mm corner-up at 45 degrees. Larger diamonds and H/double-T state real topology through `boundaryOf`; no class branch enters the producer.

Required counterexample:

```ts
it('one disk preserves edge-up versus corner-up product orientation', () => {
  const edge = outlineFromLayout([[0, 0]], { corners: 'sharp', pointRotationDeg: 0 })
  const corner = outlineFromLayout([[0, 0]], { corners: 'sharp', pointRotationDeg: 45 })
  const [ew, eh] = sizeOf(edge), [cw, ch] = sizeOf(corner)
  expect(ew).toBeCloseTo(24, 1); expect(eh).toBeCloseTo(24, 1)
  expect(cw).toBeCloseTo(24 * Math.SQRT2, 1)
  expect(ch).toBeCloseTo(24 * Math.SQRT2, 1)
  expect(corner).not.toEqual(edge)
})
```

## C. LAW 0 — a golden example does not freeze the contract

A runtime golden object does **not** catch a widened optional field: an added `debug?: string` is absent from the produced object, so `toEqual` still passes. LAW 0 needs four independent gates.

### C1 — exact compile-time shape

Put the expected V1 shape in the architecture test, not beside the production interface:

```ts
type CatalogueEntryV1 = Readonly<{
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
}>

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
    ? (<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2)
      ? true : false
    : false
type Assert<T extends true> = T
type _CatalogueEntryV1IsExact = Assert<Equal<CatalogueEntry, CatalogueEntryV1>>
```

This catches added optional fields, removed fields, optionalised fields and type widening under `tsc --noEmit`. Also assert that every key is readonly with a `ReadonlyKeys<T>` type test; TypeScript's ordinary structural assignability alone is not a reliable readonly gate.

### C2 — exact runtime keys on every record

```ts
const ENTRY_KEYS = [
  'classId', 'typeId', 'id', 'label', 'pitchMM', 'corners', 'nodesMM', 'outlineMM',
  'widthMM', 'heightMM', 'frameCols', 'frameRows',
] as const satisfies readonly (keyof CatalogueEntry)[]

for (const pitch of [24, 48, 96]) for (const entry of catalogue(pitch))
  expect(Object.keys(entry).sort(), entry.id).toEqual([...ENTRY_KEYS].sort())
```

### C3 — data-only/self-contained recursively

For every entry, recursively reject `undefined`, functions, symbols, bigint, getters/setters, non-finite numbers and non-plain objects. Then require:

```ts
expect(JSON.parse(JSON.stringify(entry))).toEqual(entry)
```

Exact keys plus the recursive check prevent callbacks, lazy getters and hidden UI objects from passing through JSON omission.

### C4 — versioned identity manifest, not only an id set

Add a sidecar `CATALOGUE_FORMAT_VERSION = 1` and a checked-in `catalogue-identity.v1.json`. Freeze, at 48mm, each entry's:

```text
id, classId, typeId, corners, frameCols, frameRows, nodesMM sorted lexicographically
```

At all three pitches assert unique ids and the same id set. At 48mm assert the full semantic fingerprint equals the V1 manifest. A bare id-set snapshot permits an old id to be silently reused for a different product.

Sorting removes irrelevant array order while retaining product orientation. Updating the expected type, key list, format version or identity manifest is the Dan-ruling change. Ordinary refactors cannot touch them.

### C5 — exercise the real classifier consumer, not only `toBeDefined`

For every entry at 24/48/96, require finite classifier fields and require the production matcher to return that entry's stable id:

```ts
const classified = classifyShape(enginePts(entry.outlineMM), entry.pitchMM)
expect([classified.cx, classified.cy].every(Number.isFinite), entry.id).toBe(true)
expect(catalogueCandidates(enginePts(entry.outlineMM), entry.pitchMM)
  .some((candidate) => candidate.entry.id === entry.id), entry.id).toBe(true)
```

Do not assert `shapeFamily === classId`; the library product taxonomy and engine geometry taxonomy are intentionally different. The matcher round-trip is the enforceable compatibility contract.

## D. The import matrix needs correction before it becomes a gate

The current matrix is not acyclic as written: corpus may import `types.ts`, but `types.ts` is placed in zone 4 above it. `class-spec.ts` combines contracts and registration, so class modules need its types while it imports the class modules. Services are also allowed to import concrete class modules and corpora, which recreates the special-case seam the scaffold is meant to prevent. The duplicate zone 7 hides that bridge and shell have different rules.

Use this matrix:

| zone | contains | runtime imports allowed |
|---|---|---|
| 0 contracts | `types.ts`, `class-contract.ts` | none; type-only external imports only |
| 1 corpus | literal `corpus-*.ts` | zone 0, type-only |
| 2 geometry | `geometry.ts`, `transforms.ts`, `outline.ts` | zone 0; approved spec constants and `offset.ts` |
| 3 classes | one class package plus shared class constructor | zones 0-2; never another concrete class package |
| 4 registry | `class-registry.ts` only | zones 0 and 3; registration only |
| 5 services | selection/options/authoring/materialise/catalogue/drafts | zones 0, 2, 4 and same-zone services; never corpus or concrete classes |
| 6 surface | `surface.ts` | zones 0 and 5 |
| 7 barrel | `index.ts` | exact public exports from zones 0, 5 and 6 |
| 8 shell/adapter | `LibraryPanel.tsx`, library-specific code in shared page, bridge | runtime library imports from the barrel only; bridge may import materialised types type-only and engine types |

`class-spec.ts = interfaces + registry` should therefore split into `class-contract.ts` and `class-registry.ts`. Otherwise “downward only” is documentation over a deliberate cycle.

The existing Step 3 structure also conflicts with LAW 4: a single `registry-class.ts` backed by global `RAW_CLASS_FRAMES` and `REGISTRY_RULES` still requires parallel edits to add a class. State the rule as:

> ADDING A CLASS = one self-contained class package (its corpus plus policy object) and one registry line. Generic shared constructors may be reused, but no global per-class switch/table may require another edit.

## E. Static import reads must use the TypeScript AST

Reading “import lines” misses multiline imports, `export ... from`, dynamic imports and type-only edges, and can flag comments. The gate must:

1. Assign every governed `.ts/.tsx` file to exactly one zone; unassigned and multiply assigned files fail.
2. Parse with `typescript.createSourceFile`.
3. Record `ImportDeclaration`, `ExportDeclaration` with a module specifier, and dynamic `import()`.
4. Distinguish whole-clause `import type` and per-specifier `type` imports from runtime edges.
5. Resolve relative paths plus the `@/` alias to actual files before comparing zones.
6. Maintain a short external-import allowlist per zone; unknown external dependencies fail.

Do not regex source lines for dependency direction.

The shared `page.tsx` is not wholly a library shell: bench imports remain legal. Gate only imports whose resolved target is `library/**` or the library bridge, plus the exact forbidden library bindings (`resolveSelection`, `materialize*`, `panelOptions`, `specOf`). Do not apply the library matrix to its bench imports.

## F. Replace unreliable gates

### Physical literals

Delete the bare `12|48` scan. Both numbers have legitimate indices, counts and test-fixture uses.

Enforce ownership instead:

- `grid-magnet-spec.ts` is the sole exported declaration site for identifiers matching `/(PAD|PADDING|PITCH|DIAMETER|DIA).*MM/`.
- After fixed-padding Step 2, runtime library/surface/bridge functions may not declare a `padMM` parameter or field.
- Runtime code may not give `pitchMM` a numeric default; supported pitches come from the released-tier constant and are passed explicitly.
- Tests/corpora may use numeric fixtures; production code may import the named constants.

### Registration count

Delete “class module count”; triangle has multiple support files and a shared class constructor is not a product class. Enforce:

```ts
expect(new Set(LIBRARY_FAMILIES).size).toBe(LIBRARY_FAMILIES.length)
expect(Object.keys(CLASS_SPECS).sort()).toEqual([...LIBRARY_FAMILIES].sort())
for (const family of LIBRARY_FAMILIES) {
  const spec = CLASS_SPECS[family]
  expect(spec.classId).toBe(family)
  expect(spec.types.length).toBeGreaterThan(0)
  for (const pitch of [24, 48, 96])
    for (const type of spec.types)
      expect(spec.variants(type.id, pitch).length, `${family}/${type.id}@${pitch}`).toBeGreaterThan(0)
}
```

The import gate separately proves only `class-registry.ts` imports concrete class modules.

### Retired vocabulary

Keep an explicit exact token list, scoped to runtime source and present-tense comments. Do not use broad words such as `Sail` if research/history fixtures legitimately contain them. Each forbidden token must name the removed symbol/convention exactly (`LAYOUT_LIBRARY`, `prim:`, `applicability.ts`, deleted type ids).

### “Test that cannot fail”

Add an AST meta-gate over the test files: fail assertions whose `expect(...)` argument and matcher argument print identically, and fail literal truths such as `expect(true).toBe(true)`. This catches the tautology introduced in d94152a1. It cannot prove every test useful, but it reliably blocks this known class without pretending comments can be verified automatically.

## G. Rewrite three laws that are not machine-checkable as stated

Replace LAW 5:

> NO IMPLICIT PHYSICAL SCALE — every lattice-to-mm conversion and every pitch-dependent population function takes `pitchMM` explicitly. Dimensionless topology (`convexHull`, lattice transforms, gcd runs) does not take a fake pitch. No runtime `pitchMM = 48` default and no scale-dependent computation at module load.

Replace LAW 9:

> ONE FILE, ONE JOB — enforced by zone/import rules and by banning React/Next/JSX from zones 0-6. Remove the “soft 200-line ceiling” from the claimed machine-enforced laws; keep it as a review warning outside this document if wanted.

Replace LAW 10:

> PRESENT TRUTH ONLY — runtime and test source contains none of the explicit retired tokens; the AST meta-gate rejects structural tautologies. Comment truth beyond those exact checks remains a QA responsibility and must not be claimed as fully machine-proven.

Change the document's global enforcement sentence accordingly:

> Every machine-checkable rule here has a named gate. Residual semantic claims explicitly marked “QA responsibility” are not presented as machine-proven.

LAW 12 duplicates LAW 0's classifiability gate. Delete it or replace it with the missing runtime-boundary honesty law below.

## H. Four missing laws from today's defects

1. **ONE MATERIALISATION PATH** — corpus layouts, drafts, admin preview and catalogue use the same variant lookup, transform, y-down to y-up conversion, outline producer and size measurement. Gate exact nodes and outline equality through each caller at 24/48/96.
2. **IDENTITY NEVER GUESSES** — unknown class/variant/frame/catalogue ids throw. Only an explicitly documented admin layout carry may fall back. Gate stale class, frame, variant, layout and draft identities, including two geometries sharing one frame/name.
3. **CSS, NOT DATA, CONTROLS LAYOUT** — option count may not choose JSX or CSS classes. Every class renders the same Type/Frame/Layout block structure; wrapping is CSS. Gate imported option-array `.length` out of JSX conditions/className expressions in `LibraryPanel`.
4. **COMPATIBLE IS NOT INTEGRATED** — a catalogue-to-classifier test proves the contract only. “Engine integrated” is allowed only after the real engine caller imports and consumes the catalogue and a live caller-path gate observes it. Until then the required status is exactly `catalogue contract landed; runtime consumption pending`.

Also add the one-producer topology counterexamples already in the build prescription: point-round, point-square edge-up, point-square corner-up, line-round, convex, acute, and ordered concave H. Without the corner-up singleton, the new 1x1 diamond ruling is not frozen.

## Necessity / sufficiency on the scaffold

**Necessity — shrink:** delete the duplicate classifiability law, the raw-number scan, module-count heuristic and soft-line-count claim. Split contracts from registration only because the current matrix otherwise encodes a cycle.

**Sufficiency — partial:** LAW 0 needs exact type equality, all-record runtime keys, recursive data-only validation and a versioned semantic identity manifest. The matrix needs AST resolution and the four missing laws above before it reliably catches the defects it is intended to prevent.
