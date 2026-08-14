# Installation plan — GPT Pro's three modules into the scaffold

**Scope: installation only.** Install what GPT Pro delivered, verbatim, into the scaffold's existing
modular structure, and run it. No rebuilding, no improving, no new architecture, no solvers, no
policy. Everything else is deferred until we have looked at real output.

**Read in full before this plan** (Dan's requirement): scaffold — `spec.ts` 210, `engine.ts` 227,
`bridge.ts` 116, `ui/camera.ts` 73, `ui/trace-cutout.ts` 46, `GridCanvas.tsx` 175, `page.tsx` 654.
Deliveries — kernel src 1,927 + `CONTRACT.md` 590; enumerator src 1,229 + contract; product logic
src + contract + tests, plus the 1,697-line fork transcript.

## 1. Where each module goes — DONE, committed

```
src/lib/grid-engine/
  spec.ts / engine.ts                 UNCHANGED  (values · mm compute)
  ui/                                 ONE adapter change: trace-cutout returns the native ring
  bridge.ts                            + ONE door
  compute/
    magnetic-grid-measurement-kernel/  VERBATIM  (Part 1)
    enumerator/                        VERBATIM  (Part 2)
    candidates.ts                      the seam — the only file we write
  logic/
    magnetic-grid-product-logic/       VERBATIM  (Part 3)
```

All three byte-identical to the deliveries (`diff -r` clean), nothing edited, suites 18/18 · 13/13 ·
15/15, `tsc --noEmit` clean. Folder names are forced by the enumerator's own relative import of the
kernel. Each package's `src/test/scripts` are excluded from the app's TS project so the app never
compiles delivery sources; the seam imports `dist/` only.

**One `ui/` change, and it is preparation not geometry.** `traceCutout` produced the ring in integer
pixel coordinates and then discarded it, returning only the UV projection. The seam needs those exact
values, and reconstructing them by multiplying UV back up would be a lossy round trip through data we
already had. It now returns `{ outlineUV, ring: { points, width, height } }` — nothing computed, only
kept. The shell stores it and passes it through the one bridge; drawing still uses the UV.

## 2. The seam — calls the packages as they were built to be called

`compute/candidates.ts`, one file:

1. clean the traced ring only as the kernel demands (it rejects duplicates rather than repairing);
2. `measureLattice(...)` — lattice pitch, origin, field extent and disc all **read** from `spec`
   through the scaffold's own engine; sizes and anchor come from what the page already has;
3. `enumerateCandidates(...)` on that measurement, with the delivered grammar;
4. return the candidates with positions in millimetres.

No geometry, no grammar, no policy written here. Zero law literals (grep-checked).

## 3. Part 3 — installed and callable, not faked

Installed and callable through its own accepted contract, which requires all four inputs and a
complete judgement per candidate — it has **no partial mode**, and calling it with less throws. The
scaffold supplies none of those judgements today, so **the bridge reports those inputs as
unavailable; Part 3 is not called and we never claim it was.** The seam therefore preserves the
kernel and enumerator documents **verbatim**, because those are two of Part 3's mandatory inputs the
moment judgements exist. It stays integration-testable against its own delivered fixtures.

## 4. Ownership — one bridge door, then the shell

**Compute** holds the two measurement packages and the seam. **Logic** holds Part 3. **The shell
imports neither** — `page.tsx` and `GridCanvas.tsx` import only `spec`, `bridge` and `ui/*`, exactly
as they do today, and no raw package import, geometry or policy enters them. Everything the shell
draws arrived from the bridge on that render.

One result: measurement + raw candidates + Part 3's output or its named missing inputs. The shell
browses and draws that result. It computes nothing and orders nothing.

## 5. Run it and look

Real traces on the running page. **This is a diagnostic of the delivered engine, not production
output** — it is size-first because that is how the modules were built, and Dan sees exactly what
GPT Pro's work does before anyone proposes changing it.
