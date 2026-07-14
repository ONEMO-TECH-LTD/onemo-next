# Framer Component Module — TRUE STATE + REMAINING SPRINT (single tracked metric)

**Owner:** @s58-designer (now lead + meta) · **2026-07-13** · exact build HEAD `8d64fd3` (branch `session58-task/s58-framer-architecture`)
**Verification legend:** LIVE ✅ = I exercised it against the running build (headless — human-visible check still owed) · PARTIAL ◐ = built but incomplete/under-spec · UNBUILT ✗ = no code · REMOVED ⊘ = deliberately taken out · BUG 🐞.
**Honesty note:** NOTHING here has human-visible browser confirmation on the NEW build yet — the only human check (Dan) hit the WRONG build (`:3025` = old branch `804ffe7`). Codex-Chief-QA + s58-qa re-classify each row independently (source read + real visible browser) before any status is trusted.

## Q1 — Do we have a tracked parity-completion metric today? **NO.**
- **Contract** (`s58-framer-component-authoring-HARD-CONTRACT-v0.md`): has phase gates G0–G5 + prose behavior rows, but **no per-capability completion checklist, no metric, no % , no owners**. You cannot read "what's done vs promised" from it.
- **Linear**: parity sprints exist but are **STALE, pre-reset** — E7 (KAI-9364), E10 (KAI-9408 + E10-B/C/D), E11 (KAI-9419) were created 07-05…07-09 against the **rejected CVA/6-state model**; E11 still shows "Building" while the real build lives on a different branch. None track the current contract's G-gates.
- **This file is the fix**: the missing metric. Once you approve, it becomes the tracked source of truth (mirrored to a clean Linear epic, old E7/E10/E11 reconciled or closed).

## Q2 — What is REALLY built (working vs claimed) — the audit

### Built + mechanically verified (the free-variant foundation)
| Capability | Status | Evidence |
|---|---|---|
| Create component **from selection** (one transaction, naming dialog, source→instance) | ◐ built, human-verify owed | `create-component-from-selection` command exists + tested; full click-through NOT human-seen (needs a page-canvas element selected first) |
| Create **free named variant** (auto "Variant N", graph-backed, no CVA axis) | ✅ | live create; hardcoded-6-state model GONE, `components-canvas` route retired |
| **Rename** variant (inline, Enter-commit / Esc-cancel) | ✅ | measured @ 8d64fd3 |
| **Move** variant (free drag, sidecar-only, source untouched) + persist on reload | ✅ | byte-diff measured |
| **Undo** (⌘Z, transaction preimage) | ✅ | measured |
| **Import-source** recovery flow (classify → import) | ✅ | replaced the raw-409 dead-end |
| One-canvas edit-in-place (page hidden, one component) | ✅ | measured |
| Breadcrumb `Home › Component` | ◐ exists but **TINY** (font `label-xs`=10px) — not Framer's prominent top-bar | source-measured |
| ONEMO/DS-token skin (no Framer purple) | ✅ | computed-style sweep |

### NOT built — the majority of the Framer directive
| Capability (contract §6) | Status |
|---|---|
| True **infinite canvas** (bounded host today, not Framer pan/zoom infinite) | ◐ near-miss |
| **Blank component create** (Components/New) — contract says Framer has it | ⊘ REMOVED this phase — contradiction to resolve |
| **State creation** (Hover/Pressed ghost + implicit wire) — "create any state" | ✗ zero state commands |
| **Node/connector/interaction system** (InteractionEdge, New Transition/Event, trigger vocab, Set Variant popover, straight arrowhead selection-scoped wires) | ✗ the whole node system Dan asked for — unbuilt |
| **Transitions** (Instant/Ease/Spring-Time/Spring-Physics) | ✗ |
| **Play / preview mode** (separate iframe, live run, Back) | ✗ — "you can't test a component" |
| **Primary-linked override menu** (Show/Detach/Update/Reset Overrides) | ✗ (graph model `SourcePropertyRef` exists, no UI/commands) |
| **Folders / assets tree** (nested, CRUD) | ✗ |
| **Instances** (insert menu+drag, detach, replace, replace-all, variant picker, delete-guard) | ✗ |
| **▶ play badge** on interactive variants | ✗ |

### Confirmed BUG (build "not working")
- 🐞 **Double-tap dead-end**: the only library component is `DemoButton` (global); global authoring is blocked this phase, so double-tapping it fires an error toast and never opens the canvas — and there's no project component to edit (blank-create removed). **A user landing on Components has no working path to author anything.** Root-caused live.

**Verdict:** roughly the **free-variant authoring foundation + one-canvas + DS skin is real** (≈ the smallest slice of the directive). **Everything that makes it read/behave as Framer's node system — states, connectors, play, instances, folders, prominent breadcrumb, infinite canvas — is UNBUILT.** Not hallucinated (the team was honest each is "later phase"), but it was framed as "G2 done," which overclaims progress toward your directive.

## Q3 — Complexity, length, and the expert/engineer split

**Sizing (each is a bounded slice — clone from extracted sources in front, no invention):**
| Slice | Size | Notes |
|---|---|---|
| P0 kill dead-end + blank-create decision + breadcrumb prominence (Figma-styled) | S | unblocks "can actually use it" |
| Free-variant polish (infinite canvas feel, selection grammar) | S–M | |
| States (Hover/Pressed create + implicit wire) | M | `stateKind` field exists |
| **Node/connector/interaction system** (the big one) | **L** | fully extracted — expert has exact model + compiled-code target |
| Transitions (4 forms) | M | |
| Play/preview mode | M–L | |
| Primary-override menu | M | graph model exists |
| Folders / assets tree | M | |
| Instances (insert/detach/replace/variant-picker/guard) | M–L | |

**Honest length:** weeks-class (the contract itself said so). ~9 bounded slices, each QA-gated.

**The split — built on your principle (cloning extracted sources needs discipline, not long context):**
- **Engineer (250k, disciplined) = primary builder.** One bounded slice at a time, each with the contract row + Framer extraction + compiled-code target open in front. 250k is plenty per slice because the sources are fixed — no wide-context reasoning, just faithful cloning. Guardrail against drift: every slice ships as one command + its test + a human-visible proof; no "phase" claims.
- **Expert (1M, may drift) = adversarial QA peer + live-Framer re-probe + overflow only.** Kept on bounded verification and evidence, NOT open-ended build (where drift/invention shows). Re-probes real Framer when a slice needs a spec detail the extraction missed. Takes a build slice only if it genuinely needs cross-file context the engineer can't hold.
- **Codex-Chief-QA + s58-qa = the gate.** Independent LIVE/PARTIAL/UNBUILT classification + adversarial QA per package + final visible-Chrome + Figma-styled-Framer UX comparison. No self-authorized closure.
- **Me = lead + meta**, no build (role separation — I don't build what I review).
- **Nothing builds until you say go.**
