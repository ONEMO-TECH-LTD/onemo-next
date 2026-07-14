# Framer domain HARD-CONTRACT INPUT — @s58-expert
2026-07-10 · slots into `s58-framer-component-authoring-HARD-CONTRACT-v0.md` PENDING-TEAM-INPUT for §3, §4, §5, §6, §9, §14.
Role: Framer behaviour/domain authority. **No product code. No blueprint edit. No sign-ready claim.** Evidence classes per
contract §1: `OBSERVED` (operated/read live) · `INFERRED` · `PRODUCT DECISION` · `UNVERIFIED`.
Sources: my extraction ledger `s58-framer-extraction-ledger.md`; QA `_archive-superseded-2026-07-11/s58-framer-clone-adversarial-qa.md` §10-13 (superseded — findings folded into current hard-contract-v0); designer
`_archive-superseded-2026-07-11/s58-framer-blueprint-review-designer.md` (superseded — findings folded into current Meta reconciliation); **G0 live-closure pass done THIS session in authenticated Framer (scratch "Powerful Autonomy")**.

---

## A. G0 EVIDENCE CLOSURE — results of my live pass (contract §11-G0, §6-unverified)
I operated each unverified op in authenticated Framer. **Honest harness note:** the automation reliably operates inspector
controls, context menus, keyboard (delete/undo), and selection; it reliably FAILS pointer **drag** and some **create** gestures
(all three lanes hit this). Where a gesture couldn't be driven, I label UNVERIFIED-VIA-HARNESS and give the observed mechanic —
these need a real-user/manual pass to fully close (input to G0 planning: **G0 cannot be closed by automation alone**).

| Op | Result this pass | Class |
|---|---|---|
| **Override-aware interaction removal** | ✕ on an inherited `Click→Set Variant` did NOT hard-delete → became **`Click → Reset…`** (Reset Override). | **OBSERVED (me)** — confirms QA §10.3 |
| **Undo inverse** | `⌘Z` restored the interaction to `Click→Set Variant` + restored the Layers/badge state. | **OBSERVED (me)** |
| **▶ badge semantics** | Badge present on the variant WITH an active interaction; **disappeared** when interaction reset; **returned** on undo. Rule = badge tracks an *effective* interaction **in the tested state**. | **OBSERVED (me)** — the exact badge matrix beyond this (incl. designer's zero-interaction-selected note) stays **UNVERIFIED**, not reconciled |
| **Delete-component guard** | Component ctx menu **Delete is DISABLED (greyed)** while an instance exists on canvas. | **OBSERVED (me)** — confirms contract §8 live-instance guard |
| **Hover/Pressed creation + auto-wire** | **CLOSED (2nd pass, live).** State ghost ⊕ → `Hover / Pressed` choice → creates a named `<Variant> · Hover` state frame; selecting Primary shows a **STRAIGHT wire auto-drawn Primary→Hover** AND the **Interactions panel is EMPTY** → the hover connection is an **IMPLICIT state-gesture wire, NOT an explicit Set-Variant InteractionEdge**. | **OBSERVED (me, 2nd pass)** — model note in §C.7 |
| **Connector drag-pickup (canvas ⚡ handle)** | **CLOSED (2nd pass, live).** Dragging the ⚡ edge-handle from a selected variant onto a target variant **creates an interaction + opens the Interaction popover** (On: Click/Click Start/Appear/Mouse Enter/Mouse Leave + Delay; target = the dropped-on variant). Undone after. | **OBSERVED (me, 2nd pass)** |
| **New Event** | Interactions `+` menu = **`New Transition | New Event`** (separate paths). New Event produced no distinct action row under harness → action/trigger model not observed. | **OBSERVED** (path exists) / **UNVERIFIED** (action model — correctly EXCLUDED from v1, contract §3.9) |
| **Insert (asset→canvas, drag + menu)** | Still not reproducible: drag-from-Assets ×2 and menu-Insert ×2 produced **no new instance** (canvas + Layers). **Boundary now precise:** *canvas-internal* drags work (connector pickup did), but *asset-panel→canvas* insert uses **HTML5 drag-drop across the panel/iframe boundary** which the synthetic harness cannot fire. | **OBSERVED** (menu item + Delete-guard) / **UNVERIFIED end-to-end** — harness limit at the DnD boundary; needs manual pass or **PRODUCT DECISION** §14.3 |

### A.1 UNVERIFIED items → explicit PHASE BLOCKER (contract §11-G0: close before the affected phase)
| Item | Blocks phase | Status after 2nd live pass |
|---|---|---|
| **Hover/Pressed created-frame + auto-wire** | G2/G3 | **CLOSED** — named `<Variant>·Hover` frame + IMPLICIT straight Primary→Hover wire (no explicit interaction row) |
| **Connector drag-pickup gesture** (canvas ⚡ handle) | G3 | **CLOSED** — ⚡-handle drag → target → interaction + trigger/Delay popover |
| **Insert — asset→canvas (drag + menu)** | **G4** | **STILL UNVERIFIED** — HTML5 DnD across panel/iframe boundary; synthetic harness can't fire it. Needs manual pass **+ Dan §14.3** (parity vs product) |
| **New Event action/trigger model** | none in v1 (excluded §3.9) | **DEFERRED** — do not invent; observe before any future New-Event phase |

**G0 planning consequence (updated after 2nd pass, Framer access restored):** I closed **2 of the 4** remaining items live —
Hover/Pressed creation+auto-wire and connector drag-pickup both OBSERVED. The precise remaining gap is **asset→canvas Insert**
(both drag and menu): a **cross-boundary HTML5 drag-drop** the synthetic harness cannot drive (canvas-internal drags DO work — the
connector pickup proved it). So G4's insert AC needs a short **manual/real-user pass** (or a Dan product decision §14.3); New Event
stays deferred, not a v1 blocker. **Everything closeable by automation is now closed.**

---

## B. OBSERVED BEHAVIOUR MATRIX (contract §5 + §6 — row-by-row, labelled, pointered)
Everything the canonical model must represent. Class + source in each row.

| # | Behaviour | Class · source |
|---|---|---|
| B1 | Edit-in-place: instance→**Edit Component**(inspector) / double-click → SAME infinite canvas `?node=<comp>`, ONLY that component's variants as free frames; breadcrumb `Home › <Name>` top-bar chip; Layers lists variants; Home exits | OBSERVED · me+designer+QA |
| B2 | Create-from-selection = ONE transaction: ⌘⌥K → **New Component** naming dialog → replaces layer w/ instance, registers asset, changes node URL, enters Home>Component + **Primary** | OBSERVED · QA operated; designer saw dialog |
| B3 | Blank create: Components `+` / New Component | OBSERVED · me |
| B4 | Variants = free named frames; "Variant 1" = **Primary** default; `+Variant` ghost → new free frame; free x/y/w/h | OBSERVED · me+designer |
| B5 | **PRIMARY-LINKED OVERRIDE lineage:** variant ctx menu = **Show Primary · Detach From Primary · Update Primary · Reset Overrides** | OBSERVED · QA + ME re-verified |
| B6 | State ghost slot → **Hover / Pressed** choice | OBSERVED · me (menu) |
| B7 | Interactions `+` → **New Transition | New Event** | OBSERVED · me+designer |
| B8 | Trigger vocab (live `<select>` value `onTap`): **Click · Click Start · Appear · Mouse Enter · Mouse Leave**; "Click"→compiled `onTap` | OBSERVED · designer + ME |
| B9 | Set Variant params: **On · Delay(s) · Transition Once|Cycle · Variant(target)**; multiple rows/variant | OBSERVED · designer + ME |
| B10 | **Removal is override-aware:** ✕ on inherited interaction → **Reset Override** (not delete); **undo restores** | OBSERVED · ME (this pass) + QA |
| B11 | **▶ badge tracks an active interaction** (gone on reset, back on undo) | OBSERVED · ME (this pass) |
| B12 | Wire = **STRAIGHT edge-to-edge, arrowhead at TARGET**, owning-variant→target; overlay (wire/ghost/badge) **SELECTION-SCOPED** | OBSERVED · designer measured + my 07-09 pass |
| B13 | Transition types **Instant · Ease · Spring**; Spring **Based On Time|Physics** (Time=Duration/Bounce/Delay, Physics=Stiffness/Damping/Mass/Delay) | OBSERVED · QA + ME re-verified |
| B14 | Instance inspector: `<Name> · Component` + Variant picker + Trigger:Add + **Edit Component**; ctx menu **Detach · Replace With · Replace All Instances With**; ctx "Edit" does NOT enter node | OBSERVED · me + QA |
| B15 | Assets tree Templates/Components/Styles/Vectors/Code; **nested folders**; folder ctx New Component/New Folder/Sort; component ctx Insert/Edit/Find/Rename/Duplicate/Delete/Library/Copy Import/Copy URL; **Delete disabled while instances exist**; menus are **searchable command palettes** | OBSERVED · me + QA |
| B16 | Play = separate `preview-iframe` (`view=preview`); interactions run live; ‹Back exits; author `canvas-iframe` ≠ preview-iframe | OBSERVED · me + QA |
| B17 | Compile target (fetched module): flat variant-IDs + `humanReadableVariantMap` aliases; interactions→per-variant `onTap` overrides calling `setVariant(id)`; spring via `MotionConfigContext`; `addPropertyControls` Enum; `withCSS`; imports `framer`+`framer-motion` | OBSERVED · designer module fetch |
| U1-U4 | **STILL UNVERIFIED** (see §A): New Event action model · **asset→canvas insert (drag + menu, HTML5-DnD boundary)** · exact ▶-badge matrix beyond the tested case · full folder/variant destructive+error paths. *(Hover/Pressed auto-wire + connector drag-pickup are now CLOSED this session — see §A; removed from this list.)* | UNVERIFIED · manual pass |

---

## C. CANONICAL MODEL — agreement / disagreement (contract §3, §4; QA §12.2)
**Direction AGREED — the AuthoringGraph + SourceProjection + CompilerAdapter boundary (contract §4) is right.** Specific challenges:

1. **VariantFrame MUST carry first-class override/inheritance, not just `primaryId`.** *(strongest push — evidence B5, B10)* Framer's
   Show/Detach/Update/Reset-Overrides operate on **per-property overrides vs Primary**; `primaryId` alone cannot express them.
   **CORRECTED per QA reconciliation:** the graph records **override MEMBERSHIP as typed stable `SourcePropertyRef`s** (*which* properties
   are overridden) + `detached: boolean` — **NOT** a value-carrying `PropertyOverride[]`. **Override VALUES stay TSX/CSS-owned**
   (contract §4: sidecar must not duplicate declaration values); the SourceProjection owns the value, the graph owns the membership/reference.
   Invariant §3.3 is therefore model-structural (it needs the membership field), not a label.
2. **InteractionEdge lineage + Reset Override — UI observation vs model representation.** *(evidence B10; QA reconciliation)* The UI
   **Reset Override is OBSERVED** (✕ on an inherited interaction → "Reset…"; ⌘Z restores) — **preserve that observation.** But the CANONICAL
   representation is **NOT a runtime `action: reset-override` on the edge.** Per the engineer's model it is an **`InteractionOverride` tombstone +
   a `reset-interaction-override` command**: resetting removes/tombstones the inherited-interaction override; it is not a behaviour the component
   performs at runtime. **Keep `inheritedFromEdgeId` for lineage; DROP `action: reset-override` as an edge action.** (Correcting my earlier claim.)
3. **Drop source line/col as instance identity.** *(engine-history)* Positions drift on any edit above; use a stable source anchor/marker or
   recompute inside the transaction. Contract invariant §3.1 ("stable ID independent of source line") already implies this — make it explicit for `ComponentInstance`.
4. **TransitionSpec = 4 forms** (Instant/Ease/Spring-Time/Spring-Physics), each with Delay; Ease needs the observed curve-name enum (G0). *(evidence B13)* — agree with QA's 4-form spec.
5. **Trigger enum is display-side; compiler maps → `onTap`-class.** *(evidence B8)* Store `click|click-start|appear|mouse-enter|mouse-leave`; CompilerAdapter owns display→compiled.
6. **New Event stays excluded** (contract §3.9) until its action model is observed — agree; do not invent a generic event abstraction.
7. **State-variant hover connection is IMPLICIT, not an explicit InteractionEdge** *(NEW evidence, 2nd live pass — refines B6/B12; does NOT
   reopen any reconciled decision).* With a Hover state present, selecting Primary shows a **straight auto-wire Primary→Hover while the
   Interactions panel is EMPTY.** → The model must distinguish an **implicit state-gesture connection** (carried by `VariantFrame.stateKind:
   hover|pressed`, auto-triggered) from an **explicit `InteractionEdge`** (Set Variant + trigger vocab). **Do NOT synthesize a phantom
   InteractionEdge for hover/pressed** — the stateKind IS the trigger; the wire is a *render of the state lineage*, not a separate edge.
   Fits the engineer's existing `stateKind` field — no schema change, just this semantic rule.

---

## D. CLEAN-SOURCE / MIGRATION concerns (contract §4, §9 — expert slots)
1. **Type-aware round-trip, not just parse-valid** *(I0–I6 scar):* `assertValidTsx` is **syntax-only** — type-invalid-but-parseable code (e.g. `TS2367`)
   passed the guard and landed on disk (I6 F-M12, removeConnector partial-mutate). CompilerAdapter's equality proof (contract §8.6) must be **type-checked**; transactions all-or-nothing with byte-exact preimage rollback.
2. **Do NOT auto-flatten multi-axis legacy** *(agree contract §9):* existing components (incl. the permanent Dan-ordered **converted mother-v2** canvas)
   are multi-axis CVA. Flattening size×tone → N×M free variants is **destructive** and loses axis semantics. Keep as `legacy-axis` SourceProjection
   until explicit user conversion; preview exact resulting variant count; **refuse if round-trip unprovable** (leave bytes unchanged).
3. **Seed the sidecar from existing `@fc-*` side-channels:** the engine stores connector/transition semantics in source comments
   (`@fc-transition`, `@fc-connector`, `default=X`) because CSS/JS shapes aren't losslessly invertible. Import must **read/seed graph from
   `@fc-*`**, not ignore it → else lossy migration of existing components. Long-term, the sidecar replaces the need for new `@fc-*`.
4. **`humanReadableVariantMap` is the right lesson** *(B17):* Framer already separates stable variant-ID from display alias; our engine uses
   variant *names* as identity (fragile). Build `VariantFrame.id` + `displayName` split from day one.
5. **Two-repo pollution:** `make-component`/`insert` fixtures mutate BOTH `onemo-next` AND `onemo-component-library` — checkout both.
   Dev-loop craft: HMR eats the first API call after a new probe folder (retry); underscore-prefixed app-router folders unroutable; stale `.next/dev/types` after deleting probe routes breaks `tsc` (rm it).

---

## E. G0–G5 ACCEPTANCE (Framer-fidelity assertions — complements QA's test list, contract §11)
| Gate | Framer-fidelity that MUST be provable (real Framer + generated source, not mocked) |
|---|---|
| **G0** | Every §A UNVERIFIED op operated (manual pass allowed) + observed/inferred-labelled with evidence; no phase enters on an unknown contract. |
| **G1** | Model/store/transaction PROOF only — **NO production UI, NO persisted semantic variant commands**: AuthoringGraph invariants (stable IDs, one-Primary, folder/instance references); sidecar store schema/revision/hash/reload; transaction commit/rollback framework + reparse-equality harness; dev-route validation. |
| **G2** | Enter edit → ONLY that component's variants in-place (NOT whole board); breadcrumb chip; Home exits preserving selection/history; no remount/crash; zero console errors; measured entry latency. **[moved from G1 — semantic variant + variant-compiler behavior belongs in the authoring slice, not the G1 proof gate] Variant override → Update Primary propagates to Primary; Reset Overrides restores inheritance; compiler emits flat variant-IDs + alias map (B17 shape); type-aware round-trip; byte-exact rollback.** |
| **G3** | Authored `Click(onTap)→Set Variant` w/ Delay + Once/Cycle **fires in preview on generated source**; **remove-inherited → Reset Override + undo restores** (B10); wire STRAIGHT + arrowhead-at-target + selection-scoped; all 4 TransitionSpec forms compile + play. |
| **G4** | Menu-Insert → working instance; drag-insert IF Dan-required (labelled); Detach/Replace With/Replace All operate; folder move does NOT churn imports; **Delete-component blocked while instances exist** (B15). |
| **G5** | Side-by-side behaviour matrix vs Framer per feature; ONEMO skin per slice (semantic-parity, no purple leak); reload/undo/malformed/compile-fail/concurrent recovery; measured budgets. |

---

## F. UNRESOLVED DAN DECISIONS (contract §14 — my additions)
1. **Drag-insert parity vs product choice (§14.3):** unverified across all 3 lanes. Decide: mandatory Framer-parity gesture, or ONEMO product requirement (menu-Insert primary, drag secondary). My lean: **menu-Insert primary (verifiable), drag as enhancement** — but it's your call.
2. **G0 manual pass:** the remaining unverified ops are drag/create gestures automation can't drive. OK to close G0 with a **short human-driven Framer pass** (you or a manual session), or do you want them treated as PRODUCT DECISIONs and specced from intent?
3. **Legacy conversion UX (§9):** when a user converts a multi-axis legacy component, what's the confirm surface (preview count + unsupported cases)? Product/UX decision.
4. **Override granularity:** how deep do per-variant overrides go (every style property? interactions too?) — needs the G0 manual pass on Update/Reset to spec exactly; flag for after G0.

---

**Bottom line:** the canonical direction is sound; my two structural pushes stand — **first-class override/inheritance on VariantFrame** and
**no line/col instance identity**. G0 is closed as far as automation allows; the residual drag/create gestures need a short manual pass (a Dan
decision). I remain on the evidence lane to run that pass and to reality-check the engineer's schema against real Framer. Not sign-ready — Dan's gate after the architecture revision passes QA.
