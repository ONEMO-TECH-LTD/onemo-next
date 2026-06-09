# V2 — Effect Creator (lean 2D-first build)

Build target. **Scaffold** — assembled in the post-checkpoint worktree per the **V1→V2 harvest manifest**
(SSOT `kai-sidekick/v2/effect-creator-V1-to-V2-HARVEST-CHECKLIST`).

Harvest discipline (KEEP-dominant):
- **COPY** the KEEP/ADAPT route-local pieces from `../v1` — the 2D editor UI, the route-local golden-scene
  copy, the route-local engine pieces. V1 keeps its full snapshot (copy, don't move).
- **REFERENCE the shared engine `@/lib/outline-core`** — it lives in `src/lib/`, the app's **shared
  production layer** (alongside cloudinary/shopify/supabase/api), OUTSIDE all version folders. Do **NOT**
  copy it into v2. That layer is **delete-safe** (`rm -rf v1` can't touch `src/lib`) AND **promotable** (v2
  uses the real lib → production-shaped, no de-dup surgery to ship the winner).
- **The only isolation rule:** v2 imports **nothing from `../v1`** (another version's folder). The `src/lib`
  shared layer + platform deps (`studio/`, node_modules, design tokens) are referenced by everything — that's
  normal production architecture, not entanglement.
- **Engine = `src/lib/effect/`, route = thin consumer (DONE).** The shaped effect engine
  (segment-ml / contour-tracer / mesh / edge-bleed / mask / composite / prepare-effect / build-mesh) lives in
  `src/lib/effect/` alongside `outline-core`, so the route consumes a shared engine and "remix engine for
  ANY effect" is real. ONE engine: the `contour.ts` fillet/smooth fork is deleted (tracer-only); corner
  rounding is owned solely by `outline-core` (`applyCornerRadii`) — no double-round.
- **EXCLUDE** the N/A files (the golden GLB `EffectModel`, the dev-only Leva admin panels) — removing them
  is coupled to rewiring their importers, so it happens as build work, not a raw file-copy.
- **Wiring (DONE):** one `prepareEffect` (the old `buildShape`/`buildSquareShape` builders + `pipeline.ts`
  collapsed into it), `Effect2D` 2D hero (Phase A, WebGL-free), `buildMeshFromSpec` mounted on demand
  (Phase B). BEN → Web Worker is §8.3.

**POC bar:** the architecture proved + the UX working (2D-first → one engine → on-demand 3D → manufacturing
payload) — NOT visual polish. QA verifies the harvest/build PR row-by-row against the manifest.
