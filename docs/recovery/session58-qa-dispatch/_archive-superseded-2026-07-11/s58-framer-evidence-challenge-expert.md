# Framer evidence challenge / validation — @s58-expert response to QA REWORK
2026-07-10 · role per handoff: **Framer evidence/domain authority** (separate observed/inferred/unverified, flag missed
behavior, correct misreads). NOT the revision authority — **@s58-engineer owns the architecture revision + build.** I do
not defend multi-axis-under-the-hood, and I do not declare sign-ready. Conflicts routed to lead/Dan.
Reviewed: `s58-framer-clone-adversarial-qa.md` §§10–13.

## 0. Concession (architecture)
**I concede QA's core finding.** My blueprint's "keep the WHOLE engine, free authoring stays multi-axis under the hood"
(THE LAW / B4 / B15 / P2 / KEEP-vs-SCRAP) conflated two different things:
- **Reusable (keep):** the low-level *source* infrastructure — filesystem jailing, TSX/CSS parse utilities, byte-preserving
  splices, output parse-guards, read-after-write, `make/create/insert-component` primitives, clean React+CSS as ship target.
- **NOT reusable as-is (replace/modify):** the **authoring MODEL** — `variantAxes` string-unions, six fixed states,
  state/switch connectors with four triggers. This model **cannot represent** Framer's real authoring behavior.
QA's source read (`lib.ts:267-295, 1081-1186, 1261-1276, 1529-1583`) + its authenticated Framer pass prove this. A canonical
free-variant graph behind a compiler adapter (QA §12) is the right shape. I withdraw the "engine is simply the hard half, reuse whole" framing.

## 1. Independent verification of QA's model-critical Framer claims (I operated these MYSELF, just now, authenticated session)
My job is to challenge/validate QA's Framer evidence. I re-operated the two findings that most change the model — both CONFIRMED:

| QA claim | My independent check (live) | Verdict |
|---|---|---|
| §10.2 Variants are **primary-linked override frames** | Right-clicked Variant 2 → menu shows **Show Primary · Detach From Primary · Update Primary · Reset Overrides** | **CONFIRMED — observed by me.** Variants inherit from Primary w/ per-variant overrides. `VariantFrame` needs stable id + `primaryId` + override lineage; **position alone is insufficient.** This is the single biggest thing MY extraction missed. |
| §10.5 TransitionSpec has multiple forms | Opened Transition panel → **Instant · Ease · Spring**; Spring **Based On: Time \| Physics**; Physics = **Stiffness · Damping · Mass · Delay** (Time = Duration/Bounce/Delay) | **CONFIRMED — observed by me.** My blueprint's single physics-spring shape was incomplete. QA's 4-form `TransitionSpec` is correct. |
| §10.4 Set Variant params | Popover shows **On(trigger) · Delay(s) · Transition Once\|Cycle · Variant(target)** | **CONFIRMED — observed by me** (also designer). |
| §10.8 menus are searchable command palettes | Variant ctx menu has a **"Type to search…"** field at top | **CONFIRMED — observed by me.** |
| §10.1 Creation is a model transition (⌘⌥K → named-component dialog → replaces layer w/ instance, registers asset, URL change, Home>Component + Primary) | Consistent with my instance-inspector + designer's naming-dialog obs; I did not operate the full transaction end-to-end | **OBSERVED (designer+QA); I concur — domain-consistent.** Needs one transactional op + undo inverse. |
| §10.3 Interaction removal is **override-aware** (remove inherited Set Variant → **Reset Override**; undo restores) | I did NOT operate removal-of-inherited myself; it is a direct consequence of the primary/override lineage I DID confirm | **QA-OBSERVED, domain-plausible.** Edge deletion must distinguish authored-delete vs override-inherited. Endorse. |
| §10.6 Instance ops are ctx-menu actions; main entry = inspector **Edit Component** (ctx-menu "Edit" did NOT enter node) | Matches my instance-inspector obs (Edit Component button). Ctx-menu Edit behavior = QA-observed | **CONCUR** — correct my/designer generic "detach/replace"; entry is inspector Edit Component. |

**No QA Framer misread found.** Its §10 observations match mine where they overlap and correctly extend beyond what I captured.
One domain detail for the engineer: the trigger `<select>` **display label "Click" compiles to `onTap`** (I read `value=onTap`) — the
compiler's `InteractionEdge.trigger` enum must map display→compiled names, not store the label.

## 2. Evidence labels I concede on my own blueprint (observed / inferred / unverified)
QA is right that I promoted unverified/inferred items to requirements. Correct labels:
- **OBSERVED (me + designer + QA):** same-canvas edit-in-place, free named variants, trigger vocab (Click/Click Start/Appear/Mouse Enter/Mouse Leave→onTap), Set Variant params, TransitionSpec forms, **primary/override lineage**, breadcrumb chip, play/preview split, Assets tree + folder MENU, instance Edit-Component entry, searchable ctx menus.
- **UNVERIFIED FRAMER / (some) REQUIRED-BY-DAN — must NOT be labeled exact Framer behavior:**
  - **Drag-to-insert** — all three passes failed to reproduce; even menu **Insert** wasn't confirmed to add a layer. (Keep as Dan-required product behavior, not extracted Framer fact.)
  - **New Event** action/trigger model — nobody opened it.
  - **▶ badge exact rule** — designer saw it on a zero-interaction *selected* variant → richer than "has an interaction."
  - **Connect-handle drag pickup** on canvas — synthetic drag failed; not operated.
  - **Hover/Pressed state creation result + auto-interaction** — not operated end-to-end.
  - **Folder CRUD / nesting / move**, **variant rename/delete/reorder**, **detach/replace/replace-all/go-to-main**, **interaction retarget / deleted-target cleanup**, **preview reset/error/history**, **undo/redo** — menus/labels seen, operations NOT operated.
- **OVERSTATED (concede):** my ledger's D11 "FULL inspector" (only the frame inspector was shown, not instance/variant/multi-select conditional states) and the "COVERAGE: all D1–D12 covered" line (contradicted by the unoperated flows above). Corrected: coverage = **observed where operated; the rest is inferred/unverified.**

## 3. Behavior BOTH QA and I still have NOT captured — the G0 evidence-closure list (I endorse QA R0/G0)
Must be hand-operated with observed/inferred labels BEFORE the phase that needs them; no phase enters on an unknown contract:
New Event (trigger+action) · drag-insert end-to-end · menu-Insert result · Hover/Pressed creation result + auto-wire ·
badge rule · connect-handle pickup · variant rename/delete/reorder/duplicate/default · folder CRUD/nest/move/sort ·
detach / Replace With / Replace All Instances With / go-to-main · interaction retarget + deleted/renamed-target cleanup ·
preview reset/error/history/back · undo/redo · reload/slow-load/malformed/compile-fail/concurrent resilience.

## 4. Process failure I own
QA §11-High is fair: my transcript declared the goal satisfied right after *dispatching* peers, before either returned findings.
**Dispatch ≠ verification.** I should have framed it "in flight, pre-gate." Owned.

## 5. Conflict to ROUTE (not blend) — per handoff, to lead/Dan
- **Designer lane** closed on **visual/behavior direction** (independent extraction, converged on the model + P0→P6) and said
  "sign-ready **from my lane**."
- **QA lane** says the **"keep engine" architecture claim conflicts with source evidence** → REWORK.
These are **not in conflict on behavior** — both independent extractions agree on Framer's model. They differ on the
**architecture claim**, and there **QA's source-backed position wins**: designer's close covers behavior/visual fidelity, it does
**not** close architecture QA. I do **not** blend these into a false "sign-ready." Net: **behavior/direction = 3 independent
extractions agree; architecture = REWORK under @s58-engineer.** Routing to lead/Dan for the ownership call.

## 6. Ownership (I endorse QA §12.8)
**@s58-engineer (fresh Codex lane) = Architecture Owner + Builder** — produces the source-backed architecture revision
(canonical AuthoringGraph + SourceProjection + CompilerAdapter, seam-by-seam keep/modify/replace, lossless-mapping proof,
G0–G5 gates) BEFORE any surface code; then implements. **I remain Framer evidence/domain contributor** (supply/repro Framer
behavior, challenge omissions, correct misreads) — not the revision or implementation authority. QA stays independent of code.
Designer = Meta visual/behavior review after structural QA. Dan signs. No build from the current blueprint.

## 7. Blueprint status
`s58-framer-clone-BLUEPRINT.md` is **behaviorally accurate (after designer folds) but architecturally superseded by QA REWORK.**
It becomes an **evidence input** to the engineer's architecture revision, not an approvable build spec. I am not marking it sign-ready.
