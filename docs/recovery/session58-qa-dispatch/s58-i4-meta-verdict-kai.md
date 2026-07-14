# I4 (connectors) — @s58-expert META verdict @ eeaecae (2026-07-09)

Chain 5752078 → 7239646 → eeaecae, worktree clean. QA→Meta order (s58-qa FAIL F1/F2 + closure PASS first).
Method: full code-read (setConnector both modes, springToLinear, side-channel READ, client trigger/buttons)
against signed §3.6/§6.3/D3/D4/§10-I4 + MEASURED server probes + LIVE browser D3 test. Both repos clean
after, editor 200. Independent — not a relay.

## VERDICT: FAIL-with-findings — ONE BLOCKING (F-M8: engine WRITES NON-COMPILING CODE), plus a model-drift
## MED (F-M9) and a LOW (F-M10). Everything the increment CLAIMS works, works — the blocker is one step
## beyond QA's coverage: the SECOND switch connector.

## (a) State mode — PROVEN, all three legs
- **spring→linear() on the BASE rule (bidirectional §6.3):** probe emitted
  `transition: all 0.733s linear(0, 0.1052, …, 1.0763, …, 1)` — a REAL numerically-integrated damped spring
  (visible overshoot to 1.076 then settle; not a canned curve), attached to `.base`.
- **Side-channel round-trip LOSSLESS:** `/* @fc-transition: hover hover spring 260 20 1 */` → READ returned
  EXACTLY `{mode:state, trigger:'hover', to:{state:'hover'}, spring 260/20/1}` (F2 fixed — trigger+to
  encoded, not placeholders). **write→read→write BYTE-STABLE** (diff-clean re-write, idempotent comment
  drop/re-add).
- **Back-compat:** planted an OLD spring-only comment (`@fc-transition: spring 200 15 1`) → parses without
  crash: `{trigger:'state', to:{}, spring 200/15/1}` — placeholder trigger/to, spring params intact. ✓

## (b) Switch mode / D3 — PROVEN LIVE in the browser (single switch)
Generated code is EXACTLY the D3 idiom: `{ mood: moodProp }` (no destructure default — that's what makes
controlled detectable) + `useState(moodProp ?? 'calm')` + `const mood = moodProp ?? moodInternal` + onClick
guarded `if (moodProp == null)`. Clean-reload browser proof, all 5 assertions:
initial both calm → uncontrolled click → BOLD and HOLDS (400ms later still bold) → controlled own-click →
UNCHANGED (parent wins, no desync) → parent state-set → controlled goes bold (parent drives). ✓
`@fc-connector: tap mood→bold cycle` read back exactly; READ is side-channel-only (D4). ✓

## (c) F1 typed-cycle fix — sound and general
`const vals: ('calm' | 'bold')[] = […]` — the union is derived from the axis's actual values at generation
time, so the fix generalizes to any axis (not this one literal). Adjacent-pattern sweep: `useState(prop ??
'default')` infers the union from the prop's declared type (no untyped-array pattern there); no other
generated-array site found. tsc 0 with the single-switch output. ✓

## FINDINGS (adversarial — beyond QA's coverage)

### F-M8 — BLOCKING — a SECOND switch connector writes NON-COMPILING code (duplicate onClick)
PROVEN: axis-1 switch (mood) OK; then set-connector switch on a SECOND axis (size) → the op inserted a
second `onClick={…}` attribute on the same root → **the file on disk fails tsc: TS17001 "JSX elements
cannot have multiple attributes with the same name."** `assertValidTsx` is syntax-only and does NOT catch
duplicate JSX attrs — so the engine violated its own §8 core guarantee: it WROTE a corrupt (non-compiling)
component instead of refusing. Two switch connectors is a legitimate target (a toggle + a tab axis on one
component — multi-axis is I2's whole point). FIX (either is bounded): (i) detect an existing root onClick
and MERGE the guards into one handler (`onClick={() => { if (aProp==null) …; if (bProp==null) … }}`), or
(ii) REFUSE a second switch with a named 422 ("one switch connector per component in this increment") —
but then it's an explicit boundary, never a corrupt write. Also generalize: the same collision hits a
root that had a HAND-AUTHORED onClick before any connector.

### F-M9 — MED — switch connector DRIFTS the axis defaultValue in the model (§0 violation)
PROVEN: axis `size [sm,lg] default lg` → model reads defaultValue 'lg' ✓. After the switch connector
(which drops the destructure default in the `size: sizeProp` rename — REQUIRED by D3), the model's
variantAxes fallback picks vals[0] → **defaultValue now reads 'sm' — WRONG** (the true default 'lg' lives
only inside `useState(sizeProp ?? 'lg')`, unreadable by the props parse). Runtime behavior is correct; the
MODEL drifts — feeding the gallery default frame, add-variant-value's default retention, and any UI default
display. FIX (D4-consistent): encode the default in the side-channel —
`@fc-connector: tap size→sm cycle default=lg` — and the variantAxes READ prefers the side-channel default
for switched axes. (Parsing the useState arg is the fragile alternative D4 explicitly rejects.)

### F-M10 — LOW — idempotency/re-point path returns a MISLEADING error
Re-running the same switch → 422 `"axis is not a destructured prop"` — wrong class and message. The
designed 409 (`bind.propertyName` check) is DEAD CODE: after the rename the binding's name is `moodProp`,
so the name-matcher never finds `mood` and falls through to the generic 422 first. Also means there is NO
path to RE-POINT an existing switch (change to.value / toggle cycle) — only a confusing refusal. Fix the
lookup to match `propertyName === axis` too → real 409 (or an update path).

## (d) Authoring buttons — honest scope
Edit-mode ENTRY proven live (dblclick on the library row → breadcrumb Home appeared). The Connectors panel
render was NOT confirmed this pass — the tab reset mid-check and the model/auto-promote hadn't completed
(library stayed git-clean; noting the model load after edit-entry was slow under my probing). The lead's
specific worry — the label logic written against the OLD placeholder shape — is CLEARED by code-read
against the REAL model output: the button reads `connectors.find(c => c.mode==='state')?.transition` and
my probes prove the model returns exactly that shape (both new-format and back-compat old-format carry
`transition`), so "Spring 260/20/1" renders correctly either way; the tap-cycle button posts the exact
payload I proved server-side. FULL end-to-end button click-through = MANDATORY at my closure re-gate
(post-F-M8 fix — the buttons hit the very code being fixed).

## (e) PRODUCTION + FRAMER-PARITY verdict — connectors capability
- **State transitions:** GENUINE parity mechanism — real spring physics (Framer's stiffness/damping/mass,
  §1.3) compiled to standards CSS `linear()`, authoring params preserved via side-channel (lossless
  round-trip proven). This out-Framers Framer on output (no runtime).
- **Persistent tap-switch:** the D3 controllable semantics are EXACTLY right (proven live both halves) —
  this is Framer's `CycleVariantState` as clean idiomatic React. **But parity claim capped at ONE switch
  per component until F-M8** — Framer components can carry multiple interactions; ours corrupts on the 2nd.
- **Model integrity:** F-M9 breaks §0 (re-read reflects truth) for switched axes' defaults.
- Production: single-connector authoring is production-grade; the increment is NOT production-clean until
  F-M8 (corrupt write) + F-M9 (model drift) land.

## Disposition
FAIL-with-findings → Ready for Builder: F-M8 (blocking) + F-M9 (MED) + F-M10 (LOW, fold if trivial).
All bounded — merge-or-refuse on the onClick site, a default token in the side-channel + READ preference,
a propertyName-aware lookup. My closure re-gate re-runs: second-switch (merge works or named 422; file
compiles either way), hand-authored-onClick case, default-drift check (lg stays lg), the (d) full button
click-through, and the (a)/(b) gates unchanged. I5 stays HELD (correct call — F-M8's fix may touch the
same page.tsx overlay region). Hygiene: probes + stale .next stubs removed, BOTH repos git-clean (0
changes), tsc CLEAN. **INCIDENT (honest): the :3025 dev server DIED during my gate** — port no longer
listening at the end of my probing; likely trigger = the F-M8 corrupt-file HMR churn plus probe-route
add/remove cycles. Source state is verified clean and compiles, so a plain dev-server restart in the
designer's pane restores it — flagged to the designer immediately, not hidden. Nothing Done — Dan's gate.

---
# META RE-VERIFY @ 99a9ea2 — F-M8 + F-M9: **PASS, I4 META-CLEARED** (F-M10 carried as LOW residual)

Method: fix-diff read + independent live probes (fresh fixtures, not QA's) + the deferred (d) full button
click-through in the LIVE editor. Both repos clean after, tsc CLEAN, editor 200.

## F-M8 — CLOSED, proven both directions
- MERGE: two switches (tone default cool, size default lg) on one root → EXACTLY ONE `onClick` with BOTH
  guards spliced (`if (toneProp == null) …; if (sizeProp == null) …` — each guard checks its own prop, no
  cross-desync). tsc CLEAN with the two-switch fixture on disk.
- REFUSE: a hand-authored EXPRESSION-bodied onClick (`onClick={() => console.log('hand')}`) → named 422
  "not an inline block handler — compose manually", file UNCORRUPTED (1 onClick, zero @fc-connector
  residue). Never a corrupt write — §8 restored.

## F-M9 — CLOSED, proven
`@fc-connector: tap tone→warm cycle default=cool` / `… default=lg` — the side-channel now carries the real
default; model reads `[(tone,'cool'),(size,'lg')]` — NOT values[0]. Both connectors round-trip.

## (d) COMPLETED — full authoring-button click-through in the live editor
Components rail → dblclick DemoButton → edit mode → **Connectors panel RENDERS live** → clicked "Add spring
transition" → server wrote auto-promote (DemoButton.module.css created) + the spring connector
(`@fc-transition: hover hover spring 260 20 1` on disk, verified) → model reloaded → **label re-rendered
"Spring 260/20/1"** — the lead's shape-mismatch worry is click-proven closed, not just code-read. Library
snapshot/verified/REVERTED (0 changes). (Tap-cycle buttons absent for DemoButton = correct — it has no
variant axes; legacy multi-export.)

## F-M10 — UNFIXED, carried (LOW, non-blocking)
Re-running the same switch still returns the misleading 422 ("axis is not a destructured prop") — the 409
propertyName path is still dead code, and there is still no re-point/update path. Refusal is SAFE (nothing
written, no corruption), so it doesn't block I4 closure — named residual for the I5/board slice (where a
connector edit/re-point surface will need it anyway).

## VERDICT: I4 (connectors) = META PASS @ 99a9ea2. QA + Meta both clear (second pass).
Connectors capability: state transitions = genuine parity (real spring physics → standards CSS, lossless
authoring round-trip); persistent tap-switch = correct D3 semantics INCLUDING multiple switches per
component (merge) and safe refusal on unmergeable roots. I5 (variant board UI) UNBLOCKS. Nothing Done —
Dan's gate.
