# figma-to-code SPEC v0.1 — Meta/Peer Review (team lead gate before Dan sign-off)

Reviewer: Kai (s58-lead, acting team lead + meta-QA per Dan directive 2026-07-04)
Artifact: `onemo-ssot-global/tools/figma-to-code/SPEC.md` (read in full, 224 lines)
Method: execution-backed — claims verified against `s58-figma-engine` worktree source
(engine.ts slot law + `_local__` coupling, tagging-loader.cjs, ds-pipeline tools) and the
live token files. Findings first, verdict last.

## Verified-true (spec claims checked against source)
- ✅ Slot law referenced in §3.2 exists: `splitSlots`/`boxSlots`/`editSlot` at `react-figma/engine.ts:145-179`; DeclRef byte-splice contract in ENGINE-PLAN.
- ✅ §3.1 class contract premise real: `_local__` delimiter coupling confirmed at `engine.ts:102-105` + resolver in `api/dev/editor/lib.ts`.
- ✅ Emitted files WILL be tagged: tagging loader stamps all lowercase JSX in the served compile, production-guarded — auto-open-in-editor claim holds.
- ✅ ds-pipeline mapping exists (`build-scan.mjs`, `generate-token-mapping.mjs`).
- ✅ The designer's 8 co-review additions are all grounded, none decorative.

## Findings (ranked)

### F1 · HIGH · §2/§4b/AC7 — the guard partially grades its own homework
Element-count==node-count (§4b-2) counts against the **converter's own IR**, and AC7's
reverse round-trip diffs against **IR_original** — both converter-produced. If the
normalizer silently drops or merges nodes raw→IR, BOTH checks pass while design data is
lost. The §4 ID map is converter-produced too. The only external anchors today are the
probe numbers (285/165) and human pixel-pass.
**Fix:** conformance must include one check anchored to the RAW REST response by an
independent walker (separate small script, spec-defined node-visibility/flattening rules):
raw-tree node census vs emitted ID map. Cheap, closes the loop mechanically.

### F2 · HIGH · §3.4/AC3 — emitted `var(--…)` may not resolve in the target app; spec never checks
A conversion can be 100% "token-conformant" per the report and still render broken,
because nothing verifies the emitted custom-property names exist in the app's built
`tokens.css`. **Live proof, today's tree:** `effect-creator/.../toolbar.module.css:12,14`
consumes `--spacing-m`/`--spacing-l`; `src/app/tokens/tokens.css` does not define
`--spacing-m` — the exact stale-DS bug (KAI-9288) that renders the dock unpadded.
**Fix:** report gains a "resolves?" column per token var + new AC: zero unresolved
var names against the app's current tokens build (unresolved = RED, run fails or flags —
Dan's call, but it must be visible).

### F3 · HIGH · §3 mapping gaps that force implementation-time judgment (the spec's own enemy)
1. **Node `opacity` and `blendMode`** — absent from §3.5 entirely; the glass screen almost certainly uses them.
2. **`strokeAlign`** (INSIDE/OUTSIDE/CENTER) — unmapped. CSS border ≈ INSIDE only; OUTSIDE needs outline/box-shadow; unpinned = borders change element size.
3. **Negative `itemSpacing`** — Figma allows it (overlap stacks); CSS `gap` cannot be negative. Unhandled: pin margin-hack or REFUSED.
4. **Multiple fills per node** (paint stacks) — §3.5 assumes one solid fill; stacking order/`background` composition unpinned.
5. **Gradient types** — only `linear-gradient` pinned; RADIAL/ANGULAR/DIAMOND → mapping or REFUSED, unstated.
6. **`box-sizing`** — Figma dims are border-box; the global assumption must be pinned (one line).
7. **`fontName.style` → numeric weight** ("SemiBold"→600) — table not pinned.

### F4 · MED · §3.1/AC2 — output placement + route wrapper unpinned
Emitter produces component + module.css, but AC2/AC5 need a **rendering route**. Unpinned:
who emits `page.tsx`, the exact output directory in `src/`, and the component/file naming
law (classes have a contract; component names don't). Each is a builder judgment call today.

### F5 · MED · §3.1/§3.5 — three unresolved "or"s
TEXT → `span`/`p` (choice rule unstated) · VECTOR → inline svg **or** asset reference ·
image fill → `<img>` **or** `background-image` (§3.1 defers to §3.5, §3.5 doesn't decide).
Pin each with a deterministic rule.

### F6 · MED · §1 — staleness guard is right but operationally unworkable as written
File `version` bumps on every Figma edit → every conversion after any edit demands a fresh
manual plugin dump, or users learn to bypass the guard. Name the workflow: auto-dump via
the figma-console bridge as part of the CLI run (bridge is already scriptable).

### F7 · LOW · AC4 vs assets
Figma image exports aren't guaranteed byte-stable across runs → "byte-identical output"
can flake on asset bytes. Pin: determinism measured on code + report; assets recorded by
content hash in the report.

### F8 · LOW · §3.6
"Heading typography tokens → h1..h4 by scale" — pin the scale→tag table. "onClick-suggesting
prototype reaction" is fuzzy — pin to a concrete field (node has `reactions[]` with `ON_CLICK`).

## Answers to the six review questions
1. **Intent fidelity:** yes at the architecture level — §3.3 refusal-over-guessing, §3.4
   never-approximate, AC7, §4b are exactly Dan's "mechanical, no agent judgment" ask.
   F1+F2 are the two places the mechanical audit can currently be fooled.
2. **Mapping gaps:** F3/F4/F5 — each one is a judgment call the gate exists to prevent.
3. **Canon gate independence:** layer 1 (external linters, pinned) genuinely independent;
   layer 2's count-check and AC7 self-anchor on the IR — F1.
4. **ACs:** AC3 is well-anchored (external probe numbers). Missing: unresolved-token AC (F2)
   and a console-clean render AC (compiles+renders ≠ renders without runtime errors).
5. **Scope cut:** right for v1. One expectation to set with Dan: output is fixed-frame
   (402×871) — prototype-grade until responsive (named non-goal) lands.
6. **Unnamed risks:** F2 (stale DS — already live in the tree), F6 (guard bypass pressure),
   F7 (asset determinism), local font availability for the pixel pass.

## Verdict: REWORK-with-findings — spec-level only
No architecture change needed; every finding is a doc patch. F1–F3 must land before Dan
sign-off (they're the difference between "mechanical audit" and "mostly mechanical").
F4–F8 can land in the same patch pass — they're small. Re-route to me for closure after
patching; then it goes to Dan.

---

## CLOSURE RE-AUDIT — 2026-07-04 (s58-lead)

Re-read the patched SPEC.md in full (289 lines). Every finding verified against the doc, not the DM:

| Finding | Patch location | Verified |
|---|---|---|
| F1 self-grading | §4b.4 independent raw-REST walker (no shared code, spec-§3 visibility rules) + AC11 | ✅ |
| F2 unresolved vars | §4b.5 "resolves?" column, one unresolved name fails the run + AC12 | ✅ |
| F3.1 opacity/blend | §3.5 — opacity, mix-blend-mode, background-blend-mode for stacks | ✅ |
| F3.2 strokeAlign | INSIDE→border (border-box), OUTSIDE→box-shadow spread, CENTER→REFUSED | ✅ |
| F3.3 negative gap | REFUSED: negative-gap (margin-hacks would break flat-selector canon — right call) | ✅ |
| F3.4 fill stacks | background layers top-first, bottom solid→background-color | ✅ |
| F3.5 gradients | linear/radial/conic mapped, DIAMOND→REFUSED | ✅ |
| F3.6 box-sizing | border-box assumption + canon-check verifies app reset per run | ✅ |
| F3.7 font weights | pinned table, unknown style→REFUSED never guessed | ✅ |
| F4 placement | §3.1 `src/app/(dev)/converted/<frame-slug>/` + page.tsx wrapper + naming law | ✅ |
| F5 three "or"s | TEXT→span always · vectors→always inline svg · img iff no children | ✅ |
| F6 staleness workflow | §1 auto-refresh via figma-console bridge, refusal = fallback only | ✅ |
| F7 asset determinism | AC4 rescoped: code+report byte-identical, assets by content hash | ✅ |
| F8 §3.6 pins | reactions[] ON_CLICK + heading table by bound token path | ✅ |
| +Q4 | AC13 runtime-clean render (zero console errors fresh load) | ✅ |
| +Q5 | §5 fixed-frame expectation statement | ✅ |

**Non-blocking implementation cautions (pin during build, not spec blockers):**
1. A node with an OUTSIDE stroke AND drop-shadow effects maps BOTH to `box-shadow` — the
   comma-list composition order between the stroke-shadow and effect shadows is unpinned.
   One line; pin alongside the gradientTransform shared-function pin.
2. §3.6 heading table paths (`display/* · headline/* · title/* · subtitle/*`) — confirm these
   match the actual figma-var type-scale collection paths at build time before relying on them.

## VERDICT: PASS — spec is build-ready and goes to Dan for sign-off.
