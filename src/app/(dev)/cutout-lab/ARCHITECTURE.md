# cutout-lab — flow-bridge contract (I1 · KAI-10196 · authored by s62-meta, 2026-08-06)

The execution contract for the Layer-2 rebuild. Code is MATCHED against this file — a line of code
that violates a line here is slop by definition and gets deleted, not defended. QA of the I1 delta
is a clause-by-clause match. Enforcement: `src/lib/cutout-ai/AUDIT.md` (which gains §8 Performance
in I3); companion module contract: `src/lib/cutout-ai/ARCHITECTURE.md`.

## Why this exists (the root cause being cured)

The lab consumed v5.3.1 as a function library (Layer-1) and re-invented orchestration policy
inline in the shell — compose-per-knob-tick, uncancelled, unbudgeted. Measured cost: a 10-step
Detail drag allocated **1.56 GB** (dozens of 61 MB mirror-mosaic canvases) → the iPhone tab dies
mid-gesture, model-independent. The engine's own Phase-5 architecture already solved this:
policy lives in a FLOW compose-function behind a `{state, actions}` seam; the original studio's
edit loop composites nothing. The lab gets the same shape.

## The three layers — hard boundaries

1. **Layer-1 — v5.3.1 engine (UNTOUCHED).** `lib/effect`, `vector-core`, `outline-core`, the
   v5.3.1 primitives/producers. No edits in I1. The flow COMPOSES these; it never re-implements
   any capability they own (the two killer questions apply to every function: does the engine own
   this? was this observed running?).
2. **Layer-2 — `cutoutLabFlow` (NEW — this increment).** One compose-function conforming to the
   flow-contract PATTERN (`flows/flow-contract.ts` is the reference; conform, don't import it
   wholesale — it is typed against v5.3.1's DesignState/sceneStore). Returns `{state, actions}`.
   OWNS ALL POLICY — the complete list, nothing stays in the shell:
   - compose cadence (the Cadence Law below) + bake sequencing, coalescing, cancellation
   - the auto-blend-on-outgrowth rule (value-true: sets the knob state, never a silent override)
   - undo/redo/clear history semantics (HistoryStack stays a pure module; the flow drives it)
   - engine selection (`?seg=` roster param) + segmentation calls (bridge `runCutout`/preseg)
   - tool actions: AI brush strokes, wand fill/erase, paint add/erase, node/frame edit commits —
     all enter as flow ACTIONS; their orchestration (accept → prepare → finish → bake) is flow code
   - PerfHUD gesture marking (`perfGesture`) on every bake/resolve/segment
3. **Layer-3 — the shell (`page.tsx` + `EditorOverlay`) — NEUTRAL + SWAPPABLE.** Binds ONLY to
   `{state, actions}`. Render, gesture capture, coordinate mapping, ink/comet drawing, CSS. ZERO
   policy: no compose calls, no cadence decisions, no engine imports, no default-value decisions.
   Test: the Figma shell (I5) must be mountable on the same flow with no flow changes.

## The Cadence Law (the crash fix, stated as architecture)

- **During a drag, the compositor is NEVER called.** Knob ticks re-resolve vectors only
  (`resolveTraceOutline` path). The live view during a drag shows the last committed bake clipped
  to the updating outline — never a fresh compose per tick.
- **Compose is SINGLE-FLIGHT and LATCHED**: at most one bake in flight, ever; requests during a
  bake coalesce to the latest settings; a superseded in-flight bake is CANCELLED (its canvases
  released), not merely ignored. Trigger: knob release / idle (~250ms), upload-accept, tool-commit,
  Save, Preview. Reference implementation: `twoDFirstFlow`'s first-blur watcher (latched,
  in-flight-guarded, stale-guarded, reset-on-failure).
- **Blend-0 short-circuit stands**: neutral settings inside the frame = original under the vector
  mask, compositor not invoked at all (existing law, re-verified in I1).

## Performance budgets (PerfHUD-enforced, `?perf=1`)

- Editor tick ≤ **16 ms** · no main-thread task > **50 ms** per interaction tick (the engine's own
  §9 budgets, ported with PerfHUD).
- A 10-step Detail drag at blend-100/mirror defaults allocates ≤ **0.2 GB** total, **zero** canvases
  over the edit-time ceiling (I1: no 61 MB mosaics mid-drag; I2 lowers the ceiling to ~4 MB via
  preview-res compose — out of I1 scope, do not build it early).
- Every bake/resolve/segment emits a `perfGesture(label, ms)` marker.

## Conform vs never-clone

- **Conform to**: the flow-contract pattern (`{state, actions}`, adapters injected — notify,
  URL params read by the shell and passed in; the flow never touches `window`/DOM except via its
  canvas inputs), the engine's preseg/bridge seams, the existing pure modules (HistoryStack,
  ui-config, cutout-ai subs, cutout-wand).
- **Never clone**: any engine formula or pipeline step (matte math, mask hygiene, trace, outline
  ops, compositing — all engine calls); the flow-contract file itself (pattern, not import); any
  constant that exists in the engine (import it — `SAM_AREA`, `SAM_CENTRAL_PROMPT`, `samSoftProb`
  precedents).
- **finish.ts** survives as the flow's internal glue (engine composition only); anything in it that
  decides WHEN moves into the flow. **page.tsx** sheds `recomposeLive`, bake sequencing, blend
  policy, engine selection wiring — all into the flow.

## Verification gates (I1's Done, all with evidence)

1. Shell purity: grep + whole-read of `page.tsx`/`EditorOverlay` — zero compose/cadence/policy.
2. Probe: 10-step Detail drag at defaults ≤ 0.2 GB, zero 61 MB canvases, max one bake in flight —
   numbers pasted into KAI-10196.
3. PerfHUD live; drag ticks within budget on desktop.
4. Regressions on the launched bench: ear-gap union · blend-0 no-compositor · offset-0 · u2net/
   EdgeSAM parity · undo/redo/clear · Save output unchanged (hash vs pre-I1, same inputs/settings).
5. Engine suite 402/402 · typecheck clean · `git diff` on the v5.3.1 perimeter empty.
6. On-device (Dan): Detail drag on iPhone — no crash. The defining test; nothing is Done before it.
