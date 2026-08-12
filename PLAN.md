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
**B — after A passes.** WebAssembly compiled by the normal Vercel build — no shortcuts: emscripten
provisioned in the build step, the engine compiled from source on every deploy, the `.wasm` gitignored,
a deploy that cannot compile fails. *Verify:* deploy log shows the compile; artifact hash matches a
clean local build of the same commit; the seven cut-outs match the native CLI byte for byte.
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

## Audit record (o-necessity + o-deslop, 2026-08-12 evening)

Kill-list applied: Vercel-first sequencing (contradicted Dan's local-first ruling) · winner-selection
switch (auto-selection explicitly deferred by Dan) · stale "Open decisions" (npm authorised by the
active goal; emscripten belongs to B).
Gap-list applied: dev-door phase missing · corpus loading missing · link/overhang facts missing
(two switches would have been dead controls) · identity test promoted to deliverable · bands 1–4 and
the Chrome gate made explicit.
Verdict: necessity — no unnecessary elements. Sufficiency — delivers the directive set in full
(pure engine · switchable annotating policies · min-1 · bands to 204 · existing UI added-to · local
proof before compile · visual Chrome gate).
