# Grid engine MVP — execution plan

Goal: the pure engine computing every lawful result at every legal size, visible on the existing
grid-engine shell; every policy an off-by-default switch that annotates rather than filters; proven
locally to Dan's judgement first, compiled properly for the phone after.

Standing constraints: the engine is GPT Pro's C++, copied verbatim — nothing ported or rewritten.
The shell holds no geometry and is added to, never rebuilt. Policies live only in the logic layer.
Nothing is ever removed from output. Bands measured: 1–4 (minimum measure is one disc — Dan).

## Sequencing (Dan, 2026-08-12): local first, founder judgement, then compile

**A — local, now.** Native engine through a dev-only door to the existing shell. Dan drives the seven
real cut-outs, steps every size 24→204mm, flips policy switches, sees discs appear and disappear.
**Exit gate: visual conformance in Chrome, then Dan's judgement as product founder.**
**B — BUILT (2026-08-12 evening), deploy-log verification pending an actual deploy.** WebAssembly
compiled by the normal build — no shortcuts: `prebuild` runs `vendor/magfit/build-wasm.sh`, which
provisions emscripten when the machine lacks it (`bootstrap-emsdk.sh`, pinned 4.0.15, cached under
`.next/cache`) and compiles the engine from source; outputs gitignored; a build that cannot compile
fails. The measurement door serves the wasm engine when built, the native binary otherwise — same
JSON. *Verified locally:* `npm run build` compiles the engine then the app; the seven cut-outs are
byte-identical native-vs-wasm at module level AND through the live door (7/7); the error path
refuses (bow-tie → refusal JSON) instead of crashing. *Still owed at first deploy:* the Vercel
deploy log showing the compile, and the artifact hash matching a clean local build.
**C — after B.** Phone via the Vercel URL. *Verify:* p95 measured on the device.
**D — after C.** Decide TypeScript migration, C++ kept permanently as the oracle. (Deferred with it:
auto-selection — "after that complicate logic to make auto selection", Dan.)

## Done

- **Selection** — everything GPT Pro provided, verbatim, in `_selection/` (156 files, package verified
  against its own SHA-256 manifest, builds and passes unmodified here).
- **Engine installed** — `vendor/magfit/`, GPT's core plus `measure_all()`: every lattice position at
  every legal size with exact clearance, entering no policy path.
- **CLI** — `vendor/magfit/cli/measure_cli.cpp`, stdin outline → stdout measurements. Decides nothing.

## Phase A build order

### A1 — prove the engine  ·  `vendor/magfit/`
Install worktree dependencies. Build and run GPT's own acceptance suite (must pass untouched).
Extend `measure_all()`/CLI with two missing **facts** — using GPT's existing functions, not new
geometry: per-size adjacent-pair link facts (`capsule_supported`, reported true/false per pair) and
per-size raw overhang beyond the padded held-magnet box (numbers only, no thresholds). Without these
the corridor and flap switches would be dead controls.
*Verify:* suite still passes; BUTTERFLY at 168mm still reports the same held set as the pre-extension
run; link and overhang fields present.

### A2 — engine loader  ·  `src/lib/grid-engine/engine/measure.ts`
Types and one fetch to the measurement door. No geometry, no defaults, no interpretation — if it
computes anything it is in the wrong file. The door is `/api/grid-engine/measure`: in A it runs the
native binary (dev-only), in B the same door serves the wasm build. Corpus door
`/api/grid-engine/corpus` serves the seven saved traces so the shell is drivable without an upload.
*Verify:* loader output for one fixture equals the CLI's own output.

### A3 — logic layer  ·  `src/lib/grid-engine/logic/policies.ts`
Five policies, each: id · on/off · value where value-based · what it says · why it defaults off.
minimum-magnets (value 1,2,3,4 — default 1, Dan's triangle ruling) · band-span (deleted-as-invented;
kept as a switch to see its cost) · corridor (width 12/24, judged on the engine's link facts) ·
96mm engagement (from-band, counted on residues) · flap limit (12/24, meaning WITHIN — Dan 11 Aug).
`annotate()` marks, never removes: output length always equals input length.
*Verify:* `logic/__tests__` — all-off output is the pure engine's, item for item; each policy's
annotation fires on a hand-checked case; no test can pass vacuously.

### A4 — bridge  ·  `src/lib/grid-engine/bridge.ts`
One composition: engine facts → logic annotations → one object the shell draws. The bridge stays the
only door; the shell never imports `engine/` or `logic/` internals except the policy catalogue for
display.
*Verify:* grep — the shell imports only from the bridge and the catalogue.

### A5 — shell additions  ·  `src/app/(dev)/grid-engine/`
Add to the existing page — nothing rebuilt, existing controls untouched: corpus chips · a size strip
walking every measured size 24→204mm with held-count on each tick · the overlay drawing the outline
at the engine's size, every lattice position (held filled with clearance label, unheld as empty
rings), link facts as lines · the policy switch row · an excluded-by readout when a switch marks the
current size.
*Verify:* the page still compiles with the fixture flow untouched; no geometry in any shell file.

### A6 — conformance, visually, in Chrome
Dev server up; drive the real page in Chrome. Evidence captured: BUTTERFLY at 168mm shows its wing
discs; DUCK at 204mm shows 14 held; a policy toggle marks sizes excluded without removing them;
zero console errors; typecheck and test run clean. Then Dan drives it.

## FIXED (2026-08-13 midday) — single lattice authority restored

The kernel now GENERATES NOTHING: positions come from the unit's centred runs (`engine.ts
centredRunMM`, GPT's run formula), registration DERIVES per axis from run parity (Dan's law,
EC-07), and pitch/radius arrive from the guarded spec. Variants are measured one registration at
a time — never merged. The canvas realigns per axis to the selected variant, so the scaffold
lattice and the measured discs are ONE grid on screen. Verified: GPT suite untouched; 38/38 unit
tests; live door wasm==native byte-identical on the new schema; and a LAW-conformance Chrome gate
(min disc spacing >= 48mm, single residue per axis) — the gate the failed audit demanded — PASSED
with screenshots. Conformance to GPT Pro's proposal restored: one deliberate deviation recorded
(position generation lives in the TS unit, the single authority; the run/parity math is GPT's).

## FAILED-AUDIT record (o-audit, 2026-08-13 morning) — evidence, since fixed

Dan's eye caught what the entire pipeline below missed: phantom magnet positions 24mm apart on a
48mm lattice. Three-way confirmed (Dan's screenshot · lead source trace · grid-pixel live gate).

**Verdict on the goal's question: the PLAN was wrong, and the build followed it faithfully.** This
was not mid-flight improvisation — it was a planning-audit failure, plus one pre-goal assumption
that the audit then exempted:

1. **The defect predates the goal.** `measure_all()` — with its union of all template windows into
   one position set (`magfit.cpp` ~1101) — was written at 18:02, before this plan. The union was an
   ASSUMPTION (that merging registrations is harmless) never checked against the physics. That was
   the vibe-coded moment.
2. **The plan then laundered it.** The rewritten plan placed measure_all under "Done" and the
   necessity/deslop audit swept only the phases AHEAD. Auditing the delta while exempting inherited
   work is how a defect becomes load-bearing: A5 then INSTRUCTED the overlay to draw "every lattice
   position" from the engine — the duplication was in the plan's own words (line 73).
3. **The deslop pass never swept the tree it claimed to.** o-deslop is a whole-tree duplicate hunt.
   Run honestly, it collides `measure_all`'s position generation with `engine.ts magnetsInRegion`
   (the scaffold's lattice authority), `Registration` in `spec.ts` (guarded, released options), and
   the C++'s hardcoded 48/24/12/9 against the spec's guarded values. Three duplications of
   authority, all missed because the sweep audited a DOCUMENT, not the tree.
4. **The A6 visual gate verified the wrong property.** It checked screen == engine (counts,
   clearances) — self-consistency — never screen == grid law. The phantom 24mm-spaced rings are
   VISIBLE in the A6 butterfly screenshot that was called PASS. Conformance means conformance to
   the law, not to the thing under test.

**What did conform:** module separation (engine/logic/spec/bridge/UI, guards green) · policies
annotate-never-remove with non-vacuous tests · verbatim GPT core, suite untouched · UI added-to,
not rebuilt · B's wasm byte-identity. The layering held; the AUTHORITY did not — the engine was
allowed to invent lattice, registration and law values that the scaffold already owned.

**Standing violations to fix (design agreed with grid-pixel, decision pending Dan):** one lattice
authority in TS engine/spec · registration is per-axis (scalar 'gap'|'point' cannot express 3×2 —
Dan to rule option A: per-axis law, vs B: bridge-enumerated pairs) · C++ kernel receives
coordinates + law values, returns facts only, generates nothing, hardcodes nothing.

## Superseded audit record (o-necessity + o-deslop, 2026-08-12 evening) — kept as evidence

Kill-list applied: Vercel-first sequencing (contradicted Dan's local-first ruling) · winner-selection
switch (auto-selection explicitly deferred by Dan) · stale "Open decisions" (npm authorised by the
active goal; emscripten belongs to B).
Gap-list applied: dev-door phase missing · corpus loading missing · link/overhang facts missing
(two switches would have been dead controls) · identity test promoted to deliverable · bands 1–4 and
the Chrome gate made explicit.
Verdict AS WRITTEN THEN: necessity — no unnecessary elements. Sufficiency — full. **Both lines
were wrong**: the sweep exempted pre-goal work, so the duplicate lattice/registration/law-value
authorities passed unexamined. See the failed-audit record above.
