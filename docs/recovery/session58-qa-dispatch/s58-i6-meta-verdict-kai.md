# I6 (structural variants) — @s58-expert META verdict @ 6eaa9d1 (2026-07-09)

Chain 7064b83 → f69a0a3 (F-I6-1) → e04c34c → 6eaa9d1 (F-I6-2 option A), worktree clean. QA→Meta order
(QA 40/40 round-3 closure first). Method: full code-read (setVariantStructure + the shared guard-parsing
mirror + StructureNode condVariant READ) against §3.9/§10-I6 + live probes on a project throwaway + SSR
render proof per axis value. Both repos clean after, tsc CLEAN, editor 200. Independent — not a relay.

## VERDICT: FAIL-with-findings — ONE BLOCKING (F-M12: same-axis/different-value nesting = corrupt write,
## the lead's own suspicion #1 confirmed). All 8 pre-declared gates otherwise PASS, proven.

## The 8 pre-declared gates
1. **FLAT conditionals — PASS.** add → `{size === 'sm' && (<strong…/>)}`; one guard per subtree; no nesting
   emitted by the op itself. Byte-verified on disk.
2. **remove = guarded-not-deleted — PASS.** `{size !== 'lg' && (<em>beta</em>)}` — the node stays in source;
   PROVEN by render: `<Comp size=sm/>` still shows beta, `size=lg` hides it.
3. **swap = the ONE single-level ternary — PASS.** `{size === 'lg' ? (<span>ALPHA-LG</span>) : (<span>alpha
   </span>)}` — single level, at the swap site only.
4. **deep-reparent → named 422 — PASS.** add `before` the ROOT element (parent = return parens, not a
   children list) → the exact walled message; file unchanged.
5. **Refusals real — PASS.** Bogus axis → 422 "not a prop" (F-I6-1 ✓); out-of-union value → 422 with the
   declared list; target-not-found → 404; different-axis-guard nesting → (code-read; the ax!==axis walk).
   ROOT swap (would wrap the return in a `{…}` container = invalid) → refused by the OUTPUT parse-guard,
   file unchanged — refuse-not-corrupt held.
6. **`<Comp axis=v/>` renders divergent structure per value — PASS, SSR-proven.**
   sm → alpha + beta + badge · lg → ALPHA-LG + no-beta + no-badge. (The board's frame-per-value render path
   is BYTE-IDENTICAL to I5 — the I6 diff touched only lib.ts — so the I5 live board proof carries; the
   per-value divergence is what I6 adds and it renders exactly.)
7. **Round-trip lossless — PASS.** Structure READ: `span @ size=lg` + `span @ size≠lg` (BOTH ternary
   branches), `em @ size≠lg` (negation preserved), `strong @ size=sm`. The shared guard-parser is the true
   READ mirror of the WRITE shapes.
8. **tsc 0 + §0 no-drift — PASS** for everything the op legitimately writes.

## Lead's two adversarial asks
- **ADV 2 (swap ternary × later add/remove on a branch) — SAFE, proven.** remove targeting the ALPHA-LG
  branch element → refused (the spliced `{…}` guard in expression position is a parse error → output
  parse-guard 422), file byte-unchanged. add-sibling inside a branch → REPARENT 422 (parent is parens).
  Never corrupts. LOW note: the refusal message is the generic "would produce invalid code (N parse
  errors)" — safe but not semantic; a friendlier "target is inside a swap branch — edit the swap" would
  cost one ancestor check. Not blocking.
- **ADV 1 (same-axis nesting) — THE BLOCKER, see F-M12.**

## F-M12 — BLOCKING — same-axis/DIFFERENT-value nesting is ACCEPTED and writes tsc-broken code
The different-axis wall exists (`ax !== axis` refuses); the SAME-axis walk falls through with NO value
check. PROVEN: add with `{size, lg}` INSIDE the `{size === 'sm' && …}` subtree → ACCEPTED → wrote
`{size === 'lg' && (<u>never</u>)}` inside the sm-guard → **tsc TS2367 on disk** ("'sm' and 'lg' have no
overlap" — TS narrows `size` to 'sm' inside the outer guard, so the inner comparison is provably
impossible) — a CORRUPT WRITE (§8), the 4th of the build (F-M8, F-M11 pattern), plus semantically dead
code even where TS wouldn't flag it (3+-value unions under a negated outer guard can also contradict).
FIX (bounded, completes the existing wall): in the ancestor-guard walk, when `ax === axis`, compare the
guard's VALUE against the edit's: outer `=== v1` + edit `v2 ≠ v1` → 422 "contradicts the enclosing
'<axis> = <v1>' guard — edit at the outer guard"; outer negated `!== v` + edit `v` → same 422; compatible
(same value, or negated-other) → allow. Symmetric to the different-axis wall, one value comparison.

## INCIDENT/POLLUTION note (flagged, not hidden)
An UNTRACKED leftover fixture `react-figma-components/I6Nest.tsx` (+ .module.css) was sitting in the tree
carrying EXACTLY the F-M12 shape (`{shape === 'square' && (<div>{shape !== 'round' && …}</div>)}`) and
failing project tsc (TS2367 at 7:30) — i.e. another lane's probe already MANUFACTURED this bug and left it
on disk uncleaned, contradicting "tsc 0 / both repos clean" closure claims at face value (it was untracked,
so `git status`-based checks and scoped tsc runs missed it). I quoted it here as evidence and removed it
(probe-cleanup discipline); project tsc now CLEAN.

## Production + parity verdict — structural variants
The §3.9 model is genuinely production-clean for everything it accepts: flat guards, reversible removes,
single-ternary swaps, real walls, lossless round-trip, honest SSR-proven divergence. Framer's structural
variants (layers differing per variant) = MATCHED for the add/remove/swap surface with clean conditional
JSX out — and the walled edges are explicit 422s, not silent gaps. NOT production-clean until F-M12 lands
(the board's own flow can hit it: author a structural add inside an already-guarded subtree with another
value selected).

## Disposition
FAIL-with-findings → Ready for Builder: F-M12 (blocking; one value-comparison in the existing ancestor
walk). LOW notes: generic parse-guard refusal message (ADV 2), F-M10 still carried from I4. My closure
re-gate: same-axis/different-value → named 422 + file unchanged; same-axis/SAME-value → allowed (or
no-op'd) sanely; negated-guard contradiction → 422; different-axis wall + all 8 gates unchanged. On
closure → I6 clears → **I0–I6 ALL CLEAR: the engine e2e milestone** → the ONE report to Dan. Hygiene:
probes + pollution removed, both repos 0 changes, tsc CLEAN, editor 200. Nothing Done — Dan's gate.

---
# META CLOSURE RE-VERIFY @ 5099f12 — F-M12: **PASS. I6 FULLY CLEARED → I0–I6 ALL CLEAR (engine e2e)**

Method: fix-diff read + full re-probe on a fresh 2-axis fixture. Both repos clean after, tsc CLEAN, editor 200.

## Design ruling (lead asked my read): BLANKET REFUSAL IS CORRECT — I withdraw my value-comparison variant
§3.9's law is literal ("one guard per subtree, never nested") and the CAPABILITY IS NOT LOST: the legitimate
"more sm-only content" flow is a second FLAT SIBLING guard, which works (proven: added a second
`{size==='sm' && …}` sibling → model reads `strong @ size=sm` + `u @ size=sm`, both FLAT) — and content
INSIDE an existing guarded subtree is already value-scoped, so it never needs a nested guard (plain
insert/edit ops cover it). Compatible-nesting has no real use; the simpler rule wins. Agree with the call.

## Proofs at 5099f12
- F-M12 repro (same-axis/diff-value inside the guard) → the semantic 422 ("§3.9 keeps structural guards
  flat, never nested"), file byte-unchanged ✓
- same-axis/SAME-value → 422 (blanket) ✓ · cross-axis → 422 unchanged ✓
- ADV-2 UPGRADED: remove targeting a swap-branch element now refuses with the SEMANTIC guard message
  (previously the generic parse-error message) — my LOW note from the first pass is closed as a side effect ✓
- All 8 gates re-proven on the fresh fixture: flat add/remove/swap byte-verified · round-trip lossless
  (5 guards incl. both ternary branches + negation, ALL FLAT) · SSR per-value exact (sm: alpha+beta+
  sm-only+second · lg: ALPHA-LG, none of them) · tsc CLEAN · walls unchanged.
- I6Nest pollution: confirmed gone on my end too (repo clean at 5099f12).

## I6 = QA PASS + META PASS. **I0–I6 ALL FULLY CLEARED (QA + Meta, every increment).**
The engine works end to end: promote substrate · 6-state two-kind states · multi-axis config variants ·
props (4-route expose + bridge + instance overrides) · connectors (spring→linear + D3 tap-switch) ·
axis-grouped variant board with live authoring · structural variants (flat guards, walled edges).
Carried non-blocking residuals, named: F-M10 (connector re-point path — lands with connector-editing UI).
Nothing Done — Dan's gate; the consolidated engine report goes to Dan now.
