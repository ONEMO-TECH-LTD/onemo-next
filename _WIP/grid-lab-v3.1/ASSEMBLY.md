# Assembly — wiring the three layers to the page Dan looks at

Task: **KAI-10288** item 6. Audit and findings: `AUDIT-REPORT.md`.
This file is the durable design so the build survives a compaction. Read it before touching code.

## The one constraint that outranks everything

**The kernel receives the scaffold's lattice. It never generates one.**

Yesterday's build failed exactly here: the C++ engine built its own position set from template
windows and the overlay drew it on top of the scaffold's, so two grids were on screen and the merged
one manufactured impossible 24mm spacings. The clean scaffold already owns the lattice
(`engine.ts:magnetsInRegion`), registration (`spec.ts` guarded value) and the law values.

So every lattice number handed to the kernel is **read** from `spec` / `bridge`, never written as a
literal in the wiring:

| kernel parameter | comes from |
|---|---|
| `lattice.pitch` | the guarded spec grid value |
| `lattice.origin` | `layoutField(...).anchorMM` — the scaffold's own anchor (registration + pan) |
| `lattice.fieldExtent` | derived from the magnet block the scaffold already computed |
| `discDiameter` | the guarded spec value |
| `sizeTransform` | the scaffold's shape box and its current size control |

If a value cannot be read from the scaffold, the wiring stops and asks — it does not invent one.
A literal `48`, `24` or `12` appearing in the wiring is the defect, not a shortcut.

## What is vendored, and why

`src/lib/grid-engine/vendor/kernel/` and `.../vendor/enumerator/` are the **built `dist` of the
accepted deliveries, copied byte-for-byte** (`diff -r` empty against
`_WIP/grid-lab-v3.1/engine/`). The app cannot import from `_WIP`, and rewriting delivered code to
"integrate" it is precisely what five failed builds did. Vendoring keeps the accepted artefact
intact and auditable: re-run the diff to prove no drift.

Provenance: kernel `magnetic-grid-measurement-kernel v1.0.0` (18/18 goldens, unmodified);
enumerator `magnetic-grid-candidate-enumerator v1.0.0` + this lane's `single`-family patch
(13/13, peer-audited). Product logic is **not** vendored — it cannot run until the three judgements
exist (audit F2), and wiring it now would mean inventing them.

## The bridge gains exactly one door

The shell never imports the vendor directory. One function is added to `bridge.ts`:

```ts
enumerateCandidates(spec, layout, outlineMM, sizeMM) -> RawCandidate[]
```

- reads the lattice from `spec` + `layout` per the table above;
- calls `measureLattice` then `enumerateCandidates` from the vendored packages;
- returns candidates whose positions are already in **millimetres on the scaffold's own lattice**,
  so the canvas draws coordinates it was handed and computes nothing.

No ranking, no preference, no filtering. The raw set, or nothing.

## What the page shows

Raw candidates only, browsable: step through them, each highlighting its held positions on the
existing lattice. The shape stays fixed and the grid scales beneath it (the scaffold's camera law).
**Zero solve on pan, drag or step** — candidates are computed once per (shape, size, registration)
and the shell indexes a cache.

The acceptance is Dan's eye: his walkthrough placements must appear in the raw set.

## Performance — decided up front, not discovered later

Ordering is quadratic (audit F3: 739 ms at 1,000 candidates) and enumeration produced 1,346
candidates for BOT at 236mm at one anchor. Therefore the candidate set is **scoped per size and
registration** before anything ranks it, and any ordering runs off the interaction path. This is why
product logic is not in this first wiring at all.

## Order of work

1. Read `spec.ts`, `engine.ts`, `page.tsx`, `GridCanvas.tsx` in full before editing — the scaffold's
   conventions govern.
2. Add the bridge door; unit-test it against a known trace.
3. Render raw candidates on the page behind a control; verify no solve fires on pan.
4. Chrome check on the running page, screenshot, then Dan looks.
