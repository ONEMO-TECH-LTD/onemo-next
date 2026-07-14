# Chief-QA review — engineer Framer parity seam map

**Verdict: REWORK before dependency/build-order freeze.** Reviewed 50/50 lines of `/tmp/s58-framer-contract-rework-seam-map-engineer.md` against the durable atomic acceptance checklist and locked Framer/minimum-bar evidence.

## What is sound

- Exact four-command current surface and lifecycle/semantic separation.
- Legacy component writers remain blocked; only staged CompilerAdapter plans may replace them.
- Root-cause analysis of the global-only dead-end.
- Existing graph entities are reused where they genuinely fit; props get a new typed public-property/control model.
- Preview remains transient; folders and instances preserve stable graph identity.
- Per-edge versus target-variant transition ownership is correctly held as an unresolved architecture decision.

## Blocking gaps/drift

1. **Component-content editing and the Style inspector have no seam map.** A describes shell entry/infinite canvas, not selecting/editing inner content. K is absent entirely. Define the staged commands/compiler seams for Link, Position/Size, Layout, Effects, Overlays, Cursor, Transition, Opacity, Visible, Fill, Overflow, Radius, plus selection/source projection/reload/undo. These primitives are dependencies for props, states, and interactions—not a final polish slice.
2. **H uses `AssetsTree`, contradicting Dan's topology law.** Components must have a dedicated self-sufficient Components page/rail; Assets remains images/icons/upload only. Name and architect the owning surface accordingly.
3. **H omits required organization mutations:** move category and Project↔Global move with file move, barrel regeneration, and consumer import rewrite. `move-component-to-folder` is not equivalent.
4. **C proposes `duplicate-variant` and `set-primary-variant` without frozen Framer evidence.** Keep them SPEC-PENDING unless live/compiled Framer evidence or a Dan decision proves them; no invented command surface.
5. **A cannot silently choose global authoring semantics from the bug.** Root-aware blank create/move is locked by Dan's minimum bar, but the behavior of double-clicking a library/global component still needs source-exact AC (edit, navigate to source, or read-only feedback). Fix reachability without guessing Framer's library rule.
6. **F transition ownership must be proven before schema change.** Use expert's compiled/live extraction to decide per-edge versus variant ownership; do not infer from UI appearance alone.
7. **New Event remains unnamed architecture.** F needs a SPEC-PENDING row and later an exact event model/command/runtime seam after expert evidence.
8. **Instance UI acceptance is incomplete in the map:** include Trigger and distinguish Edit Component from Go to main, even if both are navigation/read surfaces rather than mutations.
9. **Cross-cutting transaction/history rules need explicit inheritance:** every new mutation must name undo/reload/persistence/dead-end coverage and whether it is single-root or cross-root atomic.

## Dependency correction

Recommended architectural order after contract sign:

1. Reachable entry + blank/root-aware creation.
2. Inner-content selection/edit transaction primitives + component Style inspector foundation.
3. Lifecycle/organization primitives required to maintain valid components.
4. Variants/primary overrides and states.
5. Typed props/instance overrides.
6. Interaction edges/transitions + preview runtime.
7. Folders/components-page and full instance lifecycle.

The exact delivery slicing can differ, but no feature depending on selected inner content may precede the content-edit/inspector seam.
