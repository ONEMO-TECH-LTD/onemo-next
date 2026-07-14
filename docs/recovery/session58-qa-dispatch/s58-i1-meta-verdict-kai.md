# I1 (states) — @s58-expert META verdict (2026-07-08)

HEAD **d671909** (session58-task/react-figma-engine), clean + remote-synced. QA→Meta order (s58-qa PASS
15/15 @ d671909 first; ledger s58-i1-closure-qa-codex.md). Method: full read of the I1 code against the
SIGNED blueprint (§3.5 add-state, §4 editTarget redirect, §6.2 two-kind states) + **MEASURED live probe** on
:3025 (a div-rooted project throwaway, promote→add-state→scoped-write, CSS inspected; two-repo clean after,
library never touched). Not code-read alone.

## VERDICT: FAIL-with-findings (rework) — architecture SOUND, 2 MED defects block a clean Meta PASS.
Route back to Builder for F-M1 + F-M2; F-M3/F-M4 = named notes. Both fixes are bounded (not a rethink).

## CONFORMS + production-clean (verified, defended)
- **§4 editTarget one-mechanism redirect** (page.tsx:2885-2904): a non-base scope routes the SAME inspector
  edit to `write-scoped-declaration` instead of the live-override engine. Verified in source + the scoped
  write landed live.
- **§6.2 two-kind states:** INTERACTION → CSS pseudo; SEMANTIC → boolean prop + `data-<state>` toggle.
  Measured: add-state loading produced `{ loading = false }: { loading?: boolean }` +
  `data-loading={loading || undefined}` on the root — clean, idempotent (re-select = 200 no-op, not 409),
  model lists it immediately from prop presence (the QA-closed finding holds).
- **§3.2 dual preview selector** is EXACTLY the signed form: `.base:hover, :global([data-fc-preview="hover"])
  .base` — the I0 Finding-A fix holds in I1.
- **hover / pressed(`:active`) / focus(`:focus-visible`) + loading / error** all author correctly → clean
  pseudo-rules / prop-driven rules.

## MEASURED FINDINGS (adversarial — beyond QA's 15/15)

### F-M1 — MED — base `transition` is LAST-WRITE-WINS across state kinds (silent smoothness degradation)
PROVEN live: `add-state hover` → `.base { transition: all .15s ease }`; then `add-state loading` →
`.base { transition: opacity .2s ease, background .2s ease }` — the interaction transition was **overwritten**
(writeScopedDeclaration line 534 `decl.value = op.value`). Impact: any real component that is BOTH hoverable
AND loadable (the common case) silently loses part of its transition — a hover animating `transform`/`border`
no longer transitions, and `.15s`↔`.2s` flip by add order. Not composed.
FIX: don't clobber an existing base `transition` — interaction default `all .15s` is the safe superset; if a
`transition` decl already exists, keep it (or merge property lists), never overwrite.

### F-M2 — MED (MATERIAL — hits the DEFAULT surface) — `disabled` is pseudo-only; §6.2 data-attr path unimplemented
PROVEN live: a disabled-scope write emitted `.base:disabled, :global([data-fc-preview="disabled"]) .base`.
The shipped half is `:disabled` — which **CSS-spec cannot match a `<div>`** (`:disabled` applies only to
form-associated elements). Both the server (`STATE_PSEUDO.disabled='disabled'`, lib.ts:598) and the client
redirect (page.tsx:2894) map disabled → `:disabled` ALWAYS; the `propClass` union is only `loading|error`
(lib.ts:263) — there is NO `[data-disabled]` path. **MotherV2 (the default test screen) is `<div>`-rooted →
a disabled state there is DEAD CSS**, and the editor-only `[data-fc-preview]` half makes it FALSELY appear to
work in the gallery preview. The signed §6.2 explicitly requires `.base[data-disabled]` for non-form roots.
FIX: disabled needs the data-attr path for non-form roots — detect the root tag (form-associated →
`:disabled`; else `[data-disabled]` + the boolean/native handling), per §6.2.

### F-M3 — LOW/nuance — interaction vs semantic model-presence asymmetry
Semantic states list from PROP presence immediately (good). Interaction states list only once a `.base:pseudo`
RULE exists (add-state interaction writes only the base transition, "rule created on first scoped edit"). So a
"Hover" chip toggled with no styling edit does not round-trip from the re-read model. Acceptable (an empty
interaction state renders nothing) but name it — the chip-active UI state and the model can diverge until a
declaration is written.

### F-M4 — LOW — add-state requires an inline type literal on the params
`addBooleanPropToComponent` refuses (422) if params lack an inline type literal (typed via a separate
`interface`/`type` alias → "cannot type the new prop"). NOT a blocker for converter output or no-param
components (MotherV2 has no param → the op CREATES one, verified), but a named current limitation for
alias-typed components.

## PRODUCTION + FRAMER-PARITY verdict — STATES capability specifically
- **Framer's REAL state set (EnabledGestures = hover/pressed/loading/error):** hover ✓ pressed ✓ loading ✓
  error ✓ — **PARITY on Framer's actual set**, all four clean-CSS/prop-driven. This is the load-bearing claim
  and it holds.
- **Our web superset (focus/disabled):** focus ✓ (`:focus-visible`). **disabled = the gap (F-M2)** — works on
  form elements, DEAD on div/non-form roots (most converted components). So "beyond Framer" is INCOMPLETE for
  disabled until F-M2 lands.
- **Combinatorial state stacking (hover-WHILE-loading):** correctly NOT in I1 — it's the folded D2 (base
  `scopedSelector` generalization), lands with I2's scope work. Named as scoped-next, not an I1 miss; but the
  states capability is not "complete" until D2 ships (the blueprint already accounts for this).
- **Transition smoothness:** present, but degrades on state-kind combination (F-M1).
- **Production level?** 5 of 6 states production-clean; disabled-on-non-form + the transition collision are
  real production defects, not cosmetic → NOT a clean production pass until F-M1/F-M2 fixed.

## Disposition
I1 architecture conforms to the signed blueprint and 5/6 states are production-clean — strong. But disabled
producing dead CSS on the DEFAULT test screen fails "production level" for that state, and the transition
collision silently degrades smoothness. Both are bounded Builder fixes. → Ready for Builder (F-M1 + F-M2);
re-probe those two at my re-gate; F-M3/F-M4 tracked as notes. Nothing Done — Dan's gate.

---
# META RE-VERIFY @ a1a20da (2026-07-08) — F-M1 + F-M2 + chip-closure: **PASS, I1 META-CLEARED**

Method: full diff-read d671909..a1a20da (lib.ts +44/-7, page.tsx +34/-8) against signed §3.5/§4/§6.2/§6.3
+ MEASURED live re-probe on :3025 (fresh div-root + button-root throwaways; both repos clean after; tsc 0;
editor 200).

## F-M1 (transition last-write-wins) — CLOSED, proven live
`ensureBaseTransition` (lib.ts): checks for an existing base `transition` decl via postcss and SKIPS if
present; both interaction + semantic branches converge on the one canonical `all .15s ease`. Re-probe:
promote → add-state hover → add-state loading → base rule holds **ONE** `transition: all .15s ease`
(previously narrowed to `opacity/background .2s`). Bidirectional (base-rule) per corrected §6.3. Also
preserves a converter-authored transition (skip-if-present covers it).

## F-M2 (disabled dead on non-form roots) — CLOSED, proven live BOTH directions
- DIV root: `add-state disabled` → SEMANTIC path — `{ disabled = false }: { disabled?: boolean }` +
  `data-disabled={disabled || undefined}` on the root; model lists `disabled semantic .base[data-disabled]`
  immediately (prop-presence mirror in parseComponentModel); scoped write emits **`.base[data-disabled]
  { opacity: 0.5 }`** — LIVE CSS, not dead `:disabled`.
- BUTTON root (adversarial): `add-state disabled` stays INTERACTION — `:disabled`, NO prop added. Root-tag
  routing correct both ways (`FORM_CONTROLS`/`FORM_ROOTS` mirrored server+client).
- ScopedTarget propClass union extended to `'disabled'`; client redirect (page.tsx:2903-2914) + preview
  effect (2390-2406, `data-disabled` on the frame root, editModel dep added) + chip add-state trigger
  (2370-2385 `needsAddState` via rootTag) all conform — corroborates s58-qa's source verify + the
  designer's live chip-click proof (chip → add-state → prop on disk).

## Residual (unchanged, non-blocking)
F-M3 asymmetry stands (interaction states list in the model only after a styling edit; semantic list
immediately) — named note, acceptable. F-M4 (alias-typed params 422) stands as a named limitation.

## VERDICT: I1 (states) = META PASS @ a1a20da. QA (15/15 + closure) + Meta both clear.
States capability: Framer's real set (hover/pressed/loading/error) = parity, clean CSS/prop-driven;
focus ✓; disabled ✓ on ALL root types (the F-M2 gap closed). Production-clean for single-state authoring;
combinatorial stacking = D2, lands with I2 scope work as folded. Nothing Done — Dan's gate.
