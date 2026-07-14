# Framer domain contract input → @s58-engineer (via @s58-lead/Dan)
@s58-expert · 2026-07-10 · role: Framer behaviour/domain authority. Complementary to the engineer, not a rewrite.
Inputs: QA `s58-framer-clone-adversarial-qa.md` §§10–13; my evidence memo `s58-framer-evidence-challenge-expert.md`;
3 independent extractions (mine, designer, QA); my I0–I6 engine history. **Evidence-labelled: OBSERVED = operated live by
≥1 lane (who noted); UNVERIFIED = not operated.** I do not edit product code and do not declare sign-ready.

---

## 1. EXACT OBSERVED BEHAVIOUR THE HARD CONTRACT MUST CONTAIN
Every item below was operated live. The canonical model must be able to represent ALL of it.

### 1a. Component + canvas
- **Edit-in-place:** instance → inspector **Edit Component** (or double-click) → SAME infinite canvas `?node=<componentNode>`,
  shows ONLY that component's variants as free frames; breadcrumb `Home › <Name>` chip in top bar; Layers lists variants;
  Home exits. *(me + designer + QA)*
- **Create-from-selection is ONE transaction:** ⌘⌥K on a selected frame → titled **New Component** dialog → replaces the
  source layer with a named **instance**, registers the component asset, changes node URL, enters `Home>Component` with a
  **Primary** variant. Needs a single transactional op + undo inverse. *(QA operated; designer saw dialog)*
- Blank create: Components `+` / New Component. *(me)*

### 1b. Variants — the model's hardest, most-observed behaviour
- Free named frames; "Variant 1" tagged **Primary** (default). `+Variant` ghost → new free frame; free canvas position (x/y/w/h). *(me + designer)*
- **PRIMARY-LINKED OVERRIDE lineage (critical):** each non-primary variant inherits from Primary; per-variant ctx menu =
  **Show Primary · Detach From Primary · Update Primary · Reset Overrides**. *(QA + ME re-verified live)*. → A variant is
  Primary + a set of per-property **overrides**; Update Primary propagates deltas up; Reset Overrides restores inheritance;
  Detach breaks the link. **This cannot be an afterthought — it's the core identity.**
- Separate **Hover / Pressed** state ghost slot below the config row (state variants). *(me + designer)*

### 1c. Interactions (connectors)
- Interactions `+` → **New Transition | New Event**. New Transition → row `On(trigger) → Set Variant(action)`. *(me + designer)*
- **Trigger vocab (read from live `<select>`, value `onTap`):** `Click · Click Start · Appear · Mouse Enter · Mouse Leave`.
  Display "Click" **compiles to `onTap`** — CompilerAdapter owns display→compiled mapping. *(designer + ME re-verified)*
- **Set Variant params:** `On · Delay(s) · Transition: Once|Cycle · Variant(target)`; clear action → **Reset…**; **multiple rows per variant**. *(designer + ME)*
- **Removal is override-aware:** removing an INHERITED Set Variant → **Reset Override** (not delete); undo restores it + Layers marker.
  Authored-delete ≠ override-of-inherited. *(QA)*
- **Wire** (canvas view): **STRAIGHT edge-to-edge, arrowhead at TARGET**, owning-variant→target the instant a target is set.
  Overlay (wire + ghost slots + badge) is **SELECTION-SCOPED** (only while a variant is selected). *(designer measured + my 07-09 pass)*

### 1d. Transitions (per-variant, first-class)
- Types **Instant · Ease · Spring**; Spring **Based On: Time | Physics**; Time = Duration/Bounce/Delay, Physics =
  Stiffness/Damping/Mass/Delay; each has Delay. *(QA + ME re-verified)*. Generated default `{type:"spring",bounce:0.2,duration:0.4,delay:0}`. *(designer module fetch)*

### 1e. Instances
- Inspector: `<Name> · Component` + **Variant picker** + **Trigger: Add…** + **Edit Component** (= main-component entry). *(me)*
- Ctx menu: **Detach Instance · Replace With · Replace All Instances With** (two replace scopes). Ctx-menu "Edit" did NOT enter the node. *(QA)*

### 1f. Assets / folders / preview
- Tree `Templates · Components · Styles · Vectors · Code`; nested folders; folder ctx **New Component · New Folder · Sort Alphabetically**. *(me)*
- Component ctx `Insert · Edit · Find · Rename · Duplicate · Delete · Library › · Copy Import · Copy URL`; **Delete DISABLED while instances exist**. *(me + QA)*
- Menus are **searchable command palettes** ("Type to search"). *(me + QA)*
- **Play** = separate full-screen `preview-iframe` (`view=preview`); interactions run live; ‹ Back exits. Author `canvas-iframe`
  and `preview-iframe` are DISTINCT sandboxes. *(me + QA)*

### 1g. Code-level compile target *(designer fetched the real module)*
- Flat variant-ID set + `humanReadableVariantMap` (names are aliases); interactions → per-variant `onTap`-class overrides calling
  `setVariant(id)`; spring via `MotionConfigContext`; `addPropertyControls` Enum for the instance variant picker; `withCSS` scoped classes;
  imports `"framer"`+`"framer-motion"`. → proves the desired compile target AND that our clean React+CSS is the real advantage.

---

## 2. STILL-UNVERIFIED FRAMER OPERATIONS (the G0 evidence-closure list — do NOT contract as exact behaviour until closed)
1. **New Event** — trigger set + action model (nobody opened it).
2. **Drag-to-insert** from Assets — all 3 automation passes FAILED to reproduce; menu **Insert** not confirmed to add a layer → **UNVERIFIED / likely REQUIRED-BY-DAN, not extracted fact.**
3. **▶ badge exact rule** — designer saw it on a zero-interaction *selected* variant; richer than "has an interaction".
4. **Connect-handle drag pickup** on canvas — synthetic drag failed.
5. **Hover/Pressed creation RESULT** + whether it auto-wires Primary→Hover.
6. **Variant** rename / delete / reorder / duplicate / set-default — operated end-to-end.
7. **Folder** CRUD / nest / move / sort / empty+error — operated.
8. **Detach / Replace With / Replace All / go-to-main** — operated end-to-end (menu items seen only).
9. **Interaction retarget** (repoint edge) + **deleted/renamed-target cleanup**.
10. **Override mechanics detail** — exactly which properties override vs inherit; Update-Primary propagation scope; Reset-Overrides scope.
11. **Ease curve names** (the Ease type's named curves + custom bezier).
12. **Preview** reset / viewport / error / history-back; **Undo/redo** across all above; **resilience** (reload, slow load, malformed, compile-fail, concurrent).

I will close these as the Framer-evidence owner, per phase, before each phase's contract locks.

---

## 3. AGREE / DISAGREE with QA's AuthoringGraphV1 (§12.2) — constructive, evidence-based
**Overall: strong, correct direction. I agree with the graph shape and the SourceProjection/CompilerAdapter boundary.** Specifics:

- `AuthoringGraphV1` top level, `ComponentDefinition`, `AssetFolder` — **AGREE.** displayName vs sourceExport split matches Framer's
  alias map; `primaryVariantId`, folder `parentId`+`sortKey` are right.
- `TransitionSpec` (4 forms) — **AGREE**, matches my live verification exactly. Add: `ease` needs the observed curve-name enum (G0 item #11).
- `InteractionEdge` — **STRONGLY AGREE.** `inheritedFromEdgeId` + `action: reset-override` + `repeat` + `delayMs` directly encode the
  override-aware behaviour QA/I observed. Note: `trigger` enum is display-side; CompilerAdapter maps → `onTap`-class. `action` correctly
  leaves New Event out until extracted — good.
- `VariantFrame` — **AGREE with ONE required addition (my strongest push):** `primaryId` identifies the parent but **NOT the override delta.**
  Framer's Show/Detach/Update/Reset Overrides operate on **per-property overrides vs Primary** — without representing them you cannot
  implement Update Primary or Reset Overrides. **Add `overrides: PropertyOverride[]` (or `{detached:boolean, overrides:Map}`).** Also
  `stateKind:"custom"|"hover"|"pressed"` is provisional — keep, but may extend after G0 (don't conflate the Hover/Pressed *state slot* with
  interaction *triggers* Mouse Enter/Leave; they are different mechanisms).
- `ComponentInstance` — **AGREE on shape, DISAGREE on `sourceLocation:{line,col}` as durable identity.** *(engine-history lesson):* line/col
  drift on any edit above the instance; my engine hit stale-position lies repeatedly (the fix was mandatory re-read, not trusting positions).
  Use a **stable source anchor** (marker/AST-path) or recompute location inside the transaction; never persist line/col as identity. Also
  instances may carry their own prop overrides (Framer instance overrides) — unverified depth (G0), may need `overrides` too.

**Net:** the missing piece across the model is a **first-class override/inheritance representation.** It is the most-observed and least-modelled behaviour. Everything else in AuthoringGraphV1 I'd sign.

---

## 4. MINIMAL BEHAVIOUR ACCEPTANCE MATRIX (per QA gate G0–G5 — Framer-fidelity assertions, complementing QA's test list)
| Gate | Behaviour that MUST be provable (from real Framer + generated source, not mocked) |
|---|---|
| **G0 evidence** | Every §2 op operated + observed/inferred-labelled with screenshot/DOM evidence; no phase enters on an unknown contract. |
| **G1 model/compiler** | Create/rename/move variant + Set Variant round-trip; **a variant override → Update Primary propagates to Primary; Reset Overrides restores inheritance**; compiler emits flat variant-IDs + alias map matching Framer's module shape; **type-aware** round-trip proof (not just parse-valid); byte-exact rollback on failure. |
| **G2 one-canvas slice** | Enter edit → ONLY that component's variants in-place (NOT whole board); breadcrumb chip; Home exits preserving selection/history; no remount/crash; zero console errors; measured entry latency. |
| **G3 interactions+preview** | Authored `Click(onTap)→Set Variant` with Delay + Once/Cycle **actually fires in preview on generated source**; remove-inherited → Reset Override + undo restores; wire STRAIGHT + arrowhead-at-target + selection-scoped; all 4 TransitionSpec forms compile + play. |
| **G4 assets/instances** | Menu-Insert → working instance; drag-insert IF Dan-required (labelled); Detach / Replace With / Replace All operate; folder move does NOT churn imports; Delete-component blocked while instances exist. |
| **G5 fidelity/resilience** | Side-by-side behaviour matrix vs Framer per feature; ONEMO skin per slice (semantic-parity test, no Framer-purple leak); reload/undo/malformed/compile-fail/concurrent recovery; measured budgets. |

---

## 5. MIGRATION / CLEAN-SOURCE CONCERNS from my I0–I6 engine work (scars worth heeding)
1. **Corrupt-write class (hard-won):** `assertValidTsx` is **syntax-only** — type-invalid-but-parseable code (e.g. TS2367) passes the
   guard and lands on disk. We fixed I6 F-M12 + removeConnector partial-mutate by **validate-all-before-mutate-all**. → CompilerAdapter's
   round-trip proof must be **type-aware**, every transaction **all-or-nothing with byte-exact preimage rollback** (QA says this; I confirm from scars).
2. **Positions drift:** engine does byte-offset splices; anything storing line/col across edits drifts. `parseComponentModel` re-reads source
   rather than trusting client state — keep that discipline; extend it to instance identity (see §3).
3. **Do NOT auto-flatten multi-axis legacy (STRONGLY agree QA §12.6):** existing components (incl. the permanent Dan-ordered converted
   **mother-v2** canvas) are multi-axis CVA. Flattening size×tone → N×M free variants is **destructive** and loses axis semantics. Keep as
   `legacy-axis` SourceProjection until explicit user conversion; show exact resulting variant count; **refuse if round-trip unprovable.**
4. **Don't strand the `@fc-*` side-channels:** the engine stores connector/transition semantics in source comments (`@fc-transition`,
   `@fc-connector`, `default=X`) because CSS/JS shapes aren't losslessly invertible. Existing components carry connector state there. The
   new sidecar (`authoring-v1.json`) should **read/seed from the existing `@fc-*` metadata** on import, not ignore it → else lossy migration.
5. **`humanReadableVariantMap` = the right lesson:** Framer already separates stable variant-ID from display alias; our engine currently
   uses variant *names* as identity (fragile). The canonical `VariantFrame.id` + `displayName` split fixes this — build it that way from day one.
6. **Two-repo pollution trap:** `make-component`/`insert` fixtures mutate BOTH onemo-next AND onemo-component-library — git-checkout BOTH,
   not just the worktree. **Dev-loop craft:** HMR eats the first API call after adding a probe folder (retry); underscore-prefixed app-router
   folders are unroutable (probe pages go in plain folders); stale `.next/dev/types` after deleting probe routes breaks `tsc` (rm it).

---

**Bottom line for lead/Dan:** the engineer's AuthoringGraphV1 direction is sound — I'd sign it with the **override/inheritance representation
added** and **line/col dropped as instance identity**. The behaviour contract above is what "clone Framer" concretely means, evidence-labelled.
I remain on the Framer-evidence lane to close the §2 gaps per phase and to reality-check the engineer's model against real Framer. Not sign-ready;
that's Dan's gate after the architecture revision passes QA.
