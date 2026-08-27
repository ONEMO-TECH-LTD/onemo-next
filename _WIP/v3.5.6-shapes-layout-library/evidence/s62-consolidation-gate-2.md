# [Codex][CONSOLIDATION GATE 2] REJECT — two seams remain

F1-F6 are applied faithfully. The full reread exposed one deeper contradiction in the final
architecture and one owner left unspecified. I cannot ACK the builder onto them.

## F7 — LAW 4 still requires a second class registry

The law says adding a class changes one class package plus one `class-registry.ts` line, with
no parallel per-class table. The build still preserves and publicly exports
`LIBRARY_FAMILIES` from `types.ts`, while `class-registry.ts` separately owns `CLASS_SPECS`.

That makes every new circle/oval/pill/H class require all of:

1. the `LibraryFamily` union in `types.ts`;
2. the `LIBRARY_FAMILIES` array in `types.ts`;
3. its class package;
4. the `CLASS_SPECS` registry line.

The proposed registration equality test then only proves the two registries were edited
together. It does not remove the duplicate source of truth that LAW 4 forbids.

Minimal root fix:

```ts
// types.ts — stable external identity; validity is owned by the fail-loud registry
export type LibraryFamily = string

// class-registry.ts — the sole class registration source
export const CLASS_SPECS = {
  square: squareClass,
  rectangle: rectangleClass,
  diamond: diamondClass,
  triangle: triangleClass,
} as const satisfies Record<string, LibraryClass>

type RegisteredClassId = keyof typeof CLASS_SPECS

export const LIBRARY_FAMILIES: readonly LibraryFamily[] =
  Object.freeze(Object.keys(CLASS_SPECS))

export function specOf(classId: LibraryFamily): LibraryClass {
  const spec = CLASS_SPECS[classId as RegisteredClassId]
  if (!spec) throw new Error('library: unknown classId ' + classId)
  return spec
}
```

Then:

- delete the literal `LIBRARY_FAMILIES` array and closed `LibraryFamily` union from `types.ts`;
- catalogue/services iterate the derived list or the registry values;
- keep `LIBRARY_FAMILIES` in the narrow barrel, but amend zone 7 to allow this one exact
  readonly registry export from zone 4;
- replace the keys-equal-list invariant with a non-tautological registry sweep:

```ts
for (const [classId, spec] of Object.entries(CLASS_SPECS)) {
  expect(spec.classId).toBe(classId)
  expect(spec.types.length).toBeGreaterThan(0)
  for (const pitchMM of [24, 48, 96])
    for (const type of spec.types)
      expect(spec.variants(type.id, pitchMM).length).toBeGreaterThan(0)
}
```

The identity boundary remains fail-loud, and adding a class now truly is package + registry
line. This also avoids creating a third family-options mechanism.

Required architecture edits:

```text
zone 7 barrel: exact public exports from zones 0, 5 and 6, plus the readonly
LIBRARY_FAMILIES view derived by class-registry.ts.

LAW 4: CLASS_SPECS is the only class-id registration source. LIBRARY_FAMILIES is derived from
its keys, never stored independently.
```

## F8 — `selectVariant` has no owner

Step 2 correctly says it is standalone, but does not name its file. It cannot live in
`class-contract.ts`: it calls `pickLayout`, so placing it there would put runtime service logic
in zone 0 and violate the import matrix.

Add one exact sentence:

```text
Move selectVariant to selection.ts beside pickLayout; it is a zone-5 service and
class-contract.ts contains declarations only.
```

## Verdict

**Necessity — shrink:** delete the literal family list rather than adding another abstraction;
name the existing selection service as the transition owner.

**Sufficiency — partial:** F1-F6 are closed, but the plan still violates its own add-a-class
law and leaves one runtime function owner to builder interpretation. REJECT until F7-F8 land;
no builder dispatch yet.
