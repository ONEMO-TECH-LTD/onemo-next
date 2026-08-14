# Installation plan — GPT Pro's three modules into the scaffold

**Scope: installation only.** Install the **accepted three-part stack without rewriting** — Parts 1
and 3 as verbatim GPT deliveries, Part 2 as the Dan-authorised patched artifact copied verbatim —
into the scaffold's existing modular structure, and run it. No rebuilding, no improving, no new architecture, no solvers, no
policy. Everything else is deferred until we have looked at real output.

**Read in full before this plan** (Dan's requirement): scaffold — `spec.ts` 210, `engine.ts` 227,
`bridge.ts` 116, `ui/camera.ts` 73, `ui/trace-cutout.ts` 46, `GridCanvas.tsx` 175, `page.tsx` 654.
Deliveries — kernel src 1,927 + `CONTRACT.md` 590; enumerator src 1,229 + contract; product logic
src + contract + tests, plus the 1,697-line fork transcript.

## 1. Where each module goes — DONE, committed

```
src/lib/grid-engine/
  engine.ts                           UNCHANGED  (mm compute)
  spec.ts                             + the released arrangement grammar (policy data)
  ui/trace-cutout.ts                  + keeps the native ring it already produced
  bridge.ts                           + ONE door
  __tests__/separation.test.ts        + direction guards for the new modules
  compute/
    magnetic-grid-measurement-kernel/  VERBATIM GPT DELIVERY (Part 1)
    enumerator/                        VERBATIM ACCEPTED PATCHED ARTIFACT (Part 2)
    candidates.ts                      the seam — the only NEW file
  logic/
    magnetic-grid-product-logic/       VERBATIM GPT DELIVERY (Part 3)
```

**Provenance, exactly — the earlier blanket claim was false and is corrected.** Verified by
`diff -qr` against each ORIGINAL GPT delivery:

| package | provenance |
|---|---|
| Part 1 kernel | **verbatim GPT delivery** — identical, zero differences |
| Part 3 product logic | **verbatim GPT delivery** — identical, zero differences |
| Part 2 enumerator | **GPT delivery + the Dan-authorised `single`-family patch** — 12 files differ (contract, readme, 3 src, 3 dist, 3 fixtures, test), copied verbatim from the accepted `src/lib/grid-engine/compute/enumerator` |

The patch was authorised by Dan on 2026-08-13 (`single` was missing as a family, so the band-1 duck
was reachable only as a 1×1 window) and peer-audited against the pristine delivery. His current
instruction — do not rebuild or approximate what is already done — and that authorisation agree:
**the accepted patched artifact is what gets installed. No further ruling is needed.**

Suites 18/18 · 13/13 · 15/15, `tsc --noEmit` clean, separation 22/22. Folder names are forced by the enumerator's own relative import of the
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
3. `enumerateCandidates(...)` on that measurement, with the **accepted released grammar from
   `spec.ts`** — the enumerator ships no default grammar, and requires one as explicit caller data;
4. return the candidates with positions in millimetres.

**What the seam does own:** the transform and field arithmetic needed to drive the packages — that
is calculation, and calculation belongs in compute. **What it does not own:** the grammar (released
policy, now in `spec.ts`) and any product judgement. Zero law literals, grep-checked. Law values reach it two
ways, both from the spec: derived ones through the scaffold's engine helpers (`cellDiameterMM`,
`registrationOffsetMM`) and released ones read from `spec.grid` directly (`basePitchMM`,
`positionsPerAxis`). There is no engine-only route and the plan does not imply one.

**Files this installation touches, in full.** Two kinds, stated separately because they are not the
same act:

*Integration / scaffold files — written or modified here:*
`compute/candidates.ts` (new — the seam) · `spec.ts` (the released grammar) ·
`ui/trace-cutout.ts` (keep the ring it already produced) · `bridge.ts` (one door) ·
`page.tsx` (state + control) · `__tests__/separation.test.ts` (direction guards) ·
`tsconfig.json` (excludes each package's `src/test/scripts` so the app never compiles delivery
sources — omitting this from the earlier list made the footprint claim false).

*Accepted package trees — ADDED, never edited:* `compute/magnetic-grid-measurement-kernel/`,
`compute/enumerator/`, `logic/magnetic-grid-product-logic/`. Not one delivered byte is modified.

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
