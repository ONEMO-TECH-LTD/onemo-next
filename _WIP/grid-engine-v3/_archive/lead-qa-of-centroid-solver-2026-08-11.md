# Independent QA — centre-method placement solver

**Reviewed:** `b0869d56` / handoff `272fe3c1` on `session62-task/grid-centroid-method-bench`, served live
on **:3134** from `.codex/worktrees/s62-grid-centroid-bench-748f3e99`.
**Reviewer:** @s62-lead. Every claim below was executed, not read off the handoff report.

**Verdict: 2 blocking defects, 1 robustness finding, 6 attack points PASS.**

---

## BLOCKING 1 — the scan ceiling is 310mm, so lawful answers are reported as "no answer"

`compareCentres` scans `sizeMM <= grid.maxSizeMM` — the **310mm millimetre ceiling**. Dan ruled the
ceiling is the **9×9 grid** (`bandSpan(spec, positionsPerAxis)` = **408mm**), and law 12.3 states the
ceiling is a grid COUNT, never a millimetre. The shell already uses the count; this solver does not.

**Reproduced twice, independently:**

**(a) A concave L, `[[0,0],[100,0],[100,40],[40,40],[40,100],[0,100]]`:**

```
                     as shipped (310)        ceiling at the 9x9 grid (408)
  max-clearance      B2=198  B3=none         B2=198  B3=342
```

B3 has a lawful answer at **342mm**. The solver reports **none**.

**(b) Sharper, and pure arithmetic — the square standard is unreachable at 96mm.**
Band 4 at the 96mm population is `(4−1)×96 + 2×12` = **312mm**. The ceiling is 310. So band 4 on the
sparse lattice can *never* resolve, for any shape, by **2mm**. Confirmed live: at 96mm the square
resolves B2=168, B3=216, **B4=null**.

**Consequence for the handoff report:** its headline evidence — *"five balance-like centres have no
lawful B2/B3/B4 under 310mm"* — is measuring the ceiling, not the shapes. Those "no answer" results
are not findings about the centres.

---

## BLOCKING 2 — clicking an answer applies a placement that FAILS the solve it published

The solver's own tooltip for max-clearance band 2 on a live traced L cut-out:

> *"Show max clearance at band 2; **minimum support 12.2mm**; spread 9.1mm"*

I clicked it (size went 120 → **200mm**, so the click-through itself works), then measured the
**drawn** canvas independently — same signed-distance method, against the 1440-point outline actually
on screen:

```
magnets drawn                     64   (radius 12mm — the full 24mm disc)
fully supported (clearance >= 12)  7
  (-73.47,-73.47) 16.78   (-73.47,-25.47) 16.78   (-73.47, 22.53) 16.78
  (-73.47, 70.53) 16.78   (-25.47,-73.47) 16.78   ( 22.53,-73.47) 16.78
  ( 70.53,-73.47) 16.78
best unsupported                  (-25.47,-25.47) **7.56mm**
```

The supported set is an L of 7 — one full column and one full row. **There is no fully-supported 2×2
anywhere on the canvas**: any 2×2 needs `(-25.47,-25.47)`, which sits at **7.56mm**, well under the
12mm the answer claims.

**And the lattice is off-register.** Drawn columns are `−121.47 −73.47 −25.47 22.53 70.53 118.53` —
**1.469mm** from the ideal gap registration (`±24, ±72, ±120`). The solver solves on exact lattice
positions; the shell applies the result by panning, and what lands is not what was solved.

So the computed answer and the applied answer are different geometries. Either the solve is right and
the application is wrong, or the reverse — but they do not agree, and the bench's purpose is to trust
what it shows. **I have not pinned which side is at fault**; that is the first thing to establish.

---

## ROBUSTNESS — unrecognised centre methods silently return maximum-clearance

`centreOfOutline` dispatches with a chain of `if`s and an unguarded final `return
maximumClearanceCentre(...)`. Anything unrecognised falls through to it:

```
'maximum-clearance'          -> [23.44, 23.44]
'max-clearance'  (typo)      -> [23.44, 23.44]
'centroid'       (wrong)     -> [23.44, 23.44]
''               (empty)     -> [23.44, 23.44]
'AREA'           (wrong case)-> [23.44, 23.44]     <- NOT area's [38.75, 38.75]
```

I found this by accident: my first probe misspelled a method and got results instead of an error.

TypeScript blocks it at the call site today, so it needs a cast to reach — **not currently live**. But
in a bench whose entire purpose is attributing results to methods, silently attributing one method's
answer to another is the wrong failure mode. Same class as the vacuous guard found in my own sprint
self-audit: a compile-time promise doing a runtime guard's job.

---

## PASS — attacked and held

| Attack | Result |
|---|---|
| **Full 24mm-disc containment** | **Correct.** The test is `clearance >= grid.paddingMM` on the signed distance to the boundary — a 12mm radius, i.e. the complete 24mm disc, not the centre point. Tangency is accepted (`<` rejects), which is why the square lands on exactly 72/120/168. |
| **48/96 lattice coordinates** | **Correct.** Band positions were compared against the engine's own infinite lattice. 48mm → `±24, ±72…`; 96mm → `−168, −72, 24, 120…`. Every band sits on real populated positions. |
| **Parity registration** | **Correct.** Even band → gap, odd → point, per law 9.2, confirmed in the returned fits. |
| **96mm asymmetry** | **Correct and intended.** At 96 the band is not re-centred on the shape — exactly Dan's law 9.3a ("points hide, nothing is re-centred"). |
| **Winding invariance** | **Correct.** All six methods return identical centres and identical sizes for CW vs CCW input. |
| **Non-monotonic concave legality** | **Correct.** Exhaustive scan over every publishable even size, returning the first lawful one — no monotonicity assumed, no bisection. |
| **Hidden winner / default / weighting** | **None found.** No ranking, scoring or cross-method winner in the diff; the method switch is explicitly marked admin-only. |

---

## Corrections to my own testing

My first click-through attempt reported "no change" — I had clicked the `<td>` rather than the
`<button>` inside it. **Click-through works.** Not a defect, and I am not filing it as one.

## Not assessed

Performance. `compareCentres` rescales the full outline and recomputes every magnet's distance for
every candidate size — on a 1440-point traced contour that is roughly 1440 × 16 × 144 distance
evaluations per method per band. It completed, but I did not measure it and the handoff does not
claim a budget.
