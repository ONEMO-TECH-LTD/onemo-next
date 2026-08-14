# Installation plan — GPT Pro's three modules into the scaffold

**Scope: installation only.** Install what GPT Pro delivered, verbatim, into the scaffold's existing
modular structure, and run it. No rebuilding, no improving, no new architecture, no solvers, no
policy. Everything else is deferred until we have looked at real output.

## 1. Where each module goes — DONE, committed

```
src/lib/grid-engine/
  spec.ts / engine.ts / ui/            UNCHANGED  (values · mm compute · screen)
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

## 2. The seam — calls the packages as they were built to be called

`compute/candidates.ts`, one file:

1. clean the traced ring only as the kernel demands (it rejects duplicates rather than repairing);
2. `measureLattice(...)` — lattice pitch, origin, field extent and disc all **read** from `spec`
   through the scaffold's own engine; sizes and anchor come from what the page already has;
3. `enumerateCandidates(...)` on that measurement, with the delivered grammar;
4. return the candidates with positions in millimetres.

No geometry, no grammar, no policy written here. Zero law literals (grep-checked).

## 3. Part 3 — installed and callable, not faked

Exposed through its own accepted contract. It requires supplied gravity, region, status and
precedence inputs; the scaffold has none today. So it is **called with what exists and reports the
missing inputs by name** — nothing is fabricated to make it run. It stays integration-testable
against its own delivered fixtures.

## 4. One bridge door, then the shell

One result: measurement + raw candidates + Part 3's output or its named missing inputs. The shell
browses and draws that result. It computes nothing and orders nothing.

## 5. Run it and look

Real traces on the running page. **This is a diagnostic of the delivered engine, not production
output** — it is size-first because that is how the modules were built, and Dan sees exactly what
GPT Pro's work does before anyone proposes changing it.

## 6. Explicitly deferred until after that

Grid-first closure · maximum-clearance anchor · `registration-law.ts` (L6) · judgement producers ·
any additive request to the modules' author. All are improvements beyond the delivered code, and
none is in this plan.
