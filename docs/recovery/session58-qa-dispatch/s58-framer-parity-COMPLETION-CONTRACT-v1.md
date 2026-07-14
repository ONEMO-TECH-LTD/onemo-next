# Framer Component Module — COMPLETION CONTRACT v1 (measurable full-parity scoreboard)

**Owner:** @s58-designer (lead + meta) · **2026-07-13** · supersedes the completeness gap in HARD-CONTRACT-v0 (v0's architecture §1–§10 stands; this doc replaces v0's phase-gate model as the completion authority).
**Why this exists:** Codex-Chief-QA proved v0's gates G1–G5 can ALL pass while Dan's actual Framer-Components target stays unbuilt — v0 specs a foundation, not the product. This doc makes the FULL target measurable and traceable so "done" means Dan's product, not a passed gate.

**Two independent reality audits converged 2026-07-13** (designer `s58-framer-parity-TRUE-STATE-AND-SPRINT.md` + Codex-Chief-QA `s58-chief-qa-framer-parity-reality-audit.md`): same command surface (create-from-selection + create/rename/move variant), same UNBUILT majority. QA corrections folded below. Focused authoring suite = 15 files / 187 pass / 0 skipped. **No capability has human-visible browser proof yet** (QA's Chrome bridge was down; the only human-visible signal is Dan's + my :3030 dead-end reproduction). **Linear sprint E12 = KAI-9437; capability issues KAI-9438…9448 mirror this scoreboard 1:1.**

## Product Law (unchanged, restated)
Clone Framer's **behaviour, model, and full functionality** — rendered in **ONEMO/Figma styling** (DS tokens, Chillax, brand oklch, Phosphor-light icons). NOT Framer's purple/chrome. "Figma-styled Framer." Clone only what is extracted and in front of us — **no invention, no vibe-coding**. Every capability comes from live Framer + its compiled code.

## Dan's product decisions (2026-07-13, approved)
1. **Drag-to-insert** = MANDATORY (not optional).
2. **New Event** = extract live + BUILD (not deferred).
3. **Blank component create** = RESTORE (removal caused the double-tap dead-end).

## Completion law
- A capability is DONE only with BOTH: (a) source-code proof at a named commit AND (b) **human-visible browser proof** Dan can open and operate — headless/Playlwright validates mechanics only, never final. 
- Every row maps: **capability → acceptance criteria → owner → Linear ID → source proof → human-visible proof → status.**
- No phase-level "done." Done is per-capability, Dan-signed.
- Status legend: ✅ LIVE (source+visible) · ◐ PARTIAL · ✗ UNBUILT · ⊘ REMOVED · ⧗ SPEC-PENDING (expert extraction owed before AC can be written) · 🐞 BUG.

---

## THE SCOREBOARD — every capability, current status @ 8d64fd3 (QA re-classifying independently)

### A · Canvas & shell
| # | Capability | Acceptance (human-visible) | Status | Owner |
|---|---|---|---|---|
| A1 | Infinite canvas (Framer pan/zoom, not bounded host) | pan/zoom freely, variants free-placed | ◐ bounded host | ENG |
| A2 | Edit-in-place entry: double-click component / "Edit Component" → its variants in place | double-click ANY project component → canvas opens | 🐞 dead-end (global-only + blank-create removed) | ENG |
| A3 | Breadcrumb `Home › Component` prominent, top-bar, Figma-styled | readable chip (~28px, icons), fixed chrome | ◐ exists but 10px tiny, no icons | ENG |
| A4 | One-canvas scoping (page hidden, one component) | only edited component shows | ◐ PARTIAL (QA: scoped mechanics real, human-visible unverified) | ENG |
| A5 | **Component content editing** (edit layers/elements inside the component) — KAI-9447/E12-K | change inner element → source + all instances reflect | ✗ (QA-surfaced) | ENG |

### B · Component lifecycle + context menu
| # | Capability | Acceptance | Status | Owner |
|---|---|---|---|---|
| B1 | Create from selection (dialog, source→instance, edit context) | select element → dialog → component | ◐ built, human-verify owed | ENG |
| B2 | Blank create (Components/New) | New → named blank component | ⊘ REMOVED → restore | ENG |
| B3 | Rename component | inline/menu rename, consumers updated | ✅ (op exists) | ENG |
| B4 | Duplicate / Delete (guarded while instances exist) / Find | menu actions, delete-guard visible | ✗ | ENG |
| B5 | Copy Import / Copy URL / Library | menu actions | ✗ ⧗ (menu spec pending expert) | ENG |

### C · Variants + Primary-override
| C1 | Free create/rename/move/delete variant | live, auto-name, persist | ✅ create/rename/move; delete ✗ | ENG |
| C2 | Primary default + `· Primary` label | suffix on default | ✅ | — |
| C3 | Primary-override menu: Show/Detach/Update/Reset Overrides | menu on linked variant, each operates | ✗ (SourcePropertyRef model exists) | ENG |

### D · States (Framer's fixed set)
| D1 | Hover/Pressed state ghost → creates `<Variant>·Hover` + implicit wire | state ghost → pick → state frame + wire | ✗ (stateKind field exists) | ENG |

### E · Props / property-controls (E10-B — the biggest new surface)
| E1 | expose-as-prop (text first): lift node → prop + default | select node → expose → prop created | ✗ ⧗ (Framer props model pending expert) | ENG |
| E2 | Control types: text/boolean/enum/color/number (image/link phase-2 named) | each authorable | ✗ ⧗ | ENG |
| E3 | Instance Properties panel: shows props + edits write real JSX attr (set-instance-prop) | edit value → source attr | ✗ ⧗ | ENG |
| E4 | Reset-to-default per prop | reset → default | ✗ | ENG |
| E5 | Pipeline safety: tsc 0 after every prop op; parse-guard refusal on unsafe lifts | measured | ✗ | ENG |

### F · Node / interaction system (Framer node system Dan asked for)
| F1 | Interactions: New Transition + **New Event** | both authorable | ✗ ⧗ (New Event spec pending expert) | ENG |
| F2 | Trigger vocab: Click/Click Start/Appear/Mouse Enter/Mouse Leave | exact set | ✗ | ENG |
| F3 | Set Variant params: On/Delay/Once|Cycle/target | popover | ✗ | ENG |
| F4 | Wires: straight, arrowhead-at-target, selection-scoped | measured geometry | ✗ | ENG |
| F5 | Connector drag-pickup (⚡ handle → target) | drag creates interaction | ✗ | ENG |
| F6 | Transitions: Instant/Ease/Spring-Time/Spring-Physics | 4 forms compile+play | ✗ | ENG |
| F7 | ▶ play badge on interactive variants | badge tracks effective interaction | ✗ | ENG |
| F8 | Reset Override (inherited interaction removal) + undo | tombstone + restore | ✗ | ENG |

### G · Play / preview mode
| G1 | ▶ → separate preview iframe, live interactions run, Back restores | preview runs the compiled component | ✗ | ENG |

### H · Assets / folders / Components page
| H1 | Folder tree: New Component/New Folder/Sort, nesting | folder CRUD, no import churn | ✗ ⧗ (page behaviors pending expert) | ENG |
| H2 | Project/Global/category behavior | libraries + categories | ◐ list exists, global authoring blocked | ENG |
| H3 | Components page completeness: search, real rendered previews, instance counts | measurable | ✗ | ENG |

### I · Instances
| I1 | Insert: menu AND **drag** (mandatory) | both place an instance | ✗ | ENG |
| I2 | Detach instance | inline subtree | ✗ | ENG |
| I3 | Replace With / Replace All Instances With | two scopes | ✗ | ENG |
| I4 | Instance variant picker | switch shown variant | ✗ | ENG |
| I5 | Go to main component | jump+select | ✗ | ENG |

### J · Cross-cutting (apply to every row above)
| J1 | Figma-styled Framer skin V1–V10 (zero Framer purple, DS tokens, Phosphor icons) | per-surface | ◐ tokens on built rows | ENG/DESIGN-META |
| J2 | Behavior semantics S1–S9 (selection ladder, overlay-scoping, etc.) | per-surface | ◐ | QA |
| J3 | Persistence/reload/undo/dead-end checks | every capability | partial | QA |
| J4 | Human-visible browser proof (no headless substitution) | every DONE row | GATE | QA |
| J5 | Two-repo cleanliness (onemo-next + component-library) | every probe | GATE | QA |

**Built today ≈ A4 + B1(partial) + B3 + C1(partial) + C2 = the free-variant foundation.** Everything else UNBUILT/removed/spec-pending. That is the honest completion state.

## Owners / actors (current)
- **@s58-designer** — lead + meta (this contract, Linear plan, gate orchestration; NO build).
- **@s58-engineer** — sole builder, one bounded slice at a time, sources in front, no invention.
- **@s58-expert** — adversarial QA peer + live-Framer extraction of ⧗ SPEC-PENDING rows + overflow only (no open-ended build).
- **Codex-Chief-QA + s58-qa** — independent classification + adversarial per-package QA + final human-visible Chrome + Figma-styled UX comparison. No self-closure.
- **Dan** — product decisions + final sign-off. Nothing DONE without Dan.

## Open before AC freeze (⧗ rows — expert extraction dispatched 2026-07-13)
Props/property-controls exact model (E1–E3), New Event (F1), component context menu (B5), Components/Assets page behaviors (H1–H3). AC for these rows is written only after expert's measured extraction lands.

## Traceability (the metric v0 lacked)
Each row above gets a Linear ID (sprint below). A row is closeable only when: Linear AC met + source-proof commit + human-visible proof archived + QA independent PASS + Dan sign. The Linear sprint mirrors this scoreboard 1:1.
