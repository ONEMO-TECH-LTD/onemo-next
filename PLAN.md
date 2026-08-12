# Grid engine MVP — execution plan

Goal: the pure engine computing in the browser, on desktop and on a phone via a Vercel URL, with
every lawful result visible and every policy an off-by-default switch that annotates rather than filters.

Standing constraints: the engine is GPT Pro's C++, copied verbatim — nothing is ported or rewritten.
The shell holds no geometry. Policies live only in the logic layer. Nothing is discarded from output.

## Done

- **Selection** — everything GPT Pro provided, verbatim, in `_selection/` (156 files, package verified
  against its own SHA-256 manifest, builds and passes unmodified here).
- **Engine installed** — `vendor/magfit/`, GPT's core plus one addition: `measure_all()` reports every
  lattice position at every legal size with exact clearance, entering no policy path.
- **CLI** — `vendor/magfit/cli/measure_cli.cpp`, stdin outline → stdout every size and node. Converts
  and prints; decides nothing.

## P1 — WebAssembly build  *(needs emscripten installed — the one infrastructure item)*

Compile the pure entry points to `.wasm` and **commit the artifact**, so Vercel serves a static file and
its build pipeline is untouched. GPT's own build command, narrowed to the pure exports.

*Verify:* the same seven cut-outs produce byte-identical numbers through WASM and through the native CLI.

## P2 — Engine loader  ·  `src/lib/grid-engine/engine/`

A thin TypeScript module that loads the `.wasm`, passes an outline in and returns the measurements.
No geometry, no defaults, no interpretation — if it computes anything, it is in the wrong file.

*Verify:* a unit test comparing loader output to the committed native fixture.

## P3 — Bridge  ·  `src/lib/grid-engine/bridge.ts`

One added function so the shell asks for measurements without knowing an engine exists. The bridge
already is the only door; it stays the only door.

*Verify:* the shell imports nothing from `engine/` directly.

## P4 — Shell  ·  `src/app/(dev)/grid-engine/`

Draw the shape scaled to the selected size, the lattice, and each held disc with its clearance.
A stepper walks 24 → 204mm. Unheld positions stay visible as empty rings — the point is to watch
support appear and disappear, which is how the butterfly's wings are seen rather than reported.

*Verify:* on screen, the seven real cut-outs; butterfly gains its wing magnets at 168mm.

## P5 — Logic layer  ·  `src/lib/grid-engine/logic/`

Each policy is one entry: id, on/off, value where value-based. Every one **defaults off** and
**annotates rather than removes** — a result marked "excluded by corridor" stays in the output.

Ported from the policy already sitting inert in `vendor/magfit/src/magfit.cpp`, not rewritten:
corridor (value: width) · sparse engagement (value: from-band, minimum nodes) · flap limit
(value: 12/24, meaning **within**) · minimum magnets (value: 1) · band-span · winner selection.

*Verify:* with every switch off, output equals the pure engine exactly; turning one on changes only
annotations, never the number of results.

## P6 — Phone

Deploy the branch, open the Vercel URL on the phone, run the corpus, record real timings.

*Verify:* measured p95 on the device, not extrapolated from this Mac.

## Open decisions (Dan's)

- Install emscripten here — the only toolchain change. Blocks P1.
- `npm install` in this worktree — nothing renders until dependencies exist.
- Whether the corridor, sparse and selection policies are ever promoted from annotation to rule.
