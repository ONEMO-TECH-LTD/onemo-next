# Effect Creator + Configurator (Remix Engine) — build workbench

Versioned prototype workbench. Lineage: **golden baseline → V1 → V2.**

- **Golden baseline** — the production golden configurator (`/prototype`), **referenced, untouchable** — the lineage origin (suede scene, materials, lighting, camera).
- **`v1/`** — recorded **hypothesis-1 prototype** (full snapshot; route `/effect-creator/v1`): 3D-always-on + a 2D editor layered on. Proved the cut-out + editor work. **Diagnosis corrected (2026-06-10 audit):** the "~12 FPS always-on-3D perf trap" verdict was a misattribution — the measured cost was a build-effect React loop (~166 ms/frame `buildSquareShape` re-fire) compounded by a broken-HMR dev server during measurement; the fixed scene measures **120 FPS with the mesh loaded** (orbit, damping on). The real v1 freezes are synchronous 2D-pipeline work (Hug slider ~525 ms/tick, main-thread BEN fallback) plus a silent edit-loss replay bug — see `v1/ADDENDUM-V1-RECOVERY.md` + the audit in SSOT `_ssot-workbench/v1/audit/`. It did grow a second geometry engine (real flaw, fixed in V2 by deletion). **Kept intact as the record** (copy-not-move).
- **`v2/`** — the **lean 2D-first build** (route `/effect-creator/v2`). Built from the V1 harvest + rebuilt wiring (2D-first creation, one engine, on-demand 3D, the manufacturing payload).

**Build authority (V2 docs)** lives in SSOT: `_ssot-workbench/_team-work/kai-sidekick/v2/` — the lean 2D-first spec (blueprint), consolidated brief, product overview, decisions log, and the V1→V2 harvest manifest.

*Working name; final product/route name = Dan's call (renaming this folder is a trivial dev-route rename).*
